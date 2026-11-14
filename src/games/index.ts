import type { GameDef } from '../engine/types';
import { amiral } from './amiral';
import { backgammon, gulbara, mahbusa } from './backgammon';
import { balayi, batak, ucBesSekiz, ucluGommeli } from './batak';
import { bluff } from './bluff';
import { bulls } from './bulls';
import { coinFlip } from './coin-flip';
import { dama } from './dama';
import { dokuzTas } from './dokuztas';
import { dots } from './dots';
import { drawGuess } from './draw-guess';
import { durak } from './durak';
import { fetih } from './fetih';
import { fiftyOne } from './fiftyone';
import { fourInARow } from './four-in-a-row';
import { generala } from './generala';
import { gomoku } from './gomoku';
import { hangman } from './hangman';
import { kakuro } from './kakuro';
import { ish } from './ish';
import { kizma } from './kizma';
import { ladders } from './ladders';
import { king } from './king';
import { mangala } from './mangala';
import { marti } from './marti';
import { merge } from './merge';
import { minesweeper } from './minesweeper';
import { nonogram } from './nonogram';
import { konken, okey } from './okey';
import { okey101 } from './okey101';
import { papaz } from './papaz';
import { pisti } from './pisti';
import { holdem, poker } from './poker';
import { hearts } from './hearts';
import { spades } from './spades';
import { rain } from './rain';
import { reversi } from './reversi';
import { rps } from './rps';
import { snake } from './snake';
import { tasEsle } from './tasesle';
import { wordsearch } from './wordsearch';
import { satranc } from './satranc';
import { solitaire } from './solitaire';
import { sudoku } from './sudoku';
import { tombala } from './tombala';
import { vampir } from './vampir';
import { xox } from './xox';

/** Playable games. To add one: write a GameDef in its own folder and list it here. */
export const GAMES: GameDef[] = [
  batak,
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
  bluff,
  vampir,
  tombala,
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
];

export function getGame(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}

export const SECTIONS: { title: string; ids: string[] }[] = [
  { title: 'Card games', ids: ['batak', 'balayi-batagi', '3-5-8', 'uclu-gommeli', 'king', 'pisti', 'papaz-kacti', '51', 'konken', 'holdem', 'poker', 'hearts', 'spades', 'durak', 'bluff'] },
  { title: 'Tiles & boards', ids: ['okey', 'okey-101', 'backgammon', 'mahbusa', 'gul-bara', 'kizma-birader', 'fetih', 'satranc', 'dama', 'mangala', 'reversi', 'gomoku', 'dokuz-tas', 'yilan-merdiven', 'noktalar', 'amiral-batti', 'xox', 'four-in-a-row'] },
  { title: 'Party', ids: ['vampir-koylu', 'tombala', 'isim-sehir-hayvan', 'draw-guess', 'adam-asmaca', 'generala', 'sayi-bulmaca', 'rps', 'coin-flip'] },
  { title: 'Solo & arcade', ids: ['marti', 'tas-yagmuru', 'yilan', 'birlestir', 'solitaire', 'sudoku', 'minesweeper', 'kelime-avi', 'nonogram', 'kakuro', 'tas-esle'] },
];
