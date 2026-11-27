// Zatřes telefonem: poslat peníze člověku vedle sebe bez IBANu.
//
// Tok jako v reálné aplikaci:
// 1. oba zatřesou současně (do 3 s) -> server je spáruje,
// 2. kdokoli z dvojice zadá částku a stiskne "Poslat" (tím potvrzuje svou stranu),
// 3. druhý platbu přijme nebo odmítne -> teprve pak se převede.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { fallbackPridejPohyb } from '../fallback';
import { useZatreseni } from '../hooky/useZatreseni';
import { IlustraceTelefony } from '../ikony';
import { Cip, GradientKarta, Stitek, Tlacitko } from '../komponenty';
import { useApp } from '../kontext';
import { barvy, gradienty, kc, pismo } from '../tema';

const LIMIT = 1000;
const HLEDANI_MS = 10_000;
const OFFLINE_ID = 'offline';

type Par = { id: string; protejsekJmeno: string };
type Nabidka = { odJa: boolean; odJmeno: string; komuJmeno: string; castka: number };
type Stav =
  | { faze: 'klid' }
  | { faze: 'hledam' }
  | { faze: 'par'; par: Par }
  | { faze: 'nabidka'; par: Par; nabidka: Nabidka }
  | { faze: 'hotovo'; text: string; prijato: boolean }
  | { faze: 'chyba'; text: string };

const JMENA: Record<string, string> = { jana: 'Jana Dvořáková', tomas: 'Tomáš Dvořák' };

