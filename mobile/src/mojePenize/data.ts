// "Moje peníze" (My Money Web): co z ekonomiky hýbe penězi klienta.
// Podle návrhu B "My Money Web for everyday clients". Všechna data jsou ilustrační.
// Síla vlivu se počítá deterministicky: intenzita faktoru × váha vazby.

export type FaktorId = 'inflation' | 'rates' | 'food' | 'energy';
export const FAKTORY: FaktorId[] = ['inflation', 'rates', 'food', 'energy'];

export const V0: Record<FaktorId, number> = { inflation: 2.9, rates: 3.5, food: 4.1, energy: 1.8 };
export const VMAX: Record<FaktorId, number> = { inflation: 8, rates: 5, food: 8, energy: 8 };

const n1 = (v: number) => v.toFixed(1).replace('.', ',');

export const FIN: Record<FaktorId, { e: string; l: string; sh: (v: number) => string }> = {
  inflation: { e: '📉', l: 'Inflace', sh: (v) => `${n1(v)} %` },
  rates: { e: '🏦', l: 'Úrokové sazby', sh: (v) => `ČNB ${n1(v)} %` },
  food: { e: '🍞', l: 'Ceny potravin', sh: (v) => `+${n1(v)} %` },
  energy: { e: '⚡', l: 'Energie', sh: (v) => `+${n1(v)} %` },
};

export const FD: Record<FaktorId, string> = {
  inflation: 'Ceny celkově rostou. Pomalu ubírají hodnotu peněz, které leží bez úroku, a zdražují každodenní nákupy.',
  rates: 'Vyšší sazby zdražují úvěry a hypotéky a zároveň zvyšují výnos spoření. Časem také tlumí inflaci.',
  food: 'Potraviny a stravování zdražují rychleji než průměr, takže ze stejného rozpočtu pokryjete méně.',
  energy: 'Ceny energií se mění pomalu, ale promítají se do účtů za bydlení i do cen dopravy.',
};

export const FSRC: Record<FaktorId, string> = { inflation: 'ČSÚ, ČNB', rates: 'ČNB', food: 'ČSÚ, Eurostat', energy: 'ČSÚ, ERÚ' };

/** Váhy: jak silně který faktor působí na kterou položku. */
export const W: Record<string, Partial<Record<FaktorId, number>>> = {
  savings: { inflation: 0.7, rates: 0.3 },
  mortgage: { rates: 0.85, inflation: 0.15 },
  loan: { rates: 0.7, inflation: 0.3 },
  spending: { inflation: 0.35, food: 0.35, energy: 0.3 },
  potraviny: { food: 0.7, inflation: 0.3 },
  restaurace: { food: 0.5, inflation: 0.3, energy: 0.2 },
  volny: { inflation: 0.7, energy: 0.3 },
  doprava: { energy: 0.7, inflation: 0.3 },
  zabava: { inflation: 0.7, energy: 0.3 },
  predplatne: { inflation: 1 },
  obleceni: { inflation: 1 },
  zdravi: { inflation: 0.8, energy: 0.2 },
};

export const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

/** Barva podle závažnosti 0–100 (zelená → žlutá → oranžová → červená). */
const STOPS: [number, number[]][] = [[0, [20, 163, 111]], [35, [232, 176, 16]], [60, [238, 122, 60]], [85, [224, 52, 79]], [100, [190, 30, 70]]];
export function sev(v: number): string {
  v = clamp(v);
  for (let i = 1; i < STOPS.length; i++) {
    if (v <= STOPS[i][0]) {
      const [a, A] = STOPS[i - 1];
      const [b, B] = STOPS[i];
      const t = (v - a) / (b - a);
      return `rgb(${A.map((x, k) => Math.round(x + (B[k] - x) * t)).join(',')})`;
    }
  }
  return 'rgb(190,30,70)';
}

