# Banka bez obrazovky – George

Prototyp pro 4FIS Hackathon (výzva České spořitelny). Banka je hlas a pravidla, ne obrazovky a formuláře.

- **George** – hlasový a textový asistent, ochrana před vishingem, Strážce
- **Zatřes telefonem** – poslání peněz člověku vedle sebe bez IBANu (potvrzují obě strany)
- **Pulse** – portfolio podle pravidel klienta, konflikt, anti-panika

Všechna data jsou ilustrační, jména fiktivní.

## Spuštění

### Backend (počítač)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
copy ..\.env.example .env   # doplnit OPENAI_API_KEY
.venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Bez klíče OpenAI backend funguje dál, jen s jednoduchým rozpoznáváním záměrů a bez převodu řeči na text.
Windows Firewall musí povolit příchozí spojení na port 8000 v privátní síti.

### Backend na Renderu (nasazení)

1. Na render.com: **New → Blueprint** → vybrat tento GitHub repozitář. Render načte `render.yaml`.
2. Při vytváření doplnit `OPENAI_API_KEY` (v repozitáři není).
3. Po nasazení má služba adresu `https://<nazev>.onrender.com`. Tu zadat v aplikaci místo IP počítače.

Poznámky:
- Běží jen jedna instance – stav banky je v paměti, restart (nebo nové nasazení) vrátí demo do výchozího stavu.
- Bezplatná služba po ~15 min nečinnosti usne, první požadavek pak trvá desítky sekund. Před prezentací ji otevřít v prohlížeči.

### Mobil (dva telefony s Expo Go)

```powershell
cd mobile
npm install
npm run demo
```

`npm run demo` sám zjistí IP počítače a spustí Expo (bez nutnosti přihlášení do Expo Go).

1. Oba telefony a počítač ve stejné síti (Wi-Fi nebo hotspot telefonu).
2. Naskenovat QR kód v Expo Go.
3. Vybrat účet: telefon 1 = **Jana** (babička), telefon 2 = **Tomáš** (vnuk a zároveň Strážce babičky).

Adresu backendu aplikace odvodí sama (stejný počítač, port 8000). Pro backend na Renderu stačí
jednou vytvořit `mobile/.env` podle `mobile/.env.example`.

Když backend není dostupný, aplikace jede v režimu bez sítě (`src/fallback.ts`).

## Demo scénáře

1. **Vishing** – Jana: „Zaplať elektřinu jako minule" → potvrdí. Potom: „Volali mi z banky, mám rychle převést peníze na bezpečný účet" → George platbu pozastaví a Tomášovi přijde upozornění Strážce.
2. **Zatřesení** – oba zatřesou telefonem ve stejnou chvíli (do 3 s) → oba vidí „Spojeno" → kdokoli zadá částku a stiskne „Poslat" → druhý „Přijmout" → peníze odejdou.
3. **Pulse** – tlačítko „Konflikt" → region zčervená, přesun 5 % podle pravidla; „Propad trhů" → anti-panika.

## Bezpečnostní pravidla (backend/safety.py, bez LLM)

- hlasová platba jen známým příjemcům, max. 5 000 Kč denně
- vzorec vishingu → pozastavení, otázka „Volá vám teď někdo jiný?", upozornění Strážci
- velký převod a „prodat vše" → 24h lhůta
- zatřesení max. 1 000 Kč, potvrzení obou stran
- Pulse automaticky max. 5 % portfolia
- investice: George vysvětluje, neradí; na konkrétní radu nabídne poradce
