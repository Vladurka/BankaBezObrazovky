// Společné prvky podle designu: gradientní karta, štítek s hodnotou, tlačítka, čipy, segmentový pruh.
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { IkonaInfo, IkonaSipkaDolu, IkonaSipkaNahoru } from './ikony';
import { barvy, pismo } from './tema';

let pocitadloGradientu = 0;

/** Karta s vertikálním gradientem a jemným okrajem (karusel, Pulse, Zatřes). */
export function GradientKarta(props: { barvy: readonly [string, string]; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const id = React.useMemo(() => `gk${++pocitadloGradientu}`, []);
  return (
    <View style={[s.gradientKarta, props.style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={props.barvy[0]} /><Stop offset="1" stopColor={props.barvy[1]} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {props.children}
    </View>
  );
}

/** Zelený (nebo červený) štítek s hodnotou a šipkou. */
export function Stitek({ text, smer, cervena }: { text: string; smer?: 'nahoru' | 'dolu'; cervena?: boolean }) {
  return (
    <View style={[s.stitek, cervena && { backgroundColor: barvy.cervenaPozadi }]}>
      {smer === 'nahoru' && <IkonaSipkaNahoru />}
      {smer === 'dolu' && <IkonaSipkaDolu />}
      <Text style={[s.stitekText, cervena && { color: barvy.cervena }]}>{text}</Text>
    </View>
  );
}

/** Průhledný čip v levém horním rohu gradientní karty. */
export function Cip({ text, info }: { text: string; info?: boolean }) {
  return (
    <View style={s.cip}>
      {info && <IkonaInfo />}
      <Text style={s.cipText}>{text}</Text>
    </View>
  );
}

export function Tlacitko(props: { text: string; onPress: () => void; varianta?: 'modre' | 'bile' | 'tmave'; style?: StyleProp<ViewStyle>; disabled?: boolean }) {
  const v = props.varianta ?? 'modre';
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [s.tlacitko, s[`tlacitko_${v}`], pressed && { opacity: 0.8 }, props.disabled && { opacity: 0.5 }, props.style]}
    >
      <Text style={[s.tlacitkoText, v === 'bile' && { color: barvy.modraBublina }]}>{props.text}</Text>
    </Pressable>
  );
}

/** Tenký pruh se třemi barevnými segmenty a legendou pod ním. */
export function SegmentovyPruh({ polozky }: { polozky: { nazev: string; hodnota: number; barva: string; popis: string }[] }) {
  return (
    <View style={{ width: '100%' }}>
      <View style={s.pruh}>
        {polozky.map((p) => (
          <View key={p.nazev} style={{ flex: Math.max(p.hodnota, 0.1), height: 6, borderRadius: 3, backgroundColor: p.barva }} />
        ))}
      </View>
      <View style={s.legenda}>
        {polozky.map((p) => (
          <View key={p.nazev} style={s.legendaPolozka}>
            <View style={s.legendaRadek}>
              <View style={[s.tecka, { backgroundColor: p.barva }]} />
              <Text style={s.legendaNazev} numberOfLines={1}>{p.nazev}</Text>
            </View>
            <Text style={s.legendaHodnota}>{p.popis}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Tečky pod karuselem (aktivní je protáhlá). */
export function Tecky({ pocet, aktivni, onVyber }: { pocet: number; aktivni: number; onVyber: (i: number) => void }) {
  return (
    <View style={s.tecky}>
      {Array.from({ length: pocet }, (_, i) => (
        <Pressable key={i} onPress={() => onVyber(i)} style={s.teckaObal} accessibilityLabel={`Karta ${i + 1}`}>
          <View style={{ height: 8, borderRadius: 4, width: i === aktivni ? 36 : 8, backgroundColor: i === aktivni ? '#9a9aa3' : '#45454d' }} />
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  gradientKarta: { borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,.2)', overflow: 'hidden' },
  stitek: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 11, borderRadius: 999, backgroundColor: barvy.zelenaPozadi },
  stitekText: { color: barvy.zelena, fontSize: 14, fontFamily: pismo.tucne },
  cip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.18)' },
  cipText: { color: '#fff', fontSize: 15, fontFamily: pismo.polotucne },
  tlacitko: { height: 52, paddingHorizontal: 30, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  tlacitko_modre: { backgroundColor: barvy.modra },
  tlacitko_bile: { backgroundColor: '#fff', height: 44, paddingHorizontal: 20, borderRadius: 22 },
  tlacitko_tmave: { backgroundColor: barvy.kartaSvetla },
  tlacitkoText: { color: '#fff', fontSize: 17, fontFamily: pismo.tucne },
  pruh: { flexDirection: 'row', gap: 3, width: '100%' },
  legenda: { flexDirection: 'row', marginTop: 14, gap: 4 },
  legendaPolozka: { flex: 1, alignItems: 'center', gap: 2 },
  legendaRadek: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tecka: { width: 10, height: 10, borderRadius: 5 },
  legendaNazev: { color: '#fff', fontSize: 12, fontFamily: pismo.tucne, letterSpacing: 0.5, textTransform: 'uppercase' },
  legendaHodnota: { color: '#fff', fontSize: 19, fontFamily: pismo.tucne },
  tecky: { flexDirection: 'row', justifyContent: 'center' },
  teckaObal: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
