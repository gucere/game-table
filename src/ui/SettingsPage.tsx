import { LANGS, useT } from '../i18n';
import { updateSettings, useSettings } from '../theme/settings';
import { LookSections } from './LookSections';

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

      <label className="field narrow-field">
        <span>{t('Your name (used when you play online)')}</span>
        <input className="input" value={s.name} maxLength={20} placeholder={t('Player')} onChange={(e) => updateSettings({ name: e.target.value })} />
      </label>

      <LookSections />

      <p className="muted small">{t('Settings are saved on this device only. You can also change them during a game with the 🎨 button.')}</p>
    </div>
  );
}
