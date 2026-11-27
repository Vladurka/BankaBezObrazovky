"""Agent George: LLM s nástroji (OpenAI tool calling) a záloha bez LLM.

Pořadí zpracování dotazu:
1. deterministická kontrola vishingu (safety.py) - před LLM,
2. "ano"/"ne" k čekající akci se vyřídí bez LLM,
3. LLM s nástroji; když LLM není k dispozici, jednoduchý rozpoznávač záměrů.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import safety
import tools
from stav import banka

log = logging.getLogger("banka.agent")

ANO_SLOVA = {"ano", "jo", "jasne", "potvrzuji", "potvrzuju", "potvrdit", "souhlasim", "dobre", "ok", "okej", "urcite"}
POKYN_SLOVA = {"posli", "poslat", "zaplat", "zaplatit", "proved", "odesli"}  # "pošli to" jako odpověď na dotaz
NE_SLOVA = {"ne", "nechci", "zrus", "zrusit", "storno", "nic", "nikoliv", "nesouhlasim"}

SYSTEM_PROMPT = """Jsi George, hlasový asistent České spořitelny (ilustrační demo).
Klient: {jmeno} (oslovuj "{osloveni}"). Mluvíš česky v mužském rodě, vždy jen 1-2 krátké věty, bez odrážek a emoji.
Pravidla:
- Platby a přesuny NIKDY neprovádíš sám. Nástroje je jen připraví a klient je musí potvrdit.
  Po přípravě vždy zopakuj příjemce a částku a zeptej se "Mám to poslat?".
- NIKDY netvrď, že platba odešla nebo byla provedena. To klientovi oznamuje jen bankovní systém.
- Neptej se zbytečně. "Zaplať X jako minule" -> hned zavolej platba_jako_minule bez částky (částku najde nástroj).
  Příjemce i částka řečeny -> hned zavolej poslat_znamemu. Potvrzení stejně proběhne až potom.
- Když klient chce cokoli poslat kvůli telefonátu "z banky", "z policie" nebo na "bezpečný/nový účet",
  zavolej nástroj nahlasit_podezreni a nic nepřipravuj.
- Při ztrátě nebo krádeži karty ji rovnou zablokuj nástrojem zablokovat_kartu.
- Pokud nástroj vrátí "zamitnuto" nebo "POZASTAVENO", řekni klientovi důvod a nic nepřemlouvej.
- Investice: vysvětluješ portfolio a pravidla, ale NIKDY neradíš koupit nebo prodat konkrétní věc.
  Na žádost o konkrétní investiční radu nabídni spojení s poradcem (nástroj spojit_s_poradcem).
