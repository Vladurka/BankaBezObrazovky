// Banka bez obrazovky – hlavní komponenta: výběr demo účtu (karusel), plovoucí navigace, živá upozornění.
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView,
  type ScrollViewInstance, StatusBar as RNStatusBar, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
// jednotlivé řezy importovat zvlášť, jinak se přibalí všech 18 souborů písma
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { aktualniUrl, api, nactiUlozenouUrl, nastavUrl } from './src/api';
import { IkonaAsistent, IkonaPulse, IkonaUcet, IkonaZatres, IlustraceSpendlik, IlustraceZarovka } from './src/ikony';
import { Cip, GradientKarta, Stitek, Tecky, Tlacitko } from './src/komponenty';
import { AppProvider, useApp, type Zalozka } from './src/kontext';
import George from './src/obrazovky/George';
import Pulse from './src/obrazovky/Pulse';
import Ucet from './src/obrazovky/Ucet';
import Zatres from './src/obrazovky/Zatres';
import { barvy, gradienty, kc, pismo } from './src/tema';

export const HORNI_ODSAZENI = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) : 54;

const UCTY = [
  { id: 'jana', jmeno: 'Jana', popis: 'Babička s hlasovým Georgem. Platí hlasem, George ji hlídá před podvodníky.', cip: 'Hlas a ochrana', stitek: 'STRÁŽCE ZAPNUTÝ', gradient: gradienty.indigo, Ilustrace: IlustraceSpendlik },
  { id: 'tomas', jmeno: 'Tomáš', popis: 'Vnuk a Strážce babičky. Dostává upozornění a posílá peníze zatřesením.', cip: 'Strážce a Zatřes', stitek: 'HLÍDÁ BABIČKU', gradient: gradienty.fialova, Ilustrace: IlustraceZarovka },
];

