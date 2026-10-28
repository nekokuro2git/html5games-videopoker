# Video Poker

An independent, playable Video Poker game with an English (`en`) interface, informed by REA analysis of the [provided JILI reference](https://jiligames.com/PlusIntro/253?showGame=true).

The repository root corresponds to `D:\workspace\html5games\games\VideoPoker`. It builds independently of every other game in the parent workspace.

## Play locally

Requires Node.js 22.19 or newer.

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4284 --strictPort
```

Open [http://127.0.0.1:4284/](http://127.0.0.1:4284/). For the production build, use `npm run build` and `npm run preview -- --host 127.0.0.1 --port 4285 --strictPort`.

## Included

- Five-card draw with a 54-card deck, two wild Jokers, suggested holds and one replacement draw.
- Nine paying hands, from Two Pair (1x) to Royal Flush (250x). A single pair does not pay.
- Double Up, 1/2 Double, Big/Small guesses, a push on 7, and a five-win 32x limit.
- A starting balance of 40,000 virtual coins, selectable bets, integer-cent accounting and guarded transactions.
- Auto Play for 10, 25, 50 or 100 hands, optional stop on a win, manual stop and stop when the tab becomes hidden.
- Game history, device-local round recovery, validated saves, audio, music, fast play and English settings.
- Portrait layout fitted to desktop, tablet and mobile screens. Keyboard: 1–5 to hold; Space to deal, change or collect; Escape closes a dialog.
- Local reference assets, including 54 face-up cards rasterized from the published Spine meshes. No original game code or remote game service runs in the app.

All coins are virtual and have no monetary value. Local outcomes and Double Up rules are implemented independently; this project does not reproduce or claim the reference server's RNG, RTP, settlement or variable 32x–40x clear bonus. Hold suggestions are a convenience rather than an optimal strategy solver.

## Verify

```sh
npm run build
npm test
npm run verify:assets
```

Tests cover the paytable, Jokers, low/high Aces, deck integrity, held cards, exactly-once debits and credits, protected half stakes, pushes, five Double Up wins, corruption recovery, preferences and 400-round accounting. Asset verification checks every recorded file in both `public` and `dist` and verifies all 54 card skins.

Build before running the full test suite on a fresh checkout: the packaging test verifies emitted files under `dist`.

Browser and visual evidence: [design-qa.md](design-qa.md), [qa/browser-verification.json](qa/browser-verification.json), and [qa/](qa/). GitHub Actions repeats tests, build and asset verification on pushes and pull requests.

## Architecture

`src/engine.mjs` contains the pure state machine, paytable, wildcard evaluator and unbiased local shuffle using Web Crypto rejection sampling. `src/storage.mjs` validates persisted data. React in `src/App.jsx` supplies the interface, guarded animations and Auto Play. Preferences always default to English; no browser-language detection changes the locale.

Authoritative game state is committed before its visual animation. Reloading resumes that state without charging again. Auto Play is intentionally not restored after a reload. Game history retains the most recent 100 completed hands.

The Vite build emits `dist/client`, `dist/server/index.js` and Sites metadata. `wrangler.jsonc` also supports a standalone Cloudflare Worker named `html5games-videopoker`; use build root `/`, build command `npm run build`, and deploy command `npx wrangler deploy`. A Git push alone is not evidence of a production deployment.

## REA research and reference resources

See [research/README.md](research/README.md) for evidence identities, observed source versions and limitations. The original trial remained at its loading logo in the tested browsers, so the official gallery supplies the visual target. Gameplay behavior was verified on this local implementation.

Raw captures and the full local REA evidence bundle are excluded from Git. The compact REA summaries, official gallery references, public asset provenance and completed QA evidence are included. Research scripts are optional and are not part of the build:

```sh
node scripts/capture-reference.mjs
node scripts/extract-assets.mjs
node scripts/bake-cards.mjs
```

The source resource versions are pinned to the investigation date. Offline card baking additionally requires Python with Pillow. `npm run research` starts the local REA MCP adapter; its installation path can be set with `REA_INSTALLATION`. It binds only to `127.0.0.1:9263`.

Reference graphics, fonts and audio retain their original ownership. Their provenance and transformations are recorded in `public/assets/manifest.json`.
