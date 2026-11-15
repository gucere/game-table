import { describe, expect, it } from 'vitest';
import { suggestedCounts } from './config';
import * as V from './logic';
import type { Role } from './roles';

const ctx = { random: () => 0.3, now: () => 1000, numPlayers: 6, options: {} };

/** A game with these roles in seat order, no timers */
function game(roles: Role[]): V.VampirState {
  const s = V.setup({ ...ctx, numPlayers: roles.length, options: { timer: 'none' } });
  return { ...s, roles, potions: roles.map(() => ({ heal: true, poison: true })) };
}
function play(s: V.VampirState, seat: number, m: V.VampirMove) {
  const next = V.move(s, seat, m, ctx);
  if (typeof next === 'string') throw new Error(`${seat}: ${next}`);
  return next;
}
/** Everyone alive acts tonight: given acts, everyone else sleeps (vampires must bite, so pass theirs) */
function night(s: V.VampirState, acts: Record<number, V.Act>) {
  for (let i = 0; i < s.n; i++) if (s.alive[i] && s.phase === 'night') s = play(s, i, { type: 'act', act: acts[i] ?? { kind: 'sleep' } });
  return s;
}
function day(s: V.VampirState, votes: Record<number, number>) {
  if (s.phase === 'dawn') s = V.onTimer(s, ctx as never);
  for (let i = 0; i < s.n; i++) if (s.alive[i] && s.phase === 'day') s = play(s, i, { type: 'vote', target: votes[i] ?? -1 });
  return s;
}
const bite = (target: number): V.Act => ({ kind: 'bite', target });

describe('Vampir Köylü roles', () => {
  it('the Jester voted out by day wins alone and ends the game', () => {
    let s = game(['vampir', 'soytari', 'koylu', 'koylu', 'koylu']);
    s = night(s, { 0: bite(2) });
    s = day(s, { 0: 1, 2: 1, 3: 1, 4: 1, 1: 3 });
    expect(s.phase).toBe('done');
    expect(V.result(s)).toMatchObject({ winners: [1] });
  });

  it('the Doctor saves a bite; the Bodyguard dies in their charge’s place', () => {
    let s = game(['vampir', 'doktor', 'koylu', 'koylu', 'koylu']);
    s = night(s, { 0: bite(2), 1: { kind: 'protect', target: 2 } });
    expect(s.alive).toEqual([true, true, true, true, true]);
    expect(s.events.slice(-1)[0]).toMatchObject({ kind: 'saved' });

    let g = game(['vampir', 'koruma', 'koylu', 'koylu', 'koylu']);
    g = night(g, { 0: bite(2), 1: { kind: 'guard', target: 2 } });
    expect(g.alive).toEqual([true, false, true, true, true]);
    expect(g.events.slice(-1)[0]).toMatchObject({ kind: 'died', seat: 1, cause: 'guard' });
  });

  it('the Elder survives the first bite only', () => {
    let s = game(['vampir', 'yasli', 'koylu', 'koylu', 'koylu', 'koylu']);
    s = night(s, { 0: bite(1) });
    expect(s.alive[1]).toBe(true);
    s = day(s, {});
    s = V.onTimer(s, ctx as never);
    s = night(s, { 0: bite(1) });
    expect(s.alive[1]).toBe(false);
  });

  it('the Witch’s poison works once', () => {
    let s = game(['vampir', 'cadi', 'koylu', 'koylu', 'koylu', 'koylu']);
    s = night(s, { 0: bite(2), 1: { kind: 'poison', target: 3 } });
    expect(s.alive.slice(2, 4)).toEqual([false, false]);
    s = day(s, {});
    s = V.onTimer(s, ctx as never);
    expect(V.move(s, 1, { type: 'act', act: { kind: 'poison', target: 4 } }, ctx)).toMatch(/used up/);
  });

  it('a dying Hunter takes a last shot before the winner is decided', () => {
    let s = game(['vampir', 'avci', 'koylu', 'koylu']);
    s = night(s, { 0: bite(1) });
    expect(s.shooters).toEqual([1]);
    s = V.onTimer(s, ctx as never);
    expect(s.phase).toBe('shoot');
    expect(V.activePlayers(s)).toEqual([1]);
    s = play(s, 1, { type: 'shoot', target: 0 });
    expect(s.phase).toBe('done');
    expect(s.winner).toBe('village');
  });

  it('the Noble survives the first vote against them', () => {
    let s = game(['vampir', 'aga', 'koylu', 'koylu', 'koylu']);
    s = night(s, { 0: bite(2) });
    s = day(s, { 0: 1, 3: 1, 4: 1, 1: 0 });
    expect(s.alive[1]).toBe(true);
    expect(s.events.slice(-1)[0]).toMatchObject({ kind: 'noble', seat: 1 });
    expect(V.view(s, 3).known[1]).toBe('aga');
  });

  it('the Seer sees the Cursed as a vampire and the Traitor as human', () => {
    let s = game(['vampir', 'gozcu', 'lanetli', 'hain', 'koylu', 'koylu', 'koylu']);
    s = play(s, 1, { type: 'act', act: { kind: 'see', target: 2 } });
    expect(V.view(s, 1).seen.slice(-1)[0]?.vampire).toBe(true);
    let g = game(['vampir', 'gozcu', 'lanetli', 'hain', 'koylu', 'koylu', 'koylu']);
    g = play(g, 1, { type: 'act', act: { kind: 'see', target: 3 } });
    expect(V.view(g, 1).seen.slice(-1)[0]?.vampire).toBe(false);
  });

  it('who knows whom: vampires, the Traitor and Siblings', () => {
    const s = game(['vampir', 'vampir', 'hain', 'kardes', 'kardes', 'koylu', 'koylu', 'koylu']);
    expect(V.view(s, 0).known.slice(0, 3)).toEqual(['vampir', 'vampir', null]);
    expect(V.view(s, 2).known.slice(0, 3)).toEqual(['vampir', 'vampir', 'hain']);
    expect(V.view(s, 3).known[4]).toBe('kardes');
    expect(V.view(s, 5).known.filter(Boolean)).toEqual(['koylu']);
    expect(V.view(s, 5).bites).toBeNull();
  });

  it('the Killer wins when among the last two', () => {
    let s = game(['vampir', 'katil', 'koylu', 'koylu']);
    s = night(s, { 0: bite(2), 1: { kind: 'kill', target: 0 } });
    expect(s.alive).toEqual([false, true, false, true]);
    expect(s.winner).toBe('killer');
  });

  it('suggested lineups play out with bots, every move legal', () => {
    for (let n = 4; n <= 12; n++) {
      let seed = n * 97;
      const random = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      let s = V.setup({ numPlayers: n, random, options: { timer: 'none' }, now: () => 0 });
      const counts = suggestedCounts(n);
      for (const r of Object.keys(counts) as Role[]) expect(s.roles.filter((x) => x === r)).toHaveLength(counts[r]);
      for (let step = 0; step < 3000 && !V.result(s); step++) {
        const act = V.activePlayers(s);
        if (!act.length) {
          s = V.onTimer(s, { random, now: () => 0, numPlayers: n, options: {} });
          continue;
        }
        const m = V.bot(V.view(s, act[0]), act[0], { random, level: 'normal' });
        const next = V.move(s, act[0], m, { random, now: () => 0 });
        if (typeof next === 'string') throw new Error(`${s.roles[act[0]]}: ${next} ${JSON.stringify(m)}`);
        s = next;
      }
      expect(V.result(s)).not.toBeNull();
    }
  });
});
