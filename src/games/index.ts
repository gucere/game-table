import type { GameDef } from '../engine/types';
import { amiral } from './amiral';
import { backgammon, gulbara, mahbusa } from './backgammon';
import { balayi, batak, esliBatak, ucBesSekiz, ucluGommeli } from './batak';
import { bluff } from './bluff';
import { bulls } from './bulls';
import { coinFlip } from './coin-flip';
import { cube } from './cube';
import { dama } from './dama';
import { describeGame } from './describe';
import { dokuzTas } from './dokuztas';
import { dots } from './dots';
import { drawGuess } from './draw-guess';
import { durak } from './durak';
import { garbage } from './trash';
import { trashPile } from './trashpile';
import { hangout } from './hangout';
import { kemps } from './kemps';
import { bridge } from './bridge';
import { dostKazigi } from './dost-kazigi';
import { fetih } from './fetih';
import { fiveLetters } from './fiveletters';
import { fiftyOne } from './fiftyone';
import { fourInARow } from './four-in-a-row';
import { generala } from './generala';
import { gomoku } from './gomoku';
import { hangman } from './hangman';
import { hockey } from './hockey';
import { kakuro } from './kakuro';
import { ish } from './ish';
import { kizma } from './kizma';
import { likely } from './likely';
import { ladders } from './ladders';
import { trivia } from './trivia';
import { king } from './king';
import { mangala } from './mangala';
import { marti } from './marti';
import { memory } from './memory';
import { merge } from './merge';
import { minesweeper } from './minesweeper';
import { mission } from './mission';
import { nonogram } from './nonogram';
import { konken, okey } from './okey';
import { esli101, okey101 } from './okey101';
import { papaz } from './papaz';
import { pisti } from './pisti';
import { pisYedili } from './pisyedili';
import { holdem, poker } from './poker';
import { hearts } from './hearts';
import { spades } from './spades';
import { rain } from './rain';
import { reversi } from './reversi';
import { rps } from './rps';
import { snake } from './snake';
import { space } from './space';
import { spy } from './spy';
import { tasEsle } from './tasesle';
import { wordsearch } from './wordsearch';
import { satranc } from './satranc';
import { solitaire } from './solitaire';
import { sudoku } from './sudoku';
import { tombala } from './tombala';
import { truths } from './truths';
import { vampir } from './vampir';
import { wordTiles } from './wordtiles';
import { xox } from './xox';
import { go } from './go';
import { bricks } from './bricks';
import { wordChain } from './chain';
import { superXox } from './superxox';
import { liarsDice } from './liarsdice';
import { telephone } from './telephone';
import { addTeaching } from './teach';

/** Playable games. To add one: write a GameDef in its own folder and list it here. */
export const GAMES: GameDef[] = [
  batak,
  esliBatak,
  balayi,
  ucBesSekiz,
  ucluGommeli,
  king,
  pisti,
  papaz,
  fiftyOne,
  konken,
  holdem,
  poker,
  hearts,
  spades,
  okey,
  okey101,
  esli101,
  kizma,
  satranc,
  dama,
  mangala,
  reversi,
  gomoku,
  dokuzTas,
  ladders,
  dots,
  fetih,
  backgammon,
  mahbusa,
  gulbara,
  amiral,
  durak,
  garbage,
  trashPile,
  hangout,
  kemps,
  bridge,
  dostKazigi,
  bluff,
  vampir,
  tombala,
  truths,
  likely,
  ish,
  drawGuess,
  hangman,
  generala,
  bulls,
  xox,
  fourInARow,
  rps,
  coinFlip,
  marti,
  hockey,
  cube,
  fiveLetters,
  space,
  trivia,
  memory,
  wordTiles,
  pisYedili,
  describeGame,
  mission,
  spy,
  solitaire,
  sudoku,
  minesweeper,
  merge,
  snake,
  rain,
  wordsearch,
  nonogram,
  kakuro,
  tasEsle,
  go,
  bricks,
  wordChain,
  superXox,
  liarsDice,
  telephone,
];

addTeaching(GAMES);

export function getGame(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}

export { SECTIONS } from './sections';
