"""Stav ilustrační banky v paměti a rozesílání událostí na zařízení.

Data se načítají z data/*.json a drží se jen v paměti, takže každý
restart (nebo POST /reset) vrátí demo do výchozího stavu.
"""

from __future__ import annotations

import asyncio
import copy
import json
import logging
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any

from fastapi import WebSocket

log = logging.getLogger("banka.stav")

SLOZKA_DAT = Path(__file__).parent / "data"


def _nacti(nazev: str) -> dict[str, Any]:
    with open(SLOZKA_DAT / nazev, encoding="utf-8") as f:
        return json.load(f)


class Banka:
    """Veškerý měnitelný stav dema."""

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.uzivatele: dict[str, dict[str, Any]] = copy.deepcopy(_nacti("uzivatele.json"))
        self.portfolia: dict[str, dict[str, Any]] = copy.deepcopy(_nacti("portfolio.json"))
        # čekající akce (platby, přesuny) podle session_id -> pending_id -> akce
        self.cekajici: dict[str, dict[str, dict[str, Any]]] = {}
        # historie konverzace podle session_id
        self.historie: dict[str, list[dict[str, Any]]] = {}
        # zprávy Strážci a další upozornění podle uživatele (pro zařízení offline)
        self.upozorneni: dict[str, list[dict[str, Any]]] = {u: [] for u in self.uzivatele}
        # kolik kdo dnes poslal hlasem
        self.hlasem_dnes: dict[str, float] = {u: 0 for u in self.uzivatele}
        # session, ve kterých bylo zachyceno podezření na vishing
        self.podezreni: set[str] = set()
        log.info("Stav banky obnoven do výchozích hodnot.")

    # ---- pomocné funkce -------------------------------------------------

    def uzivatel(self, uzivatel_id: str) -> dict[str, Any]:
        if uzivatel_id not in self.uzivatele:
            raise KeyError(f"Neznámý uživatel: {uzivatel_id}")
        return self.uzivatele[uzivatel_id]

    def najdi_kontakt(self, uzivatel_id: str, dotaz: str) -> dict[str, Any] | None:
        """Najde známého příjemce podle id, názvu nebo aliasu (bez diakritiky)."""
        from safety import normalizuj

        d = normalizuj(dotaz)
        if not d:
            return None
        for k in self.uzivatel(uzivatel_id)["kontakty"]:
            kandidati = [k["id"], normalizuj(k["nazev"]), *k.get("aliasy", [])]
            if any(d == c or c in d or (len(d) >= 3 and d in c) for c in kandidati):
                return k
        return None

    def pridej_pohyb(self, uzivatel_id: str, popis: str, castka: float, prijemce: str | None) -> None:
        u = self.uzivatel(uzivatel_id)
        u["zustatek"] = round(u["zustatek"] + castka, 2)
        ted = datetime.now()
        u["pohyby"].insert(0, {
            "datum": ted.date().isoformat(), "cas": ted.strftime("%H:%M"),
            "popis": popis, "castka": castka, "prijemce": prijemce,
        })

    def uloz_cekajici(self, session_id: str, akce: dict[str, Any]) -> dict[str, Any]:
        akce = {**akce, "pending_id": uuid.uuid4().hex[:8], "vytvoreno": datetime.now().isoformat(timespec="seconds")}
        self.cekajici.setdefault(session_id, {})[akce["pending_id"]] = akce
        return akce

    def pridej_do_historie(self, session_id: str, kdo: str, text: str) -> None:
        self.historie.setdefault(session_id, []).append(
            {"kdo": kdo, "text": text, "cas": datetime.now().isoformat(timespec="seconds")}
        )


class Rozesilac:
    """Drží WebSocket spojení zařízení a posílá jim události."""

    def __init__(self) -> None:
        self.spojeni: dict[str, set[WebSocket]] = {}

    def pripoj(self, uzivatel_id: str, ws: WebSocket) -> None:
        self.spojeni.setdefault(uzivatel_id, set()).add(ws)

    def odpoj(self, uzivatel_id: str, ws: WebSocket) -> None:
        self.spojeni.get(uzivatel_id, set()).discard(ws)

    async def posli(self, uzivatel_id: str, zprava: dict[str, Any]) -> None:
        for ws in list(self.spojeni.get(uzivatel_id, set())):
            try:
                await ws.send_json(zprava)
            except Exception:  # spojení už neexistuje
                self.odpoj(uzivatel_id, ws)

    def posli_pozdeji(self, uzivatel_id: str, zprava: dict[str, Any]) -> None:
        """Naplánuje odeslání z synchronního kódu (nástroje agenta)."""
        banka.upozorneni.setdefault(uzivatel_id, []).append(zprava)
        try:
            asyncio.get_running_loop().create_task(self.posli(uzivatel_id, zprava))
        except RuntimeError:
            log.warning("Událost pro %s se neodeslala, neběží smyčka událostí.", uzivatel_id)


banka = Banka()
rozesilac = Rozesilac()
