/**
 * Sohbet Odası: an online room with no game in it, just the room's chat (messages, emoji,
 * pictures and files) and its call (voice, camera, screen sharing). Private: only people
 * with the room code or link can come in. The host can pick a game from the lobby any time.
 */
import type { BoardProps, GameDef } from '../../engine/types';
import { t as tx } from '../../i18n';

type HangoutState = { open: true };

function Board(_: BoardProps<HangoutState, null>) {
  return (
    <div className="panel stack narrow center hangout">
      <p className="big">💬📞</p>
      <h2>{tx('Chat & call room')}</h2>
      <p>{tx('Join the call with the buttons above: microphone, camera or screen sharing. Open 💬 for messages, emoji, pictures and files.')}</p>
      <p className="small muted">{tx('Only people with the room code or link can come in. Fancy a game? The host can go back to the lobby and pick one.')}</p>
    </div>
  );
}

export const hangout: GameDef<HangoutState, null, HangoutState> = {
  id: 'sohbet-odasi',
  name: 'Sohbet Odası',
  tagline: 'A private room to chat, talk, see each other and share your screen.',
  icon: '💬',
  minPlayers: 1,
  maxPlayers: 12,
  hiddenInfo: false,
  onlineOnly: true,
  rules:
    'Open a room and share the code or link with friends. Everyone can chat (with emoji, pictures and files up to 8 MB), join the voice call, turn on their camera or share their screen. Calls go straight between browsers, so with many people it can get heavy on slower connections; screen sharing works on computers. Nothing is recorded or stored.',
  setup: () => ({ open: true }),
  activePlayers: () => [],
  view: (s) => s,
  move: () => 'Nothing to play here',
  result: () => null,
  Board,
};
