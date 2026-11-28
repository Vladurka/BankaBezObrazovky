// SVG ikony a 3D ilustrace převzaté z návrhu designu (react-native-svg).
import React from 'react';
import Svg, {
  Circle, Defs, Ellipse, G, Line, LinearGradient, Mask, Path, Polygon, Polyline, RadialGradient, Rect, Stop,
} from 'react-native-svg';

type P = { velikost?: number; barva?: string };

// ---- malé 3D ikony do karet scénářů (44 × 44) -------------------------------

export function IkonaSpendlik({ velikost = 44 }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 44 44">
      <Defs>
        <RadialGradient id="ip" cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#fff4cf" /><Stop offset="0.45" stopColor="#e9b54a" /><Stop offset="1" stopColor="#8a5510" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="22" cy="40" rx="8" ry="2.5" fill="rgba(0,0,0,.45)" />
      <Path d="M22 39 C16 30,9 24,9 16 A13 13 0 1 1 35 16 C35 24,28 30,22 39Z" fill="url(#ip)" />
      <Circle cx="22" cy="16" r="5" fill="#fff6dc" />
      <Ellipse cx="16" cy="10" rx="3" ry="5" transform="rotate(35 16 10)" fill="#fff" opacity={0.5} />
    </Svg>
  );
}

export function IkonaGraf({ velikost = 44 }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 44 44">
      <Defs>
        <LinearGradient id="ib" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#f6d27e" /><Stop offset="1" stopColor="#a86d14" />
        </LinearGradient>
      </Defs>
      <Rect x="6" y="26" width="8" height="14" rx="2" fill="url(#ib)" />
      <Rect x="18" y="18" width="8" height="22" rx="2" fill="url(#ib)" />
      <Rect x="30" y="8" width="8" height="32" rx="2" fill="url(#ib)" />
      <Rect x="6" y="26" width="3" height="14" rx="1.5" fill="#fff" opacity={0.35} />
      <Rect x="18" y="18" width="3" height="22" rx="1.5" fill="#fff" opacity={0.35} />
      <Rect x="30" y="8" width="3" height="32" rx="1.5" fill="#fff" opacity={0.35} />
    </Svg>
  );
}

export function IkonaZarovka({ velikost = 44 }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 44 44">
      <Defs>
        <RadialGradient id="ic" cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#fffbea" /><Stop offset="0.45" stopColor="#fcd34d" /><Stop offset="1" stopColor="#b45309" />
        </RadialGradient>
      </Defs>
      <Circle cx="22" cy="17" r="13" fill="url(#ic)" />
      <Path d="M15 26 L29 26 L27 32 L17 32Z" fill="url(#ic)" />
      <Rect x="16" y="32" width="12" height="3.5" rx="1.75" fill="#d7d9de" />
      <Rect x="16" y="36.5" width="12" height="3.5" rx="1.75" fill="#9aa0aa" />
      <Ellipse cx="17" cy="12" rx="3" ry="5" transform="rotate(35 17 12)" fill="#fff" opacity={0.55} />
    </Svg>
  );
}

export function IkonaStit({ velikost = 44 }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 44 44">
      <Defs>
        <RadialGradient id="is" cx="0.35" cy="0.3" r="0.85">
          <Stop offset="0" stopColor="#ffe1e1" /><Stop offset="0.45" stopColor="#ff7a7a" /><Stop offset="1" stopColor="#8a1c26" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="22" cy="41" rx="9" ry="2.2" fill="rgba(0,0,0,.45)" />
      <Path d="M22 4 L36 9 V20 C36 29,30 35,22 39 C14 35,8 29,8 20 V9Z" fill="url(#is)" />
      <Path d="M16 21 L20.5 25.5 L28.5 16.5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <Ellipse cx="15" cy="12" rx="3" ry="5" transform="rotate(35 15 12)" fill="#fff" opacity={0.5} />
    </Svg>
  );
}

