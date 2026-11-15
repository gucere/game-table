import { useRef, useState } from 'react';
import { getGame } from '../games';
import { gameName, useLang, useT } from '../i18n';
import { AVATARS, MAX_PROFILES, deleteProfile, newProfileId, resizePicture, saveProfile, switchProfile, useProfiles, type Profile } from '../profile/profile';
import { ACHIEVEMENTS, backupCode, readBackup, resetStats, restoreStats, useStats } from '../profile/stats';
import { useSettings } from '../theme/settings';
import { Avatar } from './Avatar';

function Editor({ start, onDone }: { start: Profile; onDone: () => void }) {
  const t = useT();
  const [p, setP] = useState(start);
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const isNew = !useProfiles().profiles.some((x) => x.id === start.id);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError('');
    try {
      const picture = await resizePicture(f);
      setP((x) => ({ ...x, picture }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="stack-sm profile-editor">
      <div className="row">
        <Avatar name={p.name} avatar={p.avatar} picture={p.picture} size={64} />
        <label className="field grow">
          <span>{t('Name')}</span>
          <input className="input" value={p.name} maxLength={20} placeholder={t('Player')} onChange={(e) => setP({ ...p, name: e.target.value })} />
        </label>
      </div>
      <span className="small">{t('Pick an avatar')}</span>
      <div className="avatar-grid">
        {AVATARS.map((a) => (
          <button key={a.id} className={'avatar-pick' + (p.avatar === a.id && !p.picture ? ' on' : '')} aria-pressed={p.avatar === a.id && !p.picture} aria-label={a.id} onClick={() => setP({ ...p, avatar: a.id, picture: undefined })}>
            <Avatar name="" avatar={a.id} size={40} />
          </button>
        ))}
      </div>
      <div className="row">
        <button className="btn small" onClick={() => file.current?.click()}>
          📷 {t('Use my own picture')}
        </button>
        {p.picture && (
          <button className="btn ghost small" onClick={() => setP({ ...p, picture: undefined })}>
            {t('Remove picture')}
          </button>
        )}
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
      </div>
      <p className="small muted">{t('Your own picture stays on this device and is only shown to friends in private rooms. Public rooms always show your avatar instead.')}</p>
      {error && <p className="notice">{t(error)}</p>}
      <div className="row">
        <button
          className="btn primary"
          onClick={() => {
            saveProfile(p);
            onDone();
          }}
        >
          {isNew ? t('Create profile') : t('Save')}
        </button>
        <button className="btn ghost" onClick={onDone}>
          {t('Cancel')}
        </button>
        {!isNew && (
          <button
            className="btn ghost danger"
            onClick={() => {
              if (confirm(t('Delete this profile and its stats from this device?'))) {
                deleteProfile(p.id);
                onDone();
              }
            }}
          >
            {t('Delete profile')}
          </button>
        )}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const t = useT();
  const lang = useLang();
  const { profiles, current } = useProfiles();
  const settings = useSettings();
  const me = profiles.find((p) => p.id === current) ?? null;
  const owner = current ?? 'guest';
  const stats = useStats(owner);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [restore, setRestore] = useState('');
  const [msg, setMsg] = useState('');

  const games = Object.entries(stats.games).sort((a, b) => b[1].played - a[1].played);
  const played = games.reduce((n, [, g]) => n + g.played, 0);
  const won = games.reduce((n, [, g]) => n + g.won, 0);
  const earned = ACHIEVEMENTS.filter((a) => stats.achievements[a.id]).length;

  const copyBackup = async () => {
    const code = backupCode(me, owner);
    try {
      await navigator.clipboard.writeText(code);
      setMsg(t('Backup code copied. Paste it on your other device.'));
    } catch {
      setRestore(code);
      setMsg(t('Copy the code from the box below.'));
    }
  };

  const doRestore = () => {
    const b = readBackup(restore);
    if (!b) {
      setMsg(t('That backup code doesn’t look right.'));
      return;
    }
    const p = b.profile as Partial<Profile> | null;
    if (p && typeof p.name === 'string') {
      const id = typeof p.id === 'string' ? p.id : newProfileId();
      saveProfile({ id, name: p.name, avatar: typeof p.avatar === 'string' ? p.avatar : 'fox', picture: typeof p.picture === 'string' ? p.picture : undefined, createdAt: Number(p.createdAt) || Date.now() });
      restoreStats(id, b.stats);
    } else restoreStats(owner, b.stats);
    setRestore('');
    setMsg(t('Restored ✓'));
  };

  return (
    <div className="panel stack">
      <a href="#/" className="back">
        ← {t('All games')}
      </a>
      <h1>{t('Profile')}</h1>

      <section className="stack-sm">
        <div className="row profile-now">
          <Avatar name={me?.name ?? settings.name ?? '?'} avatar={me?.avatar} picture={me?.picture} size={56} />
          <div className="grow">
            <strong>{me ? me.name : t('Guest')}</strong>
            <p className="small muted">{me ? t('Your stats and achievements are saved with this profile on this device.') : t('You’re playing as a guest. Make a profile to get an avatar and keep your stats apart from others on this device.')}</p>
          </div>
          {me && !editing && (
            <button className="btn small" onClick={() => setEditing(me)}>
              ✏️ {t('Edit')}
            </button>
          )}
        </div>

        {editing ? (
          <Editor key={editing.id} start={editing} onDone={() => setEditing(null)} />
        ) : (
          <div className="row wrap">
            <button className={'chip-btn' + (!me ? ' on' : '')} onClick={() => switchProfile(null)}>
              <Avatar name="?" size={22} /> {t('Guest')}
            </button>
            {profiles.map((p) => (
              <button key={p.id} className={'chip-btn' + (p.id === current ? ' on' : '')} onClick={() => switchProfile(p.id)}>
                <Avatar name={p.name} avatar={p.avatar} picture={p.picture} size={22} /> {p.name}
              </button>
            ))}
            {profiles.length < MAX_PROFILES && (
              <button className="chip-btn" onClick={() => setEditing({ id: newProfileId(), name: settings.name, avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)].id, createdAt: Date.now() })}>
                + {t('New profile')}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="stack-sm">
        <h2 className="section-title">{t('Stats')}</h2>
        <div className="stat-tiles">
          <div className="stat-tile">
            <strong>{played}</strong>
            <span className="small muted">{t('games finished')}</span>
          </div>
          <div className="stat-tile">
            <strong>{won}</strong>
            <span className="small muted">{t('wins')}</span>
          </div>
          <div className="stat-tile">
            <strong>{played ? Math.round((won / played) * 100) : 0}%</strong>
            <span className="small muted">{t('win rate')}</span>
          </div>
          <div className="stat-tile">
            <strong>{stats.bestStreak}</strong>
            <span className="small muted">{t('best streak')}</span>
          </div>
        </div>
        {games.length > 0 ? (
          <table className="stat-table small">
            <thead>
              <tr>
                <th>{t('Game')}</th>
                <th>{t('Played')}</th>
                <th>{t('Won')}</th>
                <th>{t('Best streak')}</th>
              </tr>
            </thead>
            <tbody>
              {games.map(([id, g]) => {
                const def = getGame(id);
                return (
                  <tr key={id}>
                    <td>
                      {def?.icon} {def ? gameName(def, lang) : id}
                    </td>
                    <td>{g.played}</td>
                    <td>{g.won}</td>
                    <td>{g.best}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="small muted">{t('Finish a game and it shows up here.')}</p>
        )}
      </section>

      <section className="stack-sm">
        <h2 className="section-title">
          {t('Achievements')} ({earned}/{ACHIEVEMENTS.length})
        </h2>
        <div className="ach-grid">
          {ACHIEVEMENTS.map((a) => {
            const at = stats.achievements[a.id];
            return (
              <div key={a.id} className={'ach' + (at ? ' got' : '')} title={at ? new Date(at).toLocaleDateString(lang) : undefined}>
                <span className="ach-icon" aria-hidden>
                  {at ? a.icon : '🔒'}
                </span>
                <span>
                  <strong className="small">{t(a.name)}</strong>
                  <span className="small muted block">{t(a.description)}</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="stack-sm">
        <h2 className="section-title">{t('Backup')}</h2>
        <p className="small muted">{t('Profiles and stats are saved on this device only. To move them to another device, copy a backup code here and restore it there.')}</p>
        <div className="row wrap">
          <button className="btn small" onClick={() => void copyBackup()}>
            {t('Copy backup code')}
          </button>
          <button
            className="btn ghost small"
            onClick={() => {
              if (confirm(t('Clear all stats and achievements for {name}?', { name: me?.name ?? t('Guest') }))) resetStats(owner);
            }}
          >
            {t('Reset stats')}
          </button>
        </div>
        <textarea className="input" rows={2} value={restore} placeholder={t('Paste a backup code to restore it')} onChange={(e) => setRestore(e.target.value)} />
        {restore.trim() && (
          <button className="btn small" onClick={doRestore}>
            {t('Restore')}
          </button>
        )}
        {msg && <p className="small">{msg}</p>}
      </section>
    </div>
  );
}
