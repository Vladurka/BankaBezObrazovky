"""Pevná bezpečnostní pravidla banky.

Tento modul je čistě deterministický kód, NEPOUŽÍVÁ LLM. Agent ho volá
před každou platbou a přesunem a jeho rozhodnutí nemůže přebít.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

# ---- Limity ---------------------------------------------------------------

LIMIT_HLAS_DENNE = 5_000          # hlasová platba: max. Kč za den
LIMIT_ZATRESENI = 1_000           # zatřesení: max. Kč za jeden převod
LIMIT_VELKY_PREVOD = 20_000       # od této částky platí 24h lhůta
PULSE_AUTO_MAX_PROCENT = 5        # Pulse smí sám přesunout max. 5 % portfolia

# ---- Vzorce vishingu ------------------------------------------------------

# Fráze se porovnávají bez diakritiky a malými písmeny.
FRAZE_VISHING = [
    "bezpecny ucet", "bezpecneho uctu", "bezpecnej ucet", "ochranny ucet",
    "volali mi z banky", "volal mi z banky", "volala mi z banky", "z banky mi volali",
    "pracovnik banky", "bankovni technik", "policie mi rekla", "volali z policie",
    "ochranit penize", "zachranit penize", "nekdo mi chce vykrast", "napadeny ucet",
    "prevest vsechno", "poslat vsechno", "vsechny penize", "vybrat vsechno",
]
FRAZE_SPECH = ["rychle", "hned", "okamzite", "spech", "nalehave", "do hodiny", "ted hned"]

# Obecnější vzorce (regulární výrazy nad normalizovaným textem), aby prošly i jiné formulace.
VZORCE_VISHING = [
    r"volal\w*\b.{0,30}\bz banky",          # "volala mi paní z banky"
    r"z banky\b.{0,30}\bvolal",              # "z banky mi někdo volal"
    r"(volal|rekl|chce)\w*\b.{0,30}\bpolici",
    r"napad\w*\b.{0,15}\bucet",              # "napadl účet", "napadený účet"
    r"ucet\b.{0,15}\bnapad",
    r"bezpecn\w*\s+ucet", r"bezpecn\w*\s+uctu",
    r"prevest\b.{0,20}\b(vsechn|uspor)",
]

# Slabé signály: samy o sobě nestačí ("nový účet za plyn" je běžná věta),
# podezřelé jsou až ve spojení se spěchem, telefonátem, vysokou částkou nebo novým příjemcem.
VZORCE_SLABE = [
    r"(novy|jiny|novej)\w*\s+ucet", r"(nov|jin)\w*\s+uctu",
    r"(volal|telefon)",
]


def normalizuj(text: str) -> str:
    """Odstraní diakritiku a převede text na malá písmena."""
    bez = unicodedata.normalize("NFKD", text)
    bez = "".join(z for z in bez if not unicodedata.combining(z))
    return " ".join(bez.lower().split())


@dataclass
class Rozhodnuti:
    """Výsledek bezpečnostní kontroly."""

    povoleno: bool
    duvod: str = ""
    lhuta_24h: bool = False
    vishing: bool = False
    signaly: list[str] = field(default_factory=list)


def vyhodnot_vishing(text: str, novy_prijemce: bool = False, castka: float = 0) -> Rozhodnuti:
    """Hledá typický vzorec telefonního podvodu (vishingu).

    Pozastaví se, pokud se objeví podezřelá fráze, nebo spěch spolu
    s novým příjemcem či vysokou částkou.
    """
    t = normalizuj(text)
    signaly: list[str] = []
    for fraze in FRAZE_VISHING:
        if fraze in t:
            signaly.append(fraze)
    for vzorec in VZORCE_VISHING:
        if re.search(vzorec, t) and vzorec not in signaly:
            signaly.append(vzorec)
    silne = len(signaly)
    slabe = [v for v in VZORCE_SLABE if re.search(v, t)]
    spech = any(f in t for f in FRAZE_SPECH)
    vysoka = castka >= LIMIT_HLAS_DENNE
    signaly += slabe
    if spech:
        signaly.append("spech")
    if novy_prijemce:
        signaly.append("novy prijemce")
    if vysoka:
        signaly.append("vysoka castka")

    # pozastavit: silná fráze, nebo aspoň dva různé slabé signály (např. "volal" + "jiný účet",
    # "spěch" + nový příjemce)
    pocet_slabych = len(slabe) + spech + novy_prijemce + vysoka
    vishing = silne >= 1 or pocet_slabych >= 2 and (spech or bool(slabe))
    if vishing:
        return Rozhodnuti(False, "Možný telefonní podvod", vishing=True, signaly=signaly)
    return Rozhodnuti(True, signaly=signaly)


def kontrola_hlasove_platby(znamy_prijemce: bool, castka: float, dnes_odeslano: float, zustatek: float) -> Rozhodnuti:
    """Pravidla pro platbu zadanou hlasem."""
    if castka <= 0:
        return Rozhodnuti(False, "Částka musí být kladná.")
    if not znamy_prijemce:
        return Rozhodnuti(False, "Hlasem posílám peníze jen známým příjemcům. Nového příjemce přidejte v aplikaci nebo se Strážcem.")
    if castka > zustatek:
        return Rozhodnuti(False, "Na účtu není dost peněz.")
    if dnes_odeslano + castka > LIMIT_HLAS_DENNE:
        return Rozhodnuti(False, f"Hlasem lze poslat max. {LIMIT_HLAS_DENNE:,} Kč denně. Vyšší částku zadejte v aplikaci.".replace(",", " "))
    return Rozhodnuti(True, lhuta_24h=castka >= LIMIT_VELKY_PREVOD)


def kontrola_zatreseni(castka: float, zustatek: float) -> Rozhodnuti:
    """Pravidla pro převod zatřesením telefonu."""
    if castka <= 0:
        return Rozhodnuti(False, "Částka musí být kladná.")
    if castka > LIMIT_ZATRESENI:
        return Rozhodnuti(False, f"Zatřesením lze poslat max. {LIMIT_ZATRESENI} Kč.")
    if castka > zustatek:
        return Rozhodnuti(False, "Na účtu není dost peněz.")
    return Rozhodnuti(True)


def kontrola_presunu_portfolia(procent: float, prodat_vse: bool = False) -> Rozhodnuti:
    """Pravidla pro přesuny v Pulse."""
    if prodat_vse:
        return Rozhodnuti(True, "Prodej všeho má 24h lhůtu na rozmyšlenou.", lhuta_24h=True)
    if procent <= PULSE_AUTO_MAX_PROCENT:
        return Rozhodnuti(True)
    return Rozhodnuti(False, f"Automaticky přesouvám max. {PULSE_AUTO_MAX_PROCENT} % portfolia. Víc jen s vaším souhlasem.")