export function IkonaKarta({ velikost = 44 }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 44 44">
      <Defs>
        <LinearGradient id="ik" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#bfe0ff" /><Stop offset="1" stopColor="#2b6fd6" />
        </LinearGradient>
      </Defs>
      <Ellipse cx="22" cy="38" rx="14" ry="2.5" fill="rgba(0,0,0,.45)" />
      <Rect x="5" y="11" width="34" height="23" rx="4" fill="url(#ik)" />
      <Rect x="5" y="16" width="34" height="5" fill="#1b3f7a" />
      <Rect x="10" y="26" width="10" height="3" rx="1.5" fill="#fff" opacity={0.8} />
      <Rect x="7" y="12.5" width="18" height="2" rx="1" fill="#fff" opacity={0.45} />
    </Svg>
  );
}

export function IkonaMince({ velikost = 44 }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 44 44">
      <Defs>
        <RadialGradient id="im" cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#e6ffef" /><Stop offset="0.45" stopColor="#5ee38a" /><Stop offset="1" stopColor="#14713a" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="22" cy="40" rx="10" ry="2.5" fill="rgba(0,0,0,.45)" />
      <Circle cx="22" cy="21" r="16" fill="url(#im)" />
      <Circle cx="22" cy="21" r="11" fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth="2" />
      <Path d="M22 14 V28 M18 18 H25 A3 3 0 0 1 25 24 H18" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <Ellipse cx="15" cy="13" rx="3" ry="5" transform="rotate(35 15 13)" fill="#fff" opacity={0.5} />
    </Svg>
  );
}

// ---- jednobarevné ikony (navigace, avatar, ovládání) ------------------------

export function IkonaJiskra({ velikost = 18, barva = '#5aa2ff' }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 24 24" fill={barva}>
      <Path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" />
      <Path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </Svg>
  );
}

const obrys = (barva: string) => ({ fill: 'none', stroke: barva, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export function IkonaAsistent({ velikost = 24, barva = '#fff' }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 24 24" {...obrys(barva)}>
      <Path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" />
    </Svg>
  );
}

export function IkonaZatres({ velikost = 24, barva = '#fff' }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 24 24" {...obrys(barva)}>
      <Rect x="3" y="5" width="7" height="13" rx="1.5" transform="rotate(-10 6.5 11.5)" />
      <Rect x="14" y="5" width="7" height="13" rx="1.5" transform="rotate(10 17.5 11.5)" />
      <Path d="M11 3.5l1 -1.5 1 1.5" />
    </Svg>
  );
}

export function IkonaPulse({ velikost = 24, barva = '#fff' }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 24 24" {...obrys(barva)}>
      <Path d="M3 17l5-6 4 4 7-9" />
    </Svg>
  );
}

export function IkonaSit({ velikost = 24, barva = '#fff' }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 24 24" {...obrys(barva)}>
      <Circle cx="12" cy="12" r="3" /><Circle cx="5" cy="6" r="2" /><Circle cx="19" cy="6" r="2" /><Circle cx="12" cy="20" r="2" />
      <Path d="M6.5 7.5l3.5 3M17.5 7.5L14 10.5M12 15v3" />
    </Svg>
  );
}

export function IkonaUcet({ velikost = 24, barva = '#fff' }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 24 24" {...obrys(barva)}>
      <Path d="M4 11l8-7 8 7v9H4z" />
    </Svg>
  );
}

export function IkonaOdeslat({ velikost = 20, barva = '#fff' }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 24 24" {...obrys(barva)} strokeWidth={2.4}>
      <Path d="M12 19V5" /><Path d="M5 12l7-7 7 7" />
    </Svg>
  );
}

export function IkonaMikrofon({ velikost = 20, barva = '#fff' }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 24 24" {...obrys(barva)} strokeWidth={2.2}>
      <Rect x="9" y="3" width="6" height="11" rx="3" />
      <Path d="M5 11a7 7 0 0 0 14 0" /><Path d="M12 18v3" />
    </Svg>
  );
}

