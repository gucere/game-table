import type { BoardProps, GameDef, PlayerInfo, Seat } from '../../engine/types';
import { Countdown } from '../shared/Countdown';
import * as L from './logic';
import { t as tx } from '../../i18n';

function eventText(e: L.GameEvent, players: PlayerInfo[]) {
  const role = (r: L.Role | null) => (r ? ` They were ${L.ROLES[r].icon} ${L.ROLES[r].name}.` : '');
  switch (e.kind) {
    case 'bitten':
      return `🌙 Night ${e.day}: ${players[e.seat].name} was bitten by the vampires.${role(e.role)}`;
    case 'saved':
      return `🌙 Night ${e.day}: the vampires struck, but the doctor saved their victim! 🩺`;
    case 'quiet':
      return `🌙 Night ${e.day}: a quiet night. Nobody was bitten.`;
    case 'banished':
      return `☀️ Day ${e.day}: the village drove out ${players[e.seat].name}.${role(e.role)}`;
    case 'tie':
      return `☀️ Day ${e.day}: the village couldn't agree. Nobody was driven out.`;
  }
}

function Board({ view: v, seat, players, canMove, onMove, clockOffset }: BoardProps<L.VampirView, L.VampirMove>) {
  const me = L.ROLES[v.myRole];
  const amAlive = v.alive[seat];
  const night = v.phase === 'night';
  const day = v.phase === 'day';
  const showRole = night || day || v.phase === 'done' || !amAlive;

  // What clicking a player does right now
  let action: ((t: Seat) => L.VampirMove) | null = null;
  let prompt = '';
  let canTarget = (_t: Seat) => false;
  if (canMove && night && !v.acted) {
    if (v.myRole === 'vampir') {
      action = (t) => ({ type: 'bite', target: t });
      prompt = 'Choose who to bite tonight. Your fellow vampires see your choice.';
      canTarget = (t) => v.alive[t] && v.known[t] !== 'vampir';
    } else if (v.myRole === 'doktor') {
      action = (t) => ({ type: 'protect', target: t });
      prompt = 'Choose who to protect tonight (you can pick yourself).';
      canTarget = (t) => v.alive[t] && t !== v.lastProtect;
    } else if (v.myRole === 'gozcu') {
      action = (t) => ({ type: 'see', target: t });
      prompt = 'Choose someone to look into.';
      canTarget = (t) => v.alive[t] && t !== seat;
    }
  } else if (canMove && day) {
    action = (t) => ({ type: 'vote', target: t });
    prompt = 'Talk it over, then vote for who to drive out of the village.';
    canTarget = (t) => v.alive[t] && t !== seat;
  }

  const votesFor = (t: Seat) => v.votes.flatMap((x, i) => (x === t && day ? [i] : []));
  const lastEvent = v.events[v.events.length - 1];

  return (
    <div className={'stack vk' + (night ? ' vk-night' : '')}>
      <div className="info-row">
        <span className="chip">{v.phase === 'night' || v.phase === 'dawn' ? tx('🌙 Night {day}', { day: v.day }) : tx('☀️ Day {day}', { day: v.day })}</span>
        {v.phase !== 'done' && <Countdown deadline={v.deadline} offset={clockOffset} />}
        <span className="chip">{tx('Alive: {length}', { length: v.alive.filter(Boolean).length })}</span>
      </div>

      {showRole && (
        <div className="vk-role">
          <span className="vk-role-icon" aria-hidden>
            {me.icon}
          </span>
          <div>
            <strong>{tx('You are {name}', { name: me.name })}
              {!amAlive && tx(' (dead 👻)')}
            </strong>
            <p className="small muted">{me.desc}</p>
            {v.myRole === 'vampir' && (
              <p className="small">{tx('Vampires:')}{' '}
                {v.known
                  .flatMap((r, i) => (r === 'vampir' ? [i === seat ? 'you' : players[i].name] : []))
                  .join(', ')}
              </p>
            )}
            {v.seen.length > 0 && (
              <p className="small">
                {v.seen.map((x) => `Night ${x.day}: ${players[x.target].name} ${x.vampire ? 'IS a vampire 🧛' : 'is not a vampire'}`).join(' · ')}
              </p>
            )}
          </div>
        </div>
      )}

      {(v.phase === 'dawn' || v.phase === 'dusk') && lastEvent && <p className="vk-announce">{eventText(lastEvent, players)}</p>}

      {prompt && <p className="status yours">{prompt}</p>}
      {canMove && night && v.myRole === 'koylu' && (
        <div className="center stack-sm">
          <p className="small muted">{tx('The village sleeps. You have nothing to do tonight.')}</p>
          <button className="btn primary" onClick={() => onMove({ type: 'sleep' })}>{tx('😴 Close my eyes')}</button>
        </div>
      )}
      {!canMove && night && amAlive && <p className="center muted small">{tx('Waiting for the night to pass…')}</p>}

      <div className="vk-players">
        {players.map((p, i) => {
          const known = v.known[i];
          const target = action && canTarget(i);
          const voters = votesFor(i);
          const bitBy = night && v.bites ? v.bites.flatMap((b, k) => (b === i ? [k] : [])) : [];
          return (
            <button key={i} className={'vk-player' + (v.alive[i] ? '' : ' dead') + (target ? ' can' : '')} disabled={!target} onClick={() => action && onMove(action(i))}>
              <span className="seat-dot" style={{ background: `var(--p${i % 8})` }} />
              <span className="vk-name">
                {i === seat ? tx('You') : p.name}
                {!v.alive[i] && ' 💀'}
              </span>
              {known && (
                <span className="small" title={L.ROLES[known].name}>
                  {L.ROLES[known].icon} {L.ROLES[known].name}
                </span>
              )}
              {bitBy.length > 0 && <span className="small">🩸 {bitBy.map((k) => (k === seat ? 'you' : players[k].name)).join(', ')}</span>}
              {voters.length > 0 && (
                <span className="vk-votes small">
                  {tx('{length} vote', { length: voters.length })}{voters.length > 1 ? 's' : ''}: {voters.map((k) => (k === seat ? 'you' : players[k].name)).join(', ')}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {canMove && day && (
        <button className="btn ghost center-self" onClick={() => onMove({ type: 'vote', target: -1 })}>{tx('Vote for nobody')}</button>
      )}
      {day && <p className="small muted center">{tx('Voted: {length} / {length2}', { length: v.votes.filter((x, i) => x !== null && v.alive[i]).length, length2: v.alive.filter(Boolean).length })}</p>}

      {v.events.length > 0 && (
        <details className="rules" open={v.phase === 'done'}>
          <summary>{tx('What happened so far')}</summary>
          <ul className="vk-log small">
            {v.events.map((e, k) => (
              <li key={k}>{eventText(e, players)}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export const vampir: GameDef<L.VampirState, L.VampirMove, L.VampirView> = {
  id: 'vampir-koylu',
  name: 'Vampir Köylü',
  tagline: 'Hidden roles, night bites, day votes. Who is the vampire?',
  icon: '🧛',
  minPlayers: 4,
  maxPlayers: 12,
  defaultPlayers: 6,
  hiddenInfo: true,
  options: [
    {
      id: 'vampires',
      label: 'Vampires',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'Automatic (1 per ~4 players)' },
        { value: '1', label: '1' },
        { value: '2', label: '2' },
        { value: '3', label: '3' },
      ],
    },
    {
      id: 'specials',
      label: 'Special roles',
      default: 'both',
      choices: [
        { value: 'both', label: 'Doktor and Gözcü' },
        { value: 'none', label: 'None (vampires and villagers only)' },
      ],
    },
    {
      id: 'timer',
      label: 'Time to talk each day',
      default: '120',
      choices: [
        { value: '60', label: '1 minute' },
        { value: '120', label: '2 minutes' },
        { value: '180', label: '3 minutes' },
        { value: 'none', label: 'No timer (wait for every vote)' },
      ],
    },
    {
      id: 'reveal',
      label: 'Reveal roles of the dead',
      default: 'yes',
      choices: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    },
  ],
  rules:
    'Everyone secretly gets a role. Night: the vampires pick someone to bite, the Doktor protects one person, the Gözcü learns whether one person is a vampire, and plain villagers just close their eyes. Day: the night\'s victim is announced, then everyone talks (online, use the 💬 chat) and votes. The player with the most votes is driven out; a tie means nobody is. The village wins when all vampires are gone; the vampires win once they equal the rest. On one device, pass it around at night and for votes; online works best with friends talking on a call.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: (s) => (s.phase === 'day' ? 2500 : 1200),
  isPrivate: (v) => v.phase === 'night' || v.phase === 'day',
  timer: (s) => s.deadline,
  onTimer: L.onTimer,
  Board,
};
