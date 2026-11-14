/**
 * Martı characters. They are cosmetic only: every character has the same
 * hitbox and physics, so races on a shared course stay fair.
 * Each draw function paints the flyer centered on (0, 0), facing right.
 * `wing` swings between about -9 and 9 as the wings beat.
 */

type Ctx = CanvasRenderingContext2D;

export interface Character {
  id: string;
  name: string;
  blurb: string;
  draw(ctx: Ctx, wing: number): void;
}

function body(ctx: Ctx, fill: string, rx = 18, ry = 12, stroke = 'rgba(0,0,0,0.45)') {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function wingShape(ctx: Ctx, fill: string, wing: number, tip?: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-6, -2);
  ctx.quadraticCurveTo(-14, -16 - wing, -24, -6 - wing);
  ctx.quadraticCurveTo(-12, -2, -6, 4);
  ctx.fill();
  if (tip) {
    ctx.fillStyle = tip;
    ctx.beginPath();
    ctx.moveTo(-18, -8 - wing * 0.8);
    ctx.quadraticCurveTo(-22, -12 - wing, -24, -6 - wing);
    ctx.quadraticCurveTo(-20, -5, -16, -4);
    ctx.fill();
  }
}

function beak(ctx: Ctx, fill: string, len = 12, hook = false) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(16, -3);
  if (hook) {
    ctx.quadraticCurveTo(16 + len, -6, 16 + len * 0.8, 6);
    ctx.lineTo(16, 4);
  } else {
    ctx.lineTo(16 + len, 1);
    ctx.lineTo(16, 4);
  }
  ctx.fill();
}

function eye(ctx: Ctx, x = 9, y = -4, white = false) {
  if (white) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(x, y, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function tail(ctx: Ctx, fill: string, len = 10) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-15, -3);
  ctx.lineTo(-15 - len, -7);
  ctx.lineTo(-15 - len, 5);
  ctx.lineTo(-15, 4);
  ctx.fill();
}