export type Hodnoty = Record<FaktorId, number>;
export const intenzita = (V: Hodnoty, f: FaktorId) => clamp((V[f] / VMAX[f]) * 100);
export const vliv = (V: Hodnoty, t: string, f: FaktorId) => (W[t]?.[f] ?? 0) * intenzita(V, f);
export const dopad = (V: Hodnoty, t: string) => (Object.keys(W[t] ?? {}) as FaktorId[]).reduce((s, f) => s + vliv(V, t, f), 0);
export const faktoryPolozky = (t: string) => (Object.keys(W[t] ?? {}) as FaktorId[]).filter((f) => (W[t][f] ?? 0) >= 0.2);
export const uroven = (v: number) => (v >= 35 ? 'silný' : v >= 18 ? 'střední' : 'slabý');

/** Anuitní splátka: jistina, roční sazba v %, roky. */
export const PMT = (P: number, r: number, y: number) => {
  const i = r / 100 / 12;
  const n = y * 12;
  return (P * i) / (1 - Math.pow(1 + i, -n));
};

// ---- profily klientů -------------------------------------------------------

export type Podkategorie = { id: string; e: string; l: string; full: string; podil: number; yoy: number; bezne: number; uhel: number; flag?: number };

export type Profil = {
  jmeno: string;
  kondice: { skore: number; popis: string; body: { text: string; uroven: 'Vysoké' | 'Střední' | 'Nízké' }[] };
  uspory: number;
  usporyFlag: number;
  usporyDuvod: string;
  hypoteka?: { zustatek: number; sazba: number; roky: number; fixaceDo: string };
  uver?: { zustatek: number; sazba: number; roky: number };
  vydaje: { celkem: number; yoy: number; kategorie: Podkategorie[] };
  prognoza: {
    zustatek: number;
    prijem: number;
    denPrijmu: number;
    pravidelne: { den: number; castka: number }[];
    rocni?: { mesic: number; den: number; castka: number; popis: string };
    /** běžné (nepravidelné) výdaje za den podle posledních měsíců */
    bezneDenne: number;
    rezerva: number;
    buffer: number;
  };
};

const KATEGORIE_JANA: Podkategorie[] = [
  { id: 'potraviny', e: '🛒', l: 'Potraviny', full: 'Potraviny', podil: 18, yoy: 4.0, bezne: 20, uhel: -67.5 },
  { id: 'restaurace', e: '🍽️', l: 'Restaurace', full: 'Restaurace', podil: 30, yoy: 5.2, bezne: 18, uhel: -22.5, flag: 68 },
  { id: 'volny', e: '🎨', l: 'Volný čas', full: 'Volný čas a koníčky', podil: 9, yoy: 3.1, bezne: 10, uhel: 22.5 },
  { id: 'doprava', e: '🚌', l: 'Doprava', full: 'Doprava', podil: 9, yoy: 2.4, bezne: 10, uhel: 67.5 },
  { id: 'zabava', e: '🎬', l: 'Zábava', full: 'Zábava', podil: 6, yoy: 6.0, bezne: 7, uhel: 112.5 },
  { id: 'predplatne', e: '📺', l: 'Předplatná', full: 'Předplatná', podil: 5, yoy: 8.5, bezne: 3, uhel: 157.5, flag: 52 },
  { id: 'obleceni', e: '👕', l: 'Oblečení', full: 'Oblečení', podil: 7, yoy: 3.8, bezne: 6, uhel: 202.5 },
  { id: 'zdravi', e: '💊', l: 'Zdraví', full: 'Zdraví', podil: 4, yoy: 4.9, bezne: 5, uhel: 247.5 },
];

