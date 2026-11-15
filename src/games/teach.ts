/**
 * Hints in words and "teach me" tips for games where they help most.
 * Hints come from each game's own bot; these functions only put its move into words and add
 * a tip about the position in front of the player.
 */
import type { GameDef, Seat } from '../engine/types';
import { t as tx } from '../i18n';
import { cardLabel, rankOf } from './cards/cards';
import * as Chess from './satranc/logic';
import type { DamaMove, DamaView } from './dama/logic';
import { COLS, dropRow, winAt, type FourState } from './four-in-a-row/logic';
import { LINES, type XoxState } from './xox/logic';
import { legal as reversiLegal, type ReversiMove, type ReversiState } from './reversi';
import { N as GOMOKU_N, type GomokuMove, type GomokuState } from './gomoku';
import type { MangalaMove, MangalaState } from './mangala';
import { STRAIN_LABEL, type BridgeMove, type BridgeView } from './bridge/logic';
import type { WordMove, WordView } from './wordtiles/logic';

/** a1-style name for a square on an 8×8 board where 0 is top-left */
const sq8 = (i: number) => 'abcdefgh'[i % 8] + (8 - Math.floor(i / 8));
const sqN = (i: number, n: number) => 'ABCDEFGHJKLMNOPQRST'[i % n] + (n - Math.floor(i / n));

const PIECE: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const pieceName = (p: string) => tx(PIECE[p.toLowerCase()] ?? 'piece');

const chess = {
  describeMove(v: Chess.ChessView, m: Chess.CMove) {
    const piece = pieceName(v.board[m.from]);
    const target = v.board[m.to];
    if (target && target !== '.') return tx('Move your {piece} from {from} to {to} and take the {taken}.', { piece, from: sq8(m.from), to: sq8(m.to), taken: pieceName(target) });
    return tx('Move your {piece} from {from} to {to}.', { piece, from: sq8(m.from), to: sq8(m.to) });
  },
  teach(v: Chess.ChessView) {
    if (v.over) return null;
    if (v.check) return tx('You are in check: move the king, put a piece in between, or take the attacking piece.');
    const me = v.myColor;
    const them = me === 'w' ? 'b' : 'w';
    const mine = (p: string) => p !== '.' && (p === p.toUpperCase() ? 'w' : 'b') === me;
    for (let i = 0; i < 64; i++) {
      const p = v.board[i];
      if (!mine(p) || p.toLowerCase() === 'k' || p.toLowerCase() === 'p') continue;
      if (Chess.attacked(v.board, i, them) && !Chess.attacked(v.board, i, me)) return tx('Your {piece} on {sq} is attacked and nothing protects it. Move it or defend it.', { piece: pieceName(p), sq: sq8(i) });
    }
    if (v.moves.length < 12) return tx('Opening: bring your knights and bishops out, control the four middle squares, and castle early to keep your king safe.');
    return tx('Before each move, look for checks, captures and threats: first for you, then for your opponent.');
  },
};

const dama = {
  describeMove(_v: DamaView, m: DamaMove) {
    const path = m.path.map(sq8).join(' → ');
    return m.captures.length ? tx('Jump {path}, taking {n}.', { path, n: m.captures.length }) : tx('Move {path}.', { path });
  },
  teach(v: DamaView) {
    if (v.legal.some((m) => m.captures.length)) return tx('You have to capture, and you must take the most pieces possible.');
    return tx('Keep your back row as long as you can: it stops your opponent from getting a dama. Move in groups so pieces protect each other.');
  },
};

function lineThreat(board: (Seat | null)[], who: Seat): number | null {
  for (const line of LINES) {
    const mine = line.filter((i) => board[i] === who).length;
    const empty = line.filter((i) => board[i] === null);
    if (mine === 2 && empty.length === 1) return empty[0];
  }
  return null;
}
const XOX_NAMES = ['top left', 'top middle', 'top right', 'middle left', 'centre', 'middle right', 'bottom left', 'bottom middle', 'bottom right'];

const xox = {
  describeMove(_v: XoxState, cell: number) {
    return tx('Play the {where} square.', { where: tx(XOX_NAMES[cell]) });
  },
  teach(v: XoxState, seat: Seat) {
    const win = lineThreat(v.board, seat);
    if (win !== null) return tx('You can win right now: look at the {where} square.', { where: tx(XOX_NAMES[win]) });
    const block = lineThreat(v.board, 1 - seat);
    if (block !== null) return tx('Your opponent has two in a row. Block the {where} square!', { where: tx(XOX_NAMES[block]) });
    return tx('Take the centre if it’s free, then corners. Try to make two lines of two at once.');
  },
};

function fourThreat(cells: FourState['cells'], who: Seat): number | null {
  for (let c = 0; c < COLS; c++) {
    const r = dropRow(cells, c);
    if (r < 0) continue;
    const idx = r * COLS + c;
    const next = cells.slice();
    next[idx] = who;
    if (winAt(next, idx)) return c;
  }
  return null;
}

const four = {
  describeMove(_v: FourState, col: number) {
    return tx('Drop a piece in column {n}.', { n: col + 1 });
  },
  teach(v: FourState, seat: Seat) {
    if (v.win) return null;
    const win = fourThreat(v.cells, seat);
    if (win !== null) return tx('You can make four in a row in column {n}!', { n: win + 1 });
    const block = fourThreat(v.cells, 1 - seat);
    if (block !== null) return tx('Careful: your opponent wins next turn in column {n}. Block it.', { n: block + 1 });
    return tx('The middle column is part of the most lines of four. And before you drop, check what the space above your piece gives your opponent.');
  },
};

