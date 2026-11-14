import { GAMES, SECTIONS } from '../games';
import { gameName, gameTagline, otherName, useLang, useT, type T } from '../i18n';

function players(t: T, min: number, max: number) {
  if (min === max) return min === 1 ? t('1 player') : t('{n} players', { n: min });
  return t('{n} players', { n: `${min}–${max}` });
}

export function Home() {
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

      <section>
        <h2 className="section-title">{t('Tools')}</h2>
        <div className="game-grid">
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
