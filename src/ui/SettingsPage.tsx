import { LANGS, useT } from '../i18n';
import { updateSettings, useSettings } from '../theme/settings';
import { LookSections } from './LookSections';
import { playSound } from './sound';

export function SettingsPage() {
  const s = useSettings();
  const t = useT();
  return (
    <div className="panel stack">
      <a href="#/" className="back">
        ← {t('All games')}
      </a>
      <h1>{t('Customize')}</h1>

      <section className="stack-sm">
        <h2 className="section-title">{t('Language')}</h2>
        <div className="row">
          {LANGS.map((l) => (
            <button key={l.id} className={'btn' + (s.lang === l.id ? ' primary' : '')} onClick={() => updateSettings({ lang: l.id })}>
              {l.flag} {l.name}
            </button>
          ))}
        </div>
      </section>

      <p className="small">
        <a href="#/profile">👤 {t('Profile, avatar, stats and achievements')} →</a>
      </p>

      <label className="field narrow-field">
        <span>{t('Your name (used when you play online)')}</span>
        <input className="input" value={s.name} maxLength={20} placeholder={t('Player')} onChange={(e) => updateSettings({ name: e.target.value })} />
      </label>

      <section className="stack-sm">
        <h2 className="section-title">{t('Sound and vibration')}</h2>
        <label className="check-row">
          <input type="checkbox" checked={s.sound} onChange={(e) => updateSettings({ sound: e.target.checked })} />
          <span>{t('Sound effects')}</span>
        </label>
        {s.sound && (
          <label className="field narrow-field">
            <span>{t('Volume')}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={s.volume}
              onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
              onPointerUp={() => playSound('turn')}
              onKeyUp={() => playSound('turn')}
            />
          </label>
        )}
        <label className="check-row">
          <input type="checkbox" checked={s.vibrate} onChange={(e) => updateSettings({ vibrate: e.target.checked })} />
          <span>
            {t('Vibrate on your turn and at the end of a game')}
            <br />
            <span className="small muted">{t('On phones that support it.')}</span>
          </span>
        </label>
      </section>

      <section className="stack-sm">
        <h2 className="section-title">{t('Accessibility')}</h2>
        <label className="check-row">
          <input type="checkbox" checked={s.colorblind} onChange={(e) => updateSettings({ colorblind: e.target.checked })} />
          <span>
            {t('Colorblind-friendly colors')}
            <br />
            <span className="small muted">{t('Player colors that stay apart for all common kinds of color blindness, and blue/orange instead of green/yellow in word games.')}</span>
          </span>
        </label>
      </section>

      <LookSections />

      <p className="muted small">{t('Settings are saved on this device only. You can also change them during a game with the 🎨 button.')}</p>
    </div>
  );
}
