import type { BoardProps, GameDef, PlayerInfo, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import { Countdown } from '../shared/Countdown';
import { validateRoster } from './config';
import * as L from './logic';
import { RoleSetup } from './RoleSetup';
import './vampir.css';

const roleName = (r: L.Role) => `${L.ROLES[r].icon} ${tx(L.ROLES[r].name)}`;

function eventText(e: L.GameEvent, players: PlayerInfo[]) {
  const name = 'seat' in e ? players[e.seat].name : '';
  const role = 'role' in e && e.role ? ' ' + tx('They were {role}.', { role: roleName(e.role) }) : '';
  switch (e.kind) {
    case 'died': {
      const how: Record<L.Cause, string> = {
        bite: '🌙 Night {day}: {name} was bitten by the vampires.',
        kill: '🌙 Night {day}: {name} was found killed.',
        poison: '🌙 Night {day}: {name} was poisoned.',
        guard: '🌙 Night {day}: {name} died protecting someone.',
        shot: '🏹 {name} was shot by the Hunter.',
      };
      return tx(how[e.cause], { day: e.day, name }) + role;
    }
    case 'saved':
      return tx('🌙 Night {day}: there was an attack, but nobody died!', { day: e.day });
    case 'quiet':
      return tx('🌙 Night {day}: a quiet night. Nobody died.', { day: e.day });
    case 'banished':
      return tx('☀️ Day {day}: the village voted out {name}.', { day: e.day, name }) + role;
    case 'noble':
      return tx('☀️ Day {day}: {name} is the Noble! Their title saves them this time.', { day: e.day, name });
    case 'jester':
      return tx('🃏 {name} was the Jester and wins!', { name });
    case 'tie':
      return tx("☀️ Day {day}: the village couldn't agree. Nobody was voted out.", { day: e.day });
  }
}

function Board({ view: v, seat, players, canMove, onMove, clockOffset }: BoardProps<L.VampirView, L.VampirMove>) {
  const me = L.ROLES[v.myRole];
  const amAlive = v.alive[seat];
  const night = v.phase === 'night';
  const day = v.phase === 'day';
  const shooting = v.phase === 'shoot';
  const name = (i: number) => (i === seat ? tx('you') : players[i].name);

  // What tapping a player does right now
  let action: ((t: Seat) => L.VampirMove) | null = null;
  let prompt = '';
  let canTarget = (_t: Seat) => false;
  // The same check the rules use, with what this player knows (unknown roles count as villagers)
  const nightAct = (kind: Exclude<L.Act['kind'], 'sleep'>, text: string) => {
    action = (t) => ({ type: 'act', act: { kind, target: t } as L.Act });
    prompt = text;
    const known = { n: v.n, roles: v.known.map((r) => r ?? 'koylu'), alive: v.alive, lastTarget: v.alive.map((_, i) => (i === seat ? v.lastTarget : null)), potions: v.alive.map(() => v.potions ?? { heal: false, poison: false }) };
    canTarget = (t) => L.allowedAct(known, seat, { kind, target: t } as L.Act) === null;
  };
  if (canMove && night && !v.acted) {
    if (v.myRole === 'vampir') nightAct('bite', tx('Choose who to bite tonight. Your fellow vampires see your choice.'));
    else if (v.myRole === 'doktor') nightAct('protect', tx('Choose who to protect tonight (you can pick yourself).'));
    else if (v.myRole === 'koruma') nightAct('guard', tx('Choose who to guard tonight.'));
    else if (v.myRole === 'gozcu') nightAct('see', tx('Choose someone to look into.'));
    else if (v.myRole === 'katil') nightAct('kill', tx('Choose who to kill tonight.'));
  } else if (canMove && day) {
    action = (t) => ({ type: 'vote', target: t });
    prompt = tx('Talk it over, then vote for who to drive out of the village.');
    canTarget = (t) => v.alive[t] && t !== seat;
  } else if (canMove && shooting) {
    action = (t) => ({ type: 'shoot', target: t });
    prompt = tx('You are dying… take one last shot? Pick a player, or no one.');
    canTarget = (t) => v.alive[t] && t !== seat;
  }

  const votesFor = (t: Seat) => (day ? v.votes.flatMap((x, i) => (x === t ? [i] : [])) : []);
  const lastEvents = (() => {
    if (v.phase !== 'dawn' && v.phase !== 'dusk' && v.phase !== 'shoot' && v.phase !== 'done') return [];
    const round = v.events.filter((e) => e.day === v.day);
    return v.phase === 'dawn' ? round.filter((e) => e.kind === 'died' || e.kind === 'saved' || e.kind === 'quiet') : round.slice(-3);
  })();
  const allies = v.known.flatMap((r, i) => (i !== seat && r && ((v.myRole === 'vampir' || v.myRole === 'hain') && r === 'vampir' || (v.myRole === 'kardes' && r === 'kardes')) ? [players[i].name] : []));

  return (
    <div className={'stack vk' + (night ? ' vk-night' : '')}>
      <div className="info-row">
        <span className="chip">{night || v.phase === 'dawn' ? tx('🌙 Night {day}', { day: v.day }) : tx('☀️ Day {day}', { day: v.day })}</span>
        {v.phase !== 'done' && <Countdown deadline={v.deadline} offset={clockOffset} />}
        <span className="chip">{tx('Alive: {length}', { length: v.alive.filter(Boolean).length })}</span>
      </div>

      <div className="vk-role">
        <span className="vk-role-icon" aria-hidden>
          {me.icon}
        </span>
        <div>
          <strong>
            {tx('You are {name}', { name: tx(me.name) })}
            {!amAlive && tx(' (dead 👻)')}
          </strong>
          <p className="small muted">{tx(me.desc)}</p>
          {allies.length > 0 && <p className="small">{v.myRole === 'kardes' ? tx('Your Siblings: {names}', { names: allies.join(', ') }) : tx('The vampires: {names}', { names: allies.join(', ') })}</p>}
          {v.potions && (
            <p className="small">
              {tx('Potions left:')} {v.potions.heal ? '💚' : '—'} {v.potions.poison ? '☠️' : '—'}
            </p>
          )}
          {v.seen.length > 0 && (
            <p className="small">
              {v.seen.map((x) => (x.vampire ? tx('Night {day}: {name} IS a vampire 🧛', { day: x.day, name: players[x.target].name }) : tx('Night {day}: {name} is not a vampire', { day: x.day, name: players[x.target].name }))).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {lastEvents.map((e, k) => (
        <p key={k} className="vk-announce">
          {eventText(e, players)}
        </p>
      ))}

      {prompt && <p className="status yours">{prompt}</p>}
      {canMove && night && !v.acted && v.myRole === 'cadi' && (
        <div className="center stack-sm">
          <p className="small">{tx('Use a potion tonight? Tap a player below with the potion picked, or rest.')}</p>
          <div className="vk-potions">
            {v.potions?.heal && <span className="chip">💚 {tx('Heal')}</span>}
            {v.potions?.poison && <span className="chip">☠️ {tx('Poison')}</span>}
          </div>
          <div className="vk-players">
            {players.map((p, i) =>
              v.alive[i] ? (
                <span key={i} className="vk-witch-row">
                  <span>{i === seat ? tx('You') : p.name}</span>
                  {v.potions?.heal && (
                    <button className="btn small" onClick={() => onMove({ type: 'act', act: { kind: 'heal', target: i } })}>
                      💚
                    </button>
                  )}
                  {v.potions?.poison && i !== seat && (
                    <button className="btn small" onClick={() => onMove({ type: 'act', act: { kind: 'poison', target: i } })}>
                      ☠️
                    </button>
                  )}
                </span>
              ) : null,
            )}
          </div>
          <button className="btn primary" onClick={() => onMove({ type: 'act', act: { kind: 'sleep' } })}>
            {tx('😴 Rest tonight')}
          </button>
        </div>
      )}
      {canMove && night && !v.acted && ['koylu', 'avci', 'yasli', 'kardes', 'aga', 'lanetli', 'hain', 'soytari'].includes(v.myRole) && (
        <div className="center stack-sm">
          <p className="small muted">{tx('The village sleeps. You have nothing to do tonight.')}</p>
          <button className="btn primary" onClick={() => onMove({ type: 'act', act: { kind: 'sleep' } })}>
            {tx('😴 Close my eyes')}
          </button>
        </div>
      )}
      {!canMove && night && amAlive && <p className="center muted small">{tx('Waiting for the night to pass…')}</p>}
      {shooting && !canMove && v.shooter !== null && <p className="center muted small">{tx('The Hunter {name} is taking a last shot…', { name: players[v.shooter].name })}</p>}

      {v.myRole !== 'cadi' || !night ? (
        <div className="vk-players">
          {players.map((p, i) => {
            const known = v.known[i];
            const target = action !== null && canTarget(i);
            const voters = votesFor(i);
            const bitBy = night && v.bites ? v.bites.flatMap((b, k) => (b === i ? [k] : [])) : [];
            return (
              <button key={i} className={'vk-player' + (v.alive[i] ? '' : ' dead') + (target ? ' can' : '')} disabled={!target} onClick={() => action && onMove((action as (t: Seat) => L.VampirMove)(i))}>
                <span className="seat-dot" style={{ background: `var(--p${i % 8})` }} />
                <span className="vk-name">
                  {i === seat ? tx('You') : p.name}
                  {!v.alive[i] && ' 💀'}
                </span>
                {known && <span className="small">{roleName(known)}</span>}
                {bitBy.length > 0 && <span className="small">🩸 {bitBy.map(name).join(', ')}</span>}
                {voters.length > 0 && <span className="vk-votes small">{tx('Votes: {names}', { names: voters.map(name).join(', ') })}</span>}
              </button>
            );
          })}
        </div>
      ) : null}

      {canMove && day && (
        <button className="btn ghost center-self" onClick={() => onMove({ type: 'vote', target: -1 })}>
          {tx('Vote for nobody')}
        </button>
      )}
      {canMove && shooting && (
        <button className="btn ghost center-self" onClick={() => onMove({ type: 'shoot', target: -1 })}>
          {tx('Spare everyone')}
        </button>
      )}
      {day && <p className="small muted center">{tx('Voted: {n} / {m}', { n: v.votes.filter((x, i) => x !== null && v.alive[i]).length, m: v.alive.filter(Boolean).length })}</p>}

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
  OptionsExtra: RoleSetup,
  validateOptions: (n, options) => validateRoster(n, options),
  options: [
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
    'Everyone secretly gets a role; the host picks how many of each (or uses the suggestion for the group size). Night: the vampires pick a victim, and the special roles use their powers. Everyone else just closes their eyes. Day: the night’s news is announced, everyone talks (online, use the 💬 chat or a call) and votes. The most votes drives a player out; a tie means nobody goes. The village wins when every vampire (and any Killer) is gone; the vampires win once their side is as big as everyone else. The Jester wins alone, and ends the game, by being voted out; the Killer wins by being among the last two. Each role’s card on the setup screen explains its power.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: (s) => (s.phase === 'day' ? 2500 : 1200),
  isPrivate: (v) => v.phase === 'night' || v.phase === 'day' || v.phase === 'shoot',
  timer: (s) => s.deadline,
  onTimer: L.onTimer,
  Board,
};
