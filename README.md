# Game Table (Oyun Masası)

Free, open-source classic games that run entirely in the browser.

**Play:** https://gucere.github.io/game-table/

> **Not for profit.** This is a just-for-fun project: no ads, no accounts, no payments, no tracking. Anyone is welcome to play it, share it, fork it and use the code.
>
> **Vibe-coded.** The whole thing was built by chatting with an AI coding assistant (Claude) rather than written line by line by hand. It's tested, but expect the odd rough edge, and bug reports or fixes are welcome.
>
> *Kâr amacı yok, eğlence için yapıldı; herkes oynayabilir, paylaşabilir, kodu kullanabilir. Proje bir yapay zekâ asistanıyla (Claude) sohbet ederek "vibe-code" edildi.*

- **Solo:** play against bots (easy / normal / hard).
- **Same device:** pass the phone or laptop around. Games with secrets hide the screen between turns.
- **Online:** one player hosts a room and friends join with a 6-character code. Browsers connect directly to each other (WebRTC), so there's no game server to run or pay for.
- **Room chat:** online rooms have a chat with quick reactions and an emoji picker, in the lobby and during games. You can also send pictures (shown in the chat) and other files up to 8 MB; they go only to the people in the room and aren't stored anywhere.
- **Invite by QR code:** the lobby shows a QR code of the invite link, so people around the table can scan it to join.
- **Public rooms:** three open chat and call rooms on the home page (General chat, Looking for players, English chat). Before the first visit you confirm you are 18 or older and accept the room rules. No pictures or files there; anyone can Hide a person (their messages, video and voice, on their own device) or vote to remove them. With no server, a public room is hosted by whoever is in it; when that person leaves, someone else takes over automatically (the messages so far are lost). Private rooms, with a code, work as before.
- **Calls:** anyone in a room can join the call with their microphone (or just listen), turn on their camera, or share their screen. It all goes browser to browser and nothing is recorded. Everyone has a mute button.
- **Emoji reactions:** tap 👍 😂 😮 👏 and friends during a game, and they float up over the table for everyone.
- **Spectators:** people who join after a game has started (or when the room is full) watch instead. In games with hidden cards, a spectator picks whose shoulder to watch over and sees only that player's view. They can take a seat in the next game.
- **Rejoin after a refresh:** if your page reloads or your connection drops, you get your seat back automatically (or with one tap). If the host's page reloads, the host can reopen the room with the game still in progress, and everyone reconnects.
- **Vote to remove:** anyone in an online room can start a vote to remove a disruptive player. It passes when more than half of the other people agree; a bot takes the seat and that device can't rejoin the room. The host can't be voted out (the room runs in their browser).
- **Two languages:** English and Türkçe (switch at the top right; Turkish browsers start in Turkish). Every game shows its international name too, e.g. "Kızma Birader · Ludo". Adding a language is one dictionary file in `src/i18n`.
- **Customizable:** table backgrounds, player colors, card backs, two- or four-color card faces, and Okey tile styles, from the Customize page or the 🎨 button during a game. The host can also change the rules mid-game; they apply from the next round.

## Games

