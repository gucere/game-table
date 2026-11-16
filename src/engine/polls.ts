/**
 * Polls in a room: someone asks a question with a few answers, everyone in the room votes,
 * results update live. The host keeps them; nothing is stored once the room closes.
 */

export interface Poll {
  id: string;
  question: string;
  options: string[];
  /** Several answers allowed */
  multi: boolean;
  /** Hide who voted for what (counts only) */
  anonymous: boolean;
  by: string;
  closed: boolean;
  /** Voter name → chosen option indexes */
  votes: Record<string, number[]>;
}

export interface PollView {
  id: string;
  question: string;
  options: string[];
  multi: boolean;
  anonymous: boolean;
  by: string;
  closed: boolean;
  counts: number[];
  /** Names per option, or null when the poll is anonymous */
  voters: string[][] | null;
  /** How many people voted */
  total: number;
  mine: number[];
  /** This viewer may close it (who asked, or the host) */
  canClose: boolean;
}

export const MAX_QUESTION = 120;
export const MAX_OPTION = 60;
export const MAX_OPTIONS = 8;
export const MAX_POLLS = 10;

const tidy = (s: unknown, max: number) =>
  String(s ?? '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/** A new poll from what someone typed, or an English error */
export function makePoll(id: string, by: string, input: { question?: unknown; options?: unknown; multi?: unknown; anonymous?: unknown }): Poll | string {
  const question = tidy(input.question, MAX_QUESTION);
  if (!question) return 'Write a question.';
  const raw = Array.isArray(input.options) ? input.options : [];
  const options: string[] = [];
  for (const o of raw.slice(0, MAX_OPTIONS)) {
    const t = tidy(o, MAX_OPTION);
    if (t && !options.some((x) => x.toLocaleLowerCase() === t.toLocaleLowerCase())) options.push(t);
  }
  if (options.length < 2) return 'Give at least two different answers.';
  return { id, question, options, multi: input.multi === true, anonymous: input.anonymous === true, by, closed: false, votes: {} };
}

/** Records (or changes, or takes back with an empty list) one person's vote */
export function vote(p: Poll, voter: string, choices: unknown): Poll | string {
  if (p.closed) return 'This poll is closed.';
  if (!Array.isArray(choices)) return 'Pick an answer.';
  const picked = [...new Set(choices.filter((c): c is number => Number.isInteger(c) && c >= 0 && c < p.options.length))].sort((a, b) => a - b);
  if (!p.multi && picked.length > 1) return 'Pick one answer.';
  const votes = { ...p.votes };
  if (picked.length) votes[voter] = picked;
  else delete votes[voter];
  return { ...p, votes };
}

export function viewPoll(p: Poll, viewer: string, viewerIsHost: boolean): PollView {
  const counts = p.options.map(() => 0);
  const voters: string[][] = p.options.map(() => []);
  for (const [name, picks] of Object.entries(p.votes)) {
    for (const i of picks) {
      counts[i]++;
      voters[i].push(name);
    }
  }
  return {
    id: p.id,
    question: p.question,
    options: p.options,
    multi: p.multi,
    anonymous: p.anonymous,
    by: p.by,
    closed: p.closed,
    counts,
    voters: p.anonymous ? null : voters,
    total: Object.keys(p.votes).length,
    mine: p.votes[viewer] ?? [],
    canClose: !p.closed && (p.by === viewer || viewerIsHost),
  };
}