- Neznáš-li odpověď, řekni to. Nevymýšlej čísla, ber je jen z nástrojů.
"""


def odpoved_na_potvrzeni(text: str) -> str | None:
    """Rozpozná krátké "ano" / "ne" k čekající akci. Vrací "ano", "ne" nebo None."""
    slova = re.sub(r"[^a-z ]", " ", safety.normalizuj(text)).split()
    if not slova or len(slova) > 6:
        return None
    if slova[0] in NE_SLOVA or any(s in NE_SLOVA - {"ne", "nic"} for s in slova):
        return "ne"
    if slova[0] in ANO_SLOVA or (slova[0] in POKYN_SLOVA and len(slova) <= 3):
        return "ano"
    return None


def _cislo(text: str) -> float | None:
    m = re.search(r"(\d[\d\s]*)(?:\s*(kc|korun|,-))?", safety.normalizuj(text))
    if not m:
        return None
    return float(m.group(1).replace(" ", ""))


async def odpovez(uzivatel_id: str, session_id: str, text: str) -> dict[str, Any]:
    ctx = tools.Kontext(uzivatel_id=uzivatel_id, session_id=session_id, text=text)
    banka.pridej_do_historie(session_id, "klient", text)

    reply = await _zpracuj(ctx, text)
    if ctx.pevna_odpoved:
        reply = ctx.pevna_odpoved

    banka.pridej_do_historie(session_id, "george", reply)
    return {"reply": reply, "speak": reply, "actions": ctx.actions, "pending": ctx.pending}


async def potvrd(uzivatel_id: str, session_id: str, pending_id: str, odpoved: str) -> dict[str, Any]:
    ctx = tools.Kontext(uzivatel_id=uzivatel_id, session_id=session_id)
    akce = banka.cekajici.get(session_id, {}).pop(pending_id, None)
    if not akce or akce.get("uzivatel") != uzivatel_id:
        reply = "Tuhle akci už nemám, nic jsem neprovedl."
    elif odpoved == "ano":
        reply = tools.proved_cekajici(ctx, akce)
    else:
        ctx.actions.append({"typ": "akce_zrusena", **akce})
        reply = "Dobře, nic jsem neposlal."
    banka.pridej_do_historie(session_id, "george", reply)
    return {"reply": reply, "speak": reply, "actions": ctx.actions, "pending": None}


async def _zpracuj(ctx: tools.Kontext, text: str) -> str:
    # 1) vishing - deterministicky, před LLM
    vishing = safety.vyhodnot_vishing(text)
    if vishing.vishing:
        tools._zastav_vishing(ctx, vishing.signaly)
        return ctx.pevna_odpoved or ""

    # 2) hlasové "ano" / "ne" k poslední čekající akci
    cekajici = banka.cekajici.get(ctx.session_id, {})
    odpoved = odpoved_na_potvrzeni(text) if cekajici else None
    if odpoved:
        posledni_id = list(cekajici)[-1]
        vysledek = await potvrd(ctx.uzivatel_id, ctx.session_id, posledni_id, odpoved)
        ctx.actions.extend(vysledek["actions"])
        banka.historie[ctx.session_id].pop()  # potvrd() už odpověď zapsal, zapíše ji odpovez()
        return vysledek["reply"]

    # 3) LLM s nástroji, při chybě záloha bez LLM
    if os.getenv("OPENAI_API_KEY"):
        try:
            return await _odpoved_llm(ctx)
        except Exception:
            log.exception("Volání LLM selhalo, používám zálohu bez LLM.")
    return _odpoved_bez_llm(ctx, text)


async def _odpoved_llm(ctx: tools.Kontext) -> str:
    from openai import AsyncOpenAI

    klient = AsyncOpenAI()
    u = banka.uzivatel(ctx.uzivatel_id)
    zpravy: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT.format(jmeno=u["jmeno"], osloveni=u.get("osloveni", ""))}
    ]
    for z in banka.historie.get(ctx.session_id, [])[-12:]:
        zpravy.append({"role": "user" if z["kdo"] == "klient" else "assistant", "content": z["text"]})

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    for _ in range(4):
        odpoved = await klient.chat.completions.create(
            model=model, messages=zpravy, tools=tools.SCHEMATA, temperature=0, timeout=20,
        )
        zprava = odpoved.choices[0].message
        if not zprava.tool_calls:
            return (zprava.content or "").strip()
        zpravy.append(zprava.model_dump(exclude_none=True))
        for volani in zprava.tool_calls:
            vysledek = _spust_nastroj(ctx, volani.function.name, volani.function.arguments)
            zpravy.append({"role": "tool", "tool_call_id": volani.id, "content": json.dumps(vysledek, ensure_ascii=False)})
            if ctx.pevna_odpoved:
                return ctx.pevna_odpoved
    return "Promiňte, tohle teď nezvládnu. Zkuste to prosím jinak."


def _spust_nastroj(ctx: tools.Kontext, nazev: str, argumenty: str) -> dict[str, Any]:
    funkce = tools.NASTROJE.get(nazev)
    if not funkce:
        return {"chyba": f"Neznámý nástroj {nazev}"}
    try:
        args = json.loads(argumenty or "{}")
        if not isinstance(args, dict):
            raise ValueError("Argumenty nejsou objekt.")
        log.info("Nástroj %s(%s)", nazev, args)
        return funkce(ctx, **args)
    except Exception as e:
        log.warning("Nástroj %s selhal: %s", nazev, e)
        return {"chyba": "Nástroj selhal."}


def _odpoved_bez_llm(ctx: tools.Kontext, text: str) -> str:
    """Jednoduchý rozpoznávač záměrů pro případ, že LLM nefunguje."""
    t = safety.normalizuj(text)
    castka = _cislo(text)

    if any(s in t for s in ("zustatek", "kolik mam", "stav uctu")):
        r = tools.zustatek(ctx)
        return f"Na účtu máte {tools.kc(r['zustatek_kc'])}."
    if any(s in t for s in ("zablokuj", "ztratil", "ztratila", "ukradli", "karta")):
        tools.zablokovat_kartu(ctx)
        return "Kartu jsem zablokoval. Novou si můžete objednat v aplikaci."
    if any(s in t for s in ("zaplat", "posli", "poslat", "plat")):
        kontakt = banka.najdi_kontakt(ctx.uzivatel_id, t)
        if kontakt is None:
            for k in banka.uzivatel(ctx.uzivatel_id)["kontakty"]:
                if any(a in t for a in k.get("aliasy", [])):
                    kontakt = k
                    break
        r = tools._priprav_platbu(ctx, kontakt["id"] if kontakt else t, castka, jako_minule="minule" in t or castka is None)
        if "zamitnuto" in r:
            return r["zamitnuto"]
        if "chyba" in r:
            return r["chyba"]
        if r.get("ceka_na_potvrzeni"):
            return f"Pošlu {tools.kc(r['castka_kc'])} pro {r['prijemce']}. Mám to poslat?"
        return ctx.pevna_odpoved or "Platbu jsem nepřipravil."
    if any(s in t for s in ("prodej vse", "prodat vse", "prodej vsechno", "prodat vsechno")):
        tools.prodat_vse(ctx)
        return "Prodej všeho má 24hodinovou lhůtu a můžete ho kdykoli zrušit. Opravdu ho chcete naplánovat?"
    if any(s in t for s in ("mam koupit", "mam prodat", "co koupit", "do ceho investovat", "poradit")):
        tools.spojit_s_poradcem(ctx, text)
        return "Konkrétní investiční radu vám dá poradce. Spojím vás, ozve se do 15 minut."
    if "pravidl" in t:
        r = tools.pravidla_portfolia(ctx)
        return f"Máte {len(r['pravidla'])} pravidla. První zní: {r['pravidla'][0]}" if r["pravidla"] else "Zatím nemáte žádná pravidla."
    if any(s in t for s in ("portfolio", "investic", "pulse")):
        r = tools.portfolio(ctx)
        nejvic = max(r["zeme_procenta"], key=r["zeme_procenta"].get)
        return f"Portfolio má hodnotu {tools.kc(r['celkem_kc'])}, nejvíc je v zemi {nejvic}."
    return "Rozumím. Umím zjistit zůstatek, zaplatit jako minule, zablokovat kartu nebo ukázat portfolio."
