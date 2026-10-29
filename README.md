# Puzzle Reel

A swipe feed of three solver-scored puzzle games, with a research session harness.

- **Outbound**: a parking lot. Cars only drive forward; a tapped car leaves the lot or rolls until it bumps something. Levels 3 to 5 contain planted traps (moves after which the lot can no longer be cleared).
- **Conduit**: a garden. Turn pipe tiles until water from the well reaches every plant with no leaks. Every board has exactly one solution.
- **Tumbler**: a vault. Crack a hidden color code. Clues either mark every pin (right spot, elsewhere, absent, as in Wordle) or give only the two counts, as in classic Mastermind.

Each game opens with a small practice board and a guiding hand, so it can be learned by playing. Every move is scored against a solver: distance to the goal before and after each move for Outbound and Conduit, and expected versus best-possible information (bits) for each Tumbler try.

## Layout

```
src/engines.js   generators, solvers, practice boards and move scoring (pure, deterministic, no DOM)
src/app.js       feed, scenes, sound, session setup, adaptive staircase, logging, export
src/style.css    styles
src/shell.html   page template
build.js         inlines everything into dist/
test/            node tests for the engines
index.html       redirects the site root to dist/puzzle-reel.html
```

## Build and test

No dependencies; Node 18 or later.

```
npm run build   # writes dist/puzzle-reel.html (standalone) and dist/artifact.html (claude.ai)
npm test        # determinism, solvability, labels vs brute force, both clue styles, speed
```

Puzzle generation runs in a Web Worker built from the same engine source, with a main-thread fallback.

## Hosting

`dist/puzzle-reel.html` is one self-contained HTML file, so any static host works, including GitHub Pages (deploy from the `main` branch; the site root redirects to the page). Outside claude.ai the Save buttons download files directly.

## Reproducibility

A puzzle's seed is `fnv1a(sessionSeed | block | game | level | occurrence)`, and generators are deterministic, so the same session seed and plan give the same puzzles on every device. Practice boards are fixed. The puzzle id (`B{block}-{game}-L{level}-{n}`, or `P-{game}` for practice) and seed are logged with every event. Regenerate any puzzle with `Engines.games[game].generate(level, seed, clueStyle)`.

## Data

Logs stay in the browser's local storage until exported from the Data panel as CSV (moves, puzzles) or JSON. The in-app codebook ("What the columns mean", or Save codebook) documents every column and move label.
