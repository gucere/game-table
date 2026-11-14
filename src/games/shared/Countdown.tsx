import { useEffect, useState } from 'react';
import { t as tx } from '../../i18n';

/** Seconds left until a host-clock deadline */
export function useSecondsLeft(deadline: number | null, offset: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadline]);
  return deadline === null ? null : Math.max(0, Math.ceil((deadline + offset - now) / 1000));
}

export function Countdown({ deadline, offset }: { deadline: number | null; offset: number }) {
  const secs = useSecondsLeft(deadline, offset);
  if (secs === null) return null;
  return <span className={'chip' + (secs <= 10 ? ' urgent' : '')}>{tx('⏱ {secs}s', { secs: secs })}</span>;
}
