// Asistent "Kolik si můžu dovolit?": jedna věta odpovědi, malý graf zůstatku a potvrzení.
// Čísla počítá mojePenize/prognoza.ts (pevný výpočet), nic se nenastaví bez souhlasu klienta.
import React, { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Speech from 'expo-speech';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useHlas } from '../hooky/useHlas';
import { IkonaMikrofon, IkonaOdeslat, IkonaStop } from '../ikony';
import { Tlacitko } from '../komponenty';
import { useApp } from '../kontext';
import type { Profil } from '../mojePenize/data';
import { Bod, datumCz, MESICE_6P, MESICE_ZKR, planDovolena, planNakup, pravidelneCelkem } from '../mojePenize/prognoza';
import { barvy, kc, pismo } from '../tema';

type Potvrzeni = { otazka: string; text: string; hotovo: string; stav: 'ceka' | 'ano' | 'ne' };
type Zprava = { id: number; kdo: 'ja' | 'g'; text: string; graf?: { body: Bod[]; znacka?: Date; popis: string }; potvrzeni?: Potvrzeni; jak?: string };

const NAVRHY = ['Kolik si můžu dovolit za dovolenou v létě?', 'Můžu si koupit telefon za 18 000?'];

export default function KolikSiMuzuDovolit({ profil: P, zavrit }: { profil: Profil; zavrit: () => void }) {
  const { online } = useApp();
  const hlas = useHlas();
  const [zpravy, setZpravy] = useState<Zprava[]>([]);
  const [vstup, setVstup] = useState('');
  const [premyslim, setPremyslim] = useState(false);
  const citac = useRef(0);
  const posuvnik = useRef<ScrollViewInstance>(null);

  const pridej = (z: Omit<Zprava, 'id'>) => setZpravy((p) => [...p, { ...z, id: ++citac.current }]);

  const mluv = (t: string) => {
    Speech.stop();
    Speech.speak(t, { language: 'cs-CZ' });
  };

  const odpovez = (otazka: string) => {
    const q = otazka.toLowerCase();
    const cislo = (q.replace(/\s/g, '').match(/(\d{4,6})/) ?? [])[1];
    const jak = `Příjem ${kc(P.prognoza.prijem)} (${P.prognoza.denPrijmu}. v měsíci), pravidelné platby ${kc(pravidelneCelkem(P))} měsíčně a obvyklé výdaje podle posledních měsíců.`;

    if (/dovolen|léto|letn|moře|zájezd/.test(q)) {
      const v = planDovolena(P);
      if (!v.mesicne) {
        const t = 'Teď by odkládání na dovolenou ohrozilo rezervu na běžné výdaje. Zkusme nejdřív snížit výdaje za jídlo s sebou.';
        pridej({ kdo: 'g', text: t, graf: { body: v.body, popis: 'Odhad zůstatku na běžném účtu do července' }, jak });
        mluv(t);
        return;
      }
      const t = `Když si budete každý měsíc odkládat ${kc(v.mesicne)}, v červenci budete mít ${kc(v.celkem)} a běžné platby zůstanou v pohodě. Mám to nastavit?`;
      pridej({
        kdo: 'g', text: t,
        graf: { body: v.body, popis: `Odhad zůstatku na běžném účtu do července, s odkládáním ${kc(v.mesicne)} měsíčně od ledna` },
        potvrzeni: {
          otazka: 'Nastavit pravidelné spoření?',
          text: `${kc(v.mesicne)} 1. dne v měsíci, leden až červen, na spořicí účet Dovolená. Kdykoli ho můžete změnit.`,
          hotovo: 'Hotovo. Pravidelné spoření je nastavené. Najdete ho v George v Platbách.',
          stav: 'ceka',
        },
        jak: `${jak} Odkládání je takové, aby zůstatek nikdy neklesl pod rezervu ${kc(P.prognoza.rezerva)} plus ${kc(P.prognoza.buffer)} pro jistotu.`,
      });
      mluv(t);
      return;
    }

    if (/telefon|mobil|iphone|koupit|koupi|pořídit|porid|auto|stěhov|nábytek|televiz|notebook|kolo/.test(q) || cislo) {
      const cena = cislo ? +cislo : 18_000;
      const r = planNakup(P, cena);
      if (r.ok) {
        const t = `Ano, ${kc(cena)} si můžete dovolit už dnes, zůstatek neklesne pod rezervu ani v dalších měsících.`;
        pridej({ kdo: 'g', text: t, graf: { body: r.body, popis: 'Odhad zůstatku po nákupu' }, jak: `${jak} Zůstatek jsem projel den po dni do července.` });
        mluv(t);
        return;
      }
      const hned = r.problem.d.getMonth() === 10 && r.problem.d.getFullYear() === 2026;
      const kdy = r.kdy ? `Když počkáte do výplaty ${datumCz(r.kdy)}, vyjde to bez problémů.` : 'Zkuste to o pár měsíců později nebo za nižší cenu.';
      const t = hned
        ? `Teď na to na účtu nemáte, chybělo by asi ${kc(r.chybi)}. ${kdy}`
        : `Dnes ano, ale v ${MESICE_6P[r.problem.d.getMonth()]} by vám chybělo asi ${kc(r.chybi)} na běžné platby. ${kdy}`;
      pridej({
        kdo: 'g', text: t,
        graf: { body: r.body, znacka: r.problem.d, popis: 'Odhad zůstatku, kdybyste koupili dnes' },
        potvrzeni: r.kdy
          ? { otazka: `Připomenout ${datumCz(r.kdy)}?`, text: 'Pošlu vám zprávu v den výplaty. Nic se neobjedná ani neodečte.', hotovo: 'Hotovo. Připomenu vám to v den výplaty.', stav: 'ceka' }
          : undefined,
        jak: P.prognoza.rocni
          ? `${jak} V ${MESICE_6P[P.prognoza.rocni.mesic]} přibývá ${P.prognoza.rocni.popis}, proto se problém může ukázat až tehdy, ne hned.`
          : jak,
      });
      mluv(t);
      return;
    }

    pridej({
      kdo: 'g',
      text: 'Zatím rozumím dotazům na dovolenou a větší nákupy. Zkuste například „Můžu si koupit notebook za 25 000?“. U investic vás rád spojím s poradcem.',
    });
  };

  const zeptej = (text: string, hlasem = false) => {
    const t = text.trim();
    if (!t || premyslim) return;
    setVstup('');
    pridej({ kdo: 'ja', text: (hlasem ? '🎙 ' : '') + t });
    setPremyslim(true);
    setTimeout(() => {
      odpovez(t);
      setPremyslim(false);
    }, 700);
  };

  const mikrofon = async () => {
    if (hlas.nahravam) {
      const v = await hlas.ukonci();
      if (v.text) zeptej(v.text, true);
      else pridej({ kdo: 'g', text: 'Nerozuměl jsem. Zkuste to prosím znovu, nebo napište.' });
      return;
    }
    if (!online) {
      // bez serveru nejde převod řeči – použít ukázkový dotaz
      zeptej(NAVRHY[0], true);
      return;
    }
    const ok = await hlas.zacni().catch(() => false);
    if (!ok) pridej({ kdo: 'g', text: 'Potřebuji přístup k mikrofonu.' });
  };

  const potvrd = (id: number, stav: 'ano' | 'ne') =>
    setZpravy((p) => p.map((z) => (z.id === id && z.potvrzeni ? { ...z, potvrzeni: { ...z.potvrzeni, stav } } : z)));

  return (
    <KeyboardAvoidingView style={s.prekryti} behavior="padding">
      <View style={s.okno}>
        <View style={s.hlavicka}>
          <View style={s.avatar}><Text style={s.avatarText}>G</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.titulek}>Kolik si můžu dovolit?</Text>
            <Text style={s.podtitulek}>Plánování z vašich plateb · odhad, ne rada</Text>
          </View>
          <Pressable onPress={() => { Speech.stop(); zavrit(); }}><Text style={s.odkaz}>Zavřít</Text></Pressable>
        </View>

        <ScrollView
          ref={posuvnik}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 10, padding: 16 }}
          onContentSizeChange={() => posuvnik.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[s.bublina, s.bublinaG]}>
            <Text style={s.veta}>Zeptejte se na dovolenou, nový telefon, stěhování nebo auto. Odpovím jednou větou.</Text>
            <Text style={s.drobne}>Počítám z vašich pravidelných příjmů, plateb a obvyklých výdajů. Sám nic nenastavím, vždy se zeptám.</Text>
          </View>

          {zpravy.map((z) => (
            <View key={z.id} style={[s.bublina, z.kdo === 'ja' ? s.bublinaJa : s.bublinaG]}>
              <Text style={s.veta}>{z.text}</Text>
              {z.graf && <MiniGraf body={z.graf.body} znacka={z.graf.znacka} rezerva={P.prognoza.rezerva} popis={z.graf.popis} />}
              {z.potvrzeni && (
                <View style={s.potvrzeni}>
                  {z.potvrzeni.stav === 'ceka' ? (
                    <>
                      <Text style={s.potvrzeniTitul}>{z.potvrzeni.otazka}</Text>
                      <Text style={s.drobne}>{z.potvrzeni.text}</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Tlacitko text="Ano" varianta="bile" onPress={() => potvrd(z.id, 'ano')} />
                        <Tlacitko text="Ne, díky" varianta="tmave" style={s.male} onPress={() => potvrd(z.id, 'ne')} />
                      </View>
                    </>
                  ) : (
                    <Text style={s.veta}>{z.potvrzeni.stav === 'ano' ? `✅ ${z.potvrzeni.hotovo}` : 'Nic jsem nenastavil. Kdykoli se zeptejte znovu.'}</Text>
                  )}
                </View>
              )}
              {z.jak && <JakToPocitam text={z.jak} />}
            </View>
          ))}
          {premyslim && <View style={[s.bublina, s.bublinaG]}><ActivityIndicator color={barvy.textTlumeny} /></View>}

          {zpravy.length === 0 && (
            <View style={{ gap: 8 }}>
              {NAVRHY.map((n) => (
                <Pressable key={n} style={s.navrh} onPress={() => zeptej(n)}><Text style={s.navrhText}>{n.includes('dovolen') ? '🏖 ' : '📱 '}{n}</Text></Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={s.vstupRadek}>
          <TextInput
            style={s.vstup}
            value={vstup}
            onChangeText={setVstup}
            placeholder={hlas.nahravam ? 'Poslouchám…' : 'Napište nebo namluvte dotaz…'}
            placeholderTextColor={barvy.textSlaby}
            onSubmitEditing={() => zeptej(vstup)}
            returnKeyType="send"
            maxLength={200}
          />
          {vstup.trim() ? (
            <Pressable style={s.kulate} onPress={() => zeptej(vstup)}><IkonaOdeslat /></Pressable>
          ) : (
            <Pressable style={[s.kulate, hlas.nahravam && { backgroundColor: barvy.cervena }]} onPress={mikrofon}>
              {hlas.prevadim ? <ActivityIndicator color="#fff" /> : hlas.nahravam ? <IkonaStop /> : <IkonaMikrofon />}
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function JakToPocitam({ text }: { text: string }) {
  const [otevreno, setOtevreno] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOtevreno(!otevreno)}><Text style={s.odkazMaly}>{otevreno ? '▾' : '▸'} Jak to počítám</Text></Pressable>
      {otevreno && (
        <>
          <Text style={s.drobne}>{text}</Text>
          <Text style={s.drobne}>Čísla počítá pevný výpočet z historie vašeho účtu. Umělá inteligence je jen převypráví. Jde o odhad, žádná záruka.</Text>
        </>
      )}
    </View>
  );
}

/** Malý graf odhadu zůstatku s čárou rezervy a vyznačeným problémem. */
function MiniGraf({ body, znacka, rezerva, popis }: { body: Bod[]; znacka?: Date; rezerva: number; popis: string }) {
  const W = 268, H = 96, pl = 4, pr = 4, pt = 8, pb = 16;
  const min = Math.min(0, ...body.map((p) => p.b), rezerva) - 2000;
  const max = Math.max(...body.map((p) => p.b)) + 2000;
  const x = (i: number) => pl + (i / (body.length - 1)) * (W - pl - pr);
  const y = (v: number) => pt + (1 - (v - min) / (max - min)) * (H - pt - pb);
  const krok = Math.max(1, Math.floor(body.length / 110));
  const cesta = body
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i % krok === 0 || i === body.length - 1)
    .map(({ p, i }, k) => `${k === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.b).toFixed(1)}`)
    .join(' ');
  const spatne = body.map((p, i) => (p.b < rezerva ? i : -1)).filter((i) => i >= 0);
  const iZnacky = znacka ? body.findIndex((p) => p.d.toDateString() === znacka.toDateString()) : -1;
  return (
    <View>
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H * 1.1}>
        <Rect x={pl} y={y(rezerva)} width={W - pl - pr} height={Math.max(0, y(min) - y(rezerva))} fill="#E0457B" opacity={0.08} />
        {spatne.length > 0 && (
          <Rect x={x(spatne[0])} y={pt} width={Math.max(3, x(spatne[spatne.length - 1]) - x(spatne[0]))} height={H - pt - pb} fill="#E0457B" opacity={0.18} />
        )}
        <Line x1={pl} x2={W - pr} y1={y(rezerva)} y2={y(rezerva)} stroke="#E0457B" strokeDasharray="3 3" strokeWidth={1} />
        <SvgText x={W - pr} y={y(rezerva) + 10} fontSize={8} fill="#ff8fae" textAnchor="end">{`rezerva ${kc(rezerva)}`}</SvgText>
        <Path d={cesta} fill="none" stroke={barvy.modraAkcent} strokeWidth={2} strokeLinejoin="round" />
        {iZnacky >= 0 && <Circle cx={x(iZnacky)} cy={y(body[iZnacky].b)} r={4} fill="#E0457B" stroke="#fff" strokeWidth={1.5} />}
        {body.map((p, i) =>
          p.d.getDate() === 1 && p.d.getMonth() % 2 === 0 ? (
            <SvgText key={i} x={x(i)} y={H - 3} fontSize={8} fill={barvy.textSlaby} textAnchor="middle">{MESICE_ZKR[p.d.getMonth()]}</SvgText>
          ) : null,
        )}
      </Svg>
      <Text style={s.drobne}>{popis}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  prekryti: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  okno: { height: '92%', backgroundColor: barvy.pozadi, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: barvy.okrajSilny },
  hlavicka: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderColor: barvy.okraj },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: barvy.modra, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: pismo.tucne, fontSize: 16 },
  titulek: { color: '#fff', fontSize: 17, fontFamily: pismo.tucne },
  podtitulek: { color: barvy.textSlaby, fontSize: 12, fontFamily: pismo.stredni },
  odkaz: { color: barvy.modraAkcent, fontSize: 15, fontFamily: pismo.tucne },
  odkazMaly: { color: barvy.modraAkcent, fontSize: 13, fontFamily: pismo.polotucne, marginTop: 4 },
  bublina: { borderRadius: 20, padding: 14, gap: 8, maxWidth: '92%' },
  bublinaG: { backgroundColor: barvy.karta, alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  bublinaJa: { backgroundColor: barvy.modraBublina, alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  veta: { color: '#fff', fontSize: 16, lineHeight: 22, fontFamily: pismo.polotucne },
  drobne: { color: barvy.textSlaby, fontSize: 12.5, lineHeight: 17, fontFamily: pismo.stredni },
  potvrzeni: { backgroundColor: '#1a2540', borderRadius: 16, padding: 12, gap: 8, borderWidth: 1, borderColor: 'rgba(90,162,255,.35)' },
  potvrzeniTitul: { color: '#fff', fontSize: 15, fontFamily: pismo.tucne },
  male: { height: 44, paddingHorizontal: 18, borderRadius: 22 },
  navrh: { backgroundColor: barvy.karta, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: barvy.okraj },
  navrhText: { color: '#fff', fontSize: 15, fontFamily: pismo.polotucne },
  vstupRadek: {
    flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, marginBottom: 28, backgroundColor: barvy.karta,
    borderWidth: 1, borderColor: barvy.okraj, borderRadius: 28, paddingVertical: 5, paddingRight: 5, paddingLeft: 18,
  },
  vstup: { flex: 1, height: 44, color: '#fff', fontSize: 16, fontFamily: pismo.normal },
  kulate: { width: 44, height: 44, borderRadius: 22, backgroundColor: barvy.modra, alignItems: 'center', justifyContent: 'center' },
});