export function IkonaStop({ velikost = 18, barva = '#fff' }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 24 24">
      <Rect x="6" y="6" width="12" height="12" rx="2" fill={barva} />
    </Svg>
  );
}

export function IkonaZpet({ velikost = 22, barva = '#fff' }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 24 24" {...obrys(barva)} strokeWidth={2.6}>
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

export function IkonaInfo({ velikost = 18, barva = '#fff' }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 24 24" {...obrys(barva)}>
      <Circle cx="12" cy="12" r="9.5" /><Path d="M12 11v6M12 7.5v.5" />
    </Svg>
  );
}

export function IkonaSipkaNahoru({ velikost = 12, barva = '#5ee38a' }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 12 12">
      <Path d="M6 1.5 11 10.5H1z" fill={barva} />
    </Svg>
  );
}

export function IkonaSipkaDolu({ velikost = 12, barva = '#ff6b6b' }: P) {
  return (
    <Svg width={velikost} height={velikost} viewBox="0 0 12 12">
      <Path d="M6 10.5 11 1.5H1z" fill={barva} />
    </Svg>
  );
}

// ---- velké 3D ilustrace do gradientních karet (300 × 270) -------------------

function Podlozka({ id, horni, leva, prava, zare }: { id: string; horni: [string, string]; leva: string; prava: string; zare: string }) {
  return (
    <>
      <Defs>
        <LinearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={horni[0]} /><Stop offset="1" stopColor={horni[1]} />
        </LinearGradient>
        <RadialGradient id={`${id}g`} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={zare} /><Stop offset="1" stopColor={zare} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx="150" cy="150" rx="150" ry="125" fill={`url(#${id}g)`} opacity={0.6} />
      <Polygon points="50,235 150,280 150,260 50,215" fill={leva} />
      <Polygon points="150,280 250,235 250,215 150,260" fill={prava} />
      <Polygon points="150,170 250,215 150,260 50,215" fill={`url(#${id}t)`} stroke="rgba(255,255,255,.45)" strokeWidth={1} />
    </>
  );
}