export default function App() {
  const [fontyNactene] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [uzivatel, setUzivatel] = useState<string | null>(null);
  const [online, setOnline] = useState(false);

  if (!fontyNactene) {
    return (
      <View style={[s.koren, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={barvy.modraAkcent} />
      </View>
    );
  }

  return (
    <View style={s.koren}>
      <StatusBar style="light" />
      {uzivatel ? (
        <AppProvider uzivatel={uzivatel} online={online} odhlasit={() => setUzivatel(null)}>
          <Hlavni />
        </AppProvider>
      ) : (
        <Prihlaseni
          vyber={(id, jeOnline) => {
            setOnline(jeOnline);
            setUzivatel(id);
          }}
        />
      )}
    </View>
  );
}

function Prihlaseni({ vyber }: { vyber: (id: string, online: boolean) => void }) {
  const { width } = useWindowDimensions();
  const sirkaKarty = Math.min(width - 40, 360);
  const krok = sirkaKarty + 10;
  const [url, setUrl] = useState(aktualniUrl());
  const [overuji, setOveruji] = useState(false);
  const [aktivni, setAktivni] = useState(0);
  const [nastaveni, setNastaveni] = useState(false);
  const karusel = useRef<ScrollViewInstance>(null);
  const stranka = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    nactiUlozenouUrl().then(setUrl);
  }, []);

  const prihlas = async (id: string) => {
    setOveruji(true);
    await nastavUrl(url);
    let jeOnline = false;
    try {
      jeOnline = (await api.zdravi()).stav === 'ok';
    } catch {
      // backend nedostupný -> režim bez sítě
    }
    setOveruji(false);
    vyber(id, jeOnline);
  };

  const priPosunu = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(UCTY.length - 1, Math.round(e.nativeEvent.contentOffset.x / krok)));
    if (i !== aktivni) setAktivni(i);
  };

  return (
    // KeyboardAvoidingView + posun na konec: pole pro adresu serveru nezakryje klávesnice
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
    <ScrollView
      ref={stranka}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: HORNI_ODSAZENI, paddingBottom: 30 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.hlavickaPrihlaseni}>
        <Text style={s.nadpisHlavicky}>Vyberte účet</Text>
      </View>

      <ScrollView
        ref={karusel}
        horizontal
        snapToInterval={krok}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, gap: 10 }}
        onScroll={priPosunu}
        scrollEventThrottle={32}
      >
        {UCTY.map((u) => (
          <GradientKarta key={u.id} barvy={u.gradient} style={{ width: sirkaKarty, height: 540 }}>
            <View style={s.ilustrace}><u.Ilustrace sirka={sirkaKarty - 50} /></View>
            <View style={s.cipy}><Cip text={u.cip} info /><Cip text="Demo data" /></View>
            <View style={s.obsahKarty}>
              <Text style={s.velkyNadpis}>{u.jmeno}</Text>
              <Text style={s.popisKarty}>{u.popis}</Text>
              <View style={{ marginTop: 'auto', alignItems: 'center', gap: 22 }}>
                <View style={s.radekStitku}>
                  <Text style={s.malyNadpis}>{u.stitek}</Text>
                  <Stitek text="aktivní" smer="nahoru" />
                </View>
                <Tlacitko text={overuji ? 'Připojuji…' : 'Vybrat'} onPress={() => prihlas(u.id)} disabled={overuji} />
              </View>
            </View>
          </GradientKarta>
        ))}
      </ScrollView>

      <Tecky pocet={UCTY.length} aktivni={aktivni} onVyber={(i) => { karusel.current?.scrollTo({ x: i * krok, animated: true }); setAktivni(i); }} />

      <Pressable onPress={() => setNastaveni((n) => !n)}>
        <Text style={s.upozorneni}>
          Všechna data jsou ilustrační a jména fiktivní. Klepněte sem pro nastavení serveru.
        </Text>
      </Pressable>
      {nastaveni && (
        <View style={{ paddingHorizontal: 20, gap: 8, marginTop: 10 }}>
          <Text style={s.popisekPole}>Adresa backendu (IP počítače ve stejné Wi-Fi)</Text>
          <TextInput
            style={s.pole}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onFocus={() => setTimeout(() => stranka.current?.scrollToEnd({ animated: true }), 300)}
          />
        </View>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ZALOZKY: { id: Zalozka; nazev: string; Ikona: typeof IkonaUcet }[] = [
  { id: 'ucet', nazev: 'Přehled', Ikona: IkonaUcet },
  { id: 'george', nazev: 'George', Ikona: IkonaAsistent },
  { id: 'zatres', nazev: 'Zatřes', Ikona: IkonaZatres },
  { id: 'pulse', nazev: 'Pulse', Ikona: IkonaPulse },
];

/** Sleduje, zda je otevřená klávesnice (kvůli skrytí spodní navigace). */
function useKlavesnice() {
  const [otevrena, setOtevrena] = useState(false);
  useEffect(() => {
    const ukaz = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setOtevrena(true));
    const skryj = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setOtevrena(false));
    return () => {
      ukaz.remove();
      skryj.remove();
    };
  }, []);
  return otevrena;
}

