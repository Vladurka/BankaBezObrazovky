// Hlas: nahrávání (expo-audio) -> převod na text na backendu, a čtení odpovědí (expo-speech, cs-CZ).
import { useCallback, useState } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import { api } from '../api';

export function useHlas() {
  const nahravac = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [nahravam, setNahravam] = useState(false);
  const [prevadim, setPrevadim] = useState(false);

  const mluv = useCallback((text: string) => {
    if (!text) return;
    Speech.stop();
    Speech.speak(text, { language: 'cs-CZ', rate: 1.0 });
  }, []);

  const zacni = useCallback(async (): Promise<boolean> => {
    const opravneni = await requestRecordingPermissionsAsync();
    if (!opravneni.granted) return false;
    Speech.stop();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await nahravac.prepareToRecordAsync();
    nahravac.record();
    setNahravam(true);
    return true;
  }, [nahravac]);

  /** Ukončí nahrávání a vrátí rozpoznaný text, nebo popis chyby (pro ladění na místě). */
  const ukonci = useCallback(async (): Promise<{ text?: string; chyba?: string }> => {
    setNahravam(false);
    let krok = 'zastavení nahrávání';
    try {
      const delkaMs = nahravac.getStatus().durationMillis;
      await nahravac.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const surovaUri = nahravac.uri ?? nahravac.getStatus().url;
      if (!surovaUri) return { chyba: 'nahrávka nemá soubor' };
      if (delkaMs > 0 && delkaMs < 500) return { chyba: 'nahrávka je příliš krátká' };
      // iOS někdy vrací cestu bez "file://", se kterou upload přes FormData selže
      const uri = surovaUri.includes('://') ? surovaUri : `file://${surovaUri}`;
      setPrevadim(true);
      krok = 'převod řeči na serveru';
      const text = (await api.stt(uri)).trim();
      return text ? { text } : { chyba: 'server nic nerozpoznal' };
    } catch (e) {
      const zprava = e instanceof Error ? e.message : String(e);
      console.warn(`Hlas selhal (${krok}):`, zprava);
      return { chyba: `${krok}: ${zprava}` };
    } finally {
      setPrevadim(false);
    }
  }, [nahravac]);

  return { nahravam, prevadim, zacni, ukonci, mluv };
}
