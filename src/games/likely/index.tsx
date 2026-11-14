/**
 * Kim Daha Çok? ("who's most likely to…"). A prompt appears and everyone secretly votes
 * for the player it fits best. Votes are revealed together: the most-voted player takes the
 * title, and everyone who voted for them scores a point for reading the room.
 */
import type { BoardProps, BotCtx, GameCtx, GameDef, GameResult, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import { shuffle } from '../cards/cards';
import { Countdown } from '../shared/Countdown';

const PROMPTS: Record<string, string[]> = {
  en: [
    'be late to their own wedding',
    'win a reality TV show',
    'become famous by accident',
    'survive a zombie apocalypse',
    'talk their way out of a parking ticket',
    'eat something that fell on the floor',
    'cry at a cartoon',
    'start a business',
    'forget a friend’s birthday',
    'get lost with a map in their hand',
    'adopt five cats',
    'win the lottery and lose the ticket',
    'laugh at the wrong moment',
    'become a millionaire',
    'still be awake at 4 a.m.',
    'try every dish on the menu',
    'have a secret talent',
    'run a marathon',
    'reply to a message three days later',
    'move to another country on a whim',
    'win an argument with a lawyer',
    'take 100 photos of the same sunset',
    'organize the group trip',
    'fall asleep in the cinema',
    'know all the gossip first',
    'sing loudly in the car',
    'forget why they walked into a room',
    'befriend a stranger on the bus',
    'eat dessert before dinner',
    'cheat at a board game',
    'become a famous chef',
    'lose their phone while holding it',
    'say yes to a crazy dare',
    'plan everything to the minute',
    'end up on the news',
    'give the best advice',
    'buy something useless at 2 a.m.',
    'make friends with the waiter',
    'binge a whole series in one night',
    'be the last one to leave a party',
  ],
  tr: [
    'kendi düğününe geç kalır',
    'bir yarışma programını kazanır',
    'kazara ünlü olur',
    'zombi kıyametinden sağ çıkar',
    'trafik polisini ikna edip cezadan kurtulur',
    'yere düşen yemeği yer',
    'çizgi filmde ağlar',
    'kendi işini kurar',
    'arkadaşının doğum gününü unutur',
    'elinde haritayla kaybolur',
    'beş kedi sahiplenir',
    'piyango kazanıp bileti kaybeder',
    'yanlış anda gülmeye başlar',
    'milyoner olur',
    'gece dörtte hâlâ uyanıktır',
    'menüdeki her yemeği dener',
    'gizli bir yeteneği vardır',
    'maraton koşar',
    'mesaja üç gün sonra cevap verir',
    'bir anda başka ülkeye taşınır',
    'bir avukatla tartışmayı kazanır',
    'aynı gün batımının yüz fotoğrafını çeker',
    'grup tatilini organize eder',
    'sinemada uyuyakalır',
    'bütün dedikoduları ilk duyar',
    'arabada avazı çıktığı kadar şarkı söyler',
    'odaya neden girdiğini unutur',
    'otobüste bir yabancıyla arkadaş olur',
    'yemekten önce tatlıyı yer',
    'kutu oyununda hile yapar',
    'ünlü bir şef olur',
    'elinde tutarken telefonunu arar',
    'çılgın bir iddiaya evet der',
    'her şeyi dakikası dakikasına planlar',
    'haberlere çıkar',
    'en iyi tavsiyeyi verir',
    'gece ikide gereksiz bir şey satın alır',
    'garsonla arkadaş olur',
    'bir diziyi tek gecede bitirir',
    'partiden en son ayrılır',
  ],
};

const REVEAL_MS = 7000;

export interface LikelyState {
  n: number;
  prompts: string[];
  round: number;
  phase: 'vote' | 'reveal' | 'done';
  votes: (Seat | null)[];
  scores: number[];
  titles: number[];
  /** Most-voted players of the last round */
  picked: Seat[];
  deadline: number | null;
}
export type LikelyMove = { type: 'vote'; seat: Seat };
export type LikelyView = Omit<LikelyState, 'votes'> & { me: Seat; votes: (Seat | null)[]; voted: boolean[] };

export function setup(ctx: Pick<GameCtx, 'numPlayers' | 'random' | 'options'>): LikelyState {
  const lang = ctx.options.lang === 'en' ? 'en' : 'tr';
  const rounds = Number(ctx.options.rounds ?? 10);
  return {
    n: ctx.numPlayers,
    prompts: shuffle(PROMPTS[lang], ctx.random).slice(0, rounds),
    round: 0,
    phase: 'vote',
    votes: Array(ctx.numPlayers).fill(null),
    scores: Array(ctx.numPlayers).fill(0),
    titles: Array(ctx.numPlayers).fill(0),
    picked: [],
    deadline: null,
  };
}

export function move(s: LikelyState, seat: Seat, m: LikelyMove, ctx: Pick<GameCtx, 'now'>): LikelyState | string {
  if (s.phase !== 'vote') return 'Wait for the next prompt';
  if (s.votes[seat] !== null) return 'You already voted';
  if (m?.type !== 'vote' || !Number.isInteger(m.seat) || m.seat < 0 || m.seat >= s.n) return 'Vote for a player';
  const votes = s.votes.map((v, i) => (i === seat ? m.seat : v));
  if (votes.some((v) => v === null)) return { ...s, votes };
  const count = Array(s.n).fill(0);
  for (const v of votes) count[v!]++;
  const top = Math.max(...count);
  const picked = count.flatMap((c, i) => (c === top ? [i] : []));
  return {
    ...s,
    votes,
    picked,
    phase: 'reveal',
    titles: s.titles.map((t, i) => t + (picked.includes(i) ? 1 : 0)),
    // Reading the room: a point for voting with the majority
    scores: s.scores.map((x, i) => x + (picked.includes(votes[i]!) ? 1 : 0)),
    deadline: ctx.now() + REVEAL_MS,
  };
}

export function onTimer(s: LikelyState): LikelyState {
  if (s.phase !== 'reveal') return s;
  const round = s.round + 1;
  if (round >= s.prompts.length) return { ...s, phase: 'done', deadline: null };
  return { ...s, round, phase: 'vote', votes: Array(s.n).fill(null), picked: [], deadline: null };
}

export const activePlayers = (s: LikelyState): Seat[] => (s.phase === 'vote' ? s.votes.flatMap((v, i) => (v === null ? [i] : [])) : []);

export function view(s: LikelyState, seat: Seat): LikelyView {
  const open = s.phase !== 'vote';
  return { ...s, me: seat, votes: open ? s.votes : s.votes.map((v, i) => (i === seat ? v : null)), voted: s.votes.map((v) => v !== null) };
}

export function result(s: LikelyState): GameResult | null {
  if (s.phase !== 'done') return null;
  const best = Math.max(...s.scores);
  return { winners: s.scores.flatMap((x, i) => (x === best ? [i] : [])) };
}

/** Bots vote at random (they don't know your friends) */
export function bot(v: LikelyView, _seat: Seat, ctx: BotCtx): LikelyMove {
  return { type: 'vote', seat: Math.floor(ctx.random() * v.n) };
}

function Board({ view: v, seat, players, canMove, onMove, clockOffset }: BoardProps<LikelyView, LikelyMove>) {
  const name = (s: Seat) => (s === seat ? tx('You') : players[s].name);
  const prompt = v.prompts[Math.min(v.round, v.prompts.length - 1)];
  const reveal = v.phase !== 'vote';
  return (
    <div className="stack center likely">
      <div className="info-row">
        <span className="chip">{tx('Prompt {n} / {m}', { n: Math.min(v.round + 1, v.prompts.length), m: v.prompts.length })}</span>
        {v.phase === 'reveal' && <Countdown deadline={v.deadline} offset={clockOffset} />}
      </div>
      <div className="lk-prompt">
        <span className="small muted">{tx('Who is most likely to…')}</span>
        <strong>{prompt}?</strong>
      </div>
      <div className="lk-players">
        {players.map((_p, i) => {
          const voters = v.votes.flatMap((x, k) => (x === i ? [name(k)] : []));
          const mine = v.votes[seat] === i;
          return (
            <button
              key={i}
              className={'lk-player' + (mine ? ' mine' : '') + (reveal && v.picked.includes(i) ? ' top' : '')}
              disabled={!canMove}
              onClick={() => onMove({ type: 'vote', seat: i })}
            >
              <span className="seat-dot" style={{ background: `var(--p${i % 8})` }} />
              <strong>{name(i)}</strong>
              {reveal && <span className="small">{voters.length === 1 ? tx('1 vote') : tx('{n} votes', { n: voters.length })}</span>}
              {reveal && voters.length > 0 && <span className="small muted">{voters.join(', ')}</span>}
              {reveal && v.picked.includes(i) && <span className="lk-crown">👑</span>}
            </button>
          );
        })}
      </div>
      {!reveal && (
        <p className="small muted">
          {canMove ? tx('Tap the player it fits best (you can pick yourself).') : tx('Voted: {n} / {m}', { n: v.voted.filter(Boolean).length, m: v.n })}
        </p>
      )}
      <div className="info-row">
        {players.map((_p, i) => (
          <span key={i} className="chip">
            {name(i)}: {v.scores[i]} {tx('pts')} · 👑 {v.titles[i]}
          </span>
        ))}
      </div>
    </div>
  );
}

export const likely: GameDef<LikelyState, LikelyMove, LikelyView> = {
  id: 'kim-daha-cok',
  name: 'Kim Daha Çok?',
  tagline: 'Who’s most likely to…? Vote, reveal, laugh.',
  icon: '👑',
  minPlayers: 3,
  maxPlayers: 12,
  defaultPlayers: 4,
  hiddenInfo: true,
  options: [
    {
      id: 'lang',
      label: 'Language',
      default: 'tr',
      choices: [
        { value: 'tr', label: 'Türkçe' },
        { value: 'en', label: 'English' },
      ],
    },
    {
      id: 'rounds',
      label: 'Prompts',
      default: '10',
      choices: [
        { value: '6', label: '6' },
        { value: '10', label: '10' },
        { value: '16', label: '16' },
      ],
    },
  ],
  rules:
    'Each round shows a prompt like "Who is most likely to be late to their own wedding?". Everyone secretly votes for the player it fits best (you can vote for yourself). Votes are revealed together: the most-voted player gets a crown 👑, and everyone who voted for them scores a point for reading the room. Most points at the end wins; the crowns are just for bragging rights.',
  setup,
  activePlayers,
  view,
  move: (s, seat, m, ctx) => move(s, seat, m, ctx),
  result,
  bot,
  botDelay: () => 1200,
  isPrivate: (v) => v.phase === 'vote',
  timer: (s) => s.deadline,
  onTimer: (s) => onTimer(s),
  Board,
};