export default function Zatres() {
  const { uzivatel, online, wsPripojeno, posliWs, odebirej, obnovUcet, prejdiNa } = useApp();
  const { width } = useWindowDimensions();
  const sirkaKarty = Math.min(width - 32, 380);
  const [stav, setStav] = useState<Stav>({ faze: 'klid' });
  const [castka, setCastka] = useState('500');
  const [chybaNabidky, setChybaNabidky] = useState<string | null>(null);
  const otres = useRef(new Animated.Value(0)).current;
  const offlineCasovac = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jePripojeno = online && wsPripojeno;

  useEffect(() => () => {
    if (offlineCasovac.current) clearTimeout(offlineCasovac.current);
  }, []);

  // zprávy ze serveru
  useEffect(
    () =>
      odebirej((z) => {
        switch (z.typ) {
          case 'zatreseni_hledam':
            setStav((p) => (p.faze === 'par' || p.faze === 'nabidka' ? p : { faze: 'hledam' }));
            break;
          case 'zatreseni_par':
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            prejdiNa('zatres');
            setChybaNabidky(null);
            setStav({ faze: 'par', par: { id: z.id, protejsekJmeno: z.protejsek_jmeno } });
            break;
          case 'zatreseni_nabidka':
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setStav((p) =>
              p.faze === 'par' || p.faze === 'nabidka'
                ? {
                    faze: 'nabidka',
                    par: p.par,
                    nabidka: { odJa: z.od === uzivatel, odJmeno: z.od_jmeno, komuJmeno: z.komu_jmeno, castka: z.castka },
                  }
                : p,
            );
            break;
          case 'zatreseni_hotovo':
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setStav({ faze: 'hotovo', prijato: !!z.prijato, text: `${kc(z.castka)} · ${z.od_jmeno} → ${z.komu_jmeno}` });
            break;
          case 'zatreseni_zruseno':
            setStav({ faze: 'chyba', text: z.duvod ?? 'Převod byl zrušen.' });
            break;
          case 'zatreseni_chyba':
            // chyba nabídky (limit, zůstatek, druhá strana už posílá) spojení neruší, jen se ukáže
            setChybaNabidky(z.duvod);
            setStav((p) => (p.faze === 'par' || p.faze === 'nabidka' ? p : { faze: 'chyba', text: z.duvod }));
            break;
        }
      }),
    [odebirej, uzivatel, prejdiNa],
  );

  // hledání protějšku trvá max. 10 s; mezitím lze zatřást znovu
  useEffect(() => {
    if (stav.faze !== 'hledam') return;
    const t = setTimeout(() => {
      posliWs({ typ: 'zatreseni_zrusit' });
      setStav({ faze: 'chyba', text: 'Telefon vedle vás jsem nenašel. Zatřeste oba ve stejnou chvíli.' });
    }, HLEDANI_MS);
    return () => clearTimeout(t);
  }, [stav.faze, posliWs]);

  const animuj = () => {
    otres.setValue(0);
    Animated.sequence(
      [1, -1, 1, -1, 0].map((v) => Animated.timing(otres, { toValue: v, duration: 70, easing: Easing.linear, useNativeDriver: true })),
    ).start();
  };

  /** Zatřesení (senzor nebo tlačítko). Při hledání ho obnoví, ve dvojici se ignoruje. */
  const zatrest = () => {
    if (stav.faze === 'par' || stav.faze === 'nabidka') return;
    prejdiNa('zatres');
    animuj();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setChybaNabidky(null);
    if (jePripojeno && posliWs({ typ: 'zatreseni' })) {
      setStav({ faze: 'hledam' });
      return;
    }
    // bez serveru: simulovaný protějšek pro demo
    setStav({ faze: 'hledam' });
    if (offlineCasovac.current) clearTimeout(offlineCasovac.current);
    offlineCasovac.current = setTimeout(() => {
      const protejsek = uzivatel === 'jana' ? 'tomas' : 'jana';
      setStav({ faze: 'par', par: { id: OFFLINE_ID, protejsekJmeno: JMENA[protejsek] } });
    }, 1200);
  };

  useZatreseni(stav.faze !== 'par' && stav.faze !== 'nabidka', zatrest);

  const zrusHledani = () => {
    if (offlineCasovac.current) clearTimeout(offlineCasovac.current);
    posliWs({ typ: 'zatreseni_zrusit' });
    setStav({ faze: 'klid' });
  };

  const zrusPar = () => {
    if (stav.faze !== 'par' && stav.faze !== 'nabidka') return;
    if (offlineCasovac.current) clearTimeout(offlineCasovac.current);
    if (stav.par.id !== OFFLINE_ID) posliWs({ typ: 'zatreseni_zrusit_par', id: stav.par.id });
    setStav({ faze: 'klid' });
  };

  const poslat = () => {
    if (stav.faze !== 'par') return;
    const suma = Number(castka.replace(/\s/g, ''));
    if (!Number.isFinite(suma) || suma <= 0 || suma > LIMIT) {
      setChybaNabidky(`Zatřesením lze poslat 1 až ${LIMIT} Kč.`);
      return;
    }
    setChybaNabidky(null);
    if (stav.par.id === OFFLINE_ID) {
      const nabidka = { odJa: true, odJmeno: JMENA[uzivatel], komuJmeno: stav.par.protejsekJmeno, castka: suma };
      setStav({ faze: 'nabidka', par: stav.par, nabidka });
      // simulovaný protějšek platbu za chvíli přijme
      offlineCasovac.current = setTimeout(() => {
        fallbackPridejPohyb(uzivatel, `Zatřesení – ${nabidka.komuJmeno}`, -suma);
        obnovUcet();
        setStav({ faze: 'hotovo', prijato: false, text: `${kc(suma)} · ${nabidka.odJmeno} → ${nabidka.komuJmeno}` });
      }, 1500);
      return;
    }
    posliWs({ typ: 'zatreseni_nabidka', id: stav.par.id, castka: suma });
  };

  const odpovez = (odpoved: 'ano' | 'ne') => {
    if (stav.faze !== 'nabidka') return;
    posliWs({ typ: 'zatreseni_potvrzeni', id: stav.par.id, odpoved });
  };

  const posun = otres.interpolate({ inputRange: [-1, 1], outputRange: [-18, 18] });
  const veDvojici = stav.faze === 'par' || stav.faze === 'nabidka';

  const popis = (() => {
    switch (stav.faze) {
      case 'klid': return 'Přiložte telefony k sobě a zatřeste oběma ve stejnou chvíli.';
      case 'hledam': return 'Hledám telefon vedle vás… Můžete zatřást znovu.';
      case 'par': return `Spojeno: ${stav.par.protejsekJmeno}`;
      case 'nabidka': return stav.nabidka.odJa ? `Čekám, až ${stav.nabidka.komuJmeno} platbu přijme…` : `${stav.nabidka.odJmeno} vám posílá peníze.`;
      case 'hotovo': return stav.prijato ? 'Peníze dorazily na váš účet.' : 'Hotovo, peníze jsou odeslané.';
      case 'chyba': return stav.text;
    }
  })();

  return (
    <ScrollView contentContainerStyle={s.obal} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <GradientKarta
        barvy={stav.faze === 'chyba' ? gradienty.cervena : veDvojici ? gradienty.fialova : gradienty.indigo}
        style={{ width: sirkaKarty, minHeight: 420 }}
      >
        <Animated.View style={[s.ilustrace, { transform: [{ translateX: posun }] }]}>
          <IlustraceTelefony sirka={sirkaKarty - 70} />
        </Animated.View>
        <View style={s.cipy}>
          <Cip text="Bez IBANu" info />
          <Cip text={online ? (wsPripojeno ? 'Spojeno s bankou' : 'Připojuji…') : 'Bez sítě (demo)'} />
        </View>
        <View style={s.obsahKarty}>
          <Text style={s.velkyNadpis}>Zatřes</Text>
          <Text style={s.popis}>{popis}</Text>
          {stav.faze === 'hotovo' && (
            <View style={{ marginTop: 14 }}><Stitek text={stav.text} smer={stav.prijato ? 'nahoru' : undefined} /></View>
          )}
        </View>
      </GradientKarta>

      {stav.faze === 'par' && (
        <View style={s.karta}>
          <Text style={s.kartaTitulek}>POSLAT: {stav.par.protejsekJmeno.toUpperCase()}</Text>
          <View style={s.castkaRadek}>
            <TextInput style={s.castka} value={castka} onChangeText={setCastka} keyboardType="number-pad" maxLength={4} />
            <Text style={s.mena}>Kč</Text>
          </View>
          {chybaNabidky && <Text style={s.chyba}>{chybaNabidky}</Text>}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Tlacitko text={`Poslat ${castka || 0} Kč`} varianta="bile" onPress={poslat} />
            <Tlacitko text="Zrušit" varianta="tmave" style={s.maleTlacitko} onPress={zrusPar} />
          </View>
          <Text style={s.drobne}>Nebo počkejte, až vám peníze pošle druhá strana.</Text>
        </View>
      )}

      {stav.faze === 'nabidka' && (
        <View style={s.karta}>
          <Text style={s.kartaTitulek}>{stav.nabidka.odJa ? 'ODESLANÁ PLATBA' : 'PŘÍCHOZÍ PLATBA'}</Text>
          <View style={s.radek}><Text style={s.radekPopis}>Od</Text><Text style={s.radekHodnota}>{stav.nabidka.odJmeno}</Text></View>
          <View style={s.radek}><Text style={s.radekPopis}>Komu</Text><Text style={s.radekHodnota}>{stav.nabidka.komuJmeno}</Text></View>
          <View style={s.radek}><Text style={s.radekPopis}>Částka</Text><Stitek text={kc(stav.nabidka.castka)} /></View>
          {chybaNabidky && <Text style={s.chyba}>{chybaNabidky}</Text>}
          {stav.nabidka.odJa ? (
            <>
              <Text style={s.cekani}>Čekám na potvrzení druhé strany…</Text>
              <Tlacitko text="Zrušit" varianta="tmave" style={s.maleTlacitko} onPress={zrusPar} />
            </>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Tlacitko text="Přijmout" varianta="bile" onPress={() => odpovez('ano')} />
              <Tlacitko text="Odmítnout" varianta="tmave" style={s.maleTlacitko} onPress={() => odpovez('ne')} />
            </View>
          )}
        </View>
      )}

      {!veDvojici && (
        <>
          {stav.faze === 'hledam' ? (
            <Tlacitko text="Zrušit hledání" varianta="tmave" onPress={zrusHledani} style={{ alignSelf: 'stretch' }} />
          ) : (
            <Tlacitko text="Zatřást (tlačítko)" onPress={zatrest} style={{ alignSelf: 'stretch' }} />
          )}
          <Text style={s.poznamka}>
            Částku zadáte až po spojení. Max. {kc(LIMIT)}, peníze odejdou až po potvrzení obou stran.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  obal: { padding: 16, paddingTop: 18, alignItems: 'center', gap: 16 },
  ilustrace: { position: 'absolute', left: 0, right: 0, top: 40, alignItems: 'center' },
  cipy: { position: 'absolute', left: 20, top: 20, gap: 8 },
  obsahKarty: { flex: 1, alignItems: 'center', paddingTop: 280, paddingHorizontal: 22, paddingBottom: 24 },
  velkyNadpis: { color: '#fff', fontSize: 38, fontFamily: pismo.tucne, letterSpacing: -0.8 },
  popis: { color: '#fff', fontSize: 17, lineHeight: 23, fontFamily: pismo.polotucne, textAlign: 'center', marginTop: 10, maxWidth: 290 },
  castkaRadek: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8 },
  castka: { color: '#fff', fontSize: 52, fontFamily: pismo.tucne, minWidth: 130, textAlign: 'center', letterSpacing: -1 },
  mena: { color: barvy.textTlumeny, fontSize: 24, fontFamily: pismo.polotucne },
  poznamka: { color: '#9a9aa3', fontSize: 14, lineHeight: 20, fontFamily: pismo.polotucne, textAlign: 'center' },
  karta: { backgroundColor: barvy.karta, borderRadius: 24, padding: 18, gap: 12, alignSelf: 'stretch' },
  kartaTitulek: { color: barvy.textTlumeny, fontSize: 13, fontFamily: pismo.tucne, letterSpacing: 0.65 },
  radek: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  radekPopis: { color: barvy.textTlumeny, fontSize: 16, fontFamily: pismo.polotucne },
  radekHodnota: { color: '#fff', fontSize: 16, fontFamily: pismo.tucne },
  cekani: { color: barvy.textTlumeny, fontSize: 15, fontFamily: pismo.stredni },
  chyba: { color: barvy.cervena, fontSize: 14, fontFamily: pismo.polotucne },
  drobne: { color: barvy.textSlaby, fontSize: 13, fontFamily: pismo.stredni },
  maleTlacitko: { height: 44, paddingHorizontal: 20, borderRadius: 22 },
});