const CORNERS = [0, 7, 56, 63];
const reversi = {
  describeMove(_v: ReversiState, m: ReversiMove) {
    return 'cell' in m ? tx('Place a disc on {sq}.', { sq: sq8(m.cell) }) : tx('Pass: there is no legal move.');
  },
  teach(v: ReversiState, seat: Seat) {
    const legal = reversiLegal(v.board, seat);
    const corner = legal.find((i) => CORNERS.includes(i));
    if (corner !== undefined) return tx('You can take the corner {sq}. Corners can never be flipped back!', { sq: sq8(corner) });
    return tx('Flipping the most discs now is rarely best. Avoid the squares next to an empty corner, and try to leave your opponent few moves.');
  },
};

function gomokuFive(board: (Seat | null)[], who: Seat): number | null {
  const n = GOMOKU_N;
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let i = 0; i < n * n; i++) {
    if (board[i] !== null) continue;
    const r = Math.floor(i / n);
    const c = i % n;
    for (const [dr, dc] of dirs) {
      let count = 1;
      for (const s of [1, -1]) {
        for (let k = 1; k < 5; k++) {
          const rr = r + dr * k * s;
          const cc = c + dc * k * s;
          if (rr < 0 || rr >= n || cc < 0 || cc >= n || board[rr * n + cc] !== who) break;
          count++;
        }
      }
      if (count >= 5) return i;
    }
  }
  return null;
}

const gomoku = {
  describeMove(_v: GomokuState, m: GomokuMove) {
    return tx('Place a stone on {sq}.', { sq: sqN(m.cell, GOMOKU_N) });
  },
  teach(v: GomokuState, seat: Seat) {
    const win = gomokuFive(v.board, seat);
    if (win !== null) return tx('You can make five in a row on {sq}!', { sq: sqN(win, GOMOKU_N) });
    const block = gomokuFive(v.board, 1 - seat);
    if (block !== null) return tx('Your opponent makes five on {sq} next turn. Block it!', { sq: sqN(block, GOMOKU_N) });
    return tx('Watch for three in a row with both ends open: block it before it becomes an open four, which can’t be stopped.');
  },
};

const mangala = {
  describeMove(v: MangalaState, m: MangalaMove) {
    const n = v.turn === 0 ? m.pit + 1 : m.pit - 6;
    return tx('Sow the stones from your pit number {n} (counting from your left).', { n });
  },
  teach() {
    return tx('If your last stone lands in your store, you go again. If it makes a pit on the other side even, you win those stones. Count before you sow!');
  },
};

function hcp(hand: number[]) {
  return hand.reduce((n, c) => n + Math.max(0, rankOf(c) - 10), 0);
}
const bridge = {
  describeMove(_v: BridgeView, m: BridgeMove) {
    if (m.type === 'bid') return tx('Bid {bid}.', { bid: `${m.level}${STRAIN_LABEL[m.strain]}` });
    if (m.type === 'pass') return tx('Pass.');
    if (m.type === 'double') return tx('Double.');
    if (m.type === 'redouble') return tx('Redouble.');
    if (m.type === 'play') return tx('Play {card}.', { card: cardLabel(m.card) });
    return tx('Continue.');
  },
  teach(v: BridgeView) {
    if (v.phase === 'auction') {
      const points = hcp(v.hand);
      return tx('You have {n} high-card points (ace 4, king 3, queen 2, jack 1). With 12 or more you can usually open; you and your partner need about 25 together for game (3NT, 4♥ or 4♠).', { n: points });
    }
    if (v.phase === 'play' && v.contract) {
      if (v.contract.declarer === v.me || v.contract.dummy === v.me) return tx('As declarer, count your sure winners first. Draw the opponents’ trumps early if you can, then cash your long suit.');
      if (v.trick.length === 1) return tx('Second to play: usually play low and let your partner win the trick.');
      if (v.trick.length === 2) return tx('Third to play: usually play high to win the trick for your side.');
      return tx('Lead from your longest, strongest suit, or return the suit your partner led.');
    }
    return null;
  },
};

const words = {
  describeMove(_v: WordView, m: WordMove) {
    if (m.type === 'play') return tx('Place {letters}.', { letters: m.tiles.map((t) => t.ch).join('') });
    if (m.type === 'swap') return tx('Swap {n} tiles.', { n: m.tiles.length });
    return tx('Pass.');
  },
  teach(v: WordView) {
    if (v.board.every((c) => !c)) return tx('The first word has to cover the centre square.');
    if (v.rack.includes('?')) return tx('The blank (?) can be any letter but scores no points. Save it for a big word.');
    if (v.rack.length === 7) return tx('Light squares double or triple a letter, dark ones the whole word. Using all 7 tiles in one go earns 50 extra points.');
    return tx('Short words that touch several letters already on the board often score more than one long word.');
  },
};

/** Adds hints-in-words and teach-me tips to the games that have them */
export function addTeaching(games: GameDef[]) {
  const extra: Record<string, { describeMove?: GameDef['describeMove']; teach?: GameDef['teach'] }> = {
    satranc: chess as never,
    dama: dama as never,
    xox: xox as never,
    'four-in-a-row': four as never,
    reversi: reversi as never,
    gomoku: gomoku as never,
    mangala: mangala as never,
    bric: bridge as never,
    'kelime-ustasi': words as never,
  };
  for (const g of games) {
    const e = extra[g.id];
    if (!e) continue;
    g.describeMove ??= e.describeMove;
    g.teach ??= e.teach;
  }
}
