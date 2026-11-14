import { useState } from 'react';
import { LocalSession } from '../engine/localSession';
import { HostSession } from '../engine/online';
import type { Session } from '../engine/session';
import { defaultOptions, type BotLevel, type GameDef, type GameOptions, type PlayerInfo } from '../engine/types';
import { getGame } from '../games';
import { gameName, gameRules, gameTagline, otherName, t as tt, useLang, useT } from '../i18n';
import { getSettings, updateSettings } from '../theme/settings';

interface SeatDraft {
  kind: 'human' | 'bot';
  name: string;
  level: BotLevel;
}

function defaultSeats(game: GameDef, myName: string): SeatDraft[] {
  const hasBot = !!game.bot;
  // Card games default to a full table; others to the minimum
  const n = game.defaultPlayers ?? (game.maxPlayers <= 4 && game.hiddenInfo ? game.maxPlayers : Math.max(game.minPlayers, 1));
  return Array.from({ length: n }, (_, i) => ({
    kind: i === 0 || !hasBot ? 'human' : 'bot',
    name: i === 0 ? myName || tt('Player {n}', { n: 1 }) : hasBot ? `Bot ${i}` : tt('Player {n}', { n: i + 1 }),
    level: 'normal',
  }));
}

export function OptionsForm({
  game,
  options,
  onChange,
  readOnly,
}: {
  game: GameDef;
  options: GameOptions;
  onChange?: (id: string, value: string) => void;
  readOnly?: boolean;
}) {
  const t = useT();
  if (!game.options?.length) return null;
  return (
    <div className="options-grid">
      {game.options.map((o) => (
        <label className="field" key={o.id}>
          <span>{t(o.label)}</span>
          {readOnly ? (
            <strong>{t(o.choices.find((c) => c.value === options[o.id])?.label ?? options[o.id])}</strong>
          ) : (
            <select className="input" value={options[o.id] ?? o.default} onChange={(e) => onChange?.(o.id, e.target.value)}>
              {o.choices.map((c) => (
                <option key={c.value} value={c.value}>
                  {t(c.label)}
                </option>
              ))}
            </select>
          )}
        </label>
      ))}
    </div>
  );
}

export function Setup({ gameId, onStart }: { gameId: string; onStart: (s: Session) => void }) {
  const game = getGame(gameId)!;
  const t = useT();
  const lang = useLang();
  const aka = otherName(game, lang);
  const canLocal = !game.onlineOnly;
  const canOnline = game.maxPlayers >= 2 && !game.localOnly;
  const [mode, setMode] = useState<'local' | 'online'>(canLocal ? 'local' : 'online');
  const [myName, setMyName] = useState(getSettings().name);
  const [seats, setSeats] = useState(() => defaultSeats(game, getSettings().name));
  const [options, setOptions] = useState<GameOptions>(() => defaultOptions(game));

  const patch = (i: number, p: Partial<SeatDraft>) =>
    setSeats((s) =>
      s.map((x, j) => {
        if (j !== i) return x;
        const next = { ...x, ...p };
        // Keep default names sensible when switching between person and bot
        if (p.kind && /^(Bot \d+|Player \d+|Oyuncu \d+)$/.test(x.name)) next.name = p.kind === 'bot' ? `Bot ${i}` : t('Player {n}', { n: i + 1 });
        return next;
      }),
    );

  const startLocal = () => {
    const players: PlayerInfo[] = seats.map((s, i) => ({
      name: s.name.trim() || (s.kind === 'bot' ? `Bot ${i}` : t('Player {n}', { n: i + 1 })),
      kind: s.kind,
      level: s.kind === 'bot' ? s.level : undefined,
    }));
    onStart(new LocalSession(game, players, options));
  };

  const startOnline = () => {
    const name = myName.trim() || t('Host');
    updateSettings({ name: myName.trim() });
    onStart(new HostSession(game.id, name));
  };

  return (
    <div className="panel stack">
      <a href="#/" className="back">
        ← {t('All games')}
      </a>
      <div className="setup-head">
        <span className="game-icon big" aria-hidden>
          {game.icon}
        </span>
        <div>
          <h1>
            {gameName(game, lang)}
            {aka && <span className="game-aka"> · {aka}</span>}
          </h1>
          <p className="muted">{gameTagline(game, lang)}</p>
        </div>
      </div>
      {game.rules && <p className="small rules-text">{gameRules(game, lang)}</p>}

      {canLocal && canOnline && (
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'local'} className={mode === 'local' ? 'tab on' : 'tab'} onClick={() => setMode('local')}>
            {t('On this device')}
          </button>
          <button role="tab" aria-selected={mode === 'online'} className={mode === 'online' ? 'tab on' : 'tab'} onClick={() => setMode('online')}>
            {t('Online with friends')}
          </button>
        </div>
      )}

      {mode === 'local' ? (
        <div className="stack">
          <OptionsForm game={game} options={options} onChange={(id, v) => setOptions((o) => ({ ...o, [id]: v }))} />
          {game.maxPlayers > 1 && (
            <>
              <p className="muted small">
                {t('Play against bots, or pass the device between friends.')}
                {game.hiddenInfo && ' ' + t('The screen is hidden between turns so nobody peeks.')}
              </p>
              <div className="seat-list">
                {seats.map((s, i) => (
                  <div className="seat-row" key={i}>
                    <span className="seat-dot" style={{ background: `var(--p${i})` }} />
                    <input className="input" value={s.name} maxLength={20} aria-label={t('Seat {n} name', { n: i + 1 })} onChange={(e) => patch(i, { name: e.target.value })} />
                    {game.bot && (
                      <select className="input" value={s.kind} onChange={(e) => patch(i, { kind: e.target.value as SeatDraft['kind'] })} aria-label={`Seat ${i + 1} type`}>
                        <option value="human">{t('Person')}</option>
                        <option value="bot">{t('Bot')}</option>
                      </select>
                    )}
                    {s.kind === 'bot' && (
                      <select className="input" value={s.level} onChange={(e) => patch(i, { level: e.target.value as BotLevel })} aria-label={`Seat ${i + 1} bot level`}>
                        <option value="easy">{t('Easy')}</option>
                        <option value="normal">{t('Normal')}</option>
                        <option value="hard">{t('Hard')}</option>
                      </select>
                    )}
                    {seats.length > game.minPlayers && (
                      <button className="icon-btn" aria-label={t('Remove seat')} onClick={() => setSeats((x) => x.filter((_, j) => j !== i))}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {seats.length < game.maxPlayers && (
                <button
                  className="btn ghost"
                  onClick={() =>
                    setSeats((x) => [...x, { kind: game.bot ? 'bot' : 'human', name: game.bot ? `Bot ${x.length}` : t('Player {n}', { n: x.length + 1 }), level: 'normal' }])
                  }
                >
                  + {t('Add seat')}
                </button>
              )}
            </>
          )}
          <button className="btn primary" onClick={startLocal}>
            {t('Start game')}
          </button>
        </div>
      ) : (
        <div className="stack">
          <p className="muted small">
            {t('You host a room and get a code. Friends open this site, tap Join a room and enter the code, on the same Wi-Fi or anywhere online. The game runs in your browser and goes straight to your friends, with no game server involved. You pick options in the room.')}
          </p>
          <label className="field">
            <span>{t('Your name')}</span>
            <input className="input" value={myName} maxLength={20} placeholder={t('Host')} onChange={(e) => setMyName(e.target.value)} />
          </label>
          <button className="btn primary" onClick={startOnline}>
            {t('Create room')}
          </button>
        </div>
      )}
    </div>
  );
}