function Hlavni() {
  const { banner, zavriBanner, zalozka, prejdiNa: setZalozka, varovaniVerze } = useApp();
  const klavesnice = useKlavesnice();

  return (
    <KeyboardAvoidingView style={{ flex: 1, paddingTop: HORNI_ODSAZENI }} behavior="padding">
      {varovaniVerze && (
        <View style={[s.banner, s.bannerVarovani]}>
          <Text style={s.bannerNadpis}>NESHODA VERZÍ</Text>
          <Text style={s.bannerText}>{varovaniVerze}</Text>
        </View>
      )}
      {banner && (
        <Pressable
          style={[s.banner, banner.typ === 'strazce' ? s.bannerVarovani : s.bannerPrichozi]}
          onPress={() => {
            zavriBanner();
            if (banner.typ === 'strazce') setZalozka('ucet');
          }}
        >
          <Text style={s.bannerNadpis}>{banner.typ === 'strazce' ? 'UPOZORNĚNÍ STRÁŽCE' : 'PŘÍCHOZÍ PLATBA'}</Text>
          <Text style={s.bannerText}>
            {banner.typ === 'strazce' ? banner.text : `${banner.od} vám poslal(a) ${kc(banner.castka)}.`}
          </Text>
        </Pressable>
      )}

      {/* všechny obrazovky zůstávají načtené: zatřesení funguje z každé záložky a chat se při přepnutí nemaže */}
      {([['george', George], ['zatres', Zatres], ['pulse', Pulse], ['ucet', Ucet]] as const).map(([id, Obrazovka]) => (
        <View key={id} style={{ flex: 1, display: zalozka === id ? 'flex' : 'none' }}>
          <Obrazovka />
        </View>
      ))}

      {!klavesnice && (
      <View style={s.navigace}>
        {ZALOZKY.map(({ id, nazev, Ikona }) => {
          const aktivni = zalozka === id;
          return (
            <Pressable
              key={id}
              style={[s.navPolozka, aktivni && { backgroundColor: barvy.navigaceAktivni }]}
              onPress={() => setZalozka(id)}
              accessibilityState={{ selected: aktivni }}
            >
              <Ikona barva={aktivni ? barvy.modraAkcent : '#fff'} />
              <Text style={[s.navText, aktivni && { color: barvy.modraAkcent }]}>{nazev}</Text>
            </Pressable>
          );
        })}
      </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  koren: { flex: 1, backgroundColor: barvy.pozadi },
  hlavickaPrihlaseni: { height: 60, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderColor: barvy.karta },
  nadpisHlavicky: { color: '#fff', fontSize: 19, fontFamily: pismo.tucne },
  ilustrace: { position: 'absolute', left: 0, right: 0, top: 44, alignItems: 'center' },
  cipy: { position: 'absolute', left: 20, top: 20, gap: 8 },
  obsahKarty: { flex: 1, alignItems: 'center', paddingTop: 262, paddingHorizontal: 22, paddingBottom: 24 },
  velkyNadpis: { color: '#fff', fontSize: 38, fontFamily: pismo.tucne, letterSpacing: -0.8 },
  popisKarty: { color: '#fff', fontSize: 16, fontFamily: pismo.polotucne, lineHeight: 22, textAlign: 'center', marginTop: 12, maxWidth: 290 },
  radekStitku: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  malyNadpis: { color: '#fff', fontSize: 13, fontFamily: pismo.tucne, letterSpacing: 0.6 },
  upozorneni: { color: '#9a9aa3', fontSize: 14, fontFamily: pismo.polotucne, lineHeight: 20, paddingHorizontal: 20 },
  popisekPole: { color: barvy.textSlaby, fontSize: 13, fontFamily: pismo.stredni },
  pole: { backgroundColor: barvy.karta, color: '#fff', borderRadius: 16, paddingHorizontal: 16, height: 48, fontSize: 15, fontFamily: pismo.normal },
  banner: { marginHorizontal: 16, marginTop: 8, marginBottom: 4, borderRadius: 20, padding: 14, gap: 4 },
  bannerVarovani: { backgroundColor: barvy.cervenaPozadi, borderWidth: 1, borderColor: barvy.cervena },
  bannerPrichozi: { backgroundColor: barvy.zelenaPozadi, borderWidth: 1, borderColor: barvy.zelena },
  bannerNadpis: { color: barvy.textTlumeny, fontSize: 12, fontFamily: pismo.tucne, letterSpacing: 0.6 },
  bannerText: { color: '#fff', fontSize: 15, fontFamily: pismo.polotucne, lineHeight: 21 },
  navigace: {
    flexDirection: 'row', gap: 2, marginHorizontal: 12, marginBottom: Platform.OS === 'ios' ? 28 : 14, padding: 6,
    backgroundColor: barvy.navigace, borderWidth: 1, borderColor: barvy.okrajSilny, borderRadius: 34,
  },
  navPolozka: { flex: 1, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navText: { color: '#fff', fontSize: 12, fontFamily: pismo.polotucne },
});
