// Pulse: kapitál ve světě podle pravidel klienta, mapa zemí, konflikt a anti-panika.
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as Speech from 'expo-speech';
import { Akce, api, Portfolio } from '../api';
import { fallbackPulse } from '../fallback';
import { IkonaJiskra, IlustraceGraf } from '../ikony';
import { Cip, GradientKarta, SegmentovyPruh, Stitek, Tlacitko } from '../komponenty';
import { useApp } from '../kontext';
import { barvy, gradienty, kc, pismo } from '../tema';

const BARVY_SEGMENTU = [barvy.fialova, '#2c9cf4', barvy.oranzova];

export default function Pulse() {
  const { uzivatel, online, ucet } = useApp();
  const { width } = useWindowDimensions();
  const sirkaKarty = Math.min(width - 32, 380);
  const [portfolio, setPortfolio] = useState<Portfolio>(ucet.portfolio);
  const [konflikt, setKonflikt] = useState<string | null>(null);
  const [presun, setPresun] = useState<Akce | null>(null);
  const [antipanika, setAntipanika] = useState(false);
  const [zprava, setZprava] = useState<string | null>(null);

  useEffect(() => setPortfolio(ucet.portfolio), [ucet.portfolio]);

  const mluv = (t: string) => {
    Speech.stop();
    Speech.speak(t, { language: 'cs-CZ' });
  };

  const udalost = async (typ: 'konflikt' | 'propad') => {
    let vysledek;
    try {
      vysledek = online ? await api.pulse(uzivatel, typ) : fallbackPulse(uzivatel, typ);
    } catch {
      vysledek = fallbackPulse(uzivatel, typ);
    }
    for (const a of vysledek.actions) {
      if (a.typ === 'pulse_mapa') setKonflikt(a.zeme);
      if (a.typ === 'pulse_presun') setPresun(a);
      if (a.typ === 'pulse_antipanika') setAntipanika(true);
      if (a.typ === 'portfolio') setPortfolio((p) => ({ ...p, zeme: a.zeme, odvetvi: a.odvetvi }));
    }
    setZprava(vysledek.reply);
    mluv(vysledek.speak);
  };

  const zeme = Object.entries(portfolio.zeme).sort((a, b) => b[1] - a[1]);
  const maxPodil = Math.max(...zeme.map(([, v]) => v), 1);
  const odvetvi = Object.entries(portfolio.odvetvi).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <ScrollView contentContainerStyle={s.obal}>
      <GradientKarta barvy={konflikt ? gradienty.cervena : gradienty.tyrkys} style={{ width: sirkaKarty, alignSelf: 'center' }}>
        <View style={s.ilustrace}><IlustraceGraf sirka={sirkaKarty - 70} /></View>
        <View style={s.cipy}><Cip text="Podle vašich pravidel" info /><Cip text="Demo data" /></View>
        <View style={s.obsahKarty}>
          <Text style={s.velkyNadpis}>Pulse</Text>
          <Text style={s.popis}>Vaše peníze ve světě. Hlídám je podle pravidel, která jste mi dali.</Text>
          <View style={s.radekStitku}>
            <Text style={s.malyNadpis}>HODNOTA PORTFOLIA</Text>
            <Stitek text={kc(portfolio.celkem)} smer={antipanika ? 'dolu' : 'nahoru'} cervena={antipanika} />
          </View>
          <View style={{ marginTop: 20, width: '100%' }}>
            <SegmentovyPruh
              polozky={odvetvi.map(([nazev, podil], i) => ({ nazev, hodnota: podil, barva: BARVY_SEGMENTU[i], popis: `${podil} %` }))}
            />
          </View>
        </View>
      </GradientKarta>

      {zprava && (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <View style={s.avatar}><IkonaJiskra /></View>
          <View style={[s.bublina, antipanika && !konflikt && { borderColor: barvy.oranzova, borderWidth: 1 }]}>
            <Text style={s.bublinaText}>{zprava}</Text>
          </View>
        </View>
      )}

      <Text style={s.sekce}>Mapa podle zemí</Text>
      <View style={s.mrizka}>
        {zeme.map(([nazev, podil]) => {
          const vKonfliktu = nazev === konflikt;
          const sila = 0.18 + 0.6 * (podil / maxPodil);
          return (
            <View
              key={nazev}
              style={[
                s.dlazdice,
                { flexBasis: podil >= 15 ? '47%' : '30%', backgroundColor: vKonfliktu ? barvy.cervenaPozadi : `rgba(43,125,233,${sila})` },
                vKonfliktu && { borderWidth: 1, borderColor: barvy.cervena },
              ]}
            >
              <Text style={s.dlazdiceNazev} numberOfLines={1}>{nazev}</Text>
              <Text style={[s.dlazdicePodil, vKonfliktu && { color: barvy.cervena }]}>{podil} %</Text>
            </View>
          );
        })}
      </View>
      {presun && presun.procent > 0 && (
        <View style={s.karta}>
          <Text style={s.kartaTitulek}>PŘESUN PODLE PRAVIDLA</Text>
          <View style={s.radek}><Text style={s.radekPopis}>{presun.z} → {presun.do}</Text><Stitek text={`${presun.procent} %`} /></View>
          <Text style={s.drobne}>Automaticky max. 5 % portfolia. Přesun lze vrátit.</Text>
        </View>
      )}

      <Text style={s.sekce}>Vaše pravidla</Text>
      <View style={s.karta}>
        {portfolio.pravidla.map((p, i) => (
          <View key={p} style={s.pravidlo}>
            <Text style={s.pravidloCislo}>{i + 1}</Text>
            <Text style={s.pravidloText}>{p}</Text>
          </View>
        ))}
      </View>

      <Text style={s.sekce}>Simulace pro demo</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Tlacitko text="Konflikt" onPress={() => udalost('konflikt')} style={{ flex: 1, paddingHorizontal: 10 }} />
        <Tlacitko text="Propad trhů" varianta="tmave" onPress={() => udalost('propad')} style={{ flex: 1, paddingHorizontal: 10 }} />
      </View>
      <Text style={s.upozorneni}>
        Pouze pro informaci. George investice vysvětluje, ale neradí. Konkrétní doporučení dává poradce.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  obal: { padding: 16, paddingTop: 18, gap: 14, paddingBottom: 30 },
  ilustrace: { position: 'absolute', left: 0, right: 0, top: 40, alignItems: 'center' },
  cipy: { position: 'absolute', left: 20, top: 20, gap: 8 },
  obsahKarty: { alignItems: 'center', paddingTop: 262, paddingHorizontal: 22, paddingBottom: 24 },
  velkyNadpis: { color: '#fff', fontSize: 38, fontFamily: pismo.tucne, letterSpacing: -0.8 },
  popis: { color: '#fff', fontSize: 16, lineHeight: 22, fontFamily: pismo.polotucne, textAlign: 'center', marginTop: 10, maxWidth: 290 },
  radekStitku: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22 },
  malyNadpis: { color: '#fff', fontSize: 13, fontFamily: pismo.tucne, letterSpacing: 0.6 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: barvy.avatar, alignItems: 'center', justifyContent: 'center' },
  bublina: { flex: 1, backgroundColor: barvy.karta, paddingVertical: 13, paddingHorizontal: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 6 },
  bublinaText: { color: '#fff', fontSize: 16, lineHeight: 23, fontFamily: pismo.normal },
  sekce: { color: '#fff', fontSize: 22, fontFamily: pismo.tucne, marginTop: 8 },
  mrizka: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dlazdice: { flexGrow: 1, borderRadius: 20, padding: 14, minHeight: 78, justifyContent: 'space-between' },
  dlazdiceNazev: { color: '#fff', fontSize: 14, fontFamily: pismo.polotucne },
  dlazdicePodil: { color: '#fff', fontSize: 20, fontFamily: pismo.tucne },
  karta: { backgroundColor: barvy.karta, borderRadius: 24, padding: 18, gap: 12 },
  kartaTitulek: { color: barvy.textTlumeny, fontSize: 13, fontFamily: pismo.tucne, letterSpacing: 0.65 },
  radek: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  radekPopis: { color: '#fff', fontSize: 16, fontFamily: pismo.polotucne },
  drobne: { color: barvy.textSlaby, fontSize: 13, fontFamily: pismo.stredni },
  pravidlo: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pravidloCislo: { width: 26, height: 26, borderRadius: 13, backgroundColor: barvy.avatar, color: barvy.modraAkcent, textAlign: 'center', lineHeight: 26, fontSize: 13, fontFamily: pismo.tucne, overflow: 'hidden' },
  pravidloText: { flex: 1, color: '#fff', fontSize: 15, lineHeight: 21, fontFamily: pismo.stredni },
  upozorneni: { color: '#9a9aa3', fontSize: 14, lineHeight: 20, fontFamily: pismo.polotucne },
});
