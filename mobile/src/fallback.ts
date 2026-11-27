// Pevné scénáře, když backend nebo LLM nefunguje. Demo musí projít i bez sítě.
// Bezpečnostní pravidla jsou stejná jako v backend/safety.py.
import type { Akce, OdpovedGeorge, Pending, Ucet } from './api';
import { kc } from './tema';

const LIMIT_HLAS_DENNE = 5000;

const normalizuj = (t: string) =>
  t.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const FRAZE_VISHING = ['bezpecny ucet', 'bezpecneho uctu', 'volali mi z banky', 'volal mi z banky',
  'pracovnik banky', 'ochranit penize', 'prevest vsechno', 'poslat vsechno', 'vsechny penize'];

// obecnější vzorce, stejné jako VZORCE_VISHING v backend/safety.py
const VZORCE_VISHING = [
  /volal\w*\b.{0,30}\bz banky/, /z banky\b.{0,30}\bvolal/, /(volal|rekl|chce)\w*\b.{0,30}\bpolici/,
  /napad\w*\b.{0,15}\bucet/, /ucet\b.{0,15}\bnapad/, /bezpecn\w*\s+uct?u?/,
  /prevest\b.{0,20}\b(vsechn|uspor)/,
  // "nový/jiný účet" je podezřelý jen spolu se spěchem nebo telefonátem
  /(novy|jiny|nov\w*|jin\w*)\s+uct\w*.*\b(rychle|hned|okamzite|volal|telefon)|(rychle|hned|okamzite|volal|telefon).*\b(novy|jiny|nov\w*|jin\w*)\s+uct/,
];

type Kontakt ={ id: string; nazev: string; aliasy: string[]; minule?: number };

const DATA: Record<string, Ucet & { kontaktyPlne: Kontakt[] }> = {
  jana: {
    id: 'jana', jmeno: 'Jana Dvořáková', ucet: '123456789/0800', zustatek: 48320, strazce: 'Tomáš Dvořák',
    pohyby: [
      { datum: '2026-11-25', popis: 'ČEZ Prodej – záloha elektřina', castka: -1850, prijemce: 'cez' },
      { datum: '2026-11-20', popis: 'Důchod', castka: 21400, prijemce: null },
      { datum: '2026-11-18', popis: 'Pražské vodovody', castka: -620, prijemce: 'voda' },
    ],
    kontakty: [{ id: 'cez', nazev: 'ČEZ Prodej' }, { id: 'voda', nazev: 'Pražské vodovody' }, { id: 'tomas', nazev: 'Tomáš (vnuk)' }],
    kontaktyPlne: [
      { id: 'cez', nazev: 'ČEZ Prodej', aliasy: ['elektrin', 'cez', 'proud'], minule: 1850 },
      { id: 'voda', nazev: 'Pražské vodovody', aliasy: ['vod'], minule: 620 },
      { id: 'tomas', nazev: 'Tomáš (vnuk)', aliasy: ['tomas', 'vnuk'] },
    ],
    portfolio: {
      celkem: 420000,
      zeme: { USA: 34, 'Německo': 18, 'Česko': 14, Japonsko: 10, 'Tchaj-wan': 8, Indie: 6, 'Brazílie': 5, Hotovost: 5 },
      odvetvi: { Technologie: 28, 'Zdravotnictví': 18, Energetika: 14, Finance: 16, 'Spotřební zboží': 12, 'Průmysl': 7, Hotovost: 5 },
      pravidla: [
        'Když vypukne ozbrojený konflikt v regionu, přesuň z něj investice do bezpečnějších regionů.',
        'Neinvestuj do zbraní a tabáku.',
        'Při propadu trhů nic neprodávej automaticky, jen mě uklidni a ukaž souvislosti.',
      ],
    },
    upozorneni: [],
  },
  tomas: {
    id: 'tomas', jmeno: 'Tomáš Dvořák', ucet: '987654321/0800', zustatek: 12450, strazce: null,
    pohyby: [
      { datum: '2026-11-26', popis: 'Kolej VŠE – nájem', castka: -4200, prijemce: 'kolej' },
      { datum: '2026-11-15', popis: 'Brigáda – výplata', castka: 9800, prijemce: null },
    ],
    kontakty: [{ id: 'jana', nazev: 'Babička Jana' }, { id: 'kolej', nazev: 'Kolej VŠE' }],
    kontaktyPlne: [
      { id: 'jana', nazev: 'Babička Jana', aliasy: ['babick', 'jan'] },
      { id: 'kolej', nazev: 'Kolej VŠE', aliasy: ['kolej', 'najem'], minule: 4200 },
    ],
    portfolio: {
      celkem: 38000,
      zeme: { USA: 55, Evropa: 25, 'Rozvíjející se trhy': 15, Hotovost: 5 },
      odvetvi: { Technologie: 40, 'Obnovitelná energie': 20, 'Zdravotnictví': 15, Finance: 20, Hotovost: 5 },
      pravidla: ['Minimálně 20 % v obnovitelné energii.'],
    },
    upozorneni: [],
  },
};

