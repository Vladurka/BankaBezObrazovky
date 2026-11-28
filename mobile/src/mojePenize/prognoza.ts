// "Kolik si můžu dovolit?" – deterministická prognóza zůstatku na běžném účtu.
// Počítá den po dni z pravidelných příjmů, plateb a obvyklých výdajů. AI čísla nepočítá.
import type { Profil } from './data';

export type Bod = { d: Date; b: number };

export const MESICE_2P = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
export const MESICE_6P = ['lednu', 'únoru', 'březnu', 'dubnu', 'květnu', 'červnu', 'červenci', 'srpnu', 'září', 'říjnu', 'listopadu', 'prosinci'];
export const MESICE_ZKR = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];

// demo běží k pevnému datu, aby výsledky byly vždy stejné (data jsou ilustrační)
export const START = new Date(2026, 10, 28);
export const KONEC = new Date(2027, 6, 31);

const klic = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
export const datumCz = (d: Date) => `${d.getDate()}. ${MESICE_2P[d.getMonth()]}`;

type Volby = { odkladat?: number; odkladatOd?: Date; odkladatDo?: Date; nakup?: number; nakupDne?: Date };

export function prognoza(p: Profil, o: Volby = {}): Bod[] {
  const g = p.prognoza;
  const body: Bod[] = [];
  let b = g.zustatek;
  for (let d = new Date(START); d <= KONEC; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const den = d.getDate();
    if (den === g.denPrijmu) b += g.prijem;
    for (const pl of g.pravidelne) if (pl.den === den) b -= pl.castka;
    if (g.rocni && d.getMonth() === g.rocni.mesic && den === g.rocni.den) b -= g.rocni.castka;
    b -= g.bezneDenne;
    if (o.odkladat && den === 1 && o.odkladatOd && o.odkladatDo && klic(d) >= klic(o.odkladatOd) && klic(d) <= klic(o.odkladatDo)) b -= o.odkladat;
    if (o.nakup && o.nakupDne && klic(d) === klic(o.nakupDne)) b -= o.nakup;
    body.push({ d: new Date(d), b });
  }
  return body;
}

const prvniPodRezervou = (body: Bod[], rezerva: number) => body.find((x) => x.b < rezerva);

export type VysledekNakupu =
  | { ok: true; body: Bod[]; cena: number }
  | { ok: false; body: Bod[]; cena: number; problem: Bod; chybi: number; kdy: Date | null };

/** Dá se nákup zaplatit dnes, aniž by zůstatek v dalších měsících spadl pod rezervu? */
export function planNakup(p: Profil, cena: number): VysledekNakupu {
  const body = prognoza(p, { nakup: cena, nakupDne: START });
  const problem = prvniPodRezervou(body, p.prognoza.rezerva);
  if (!problem) return { ok: true, body, cena };
  const vMesici = body.filter((x) => x.d.getMonth() === problem.d.getMonth() && x.d.getFullYear() === problem.d.getFullYear());
  const minimum = Math.min(...vMesici.map((x) => x.b));
  const chybi = Math.ceil((p.prognoza.rezerva - minimum) / 500) * 500;
  // nejbližší výplata, ke které by nákup vyšel bez problému
  let kdy: Date | null = null;
  for (let d = new Date(2026, 11, p.prognoza.denPrijmu); d <= new Date(2027, 5, p.prognoza.denPrijmu); d = new Date(d.getFullYear(), d.getMonth() + 1, p.prognoza.denPrijmu)) {
    if (!prvniPodRezervou(prognoza(p, { nakup: cena, nakupDne: d }), p.prognoza.rezerva)) {
      kdy = d;
      break;
    }
  }
  return { ok: false, body, cena, problem, chybi, kdy };
}

/** Kolik si můžu měsíčně odkládat leden–červen na letní dovolenou, aby účet nikdy nespadl pod rezervu + polštář? */
export function planDovolena(p: Profil) {
  const od = new Date(2027, 0, 1);
  const do_ = new Date(2027, 5, 1);
  let nejvic = 0;
  for (let s = 500; s <= 6000; s += 500) {
    const body = prognoza(p, { odkladat: s, odkladatOd: od, odkladatDo: do_ });
    if (Math.min(...body.map((x) => x.b)) >= p.prognoza.rezerva + p.prognoza.buffer) nejvic = s;
    else break;
  }
  const body = prognoza(p, { odkladat: nejvic, odkladatOd: od, odkladatDo: do_ });
  return { mesicne: nejvic, celkem: nejvic * 6, body };
}

export const pravidelneCelkem = (p: Profil) => p.prognoza.pravidelne.reduce((s, x) => s + x.castka, 0);