export const CHARACTERS: Character[] = [
  {
    id: 'marti',
    name: 'Martı',
    blurb: 'The seagull. Loud, hungry, fearless.',
    draw(ctx, wing) {
      body(ctx, '#ffffff');
      wingShape(ctx, '#9aa5b1', wing, '#2b2d42');
      beak(ctx, '#f4a020');
      eye(ctx);
    },
  },
  {
    id: 'guvercin',
    name: 'Güvercin',
    blurb: 'A pigeon from Eminönü square.',
    draw(ctx, wing) {
      tail(ctx, '#6c7a89', 8);
      body(ctx, '#8e9bab');
      // Shiny green-purple neck
      ctx.fillStyle = '#4f9a84';
      ctx.beginPath();
      ctx.ellipse(9, 2, 7, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a5aa8';
      ctx.beginPath();
      ctx.ellipse(8, 6, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      wingShape(ctx, '#b3bdc9', wing, '#4a5563');
      beak(ctx, '#3b3b3b', 7);
      eye(ctx, 10, -5);
      ctx.fillStyle = '#e0823d';
      ctx.beginPath();
      ctx.arc(10, -5, 3.2, 0, Math.PI * 2);
      ctx.fill();
      eye(ctx, 10, -5);
    },
  },
  {
    id: 'leylek',
    name: 'Leylek',
    blurb: 'A stork back from its long trip south.',
    draw(ctx, wing) {
      // Legs trail behind
      ctx.strokeStyle = '#e4572e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, 8);
      ctx.lineTo(-30, 12);
      ctx.moveTo(-8, 9);
      ctx.lineTo(-28, 15);
      ctx.stroke();
      body(ctx, '#fafafa', 17, 11);
      wingShape(ctx, '#ffffff', wing, '#111111');
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      beak(ctx, '#e4572e', 20);
      eye(ctx);
    },
  },
  {
    id: 'papagan',
    name: 'Papağan',
    blurb: 'An escaped parrot who learned to say "simit".',
    draw(ctx, wing) {
      tail(ctx, '#1f78b4', 14);
      body(ctx, '#2fbf4a');
      ctx.fillStyle = '#f9d423';
      ctx.beginPath();
      ctx.ellipse(10, -2, 7, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      wingShape(ctx, '#e63946', wing, '#1f78b4');
      beak(ctx, '#2b2b2b', 9, true);
      eye(ctx, 10, -5, true);
    },
  },
  {
    id: 'karga',
    name: 'Karga',
    blurb: 'A clever crow. It has seen things.',
    draw(ctx, wing) {
      tail(ctx, '#1b1b22', 9);
      body(ctx, '#2a2a33', 18, 12, 'rgba(255,255,255,0.25)');
      wingShape(ctx, '#3c3c4a', wing, '#15151b');
      beak(ctx, '#454545', 12);
      eye(ctx, 9, -4, true);
    },
  },
  {
    id: 'kanarya',
    name: 'Kanarya',
    blurb: 'A tiny canary with a big voice.',
    draw(ctx, wing) {
      body(ctx, '#ffd60a', 16, 12);
      ctx.fillStyle = '#ffe87a';
      ctx.beginPath();
      ctx.ellipse(4, 4, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      wingShape(ctx, '#f4b400', wing, '#d18f00');
      beak(ctx, '#f28c28', 7);
      eye(ctx, 8, -4);
      ctx.fillStyle = 'rgba(255,120,120,0.55)';
      ctx.beginPath();
      ctx.arc(8, 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'hazerfen',
    name: 'Hazerfen Ahmet Çelebi',
    blurb: 'The 17th-century Istanbul flyer who, the story goes, glided from Galata Tower across the Bosphorus to Üsküdar.',
    draw(ctx, wing) {
      // Big feathered wings strapped to the arms (behind the body)
      for (const [dy, shade] of [
        [0, '#8d6e4f'],
        [5, '#b08d62'],
      ] as const) {
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.moveTo(0, -2 + dy);
        ctx.quadraticCurveTo(-16, -24 - wing * 1.4 + dy, -38, -14 - wing * 1.4 + dy);
        ctx.quadraticCurveTo(-26, -6 + dy, -30, 0 + dy);
        ctx.quadraticCurveTo(-14, 0 + dy, 0, 6 + dy);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(60,40,20,0.6)';
      ctx.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(-6 - k * 7, -4 - k * 2);
        ctx.lineTo(-10 - k * 7, -14 - wing * (0.4 + k * 0.25));
        ctx.stroke();
      }
      // Kaftan (body lying flat in flight)
      ctx.fillStyle = '#b5302b';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(-2, 4, 17, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Sash
      ctx.fillStyle = '#e9b949';
      ctx.fillRect(-4, -3, 4, 15);
      // Legs and yellow slippers trailing
      ctx.fillStyle = '#2b3a67';
      ctx.fillRect(-26, 3, 10, 6);
      ctx.fillStyle = '#e9b949';
      ctx.beginPath();
      ctx.ellipse(-28, 6, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head with beard
      ctx.fillStyle = '#e8b98d';
      ctx.beginPath();
      ctx.arc(16, -1, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a2f1d';
      ctx.beginPath();
      ctx.moveTo(12, 2);
      ctx.quadraticCurveTo(18, 12, 23, 2);
      ctx.fill();
      // Tall white turban
      ctx.fillStyle = '#f5f1e6';
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(15, -9, 8, 6, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#b5302b';
      ctx.beginPath();
      ctx.ellipse(14, -13, 3.5, 3, -0.25, 0, Math.PI * 2);
      ctx.fill();
      eye(ctx, 19, -2);
    },
  },
];

export const getCharacter = (id: string | null | undefined) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

const CHAR_KEY = 'oyun-masasi:marti-character';

export function readCharacter(): string {
  try {
    const id = localStorage.getItem(CHAR_KEY);
    if (id && CHARACTERS.some((c) => c.id === id)) return id;
  } catch {
    /* storage unavailable */
  }
  return CHARACTERS[0].id;
}

export function saveCharacter(id: string) {
  try {
    localStorage.setItem(CHAR_KEY, id);
  } catch {
    /* storage unavailable */
  }
}

/** Galata Tower, drawn with its base on y = 0 and the top at y = -h */
export function drawGalata(ctx: Ctx, x: number, h: number) {
  const w = 46;
  ctx.fillStyle = '#d9c6a5';
  ctx.strokeStyle = 'rgba(70,50,30,0.5)';
  ctx.lineWidth = 1.5;
  ctx.fillRect(x - w / 2, -h + 40, w, h - 40);
  ctx.strokeRect(x - w / 2, -h + 40, w, h - 40);
  // Stone courses and windows
  ctx.fillStyle = 'rgba(70,50,30,0.35)';
  for (let y = -h + 70; y < -10; y += 34) {
    ctx.fillRect(x - w / 2, y, w, 2);
    ctx.fillRect(x - 4, y + 9, 8, 14);
  }
  // Gallery
  ctx.fillStyle = '#8a7356';
  ctx.fillRect(x - w / 2 - 6, -h + 34, w + 12, 8);
  ctx.fillStyle = '#c9b38f';
  ctx.fillRect(x - w / 2 + 2, -h + 16, w - 4, 18);
  ctx.fillStyle = 'rgba(40,30,20,0.6)';
  for (let k = 0; k < 4; k++) ctx.fillRect(x - w / 2 + 6 + k * 10, -h + 20, 5, 10);
  // Conical roof
  ctx.fillStyle = '#4b5a6b';
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 2, -h + 16);
  ctx.lineTo(x, -h - 34);
  ctx.lineTo(x + w / 2 + 2, -h + 16);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.beginPath();
  ctx.moveTo(x, -h - 34);
  ctx.lineTo(x, -h - 46);
  ctx.stroke();
}
