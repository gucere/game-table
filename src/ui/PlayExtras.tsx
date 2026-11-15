import { useEffect, useRef, useState } from 'react';
import type { Session, SessionSnapshot } from '../engine/session';
import type { GameDef, GameOptions, Seat } from '../engine/types';
import { TURN_OPTION } from '../engine/runner';
import { NIGHT_MAX_GAMES, nightFits, nightRanking } from '../engine/night';
import { GAMES, getGame } from '../games';
import { gameName, useLang, useT } from '../i18n';
import { recordGame, recordNight } from '../profile/stats';
import { updateSettings, useSettings } from '../theme/settings';
import { showToast } from './Avatar';
import { useMyStats } from './LikeButton';
import { isLiked } from '../profile/stats';
import { feedback, playSound } from './sound';

/** Re-renders every `ms` while `on` */
export function useNow(on: boolean, ms = 250) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [on, ms]);
  // The time of this render, never a stale one from an earlier tick
  return Date.now();
}

/** Seconds left on each seat's turn timer, in this device's clock */
export function secondsLeft(snap: SessionSnapshot, now: number): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [s, at] of Object.entries(snap.deadlines ?? {})) out[Number(s)] = Math.max(0, Math.ceil((at + snap.clockOffset - now) / 1000));
  return out;
}

/**
 * Sounds, vibration, stats and achievements for what happens in a game:
 * a move, your turn, the end of the game.
 */
