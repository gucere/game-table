import { useState, type FormEvent } from 'react';
import { ClientSession, normalizeRoomCode } from '../engine/online';
import type { Session } from '../engine/session';
import { useT } from '../i18n';
import { getSettings, updateSettings } from '../theme/settings';

export function Join({ initialCode, onJoin }: { initialCode: string; onJoin: (s: Session) => void }) {
  const t = useT();
  const [code, setCode] = useState(normalizeRoomCode(initialCode));
  const [name, setName] = useState(getSettings().name);
  const ready = code.length === 6;

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    updateSettings({ name: name.trim() });
    onJoin(new ClientSession(code, name.trim() || t('Player')));
  };

  return (
    <form className="panel stack narrow" onSubmit={join}>
      <a href="#/" className="back">
        ← {t('All games')}
      </a>
      <h1>{t('Join a room')}</h1>
      <p className="muted small">{t('Ask the host for the 6-character room code.')}</p>
      <label className="field">
        <span>{t('Room code')}</span>
        <input
          className="input code-input"
          value={code}
          autoFocus={!code}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="ABC123"
          onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
        />
      </label>
      <label className="field">
        <span>{t('Your name')}</span>
        <input className="input" value={name} maxLength={20} placeholder={t('Player')} autoFocus={!!code} onChange={(e) => setName(e.target.value)} />
      </label>
      <button className="btn primary" type="submit" disabled={!ready}>
        {t('Join')}
      </button>
    </form>
  );
}
