import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameDef } from '../engine/types';
import { NO_FILTERS, byLikes, filtering, findGames, type Filters, type Mode } from '../games/finder';
import { accountsEnabled, getFirebase } from '../account/account';
import { likeCounts } from '../account/likes';
import { LENGTH, LENGTH_LABEL, isNew, type Length } from '../games/meta';
import { getPref, isLiked, likedIds, recentIds, setPref } from '../profile/stats';
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

function GameCard({ g, likes }: { g: GameDef; likes?: number }) {
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
        {isNew(g.id) && <span className="new-badge">✨ {t('New')}</span>}
        <span className="game-name">
          {name}
          {aka && <span className="game-aka"> · {aka}</span>}
        </span>
        <span className="muted small">{gameTagline(g, lang)}</span>
        <span className="row">
          <span className="chip">{players(t, g.minPlayers, g.maxPlayers)}</span>
          {LENGTH[g.id] && <span className="chip">{t(LENGTH_LABEL[LENGTH[g.id]])}</span>}
          {likes !== undefined && <span className="chip like-count">♥ {likes}</span>}
          {g.onlineOnly && <span className="chip">{t('online')}</span>}
          {g.bot && <span className="chip">{t('bots')}</span>}
        </span>
      </a>
      <LikeButton id={g.id} name={name} />
    </div>
  );
}

// Remembered while you look at a game and come back: page scroll, each row's sideways
// scroll, and which sections are opened up with "See all"
let pageScroll = 0;
const rowScroll = new Map<string, number>();
const openRows = new Set<string>();

export type Layout = 'rows' | 'grid' | 'list' | 'tiles';
export const LAYOUTS: { id: Layout; icon: string; name: string }[] = [
  { id: 'rows', icon: '⇆', name: 'Rows' },
  { id: 'grid', icon: '▦', name: 'Grid' },
  { id: 'list', icon: '☰', name: 'List' },
  { id: 'tiles', icon: '◼', name: 'Tiles' },
];
const isLayout = (v: unknown): v is Layout => LAYOUTS.some((l) => l.id === v);

/** One compact line: icon, name, players and length */
function GameLine({ g, likes }: { g: GameDef; likes?: number }) {
  const t = useT();
  const lang = useLang();
  const name = gameName(g, lang);
  return (
    <div className="game-line-wrap">
      <a className="game-line" href={`#/game/${g.id}`}>
        <span className="game-line-icon" aria-hidden>
          {g.icon}
        </span>
        <span className="game-line-text">
          <span className="game-line-name">
            {name}
            {isNew(g.id) && <span className="new-badge inline">✨ {t('New')}</span>}
          </span>
          <span className="small muted">
            {players(t, g.minPlayers, g.maxPlayers)}
            {LENGTH[g.id] ? ` · ${t(LENGTH_LABEL[LENGTH[g.id]])}` : ''}
            {g.bot ? ` · ${t('bots')}` : ''}
            {likes !== undefined ? ` · ♥ ${likes}` : ''}
          </span>
        </span>
      </a>
      <LikeButton id={g.id} name={name} />
    </div>
  );
}

/** A big icon with just the name */
function GameTile({ g }: { g: GameDef }) {
  const lang = useLang();
  return (
    <a className="game-tile" href={`#/game/${g.id}`} title={gameTagline(g, lang)}>
      <span className="game-tile-icon" aria-hidden>
        {g.icon}
      </span>
      <span className="game-tile-name">{gameName(g, lang)}</span>
      {isNew(g.id) && <span className="tile-dot" aria-label="New" />}
    </a>
  );
}

/** A set of games drawn in the chosen layout (rows become a grid here) */
function GameSet({ games, layout, likes }: { games: GameDef[]; layout: Layout; likes?: Record<string, number> }) {
  if (layout === 'list')
    return (
      <div className="game-lines">
        {games.map((g) => (
          <GameLine key={g.id} g={g} likes={likes ? (likes[g.id] ?? 0) : undefined} />
        ))}
      </div>
    );
  if (layout === 'tiles')
    return (
      <div className="game-tiles">
        {games.map((g) => (
          <GameTile key={g.id} g={g} />
        ))}
      </div>
    );
  return (
    <div className="game-grid">
      {games.map((g) => (
        <GameCard key={g.id} g={g} likes={likes ? (likes[g.id] ?? 0) : undefined} />
      ))}
    </div>
  );
}

function LayoutPicker({ layout, onPick }: { layout: Layout; onPick: (l: Layout) => void }) {
  const t = useT();
  return (
    <div className="layout-picker" role="radiogroup" aria-label={t('Layout')}>
      {LAYOUTS.map((l) => (
        <button key={l.id} role="radio" aria-checked={layout === l.id} className={'layout-btn' + (layout === l.id ? ' on' : '')} title={t(l.name)} onClick={() => onPick(l.id)}>
          <span aria-hidden>{l.icon}</span> <span className="layout-name">{t(l.name)}</span>
        </button>
      ))}
    </div>
  );
}