export function usePlayFeedback(snap: SessionSnapshot, game: GameDef, seat: Seat, you: Seat | null, canMove: boolean, usedHint: React.MutableRefObject<boolean>) {
  const view = snap.views[seat];
  const multi = snap.players.length > 1;
  const watching = snap.spectating !== null && snap.spectating !== undefined;

  const lastView = useRef(view);
  const lastSound = useRef(0);
  useEffect(() => {
    if (lastView.current === view) return;
    lastView.current = view;
    if (!multi || snap.result || Date.now() - lastSound.current < 250) return;
    lastSound.current = Date.now();
    playSound('move');
  }, [view, multi, snap.result]);

  const wasMyTurn = useRef(canMove);
  useEffect(() => {
    if (canMove && !wasMyTurn.current && multi && !snap.result) feedback('turn');
    wasMyTurn.current = canMove;
  }, [canMove, multi, snap.result]);

  const lastResult = useRef(snap.result);
  useEffect(() => {
    const r = snap.result;
    const before = lastResult.current;
    lastResult.current = r;
    if (!r || before) {
      if (!r) usedHint.current = false;
      return;
    }
    const won = you !== null && r.winners.includes(you);
    const draw = !!r.draw || r.winners.length === 0;
    feedback(you === null || won ? 'win' : draw ? 'draw' : 'lose');
    if (you === null || watching) return;
    const unlocked = recordGame(
      {
        gameId: game.id,
        won,
        draw,
        solo: !multi,
        online: snap.online,
        beatHardBot: won && snap.players.some((p) => p.kind === 'bot' && p.level === 'hard'),
        players: snap.players.length,
      },
      usedHint.current,
    );
    announce(unlocked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.result]);

  const nightDone = useRef(!!snap.night?.finished);
  useEffect(() => {
    const done = !!snap.night?.finished;
    if (done && !nightDone.current && you !== null && !watching) announce(recordNight());
    nightDone.current = done;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.night?.finished]);

  // Last seconds of your turn timer
  const left = secondsLeft(snap, useNow(canMove && !!snap.deadlines?.[seat], 1000))[seat];
  useEffect(() => {
    if (canMove && left !== undefined && left > 0 && left <= 5) playSound('tick');
  }, [left, canMove]);
}

function announce(list: { icon: string; name: string }[]) {
  list.forEach((a, i) =>
    setTimeout(() => {
      showToast(a.icon, 'Achievement unlocked!', a.name);
      feedback('achievement');
    }, 900 + i * 1200),
  );
}

// ---------------------------------------------------------------- Hints and teach-me

export function HintBar({ game, snap, seat, canMove, onMove, usedHint }: { game: GameDef; snap: SessionSnapshot; seat: Seat; canMove: boolean; onMove: (m: unknown) => void; usedHint: React.MutableRefObject<boolean> }) {
  const t = useT();
  const { teach } = useSettings();
  const view = snap.views[seat];
  const [hint, setHint] = useState<{ move: unknown; text: string | null } | 'none' | null>(null);
  // Hints are for learning against the computer or on one device, not for beating friends online
  const othersAreBots = snap.players.every((p, i) => i === seat || p.kind === 'bot');
  const fair = !snap.online || othersAreBots;
  const allowed = !!game.bot && fair && snap.players.length > 1;
  // Tips point at moves too, so they follow the same rule as hints
  const tip = fair && teach && game.teach && view !== undefined ? safe(() => game.teach!(view, seat)) : null;
  const canTeach = fair && (!!game.teach || (allowed && !!game.describeMove));

  const find = () => {
    if (!game.bot || view === undefined) return;
    const move = safe(() => game.bot!(view, seat, { random: Math.random, level: 'hard' }));
    if (move === null || move === undefined) {
      setHint('none');
      return;
    }
    setHint({ move, text: game.describeMove ? safe(() => game.describeMove!(view, move, seat)) : null });
  };

  // A new position clears the old hint; in teach-me mode the next one comes by itself
  useEffect(() => {
    setHint(null);
    if (!teach || !allowed || !canMove || !game.describeMove) return;
    const id = setTimeout(find, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, teach, canMove]);

  if (!allowed && !tip && !canTeach) return null;
  return (
    <div className="hint-bar stack-sm">
      <div className="row wrap center-row">
        {allowed && canMove && (
          <button
            className="btn small"
            onClick={() => {
              usedHint.current = true;
              find();
            }}
          >
            💡 {t('Hint')}
          </button>
        )}
        {canTeach && (
          <button className={'btn small' + (teach ? ' primary' : ' ghost')} aria-pressed={teach} onClick={() => updateSettings({ teach: !teach })}>
            🎓 {teach ? t('Teach me: on') : t('Teach me')}
          </button>
        )}
      </div>
      {tip && <p className="small teach-tip">🎓 {t(tip)}</p>}
      {hint === 'none' && <p className="small muted">{t('No suggestion right now.')}</p>}
      {hint && hint !== 'none' && canMove && (
        <p className="small hint-text">
          💡 {hint.text ? t(hint.text) : t('The computer has a move in mind.')}{' '}
          <button
            className="btn small"
            onClick={() => {
              usedHint.current = true;
              onMove(hint.move);
              setHint(null);
            }}
          >
            {t('Play it for me')}
          </button>
        </p>
      )}
    </div>
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch (e) {
    console.warn(e);
    return null;
  }
}

// ---------------------------------------------------------------- Turn timer option

export const TURN_CHOICES = [
  { value: '0', label: 'Off' },
  { value: '15', label: '15 seconds' },
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '120', label: '2 minutes' },
];

export const hasTurnTimer = (game: GameDef) => !!game.bot && game.maxPlayers > 1 && !game.noTurnTimer;

export function TurnTimerField({ game, options, onChange, readOnly }: { game: GameDef; options: GameOptions; onChange?: (id: string, v: string) => void; readOnly?: boolean }) {
  const t = useT();
  if (!hasTurnTimer(game)) return null;
  const value = options[TURN_OPTION] ?? '0';
  return (
    <label className="field">
      <span>⏱ {t('Turn timer')}</span>
      {readOnly ? (
        <strong>{t(TURN_CHOICES.find((c) => c.value === value)?.label ?? 'Off')}</strong>
      ) : (
        <select className="input" value={value} onChange={(e) => onChange?.(TURN_OPTION, e.target.value)} title={t('When time runs out, the computer makes a simple move for that player.')}>
          {TURN_CHOICES.map((c) => (
            <option key={c.value} value={c.value}>
              {t(c.label)}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}

// ---------------------------------------------------------------- Game night

export function NightPicker({ session, snap, onClose }: { session: Session; snap: SessionSnapshot; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const stats = useMyStats();
  // Liked games first
  const fits = GAMES.filter((g) => nightFits(g, snap.players, snap.online)).sort((a, b) => Number(isLiked(stats, b.id)) - Number(isLiked(stats, a.id)));
  const [queue, setQueue] = useState<string[]>(() => (fits.some((g) => g.id === snap.gameId) ? [snap.gameId] : []));
  const toggle = (id: string) => setQueue((q) => (q.includes(id) ? q.filter((x) => x !== id) : q.length < NIGHT_MAX_GAMES ? [...q, id] : q));
  return (
    <div className="night-picker stack-sm">
      <h2 className="section-title">🌙 {t('Game night')}</h2>
      <p className="small muted">{t('Pick the games in the order you want to play them. Every win is worth 3 points and a draw 1; the scoreboard carries over from game to game.')}</p>
      {fits.length === 0 ? (
        <p className="small">{t('No games fit this table. Add or remove players (or bots) and try again.')}</p>
      ) : (
        <div className="night-games">
          {fits.map((g) => {
            const at = queue.indexOf(g.id);
            return (
              <button key={g.id} className={'chip-btn' + (at >= 0 ? ' on' : '')} aria-pressed={at >= 0} onClick={() => toggle(g.id)}>
                {at >= 0 && <span className="night-num">{at + 1}</span>}
                {g.icon} {gameName(g, lang)}
                {isLiked(stats, g.id) && <span aria-label={t('Liked')}> ♥</span>}
              </button>
            );
          })}
        </div>
      )}
      <div className="row">
        <button
          className="btn primary"
          disabled={queue.length < 2}
          onClick={() => {
            session.startNight?.(queue);
            onClose();
          }}
        >
          {t('Start game night ({n} games)', { n: queue.length })}
        </button>
        <button className="btn ghost" onClick={onClose}>
          {t('Cancel')}
        </button>
      </div>
      {queue.length < 2 && <p className="small muted">{t('Pick at least 2 games.')}</p>}
    </div>
  );
}

export function NightBoard({ snap }: { snap: SessionSnapshot }) {
  const t = useT();
  const lang = useLang();
  const night = snap.night;
  if (!night) return null;
  const ranking = nightRanking(night);
  const medal = ['🥇', '🥈', '🥉'];
  return (
    <div className={'night-board' + (night.finished ? ' final' : '')}>
      <div className="row wrap">
        <strong>🌙 {night.finished ? t('Game night: final scores') : t('Game night · game {i} of {n}', { i: night.index + 1, n: night.queue.length })}</strong>
        {!night.finished && (
          <span className="small muted">
            {night.queue.map((id, i) => {
              const g = getGame(id);
              return (
                <span key={i} className={i === night.index ? 'night-now' : i < night.index ? 'night-done' : ''}>
                  {i ? ' → ' : ''}
                  {g?.icon} {g ? gameName(g, lang) : id}
                </span>
              );
            })}
          </span>
        )}
      </div>
      <div className="night-scores">
        {ranking.map(([name, pts], i) => (
          <span key={name} className="night-score">
            {night.finished && i < 3 && pts > 0 ? medal[i] + ' ' : ''}
            {name}: <strong>{pts}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

/** What can happen after a game: next night game, rematch votes, play again */
export function AfterGame({ session, snap }: { session: Session; snap: SessionSnapshot }) {
  const t = useT();
  const lang = useLang();
  const [picking, setPicking] = useState(false);
  const me = snap.localSeats[0];
  const night = snap.night;
  const rematch = snap.rematch;
  const canNight = snap.isHost && !snap.publicLounge && !!session.startNight && snap.players.length > 1;

  if (picking) return <NightPicker session={session} snap={snap} onClose={() => setPicking(false)} />;

  if (night) {
    const next = !night.finished && night.index + 1 < night.queue.length ? getGame(night.queue[night.index + 1]) : null;
    return (
      <div className="row center-row wrap">
        {snap.isHost ? (
          night.finished ? (
            <button className="btn primary" onClick={() => session.endNight?.()}>
              {t('End game night')}
            </button>
          ) : (
            <>
              <button className="btn primary" onClick={() => session.nextNight?.()}>
                {next ? t('Next game: {name} →', { name: `${next.icon} ${gameName(next, lang)}` }) : t('See the final scores')}
              </button>
              <button className="btn ghost" onClick={() => session.restart?.()}>
                {t('Replay this one')}
              </button>
              <button className="btn ghost" onClick={() => session.endNight?.()}>
                {t('End game night')}
              </button>
            </>
          )
        ) : (
          <p className="muted">{t('Waiting for the host to start the next game…')}</p>
        )}
      </div>
    );
  }

  return (
    <div className="row center-row wrap">
      {snap.isHost ? (
        <>
          <button className="btn primary" onClick={() => session.restart?.()}>
            {t('Play again')}
          </button>
          {snap.online && (
            <button className="btn" onClick={() => session.backToLobby?.()}>
              {t('Back to lobby')}
            </button>
          )}
          {canNight && (
            <button className="btn ghost" onClick={() => setPicking(true)}>
              🌙 {t('Game night')}
            </button>
          )}
        </>
      ) : rematch && me !== undefined && snap.spectating == null ? (
        <button className="btn primary" disabled={rematch.votes.includes(me)} onClick={() => session.voteRematch?.()}>
          🔁 {rematch.votes.includes(me) ? t('You want a rematch') : t('Rematch?')}
        </button>
      ) : (
        <p className="muted">{t('Waiting for the host to start the next game…')}</p>
      )}
      {rematch && rematch.votes.length > 0 && (
        <span className="small muted">
          {t('Rematch votes: {n} of {needed}', { n: rematch.votes.length, needed: rematch.needed })}
          {snap.isHost && !rematch.votes.includes(0) && (
            <>
              {' '}
              <button className="btn small" onClick={() => session.voteRematch?.()}>
                👍
              </button>
            </>
          )}
        </span>
      )}
    </div>
  );
}
