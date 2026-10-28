# Video Poker — REA investigation

Date: 2026-10-28 (Asia/Taipei). User-selected source: <https://jiligames.com/PlusIntro/253?showGame=true>.

## Verified source facts

- The English trial redirects to the `videopoker` game on `casino-wbgame.tadagaming.com`; transient trial keys were not committed.
- `src/settings.7474c.json` declares Cocos Creator 3.8.5, portrait orientation and a 640×1136 design resolution.
- Captured versions: game bundle `13167`, main bundle `335c5`, application `3c0b4`, source chunks `826a2`.
- The official gallery shows five-card draw, two Jokers, HOLD, Change, 1/2 Double, Double, Cash Out, Auto, Big/Small, a boundary of 7 and a five-card double stack.
- The captured paytable pays Royal Flush 250x; 5 of a kind 100x; Straight Flush 40x; 4 of a kind 8x; Full House 5x; Flush 4x; Straight 3x; 3 of a kind 2x; 2 Pair 1x.
- The game client contains commands for player deal, change, cash out, half-double, double, guess, double-again and starting a new round. These are static observations, not executed server behavior.
- The Card skeleton declares Spine 3.8.99. Its 54 named skins were decoded with the compatible 3.8 runtime, and the real mesh vertices/UVs were rasterized into local card images. Rectangular cropping alone is insufficient for polygon-packed glyphs.

Official visual references are retained in [reference/](reference/). [evidence/reference-manifest.json](evidence/reference-manifest.json) and [../public/assets/manifest.json](../public/assets/manifest.json) record URLs, hashes and transformations.

## REA evidence

Installed package: `rea-agents` 6.8.0; accessed through its actual stdio MCP server using `scripts/rea-research.mjs`.

| Analysis | Parent evidence | Verified coverage |
| --- | --- | --- |
| Three bootstrap / framework sources | `ev_e9d5194882263f1e3da7b2afee7b0a732b877c0cab23ade3ed3c6540466e269a` | 3 JS files parsed; 11,708 AST nodes visited; zero parse failures; 5 application unknowns and 2,933 semantic unknowns |
| Selected game client bundle | `ev_faf2a4a308e5fd384ba4cd5a1c9b2fe6e94838f563fa988012256da548c3c741` | 1 selected JS file, 101,687 AST nodes, zero parse failures; 10 application unknowns and 20,036 semantic unknowns |

The game summary projection is `ev_de0b1c4d394faf695bb8ebf8ce3c49c048175f6e81aa6e8ed4226a8f930a5e2c`. Its parent ID in [evidence/rea-game-summary.json](evidence/rea-game-summary.json) is authoritative. Bootstrap summary projection: `ev_e12a37488e09e25a79fed3382068194d95a724c083f440af24840a25ba8883dd`.

Both application and semantic coverage are partial. The selected game analysis reached its 20,000 semantic-node allowance and omitted further occurrences. Unselected source files and unresolved dynamic relationships remain unknown. No original JavaScript was executed by static analysis.

The complete local session was exported to `evidence/rea-session.json`: 4 records, 57,611,298 bytes. It is Git-ignored. Export success and final session status are retained in [evidence/rea-export-result.json](evidence/rea-export-result.json) and [evidence/rea-session-summary.json](evidence/rea-session-summary.json). The export's bundle-level `unknowns: 0` does not mean that semantic analysis is complete. Session status reported `cleanup_pending: false`.

## Runtime limitations and independent rules

The source game stayed at the TaDa loading logo in both the in-app browser and normal Chrome. A declared REA browser scenario did not return Evidence before its client deadline. Consequently no source hand, wager, server outcome, actual Double Up result or source mobile interaction was verified. The gallery references are publisher-provided visual targets, not screenshots of successful play in this session.

Node.js on the research host was 24.4.0, outside the Node ranges declared by REA 6.8.0. Static analysis nevertheless returned the evidence above. Whether this contributed to the browser-scenario timeout is unverified.

The independent game uses a shuffled 54-card deck for the main hand and a separate 52-card deck for Double Up. Ace–6 is Small, 8–King is Big, 7 pushes, and five successful guesses pay 32x the initial Double Up stake. The original gallery's 32x–40x clear bonus and server outcome rules were not recovered and are not claimed as reproduced.

All runtime QA is against the local implementation. Test fixtures under `../qa/fixtures/` are synthetic local states, contain no credentials and are not served in the production client. They permit repeatable visual states without adding product QA hooks.
