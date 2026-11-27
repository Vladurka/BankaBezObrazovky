// Barvy, písmo a pomocné formátování podle designu (tmavý styl, Inter, modrá #2b7de9).
export const barvy = {
  pozadi: '#17171c',
  karta: '#26262d',
  kartaSvetla: '#2f2f37',
  navigace: '#222229',
  navigaceAktivni: '#0f0f13',
  text: '#ffffff',
  textTlumeny: '#b4b4bd',
  textSlaby: '#8e8e98',
  modra: '#2b7de9',
  modraBublina: '#2b6fd6',
  modraAkcent: '#5aa2ff',
  avatar: '#1e2f4d',
  zelena: '#5ee38a',
  zelenaPozadi: '#0d3d1c',
  cervena: '#ff6b6b',
  cervenaPozadi: '#3a1f24',
  oranzova: '#ffd23f',
  fialova: '#c35bd0',
  okraj: 'rgba(255,255,255,0.08)',
  okrajSilny: 'rgba(255,255,255,0.12)',
};

/** Gradienty velkých karet (karusel, Pulse, Zatřes). */
export const gradienty = {
  indigo: ['#3a3c92', '#26286a'],
  tyrkys: ['#13607a', '#0c3746'],
  fialova: ['#5d2f80', '#311a4a'],
  cervena: ['#8a2a35', '#3d1218'],
} as const;

/** Řezy písma Inter (v React Native se řez volí přes fontFamily, ne fontWeight). */
export const pismo = {
  normal: 'Inter_400Regular',
  stredni: 'Inter_500Medium',
  polotucne: 'Inter_600SemiBold',
  tucne: 'Inter_700Bold',
};

/** Částka v Kč s mezerami mezi tisíci (nezávisle na Intl). */
export const kc = (castka: number) =>
  `${Math.round(Math.abs(castka)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Kč`;
