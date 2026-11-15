import { useEffect, useState } from 'react';
import { useLang, useT } from '../i18n';
import { SANTA_MAIL_URL } from './config';
import { MAX_PEOPLE, checkPeople, decodeReveal, drawWithExclusions, encodeReveal, type Person, type Reveal } from './draw';

const DRAFT_KEY = 'oyun-masasi:santa-draft';

interface Draft {
  people: Person[];
  budget: string;
  date: string;
  note: string;
  /** Pairs (by name) who may not draw each other */
  exclusions?: [string, string][];
}

function loadDraft(): Draft {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
    if (d && Array.isArray(d.people)) return d;
  } catch {
    /* no saved list */
  }
  return {
    people: [
      { name: '', email: '' },
      { name: '', email: '' },
      { name: '', email: '' },
    ],
    budget: '',
    date: '',
    note: '',
  };
}

const siteUrl = () => window.location.href.split('#')[0];

function niceDate(d: string, lang: string) {
  if (!d) return '';
  const date = new Date(d + 'T12:00:00');
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "Name, email" or "Name <email>" per line */
function parseList(text: string): Person[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const email = /[^\s<>,;]+@[^\s<>,;]+/.exec(line)?.[0] ?? '';
      const name = line.replace(email, '').replace(/[<>,;\t]+/g, ' ').trim();
      return { name, email };
    });
}

type Sent = { kind: 'links'; links: { person: Person; url: string }[] } | { kind: 'auto'; count: number };

