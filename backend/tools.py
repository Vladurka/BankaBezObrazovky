"""Nástroje agenta George nad ilustračními daty.

Každá platba a přesun jde jen přes čekající akci (pending), kterou musí
klient potvrdit přes /confirm. Bezpečnostní pravidla řeší safety.py.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import safety
from stav import banka, rozesilac

log = logging.getLogger("banka.nastroje")


def kc(castka: float) -> str:
    """Formát částky pro mluvenou i psanou češtinu."""
    return f"{abs(castka):,.0f} Kč".replace(",", " ")


@dataclass
class Kontext:
    """Kontext jednoho dotazu: kdo se ptá, v jaké session a co přesně řekl."""

    uzivatel_id: str
    session_id: str
    text: str = ""
    actions: list[dict[str, Any]] = field(default_factory=list)
    pending: dict[str, Any] | None = None
    pevna_odpoved: str | None = None  # bezpečnostní odpověď, kterou LLM nesmí změnit


# ---- upozornění Strážci ---------------------------------------------------

def upozornit_strazce(ctx: Kontext, duvod: str) -> dict[str, Any]:
    u = banka.uzivatel(ctx.uzivatel_id)
    strazce_id = u.get("strazce")
    if not strazce_id:
        return {"vysledek": "Uživatel nemá nastaveného Strážce."}
    zprava = {
        "typ": "strazce",
        "od": ctx.uzivatel_id,
        "jmeno": u["jmeno"],
        "duvod": duvod,
        "text": f"{u['jmeno']}: {duvod}. Platba je pozastavena. Zavolejte jí prosím.",
    }
    rozesilac.posli_pozdeji(strazce_id, zprava)
    strazce = banka.uzivatel(strazce_id)
    ctx.actions.append({"typ": "strazce_upozornen", "strazce": strazce["jmeno"], "duvod": duvod})
    log.info("Strážce %s upozorněn (%s).", strazce_id, duvod)
    return {"vysledek": f"Strážce {strazce['jmeno']} dostal upozornění."}


def _zastav_vishing(ctx: Kontext, signaly: list[str]) -> dict[str, Any]:
    """Společná reakce na podezření na telefonní podvod."""
    # Strážce dostane upozornění jen při prvním zachycení v dané session
    if ctx.session_id not in banka.podezreni:
        banka.podezreni.add(ctx.session_id)
        upozornit_strazce(ctx, "možný telefonní podvod (vishing)")
    ctx.actions.append({"typ": "vishing_pozastaveno", "signaly": signaly})
    osloveni = banka.uzivatel(ctx.uzivatel_id).get("osloveni", "")
    ctx.pevna_odpoved = (
        f"Tuhle platbu jsem pozastavil, {osloveni}. Volá vám teď někdo jiný? "
        "Banka nikdy nechce převod na bezpečný účet. Dal jsem vědět vašemu Strážci."
    ).replace(",  ", ", ")
    return {"vysledek": "POZASTAVENO – možný vishing. Platba se neprovede.", "signaly": signaly}


# ---- účet -----------------------------------------------------------------

def zustatek(ctx: Kontext) -> dict[str, Any]:
    u = banka.uzivatel(ctx.uzivatel_id)
    pohyby = u["pohyby"][:3]
    ctx.actions.append({"typ": "zustatek", "zustatek": u["zustatek"], "pohyby": pohyby})
    return {"zustatek_kc": u["zustatek"], "posledni_pohyby": pohyby}


def _priprav_platbu(ctx: Kontext, kontakt_dotaz: str, castka: float | None, jako_minule: bool) -> dict[str, Any]:
    if ctx.session_id in banka.podezreni:
        return _zastav_vishing(ctx, ["predchozi podezreni v teto session"])

    kontakt = banka.najdi_kontakt(ctx.uzivatel_id, kontakt_dotaz)
    castka = float(castka) if castka else 0.0

    if kontakt and jako_minule and not castka:
        minule = next((p for p in banka.uzivatel(ctx.uzivatel_id)["pohyby"] if p.get("prijemce") == kontakt["id"] and p["castka"] < 0), None)
        if not minule:
            return {"chyba": f"Platbu pro {kontakt['nazev']} jsem v historii nenašel."}
        castka = abs(minule["castka"])

    # vishing se kontroluje vždy jako první, i u neznámého příjemce
    vishing = safety.vyhodnot_vishing(ctx.text, novy_prijemce=kontakt is None, castka=castka)
    if vishing.vishing:
        return _zastav_vishing(ctx, vishing.signaly)

    u = banka.uzivatel(ctx.uzivatel_id)
    rozhodnuti = safety.kontrola_hlasove_platby(
        znamy_prijemce=kontakt is not None,
        castka=castka,
        dnes_odeslano=banka.hlasem_dnes.get(ctx.uzivatel_id, 0),
        zustatek=u["zustatek"],
    )
    if not rozhodnuti.povoleno:
        ctx.actions.append({"typ": "platba_zamitnuta", "duvod": rozhodnuti.duvod})
        return {"zamitnuto": rozhodnuti.duvod}

    akce = banka.uloz_cekajici(ctx.session_id, {
        "druh": "platba",
        "uzivatel": ctx.uzivatel_id,
        "kontakt_id": kontakt["id"],
        "prijemce": kontakt["nazev"],
        "ucet": kontakt["ucet"],
        "castka": castka,
        "lhuta_24h": rozhodnuti.lhuta_24h,
    })
    ctx.pending = akce
    ctx.actions.append({"typ": "platba_k_potvrzeni", **akce})
    return {
        "ceka_na_potvrzeni": True,
        "pending_id": akce["pending_id"],
        "prijemce": kontakt["nazev"],
        "castka_kc": castka,
        "pokyn": "Zopakuj klientovi příjemce a částku a zeptej se, jestli platbu potvrzuje.",
    }


def platba_jako_minule(ctx: Kontext, prijemce: str, castka: float | None = None) -> dict[str, Any]:
    return _priprav_platbu(ctx, prijemce, castka, jako_minule=True)


def poslat_znamemu(ctx: Kontext, kontakt: str, castka: float) -> dict[str, Any]:
    return _priprav_platbu(ctx, kontakt, castka, jako_minule=False)


def nahlasit_podezreni(ctx: Kontext, duvod: str = "") -> dict[str, Any]:
    """Druhá vrstva ochrany: LLM pozná podvod, který pevná pravidla minula. Umí jen zpřísnit, nikdy povolit."""
    log.info("LLM nahlásilo podezření na podvod: %s", duvod[:200])
    return _zastav_vishing(ctx, ["llm: " + (duvod[:100] or "podezreni")])


def zablokovat_kartu(ctx: Kontext) -> dict[str, Any]:
    # Blokace karty chrání klienta, proto se provádí hned a bez potvrzení.
    ctx.actions.append({"typ": "karta_zablokovana"})
    return {"vysledek": "Karta je zablokovaná. Novou lze objednat v aplikaci nebo na pobočce."}


# ---- Pulse / portfolio ------------------------------------------------------

def portfolio(ctx: Kontext) -> dict[str, Any]:
    p = banka.portfolia[ctx.uzivatel_id]
    ctx.actions.append({"typ": "portfolio", "zeme": p["zeme"], "odvetvi": p["odvetvi"], "celkem": p["celkem"]})
    return {"celkem_kc": p["celkem"], "zeme_procenta": p["zeme"], "odvetvi_procenta": p["odvetvi"]}


def pravidla_portfolia(ctx: Kontext) -> dict[str, Any]:
    pravidla = banka.portfolia[ctx.uzivatel_id]["pravidla"]
    ctx.actions.append({"typ": "pravidla", "pravidla": pravidla})
    return {"pravidla": pravidla}


def pridat_pravidlo(ctx: Kontext, text: str) -> dict[str, Any]:
    text = (text or "").strip()
    if not text or len(text) > 300:
        return {"chyba": "Pravidlo musí mít 1 až 300 znaků."}
    banka.portfolia[ctx.uzivatel_id]["pravidla"].append(text)
    ctx.actions.append({"typ": "pravidlo_pridano", "pravidlo": text})
    return {"vysledek": "Pravidlo uloženo.", "pravidla": banka.portfolia[ctx.uzivatel_id]["pravidla"]}


def prodat_vse(ctx: Kontext) -> dict[str, Any]:
    rozhodnuti = safety.kontrola_presunu_portfolia(100, prodat_vse=True)
    akce = banka.uloz_cekajici(ctx.session_id, {
        "druh": "prodat_vse",
        "uzivatel": ctx.uzivatel_id,
        "lhuta_24h": rozhodnuti.lhuta_24h,
    })
    ctx.pending = akce
    ctx.actions.append({"typ": "prodej_k_potvrzeni", **akce})
    return {
        "ceka_na_potvrzeni": True,
        "lhuta_24h": True,
        "pokyn": "Vysvětli, že prodej všeho má 24h lhůtu a lze ho kdykoli zrušit. Neraď, zda prodat.",
    }


def spojit_s_poradcem(ctx: Kontext, tema: str = "") -> dict[str, Any]:
    ctx.actions.append({"typ": "poradce", "tema": tema})
    return {"vysledek": "Poradce se ozve do 15 minut. Konkrétní investiční doporučení dává jen poradce."}


# ---- Pulse: simulované události ve světě -----------------------------------

def pulse_udalost(uzivatel_id: str, typ: str, region: str = "Tchaj-wan") -> dict[str, Any]:
    """Vyhodnotí událost ve světě podle pravidel klienta (deterministicky)."""
    p = banka.portfolia[uzivatel_id]
    actions: list[dict[str, Any]] = []
    if typ == "konflikt":
        podil = p["zeme"].get(region, 0)
        presun = min(podil, safety.PULSE_AUTO_MAX_PROCENT)
        rozhodnuti = safety.kontrola_presunu_portfolia(presun)
        actions.append({"typ": "pulse_mapa", "zeme": region, "stav": "konflikt"})
        if presun and rozhodnuti.povoleno and any("konflikt" in safety.normalizuj(r) for r in p["pravidla"]):
            cil = "Německo" if "Německo" in p["zeme"] else "Hotovost"
            p["zeme"][region] = podil - presun
            p["zeme"][cil] = p["zeme"].get(cil, 0) + presun
            actions.append({"typ": "pulse_presun", "z": region, "do": cil, "procent": presun})
            odpoved = (f"V regionu {region} vypukl konflikt. Podle vašeho pravidla jsem přesunul {presun} % "
                       f"portfolia do regionu {cil}. Přesun lze vrátit.")
        else:
            odpoved = f"V regionu {region} vypukl konflikt. Máte tam {podil} %. Žádné pravidlo nic nepřesouvá."
    elif typ == "propad":
        actions.append({"typ": "pulse_antipanika"})
        odpoved = ("Trhy dnes klesly o 6 %. Podle vašeho pravidla nic neprodávám. "
                   "Podobné propady se v minulosti většinou do dvou let vyrovnaly.")
    else:
        return {"reply": "Tuhle událost neznám.", "actions": []}
    actions.append({"typ": "portfolio", "zeme": p["zeme"], "odvetvi": p["odvetvi"], "celkem": p["celkem"]})
    return {"reply": odpoved, "speak": odpoved, "actions": actions}


# ---- provedení potvrzené akce ---------------------------------------------

def proved_cekajici(ctx: Kontext, akce: dict[str, Any]) -> str:
    """Provede akci po potvrzení klientem. Vrací odpověď pro klienta."""
    if akce["druh"] == "platba":
        # bezpečnost se ověřuje znovu i při potvrzení
        if ctx.session_id in banka.podezreni:
            return "Platbu kvůli podezření na podvod neprovedu. Ozvěte se prosím Strážci nebo bance."
        u = banka.uzivatel(akce["uzivatel"])
        rozhodnuti = safety.kontrola_hlasove_platby(True, akce["castka"], banka.hlasem_dnes.get(u["id"], 0), u["zustatek"])
        if not rozhodnuti.povoleno:
            return rozhodnuti.duvod
        if akce.get("lhuta_24h"):
            ctx.actions.append({"typ": "lhuta_24h", **akce})
            return f"Platba {kc(akce['castka'])} pro {akce['prijemce']} odejde za 24 hodin. Do té doby ji můžete zrušit."
        banka.hlasem_dnes[u["id"]] = banka.hlasem_dnes.get(u["id"], 0) + akce["castka"]
        banka.pridej_pohyb(u["id"], akce["prijemce"], -akce["castka"], akce["kontakt_id"])
        kontakt = next(k for k in u["kontakty"] if k["id"] == akce["kontakt_id"])
        if kontakt.get("uzivatel"):
            prijemce_id = kontakt["uzivatel"]
            banka.pridej_pohyb(prijemce_id, u["jmeno"], akce["castka"], u["id"])
            rozesilac.posli_pozdeji(prijemce_id, {
                "typ": "prichozi_platba", "od": u["jmeno"], "castka": akce["castka"],
                "zustatek": banka.uzivatel(prijemce_id)["zustatek"],
            })
        ctx.actions.append({"typ": "platba_provedena", **akce, "zustatek": u["zustatek"]})
        return f"Hotovo. Poslal jsem {kc(akce['castka'])} pro {akce['prijemce']}. Na účtu máte {kc(u['zustatek'])}."
    if akce["druh"] == "prodat_vse":
        ctx.actions.append({"typ": "lhuta_24h", **akce})
        return "Prodej celého portfolia jsem naplánoval za 24 hodin. Kdykoli předtím ho můžete zrušit."
    return "Tuhle akci neumím provést."


# ---- popis nástrojů pro LLM (OpenAI tool calling) ---------------------------

NASTROJE: dict[str, Any] = {
    "zustatek": zustatek,
    "platba_jako_minule": platba_jako_minule,
    "poslat_znamemu": poslat_znamemu,
    "zablokovat_kartu": zablokovat_kartu,
    "nahlasit_podezreni": nahlasit_podezreni,
    "portfolio": portfolio,
    "pravidla_portfolia": pravidla_portfolia,
    "pridat_pravidlo": pridat_pravidlo,
    "prodat_vse": prodat_vse,
    "spojit_s_poradcem": spojit_s_poradcem,
}


def _fn(nazev: str, popis: str, vlastnosti: dict[str, Any] | None = None, povinne: list[str] | None = None) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": nazev,
            "description": popis,
            "parameters": {"type": "object", "properties": vlastnosti or {}, "required": povinne or []},
        },
    }


SCHEMATA = [
    _fn("zustatek", "Zůstatek účtu a poslední 3 pohyby."),
    _fn("platba_jako_minule", "Připraví platbu stejnému příjemci jako minule (např. elektřina). Neprovede ji, čeká na potvrzení.",
        {"prijemce": {"type": "string", "description": "Název nebo přezdívka příjemce, např. 'elektřina'."},
         "castka": {"type": "number", "description": "Volitelná jiná částka v Kč."}}, ["prijemce"]),
    _fn("poslat_znamemu", "Připraví platbu známému kontaktu. Neprovede ji, čeká na potvrzení.",
        {"kontakt": {"type": "string"}, "castka": {"type": "number", "description": "Částka v Kč."}}, ["kontakt", "castka"]),
    _fn("zablokovat_kartu", "Okamžitě zablokuje platební kartu (ztráta, krádež)."),
    _fn("nahlasit_podezreni", "Pozastaví platby a upozorní Strážce, když to vypadá na telefonní podvod "
        "(někdo volá jménem banky/policie, nátlak, převod na bezpečný nebo nový účet).",
        {"duvod": {"type": "string", "description": "Krátce, proč to vypadá na podvod."}}),
    _fn("portfolio", "Rozložení investic podle zemí a odvětví."),
    _fn("pravidla_portfolia", "Pravidla, podle kterých Pulse hlídá portfolio."),
    _fn("pridat_pravidlo", "Uloží nové pravidlo pro portfolio vlastními slovy klienta.",
        {"text": {"type": "string"}}, ["text"]),
    _fn("prodat_vse", "Klient chce prodat celé portfolio. Vytvoří akci s 24h lhůtou."),
    _fn("spojit_s_poradcem", "Spojí klienta s poradcem, když chce konkrétní investiční radu.",
        {"tema": {"type": "string"}}),
]
