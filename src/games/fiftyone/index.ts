import type { GameDef } from '../../engine/types';
import { RummyBoard } from '../okey101';
import * as L from '../okey101/logic';

/** 51 (Elli Bir): 101 Okey's rules played with two decks of cards and two wild jokers */
export const fiftyOne: GameDef<L.O101State, L.O101Move, L.O101View> = {
  id: '51',
  name: '51',
  tagline: 'Card rummy: open with 51 points, lay it all down.',
  icon: '🃏',
  minPlayers: 2,
  maxPlayers: 4,
  defaultPlayers: 4,
  hiddenInfo: true,
  options: [
    {
      id: 'hands',
      label: 'Number of hands',
      default: '3',
      choices: [
        { value: '1', label: '1 hand' },
        { value: '3', label: '3 hands' },
        { value: '5', label: '5 hands' },
        { value: '9', label: '9 hands' },
      ],
    },
  ],
  rules:
    'Two decks plus two jokers. 14 cards each (15 for the starter). Jokers are wild. Sets are 3–4 cards of the same rank in different suits; runs are 3+ cards of one suit in order, with the ace low (A-2-3) or high (Q-K-A) but not around the corner.\nOpen by laying down sets and runs worth at least 51 points in one turn (aces 11, or 1 at the bottom of a run; J/Q/K 10), or at least 5 pairs. After opening, lay down more and add cards to any meld on the table. You may take the previous discard only if you lay it down that turn.\nEvery turn ends with a discard; finish by discarding your last card (−51). Others score the cards left in their hand (joker 25); unopened players score 102. Finishing with a joker or with pairs doubles everything. Discarding a joker or a card that fits a table meld is +51. Lowest total wins.',
  setup: (ctx) => L.setup(ctx, '51'),
  activePlayers: (s) => (s.phase === 'done' ? [] : [s.turn]),
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx.random),
  result: L.result,
  bot: L.bot,
  botDelay: () => 650,
  Board: RummyBoard,
};
