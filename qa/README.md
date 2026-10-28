# Verification evidence

- `browser-verification.json`: 41 current passing assertions, plus complete attempt history. Synthetic save fixtures are under `fixtures/`; they are outside `public` and `dist/client`.
- `asset-verification.json`: the recorded public/build asset hashes and English metadata checks.
- `comparison-*-final.png`: aligned publisher reference and implementation, 640×1136 pixels per column.
- `comparison-*-detail.png`: focused views from the same aligned captures.
- `portrait-reference-*.png`: final same-state source comparisons.
- `mobile-hold.png`, `mobile-double.png`, `responsive-*.png`: responsive implementation checks.
- `final-mobile.png`, `final-desktop.png`: fresh production-build preview with 40,000 virtual coins.

The official gallery is retained in `../research/reference/`. The original live trial did not get past its loading logo. Read `../design-qa.md` and `../research/README.md` for the distinction between observed source facts, independent local rules and test limitations.

Earlier captures may show an animation in progress. Intermediate `*-v2.png` files are excluded from Git because that capture preceded completed font/image loading. They are not final QA evidence.