| Game | Players | Bots | Notes |
|---|---|---|---|
| Batak | 4 | ✅ | Auction Batak: bid ≥5, highest bidder picks trump |
| Eşli Batak | 4 | ✅ | Partners Batak: partners sit opposite and play the contract together (bid ≥7) |
| Balayı Batağı | 2 | ✅ | Drafting phase, then Batak with 13 tricks (bid ≥7) |
| 3-5-8 | 3 | ✅ | Fixed targets 8/5/3; dealer picks trump, swaps 4 cards with the middle |
| 3'lü Gömmeli | 3 | ✅ | 16 cards each; bid winner takes the 4 middle cards and buries 4 |
| King | 4 | ✅ | 20 hands (or a quick 8): six penalty games and koz; everyone calls 3 penalties + 2 koz |
| Pis Yedili | 2–8 | ✅ | The traditional Turkish shedding game: match suit or rank; 7 = draw two (stacks), 8 = skip, 10 = reverse, jack = pick the suit. One round or rounds to 101 |
| Papaz Kaçtı | 2–8 | ✅ | One king is left without a partner; draw blind, pair up, don't be left holding the papaz. The holder can see which card you reach for |
| Pişti | 2–4 | ✅ | Play to one deal, 51, 101 or 151; 4 players can play as partners |
| 51 | 2–4 | ✅ | Card rummy on the 101 Okey engine: two decks + two wild jokers, open with 51 points or 5 pairs |
| Okey | 4 | ✅ | Tally scoring (start at 6/10/20 points); optional çanak (pot) |
| Konken | 2–4 | ✅ | Okey with two card decks and wild jokers; players who don't finish write down their leftover cards |
| Kelime Ustası | 2–4 | ✅ | Original crossword tile game (TR/EN) with its own bonus-square layout, letter counts and values; blanks, swaps, a 50-point bonus for using all seven tiles. Bots search every legal move (Appel–Jacobson). Words are checked against Turkish Wiktionary headwords ([atmanat/random-wordlist-tr](https://github.com/atmanat/random-wordlist-tr), Apache-2.0; dictionary forms only) and the public-domain ENABLE list, loaded only when the game opens |
| 101 Okey | 4 | ✅ | Open with 101 points or 5 pairs; penalties and doubling |
| Eşli 101 | 4 | ✅ | 101 Okey in partnerships: team totals, lowest wins |
| Backgammon (Tavla) | 2 | ✅ | Single game or match to 3/5; mars = 2 points |
| Kızma Birader | 2–4 | ✅ | The cross-shaped race game: roll a 6 to come out, capture by landing on others |
| Gul Bara | 2 | ✅ | Tavla variant: both race the same way round, a single checker holds a point, doubles cascade from turn 4 |
| Mahbusa | 2 | ✅ | Tavla variant: all checkers start on one point; no hitting, a lone checker gets trapped |
| Fetih | 2–6 | ✅ | Original territory game on a new random hex map each time: villages, castles, armies + dice |
| Mangala · Reversi · Gomoku · Dokuz Taş | 2 | ✅ | Turkish mancala, flip-the-discs, five in a row, nine men's morris |
| Yılan Merdiven · Kutu Kapmaca | 1–6 · 2–4 | ✅ | Snakes & ladders on our own board; dots & boxes |
| Satranç | 2 | ✅ | Full chess rules (castling, en passant, promotion, all draw rules); bot searches 1–3 moves deep |
| Dama | 2 | ✅ | Turkish draughts: orthogonal moves, compulsory maximum capture, flying damas |
| Amiral Battı | 2 | ✅ | Classic sea battle; optional extra shot on a hit |
| Durak | 2–6 | ✅ | 36 cards. Default “Friends rules”: only the attacker and the side attacker (the player past the defender) attack, and the defender can pass the attack on with a same-rank card. Pass-on and throw-in variants as options |
| Texas Hold'em · Five-Card Draw | 2–9 · 2–6 | ✅ | Play chips only: no-limit betting, blinds that rise, side pots |
| Hearts · Spades | 4 | ✅ | Hearts with passing and shooting the moon; Spades in partnerships with nil and bags |
| Briç (Bridge) | 4 | ✅ | Partnership bridge: auction with doubles and redoubles, declarer plays dummy, duplicate scoring over 1–16 boards |
| Kemps | 4 | ✅ | Online only: swap cards to collect four of a kind; each team gets a secret signal emoji to tell their partner, and the other team tries to spot it |
| Trash | 4 | ✅ | One card a turn onto the pile, 2 resets, 8 copies, 10 trashes the pile; face-up and face-down cards for the end game; wins counted round after round |
| As’tan On’a (Garbage) | 2–6 | ✅ | Turn over ten face-down cards in order from Ace to Ten; jacks (or kings) are wild |
| Dost Kazığı | 2–4 | ✅ | Traditional Turkish card game: match ranks and pass the penalty piles to your friends |
| Bluff | 2–8 | ✅ | Claim a rank, call "Bluff!" |
| Vampir Köylü | 4–12 | ✅ | Hidden roles with night actions and day votes. 14 roles: Villager, Vampire, Doctor, Seer, Witch, Hunter, Bodyguard, Elder, Sibling, Noble, Cursed, Traitor, Jester (wins and ends the game if voted out) and Killer. The host sets how many of each, or uses the suggestion for the group size |
| Two Truths and a Lie | 3–12 | – | Write two truths and a lie; spot the lie for a point, fool others for points |
| Kim Daha Çok? | 3–12 | ✅ | "Who's most likely to…?" Secret votes, crowns and points for reading the room (TR/EN prompts) |
| Casus Kim? | 3–12 | – | Online only: everyone knows the secret place except the spy. Questions, accusations, a final vote; our own list of 30 places |
| Gizli Görev | 4–12 | – | Two teams, 25 words: leaders give one-word clues, teammates find their words and avoid the bomb. Our own TR/EN word lists |
| Kelimeyi Anlat | 4–12 | – | Teams describe words against the clock without saying the forbidden ones; our own TR/EN cards |
| Bilgi Yarışı | 1–12 | ✅ | Trivia race: everyone answers at once, faster right answers score more. Built-in TR/EN questions, your own question pack (saved in the browser, shareable as a link), or “Everyone writes some”, where players write questions for each other |
| Hafıza | 1–6 | ✅ | Memory pairs: animals, food or things, 16–36 cards; bots remember more on harder levels |
| Beş Harf | 1–8 | ✅ | Original five-letter word game (TR/EN): six guesses, colored hints, word of the day, or race friends on the same word. Guesses are checked against Turkish Wiktionary headwords ([atmanat/random-wordlist-tr](https://github.com/atmanat/random-wordlist-tr), Apache-2.0) and the public-domain ENABLE list |
| Tombala | 1–12 | ✅ | Turkish bingo: numbers drawn automatically; first to press wins each çinko and the tombala |
| İsim Şehir Hayvan | 2–10 | – | Online only; STOP gives everyone 5 seconds; players vote down bad answers |
| Adam Asmaca | 1–8 | ✅ | Hangman; the computer picks the word, or players take turns |
| Draw & Guess | 2–8 | – | Online only; Turkish and English word lists |
| Martı | 1–8 | ✅ | Original one-tap flyer; friends race on the same course. Fly as a seagull, pigeon, stork, parrot, crow, canary, or Hazerfen Ahmet Çelebi (launching from Galata Tower) |
| Hava Hokeyi | 1–2 | ✅ | Air hockey on one screen: two players with a finger each (multi-touch), or against a bot. One device only |
| Generala · Sayı Bulmaca | 1–6 · 1–2 | ✅ | Five-dice game; bulls & cows code-cracking |
| XOX · Four in a Row · Rock Paper Scissors · Coin Flip | 1–2 | ✅ | |
| Solitaire · Sudoku · Mayın Tarlası (Minefield) | 1 | – | Klondike (draw 1/3, undo), generated sudokus with one solution, 3 sizes of minefield |
| Birleştir · Yılan · Kelime Avı | 1 | – | Sliding merge puzzle, snake, word search (TR/EN) |
| Zeka Küpü | 1 | – | The twisty puzzle cube in 3D, 2×2 to 7×7: drag stickers or use U D L R F B keys. "Solve it for me" on 2×2 and 3×3 (Kociemba's two-phase algorithm via [cubejs](https://github.com/ldez/cubejs), MIT). Ported from my own [cube solver](https://github.com/gucere/Rubik-s-Cube-Solver-s-) |
| Uzay Savunması | 1 | – | Original arcade shooter: marching drone waves that speed up, a hive boss every fifth wave, power-ups; works with touch, mouse or keys |
| Taş Yağmuru | 1 | – | Original falling-tile game: steer pairs of Okey tiles, clear sets and runs, chain reactions |
| Nonogram · Kakuro · Taş Eşle | 1 | – | Generated puzzles: nonograms solvable by logic alone, kakuros checked for a unique answer, tile matching with Okey tiles (every deal can be cleared) |

**Tools:** 💬 **Sohbet Odası** (Chat & call room): a private room with no game, just chat, pictures and files, voice, camera and screen sharing; the host can still start any game from it. 🎅 **Secret Santa** (Yılbaşı Çekilişi): list names and emails, press the button, and everyone finds out who they're buying a present for. Nobody draws themselves, and everyone is in one big circle.

Only traditional or generic games are included. Trademarked games and names are left out on purpose.

**House rules.** Card-game rules vary a lot by region. The Batak variants follow the most common forms. Balayı Batağı and 3'lü Gömmeli had no written rules to check against, so treat them as a starting point. Each variant is a small config in `src/games/batak/index.tsx` (`minBid`, `mustBeat`, `mustTrump`, `trumpLead`, kitty rules), so changing them is a one-line edit. King uses common Turkish house rules: the caller leads, you must beat the trick in koz, and in penalty games you must throw a penalty card when you're out of the suit led, or when it can no longer win the trick. Pişti never starts with a jack face up, and only a pişti made by matching scores (a jack taking a single card is a normal take).

## Run it locally

```bash
npm install
npm run dev
```

Other scripts: `npm test` (rules + bot tests), `npm run build` (production build into `dist/`).

## Publish on GitHub Pages (free)

1. Push this folder to a GitHub repository (public repos get Pages for free).
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes the site to `https://<you>.github.io/<repo>/`.

## Secret Santa emails

The site has no server, so by default the organizer sends the emails from their own email app. The page makes one ready-to-send email per person. The name each person drew is hidden in a private link inside their email, so the organizer doesn't see it (unless they open someone else's link).

To send every email automatically with one button, deploy the small Google Apps Script in `apps-script/secret-santa.gs` (free). The draw then happens on Google's side, so not even the organizer knows the pairs:

1. Use a Google account made just for this (emails are sent **from** that account's address). Go to [script.google.com](https://script.google.com) → **New project**, and paste in `apps-script/secret-santa.gs`.
2. **Deploy → New deployment** → type **Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Allow the email permission it asks for.
3. Copy the web app URL (`https://script.google.com/macros/s/…/exec`) into `SANTA_MAIL_URL` in `src/santa/config.ts` and push. The **Draw and email everyone** button appears.

Limits: 3–40 people per draw, names and messages can't contain links, at most 120 emails an hour across the whole site, and Google's own quota (about 100 emails a day for a free account).

## How online play works

The host's browser runs the game rules. Each player's browser gets only what that player is allowed to see (their own hand, their own pick), so nobody can peek by opening dev tools. The one exception is the host, whose browser holds the full state. That's fine among friends.

To find each other, browsers use the free public [PeerJS](https://peerjs.com/) matchmaking server, which only passes a few small setup messages. After that, game traffic goes directly between players. Most home and mobile networks work. Some strict corporate or school networks block direct connections; a phone hotspot usually works around that.

## Adding a game

Each game lives in `src/games/<name>/` and exports a `GameDef` (see `src/engine/types.ts`):

- `setup`, `move`, `result`, `activePlayers`: pure rules functions
- `view(state, seat)`: what one player can see (hide other players' secrets here)
- `bot(view, seat, ctx)`: optional computer player, which only gets its own view
- `Board`: a React component that draws the view and calls `onMove`
- optional: `options` (difficulty, number of hands…), `timer`/`onTimer` for timed games, `onlineOnly`, `localOnly`

Register it in `src/games/index.ts` (and in `SECTIONS` for the home page). Local play, online play, bots and the pass-the-device screen then work automatically. Shared helpers: `src/games/cards` (deck, card rendering) and `src/games/tiles` (Okey tiles, meld search, rack).

## License

MIT. See [LICENSE](LICENSE).
