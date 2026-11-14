export interface Theme {
  id: string;
  name: string;
  /** CSS custom properties applied to :root */
  vars: Record<string, string>;
}

const dark = {
  '--text': '#f4f1ea',
  '--muted': 'rgba(244,241,234,0.68)',
  '--surface': 'rgba(10,14,20,0.55)',
  '--surface-2': 'rgba(255,255,255,0.08)',
  '--border': 'rgba(255,255,255,0.16)',
  '--shadow': '0 10px 30px rgba(0,0,0,0.35)',
};

const light = {
  '--text': '#22201c',
  '--muted': 'rgba(34,32,28,0.64)',
  '--surface': 'rgba(255,255,255,0.72)',
  '--surface-2': 'rgba(0,0,0,0.05)',
  '--border': 'rgba(0,0,0,0.12)',
  '--shadow': '0 10px 30px rgba(60,40,20,0.15)',
};

export const THEMES: Theme[] = [
  {
    id: 'felt',
    name: 'Card table',
    vars: {
      ...dark,
      '--bg': 'radial-gradient(ellipse at 50% 30%, #2f7d4f 0%, #1c5636 55%, #0f3321 100%)',
      '--accent': '#f2c14e',
      '--accent-text': '#2a1f00',
      '--board': '#174a2e',
      '--board-line': 'rgba(255,255,255,0.18)',
    },
  },
  {
    id: 'wood',
    name: 'Coffeehouse wood',
    vars: {
      ...dark,
      '--bg':
        'repeating-linear-gradient(92deg, rgba(0,0,0,0.06) 0 2px, transparent 2px 9px), linear-gradient(160deg, #7a4a2a 0%, #5a3219 50%, #3d220f 100%)',
      '--accent': '#ffb35c',
      '--accent-text': '#2b1500',
      '--board': '#4a2a14',
      '--board-line': 'rgba(255,220,180,0.22)',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    vars: {
      ...dark,
      '--bg': 'radial-gradient(ellipse at 20% 0%, #283a6b 0%, #141c3a 50%, #090d1d 100%)',
      '--accent': '#8ab4ff',
      '--accent-text': '#0a1430',
      '--board': '#18234a',
      '--board-line': 'rgba(160,190,255,0.22)',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    vars: {
      ...dark,
      '--bg': 'linear-gradient(165deg, #3b1d5e 0%, #8a2f6a 45%, #e0644a 85%, #f3a54b 100%)',
      '--accent': '#ffd27a',
      '--accent-text': '#3a1a00',
      '--board': 'rgba(40,12,50,0.55)',
      '--board-line': 'rgba(255,220,200,0.25)',
    },
  },
  {
    id: 'bosphorus',
    name: 'Bosphorus',
    vars: {
      ...dark,
      '--bg': 'linear-gradient(180deg, #0e4d64 0%, #0b6e7f 45%, #13a0a8 100%)',
      '--accent': '#ffe08a',
      '--accent-text': '#2b2000',
      '--board': '#0b3f52',
      '--board-line': 'rgba(200,250,255,0.22)',
    },
  },
  {
    id: 'paper',
    name: 'Paper',
    vars: {
      ...light,
      '--bg': 'radial-gradient(ellipse at 50% 0%, #fbf6ea 0%, #efe5cf 100%)',
      '--accent': '#b5452b',
      '--accent-text': '#ffffff',
      '--board': '#e6d8b8',
      '--board-line': 'rgba(80,50,20,0.25)',
    },
  },
  {
    id: 'candy',
    name: 'Candy',
    vars: {
      ...light,
      '--bg': 'linear-gradient(135deg, #ffd6e8 0%, #e3d5ff 50%, #c9f0ff 100%)',
      '--accent': '#7a3ff2',
      '--accent-text': '#ffffff',
      '--board': 'rgba(255,255,255,0.6)',
      '--board-line': 'rgba(90,40,140,0.2)',
    },
  },
];

/** Player colors, per seat. Chosen to stay distinct on every background. */
export const PIECE_SETS: { id: string; name: string; colors: string[] }[] = [
  { id: 'classic', name: 'Classic', colors: ['#e63946', '#ffd23f', '#3a86ff', '#2ec4b6', '#ff7f11', '#b388eb', '#f15bb5', '#9ef01a'] },
  { id: 'bold', name: 'Bold', colors: ['#ff006e', '#00f5d4', '#fee440', '#9b5de5', '#f15bb5', '#00bbf9', '#fb5607', '#80ed99'] },
  { id: 'earth', name: 'Earth', colors: ['#c0392b', '#e9c46a', '#2a9d8f', '#f4a261', '#8d6e63', '#6a994e', '#bc6c25', '#577590'] },
];

/** Card back patterns, drawn in CSS (.back-<id>) */
export const CARD_BACKS = [
  { id: 'red', name: 'Classic red' },
  { id: 'navy', name: 'Navy' },
  { id: 'tulip', name: 'Tulip tile' },
  { id: 'kilim', name: 'Kilim' },
  { id: 'green', name: 'Emerald' },
  { id: 'night', name: 'Starry night' },
];

export const TILE_STYLES = [
  { id: 'ivory', name: 'Ivory' },
  { id: 'white', name: 'White' },
  { id: 'dark', name: 'Dark' },
];

export function applyTheme(themeId: string, piecesId: string) {
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const pieces = PIECE_SETS.find((p) => p.id === piecesId) ?? PIECE_SETS[0];
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v);
  pieces.colors.forEach((c, i) => root.style.setProperty(`--p${i}`, c));
  const light = theme.vars['--text'].startsWith('#2');
  root.style.colorScheme = light ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#efe5cf' : '#0f1720');
}