export function SantaPage() {
  const t = useT();
  const lang = useLang();
  const [draft, setDraft] = useState(loadDraft);
  const [paste, setPaste] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [sent, setSent] = useState<Sent | null>(null);
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* fine: the list just won't be remembered */
    }
  }, [draft]);

  const people = draft.people;
  const setPeople = (fn: (p: Person[]) => Person[]) => setDraft((d) => ({ ...d, people: fn(d.people) }));
  const filled = () => people.map((p) => ({ name: p.name.trim(), email: p.email.trim() })).filter((p) => p.name || p.email);

  const extras = (r: Pick<Reveal, 'b' | 'd' | 'm'>) =>
    [r.b && t('Budget: {b}', { b: r.b }), r.d && t('Gift exchange: {d}', { d: niceDate(r.d, lang) }), r.m].filter(Boolean).join('\n');

  const validate = () => {
    const list = filled();
    const errs = checkPeople(list);
    setErrors(errs);
    return errs.length ? null : list;
  };

  /** Exclusions as positions in the current list (pairs naming someone not on the list are ignored) */
  const exclusionPairs = (list: Person[]): [number, number][] => {
    const at = (name: string) => list.findIndex((p) => p.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
    return (draft.exclusions ?? []).map(([a, b]) => [at(a), at(b)] as [number, number]).filter(([a, b]) => a >= 0 && b >= 0 && a !== b);
  };

  const drawLinks = () => {
    const list = validate();
    if (!list) return;
    const receiver = drawWithExclusions(list.length, exclusionPairs(list));
    if (!receiver) {
      setErrors([t('These exclusions leave no possible draw. Remove one or add more people.')]);
      return;
    }
    const links = list.map((person, i) => ({
      person,
      url: `${siteUrl()}#/santa/r/${encodeReveal({ g: person.name, r: list[receiver[i]].name, b: draft.budget.trim() || undefined, d: draft.date || undefined, m: draft.note.trim() || undefined, l: lang })}`,
    }));
    setOpened(new Set());
    setSent({ kind: 'links', links });
  };

  const drawAuto = async () => {
    const list = validate();
    if (!list || !SANTA_MAIL_URL) return;
    if (!confirm(t('Send the draw to {n} people now? Everyone gets an email with the name they drew.', { n: list.length }))) return;
    setSending(true);
    try {
      // text/plain keeps this a "simple" request that Apps Script accepts from any site
      const res = await fetch(SANTA_MAIL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ people: list, exclusions: exclusionPairs(list), budget: draft.budget.trim(), date: draft.date, dateText: niceDate(draft.date, lang), note: draft.note.trim(), lang }),
      });
      const out = (await res.json()) as { ok: boolean; sent?: number; error?: string };
      if (!out.ok) throw new Error(out.error || 'failed');
      setSent({ kind: 'auto', count: out.sent ?? list.length });
    } catch (e) {
      setErrors([t('The emails could not be sent: {e}', { e: e instanceof Error ? e.message : String(e) }), t('You can still send them from your own email below.')]);
    } finally {
      setSending(false);
    }
  };

  const mailto = (person: Person, url: string) => {
    const subject = t('🎁 Your Secret Santa draw');
    const more = extras({ b: draft.budget.trim(), d: draft.date, m: draft.note.trim() });
    const body =
      t('Hi {name}!', { name: person.name }) +
      '\n\n' +
      t('The Secret Santa draw is done. Open your private link to see who you are buying a present for, and keep it a secret:') +
      '\n' +
      url +
      (more ? '\n\n' + more : '') +
      '\n';
    return `mailto:${encodeURIComponent(person.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (sent?.kind === 'auto') {
    return (
      <div className="stack santa">
        <h1>🎅 {t('Secret Santa')}</h1>
        <div className="santa-done">
          <p className="big">📬</p>
          <p>{t('Done! {n} emails are on their way. Each person only sees the name they drew.', { n: sent.count })}</p>
          <p className="small muted">{t('Ask everyone to check their spam folder if nothing arrives in a few minutes.')}</p>
        </div>
        <button className="btn" onClick={() => setSent(null)}>
          ← {t('Back to the list')}
        </button>
      </div>
    );
  }

  if (sent?.kind === 'links') {
    return (
      <div className="stack santa">
        <h1>🎅 {t('Secret Santa')}</h1>
        <p>{t('The draw is done. Send each person their email: it opens in your email app, ready to go. Each email has a private link that shows who that person drew.')}</p>
        <p className="small santa-warn">🙈 {t('Don’t open the links yourself, or you’ll see who drew whom.')}</p>
        <ul className="santa-sendlist">
          {sent.links.map(({ person, url }, i) => (
            <li key={i} className={opened.has(i) ? 'done' : ''}>
              <span>
                {opened.has(i) ? '✅ ' : ''}
                <strong>{person.name}</strong> <span className="muted small">{person.email}</span>
              </span>
              <span className="row">
                <a className="btn primary small" href={mailto(person, url)} onClick={() => setOpened((s) => new Set(s).add(i))}>
                  ✉️ {t('Email')}
                </a>
                <button
                  className="btn small"
                  onClick={() => {
                    navigator.clipboard?.writeText(url).then(
                      () => setCopied(i),
                      () => {},
                    );
                    setOpened((s) => new Set(s).add(i));
                  }}
                >
                  {copied === i ? t('Link copied ✓') : t('Copy link')}
                </button>
              </span>
            </li>
          ))}
        </ul>
        <p className="small muted">{t('No email app? Copy each link and send it by message instead.')}</p>
        <div className="row">
          <button className="btn" onClick={() => setSent(null)}>
            ← {t('Back to the list')}
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              if (confirm(t('Draw again? Links you already sent will no longer match.'))) drawLinks();
            }}
          >
            🔀 {t('Draw again')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack santa">
      <a href="#/" className="small">
        ← {t('All games')}
      </a>
      <h1>🎅 {t('Secret Santa')}</h1>
      <p className="muted">{t('List everyone’s name and email, then press the button. Each person gets an email telling them who they’re buying a present for, and nobody else finds out.')}</p>

      {paste === null ? (
        <div className="stack-sm">
          {people.map((p, i) => (
            <div key={i} className="santa-row">
              <span className="muted small santa-num">{i + 1}</span>
              <input
                className="input"
                placeholder={t('Name')}
                value={p.name}
                maxLength={40}
                onChange={(e) => setPeople((ps) => ps.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))}
              />
              <input
                className="input"
                type="email"
                placeholder={t('Email')}
                value={p.email}
                maxLength={100}
                onChange={(e) => setPeople((ps) => ps.map((x, k) => (k === i ? { ...x, email: e.target.value } : x)))}
              />
              <button className="btn ghost small" aria-label={t('Remove')} onClick={() => setPeople((ps) => ps.filter((_, k) => k !== i))}>
                ✕
              </button>
            </div>
          ))}
          <div className="row">
            <button className="btn small" disabled={people.length >= MAX_PEOPLE} onClick={() => setPeople((ps) => [...ps, { name: '', email: '' }])}>
              + {t('Add person')}
            </button>
            <button className="btn ghost small" onClick={() => setPaste(filled().map((p) => `${p.name}, ${p.email}`).join('\n'))}>
              📋 {t('Paste a list')}
            </button>
          </div>
        </div>
      ) : (
        <div className="stack-sm">
          <textarea className="input santa-paste" rows={8} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={t('One person per line, e.g. Ayla, ayla@example.com')} />
          <div className="row">
            <button
              className="btn primary small"
              onClick={() => {
                const list = parseList(paste).slice(0, MAX_PEOPLE);
                setPeople(() => (list.length ? list : [{ name: '', email: '' }]));
                setPaste(null);
              }}
            >
              {t('Use this list')}
            </button>
            <button className="btn ghost small" onClick={() => setPaste(null)}>
              {t('Cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="stack-sm santa-exclusions">
        <strong className="small">{t('Who shouldn’t draw each other? (optional)')}</strong>
        <span className="small muted">{t('For couples, siblings or flatmates: neither will draw the other.')}</span>
        {(draft.exclusions ?? []).map(([a, b], k) => (
          <div key={k} className="row santa-ex-row">
            {[a, b].map((v, side) => (
              <select
                key={side}
                className="input"
                value={v}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    exclusions: (d.exclusions ?? []).map((pair, i) => (i === k ? ((side ? [pair[0], e.target.value] : [e.target.value, pair[1]]) as [string, string]) : pair)),
                  }))
                }
              >
                <option value="">—</option>
                {filled()
                  .filter((p) => p.name)
                  .map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
              </select>
            ))}
            <button className="btn ghost small" aria-label={t('Remove')} onClick={() => setDraft((d) => ({ ...d, exclusions: (d.exclusions ?? []).filter((_, i) => i !== k) }))}>
              ✕
            </button>
          </div>
        ))}
        <button className="btn small" onClick={() => setDraft((d) => ({ ...d, exclusions: [...(d.exclusions ?? []), ['', '']] }))}>
          + {t('Add a pair')}
        </button>
      </div>

      <div className="santa-extras">
        <label>
          <span className="small">{t('Budget (optional)')}</span>
          <input className="input" value={draft.budget} maxLength={30} placeholder={t('e.g. 500 TL')} onChange={(e) => setDraft((d) => ({ ...d, budget: e.target.value }))} />
        </label>
        <label>
          <span className="small">{t('Gift exchange date (optional)')}</span>
          <input className="input" type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
        </label>
        <label className="wide">
          <span className="small">{t('Message to everyone (optional)')}</span>
          <textarea className="input" rows={2} value={draft.note} maxLength={300} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
        </label>
      </div>

      {errors.length > 0 && (
        <ul className="santa-errors">
          {errors.map((e) => (
            <li key={e}>{t(e, { n: MAX_PEOPLE })}</li>
          ))}
        </ul>
      )}

      <div className="stack-sm">
        {SANTA_MAIL_URL && (
          <button className="btn primary big-btn" disabled={sending} onClick={drawAuto}>
            {sending ? t('Sending…') : `🎁 ${t('Draw and email everyone')}`}
          </button>
        )}
        <button className={'btn ' + (SANTA_MAIL_URL ? '' : 'primary big-btn')} onClick={drawLinks} disabled={sending}>
          {SANTA_MAIL_URL ? `✉️ ${t('Draw, then send from my own email')}` : `🎁 ${t('Draw names')}`}
        </button>
        <p className="small muted">
          {SANTA_MAIL_URL
            ? t('Automatic emails come from the site’s mail service, and the draw happens there, so not even you will know who drew whom.')
            : t('You’ll get a ready-made email for each person to send from your own email app. The name they drew is hidden in a private link, so you won’t see it.')}
        </p>
      </div>
    </div>
  );
}

export function SantaReveal({ token }: { token: string }) {
  const t = useT();
  const lang = useLang();
  const r = decodeReveal(token);
  const [shown, setShown] = useState(false);
  if (!r) {
    return (
      <div className="stack santa center">
        <h1>🎅 {t('Secret Santa')}</h1>
        <p>{t('This link doesn’t work. Ask the organizer to send it again.')}</p>
      </div>
    );
  }
  return (
    <div className="stack santa center">
      <h1>🎅 {t('Secret Santa')}</h1>
      <p>{t('Hi {name}!', { name: r.g })}</p>
      {!shown ? (
        <button className="btn primary big-btn" onClick={() => setShown(true)}>
          🎁 {t('Show who I’m buying for')}
        </button>
      ) : (
        <div className="santa-reveal">
          <span className="small muted">{t('You are buying a present for')}</span>
          <strong>{r.r}</strong>
        </div>
      )}
      {(r.b || r.d || r.m) && (
        <div className="santa-info small">
          {r.b && <p>💰 {t('Budget: {b}', { b: r.b })}</p>}
          {r.d && <p>📅 {t('Gift exchange: {d}', { d: niceDate(r.d, lang) })}</p>}
          {r.m && <p>💬 {r.m}</p>}
        </div>
      )}
      <p className="small muted">{t('Keep it a secret! 🤫')}</p>
    </div>
  );
}