export const PROFILY: Record<string, Profil> = {
  jana: {
    jmeno: 'Jana',
    kondice: {
      skore: 64,
      popis: 'Průměrná',
      body: [
        { text: '💰 Volné peníze ztrácejí hodnotu', uroven: 'Vysoké' },
        { text: '🏠 Fixace hypotéky končí 9/2027', uroven: 'Střední' },
        { text: '🍽️ Restaurace nad běžným podílem', uroven: 'Vysoké' },
      ],
    },
    uspory: 100_000,
    usporyFlag: 66,
    usporyDuvod: '100 000 Kč leží na účtu bez úroku už 6 měsíců',
    hypoteka: { zustatek: 3_600_000, sazba: 4.9, roky: 24, fixaceDo: 'září 2027' },
    uver: { zustatek: 180_000, sazba: 8.9, roky: 3 },
    vydaje: { celkem: 31_400, yoy: 6, kategorie: KATEGORIE_JANA },
    prognoza: {
      zustatek: 52_000,
      prijem: 64_500,
      denPrijmu: 15,
      pravidelne: [
        { den: 5, castka: 5716 },
        { den: 10, castka: 2900 },
        { den: 20, castka: 21281 },
        { den: 3, castka: 1570 },
      ],
      rocni: { mesic: 2, den: 8, castka: 15_500, popis: 'roční platba za pojištění a daň z nemovitosti' },
      bezneDenne: (31_400 - 1570) / 30,
      rezerva: 5000,
      buffer: 5000,
    },
  },
  tomas: {
    jmeno: 'Tomáš',
    kondice: {
      skore: 58,
      popis: 'Na hraně',
      body: [
        { text: '🍽️ Jídlo s sebou nad běžným podílem', uroven: 'Vysoké' },
        { text: '💰 Malá rezerva na nečekané výdaje', uroven: 'Střední' },
        { text: '📺 Předplatná rostou', uroven: 'Nízké' },
      ],
    },
    uspory: 25_000,
    usporyFlag: 40,
    usporyDuvod: '25 000 Kč leží na běžném účtu bez úroku',
    vydaje: {
      celkem: 12_400,
      yoy: 9,
      kategorie: [
        { id: 'potraviny', e: '🛒', l: 'Potraviny', full: 'Potraviny', podil: 16, yoy: 4.0, bezne: 20, uhel: -67.5 },
        { id: 'restaurace', e: '🍽️', l: 'Jídlo s sebou', full: 'Restaurace a jídlo s sebou', podil: 26, yoy: 7.1, bezne: 15, uhel: -22.5, flag: 70 },
        { id: 'volny', e: '🎮', l: 'Volný čas', full: 'Volný čas a hry', podil: 12, yoy: 3.1, bezne: 10, uhel: 22.5 },
        { id: 'doprava', e: '🛴', l: 'Doprava', full: 'Doprava', podil: 10, yoy: 2.4, bezne: 10, uhel: 67.5 },
        { id: 'zabava', e: '🎬', l: 'Zábava', full: 'Zábava', podil: 12, yoy: 6.0, bezne: 9, uhel: 112.5 },
        { id: 'predplatne', e: '📺', l: 'Předplatná', full: 'Předplatná', podil: 4, yoy: 8.5, bezne: 3, uhel: 157.5, flag: 45 },
        { id: 'obleceni', e: '👕', l: 'Oblečení', full: 'Oblečení', podil: 8, yoy: 3.8, bezne: 8, uhel: 202.5 },
        { id: 'zdravi', e: '💊', l: 'Zdraví', full: 'Zdraví', podil: 2, yoy: 4.9, bezne: 3, uhel: 247.5 },
      ],
    },
    prognoza: {
      zustatek: 12_450,
      prijem: 13_300,
      denPrijmu: 15,
      pravidelne: [
        { den: 26, castka: 4200 },
        { den: 2, castka: 275 },
        { den: 3, castka: 169 },
        { den: 7, castka: 349 },
      ],
      rocni: { mesic: 1, den: 10, castka: 2900, popis: 'roční poplatek za kolej a ISIC' },
      bezneDenne: (12_400 - 4993) / 30,
      rezerva: 2000,
      buffer: 1000,
    },
  },
};

export const profil = (uzivatel: string): Profil => PROFILY[uzivatel] ?? PROFILY.jana;
