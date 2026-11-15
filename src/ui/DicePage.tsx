import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { feedback, playSound } from './sound';

const SIDES = [4, 6, 8, 10, 12, 20, 100];
const PIPS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

/** A fair random whole number from 1 to n, from the browser's crypto source */
export function fairRoll(n: number): number {
  const buf = new Uint32Array(1);
  // Throw away the top sliver so every face is exactly as likely
  const limit = Math.floor(0x100000000 / n) * n;
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return (buf[0] % n) + 1;
}

const lastSettings = { sides: 6, count: 2 };

function Dice() {
  const t = useT();
  const [sides, setSides] = useState(lastSettings.sides);
  const [count, setCount] = useState(lastSettings.count);
  const [faces, setFaces] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);
  lastSettings.sides = sides;
  lastSettings.count = count;

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    let k = 0;
    timer.current = setInterval(() => {
      k++;
      setFaces(Array.from({ length: count }, () => fairRoll(sides)));
      if (k % 2) playSound('tick');
      if (k >= 9) {
        clearInterval(timer.current!);
        const final = Array.from({ length: count }, () => fairRoll(sides));
        setFaces(final);
        setRolling(false);
        feedback('turn');
        const sum = final.reduce((a, b) => a + b, 0);
        setHistory((h) => [`${count}d${sides}: ${final.join(' + ')}${count > 1 ? ` = ${sum}` : ''}`, ...h].slice(0, 10));
      }
    }, 60);
  };

  const total = faces.reduce((a, b) => a + b, 0);
  return (
    <section className="stack-sm tool-box">
      <h2 className="section-title">🎲 {t('Dice')}</h2>
      <div className="row">
        <span className="small muted">{t('Sides')}:</span>
        {SIDES.map((n) => (
          <button key={n} className={'chip-btn small-chip' + (sides === n ? ' on' : '')} aria-pressed={sides === n} onClick={() => setSides(n)}>
            d{n}
          </button>
        ))}
      </div>
      <div className="row">
        <span className="small muted">{t('How many')}:</span>
        <button className="btn small" disabled={count <= 1} onClick={() => setCount((c) => c - 1)} aria-label={t('Fewer')}>
          −
        </button>
        <strong className="dice-count">{count}</strong>
        <button className="btn small" disabled={count >= 10} onClick={() => setCount((c) => c + 1)} aria-label={t('More')}>
          +
        </button>
      </div>
      <button className="btn primary big-btn" onClick={roll} disabled={rolling}>
        🎲 {t('Roll')}
      </button>
      {faces.length > 0 && (
        <div className="stack-sm center" aria-live="polite">
          <div className={'dice-row' + (rolling ? ' rolling' : '')}>
            {faces.map((f, i) => (
              <span key={i} className={'die-face d' + sides + (sides === 6 ? ' pips' : '')}>
                {sides === 6 ? PIPS[f] : f}
              </span>
            ))}
          </div>
          {faces.length > 1 && !rolling && <p className="dice-total">{t('Total: {n}', { n: total })}</p>}
        </div>
      )}
      {history.length > 1 && (
        <details className="small">
          <summary>{t('Earlier rolls')}</summary>
          <ul className="dice-history">
            {history.slice(1).map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Coin() {
  const t = useT();
  const [side, setSide] = useState<'heads' | 'tails' | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [spin, setSpin] = useState(0);
  const [tally, setTally] = useState({ heads: 0, tails: 0 });

  const flip = () => {
    if (flipping) return;
    const next = fairRoll(2) === 1 ? 'heads' : 'tails';
    setFlipping(true);
    playSound('tick');
    // Whole turns, ending on the right face
    setSpin((s) => s + 1800 + (next === 'tails' ? 180 : 0) - (s % 360));
    setTimeout(() => {
      setSide(next);
      setFlipping(false);
      setTally((x) => ({ ...x, [next]: x[next] + 1 }));
      feedback('turn');
    }, 900);
  };

  return (
    <section className="stack-sm tool-box center">
      <h2 className="section-title">₺ {t('Coin')}</h2>
      <button className="coin-btn" onClick={flip} aria-label={t('Flip the coin')}>
        <span className="coin" style={{ transform: `rotateY(${spin}deg)` }}>
          <span className="coin-face heads">{t('Heads')}</span>
          <span className="coin-face tails">{t('Tails')}</span>
        </span>
      </button>
      <button className="btn primary big-btn" onClick={flip} disabled={flipping}>
        ₺ {t('Flip')}
      </button>
      <p aria-live="polite" className="dice-total">
        {side && !flipping ? (side === 'heads' ? t('Heads!') : t('Tails!')) : ' '}
      </p>
      {tally.heads + tally.tails > 0 && (
        <p className="small muted">
          {t('Heads')}: {tally.heads} · {t('Tails')}: {tally.tails}
          <button className="btn ghost small" onClick={() => setTally({ heads: 0, tails: 0 })}>
            {t('Reset')}
          </button>
        </p>
      )}
    </section>
  );
}

export function DicePage() {
  const t = useT();
  return (
    <div className="panel stack">
      <a href="#/" className="back">
        ← {t('All games')}
      </a>
      <h1>{t('Dice and coin')}</h1>
      <p className="muted small">{t('For board games at home, deciding who goes first, or settling an argument. Every roll is fair.')}</p>
      <div className="tool-grid">
        <Dice />
        <Coin />
      </div>
    </div>
  );
}
