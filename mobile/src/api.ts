// Klient pro FastAPI backend. Když backend neodpovídá, volající použije fallback.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KLIC_URL = 'banka.apiUrl';
/** Verze protokolu; musí odpovídat VERZE_PROTOKOLU v backend/main.py. */
export const VERZE_PROTOKOLU = 2;
let apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.10:8000';

export type Akce = { typ: string; [klic: string]: any };
export type Pending = { pending_id: string; druh: string; prijemce?: string; castka?: number; lhuta_24h?: boolean };
export type OdpovedGeorge = { reply: string; speak: string; actions: Akce[]; pending: Pending | null };
export type Pohyb = { datum: string; cas?: string; popis: string; castka: number; prijemce: string | null };
export type Portfolio = { celkem: number; zeme: Record<string, number>; odvetvi: Record<string, number>; pravidla: string[] };
export type Ucet = {
  id: string;
  jmeno: string;
  ucet: string;
  zustatek: number;
  pohyby: Pohyb[];
  kontakty: { id: string; nazev: string }[];
  strazce: string | null;
  portfolio: Portfolio;
  upozorneni: Akce[];
};

export async function nactiUlozenouUrl(): Promise<string> {
  try {
    const ulozena = await AsyncStorage.getItem(KLIC_URL);
    if (ulozena) apiUrl = ulozena;
  } catch {
    // úložiště není k dispozici, zůstává výchozí adresa
  }
  return apiUrl;
}

export async function nastavUrl(url: string): Promise<void> {
  apiUrl = url.trim().replace(/\/+$/, '');
  try {
    await AsyncStorage.setItem(KLIC_URL, apiUrl);
  } catch {
    // není kritické
  }
}

export const aktualniUrl = () => apiUrl;

async function pozadavek<T>(cesta: string, init?: RequestInit, timeoutMs = 25000): Promise<T> {
  const ovladac = new AbortController();
  const casovac = setTimeout(() => ovladac.abort(), timeoutMs);
  try {
    const r = await fetch(`${apiUrl}${cesta}`, { ...init, signal: ovladac.signal });
    if (!r.ok) {
      // detail chyby z FastAPI pomáhá při ladění (neobsahuje tajnosti)
      const detail = await r.json().then((j) => j?.detail).catch(() => null);
      throw new Error(`Backend vrátil ${r.status}${detail ? ` – ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
    }
    return (await r.json()) as T;
  } finally {
    clearTimeout(casovac);
  }
}

const json = (telo: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(telo),
});

export const api = {
  zdravi: () => pozadavek<{ stav: string; llm: boolean; verze?: number }>('/', undefined, 4000),
  ucet: (uzivatel: string) => pozadavek<Ucet>(`/ucet/${uzivatel}`),
  ask: (uzivatel: string, session_id: string, text: string) =>
    pozadavek<OdpovedGeorge>('/ask', json({ uzivatel, session_id, text })),
  confirm: (uzivatel: string, session_id: string, pending_id: string, answer: 'ano' | 'ne') =>
    pozadavek<OdpovedGeorge>('/confirm', json({ uzivatel, session_id, pending_id, answer })),
  pulse: (uzivatel: string, typ: 'konflikt' | 'propad') =>
    pozadavek<{ reply: string; speak: string; actions: Akce[] }>('/pulse/udalost', json({ uzivatel, typ })),
  reset: () => pozadavek<{ stav: string }>('/reset', { method: 'POST' }),
  stt: (uri: string): Promise<string> => nahrajZvuk(uri),
};

/**
 * Nahraje zvukový soubor na /stt.
 * Používá XMLHttpRequest, protože fetch z Expo (SDK 58) nepodporuje soubor ve FormData
 * ve tvaru { uri, name, type } ("Unsupported FormDataPart implementation"),
 * kdežto nativní síťová vrstva React Native ano.
 */
function nahrajZvuk(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = new FormData();
    data.append('soubor', { uri, name: 'nahravka.m4a', type: 'audio/m4a' } as any);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${apiUrl}/stt`);
    xhr.timeout = 30000;
    xhr.onload = () => {
      let telo: any = null;
      try {
        telo = JSON.parse(xhr.responseText);
      } catch {
        // odpověď není JSON
      }
      if (xhr.status >= 200 && xhr.status < 300 && typeof telo?.text === 'string') resolve(telo.text);
      else reject(new Error(`Backend vrátil ${xhr.status}${telo?.detail ? ` – ${telo.detail}` : ''}`));
    };
    xhr.onerror = () => reject(new Error('síťová chyba při nahrávání'));
    xhr.ontimeout = () => reject(new Error('vypršel čas při nahrávání'));
    xhr.send(data);
  });
}

/** WebSocket se samočinným obnovením spojení. */
export class Spojeni {
  private ws: WebSocket | null = null;
  private konec = false;
  private casovac: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private uzivatel: string,
    private priZprave: (zprava: Akce) => void,
    private priStavu: (pripojeno: boolean) => void,
  ) {
    this.pripoj();
  }

  private pripoj() {
    if (this.konec) return;
    const url = `${apiUrl.replace(/^http/, 'ws')}/ws/${this.uzivatel}?verze=${VERZE_PROTOKOLU}`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => this.priStavu(true);
    ws.onmessage = (e) => {
      try {
        this.priZprave(JSON.parse(String(e.data)));
      } catch {
        // neplatná zpráva se ignoruje
      }
    };
    ws.onclose = () => {
      this.priStavu(false);
      if (!this.konec) this.casovac = setTimeout(() => this.pripoj(), 3000);
    };
    ws.onerror = () => ws.close();
  }

  posli(zprava: Record<string, unknown>): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(zprava));
      return true;
    }
    return false;
  }

  zavri() {
    this.konec = true;
    if (this.casovac) clearTimeout(this.casovac);
    this.ws?.close();
  }
}
