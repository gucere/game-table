import { useEffect, useRef, useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import * as L from './logic';
import * as S from './sim';
import { CHARACTERS, drawGalata, getCharacter, readCharacter, saveCharacter, type Character } from './characters';
import { t as tx } from '../../i18n';

const BEST_KEY = 'oyun-masasi:marti-best';

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(n: number) {
  try {
    if (n > readBest()) localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* storage unavailable */
  }
}

// ------------------------------------------------------------- drawing

function drawScene(ctx: CanvasRenderingContext2D, sim: S.Sim, scroll: number, who: Character) {
  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, S.SEA);
  sky.addColorStop(0, '#ffb36b');
  sky.addColorStop(0.55, '#ffd9a0');
  sky.addColorStop(1, '#bfe3f2');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, S.W, S.H);

  // Sun
  ctx.fillStyle = 'rgba(255,245,220,0.9)';
  ctx.beginPath();
  ctx.arc(300, 150, 46, 0, Math.PI * 2);
  ctx.fill();

  // Distant skyline with domes and minarets (parallax)
  ctx.fillStyle = 'rgba(120,80,110,0.45)';
  const off = -(scroll * 0.2) % 240;
  for (let k = -1; k < 4; k++) {
    const x = off + k * 240;
    ctx.fillRect(x + 20, S.SEA - 60, 120, 60);
    ctx.beginPath();
    ctx.arc(x + 80, S.SEA - 60, 42, Math.PI, 0);
    ctx.fill();
    for (const mx of [x + 10, x + 150]) {
      ctx.fillRect(mx, S.SEA - 130, 8, 130);
      ctx.beginPath();
      ctx.moveTo(mx - 2, S.SEA - 130);
      ctx.lineTo(mx + 4, S.SEA - 152);
      ctx.lineTo(mx + 10, S.SEA - 130);
      ctx.fill();
    }
  }

  // Hazerfen takes off from Galata Tower, which then scrolls away
  const towerX = S.BIRD_X - 26 - scroll;
  if (who.id === 'hazerfen' && towerX > -80) {
    ctx.save();
    ctx.translate(0, S.SEA);
    drawGalata(ctx, towerX, S.SEA - (S.H * 0.42 + 22));
    ctx.restore();
  }

  // Obstacles: hanging lantern chains from above, striped lighthouses from below
  for (const o of sim.obstacles) {
    const top = o.gapY - o.gap / 2;
    const bottom = o.gapY + o.gap / 2;
    // Top: rope + stacked lanterns
    ctx.fillStyle = '#5b3a29';
    ctx.fillRect(o.x + S.OB_W / 2 - 3, 0, 6, top);
    for (let y = top - 34; y > -34; y -= 40) {
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.ellipse(o.x + S.OB_W / 2, y + 17, S.OB_W / 2 - 4, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f6c453';
      ctx.fillRect(o.x + 8, y + 14, S.OB_W - 16, 6);
    }
    ctx.fillStyle = '#3d2a1e';
    ctx.fillRect(o.x + 4, top - 8, S.OB_W - 8, 8);
    // Bottom: lighthouse
    const h = S.SEA - bottom;
    for (let k = 0; k * 22 < h; k++) {
      ctx.fillStyle = k % 2 ? '#ffffff' : '#d62828';
      ctx.fillRect(o.x + 6, bottom + 18 + k * 22, S.OB_W - 12, Math.min(22, h - k * 22));
    }
    ctx.fillStyle = '#2b2d42';
    ctx.fillRect(o.x, bottom + 10, S.OB_W, 8);
    ctx.fillStyle = '#ffe66d';
    ctx.fillRect(o.x + 14, bottom, S.OB_W - 28, 12);
    ctx.fillStyle = '#2b2d42';
    ctx.beginPath();
    ctx.moveTo(o.x + 10, bottom);
    ctx.lineTo(o.x + S.OB_W / 2, bottom - 14);
    ctx.lineTo(o.x + S.OB_W - 10, bottom);
    ctx.fill();
  }

  // Sea
  ctx.fillStyle = '#1f6f8b';
  ctx.fillRect(0, S.SEA, S.W, S.H - S.SEA);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  for (let row = 0; row < 3; row++) {
    ctx.beginPath();
    const y = S.SEA + 12 + row * 20;
    for (let x = -40; x < S.W + 40; x += 40) {
      const xx = x - ((scroll * (1 + row * 0.3)) % 40);
      ctx.moveTo(xx, y);
      ctx.quadraticCurveTo(xx + 10, y - 6, xx + 20, y);
    }
    ctx.stroke();
  }

  // The flyer
  ctx.save();
  ctx.translate(S.BIRD_X, sim.y);
  ctx.rotate(Math.max(-0.5, Math.min(1.1, sim.vy / 600)));
  who.draw(ctx, Math.sin(sim.t * (sim.started ? 22 : 8)) * 9);
  ctx.restore();

  // Score
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 5;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.strokeText(String(sim.score), S.W / 2, 70);
  ctx.fillText(String(sim.score), S.W / 2, 70);
  if (!sim.started) {
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.strokeText('Tap or press Space to fly', S.W / 2, S.H * 0.62);
    ctx.fillText('Tap or press Space to fly', S.W / 2, S.H * 0.62);
  }
}

