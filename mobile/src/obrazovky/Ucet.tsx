// Přehled: zůstatek, Strážce a jeho upozornění, poslední pohyby.
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, VERZE_PROTOKOLU } from '../api';
import { IkonaStit } from '../ikony';
import { Stitek, Tlacitko } from '../komponenty';
import { useApp } from '../kontext';
import { barvy, kc, pismo } from '../tema';

export default function Ucet() {
  const { ucet, obnovUcet, online, odhlasit, verzeServeru } = useApp();
  const [obnovuji, setObnovuji] = useState(false);

  const obnov = async () => {
    setObnovuji(true);
    await obnovUcet();
    setObnovuji(false);
  };

  const strazceZpravy = ucet.upozorneni.filter((u) => u.typ === 'strazce');

  return (
    <ScrollView
      contentContainerStyle={s.obal}
      refreshControl={<RefreshControl refreshing={obnovuji} onRefresh={obnov} tintColor="#fff" />}
    >
      <Text style={s.nadpis}>Přehled</Text>
      <Text style={s.podnadpis}>{ucet.jmeno} · {ucet.ucet}</Text>

      <View style={s.zustatekKarta}>
        <Text style={s.kartaTitulek}>ZŮSTATEK</Text>
        <Text style={s.zustatek}>{kc(ucet.zustatek)}</Text>
        <Text style={s.drobne}>{online ? 'Aktuální stav z banky' : 'Režim bez sítě (demo data)'}</Text>
      </View>

      <Text style={s.sekce}>Strážce</Text>
      <View style={s.karta}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={s.kruh}><IkonaStit velikost={36} /></View>
          <Text style={s.text}>
            {ucet.strazce
              ? `Váš Strážce je ${ucet.strazce}. Dostane zprávu, když George zastaví podezřelou platbu.`
              : 'Hlídáte účet babičky Jany. Upozornění na podezřelé platby uvidíte tady.'}
          </Text>
        </View>
      </View>
      {strazceZpravy.map((z, i) => (
        <View key={i} style={[s.karta, s.kartaVarovani]}>
          <Text style={[s.kartaTitulek, { color: barvy.cervena }]}>UPOZORNĚNÍ · {z.jmeno?.toUpperCase()}</Text>
          <Text style={s.text}>{z.text}</Text>
        </View>
      ))}

      <Text style={s.sekce}>Historie převodů</Text>
      <View style={s.karta}>
        {ucet.pohyby.map((p, i) => (
          <View key={i} style={s.pohyb}>
            <View style={{ flex: 1 }}>
              <Text style={s.pohybPopis} numberOfLines={1}>{p.popis}</Text>
              <Text style={s.drobne}>{p.datum}{p.cas ? ` · ${p.cas}` : ''}</Text>
            </View>
            <Stitek text={`${p.castka < 0 ? '−' : '+'}${kc(p.castka)}`} cervena={p.castka < 0} />
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        {online && (
          <Tlacitko
            text="Reset dema"
            varianta="tmave"
            style={{ flex: 1, paddingHorizontal: 10 }}
            onPress={async () => {
              await api.reset().catch(() => {});
              obnov();
            }}
          />
        )}
        <Tlacitko text="Odhlásit" varianta="tmave" style={{ flex: 1, paddingHorizontal: 10 }} onPress={odhlasit} />
      </View>
      <Text style={[s.drobne, { textAlign: 'center' }]}>
        Verze aplikace {VERZE_PROTOKOLU} · server {verzeServeru ?? '?'}
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  obal: { padding: 16, paddingTop: 20, gap: 14, paddingBottom: 30 },
  nadpis: { color: '#fff', fontSize: 34, lineHeight: 38, fontFamily: pismo.tucne, letterSpacing: -0.7, paddingHorizontal: 4 },
  podnadpis: { color: barvy.textTlumeny, fontSize: 15, fontFamily: pismo.polotucne, paddingHorizontal: 4, marginTop: -6 },
  zustatekKarta: { backgroundColor: barvy.modraBublina, borderRadius: 30, padding: 22, gap: 6 },
  zustatek: { color: '#fff', fontSize: 40, fontFamily: pismo.tucne, letterSpacing: -1 },
  sekce: { color: '#fff', fontSize: 22, fontFamily: pismo.tucne, marginTop: 8, paddingHorizontal: 4 },
  karta: { backgroundColor: barvy.karta, borderRadius: 24, padding: 18, gap: 12 },
  kartaVarovani: { backgroundColor: barvy.cervenaPozadi, borderWidth: 1, borderColor: 'rgba(255,107,107,.45)' },
  kartaTitulek: { color: '#dbe6ff', fontSize: 13, fontFamily: pismo.tucne, letterSpacing: 0.65 },
  kruh: { width: 56, height: 56, borderRadius: 28, backgroundColor: barvy.cervenaPozadi, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, color: '#fff', fontSize: 15, lineHeight: 21, fontFamily: pismo.stredni },
  pohyb: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pohybPopis: { color: '#fff', fontSize: 16, fontFamily: pismo.polotucne },
  drobne: { color: barvy.textSlaby, fontSize: 13, fontFamily: pismo.stredni },
});
