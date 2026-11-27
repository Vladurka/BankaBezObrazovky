// George: chat + historie + hlas + potvrzování plateb (styl podle návrhu "asistent").
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Akce, api, OdpovedGeorge, Pending } from '../api';
import { fallbackAsk, fallbackConfirm } from '../fallback';
import { useHlas } from '../hooky/useHlas';
import {
  IkonaGraf, IkonaJiskra, IkonaKarta, IkonaMikrofon, IkonaMince, IkonaOdeslat, IkonaStit, IkonaStop, IkonaZarovka,
} from '../ikony';
import { Stitek, Tlacitko } from '../komponenty';
import { useApp } from '../kontext';
import { barvy, kc, pismo } from '../tema';

type Zprava = { id: string; kdo: 'klient' | 'george'; text: string; akce?: Akce[]; pendingId?: string };
type Scenar = { popisek: string; text: string; Ikona: React.ComponentType<{ velikost?: number }>; pozadi: string };

const SCENARE: Record<string, Scenar[]> = {
  jana: [
    { popisek: 'Zaplatit elektřinu', text: 'Zaplať elektřinu jako minule', Ikona: IkonaZarovka, pozadi: '#2e1d3d' },
    { popisek: 'Stav účtu', text: 'Kolik mám na účtu?', Ikona: IkonaGraf, pozadi: '#14332c' },
    { popisek: 'Volali mi z banky', text: 'Volali mi z banky, mám rychle převést peníze na bezpečný účet', Ikona: IkonaStit, pozadi: '#3a1f24' },
    { popisek: 'Ztracená karta', text: 'Ztratila jsem kartu', Ikona: IkonaKarta, pozadi: '#1e2f4d' },
  ],
  tomas: [
    { popisek: 'Poslat babičce', text: 'Pošli babičce 300 korun', Ikona: IkonaMince, pozadi: '#14332c' },
    { popisek: 'Stav účtu', text: 'Kolik mám na účtu?', Ikona: IkonaGraf, pozadi: '#1e2f4d' },
    { popisek: 'Koupit akcie?', text: 'Mám koupit akcie Nvidie?', Ikona: IkonaZarovka, pozadi: '#2e1d3d' },
  ],
};