// ------------------------------------------------------------- board

/** Small still picture of a character, for the picker and the scoreboard */
function CharIcon({ id, size = 44 }: { id: string | null | undefined; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const who = getCharacter(id);
    ctx.clearRect(0, 0, 88, 88);
    ctx.save();
    const k = who.id === 'hazerfen' ? 1.2 : who.id === 'leylek' ? 1.3 : 1.55;
    ctx.translate(who.id === 'hazerfen' || who.id === 'leylek' ? 52 : 48, 46);
    ctx.scale(k, k);
    who.draw(ctx, 4);
    ctx.restore();
  }, [id]);
  return <canvas ref={ref} width={88} height={88} style={{ width: size, height: size }} aria-hidden />;
}

function Flight({ seed, charId, onCrash }: { seed: number; charId: string; onCrash: (score: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const who = useRef(getCharacter(charId));
  who.current = getCharacter(charId);
  const sim = useRef(S.newSim());
  const reported = useRef(false);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let scroll = 0;
    let crashAt = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Fixed small steps keep the physics stable on slow frames
      for (let k = 0; k < 4; k++) S.step(sim.current, dt / 4, seed);
      if (sim.current.started && !sim.current.dead) scroll += S.speedFor(sim.current.score) * dt;
      const ctx = ref.current?.getContext('2d');
      if (ctx) drawScene(ctx, sim.current, scroll, who.current);
      if (sim.current.dead && !reported.current) {
        if (!crashAt) crashAt = now;
        if (now - crashAt > 900) {
          reported.current = true;
          saveBest(sim.current.score);
          onCrash(sim.current.score);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        S.flap(sim.current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  return (
    <canvas
      ref={ref}
      width={S.W}
      height={S.H}
      className="marti-canvas"
      onPointerDown={(e) => {
        e.preventDefault();
        S.flap(sim.current);
      }}
      aria-label={tx('Martı game area. Tap or press Space to flap.')}
    />
  );
}

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.MartiState, L.MartiMove>) {
  const [best, setBest] = useState(readBest);
  const [charId, setCharId] = useState(readCharacter);
  const mine = v.scores[seat];
  const who = getCharacter(charId);
  const flying = canMove && mine === null;
  return (
    <div className="marti">
      <div className="info-row">
        <span className="chip">{tx('Your best on this device: {best}', { best: best })}</span>
        {v.n > 1 &&
          players.map((p, i) => (
            <span key={i} className="chip marti-score">
              {v.chars?.[i] && <CharIcon id={v.chars[i]} size={22} />}
              {p.name}: {v.scores[i] ?? '…'}
            </span>
          ))}
      </div>
      {flying && (
        <div className="marti-pick" role="radiogroup" aria-label={tx('Choose your flyer')}>
          {CHARACTERS.map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={c.id === charId}
              className={'marti-char' + (c.id === charId ? ' on' : '')}
              title={c.name}
              onClick={(e) => {
                setCharId(c.id);
                saveCharacter(c.id);
                // Keep Space for flapping, not for re-clicking this button
                e.currentTarget.blur();
              }}
            >
              <CharIcon id={c.id} />
              <span className="small">{c.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}
      {flying && <p className="small muted center marti-blurb">{who.name}: {who.blurb}</p>}
      {flying ? (
        <Flight
          key={`${v.seed}-${seat}`}
          seed={v.seed}
          charId={charId}
          onCrash={(n) => {
            setBest(readBest());
            onMove({ type: 'score', n, char: charId });
          }}
        />
      ) : (
        <p className="center muted">{mine !== null ? tx('You scored {mine}.', { mine: mine }) : ''}</p>
      )}
    </div>
  );
}

export const marti: GameDef<L.MartiState, L.MartiMove, L.MartiState> = {
  id: 'marti',
  name: 'Martı',
  tagline: 'One-tap seagull flight over the Bosphorus.',
  icon: '🐦',
  minPlayers: 1,
  maxPlayers: 8,
  hiddenInfo: false,
  rules:
    'Pick a flyer (a seagull, pigeon, stork, parrot, crow, canary, or Hazerfen Ahmet Çelebi himself), then tap, click or press Space to flap. Fly between the hanging lanterns and the lighthouses; each one you pass is a point. With friends, everyone flies the same course and the highest score wins: online at the same time, or one after another on one device.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: (s) => s,
  move: (s, seat, m) => L.move(s, seat, m),
  result: L.result,
  bot: L.bot,
  botDelay: () => 2500,
  leaderboard: { score: (v, seat) => v.scores[seat] ?? null },
  Board,
};
