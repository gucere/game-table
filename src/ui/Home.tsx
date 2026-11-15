import { useState } from 'react';
import type { GameDef } from '../engine/types';
import { NO_FILTERS, filtering, findGames, type Filters, type Mode } from '../games/finder';
import { isLiked, likedIds, recentIds } from '../profile/stats';
import { LikeButton, useMyStats } from './LikeButton';
import { PUBLIC_ROOMS, acceptRules, rulesAccepted } from '../engine/lounge';
import { GAMES, SECTIONS } from '../games';
import { gameName, gameTagline, otherName, useLang, useT, type T } from '../i18n';

function players(t: T, min: number, max: number) {
  if (min === max) return min === 1 ? t('1 player') : t('{n} players', { n: min });
  return t('{n} players', { n: `${min}–${max}` });
}

/** Public rooms: everyone confirms the rules once before walking in */
function PublicRooms({ onEnter }: { onEnter: (code: string) => void }) {
  const t = useT();
  const [asking, setAsking] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const enter = (code: string) => (rulesAccepted() ? onEnter(code) : setAsking(code));
  return (
    <section>
      <h2 className="section-title">{t('Public rooms')}</h2>
      <p className="small muted">{t('Drop in to chat, talk or turn on your camera with whoever is there. For friends only, open a private room with a code instead.')}</p>
      <div className="game-grid">
        {PUBLIC_ROOMS.map((r) => (
          <button key={r.code} className="game-card public-room" onClick={() => enter(r.code)}>
            <span className="game-icon" aria-hidden>
              {r.icon}
            </span>
            <span className="game-name">{t(r.name)}</span>
            <span className="row">
              <span className="chip">{t('public')}</span>
              <span className="chip">{t('chat · voice · camera')}</span>
            </span>
          </button>
        ))}
      </div>
      {asking && (
        <div className="wt-blank-pick public-rules" role="dialog" aria-label={t('Public room rules')}>
          <strong>{t('Public room rules')}</strong>
          <ul className="small">
            <li>{t('Anyone can come in, and you don’t know who they are. Don’t share personal details (address, phone, school, passwords).')}</li>
            <li>{t('Be kind. No harassment, hate, sexual content or anything illegal. You are responsible for what you say and show.')}</li>
            <li>{t('Pictures and files can’t be shared here. Nothing is recorded or kept, but others could still take a screenshot.')}</li>
            <li>{t('Use Hide to stop seeing or hearing someone, and vote to remove anyone who breaks the rules.')}</li>
          </ul>
          <label className="row small">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            {t('I am 18 or older and I agree to these rules.')}
          </label>
          <div className="row center">
            <button
              className="btn primary"
              disabled={!agree}
              onClick={() => {
                acceptRules();
                const code = asking;
                setAsking(null);
                onEnter(code);
              }}
            >
              {t('Enter')}
            </button>
            <button className="btn ghost" onClick={() => setAsking(null)}>
              {t('Cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function GameCard({ g }: { g: GameDef }) {
  const t = useT();
  const lang = useLang();
  const aka = otherName(g, lang);
  const name = gameName(g, lang);
  return (
    <div className="game-card-wrap">
      <a className="game-card" href={`#/game/${g.id}`}>
        <span className="game-icon" aria-hidden>
          {g.icon}
        </span>
        <span className="game-name">
          {name}
          {aka && <span className="game-aka"> · {aka}</span>}
        </span>
        <span className="muted small">{gameTagline(g, lang)}</span>
        <span className="row">
          <span className="chip">{players(t, g.minPlayers, g.maxPlayers)}</span>
          {g.onlineOnly && <span className="chip">{t('online')}</span>}
          {g.bot && <span className="chip">{t('bots')}</span>}
        </span>
      </a>
      <LikeButton id={g.id} name={name} />
    </div>
  );
}

function Row({ title, games }: { title: string; games: GameDef[] }) {
  const t = useT();
  if (!games.length) return null;
  return (
    <section>
      <h2 className="section-title">{t(title)}</h2>
      <div className="game-grid">
        {games.map((g) => (
          <GameCard key={g.id} g={g} />
        ))}
      </div>
    </section>
  );
}

// Remembered while you look at a game and come back
let lastFilters: Filters = NO_FILTERS;

const MODES: { id: Mode; label: string }[] = [
  { id: 'any', label: 'Any way' },
  { id: 'bots', label: '🤖 Against bots' },
  { id: 'device', label: '📱 On one device' },
  { id: 'online', label: '🌐 Online' },
];

export function Home({ onEnterPublic }: { onEnterPublic?: (code: string) => void }) {
  const t = useT();
  const byId = new Map(GAMES.map((g) => [g.id, g]));
  const stats = useMyStats();
  const [f, setF] = useState<Filters>(lastFilters);
  const update = (patch: Partial<Filters>) =>
    setF((x) => {
      lastFilters = { ...x, ...patch };
      return lastFilters;
    });
  // Every game on the home page, in section order
  const all = SECTIONS.flatMap((s) => s.ids.map((id) => byId.get(id)).filter((g): g is GameDef => !!g));
  const liked = (id: string) => isLiked(stats, id);
  const active = filtering(f);
  const found = active ? findGames(all, f, liked) : all;
  const pick = (id: string) => byId.get(id);
  const likedGames = likedIds(stats).map(pick).filter((g): g is GameDef => !!g && all.includes(g));
  const recent = recentIds(stats, 6).map(pick).filter((g): g is GameDef => !!g && all.includes(g));

  return (
    <div className="stack-lg">
      <section className="hero">
        <h1>{t('Pick a game')}</h1>
        <p className="muted">{t('Play alone against bots, pass one device around, or play online with friends straight from the browser, peer to peer.')}</p>
      </section>

      <section className="finder stack-sm" aria-label={t('Find a game')}>
        <div className="row finder-top">
          <input
            className="input finder-search"
            type="search"
            value={f.q}
            placeholder={t('Search {n} games…', { n: all.length })}
            aria-label={t('Search games')}
            onChange={(e) => update({ q: e.target.value })}
          />
          <button
            className="btn"
            disabled={!found.length}
            title={t('Open a random game from the ones shown')}
            onClick={() => {
              const g = found[Math.floor(Math.random() * found.length)];
              if (g) window.location.hash = `/game/${g.id}`;
            }}
          >
            🎲 {t('Surprise me')}
          </button>
        </div>
        <div className="row finder-chips">
          <span className="small muted">{t('Players')}:</span>
          {[null, 1, 2, 3, 4, 5, 6].map((n) => (
            <button key={String(n)} className={'chip-btn small-chip' + (f.players === n ? ' on' : '')} aria-pressed={f.players === n} onClick={() => update({ players: n })}>
              {n === null ? t('Any') : n === 6 ? '6+' : n}
            </button>
          ))}
        </div>
        <div className="row finder-chips">
          {MODES.map((m) => (
            <button key={m.id} className={'chip-btn small-chip' + (f.mode === m.id ? ' on' : '')} aria-pressed={f.mode === m.id} onClick={() => update({ mode: m.id })}>
              {t(m.label)}
            </button>
          ))}
          <button className={'chip-btn small-chip' + (f.liked ? ' on' : '')} aria-pressed={f.liked} onClick={() => update({ liked: !f.liked })}>
            ♥ {t('Liked')}
          </button>
          {active && (
            <button className="btn ghost small" onClick={() => update(NO_FILTERS)}>
              ✕ {t('Clear')}
            </button>
          )}
        </div>
      </section>

      {active ? (
        <section>
          <h2 className="section-title">{found.length === 1 ? t('1 game') : t('{n} games', { n: found.length })}</h2>
          {found.length ? (
            <div className="game-grid">
              {found.map((g) => (
                <GameCard key={g.id} g={g} />
              ))}
            </div>
          ) : (
            <p className="muted">{f.liked && !likedGames.length ? t('No liked games yet. Tap ♡ on a game to like it.') : t('No games match. Try fewer filters or another word.')}</p>
          )}
        </section>
      ) : (
        <>
          <Row title="♥ Liked" games={likedGames} />
          <Row title="Recently played" games={recent} />
          {SECTIONS.map((sec) => (
            <Row key={sec.title} title={sec.title} games={sec.ids.map(pick).filter((g): g is GameDef => !!g)} />
          ))}
        </>
      )}

      {!active && onEnterPublic && <PublicRooms onEnter={onEnterPublic} />}

      <section>
        <h2 className="section-title">{t('Tools')}</h2>
        <div className="game-grid">
          <a className="game-card" href="#/game/sohbet-odasi">
            <span className="game-icon" aria-hidden>
              💬
            </span>
            <span className="game-name">{t('Private chat & call room')}</span>
            <span className="muted small">{t('Invite friends with a code to chat, talk, see each other and share your screen.')}</span>
            <span className="row">
              <span className="chip">🔒 {t('private')}</span>
            </span>
          </a>
          <a className="game-card" href="#/santa">
            <span className="game-icon" aria-hidden>
              🎅
            </span>
            <span className="game-name">{t('Secret Santa')}</span>
            <span className="muted small">{t('Draw names for a gift exchange; everyone gets an email with theirs.')}</span>
            <span className="row">
              <span className="chip">{t('{n} players', { n: `3–40` })}</span>
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}
