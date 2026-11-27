// Společný stav aplikace: přihlášený uživatel, účet, WebSocket, aktivní záložka a upozornění.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Akce, api, Spojeni, Ucet, VERZE_PROTOKOLU } from './api';
import { fallbackUcet } from './fallback';

type Posluchac = (zprava: Akce) => void;
export type Zalozka = 'george' | 'zatres' | 'pulse' | 'ucet';

type AppStav = {
  uzivatel: string;
  sessionId: string;
  online: boolean;
  wsPripojeno: boolean;
  ucet: Ucet;
  obnovUcet: () => Promise<void>;
  posliWs: (zprava: Record<string, unknown>) => boolean;
  odebirej: (p: Posluchac) => () => void;
  banner: Akce | null;
  zavriBanner: () => void;
  zalozka: Zalozka;
  verzeServeru: number | null;
  varovaniVerze: string | null;
  prejdiNa: (z: Zalozka) => void;
  odhlasit: () => void;
};

const Kontext = createContext<AppStav | null>(null);

export function useApp(): AppStav {
  const k = useContext(Kontext);
  if (!k) throw new Error('useApp musí být uvnitř AppProvider');
  return k;
}

export function AppProvider(props: { uzivatel: string; online: boolean; odhlasit: () => void; children: React.ReactNode }) {
  const { uzivatel } = props;
  const sessionId = useMemo(() => `${uzivatel}-${Date.now().toString(36)}`, [uzivatel]);
  const [online, setOnline] = useState(props.online);
  const [ucet, setUcet] = useState<Ucet>(() => fallbackUcet(uzivatel));
  const [wsPripojeno, setWsPripojeno] = useState(false);
  const [banner, setBanner] = useState<Akce | null>(null);
  const [zalozka, setZalozka] = useState<Zalozka>('george');
  const [verzeServeru, setVerzeServeru] = useState<number | null>(null);
  const [varovaniVerze, setVarovaniVerze] = useState<string | null>(null);

  // aplikace a server musí mít stejnou verzi protokolu, jinak zatřesení nefunguje správně
  const zkontrolujVerzi = useCallback((verze: number | undefined) => {
    setVerzeServeru(verze ?? null);
    if (verze === VERZE_PROTOKOLU) setVarovaniVerze(null);
    else if (verze === undefined || verze < VERZE_PROTOKOLU)
      setVarovaniVerze('Server běží na staré verzi. Restartujte backend (Ctrl+C a znovu spustit).');
    else setVarovaniVerze('Aplikace v telefonu je zastaralá. Znovu ji načtěte (v terminálu Expo stiskněte r).');
  }, []);

  useEffect(() => {
    if (online) api.zdravi().then((z) => zkontrolujVerzi(z.verze)).catch(() => {});
  }, [online, zkontrolujVerzi]);
  const posluchaci = useRef(new Set<Posluchac>());
  const spojeni = useRef<Spojeni | null>(null);

  const obnovUcet = useCallback(async () => {
    if (!online) {
      setUcet({ ...fallbackUcet(uzivatel) });
      return;
    }
    try {
      setUcet(await api.ucet(uzivatel));
    } catch {
      setUcet({ ...fallbackUcet(uzivatel) });
    }
  }, [online, uzivatel]);

  useEffect(() => {
    obnovUcet();
  }, [obnovUcet]);

  // bez spojení každých 5 s zkusit backend znovu a samo se přepnout do online režimu
  useEffect(() => {
    if (online) return;
    const t = setInterval(() => {
      api.zdravi().then((z) => z.stav === 'ok' && setOnline(true)).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [online]);

  useEffect(() => {
    if (!online) return;
    const s = new Spojeni(
      uzivatel,
      (zprava) => {
        // živé události z backendu: Strážce, příchozí platba, dokončené zatřesení
        if (zprava.typ === 'strazce' || zprava.typ === 'prichozi_platba') {
          setBanner(zprava);
          Haptics.notificationAsync(
            zprava.typ === 'strazce' ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
          obnovUcet();
        }
        if (zprava.typ === 'zatreseni_hotovo') obnovUcet();
        if (zprava.typ === 'verze') zkontrolujVerzi(zprava.verze);
        if (zprava.typ === 'zastarala_aplikace') zkontrolujVerzi(zprava.verze_serveru);
        posluchaci.current.forEach((p) => p(zprava));
      },
      setWsPripojeno,
    );
    spojeni.current = s;
    return () => s.zavri();
  }, [online, uzivatel, obnovUcet, zkontrolujVerzi]);

  const posliWs = useCallback((z: Record<string, unknown>) => spojeni.current?.posli(z) ?? false, []);
  const odebirej = useCallback((p: Posluchac) => {
    posluchaci.current.add(p);
    return () => {
      posluchaci.current.delete(p);
    };
  }, []);

  const hodnota: AppStav = {
    uzivatel,
    sessionId,
    online,
    wsPripojeno,
    ucet,
    obnovUcet,
    posliWs,
    odebirej,
    banner,
    zavriBanner: () => setBanner(null),
    zalozka,
    prejdiNa: setZalozka,
    verzeServeru,
    varovaniVerze,
    odhlasit: props.odhlasit,
  };

  return <Kontext.Provider value={hodnota}>{props.children}</Kontext.Provider>;
}
