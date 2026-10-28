# Video Poker design and interaction QA

Date: 2026-10-28, Asia/Taipei.

final result: passed

Scope: an independent, playable English Video Poker implementation informed by the official gallery and REA static analysis. This is a visual comparison to publisher-provided images, not a claim that the source trial successfully ran or that its server rules were recovered.

## Comparison evidence

All full comparisons align a 640×1136 CSS viewport and a 640×1136 implementation PNG with a 640×1136 source PNG. The effective capture density is one image pixel per CSS pixel. No content scaling was applied to either column; comparison sheets add a shared 34-pixel label strip.

| State | Visual truth | Implementation | Full comparison | Focused comparison |
| --- | --- | --- | --- | --- |
| Hold; A♦, 2♥, 8♥ and two Jokers | `research/reference/main.png` | `qa/portrait-reference-hold-final.png` | `qa/comparison-hold-final.png` | `qa/comparison-hold-detail.png` |
| Four of a kind; 800 pending | `research/reference/win.png` | `qa/portrait-reference-win.png` | `qa/comparison-win-final.png` | `qa/comparison-win-detail.png` |
| Double Up; 2♣ history, 200 pending | `research/reference/double.png` | `qa/portrait-reference-double.png` | `qa/comparison-double-final.png` | `qa/comparison-double-detail.png` |

Combined source/implementation sheets were opened and inspected together. Focused regions cover card alignment, held/winning frames, typography, double-stack density, guess buttons and the coefficient. Synthetic local save fixtures reproduce the reference hands; balance and round values intentionally reflect a fresh local session.

Responsive evidence: `qa/responsive-320.png`, `qa/responsive-390.png`, `qa/responsive-768.png`, `qa/responsive-1440.png`, `qa/mobile-hold.png`, `qa/mobile-double.png`, `qa/final-mobile.png`, and `qa/final-desktop.png`. The final mobile viewport is 390×844; final desktop is 1440×900. The portrait stage fits within each viewport without hiding persistent controls. Actual source mobile behavior remains unverified.

## Findings and corrections

1. **Resolved P2 — missing card-area board and oversized inner held frame.** The initial render exposed the patterned background between the cards and narrowed held card faces. Added the captured `牌底板` asset behind the row and moved the yellow hold outline outside the image. The post-fix hold full/detail comparisons show the original 116×158 card proportions and aligned ribbons.
2. **Resolved P2 — distorted Double Up corners and an overly compact stack.** Stretching the complete 90×118 board texture enlarged its corners; fan offsets were too small. Applied the actual board as a nine-slice border image, corrected stack spacing and aligned history/coefficient positions. The post-fix Double Up full/detail comparisons show the intended panel shape and card density.
3. **Resolved P2 — thick winning outlines and undersized win heading.** Directly stretching a frame bitmap covered part of card faces. The source frame now uses nine-slice borders around each card, with a restrained glow; the heading scale was increased. The final win comparison was recaptured after this change.
4. **Resolved functional edge — ready state with insufficient balance.** The lower-bet action originally appeared only after a completed round. It now also appears for a restored ready state with an unaffordable bet. Browser checks confirm selecting an affordable bet and then dealing safely.
5. **Resolved output issue — implicit favicon 404.** Added an explicit local crown image as the favicon. The final production-build request set contains no HTTP errors.

An intermediate v2 capture was taken before fonts/images finished loading and was excluded from final comparison evidence. Final captures wait for font loading and image decoding. Two functional test setup attempts are retained in the browser record: a fast draw completed before an intended mid-hand stop assertion, and opening a second visible window did not produce a hidden-tab event. They were retested with normal animation timing and an explicitly simulated, restored hidden-document event respectively.

## Required fidelity surfaces

- **Fonts and typography:** source Bahnschrift, Adobe Garamond Pro Bold and Open Sans Bold files are local. Paytable hierarchy, single-line labels and held-card text are readable. The win heading uses live text and the source serif font; fine bitmap-emboss differences are P3.
- **Spacing and layout:** the source portrait proportions, two-column paytable, full-width royal row, card positions, lower balance bar, betting controls, Double Up panel and persistent Cash Out are retained. All tested widths have no horizontal overflow and keep controls within the viewport.
- **Colors and tokens:** backgrounds, cards, paytable panels and button skins use the captured assets. Blue/purple/green/gold state hierarchy is retained. Minor animation-frame brightness differences are P3.
- **Image quality:** 54 face-up cards use source Spine meshes and UVs, not rectangular glyph approximations. Main imagery, card backs, fonts, icons and audio are served locally; all recorded public/dist asset hashes match. Menu uses the current captured client's hamburger icon in place of the older gallery's gear; this is a visible P3 variant.
- **Copy and content:** the interface and document language default to `en`. Deal, Change, HOLD, Cash Out, Double, 1/2 Double, Big, Small and coefficient labels follow the reference flow. Fun-play and local round labels replace the original session identifier. The documented local five-win limit is 32x; the unrecovered variable 32x–40x source bonus is an explicit scope limitation.

## Interaction and output verification

- `npm test`: 36/36 passed, including 400-round accounting and static-serving tests.
- `npm run build`: passed; standalone client and Worker/Sites output present.
- `npm run verify:assets`: 336 assets, 672 matching public/dist hash checks and all 54 card skins verified.
- Wrangler 4.154.0 `deploy --dry-run`: passed with the expected `ASSETS` binding; no production deployment was performed.
- `qa/browser-verification.json`: 41 current browser assertions passed. Earlier setup attempts and the resolved favicon failure remain in its attempt history.
- Normal shuffled rounds, manual holds, keyboard input, reload recovery, collected/half-protected wins, Double Up loss/push/five wins, Auto Play counts/stop conditions, history, settings persistence, low balances and corruption recovery were exercised.
- The production build at `http://127.0.0.1:4285/` completed a shuffled round, then New Session restored a fresh 40,000-coin game. Final observed requests stayed local; no JavaScript exceptions or console errors were reported.

## Remaining limits and P3 polish

No actionable P0/P1/P2 issue remains within the stated scope. Fine emboss/glow/brightness and the menu-icon variant are P3. The source trial's successful play, server behavior, bonus schedule and actual mobile layout were not observed. Other browser engines, physical devices and subjective sound playback remain untested. Page-hidden logic was verified through a temporary event simulation, not through confirmed OS-level tab hiding.

## Implementation checklist

- [x] English default and independent local game state.
- [x] Source assets, faithful portrait composition and complete core controls.
- [x] Same-state full and focused visual comparisons after fixes.
- [x] Responsive, keyboard, preference and recovery checks.
- [x] Tests, production build, asset integrity and browser evidence.
- [x] Preview reset to a clean, playable session.