const cekajici: Record<string, Pending & { kontakt_id?: string }> = {};
const hlasemDnes: Record<string, number> = { jana: 0, tomas: 0 };
let podezreni = false;

const ted = () => {
  const d = new Date();
  const dv = (n: number) => String(n).padStart(2, '0');
  return { datum: `${d.getFullYear()}-${dv(d.getMonth() + 1)}-${dv(d.getDate())}`, cas: `${dv(d.getHours())}:${dv(d.getMinutes())}` };
};

/** Zapíše pohyb do lokální historie (režim bez sítě). */
export function fallbackPridejPohyb(uzivatel: string, popis: string, castka: number, prijemce: string | null = null) {
  const u = DATA[uzivatel] ?? DATA.jana;
  u.zustatek += castka;
  u.pohyby.unshift({ ...ted(), popis, castka, prijemce });
}

export function fallbackUcet(uzivatel: string): Ucet {
  const { kontaktyPlne, ...ucet } = DATA[uzivatel] ?? DATA.jana;
  return { ...ucet, pohyby: [...ucet.pohyby] };
}

const odpoved = (text: string, actions: Akce[] = [], pending: Pending | null = null): OdpovedGeorge =>
  ({ reply: text, speak: text, actions, pending });

export function fallbackAsk(uzivatel: string, text: string): OdpovedGeorge {
  const u = DATA[uzivatel] ?? DATA.jana;
  const t = normalizuj(text);
  const castkaMatch = t.match(/(\d[\d ]*)/);
  const castka = castkaMatch ? Number(castkaMatch[1].replace(/ /g, '')) : 0;

  // vishing má vždy přednost
  if (podezreni || FRAZE_VISHING.some((f) => t.includes(f)) || VZORCE_VISHING.some((v) => v.test(t))) {
    podezreni = true;
    return odpoved(
      'Tuhle platbu jsem pozastavil. Volá vám teď někdo jiný? Banka nikdy nechce převod na bezpečný účet. Dal jsem vědět vašemu Strážci.',
      [{ typ: 'vishing_pozastaveno' }, { typ: 'strazce_upozornen', strazce: u.strazce ?? 'Strážce' }],
    );
  }

  const posledni = Object.values(cekajici).pop();
  if (posledni && /^(ano|jo|potvrzuj)/.test(t)) return fallbackConfirm(uzivatel, posledni.pending_id, 'ano');
  if (posledni && /^(ne|nechci|zrus)/.test(t)) return fallbackConfirm(uzivatel, posledni.pending_id, 'ne');

  if (/zustatek|kolik mam/.test(t)) return odpoved(`Na účtu máte ${kc(u.zustatek)}.`, [{ typ: 'zustatek', zustatek: u.zustatek }]);
  if (/zablokuj|ztratil|ukradl|karta/.test(t)) return odpoved('Kartu jsem zablokoval. Novou si objednáte v aplikaci.', [{ typ: 'karta_zablokovana' }]);
  if (/zaplat|posli|poslat|plat/.test(t)) {
    const k = u.kontaktyPlne.find((k) => k.aliasy.some((a) => t.includes(a)));
    if (!k) return odpoved('Hlasem posílám peníze jen známým příjemcům. Nového příjemce přidejte v aplikaci.', [{ typ: 'platba_zamitnuta' }]);
    const suma = castka || k.minule || 0;
    if (!suma) return odpoved(`Kolik mám poslat pro ${k.nazev}?`);
    if (hlasemDnes[u.id] + suma > LIMIT_HLAS_DENNE)
      return odpoved('Hlasem lze poslat max. 5 000 Kč denně. Vyšší částku zadejte v aplikaci.', [{ typ: 'platba_zamitnuta' }]);
    const p = { pending_id: Math.random().toString(36).slice(2, 10), druh: 'platba', prijemce: k.nazev, castka: suma, kontakt_id: k.id };
    cekajici[p.pending_id] = p;
    return odpoved(`Pošlu ${kc(suma)} pro ${k.nazev}. Mám to poslat?`, [{ typ: 'platba_k_potvrzeni', ...p }], p);
  }
  if (/mam koupit|mam prodat|co koupit|poradit/.test(t))
    return odpoved('Konkrétní investiční radu vám dá poradce. Spojím vás, ozve se do 15 minut.', [{ typ: 'poradce' }]);
  if (/portfolio|investic|pulse/.test(t))
    return odpoved(`Portfolio má hodnotu ${kc(u.portfolio.celkem)}.`, [{ typ: 'portfolio', ...u.portfolio }]);
  return odpoved('Rozumím. Umím zjistit zůstatek, zaplatit jako minule, zablokovat kartu nebo ukázat portfolio.');
}