function Row({ title, games, layout }: { title: string; games: GameDef[]; layout: Layout }) {
  const t = useT();
  const [all, setAll] = useState(openRows.has(title));
  const strip = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = strip.current;
    if (el && !all) el.scrollLeft = rowScroll.get(title) ?? 0;
  }, [all, title]);
  if (!games.length) return null;
  if (layout !== 'rows')
    return (
      <section>
        <h2 className="section-title">
          {t(title)} <span className="row-count">{games.length}</span>
        </h2>
        <GameSet games={games} layout={layout} />
      </section>
    );
  const nudge = (dir: number) => strip.current?.scrollBy({ left: dir * strip.current.clientWidth * 0.85, behavior: 'smooth' });
  const toggle = () => {
    if (all) openRows.delete(title);
    else openRows.add(title);
    setAll(!all);
  };
  return (
    <section className="game-row-section">
      <div className="row-head">
        <h2 className="section-title">
          {t(title)} <span className="row-count">{games.length}</span>
        </h2>
        {!all && games.length > 2 && (
          <span className="row-arrows">
            <button className="icon-btn" aria-label={t('Scroll left')} onClick={() => nudge(-1)}>
              ‹
            </button>
            <button className="icon-btn" aria-label={t('Scroll right')} onClick={() => nudge(1)}>
              ›
            </button>
          </span>
        )}
        {games.length > 2 && (
          <button className="btn ghost small" onClick={toggle}>
            {all ? t('Show less') : t('See all')}
          </button>
        )}
      </div>
      <div ref={strip} className={all ? 'game-grid' : 'game-strip'} onScroll={(e) => rowScroll.set(title, e.currentTarget.scrollLeft)}>
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
  // The layout follows the profile (and the account, when signed in)
  const pref = getPref(stats, 'homeLayout');
  const layout: Layout = isLayout(pref) ? pref : 'rows';
  const [f, setF] = useState<Filters>(lastFilters);
  const [showFilters, setShowFilters] = useState(false);
  // The open filter panel folds away once you scroll on, so it never covers the games
  const openedAt = useRef(0);
  useEffect(() => {
    if (!showFilters) return;
    openedAt.current = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - openedAt.current) > 160) setShowFilters(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [showFilters]);

  // Coming back from a game: return to the same place on the page
  useLayoutEffect(() => {
    if (pageScroll) window.scrollTo(0, pageScroll);
    const onScroll = () => {
      pageScroll = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      // Leaving the page: the page is still laid out here, so this is the real position
      pageScroll = window.scrollY;
    };
  }, []);
  // Keep the restored place once late content (fonts, pictures) has settled
  useEffect(() => {
    const target = pageScroll;
    if (!target) return;
    const id = requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - target) > 4) window.scrollTo(0, target);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const update = (patch: Partial<Filters>) =>
    setF((x) => {
      lastFilters = { ...x, ...patch };
      return lastFilters;
    });
  // Every game on the home page, in section order
  const all = SECTIONS.flatMap((s) => s.ids.map((id) => byId.get(id)).filter((g): g is GameDef => !!g));
  const liked = (id: string) => isLiked(stats, id);
  const active = filtering(f);
  const filterCount = (f.players !== null ? 1 : 0) + (f.mode !== 'any' ? 1 : 0) + (f.length !== null ? 1 : 0) + (f.liked ? 1 : 0) + (f.fresh ? 1 : 0) + (f.sort !== 'default' ? 1 : 0);
  // Everyone's like counts, loaded only when sorting by them
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [countsFailed, setCountsFailed] = useState(false);
  useEffect(() => {
    if (f.sort !== 'liked' || counts) return;
    let live = true;
    getFirebase()
      .then(likeCounts)
      .then((c) => live && setCounts(c))
      .catch((e) => {
        console.warn('Like counts failed', e);
        if (live) setCountsFailed(true);
      });
    return () => {
      live = false;
    };
  }, [f.sort, counts]);
  const matched = active ? findGames(all, f, liked) : all;
  const found = f.sort === 'liked' && counts ? byLikes(matched, counts) : matched;
  const pick = (id: string) => byId.get(id);
  const likedGames = likedIds(stats).map(pick).filter((g): g is GameDef => !!g && all.includes(g));
  const recent = recentIds(stats, 6).map(pick).filter((g): g is GameDef => !!g && all.includes(g));

  return (
    <div className="stack-lg">
      <section className="hero">
        <div className="hero-top">
          <h1>{t('Pick a game')}</h1>
          <LayoutPicker layout={layout} onPick={(l) => setPref('homeLayout', l)} />
        </div>
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
          <button className={'btn finder-toggle' + (showFilters ? ' on' : '')} aria-expanded={showFilters} onClick={() => setShowFilters((x) => !x)}>
            ⚙ {t('Filters')}
            {filterCount > 0 && <span className="chat-badge static">{filterCount}</span>}
          </button>
          <button
            className="btn finder-surprise"
            disabled={!found.length}
            aria-label={t('Surprise me')}
            title={t('Open a random game from the ones shown')}
            onClick={() => {
              const g = found[Math.floor(Math.random() * found.length)];
              if (g) window.location.hash = `/game/${g.id}`;
            }}
          >
            🎲 <span className="finder-surprise-text">{t('Surprise me')}</span>
          </button>
        </div>
        {showFilters && (
          <div className="stack-sm finder-panel">
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
        </div>
        <div className="row finder-chips">
          {accountsEnabled() && (
            <>
              <span className="small muted">{t('Order')}:</span>
              <button className={'chip-btn small-chip' + (f.sort === 'default' ? ' on' : '')} aria-pressed={f.sort === 'default'} onClick={() => update({ sort: 'default' })}>
                {t('Best match')}
              </button>
              <button className={'chip-btn small-chip' + (f.sort === 'liked' ? ' on' : '')} aria-pressed={f.sort === 'liked'} onClick={() => update({ sort: 'liked' })}>
                ♥ {t('Most liked')}
              </button>
            </>
          )}
        </div>
        <div className="row finder-chips">
          <span className="small muted">{t('Length')}:</span>
          {([null, 'quick', 'medium', 'long'] as (Length | null)[]).map((l) => (
            <button key={String(l)} className={'chip-btn small-chip' + (f.length === l ? ' on' : '')} aria-pressed={f.length === l} onClick={() => update({ length: l })}>
              {l ? t(LENGTH_LABEL[l]) : t('Any')}
            </button>
          ))}
          <button className={'chip-btn small-chip' + (f.liked ? ' on' : '')} aria-pressed={f.liked} onClick={() => update({ liked: !f.liked })}>
            ♥ {t('Liked')}
          </button>
          <button className={'chip-btn small-chip' + (f.fresh ? ' on' : '')} aria-pressed={f.fresh} onClick={() => update({ fresh: !f.fresh })}>
            ✨ {t('New')}
          </button>
        </div>
          </div>
        )}
        {filterCount > 0 && (
          <div className="row finder-active">
            <button className="btn ghost small" onClick={() => update(NO_FILTERS)}>
              ✕ {t('Clear')}
            </button>
          </div>
        )}
      </section>

      {active ? (
        <section>
          <h2 className="section-title">
            {found.length === 1 ? t('1 game') : t('{n} games', { n: found.length })}
            {f.sort === 'liked' && <span className="lb-board"> · {countsFailed ? t('like counts unavailable') : counts ? t('most liked first') : t('Loading…')}</span>}
          </h2>
          {f.sort === 'liked' && counts && <p className="small muted">{t('Likes from signed-in players. Tap ♡ on a game to add yours.')}</p>}
          {found.length ? (
            <GameSet games={found} layout={layout} likes={f.sort === 'liked' && counts ? counts : undefined} />
          ) : (
            <p className="muted">{f.liked && !likedGames.length ? t('No liked games yet. Tap ♡ on a game to like it.') : t('No games match. Try fewer filters or another word.')}</p>
          )}
        </section>
      ) : (
        <>
          <Row title="♥ Liked" games={likedGames} layout={layout} />
          <Row title="Recently played" games={recent} layout={layout} />
          {SECTIONS.map((sec) => (
            <Row key={sec.title} title={sec.title} games={sec.ids.map(pick).filter((g): g is GameDef => !!g)} layout={layout} />
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
          <a className="game-card" href="#/poll">
            <span className="game-icon" aria-hidden>
              📊
            </span>
            <span className="game-name">{t('Poll')}</span>
            <span className="muted small">{t('Ask friends a question and watch the votes come in live.')}</span>
            <span className="row">
              <span className="chip">🔒 {t('private')}</span>
            </span>
          </a>
          <a className="game-card" href="#/dice">
            <span className="game-icon" aria-hidden>
              🎲
            </span>
            <span className="game-name">{t('Dice and coin')}</span>
            <span className="muted small">{t('Roll 1 to 10 dice with 4 to 100 sides, or flip a coin, for games at home.')}</span>
            <span className="row">
              <span className="chip">d4 · d6 · d20 · ₺</span>
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
