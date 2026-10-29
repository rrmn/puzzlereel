# Puzzle Reel

A swipe feed of four games with a research session harness: three solver-scored puzzles and one speed-of-processing task.

- **Outbound**: a parking lot. Cars only drive forward; a tapped car leaves the lot or rolls until it bumps something. Levels 3 to 5 contain planted traps (moves after which the lot can no longer be cleared).
- **Conduit**: a garden. Turn pipe tiles until water from the well reaches every plant with no leaks. Every board has exactly one solution.
- **Tumbler**: a vault. Crack a hidden color code. Clues either mark every pin (right spot, elsewhere, absent, as in Wordle) or give only the two counts, as in classic Mastermind.
- **Glimpse**: speed of processing in the useful-field-of-view format. An animal in the middle and, from level 2, a bird around it flash for a few screen frames, then a pattern mask. Pick the animal, then tap where the bird was. Display time adapts on every look.

Each game opens with a short practice round and a guiding hand, so it can be learned by playing. Puzzle moves are scored against a solver: distance to the goal before and after each move for Outbound and Conduit, and expected versus best-possible information (bits) for each Tumbler try.

## Glimpse

| Level | Shows | Like |
| --- | --- | --- |
| 1 | the middle item only (for example rabbit or cat) | processing speed |
| 2 | plus a target on the middle ring, 8 directions | divided attention |
| 3 | the target on any of 3 rings | wider field |
| 4 | plus 23 distractors | selective attention |
| 5 | 47 distractors, and a harder pair (such as cat or fox) | selective attention, finer discrimination |

- **Timing.** Everything shown during a look is drawn on one canvas inside `requestAnimationFrame`, so the flash and the mask change on screen frames. The frame period is measured during each fixation (and snapped to a standard rate within 1.5%), display times are whole frames, and each look logs the planned and the measured on-screen time plus a `frame_drop` flag. Frame timestamps are not photometry: check a new device type with a photodiode before relying on very short times.
- **Rounds.** 6 looks. The first starts on a tap; the rest follow by themselves (fixation 400 to 699 ms, flash, 300 ms mask, two answers, short feedback), about 20 seconds a round.
- **Staircase.** Display times come from a ladder from 500 ms down by x0.9 per step, rounded to frames (at 60 Hz: 30 … 1 frames). One step shorter after a correct look, four steps longer after a miss (weighted up/down, settles at 80% correct). A fresh staircase starts at 300 ms and earns every step. It carries over between rounds of the same level (within a block in research sessions, between visits in free play), and each carried-over round starts one step slower so it opens with a likely hit.
- **Levels.** Two rounds in a row at or under the level's display-time target move up a level; Glimpse never moves down. The targets are game settings, not study values.
- **Field size.** The field scales with the screen (radius logged as `field_px`). On a phone held at 35 cm the outer ring sits about 4 to 5 degrees from the middle, on a 24-inch monitor at 60 cm about 6. The clinical test places its targets about 11 cm out, which is 10 degrees or more at desktop viewing distances, so eccentricity is the main setting gap on phones.
- **Scenes.** Rounds in adaptive blocks and free play are set in a meadow (rabbit or cat; find a bird, butterfly or snail among leaves), the sea (fish or turtle; a starfish, sailboat or jellyfish among shells) or a sunset sky (plane or balloon; a kite, rocket or star among clouds), with the target changing from look to look. Fixed blocks and practice always use the classic meadow set with the bird, so measurement stays comparable. The scene is logged with each round and the target with each look.
- **Stimuli** are our own silhouettes, not the vehicles of the clinical test, so a check built on that test stays a transfer measure.

## Layout

```
src/engines.js   generators, solvers, practice rounds, move scoring, Glimpse trials and staircase (pure, deterministic, no DOM)
src/app.js       feed, scenes, frame-timed canvas, sound, session setup, adaptive levels, logging, export
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
npm test        # determinism, solvability, labels vs brute force, both clue styles, Glimpse balance and staircase vs a simulated observer, speed
```

Puzzle generation runs in a Web Worker built from the same engine source, with a main-thread fallback.

## Hosting

`dist/puzzle-reel.html` is one self-contained HTML file, so any static host works, including GitHub Pages (deploy from the `main` branch; the site root redirects to the page). Outside claude.ai the Save buttons download files directly.

## Reproducibility

A puzzle's seed is `fnv1a(sessionSeed | block | game | level | occurrence)`, and generators are deterministic, so the same session seed and plan give the same puzzles on every device. For Glimpse the seed fixes what is shown in every look (animal, bird position, leaves, fixation time, mask); display times follow the participant's answers. Practice rounds are fixed. The puzzle id (`B{block}-{game}-L{level}-{n}`, or `P-{game}` for practice) and seed are logged with every event. Regenerate any puzzle with `Engines.games[game].generate(level, seed, clueStyle)`.

## Data

Logs stay in the browser's local storage until exported from the Data panel as CSV (moves and looks, puzzles and rounds) or JSON. The in-app codebook ("What the columns mean", or Save codebook) documents every column and move label, the Glimpse levels and its timing method.
