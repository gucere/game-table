import { useEffect, useState } from 'react';
import { accountsEnabled, createAccount, deleteAccount, resetPassword, signInWithEmail, signInWithGoogle, signOut, useAccount, wakeAccount } from '../account/account';
import { useT } from '../i18n';

const SYNC_TEXT = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved to your account ✓',
  offline: 'Offline. It will save when you’re back online.',
  error: 'Couldn’t save just now. It will try again.',
} as const;

/** Sign in / out, shown at the top of the profile page when accounts are set up */
export function AccountPanel() {
  const t = useT();
  const acct = useAccount();
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => wakeAccount(), []);
  if (!accountsEnabled()) return null;

  const go = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setNote('');
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  if (acct.status === 'signed-in') {
    return (
      <section className="stack-sm account-panel">
        <h2 className="section-title">☁️ {t('Account')}</h2>
        <p className="small">
          {t('Signed in as {email}.', { email: acct.email ?? '' })} {t('Your profile, picture, stats and achievements are saved to your account and come with you to every device where you sign in.')}
        </p>
        {acct.sync !== 'idle' && <p className="small muted">{t(SYNC_TEXT[acct.sync])}</p>}
        {acct.error && <p className="notice">{t(acct.error)}</p>}
        <div className="row wrap">
          <button className="btn small" disabled={busy} onClick={() => void go(signOut)}>
            {t('Sign out')}
          </button>
          <button
            className="btn ghost small danger"
            disabled={busy}
            onClick={() => {
              if (confirm(t('Delete your account? Your profile, stats and achievements will be erased from the account for good.'))) void go(deleteAccount);
            }}
          >
            {t('Delete my account')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="stack-sm account-panel">
      <h2 className="section-title">☁️ {t('Account (optional)')}</h2>
      <p className="small muted">{t('Sign in to keep your profile, stats and achievements on all your devices. Without an account, everything stays on this device as before.')}</p>
      {acct.status === 'loading' ? (
        <p className="small muted">{t('Loading…')}</p>
      ) : (
        <>
          <button className="btn google-btn" disabled={busy} onClick={() => void go(signInWithGoogle)}>
            <span aria-hidden>G</span> {t('Continue with Google')}
          </button>
          <span className="small muted">{t('or with an email and password:')}</span>
          <form
            className="stack-sm narrow-field"
            onSubmit={(e) => {
              e.preventDefault();
              void go(() => (mode === 'create' ? createAccount(email, password) : signInWithEmail(email, password)));
            }}
          >
            <input className="input" type="email" autoComplete="email" placeholder={t('Email')} value={email} onChange={(e) => setEmail(e.target.value)} />
            <input
              className="input"
              type="password"
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              placeholder={mode === 'create' ? t('Password (at least 6 characters)') : t('Password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="row wrap">
              <button className="btn primary" type="submit" disabled={busy || !email || !password}>
                {mode === 'create' ? t('Create account') : t('Sign in')}
              </button>
              <button type="button" className="btn ghost small" onClick={() => setMode(mode === 'create' ? 'signin' : 'create')}>
                {mode === 'create' ? t('I already have an account') : t('New here? Create an account')}
              </button>
              {mode === 'signin' && (
                <button
                  type="button"
                  className="btn ghost small"
                  disabled={busy}
                  onClick={() => {
                    if (!email.trim()) {
                      setNote(t('Type your email first.'));
                      return;
                    }
                    void go(async () => {
                      if (await resetPassword(email)) setNote(t('If there’s an account with that email, a link to set a new password is on its way.'));
                    });
                  }}
                >
                  {t('Forgot password?')}
                </button>
              )}
            </div>
          </form>
        </>
      )}
      {acct.error && <p className="notice">{t(acct.error)}</p>}
      {note && <p className="small">{note}</p>}
      <p className="small muted">
        {t('By signing in you agree to the')} <a href="#/privacy">{t('privacy note')}</a>. {t('You need to be 16 or older, or have a parent’s permission.')}
      </p>
    </section>
  );
}
