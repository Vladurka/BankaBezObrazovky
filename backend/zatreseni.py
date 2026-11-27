"""Zatřes telefonem: spárování dvou telefonů, které zatřásly současně, a převod mezi nimi.

Průběh (jako v reálné aplikaci):
1. Oba klienti zatřesou telefonem -> {"typ": "zatreseni"}. Role se předem nevolí.
2. Server spáruje dva různé uživatele, jejichž zatřesení dorazila do SOUCASNOST_S sekund
   od sebe. Když je v okně víc kandidátů, nepáruje nikoho (nejednoznačné).
   Oběma pošle "zatreseni_par" se jménem protějšku.
3. Kdokoli z dvojice zadá částku -> {"typ": "zatreseni_nabidka", "id", "castka"}.
   Tím se stává plátcem a zároveň potvrzuje svou stranu. Druhá nabídka už neprojde.
4. Příjemce potvrdí -> {"typ": "zatreseni_potvrzeni", "id", "odpoved": "ano"|"ne"}.
5. Teprve po potvrzení obou stran a kontrole safety.kontrola_zatreseni se převede.

Kdokoli může pár zrušit ({"typ": "zatreseni_zrusit_par", "id"}) a hledání lze zrušit
({"typ": "zatreseni_zrusit"}).
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any

import safety
from stav import banka, rozesilac

log = logging.getLogger("banka.zatreseni")

SOUCASNOST_S = 3.0           # max. rozdíl mezi zatřeseními dvou telefonů
PLATNOST_PARU_S = 90.0       # jak dlouho platí spárování bez dokončení

# poslední zatřesení, které ještě čeká na protějšek: uzivatel_id -> čas (monotonic)
_zatreseni: dict[str, float] = {}
# aktivní páry: id -> {a, b, cas, nabidka: {od, komu, castka} | None}
_pary: dict[str, dict[str, Any]] = {}


def _jmeno(uzivatel_id: str) -> str:
    return banka.uzivatel(uzivatel_id)["jmeno"]


def _par_uzivatele(uzivatel_id: str) -> dict[str, Any] | None:
    return next((p for p in _pary.values() if uzivatel_id in (p["a"], p["b"])), None)


def _uklid(ted: float) -> None:
    for uid in [u for u, t in _zatreseni.items() if ted - t > SOUCASNOST_S]:
        _zatreseni.pop(uid, None)
    for pid in [i for i, p in _pary.items() if ted - p["cas"] > PLATNOST_PARU_S]:
        _pary.pop(pid, None)


async def _obema(par: dict[str, Any], zprava: dict[str, Any]) -> None:
    await rozesilac.posli(par["a"], zprava)
    await rozesilac.posli(par["b"], zprava)


async def zatreseni(uzivatel_id: str) -> None:
    ted = time.monotonic()
    _uklid(ted)

    # kdo už je ve dvojici, nehledá znovu (nejdřív musí pár dokončit nebo zrušit)
    if _par_uzivatele(uzivatel_id):
        return

    kandidati = [u for u, t in _zatreseni.items() if u != uzivatel_id and not _par_uzivatele(u)]
    if len(kandidati) != 1:
        if len(kandidati) > 1:
            log.info("Zatřesení %s: víc kandidátů %s, nepárovat.", uzivatel_id, kandidati)
        # zapsat (nebo obnovit) vlastní zatřesení a čekat na protějšek
        _zatreseni[uzivatel_id] = ted
        await rozesilac.posli(uzivatel_id, {"typ": "zatreseni_hledam"})
        return

    protejsek = kandidati[0]
    _zatreseni.pop(protejsek, None)
    _zatreseni.pop(uzivatel_id, None)
    par = {"id": uuid.uuid4().hex[:8], "a": protejsek, "b": uzivatel_id, "cas": ted, "nabidka": None}
    _pary[par["id"]] = par
    log.info("Spárováno %s: %s + %s", par["id"], protejsek, uzivatel_id)
    for ja, ty in ((par["a"], par["b"]), (par["b"], par["a"])):
        await rozesilac.posli(ja, {"typ": "zatreseni_par", "id": par["id"], "protejsek": ty, "protejsek_jmeno": _jmeno(ty)})


def zrusit_hledani(uzivatel_id: str) -> None:
    """Telefon přestal hledat (vypršel čas, klient zrušil, odpojil se)."""
    if _zatreseni.pop(uzivatel_id, None) is not None:
        log.info("Hledání protějšku pro %s zrušeno.", uzivatel_id)


async def zrusit_par(uzivatel_id: str, par_id: str, duvod: str = "Převod byl zrušen.") -> None:
    par = _pary.get(par_id)
    if not par or uzivatel_id not in (par["a"], par["b"]):
        return
    _pary.pop(par_id, None)
    await _obema(par, {"typ": "zatreseni_zruseno", "id": par_id, "duvod": duvod})


async def odpojeno(uzivatel_id: str) -> None:
    zrusit_hledani(uzivatel_id)
    par = _par_uzivatele(uzivatel_id)
    if par:
        await zrusit_par(uzivatel_id, par["id"], "Druhý telefon se odpojil.")


async def nabidka(uzivatel_id: str, par_id: str, castka: Any) -> None:
    """Uživatel z dvojice chce poslat peníze protějšku."""
    par = _pary.get(par_id)
    if not par or uzivatel_id not in (par["a"], par["b"]):
        await rozesilac.posli(uzivatel_id, {"typ": "zatreseni_chyba", "duvod": "Spojení už neplatí. Zatřeste znovu."})
        return
    if par["nabidka"]:
        await rozesilac.posli(uzivatel_id, {"typ": "zatreseni_chyba", "duvod": "Druhá strana už vám posílá peníze."})
        return
    if not isinstance(castka, (int, float)) or isinstance(castka, bool):
        await rozesilac.posli(uzivatel_id, {"typ": "zatreseni_chyba", "duvod": "Neplatná částka."})
        return
    castka = float(castka)
    rozhodnuti = safety.kontrola_zatreseni(castka, banka.uzivatel(uzivatel_id)["zustatek"])
    if not rozhodnuti.povoleno:
        await rozesilac.posli(uzivatel_id, {"typ": "zatreseni_chyba", "duvod": rozhodnuti.duvod})
        return
    komu = par["b"] if uzivatel_id == par["a"] else par["a"]
    par["nabidka"] = {"od": uzivatel_id, "komu": komu, "castka": castka}
    await _obema(par, {
        "typ": "zatreseni_nabidka", "id": par_id, "od": uzivatel_id, "od_jmeno": _jmeno(uzivatel_id),
        "komu": komu, "komu_jmeno": _jmeno(komu), "castka": castka,
    })


async def potvrzeni(uzivatel_id: str, par_id: str, odpoved: str) -> None:
    """Příjemce přijme nebo odmítne nabídku (plátce potvrdil už odesláním nabídky)."""
    par = _pary.get(par_id)
    if not par or not par["nabidka"] or par["nabidka"]["komu"] != uzivatel_id:
        await rozesilac.posli(uzivatel_id, {"typ": "zatreseni_chyba", "duvod": "Tuhle platbu už nelze potvrdit."})
        return
    if odpoved != "ano":
        await zrusit_par(uzivatel_id, par_id, "Příjemce platbu odmítl.")
        return

    n = par["nabidka"]
    _pary.pop(par_id, None)
    # bezpečnost znovu těsně před převodem
    rozhodnuti = safety.kontrola_zatreseni(n["castka"], banka.uzivatel(n["od"])["zustatek"])
    if not rozhodnuti.povoleno:
        await _obema(par, {"typ": "zatreseni_zruseno", "id": par_id, "duvod": rozhodnuti.duvod})
        return
    banka.pridej_pohyb(n["od"], f"Zatřesení – {_jmeno(n['komu'])}", -n["castka"], n["komu"])
    banka.pridej_pohyb(n["komu"], f"Zatřesení – {_jmeno(n['od'])}", n["castka"], n["od"])
    log.info("Zatřesení %s: %s -> %s, %s Kč", par_id, n["od"], n["komu"], n["castka"])
    for u in (n["od"], n["komu"]):
        await rozesilac.posli(u, {
            "typ": "zatreseni_hotovo", "id": par_id, "od_jmeno": _jmeno(n["od"]), "komu_jmeno": _jmeno(n["komu"]),
            "castka": n["castka"], "prijato": u == n["komu"], "zustatek": banka.uzivatel(u)["zustatek"],
        })