function Prolinani({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <>
      <Defs>
        <LinearGradient id={`${id}mg`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.72" stopColor="#fff" /><Stop offset="1" stopColor="#000" />
        </LinearGradient>
        <Mask id={`${id}m`}><Rect width="300" height="290" fill={`url(#${id}mg)`} /></Mask>
      </Defs>
      <G mask={`url(#${id}m)`}>{children}</G>
    </>
  );
}

export function IlustraceSpendlik({ sirka = 300 }: { sirka?: number }) {
  return (
    <Svg width={sirka} height={sirka * 0.9} viewBox="0 0 300 290">
      <Defs>
        <RadialGradient id="apin" cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#fff4cf" /><Stop offset="0.45" stopColor="#e9b54a" /><Stop offset="1" stopColor="#8a5510" />
        </RadialGradient>
        <RadialGradient id="adot" cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#ffffff" /><Stop offset="1" stopColor="#f3e3b5" />
        </RadialGradient>
      </Defs>
      <Prolinani id="a">
        <Podlozka id="a" horni={['#c9caff', '#8c8ee8']} leva="#5f61c4" prava="#43459e" zare="#7b7dff" />
        <Path d="M100 237.5 L200 192.5" stroke="rgba(255,255,255,.6)" strokeWidth={7} strokeLinecap="round" />
        <Path d="M100 192.5 L200 237.5" stroke="rgba(255,255,255,.35)" strokeWidth={5} strokeLinecap="round" />
        <Polygon points="79,220 95,227.2 95,201.2 79,194" fill="#9b9ce6" />
        <Polygon points="95,227.2 111,220 111,194 95,201.2" fill="#6f70c4" />
        <Polygon points="95,186.8 111,194 95,201.2 79,194" fill="#e9e8ff" />
        <Polygon points="191,222 205,228.3 205,210.3 191,204" fill="#9b9ce6" />
        <Polygon points="205,228.3 219,222 219,204 205,210.3" fill="#6f70c4" />
        <Polygon points="205,197.7 219,204 205,210.3 191,204" fill="#e9e8ff" />
        <Ellipse cx="150" cy="214" rx="24" ry="8" fill="rgba(10,10,50,.5)" />
        <Path d="M150 208 C130 176,104 150,104 112 A46 46 0 1 1 196 112 C196 150,170 176,150 208Z" fill="url(#apin)" />
        <Circle cx="150" cy="112" r="18" fill="url(#adot)" />
        <Ellipse cx="128" cy="92" rx="10" ry="18" transform="rotate(35 128 92)" fill="#fff" opacity={0.5} />
      </Prolinani>
    </Svg>
  );
}

export function IlustraceGraf({ sirka = 300 }: { sirka?: number }) {
  const sloupec = (x: number, yZaklad: number, vyska: number) => {
    const y = yZaklad - vyska;
    return (
      <G key={x}>
        <Polygon points={`${x},${yZaklad} ${x + 12},${yZaklad + 5.4} ${x + 12},${y + 5.4} ${x},${y}`} fill="url(#bbl)" />
        <Polygon points={`${x + 12},${yZaklad + 5.4} ${x + 24},${yZaklad} ${x + 24},${y} ${x + 12},${y + 5.4}`} fill="url(#bbr)" />
        <Polygon points={`${x + 12},${y - 5.4} ${x + 24},${y} ${x + 12},${y + 5.4} ${x},${y}`} fill="url(#bbt)" />
      </G>
    );
  };
  return (
    <Svg width={sirka} height={sirka * 0.9} viewBox="0 0 300 290">
      <Defs>
        <LinearGradient id="bbt" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#fff4cf" /><Stop offset="1" stopColor="#f1cf7a" /></LinearGradient>
        <LinearGradient id="bbl" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#e9b54a" /><Stop offset="1" stopColor="#c48a22" /></LinearGradient>
        <LinearGradient id="bbr" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#b07818" /><Stop offset="1" stopColor="#7a4e0c" /></LinearGradient>
        <RadialGradient id="bsun" cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#ffffff" /><Stop offset="0.5" stopColor="#bdf3ff" /><Stop offset="1" stopColor="#2aa7c9" />
        </RadialGradient>
      </Defs>
      <Prolinani id="b">
        <Podlozka id="b" horni={['#bff1f7', '#6cc6d6']} leva="#2f8ea3" prava="#1d6577" zare="#2fd0e8" />
        {sloupec(177, 197.45, 92)}
        {sloupec(151, 209.15, 68)}
        {sloupec(125, 220.85, 48)}
        {sloupec(99, 232.55, 30)}
        <Polyline points="111,184.55 137,154.85 163,123.15 189,87.45" fill="none" stroke="#fff" strokeWidth={3} strokeDasharray="2 7" strokeLinecap="round" />
        <Circle cx="189" cy="87.45" r="6" fill="#fff" />
        <Circle cx="240" cy="62" r="22" fill="url(#bsun)" />
        <Ellipse cx="232" cy="53" rx="7" ry="4" transform="rotate(-30 232 53)" fill="#fff" opacity={0.7} />
      </Prolinani>
    </Svg>
  );
}

export function IlustraceZarovka({ sirka = 300 }: { sirka?: number }) {
  const kostka = (x: number, y: number, v: number) => (
    <G key={`${x}-${y}`}>
      <Polygon points={`${x},${y} ${x + 12},${y + 5.4} ${x + 12},${y + 5.4 - v} ${x},${y - v}`} fill="#c08ae6" />
      <Polygon points={`${x + 12},${y + 5.4} ${x + 24},${y} ${x + 24},${y - v} ${x + 12},${y + 5.4 - v}`} fill="#8d58b8" />
      <Polygon points={`${x + 12},${y - v - 5.4} ${x + 24},${y - v} ${x + 12},${y - v + 5.4} ${x},${y - v}`} fill="#f6e9ff" />
    </G>
  );
  return (
    <Svg width={sirka} height={sirka * 0.9} viewBox="0 0 300 290">
      <Defs>
        <RadialGradient id="cbulb" cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#fffbea" /><Stop offset="0.45" stopColor="#fcd34d" /><Stop offset="1" stopColor="#b45309" />
        </RadialGradient>
        <LinearGradient id="ccap" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#f1f2f4" /><Stop offset="1" stopColor="#7b818c" /></LinearGradient>
      </Defs>
      <Prolinani id="c">
        <Podlozka id="c" horni={['#ecd2ff', '#b57ce0']} leva="#7f45ad" prava="#5a2c80" zare="#c86bff" />
        {kostka(202, 213, 36)}
        {kostka(80, 222, 14)}
        {kostka(178, 226, 24)}
        <Ellipse cx="150" cy="214" rx="20" ry="7" fill="rgba(30,5,45,.5)" />
        {[[150, 38, 150, 24], [202, 62, 212, 52], [216, 108, 230, 108], [98, 62, 88, 52], [84, 108, 70, 108]].map(([x1, y1, x2, y2]) => (
          <Line key={`${x1}${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,236,170,.85)" strokeWidth={4} strokeLinecap="round" />
        ))}
        <Path d="M128 132 L172 132 L164 160 L136 160Z" fill="url(#cbulb)" />
        <Circle cx="150" cy="104" r="48" fill="url(#cbulb)" />
        <Path d="M138 132 L138 112 Q144 100 150 112 Q156 100 162 112 L162 132" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth={3} strokeLinecap="round" />
        <Rect x="133" y="158" width="34" height="9" rx="4.5" fill="url(#ccap)" />
        <Rect x="133" y="168" width="34" height="9" rx="4.5" fill="url(#ccap)" />
        <Rect x="133" y="178" width="34" height="9" rx="4.5" fill="url(#ccap)" />
        <Path d="M141 187 L159 187 L154 196 L146 196Z" fill="#5b616b" />
        <Ellipse cx="128" cy="84" rx="10" ry="18" transform="rotate(35 128 84)" fill="#fff" opacity={0.55} />
      </Prolinani>
    </Svg>
  );
}

/** Dva telefony nad podložkou – ilustrace pro Zatřes. */
export function IlustraceTelefony({ sirka = 300 }: { sirka?: number }) {
  return (
    <Svg width={sirka} height={sirka * 0.9} viewBox="0 0 300 290">
      <Defs>
        <LinearGradient id="dph" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#f2f3ff" /><Stop offset="1" stopColor="#9ea2e6" /></LinearGradient>
        <LinearGradient id="dsc" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#5aa2ff" /><Stop offset="1" stopColor="#2b6fd6" /></LinearGradient>
        <RadialGradient id="dco" cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#fff4cf" /><Stop offset="0.45" stopColor="#e9b54a" /><Stop offset="1" stopColor="#8a5510" />
        </RadialGradient>
      </Defs>
      <Prolinani id="d">
        <Podlozka id="d" horni={['#c9caff', '#8c8ee8']} leva="#5f61c4" prava="#43459e" zare="#7b7dff" />
        <Ellipse cx="150" cy="218" rx="70" ry="10" fill="rgba(10,10,50,.45)" />
        <G transform="rotate(-12 105 140)">
          <Rect x="75" y="70" width="60" height="120" rx="12" fill="url(#dph)" />
          <Rect x="81" y="80" width="48" height="96" rx="6" fill="url(#dsc)" />
        </G>
        <G transform="rotate(12 195 140)">
          <Rect x="165" y="70" width="60" height="120" rx="12" fill="url(#dph)" />
          <Rect x="171" y="80" width="48" height="96" rx="6" fill="url(#dsc)" />
        </G>
        <Circle cx="150" cy="70" r="20" fill="url(#dco)" />
        <Path d="M150 61 V79 M145 65 H153 A3.5 3.5 0 0 1 153 72 H146" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" />
        <Path d="M118 48 Q150 28 182 48" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth={3} strokeDasharray="2 7" strokeLinecap="round" />
      </Prolinani>
    </Svg>
  );
}
