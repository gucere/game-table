/** People someone chose to hide in a room: their messages, video and voice, on this device only. */
import { useSyncExternalStore } from 'react';
import type { Session } from '../engine/session';

let hidden = new Set<string>();
const listeners = new Set<() => void>();

export function useHidden() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => hidden,
  );
}

export function toggleHidden(name: string, session: Session) {
  const next = new Set(hidden);
  const hide = !next.has(name);
  if (hide) next.add(name);
  else next.delete(name);
  hidden = next;
  session.hearPerson?.(name, !hide);
  listeners.forEach((fn) => fn());
}
