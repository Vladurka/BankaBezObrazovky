"""FastAPI backend pro prototyp „Banka bez obrazovky".

Spuštění (z adresáře backend):
    uvicorn main:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import logging
import os
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

import agent  # noqa: E402  (načíst až po .env)
import tools  # noqa: E402
import zatreseni  # noqa: E402
from stav import banka, rozesilac  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("banka")

app = FastAPI(title="Banka bez obrazovky – George")
# Demo běží v lokální síti, mobilní aplikace neposílá cookies.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Verze protokolu mezi aplikací a serverem. Zvýšit při každé nekompatibilní změně,
# aby starý kód v telefonu nemohl rozbít zatřesení (server ho odmítne).
VERZE_PROTOKOLU = 2

MAX_DELKA_TEXTU = 500
MAX_VELIKOST_ZVUKU = 5 * 1024 * 1024  # 5 MB


def _over_uzivatele(uzivatel_id: str) -> None:
    if uzivatel_id not in banka.uzivatele:
        raise HTTPException(404, "Neznámý uživatel.")


class Dotaz(BaseModel):
    session_id: str = Field(min_length=1, max_length=64)
    uzivatel: str = Field(min_length=1, max_length=32)
    text: str = Field(min_length=1, max_length=MAX_DELKA_TEXTU)


class Potvrzeni(BaseModel):
    session_id: str = Field(min_length=1, max_length=64)
    uzivatel: str = Field(min_length=1, max_length=32)
    pending_id: str = Field(min_length=1, max_length=32)
    answer: Literal["ano", "ne"]


class PulseUdalost(BaseModel):
    uzivatel: str = Field(min_length=1, max_length=32)
    typ: Literal["konflikt", "propad"]
    region: str = Field(default="Tchaj-wan", max_length=40)


@app.get("/")
async def zdravi() -> dict:
    return {"stav": "ok", "llm": bool(os.getenv("OPENAI_API_KEY")), "verze": VERZE_PROTOKOLU}


@app.get("/uzivatele")
async def uzivatele() -> list[dict]:
    return [{"id": u["id"], "jmeno": u["jmeno"]} for u in banka.uzivatele.values()]


@app.get("/ucet/{uzivatel_id}")
async def ucet(uzivatel_id: str) -> dict:
    _over_uzivatele(uzivatel_id)
    u = banka.uzivatel(uzivatel_id)
    strazce = banka.uzivatele.get(u.get("strazce") or "", {})
    return {
        "id": u["id"], "jmeno": u["jmeno"], "ucet": u["ucet"], "zustatek": u["zustatek"],
        "pohyby": u["pohyby"][:30], "kontakty": [{"id": k["id"], "nazev": k["nazev"]} for k in u["kontakty"]],
        "strazce": strazce.get("jmeno"), "portfolio": banka.portfolia.get(uzivatel_id),
        "upozorneni": banka.upozorneni.get(uzivatel_id, [])[-20:],
    }


@app.post("/ask")
async def ask(dotaz: Dotaz) -> dict:
    _over_uzivatele(dotaz.uzivatel)
    return await agent.odpovez(dotaz.uzivatel, dotaz.session_id, dotaz.text.strip())


@app.post("/confirm")
async def confirm(p: Potvrzeni) -> dict:
    _over_uzivatele(p.uzivatel)
    banka.pridej_do_historie(p.session_id, "klient", p.answer)
    return await agent.potvrd(p.uzivatel, p.session_id, p.pending_id, p.answer)


@app.get("/history/{session_id}")
async def history(session_id: str) -> list[dict]:
    return banka.historie.get(session_id, [])


@app.post("/pulse/udalost")
async def pulse_udalost(u: PulseUdalost) -> dict:
    _over_uzivatele(u.uzivatel)
    return tools.pulse_udalost(u.uzivatel, u.typ, u.region)


@app.post("/stt")
async def stt(soubor: UploadFile = File(...)) -> dict:
    """Převod řeči na text přes OpenAI. Klíč zůstává jen na serveru."""
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(503, "Rozpoznávání řeči není nastavené.")
    data = await soubor.read()
    log.info("STT: přijato %s B, soubor=%s, typ=%s", len(data), soubor.filename, soubor.content_type)
    if not data or len(data) > MAX_VELIKOST_ZVUKU:
        raise HTTPException(400, "Nahrávka je prázdná nebo příliš velká.")
    from openai import AsyncOpenAI

    try:
        vysledek = await AsyncOpenAI().audio.transcriptions.create(
            model=os.getenv("OPENAI_STT_MODEL", "gpt-4o-mini-transcribe"),
            file=(soubor.filename or "nahravka.m4a", data),
            language="cs",
            prompt="Bankovní asistent George. Platba, zůstatek, elektřina, Strážce, portfolio.",
        )
    except Exception as e:
        log.exception("Převod řeči selhal.")
        # typ chyby pomůže při ladění, text výjimky se neposílá (mohl by obsahovat citlivé údaje)
        raise HTTPException(502, f"Převod řeči selhal ({type(e).__name__}).")
    log.info("STT: rozpoznáno %s znaků", len(vysledek.text or ""))
    return {"text": (vysledek.text or "").strip()}


@app.post("/reset")
async def reset() -> dict:
    banka.reset()
    return {"stav": "obnoveno"}


@app.websocket("/ws/{uzivatel_id}")
async def ws(websocket: WebSocket, uzivatel_id: str) -> None:
    """Jedno spojení na zařízení: zatřesení a živé události (Strážce, příchozí platby)."""
    if uzivatel_id not in banka.uzivatele:
        await websocket.close(code=4404)
        return
    await websocket.accept()
    if websocket.query_params.get("verze") != str(VERZE_PROTOKOLU):
        # starý kód v telefonu: nepustit ho k zatřesení ani k událostem
        log.warning("Zařízení %s má zastaralou aplikaci, spojení odmítnuto.", uzivatel_id)
        await websocket.send_json({"typ": "zastarala_aplikace", "verze_serveru": VERZE_PROTOKOLU})
        await websocket.close(code=4426)
        return
    await websocket.send_json({"typ": "verze", "verze": VERZE_PROTOKOLU})
    rozesilac.pripoj(uzivatel_id, websocket)
    log.info("Zařízení %s připojeno.", uzivatel_id)
    try:
        while True:
            zprava = await websocket.receive_json()
            if not isinstance(zprava, dict):
                continue
            typ = zprava.get("typ")
            par_id = str(zprava.get("id", ""))[:32]
            if typ == "zatreseni":
                await zatreseni.zatreseni(uzivatel_id)
            elif typ == "zatreseni_zrusit":
                zatreseni.zrusit_hledani(uzivatel_id)
            elif typ == "zatreseni_nabidka":
                await zatreseni.nabidka(uzivatel_id, par_id, zprava.get("castka"))
            elif typ == "zatreseni_potvrzeni":
                await zatreseni.potvrzeni(uzivatel_id, par_id, str(zprava.get("odpoved", "")))
            elif typ == "zatreseni_zrusit_par":
                await zatreseni.zrusit_par(uzivatel_id, par_id)
            elif typ == "ping":
                await websocket.send_json({"typ": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("Chyba ve WebSocket spojení %s.", uzivatel_id)
    finally:
        # odpojený telefon už nehledá protějšek
        rozesilac.odpoj(uzivatel_id, websocket)
        try:
            await zatreseni.odpojeno(uzivatel_id)
        except Exception:
            log.exception("Úklid zatřesení po odpojení %s selhal.", uzivatel_id)
        log.info("Zařízení %s odpojeno.", uzivatel_id)
