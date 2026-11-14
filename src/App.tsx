import { useEffect, useState } from 'react';
import type { Session } from './engine/session';
import { getGame } from './games';
import { LANGS, t, useLang, useT } from './i18n';
import { updateSettings } from './theme/settings';
import { Home } from './ui/Home';
import { Join } from './ui/Join';
import { TriviaImport } from './games/trivia';
import { SantaPage, SantaReveal } from './santa/SantaPage';
import { RejoinBanner } from './ui/RoomExtras';
import { SessionScreen } from './ui/SessionScreen';
import { SettingsPage } from './ui/SettingsPage';
import { Setup } from './ui/Setup';

type Route =
  | { page: 'home' }
  | { page: 'game'; id: string }
  | { page: 'join'; code: string }
  | { page: 'settings' }
  | { page: 'santa' }
  | { page: 'santa-reveal'; token: string }
  | { page: 'trivia'; token: string };

function parseHash(): Route {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'game' && parts[1] && getGame(parts[1])) return { page: 'game', id: parts[1] };
  if (parts[0] === 'join') return { page: 'join', code: parts[1] ?? '' };
  if (parts[0] === 'settings') return { page: 'settings' };
  if (parts[0] === 'trivia' && parts[1]) return { page: 'trivia', token: parts[1] };
  if (parts[0] === 'santa') return parts[1] === 'r' && parts[2] ? { page: 'santa-reveal', token: parts[2] } : { page: 'santa' };
  return { page: 'home' };
}

export function navigate(path: string) {
  window.location.hash = path;
}

function LangSwitch() {
  const lang = useLang();
  const tr = useT();
  return (
    <select className="lang-select" value={lang} onChange={(e) => updateSettings({ lang: e.target.value as typeof lang })} aria-label={tr('Language')}>
      {LANGS.map((l) => (
        <option key={l.id} value={l.id}>
          {l.flag} {l.name}
        </option>
      ))}
    </select>
  );
}

export function App() {
  const tr = useT();
  const [route, setRoute] = useState(parseHash);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Warn before closing the tab mid-session
  useEffect(() => {
    if (!session) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [session]);

  const leave = () => {
    session?.leave();
    setSession(null);
    navigate('/');
  };

  let content;
  if (session) content = <SessionScreen session={session} onLeave={leave} />;
  else if (route.page === 'game') content = <Setup key={route.id} gameId={route.id} onStart={setSession} />;
  else if (route.page === 'join') content = <Join key={route.code} initialCode={route.code} onJoin={setSession} />;
  else if (route.page === 'settings') content = <SettingsPage />;
  else if (route.page === 'santa') content = <SantaPage />;
  else if (route.page === 'santa-reveal') content = <SantaReveal token={route.token} />;
  else if (route.page === 'trivia') content = <TriviaImport token={route.token} />;
  else content = <Home />;

  return (
    <div className="app">
      <header className="topbar">
        <a
          className="brand"
          href="#/"
          onClick={(e) => {
            if (session) {
              e.preventDefault();
              if (confirm(t('Leave this game?'))) leave();
            }
          }}
        >
          <span className="brand-mark">◆</span> {tr('Game Table')}
        </a>
        <nav className="topnav">
          {!session && <a href="#/join">{tr('Join a room')}</a>}
          {!session && <a href="#/settings">{tr('Customize')}</a>}
          <LangSwitch />
        </nav>
      </header>
      <main className="page">
        {!session && route.page !== 'santa-reveal' && <RejoinBanner onStart={setSession} />}
        {content}
      </main>
      <footer className="site-footer">
        <p>{tr('Made for fun, not for profit. Free for everyone to play, share and use.')}</p>
        <p>
          {tr('Vibe-coded with an AI assistant (Claude).')}{' '}
          <a href="https://github.com/gucere/game-table" target="_blank" rel="noreferrer">
            {tr('Source code on GitHub')}
          </a>
        </p>
      </footer>
    </div>
  );
}
