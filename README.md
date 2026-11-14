# Oyun Masası

Free, open-source classic games that run entirely in the browser.

- **Solo:** play against bots (easy / normal / hard).
- **Same device:** pass the phone or laptop around. Games with secrets hide the screen between turns.
- **Online:** one player hosts a room and friends join with a 6-character code. Browsers connect directly to each other (WebRTC), so there's no game server to run or pay for.
- **Room chat:** online rooms have a chat with quick reactions, in the lobby and during games.
- **Vote to remove:** anyone in an online room can start a vote to remove a disruptive player. It passes when more than half of the other people agree; a bot takes the seat and that device can't rejoin the room. The host can't be voted out (the room runs in their browser).
- **Two languages:** English and Türkçe (switch at the top right; Turkish browsers start in Turkish). Every game shows its international name too, e.g. "Kızma Birader · Ludo". Adding a language is one dictionary file in `src/i18n`.
- **Customizable:** table backgrounds, player colors, card backs, two- or four-colour card faces, and Okey tile styles, from the Customize page or the 🎨 button during a game. The host can also change the rules mid-game; they apply from the next round.

## Games

| Game | Players | Bots | Notes |
|---|---|---|---|
| Batak | 4 | ✅ | Auction Batak: bid ≥5, highest bidder picks trump |
| Balayı Batağı | 2 | ✅ | Drafting phase, then Batak with 13 tricks (bid ≥7) |
| 3-5-8 | 3 | ✅ | Fixed targets 8/5/3; dealer picks trump, swaps 4 cards with the middle |
| 3'lü Gömmeli | 3 | ✅ | 16 cards each; bid winner takes the 4 middle cards and buries 4 |
| King | 4 | ✅ | 20 hands (or a quick 8): six penalty games and koz; everyone calls 3 penalties + 2 koz |
| Papaz Kaçtı | 2–8 | ✅ | One king is left without a partner; draw blind, pair up, don't be left holding the papaz. The holder can see which card you reach for |
| Pişti | 2–4 | ✅ | Play to one deal, 51, 101 or 151; 4 players can play as partners |
| 51 | 2–4 | ✅ | Card rummy on the 101 Okey engine: two decks + two wild jokers, open with 51 points or 5 pairs |
| Okey | 4 | ✅ | Tally scoring (start at 6/10/20 points); optional çanak (pot) |
| Konken | 2–4 | ✅ | Okey with two card decks and wild jokers; players who don't finish write down their leftover cards |
| 101 Okey | 4 | ✅ | Open with 101 points or 5 pairs; penalties and doubling |
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
| Durak | 2–6 | ✅ | Throw-in (podkidnoy) or pass-on (perevodnoy), 36 cards |
| Texas Hold'em · Five-Card Draw | 2–9 · 2–6 | ✅ | Play chips only: no-limit betting, blinds that rise, side pots |
| Hearts · Spades | 4 | ✅ | Hearts with passing and shooting the moon; Spades in partnerships with nil and bags |
| Bluff | 2–8 | ✅ | Claim a rank, call "Bluff!" |
| Vampir Köylü | 4–12 | ✅ | Hidden roles (vampires, villagers, doktor, gözcü); night actions and day votes, with timers |
| Tombala | 1–12 | ✅ | Turkish bingo: numbers drawn automatically; first to press wins each çinko and the tombala |
| İsim Şehir Hayvan | 2–10 | – | Online only; STOP gives everyone 5 seconds; players vote down bad answers |
| Adam Asmaca | 1–8 | ✅ | Hangman; the computer picks the word, or players take turns |
| Draw & Guess | 2–8 | – | Online only; Turkish and English word lists |
| Martı | 1–8 | ✅ | Original one-tap flyer; friends race on the same course. Fly as a seagull, pigeon, stork, parrot, crow, canary, or Hazerfen Ahmet Çelebi (launching from Galata Tower) |
| Generala · Sayı Bulmaca | 1–6 · 1–2 | ✅ | Five-dice game; bulls & cows code-cracking |
| XOX · Four in a Row · Rock Paper Scissors · Coin Flip | 1–2 | ✅ | |
| Solitaire · Sudoku · Minesweeper | 1 | – | Klondike (draw 1/3, undo), generated sudokus with one solution, 3 sizes of minefield |
| Birleştir · Yılan · Kelime Avı | 1 | – | Sliding merge puzzle, snake, word search (TR/EN) |
| Taş Yağmuru | 1 | – | Original falling-tile game: steer pairs of Okey tiles, clear sets and runs, chain reactions |
| Nonogram · Kakuro · Taş Eşle | 1 | – | Generated puzzles: nonograms solvable by logic alone, kakuros checked for a unique answer, tile matching with Okey tiles (every deal can be cleared) |

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

## How online play works

The host's browser runs the game rules. Each player's browser gets only what that player is allowed to see (their own hand, their own pick), so nobody can peek by opening dev tools. The one exception is the host, whose browser holds the full state. That's fine among friends.

To find each other, browsers use the free public [PeerJS](https://peerjs.com/) matchmaking server, which only passes a few small setup messages. After that, game traffic goes directly between players. Most home and mobile networks work. Some strict corporate or school networks block direct connections; a phone hotspot usually works around that.

## Adding a game

Each game lives in `src/games/<name>/` and exports a `GameDef` (see `src/engine/types.ts`):

- `setup`, `move`, `result`, `activePlayers`: pure rules functions
- `view(state, seat)`: what one player can see (hide other players' secrets here)
- `bot(view, seat, ctx)`: optional computer player, which only gets its own view
- `Board`: a React component that draws the view and calls `onMove`
- optional: `options` (difficulty, number of hands…), `timer`/`onTimer` for timed games, `onlineOnly`

Register it in `src/games/index.ts` (and in `SECTIONS` for the home page). Local play, online play, bots and the pass-the-device screen then work automatically. Shared helpers: `src/games/cards` (deck, card rendering) and `src/games/tiles` (Okey tiles, meld search, rack).

## License

MIT. See [LICENSE](LICENSE).