export function fallbackConfirm(uzivatel: string, pendingId: string, odpovedKlienta: 'ano' | 'ne'): OdpovedGeorge {
  const u = DATA[uzivatel] ?? DATA.jana;
  const p = cekajici[pendingId];
  delete cekajici[pendingId];
  if (!p) return odpoved('Tuhle akci už nemám, nic jsem neprovedl.');
  if (odpovedKlienta === 'ne' || podezreni) return odpoved('Dobře, nic jsem neposlal.', [{ typ: 'akce_zrusena' }]);
  hlasemDnes[u.id] += p.castka ?? 0;
  fallbackPridejPohyb(uzivatel, p.prijemce ?? '', -(p.castka ?? 0), p.kontakt_id ?? null);
  return odpoved(`Hotovo. Poslal jsem ${kc(p.castka ?? 0)} pro ${p.prijemce}. Na účtu máte ${kc(u.zustatek)}.`,
    [{ typ: 'platba_provedena', ...p, zustatek: u.zustatek }]);
}

export function fallbackPulse(uzivatel: string, typ: 'konflikt' | 'propad'): { reply: string; speak: string; actions: Akce[] } {
  const p = (DATA[uzivatel] ?? DATA.jana).portfolio;
  if (typ === 'propad') {
    const t = 'Trhy dnes klesly o 6 %. Podle vašeho pravidla nic neprodávám. Podobné propady se v minulosti většinou do dvou let vyrovnaly.';
    return { reply: t, speak: t, actions: [{ typ: 'pulse_antipanika' }, { typ: 'portfolio', ...p }] };
  }
  const region = 'Tchaj-wan';
  const podil = p.zeme[region] ?? 0;
  const presun = Math.min(podil, 5);
  const cil = p.zeme['Německo'] !== undefined ? 'Německo' : 'Hotovost';
  if (presun) {
    p.zeme[region] = podil - presun;
    p.zeme[cil] = (p.zeme[cil] ?? 0) + presun;
  }
  const t = presun
    ? `V regionu ${region} vypukl konflikt. Podle vašeho pravidla jsem přesunul ${presun} % portfolia do regionu ${cil}. Přesun lze vrátit.`
    : `V regionu ${region} vypukl konflikt. Nemáte tam žádné investice.`;
  return {
    reply: t, speak: t,
    actions: [{ typ: 'pulse_mapa', zeme: region, stav: 'konflikt' }, { typ: 'pulse_presun', z: region, do: cil, procent: presun }, { typ: 'portfolio', ...p }],
  };
}
