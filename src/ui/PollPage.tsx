import { useState } from 'react';
import { HostSession } from '../engine/online';
import type { Session } from '../engine/session';
import { useT } from '../i18n';
import { markOpened } from '../profile/stats';
import { getSettings, updateSettings } from '../theme/settings';
import { requestPollComposer } from './Polls';

/** The Poll tool: opens a private room with the poll form ready; friends join with the code */
export function PollPage({ onStart }: { onStart: (s: Session) => void }) {
  const t = useT();
  const [name, setName] = useState(getSettings().name);
  return (
    <div className="panel stack narrow">
      <a href="#/" className="back">
        ← {t('All games')}
      </a>
      <h1>📊 {t('Poll')}</h1>
      <p className="muted">{t('Ask your friends something and see the answers come in live. You open a private room; friends join with its code, link or QR code and vote from their own phones.')}</p>
      <ul className="small muted poll-points">
        <li>{t('Up to 8 answers; one each or several.')}</li>
        <li>{t('Show who voted for what, or keep it anonymous.')}</li>
        <li>{t('Start as many polls as you like. Nothing is saved: they end when the room closes.')}</li>
      </ul>
      <label className="field">
        <span>{t('Your name')}</span>
        <input className="input" value={name} maxLength={20} placeholder={t('Host')} onChange={(e) => setName(e.target.value)} />
      </label>
      <button
        className="btn primary"
        onClick={() => {
          updateSettings({ name: name.trim() });
          requestPollComposer();
          markOpened('sohbet-odasi');
          onStart(new HostSession('sohbet-odasi', name.trim() || t('Host')));
        }}
      >
        📊 {t('Open a poll room')}
      </button>
      <p className="small muted">{t('Already in a room? Tap 💬 and then 📊 to start a poll there, even in the middle of a game.')}</p>
    </div>
  );
}
