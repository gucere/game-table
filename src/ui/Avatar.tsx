import { useSyncExternalStore } from 'react';
import { avatarById } from '../profile/profile';
import { useT } from '../i18n';

/** A round player picture: their own photo, a ready-made avatar, or their first letter */
export function Avatar({ name, avatar, picture, size = 28, seat }: { name: string; avatar?: string; picture?: string; size?: number; seat?: number }) {
  const a = avatarById(avatar);
  const style = { width: size, height: size, fontSize: size * 0.58 };
  if (picture) return <img className="avatar" src={picture} alt="" style={style} />;
  if (a)
    return (
      <span className="avatar" style={{ ...style, background: a.bg }} aria-hidden>
        {a.emoji}
      </span>
    );
  return (
    <span className="avatar letter" style={{ ...style, background: seat !== undefined ? `var(--p${seat})` : 'var(--accent)', fontSize: size * 0.5 }} aria-hidden>
      {(name.trim()[0] ?? '?').toLocaleUpperCase()}
    </span>
  );
}

// ---- Small pop-up notes (achievements and the like)

interface ToastMsg {
  id: number;
  icon: string;
  title: string;
  text?: string;
}
let toasts: ToastMsg[] = [];
let toastId = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function showToast(icon: string, title: string, text?: string) {
  const id = ++toastId;
  toasts = [...toasts, { id, icon, title, text }].slice(-3);
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 4500);
}

export function Toasts() {
  const t = useT();
  const list = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => toasts,
  );
  if (!list.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {list.map((m) => (
        <div key={m.id} className="toast">
          <span className="toast-icon" aria-hidden>
            {m.icon}
          </span>
          <span>
            <strong>{t(m.title)}</strong>
            {m.text && <span className="small muted block">{t(m.text)}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
