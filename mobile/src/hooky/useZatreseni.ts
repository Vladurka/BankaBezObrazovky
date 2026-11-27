// Detekce zatřesení telefonem přes akcelerometr (expo-sensors).
import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';

const PRAH_G = 2.2;          // síla zrychlení, od které se pohyb bere jako zatřesení
const POTREBNE_SPICKY = 3;   // kolik špiček musí přijít v okně
const OKNO_MS = 800;
const PRODLEVA_MS = 2500;    // po zatřesení chvíli nereagovat

export function useZatreseni(aktivni: boolean, priZatreseni: () => void) {
  const spicky = useRef<number[]>([]);
  const posledni = useRef(0);
  const callback = useRef(priZatreseni);
  callback.current = priZatreseni;

  useEffect(() => {
    if (!aktivni) return;
    Accelerometer.setUpdateInterval(50);
    const odber = Accelerometer.addListener(({ x, y, z }) => {
      const sila = Math.sqrt(x * x + y * y + z * z);
      const ted = Date.now();
      if (sila < PRAH_G || ted - posledni.current < PRODLEVA_MS) return;
      spicky.current = [...spicky.current.filter((t) => ted - t < OKNO_MS), ted];
      if (spicky.current.length >= POTREBNE_SPICKY) {
        spicky.current = [];
        posledni.current = ted;
        callback.current();
      }
    });
    return () => odber.remove();
  }, [aktivni]);
}
