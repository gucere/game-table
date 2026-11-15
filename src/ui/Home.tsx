import { useState } from 'react';
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

export function Home({ onEnterPublic }: { onEnterPublic?: (code: string) => void }) {
  const t = useT();
  const lang = useLang();
  const byId = new Map(GAMES.map((g) => [g.id, g]));
  return (
    <div className="stack-lg">
      <section className="hero">
        <h1>{t('Pick a game')}</h1>
        <p className="muted">{t('Play alone against bots, pass one device around, or play online with friends straight from the browser, peer to peer.')}</p>
      </section>

      {SECTIONS.map((sec) => (
        <section key={sec.title}>
          <h2 className="section-title">{t(sec.title)}</h2>
          <div className="game-grid">
            {sec.ids
              .map((id) => byId.get(id))
              .filter((g) => !!g)
              .map((g) => {
                const aka = otherName(g!, lang);
                return (
                  <a key={g!.id} className="game-card" href={`#/game/${g!.id}`}>
                    <span className="game-icon" aria-hidden>
                      {g!.icon}
                    </span>
                    <span className="game-name">
                      {gameName(g!, lang)}
                      {aka && <span className="game-aka"> · {aka}</span>}
                    </span>
                    <span className="muted small">{gameTagline(g!, lang)}</span>
                    <span className="row">
                      <span className="chip">{players(t, g!.minPlayers, g!.maxPlayers)}</span>
                      {g!.onlineOnly && <span className="chip">{t('online')}</span>}
                      {g!.bot && <span className="chip">{t('bots')}</span>}
                    </span>
                  </a>
                );
              })}
          </div>
        </section>
      ))}

      {onEnterPublic && <PublicRooms onEnter={onEnterPublic} />}

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
