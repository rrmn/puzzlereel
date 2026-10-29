# Puzzle Reel

A swipe feed of three solver-scored puzzle games, with a research session harness.

- **Outbound**: cars only drive forward; a tapped car leaves the lot or slides until it bumps something. Levels 3 to 5 contain planted traps (moves after which the lot can no longer be cleared).
- **Conduit**: rotate tiles until every pipe connects to the source with no open ends. Every board has exactly one solution.
- **Tumbler**: crack a hidden color code from exact / right-color-wrong-spot feedback.

Every move is scored against a solver: distance to the goal before and after each move for Outbound and Conduit, and expected versus best-possible information (bits) for each Tumbler try.

## Layout

```
src/engines.js   generators, solvers and move scoring (pure, deterministic, no DOM)
src/app.js       feed, session setup, adaptive staircase, logging, export
src/style.css    styles
src/shell.html   page template
build.js         inlines everything into dist/puzzle-reel.html
test/            node tests for the engines
```

## Build and test

No dependencies; Node 18 or later.

```
npm run build   # writes dist/puzzle-reel.html (one self-contained file)
npm test        # determinism, solvability, labels vs brute force, speed
```

Puzzle generation runs in a Web Worker built from the same engine source, with a main-thread fallback.

## Hosting

`dist/puzzle-reel.html` is a single static file, so any static host works, including GitHub Pages (deploy from the `main` branch, then open `/dist/puzzle-reel.html`). Outside claude.ai the Save buttons download files directly.

## Reproducibility

A puzzle's seed is `fnv1a(sessionSeed | block | game | level | occurrence)`, and generators are deterministic, so the same session seed and plan give the same puzzles on every device. The puzzle id (`B{block}-{game}-L{level}-{n}`) and seed are logged with every event. Regenerate any puzzle with `Engines.games[game].generate(level, seed)`.

## Data

Logs stay in the browser's local storage until exported from the Data panel as CSV (moves, puzzles) or JSON. The in-app codebook ("What the columns mean", or Save codebook) documents every column and move label.