export default function George() {
  const { uzivatel, sessionId, online, wsPripojeno, ucet, obnovUcet } = useApp();
  const hlas = useHlas();
  const [zpravy, setZpravy] = useState<Zprava[]>([
    { id: 'uvod', kdo: 'george', text: 'Dobrý den, tady George. S čím vám dnes pomůžu?' },
  ]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [vstup, setVstup] = useState('');
  const [pracuji, setPracuji] = useState(false);
  const posuvnik = useRef<ScrollViewInstance>(null);

  const pridej = (z: Omit<Zprava, 'id'>) =>
    setZpravy((p) => [...p, { ...z, id: `${Date.now()}-${Math.random()}` }]);

  const zpracujOdpoved = (o: OdpovedGeorge) => {
    pridej({ kdo: 'george', text: o.reply, akce: o.actions, pendingId: o.pending?.pending_id });
    setPending(o.pending);
    hlas.mluv(o.speak);
    if (o.actions.some((a) => a.typ === 'vishing_pozastaveno')) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
    if (o.actions.some((a) => a.typ === 'platba_provedena')) obnovUcet();
  };

  const posli = async (text: string) => {
    const t = text.trim();
    if (!t || pracuji) return;
    setVstup('');
    pridej({ kdo: 'klient', text: t });
    setPracuji(true);
    try {
      zpracujOdpoved(online ? await api.ask(uzivatel, sessionId, t) : fallbackAsk(uzivatel, t));
    } catch {
      zpracujOdpoved(fallbackAsk(uzivatel, t));
    } finally {
      setPracuji(false);
    }
  };

  const potvrd = async (odpoved: 'ano' | 'ne') => {
    if (!pending || pracuji) return;
    const p = pending;
    setPending(null);
    pridej({ kdo: 'klient', text: odpoved === 'ano' ? 'Ano, pošli to.' : 'Ne, nechci.' });
    setPracuji(true);
    try {
      zpracujOdpoved(online ? await api.confirm(uzivatel, sessionId, p.pending_id, odpoved) : fallbackConfirm(uzivatel, p.pending_id, odpoved));
    } catch {
      zpracujOdpoved(fallbackConfirm(uzivatel, p.pending_id, odpoved));
    } finally {
      setPracuji(false);
    }
  };

  const mikrofon = async () => {
    if (hlas.nahravam) {
      const vysledek = await hlas.ukonci();
      if (vysledek.text) posli(vysledek.text);
      else pridej({ kdo: 'george', text: `Nerozuměl jsem. Zkuste to prosím znovu, nebo napište. (${vysledek.chyba})` });
      return;
    }
    if (!online) {
      pridej({ kdo: 'george', text: 'Bez spojení s bankou hlas nepřevedu na text. Klepněte na kartu nahoře nebo napište.' });
      return;
    }
    const ok = await hlas.zacni().catch(() => false);
    if (!ok) pridej({ kdo: 'george', text: 'Potřebuji přístup k mikrofonu.' });
  };

  const krestni = ucet.jmeno.split(' ')[0];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={posuvnik}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 12 }}
        onContentSizeChange={() => posuvnik.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={s.nadpis}>Váš George</Text>
          <Text style={s.podnadpis}>
            {krestni}, zeptejte se na účet, platbu nebo kartu. Stačí mluvit.
          </Text>
          <Text style={s.stav}>
            {online ? (wsPripojeno ? '● Spojeno s bankou' : '○ Připojuji…') : '○ Režim bez sítě (demo)'} · {kc(ucet.zustatek)}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scenare}>
          {(SCENARE[uzivatel] ?? []).map(({ popisek, text, Ikona, pozadi }) => (
            <Pressable key={popisek} style={({ pressed }) => [s.scenar, pressed && { opacity: 0.8 }]} onPress={() => posli(text)}>
              <View style={[s.scenarKruh, { backgroundColor: pozadi }]}><Ikona /></View>
              <Text style={s.scenarText}>{popisek}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={s.sekce}>Konverzace</Text>
        <View style={{ gap: 12, paddingHorizontal: 16 }}>
          {zpravy.map((z) => (
            <Bublina key={z.id} zprava={z} cekaNaPotvrzeni={!!pending && z.pendingId === pending.pending_id} potvrd={potvrd} />
          ))}
          {(pracuji || hlas.prevadim) && <Pise />}
        </View>
      </ScrollView>

      <View style={s.vstupObal}>
        <View style={s.vstupRadek}>
          <TextInput
            style={s.vstup}
            value={vstup}
            onChangeText={setVstup}
            placeholder={hlas.nahravam ? 'Poslouchám…' : 'Zeptejte se Georga'}
            placeholderTextColor={barvy.textSlaby}
            onSubmitEditing={() => posli(vstup)}
            returnKeyType="send"
            maxLength={500}
          />
          {vstup.trim() ? (
            <Pressable style={s.kulate} onPress={() => posli(vstup)} accessibilityLabel="Odeslat">
              <IkonaOdeslat />
            </Pressable>
          ) : (
            <Pressable
              style={[s.kulate, hlas.nahravam && { backgroundColor: barvy.cervena }]}
              onPress={mikrofon}
              accessibilityLabel={hlas.nahravam ? 'Ukončit nahrávání' : 'Mluvit'}
            >
              {hlas.prevadim ? <ActivityIndicator color="#fff" /> : hlas.nahravam ? <IkonaStop /> : <IkonaMikrofon />}
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function Avatar() {
  return (
    <View style={s.avatar}><IkonaJiskra /></View>
  );
}

function Pise() {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      <Avatar />
      <View style={s.pise}>
        {['#b4b4bd', '#7c7c86', '#4a4a53'].map((c) => <View key={c} style={[s.piseTecka, { backgroundColor: c }]} />)}
      </View>
    </View>
  );
}

function Bublina({ zprava, cekaNaPotvrzeni, potvrd }: { zprava: Zprava; cekaNaPotvrzeni: boolean; potvrd: (o: 'ano' | 'ne') => void }) {
  const klient = zprava.kdo === 'klient';
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', justifyContent: klient ? 'flex-end' : 'flex-start' }}>
      {!klient && <Avatar />}
      <View style={{ maxWidth: '82%', gap: 10 }}>
        <View style={[s.bublina, klient ? s.bublinaKlient : s.bublinaGeorge]}>
          <Text style={s.bublinaText}>{zprava.text}</Text>
        </View>
        {!klient && zprava.akce?.map((a, i) => (
          <KartaAkce key={i} akce={a} cekaNaPotvrzeni={cekaNaPotvrzeni} potvrd={potvrd} />
        ))}
      </View>
    </View>
  );
}

/** Karta pod odpovědí Georga podle typu akce z backendu. */
function KartaAkce({ akce, cekaNaPotvrzeni, potvrd }: { akce: Akce; cekaNaPotvrzeni: boolean; potvrd: (o: 'ano' | 'ne') => void }) {
  switch (akce.typ) {
    case 'platba_k_potvrzeni':
      return (
        <Karta titulek="PLATBA K POTVRZENÍ">
          <Radek popis="Příjemce" hodnota={akce.prijemce} />
          <Radek popis="Částka" hodnota={kc(akce.castka)} />
          {akce.lhuta_24h && <Radek popis="Lhůta" hodnota="24 h" />}
          {cekaNaPotvrzeni ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Tlacitko text="Ano, poslat" varianta="bile" onPress={() => potvrd('ano')} />
              <Tlacitko text="Ne" varianta="tmave" style={{ height: 44, paddingHorizontal: 20, borderRadius: 22 }} onPress={() => potvrd('ne')} />
            </View>
          ) : null}
        </Karta>
      );
    case 'prodej_k_potvrzeni':
      return (
        <Karta titulek="PRODEJ PORTFOLIA">
          <Radek popis="Lhůta na rozmyšlenou" hodnota="24 h" />
          {cekaNaPotvrzeni && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Tlacitko text="Naplánovat" varianta="bile" onPress={() => potvrd('ano')} />
              <Tlacitko text="Ne" varianta="tmave" style={{ height: 44, paddingHorizontal: 20, borderRadius: 22 }} onPress={() => potvrd('ne')} />
            </View>
          )}
        </Karta>
      );
    case 'platba_provedena':
      return (
        <Karta titulek="ODESLÁNO">
          <Radek popis={akce.prijemce} hodnota={`−${kc(akce.castka)}`} />
          {akce.zustatek !== undefined && <Radek popis="Zůstatek" hodnota={kc(akce.zustatek)} />}
        </Karta>
      );
    case 'vishing_pozastaveno':
      return (
        <Karta titulek="PLATBA POZASTAVENA" varovani>
          <Text style={s.kartaPopis}>Vypadá to na telefonní podvod. Banka vás nikdy nežádá o převod na „bezpečný účet".</Text>
        </Karta>
      );
    case 'strazce_upozornen':
      return (
        <Karta titulek="STRÁŽCE">
          <Radek popis={akce.strazce} hodnota="upozorněn" />
        </Karta>
      );
    case 'zustatek':
      return (
        <Karta titulek="POSLEDNÍ POHYBY">
          {(akce.pohyby ?? []).slice(0, 3).map((p: any, i: number) => (
            <Radek key={i} popis={p.popis} hodnota={`${p.castka < 0 ? '−' : '+'}${kc(p.castka)}`} zaporne={p.castka < 0} />
          ))}
        </Karta>
      );
    case 'platba_zamitnuta':
      return (
        <Karta titulek="PLATBA NEPROVEDENA" varovani>
          <Text style={s.kartaPopis}>{akce.duvod ?? 'Hlasem posílám jen známým příjemcům a do denního limitu.'}</Text>
        </Karta>
      );
    case 'karta_zablokovana':
      return (
        <Karta titulek="KARTA">
          <Radek popis="Platební karta" hodnota="zablokována" zaporne />
        </Karta>
      );
    case 'poradce':
      return (
        <Karta titulek="PORADCE">
          <Radek popis="Ozve se do" hodnota="15 min" />
        </Karta>
      );
    default:
      return null;
  }
}

function Karta({ titulek, varovani, children }: { titulek: string; varovani?: boolean; children: React.ReactNode }) {
  return (
    <View style={[s.karta, varovani && s.kartaVarovani]}>
      <Text style={[s.kartaTitulek, varovani && { color: barvy.cervena }]}>{titulek}</Text>
      {children}
    </View>
  );
}

function Radek({ popis, hodnota, zaporne }: { popis: string; hodnota: string; zaporne?: boolean }) {
  return (
    <View style={s.radek}>
      <Text style={s.radekPopis} numberOfLines={1}>{popis}</Text>
      <Stitek text={hodnota} cervena={zaporne} />
    </View>
  );
}

const s = StyleSheet.create({
  nadpis: { color: '#fff', fontSize: 34, lineHeight: 38, fontFamily: pismo.tucne, letterSpacing: -0.7 },
  podnadpis: { color: '#fff', fontSize: 17, lineHeight: 23, fontFamily: pismo.polotucne, marginTop: 12, maxWidth: 300 },
  stav: { color: barvy.textSlaby, fontSize: 13, fontFamily: pismo.stredni, marginTop: 8 },
  scenare: { gap: 12, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6 },
  scenar: { width: 128, height: 148, borderRadius: 24, backgroundColor: barvy.karta, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 12 },
  scenarKruh: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  scenarText: { color: '#fff', fontSize: 15, lineHeight: 18, fontFamily: pismo.tucne, textAlign: 'center' },
  sekce: { color: '#fff', fontSize: 22, fontFamily: pismo.tucne, marginHorizontal: 20, marginTop: 22, marginBottom: 14 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: barvy.avatar, alignItems: 'center', justifyContent: 'center' },
  bublina: { paddingVertical: 13, paddingHorizontal: 16 },
  bublinaKlient: { backgroundColor: barvy.modraBublina, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 6 },
  bublinaGeorge: { backgroundColor: barvy.karta, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 6 },
  bublinaText: { color: '#fff', fontSize: 16, lineHeight: 23, fontFamily: pismo.normal },
  pise: { backgroundColor: barvy.karta, borderRadius: 20, paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', gap: 5 },
  piseTecka: { width: 8, height: 8, borderRadius: 4 },
  karta: { backgroundColor: barvy.karta, borderRadius: 24, padding: 18, gap: 12 },
  kartaVarovani: { backgroundColor: barvy.cervenaPozadi, borderWidth: 1, borderColor: 'rgba(255,107,107,.45)' },
  kartaTitulek: { color: barvy.textTlumeny, fontSize: 13, fontFamily: pismo.tucne, letterSpacing: 0.65 },
  kartaPopis: { color: '#fff', fontSize: 15, lineHeight: 21, fontFamily: pismo.stredni },
  radek: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  radekPopis: { color: '#fff', fontSize: 16, fontFamily: pismo.polotucne, flexShrink: 1 },
  vstupObal: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  vstupRadek: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: barvy.karta, borderWidth: 1,
    borderColor: barvy.okraj, borderRadius: 28, paddingVertical: 5, paddingRight: 5, paddingLeft: 18,
  },
  vstup: { flex: 1, height: 44, color: '#fff', fontSize: 16, fontFamily: pismo.normal },
  kulate: { width: 44, height: 44, borderRadius: 22, backgroundColor: barvy.modra, alignItems: 'center', justifyContent: 'center' },
});
