// "Moje peníze" (My Money Web): síť toho, co z ekonomiky hýbe penězi klienta,
// detail každé položky, scénář "Co kdyby…" a asistent "Kolik si můžu dovolit?".
import React, { useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { Stitek, Tlacitko } from '../komponenty';
import { useApp } from '../kontext';
import {
  clamp, dopad, FAKTORY, FaktorId, faktoryPolozky, FD, FIN, FSRC, Hodnoty, intenzita, PMT, profil, sev, uroven, V0, vliv, VMAX, W,
} from '../mojePenize/data';
import { barvy, kc, pismo } from '../tema';
import KolikSiMuzuDovolit from './KolikSiMuzuDovolit';

// plátno sítě v souřadnicích návrhu (342 × 420), na telefonu se škáluje na šířku
const SW = 342;
const SH = 420;

type Druh = 'ty' | 'moje' | 'faktor' | 'pod';
type Uzel = { id: string; e: string; l: string; full?: string; druh: Druh; s: number; p0: [number, number]; p1?: [number, number]; v: string; flag?: number; pomoc?: boolean };

const n1 = (v: number) => v.toFixed(1).replace('.', ',');

export default function MojePenize() {
  const { uzivatel, prejdiNa } = useApp();
  const P = profil(uzivatel);
  const { width } = useWindowDimensions();
  const sirka = Math.min(width - 32, 420);
  const vyska = (sirka * SH) / SW;
  const sx = sirka / SW;
  const sy = vyska / SH;

  const [V, setV] = useState<Hodnoty>({ ...V0 });
  const [vybrano, setVybrano] = useState<string | null>(null);
  const [rozbaleno, setRozbaleno] = useState(false);
  const [scenar, setScenar] = useState(false);
  const [asistent, setAsistent] = useState(false);
  const [sporici, setSporici] = useState(false);
  const [novaSazba, setNovaSazba] = useState(5.6);
  const [skryte, setSkryte] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  const ukazToast = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2600);
  };

  // ---- uzly a hrany podle profilu --------------------------------------------
  const UZLY = useMemo(() => {
    const u: Record<string, Uzel> = {
      you: { id: 'you', e: '🙂', l: 'Já', druh: 'ty', s: 66, p0: [171, 205], p1: [171, 50], v: '' },
      savings: { id: 'savings', e: '💰', l: 'Úspory', druh: 'moje', s: 56, p0: [171, 108], flag: P.usporyFlag, pomoc: true, v: kc(P.uspory) },
      spending: { id: 'spending', e: '🛒', l: 'Výdaje', druh: 'moje', s: 58, p0: [171, 322], p1: [171, 214], pomoc: true, v: `${kc(P.vydaje.celkem)} / měs.` },
    };
    if (P.hypoteka) u.mortgage = { id: 'mortgage', e: '🏠', l: 'Hypotéka', druh: 'moje', s: 56, p0: [248, 152], pomoc: true, v: `${n1(P.hypoteka.sazba)} % do ${P.hypoteka.fixaceDo.replace('září ', '9/')}` };
    if (P.uver) u.loan = { id: 'loan', e: '💳', l: 'Úvěr', druh: 'moje', s: 54, p0: [284, 242], pomoc: true, v: `${kc(P.uver.zustatek)} · ${n1(P.uver.sazba)} %` };
    const poziceF: Record<FaktorId, [[number, number], [number, number] | undefined]> = {
      inflation: [[46, 58], [30, 66]], rates: [[284, 54], undefined], food: [[50, 330], [312, 66]], energy: [[292, 350], [312, 362]],
    };
    for (const f of FAKTORY) u[f] = { id: f, e: FIN[f].e, l: FIN[f].l, druh: 'faktor', s: 44, p0: poziceF[f][0], p1: poziceF[f][1], v: FIN[f].sh(V[f]) };
    for (const k of P.vydaje.kategorie) {
      const a = (k.uhel * Math.PI) / 180;
      u[k.id] = { id: k.id, e: k.e, l: k.l, full: k.full, druh: 'pod', s: 42, p0: u.spending.p0, p1: [171 + 108 * Math.cos(a), 214 + 108 * Math.sin(a)], flag: k.flag, v: kc((P.vydaje.celkem * k.podil) / 100) };
    }
    return u;
  }, [P, V]);

  const moje = Object.values(UZLY).filter((x) => x.druh === 'moje').map((x) => x.id);
  const pod = P.vydaje.kategorie.map((k) => k.id);
  const jeFaktor = (id: string) => UZLY[id]?.druh === 'faktor';
  const jePod = (id: string) => UZLY[id]?.druh === 'pod';

  type Hrana = { a: string; b: string; k: 'own' | 'ff' | 'own1' | 'inf' };
  const HRANY: Hrana[] = useMemo(() => {
    const h: Hrana[] = moje.map((m) => ({ a: 'you', b: m, k: 'own' as const }));
    h.push({ a: 'rates', b: 'inflation', k: 'ff' }, { a: 'inflation', b: 'food', k: 'ff' });
    pod.forEach((s) => h.push({ a: 'spending', b: s, k: 'own1' }));
    Object.keys(W).forEach((t) => {
      if (!UZLY[t]) return;
      (Object.keys(W[t]) as FaktorId[]).forEach((f) => {
        if ((W[t][f] ?? 0) >= 0.2) h.push({ a: f, b: t, k: 'inf' });
      });
    });
    return h;
  }, [UZLY]);

  // ---- co je vidět (podle výběru) -------------------------------------------
  const { viditelne, hranyVid } = useMemo(() => {
    const s = vybrano;
    const n: Record<string, number> = {};
    const e = new Set<string>();
    const E = (a: string, b: string) => e.add(`${a}>${b}`);
    if (!s) {
      Object.keys(UZLY).filter((id) => !jePod(id)).forEach((id) => (n[id] = 1));
      HRANY.forEach((h) => { if ((h.k === 'own' || h.k === 'ff' || h.k === 'inf') && !jePod(h.b)) E(h.a, h.b); });
    } else if (s === 'you') {
      n.you = 1;
      moje.forEach((m) => { n[m] = 1; E('you', m); });
    } else if (jeFaktor(s)) {
      n[s] = 1;
      Object.keys(W).forEach((t) => {
        if (!UZLY[t]) return;
        if ((W[t][s as FaktorId] ?? 0) >= 0.2 && (rozbaleno ? jePod(t) || t === 'spending' : !jePod(t))) { n[t] = 1; E(s, t); }
      });
    } else if (s === 'spending') {
      n.you = 1; n.spending = 1; E('you', 'spending');
      pod.forEach((x) => { n[x] = 1; E('spending', x); });
      faktoryPolozky('spending').forEach((f) => { n[f] = 1; E(f, 'spending'); });
    } else if (jePod(s)) {
      n.you = 1; n.spending = 1; n[s] = 1; E('you', 'spending'); E('spending', s);
      faktoryPolozky(s).forEach((f) => { n[f] = 1; E(f, s); });
      pod.forEach((x) => { if (!n[x]) n[x] = 0.28; });
    } else {
      n.you = 1; n[s] = 1; E('you', s);
      faktoryPolozky(s).forEach((f) => { n[f] = 1; E(f, s); });
    }
    return { viditelne: n, hranyVid: e };
  }, [vybrano, rozbaleno, UZLY, HRANY]);

  // rozložení: vybraná položka doprostřed, její vlivy nahoru
  const pozice = (id: string): [number, number] => {
    const u = UZLY[id];
    const s = vybrano;
    if (s && !jeFaktor(s) && !jePod(s) && s !== 'you' && s !== 'spending') {
      const fs = faktoryPolozky(s);
      if (id === 'you') return [171, 322];
      if (id === s) return [171, 206];
      const i = fs.indexOf(id as FaktorId);
      if (i >= 0) return [fs.length === 1 ? 171 : 70 + i * (202 / (fs.length - 1)), 66];
    }
    return rozbaleno && u.p1 ? u.p1 : u.p0;
  };

  const zavaznostKruhu = (id: string) => {
    const u = UZLY[id];
    if (u.druh === 'faktor') return intenzita(V, id as FaktorId);
    if (u.druh === 'ty') return 0;
    return Math.max(clamp(dopad(V, id) * 1.25), u.flag ?? 0);
  };

  const vyber = (id: string | null) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setScenar(false);
    if (id === null) { setVybrano(null); setRozbaleno(false); return; }
    if (id === 'spending') {
      if (rozbaleno && vybrano === 'spending') { setRozbaleno(false); setVybrano(null); } else { setRozbaleno(true); setVybrano('spending'); }
      return;
    }
    const novy = vybrano === id ? (rozbaleno ? 'spending' : null) : id;
    setVybrano(novy);
    if (!novy) setRozbaleno(false);
    else if (jePod(novy)) setRozbaleno(true);
    else if (!(jeFaktor(novy) && UZLY[novy].p1 && rozbaleno)) setRozbaleno(false);
  };

  // ---- vykreslení sítě --------------------------------------------------------
  const sit = (
    <Pressable onPress={() => vyber(null)} style={{ width: sirka, height: vyska, alignSelf: 'center' }}>
      <Svg width={sirka} height={vyska} style={StyleSheet.absoluteFill}>
        {HRANY.map((h, i) => {
          if (!hranyVid.has(`${h.a}>${h.b}`) || !UZLY[h.a] || !UZLY[h.b]) return null;
          const [x1, y1] = pozice(h.a).map((v, k) => v * (k ? sy : sx));
          const [x2, y2] = pozice(h.b).map((v, k) => v * (k ? sy : sx));
          const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
          const off = h.k === 'inf' ? (i % 2 ? 1 : -1) * 10 : 0;
          const cx = (x1 + x2) / 2 - (dy / L) * off, cy = (y1 + y2) / 2 + (dx / L) * off;
          let w = 1.8, col = 'rgba(157,182,228,0.6)', dash: string | undefined, label: string | null = null;
          if (h.k === 'inf') {
            const v = vliv(V, h.b, h.a as FaktorId);
            const r = clamp(v / 60, 0, 1);
            w = 1.2 + r * 6;
            col = sev(clamp(v * 1.7));
            dash = `${(w * 0.9 + 3).toFixed(1)} ${(w * 0.8 + 5).toFixed(1)}`;
            if (vybrano && !(rozbaleno && vybrano === 'spending')) label = `${Math.round((v / (dopad(V, h.b) || 1)) * 100)} %`;
          } else if (h.k === 'ff') { w = 1.2; dash = '2 5'; col = 'rgba(157,182,228,0.4)'; }
          return (
            <React.Fragment key={`${h.a}-${h.b}`}>
              <Path d={`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`} stroke={col} strokeWidth={w} strokeDasharray={dash} strokeLinecap="round" fill="none" opacity={!vybrano && h.k === 'inf' ? 0.7 : 1} />
              {label && (
                <SvgText x={0.25 * x1 + 0.5 * cx + 0.25 * x2} y={0.25 * y1 + 0.5 * cy + 0.25 * y2} fill="#fff" fontSize={10} fontWeight="bold" textAnchor="middle">{label}</SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
      {Object.values(UZLY).map((u) => {
        const op = viditelne[u.id] ?? 0;
        if (op === 0) return null;
        const [x, y] = pozice(u.id);
        let k = 1;
        if (u.druh === 'faktor' && vybrano && !jeFaktor(vybrano) && W[vybrano]?.[u.id as FaktorId]) k = 0.9 + clamp(vliv(V, vybrano, u.id as FaktorId) / 60, 0, 1) * 0.55;
        else if (u.id === vybrano && u.druh === 'faktor') k = 1.3;
        const s = u.s * k * Math.min(sx, 1.15);
        const kruh = u.druh === 'faktor' ? '#6F9BEA' : u.druh === 'ty' ? '#fff' : sev(zavaznostKruhu(u.id));
        return (
          <Pressable
            key={u.id}
            onPress={() => vyber(u.id)}
            style={[st.uzel, { left: x * sx - 50, top: y * sy - s / 2, opacity: op }]}
            accessibilityLabel={`${u.full ?? u.l} ${u.v}`}
          >
            <View
              style={[
                u.druh === 'faktor' ? st.faktor : st.kruh,
                { width: s, height: s, borderRadius: u.druh === 'faktor' ? 12 : s / 2, borderColor: kruh },
                u.id === vybrano && st.vybrany,
              ]}
            >
              <Text style={{ fontSize: s * 0.42 }}>{u.e}</Text>
              {u.pomoc && <View style={st.pomoc}><Text style={st.pomocText}>✦</Text></View>}
            </View>
            <Text style={st.uzelNazev} numberOfLines={1}>{u.l}</Text>
            {!!u.v && u.druh !== 'ty' && <Text style={st.uzelHodnota} numberOfLines={1}>{u.v}</Text>}
          </Pressable>
        );
      })}
    </Pressable>
  );

  // ---- spodní panel s detailem ---------------------------------------------------
  const stitekStavu = (v: number) =>
    v >= 60 ? <Stitek text="Vyžaduje pozornost" cervena /> : v >= 38 ? <View style={st.tagSledujte}><Text style={st.tagSledujteText}>Sledujte</Text></View> : <Stitek text="V pořádku" />;

  const Hlavicka = ({ id, nadpis }: { id: string; nadpis: string }) => (
    <View style={st.hlavicka}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        <Text style={{ fontSize: 26 }}>{UZLY[id].e}</Text>
        <View style={{ flex: 1 }}>
          <Text style={st.label}>{nadpis}</Text>
          <Text style={st.titulek}>{UZLY[id].full ?? UZLY[id].l}</Text>
        </View>
      </View>
      {UZLY[id].druh !== 'faktor' && stitekStavu(zavaznostKruhu(id))}
    </View>
  );

  const Radek = ({ l, h, barva }: { l: string; h: string; barva?: string }) => (
    <View style={st.kv}><Text style={st.kvL}>{l}</Text><Text style={[st.kvH, barva ? { color: barva } : null]}>{h}</Text></View>
  );

  const VlivyRadky = ({ t }: { t: string }) => {
    const r = (Object.keys(W[t]) as FaktorId[]).map((f) => ({ f, v: vliv(V, t, f) })).sort((a, b) => b.v - a.v);
    const cel = r.reduce((s, x) => s + x.v, 0) || 1;
    return (
      <View style={{ gap: 10 }}>
        <Text style={st.sekce}>Co to ovlivňuje</Text>
        {r.map(({ f, v }) => (
          <View key={f} style={{ gap: 4 }}>
            <View style={st.kv}><Text style={st.kvL}>{FIN[f].e} {FIN[f].l}</Text><Text style={st.kvH}>{Math.round((v / cel) * 100)} %</Text></View>
            <View style={st.pruhPozadi}><View style={[st.pruh, { width: `${(v / cel) * 100}%`, backgroundColor: sev(clamp(v * 1.7)) }]} /></View>
            <Text style={st.drobne}>{uroven(v)} vliv · nyní {FIN[f].sh(V[f])}</Text>
          </View>
        ))}
      </View>
    );
  };

  const Nabidka = ({ klic, proc, titul, text, tlacitko, zprava, druhe }: { klic: string; proc: string; titul: string; text: string; tlacitko: string; zprava: string; druhe?: [string, string] }) =>
    skryte[klic] ? (
      <Pressable onPress={() => setSkryte({ ...skryte, [klic]: false })}><Text style={st.drobne}>Nabídka skryta. <Text style={{ color: barvy.modraAkcent }}>Zobrazit znovu</Text></Text></Pressable>
    ) : (
      <View style={st.nabidka}>
        <Text style={st.proc}>✦ Proč to vidíte: {proc}</Text>
        <Text style={st.nabidkaTitul}>{titul}</Text>
        <Text style={st.text}>{text}</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Tlacitko text={tlacitko} varianta="bile" onPress={() => ukazToast(zprava)} />
          {druhe && <Tlacitko text={druhe[0]} varianta="tmave" style={st.male} onPress={() => ukazToast(druhe[1])} />}
          <Tlacitko text="Teď ne" varianta="tmave" style={st.male} onPress={() => setSkryte({ ...skryte, [klic]: true })} />
        </View>
      </View>
    );

  const Zpet = () =>
    rozbaleno && vybrano && jePod(vybrano) ? (
      <Pressable onPress={() => vyber('spending')}><Text style={st.zpet}>← Zpět na výdaje</Text></Pressable>
    ) : rozbaleno && vybrano === 'spending' ? (
      <Pressable onPress={() => vyber(null)}><Text style={st.zpet}>← Zpět na přehled</Text></Pressable>
    ) : null;

  const detail = (() => {
    if (scenar) {
      return (
        <View style={{ gap: 12 }}>
          <View style={st.hlavicka}>
            <View><Text style={st.label}>Scénář</Text><Text style={st.titulek}>Co kdyby…</Text></View>
            <Pressable onPress={() => setScenar(false)}><Text style={st.odkaz}>Hotovo</Text></Pressable>
          </View>
          <Text style={st.drobne}>Měňte hodnoty a sledujte, jak sílí vlivy. Stejná inflace nebo sazba působí na každou položku jinak.</Text>
          {FAKTORY.map((f) => (
            <Krokovac
              key={f}
              popis={`${FIN[f].e} ${FIN[f].l}`}
              hodnota={FIN[f].sh(V[f])}
              minus={() => setV({ ...V, [f]: Math.max(0, +(V[f] - 0.5).toFixed(1)) })}
              plus={() => setV({ ...V, [f]: Math.min(VMAX[f], +(V[f] + 0.5).toFixed(1)) })}
            />
          ))}
          <Tlacitko text="Vrátit aktuální hodnoty" varianta="tmave" onPress={() => setV({ ...V0 })} />
        </View>
      );
    }
    const id = vybrano;
    if (!id) {
      const pozornost = moje.filter((m) => zavaznostKruhu(m) >= 50);
      return (
        <View style={{ gap: 12 }}>
          <View><Text style={st.label}>Moje peníze</Text><Text style={st.titulek}>Co hýbe vašimi penězi</Text></View>
          <Text style={st.text}>
            Uprostřed jste vy a vaše finance. Čtverečky kolem jsou vlivy z ekonomiky. <Text style={{ fontFamily: pismo.tucne }}>Čím tlustší a červenější čára, tím silněji vliv působí.</Text> Klepněte na cokoli a uvidíte, co to znamená pro vás.
          </Text>
          {pozornost.length > 0 && (
            <>
              <Text style={st.label}>Vyžaduje pozornost</Text>
              <View style={st.skoky}>
                {pozornost.map((m) => (
                  <Pressable key={m} style={st.skok} onPress={() => vyber(m)}><Text style={st.skokText}>{UZLY[m].e} {UZLY[m].l}</Text></Pressable>
                ))}
              </View>
            </>
          )}
          <Text style={st.drobne}>Ukázková data. Mapa se skládá z vašich vlastních účtů a nic neopouští aplikaci.</Text>
        </View>
      );
    }
    if (id === 'you') {
      return (
        <View style={{ gap: 10 }}>
          <View style={st.hlavicka}>
            <View><Text style={st.label}>Moje finanční kondice</Text><Text style={st.titulek}>{P.kondice.skore} · {P.kondice.popis}</Text></View>
            <View style={st.tagSledujte}><Text style={st.tagSledujteText}>{P.kondice.body.length} věci ke sledování</Text></View>
          </View>
          {P.kondice.body.map((b) => (
            <Radek key={b.text} l={b.text} h={b.uroven} barva={b.uroven === 'Vysoké' ? barvy.cervena : b.uroven === 'Střední' ? barvy.oranzova : barvy.zelena} />
          ))}
        </View>
      );
    }
    if (id === 'savings') {
      const infl = V.inflation;
      const r = sporici ? 3 : 0;
      const realne = (P.uspory * (1 + r / 100)) / (1 + infl / 100);
      return (
        <View style={{ gap: 10 }}>
          <Hlavicka id={id} nadpis="Moje peníze" />
          <Radek l="Kde peníze leží" h={sporici ? 'Spořicí účet' : 'Běžný účet'} />
          <View style={st.cipy}>
            <Pressable style={[st.cip, !sporici && st.cipOn]} onPress={() => setSporici(false)}><Text style={st.cipText}>Běžný účet · 0 %</Text></Pressable>
            <Pressable style={[st.cip, sporici && st.cipOn]} onPress={() => setSporici(true)}><Text style={st.cipText}>Spořicí účet · 3,0 %</Text></Pressable>
          </View>
          <Radek l="Kupní síla za 12 měsíců" h={kc(realne)} barva={realne < P.uspory ? barvy.cervena : barvy.zelena} />
          <Text style={st.drobne}>
            {realne < P.uspory
              ? `${kc(P.uspory)} ponechaných beze změny koupí za rok totéž, co dnes ${kc(realne)}.`
              : `Úrok zhruba drží krok s inflací ${n1(infl)} %, vaše peníze si tedy udrží hodnotu.`}
          </Text>
          <VlivyRadky t={id} />
          <Nabidka
            klic="sav" proc={P.usporyDuvod} titul="Nechte peníze pracovat: spoření i investice"
            text="Obojí najdete přímo v George. Spořicí účet přináší úrok a peníze zůstávají dostupné. Investování se hodí na delší horizont: hodnota může klesat i růst, proto začnete krátkým průvodcem."
            tlacitko="Otevřít spořicí účet" zprava="Prototyp: otevře založení spořicího účtu" druhe={['Investovat v George', 'Prototyp: otevře investice v George']}
          />
          <Text style={st.drobne}>Ilustrativní sazby a inflace. Nejde o předpověď ani doporučení.</Text>
        </View>
      );
    }
    if (id === 'mortgage' && P.hypoteka) {
      const h = P.hypoteka;
      const ted = PMT(h.zustatek, h.sazba, h.roky);
      const nova = PMT(h.zustatek, novaSazba, h.roky);
      const rozdil = nova - ted;
      return (
        <View style={{ gap: 10 }}>
          <Hlavicka id={id} nadpis="Moje závazky" />
          <Radek l="Zůstatek · zbývající doba" h={`${n1(h.zustatek / 1e6)} mil. Kč · ${h.roky} let`} />
          <Radek l="Fixace do" h={h.fixaceDo} />
          <Radek l="Splátka dnes" h={kc(ted)} />
          <Krokovac
            popis="Pokud sazba po fixaci bude"
            hodnota={`${n1(novaSazba)} %`}
            minus={() => setNovaSazba(Math.max(3.5, +(novaSazba - 0.1).toFixed(1)))}
            plus={() => setNovaSazba(Math.min(7, +(novaSazba + 0.1).toFixed(1)))}
          />
          <Radek l="Nová splátka" h={kc(nova)} />
          <Radek l="Rozdíl za měsíc" h={`${rozdil >= 0 ? '+' : '−'}${kc(rozdil)}`} barva={rozdil >= 0 ? barvy.cervena : barvy.zelena} />
          <VlivyRadky t={id} />
          <Nabidka
            klic="mort" proc={`fixace vám končí za méně než 2 roky a sazby jsou nad vašimi ${n1(h.sazba)} %`} titul="Naplánujte refixaci včas"
            text="Hypoteční poradce porovná možnosti a vysvětlí, co se stane s vaší splátkou. Nezávazně."
            tlacitko="Objednat poradce" zprava="Prototyp: objedná hovor s hypotečním poradcem"
          />
          <Text style={st.drobne}>Ilustrativní údaje. Skutečná nabídka závisí na vašem úvěru a nabídce banky v daný okamžik.</Text>
        </View>
      );
    }
    if (id === 'loan' && P.uver) {
      const u = P.uver;
      return (
        <View style={{ gap: 10 }}>
          <Hlavicka id={id} nadpis="Moje závazky" />
          <Radek l="Zbývá splatit" h={kc(u.zustatek)} />
          <Radek l="Úroková sazba" h={`${n1(u.sazba)} % p. a.`} />
          <Radek l="Měsíční splátka · zbývá" h={`${kc(PMT(u.zustatek, u.sazba, u.roky))} · ${u.roky} roky`} />
          <Text style={st.text}>
            Vaše volné peníze nenesou žádný úrok, zatímco úvěr vás stojí {n1(u.sazba)} %. Kdybyste z úspor splatili 60 000 Kč, ušetřili byste zhruba{' '}
            <Text style={{ fontFamily: pismo.tucne }}>{kc(60_000 * (u.sazba / 100))}</Text> ročně na úrocích.
          </Text>
          <View style={st.skoky}><Pressable style={st.skok} onPress={() => vyber('savings')}><Text style={st.skokText}>💰 Úspory</Text></Pressable></View>
          <VlivyRadky t={id} />
          <Nabidka
            klic="loan" proc="úvěr je dražší než to, co vydělávají vaše úspory" titul="Zvažte mimořádnou splátku"
            text="Poradíme, zda se vyplatí část úvěru splatit z úspor, nebo ho refinancovat. Včetně případných poplatků."
            tlacitko="Spočítat možnosti" zprava="Prototyp: otevře kalkulačku mimořádné splátky a refinancování"
          />
          <Text style={st.drobne}>Ilustrativní výpočet. Skutečný dopad závisí na smlouvě a poplatcích.</Text>
        </View>
      );
    }
    if (id === 'spending') {
      const bary = [...P.vydaje.kategorie.map((k) => ({ id: k.id, n: k.l, p: k.podil })), { id: 'o', n: 'Ostatní', p: Math.max(0, 100 - P.vydaje.kategorie.reduce((s, k) => s + k.podil, 0)) }]
        .filter((x) => x.p > 0)
        .sort((a, b) => b.p - a.p);
      const BARVY = ['#2870ED', '#E0344F', '#7FB0F5', '#14A36F', '#E8B010', '#9A6BFF', '#EE7A3C', '#5E6E8C', '#C5CFE2'];
      return (
        <View style={{ gap: 10 }}>
          <Zpet />
          <Hlavicka id={id} nadpis="Moje výdaje" />
          <Radek l="Tento měsíc" h={kc(P.vydaje.celkem)} />
          <Radek l="Meziročně" h={`+${P.vydaje.yoy} %`} barva={barvy.cervena} />
          <View style={st.split}>{bary.map((x, i) => <View key={x.id} style={{ flex: x.p, backgroundColor: BARVY[i % BARVY.length] }} />)}</View>
          <View style={st.legenda}>
            {bary.map((x, i) => (
              <View key={x.id} style={st.legendaPolozka}><View style={[st.tecka, { backgroundColor: BARVY[i % BARVY.length] }]} /><Text style={st.drobne}>{x.n} {x.p} %</Text></View>
            ))}
          </View>
          <Text style={st.drobne}>Klepněte na kategorii v mapě pro detail.</Text>
          <VlivyRadky t={id} />
          <Tlacitko text="Zeptat se Georga na výdaje" onPress={() => prejdiNa('george')} />
          <Text style={st.drobne}>Kategorie se přebírají z automatického třídění plateb v George.</Text>
        </View>
      );
    }
    if (jePod(id)) {
      const k = P.vydaje.kategorie.find((x) => x.id === id)!;
      const castka = (P.vydaje.celkem * k.podil) / 100;
      const navic = castka - castka / (1 + k.yoy / 100);
      return (
        <View style={{ gap: 10 }}>
          <Zpet />
          <Hlavicka id={id} nadpis="Moje výdaje" />
          <Radek l="Tento měsíc" h={`${kc(castka)} (${k.podil} % výdajů)`} />
          <Radek l="Běžně ve vaší věkové skupině" h={`${k.bezne} %`} />
          <Radek l="Změna oproti loňsku" h={`+${n1(k.yoy)} %`} barva={k.yoy >= 4 ? barvy.cervena : barvy.oranzova} />
          <Text style={st.text}>Za stejné věci platíte zhruba o <Text style={{ fontFamily: pismo.tucne }}>{kc(navic)}</Text> měsíčně víc než loni.</Text>
          <VlivyRadky t={id} />
          {id === 'restaurace' && k.podil > k.bezne && (
            <Nabidka
              klic="course" proc={`${k.l.toLowerCase()} tvoří ${k.podil} % vašich výdajů, výrazně nad běžným podílem`} titul="Zdarma: kurz Rozpočet bez nudy"
              text="Dvacetiminutový kurz finančního vzdělávání České spořitelny. Žádné produkty, stačí přihlášení do George."
              tlacitko="Spustit kurz" zprava="Prototyp: otevře bezplatný kurz finančního vzdělávání"
            />
          )}
          {id === 'predplatne' && (
            <Nabidka
              klic="subs" proc={`předplatná tvoří ${k.podil} % vašich výdajů, běžně kolem ${k.bezne} %`} titul="Přehled opakovaných plateb"
              text="George ukáže všechna předplatná na jednom místě, abyste věděli, co můžete zrušit."
              tlacitko="Zobrazit v George" zprava="Prototyp: otevře přehled opakovaných plateb v George"
            />
          )}
        </View>
      );
    }
    // faktor z ekonomiky
    const f = id as FaktorId;
    const zasah = Object.keys(W)
      .filter((t) => UZLY[t] && W[t][f] && (rozbaleno ? jePod(t) || t === 'spending' : !jePod(t)))
      .map((t) => ({ t, v: vliv(V, t, f) }))
      .sort((a, b) => b.v - a.v);
    const mx = Math.max(...zasah.map((x) => x.v), 1);
    return (
      <View style={{ gap: 10 }}>
        <Hlavicka id={id} nadpis="Co se děje" />
        <Text style={st.text}>{FD[f]}</Text>
        <Text style={st.label}>Aktuálně</Text>
        <Text style={st.velke}>{FIN[f].sh(V[f])}</Text>
        <Text style={st.sekce}>Na co nejvíc působí</Text>
        {zasah.map(({ t, v }) => (
          <View key={t} style={{ gap: 4 }}>
            <View style={st.kv}><Text style={st.kvL}>{UZLY[t].e} {UZLY[t].full ?? UZLY[t].l}</Text><Text style={st.kvH}>{uroven(v)}</Text></View>
            <View style={st.pruhPozadi}><View style={[st.pruh, { width: `${(v / mx) * 100}%`, backgroundColor: sev(clamp(v * 1.7)) }]} /></View>
          </View>
        ))}
        <Text style={st.drobne}>Zdroje: {FSRC[f]}. Ukázková data. Změňte hodnotu ve Scénáři.</Text>
      </View>
    );
  })();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={st.obal}>
        <View style={st.hlavickaObrazovky}>
          <View style={{ flex: 1 }}>
            <Text style={st.nadpis}>Moje peníze</Text>
            <Text style={st.podnadpis}>{P.jmeno} · co hýbe vašimi penězi</Text>
          </View>
          <Pressable onPress={() => { setScenar(true); setVybrano(null); setRozbaleno(false); }}><Text style={st.odkaz}>Scénář</Text></Pressable>
          <Pressable onPress={() => { setV({ ...V0 }); vyber(null); }}><Text style={st.odkaz}>↺</Text></Pressable>
        </View>

        <Pressable style={st.zeptat} onPress={() => setAsistent(true)}>
          <Text style={{ fontSize: 18 }}>🎙</Text>
          <Text style={st.zeptatText}>Kolik si můžu dovolit?</Text>
        </Pressable>

        {sit}

        <View style={st.legendaSite}>
          <View style={st.legendaPolozka}><View style={[st.tecka, { backgroundColor: barvy.modra }]} /><Text style={st.drobne}>moje peníze</Text></View>
          <View style={st.legendaPolozka}><View style={[st.tecka, { borderRadius: 3, backgroundColor: '#1e2f4d', borderWidth: 1, borderColor: '#6F9BEA', borderStyle: 'dashed' }]} /><Text style={st.drobne}>vliv z ekonomiky</Text></View>
          <View style={st.legendaPolozka}><Text style={[st.drobne, { color: barvy.modraAkcent }]}>✦ pomůžeme</Text></View>
        </View>

        <View style={st.panel}>{detail}</View>
      </ScrollView>

      {toast && <View style={st.toast}><Text style={st.toastText}>{toast}</Text></View>}
      {asistent && <KolikSiMuzuDovolit profil={P} zavrit={() => setAsistent(false)} />}
    </View>
  );
}

/** Náhrada posuvníku bez další knihovny: − hodnota +. */
function Krokovac({ popis, hodnota, minus, plus }: { popis: string; hodnota: string; minus: () => void; plus: () => void }) {
  return (
    <View style={st.krokovac}>
      <Text style={[st.kvL, { flex: 1 }]}>{popis}</Text>
      <Pressable style={st.krok} onPress={minus} accessibilityLabel="Snížit"><Text style={st.krokText}>−</Text></Pressable>
      <Text style={st.krokHodnota}>{hodnota}</Text>
      <Pressable style={st.krok} onPress={plus} accessibilityLabel="Zvýšit"><Text style={st.krokText}>+</Text></Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  obal: { padding: 16, paddingTop: 20, gap: 14, paddingBottom: 30 },
  hlavickaObrazovky: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  nadpis: { color: '#fff', fontSize: 34, lineHeight: 38, fontFamily: pismo.tucne, letterSpacing: -0.7 },
  podnadpis: { color: barvy.textTlumeny, fontSize: 15, fontFamily: pismo.polotucne, marginTop: 2 },
  odkaz: { color: barvy.modraAkcent, fontSize: 15, fontFamily: pismo.tucne },
  zeptat: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: barvy.modra, borderRadius: 26, height: 52, paddingHorizontal: 20, alignSelf: 'stretch', justifyContent: 'center' },
  zeptatText: { color: '#fff', fontSize: 17, fontFamily: pismo.tucne },
  uzel: { position: 'absolute', width: 100, alignItems: 'center' },
  kruh: { backgroundColor: barvy.karta, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  faktor: { backgroundColor: '#1e2f4d', borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  vybrany: { shadowColor: '#5aa2ff', shadowOpacity: 0.9, shadowRadius: 10, elevation: 8 },
  pomoc: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: barvy.modra, alignItems: 'center', justifyContent: 'center' },
  pomocText: { color: '#fff', fontSize: 10 },
  uzelNazev: { color: '#fff', fontSize: 11, fontFamily: pismo.tucne, marginTop: 3 },
  uzelHodnota: { color: barvy.textSlaby, fontSize: 10, fontFamily: pismo.stredni },
  legendaSite: { flexDirection: 'row', gap: 14, justifyContent: 'center', flexWrap: 'wrap' },
  legendaPolozka: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tecka: { width: 10, height: 10, borderRadius: 5 },
  panel: { backgroundColor: barvy.karta, borderRadius: 24, padding: 18 },
  hlavicka: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  label: { color: barvy.textTlumeny, fontSize: 12, fontFamily: pismo.tucne, letterSpacing: 0.5, textTransform: 'uppercase' },
  titulek: { color: '#fff', fontSize: 20, fontFamily: pismo.tucne },
  sekce: { color: '#fff', fontSize: 16, fontFamily: pismo.tucne, marginTop: 6 },
  text: { color: '#fff', fontSize: 15, lineHeight: 21, fontFamily: pismo.stredni },
  drobne: { color: barvy.textSlaby, fontSize: 12.5, lineHeight: 17, fontFamily: pismo.stredni },
  velke: { color: '#fff', fontSize: 28, fontFamily: pismo.tucne },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  kvL: { color: barvy.textTlumeny, fontSize: 14.5, fontFamily: pismo.polotucne, flexShrink: 1 },
  kvH: { color: '#fff', fontSize: 15, fontFamily: pismo.tucne },
  pruhPozadi: { height: 6, borderRadius: 3, backgroundColor: barvy.kartaSvetla, overflow: 'hidden' },
  pruh: { height: 6, borderRadius: 3 },
  split: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cipy: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  cip: { paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: barvy.kartaSvetla },
  cipOn: { backgroundColor: barvy.modra },
  cipText: { color: '#fff', fontSize: 13, fontFamily: pismo.polotucne },
  skoky: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  skok: { paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: barvy.cervenaPozadi, borderWidth: 1, borderColor: 'rgba(255,107,107,.4)' },
  skokText: { color: '#fff', fontSize: 13, fontFamily: pismo.polotucne },
  tagSledujte: { height: 30, paddingHorizontal: 11, borderRadius: 999, backgroundColor: '#3a2e10', justifyContent: 'center' },
  tagSledujteText: { color: barvy.oranzova, fontSize: 13, fontFamily: pismo.tucne },
  nabidka: { backgroundColor: '#1a2540', borderRadius: 18, padding: 14, gap: 8, borderWidth: 1, borderColor: 'rgba(90,162,255,.35)' },
  proc: { color: barvy.modraAkcent, fontSize: 12.5, fontFamily: pismo.polotucne },
  nabidkaTitul: { color: '#fff', fontSize: 16, fontFamily: pismo.tucne },
  male: { height: 44, paddingHorizontal: 16, borderRadius: 22 },
  zpet: { color: barvy.modraAkcent, fontSize: 14, fontFamily: pismo.tucne },
  krokovac: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  krok: { width: 38, height: 38, borderRadius: 19, backgroundColor: barvy.kartaSvetla, alignItems: 'center', justifyContent: 'center' },
  krokText: { color: '#fff', fontSize: 20, fontFamily: pismo.tucne },
  krokHodnota: { color: '#fff', fontSize: 15, fontFamily: pismo.tucne, minWidth: 76, textAlign: 'center' },
  toast: { position: 'absolute', left: 16, right: 16, bottom: 16, backgroundColor: '#0f0f13', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: barvy.okrajSilny },
  toastText: { color: '#fff', fontSize: 14, fontFamily: pismo.polotucne, textAlign: 'center' },
});
