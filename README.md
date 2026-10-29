# Puzzle Reel

A swipe feed of five games with a research session harness: four solver-scored puzzles and one speed-of-processing task.

- **Outbound**: a parking lot. Cars only drive forward; a tapped car leaves the lot or rolls until it bumps something. From level 3, lots contain pinwheels (four cars that each block the next, so one must first slide part of the way); level 4 adds a planted trap (a move after which the lot can no longer be cleared).
- **Conduit**: a garden. Turn pipe tiles until water from the well reaches every plant with no leaks. Every board has exactly one solution, and every pipe is part of it: a board where the plants could be watered around some pipe is never dealt, so a garden in full bloom is always a solved board.
- **Tumbler**: a vault. Crack a hidden color code. Clues either mark every pin (right spot, elsewhere, absent, as in Wordle) or give only the two counts, as in classic Mastermind.
- **Glimpse**: speed of processing in the useful-field-of-view format. An animal in the middle and, from level 2, a bird around it flash for a few screen frames, then a pattern mask. Pick the animal, then tap where the bird was. Display time adapts on every look.
- **Stacks**: the tower-of-London task. Three pieces on three posts that hold 3, 2 and 1; lift the top piece of a post and set it on another until the arrangement matches the goal, in as few moves as possible. Planning time before the first move is logged. It cycles between three settings with the same rules: river stones on stakes, containers moved by a harbor crane, and cake layers on stands (fixed blocks and practice always use the stones).

Each game opens with a short practice round and a guiding hand, so it can be learned by playing. Puzzle moves are scored against a solver: distance to the goal before and after each move for Outbound and Conduit, and expected versus best-possible information (bits) for each Tumbler try.

## Levels and effort

Every game has levels 1 to 5, and a level asks about the same effort in each game. The fewest taps that finish a card, averaged over generated cards (`npm test` prints and checks this table):

| Level | Outbound | Conduit | Tumbler, per-pin clues | Tumbler, count clues | Glimpse | Stacks |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 5 (5×5 lot, 5 cars) | 6.5 (3×4) | 7.0 (2 pins, 4 colors) | 8.4 (2 pins, 4 colors) | 5 (4 looks) | 6 (3 moves) |
| 2 | 7 (6×6, 7 cars) | 7.6 (4×4) | 9.3 (3 pins, 4 colors) | 9.1 (2 pins, 5 colors) | 9 (4 looks) | 8 (4 moves) |
| 3 | 9 (6×6, 8 cars, 1 pinwheel) | 9.6 (4×5) | 10.7 (3 pins, 5 colors) | 11.2 (3 pins, 3 colors) | 11 (5 looks) | 10 (5 moves) |
| 4 | 11 (7×7, 10 cars, 1 pinwheel, 1 trap) | 11.7 (5×5) | 13.3 (4 pins, 5 colors) | 13.7 (3 pins, 4 colors) | 13 (6 looks) | 12 (6 moves) |
| 5 | 13 (7×7, 11 cars, 2 pinwheels) | 14.5 (5×6) | 13.7 (4 pins, 6 colors) | 14.0 (3 pins, 5 colors) | 13 (6 looks) | 14 (7 moves) |

Outbound counts the solver's moves, Conduit the turns needed, Tumbler the taps along the most informative tries (pins already in the right spot carry into the next row with per-pin clues), Glimpse one tap to start plus one per answer, and Stacks two taps per move (lift, set down). Thinking time is not in these numbers; compare `duration_ms` by game and level in pilot data.

Difficulty grows inside each game in its own way: Outbound needs slides from level 3 and avoids a trap at level 4; Conduit levels 4 and 5 keep the board that needs the most search out of 8; Tumbler adds pins and colors; Glimpse widens the field and adds distractors; Stacks needs more moves, which means more pieces parked out of the way first. Levels move the same way in every game. In research blocks, two successes in a row move a level up and one miss moves it down (2-up/1-down), where a success is a solve within par (1.5 times the solver's moves or tries) or, for Glimpse, a round at or under the level's display-time target. Free play uses the same rule with a quick start: one level up per success until the first miss in that game. A skipped or abandoned card never counts as a miss. Glimpse never moves down a level, because its display time already adapts on every look.

## Glimpse

| Level | Shows | Like |
| --- | --- | --- |
| 1 | the middle item only (for example rabbit or hedgehog) | processing speed |
| 2 | plus a target on the middle ring, 8 directions | divided attention |
| 3 | the target on any of 3 rings | wider field |
| 4 | plus 23 distractors | selective attention |
| 5 | 47 distractors, and a harder pair (such as cat or fox) | selective attention, finer discrimination |

- **Timing.** Everything shown during a look is drawn on one canvas inside `requestAnimationFrame`, so the flash and the mask change on screen frames. The frame period is measured during each fixation (and snapped to a standard rate within 1.5%), display times are whole frames, and each look logs the planned and the measured on-screen time plus a `frame_drop` flag. Frame timestamps are not photometry: check a new device type with a photodiode before relying on very short times.
- **Rounds.** 4 looks at levels 1 and 2, 5 at level 3, 6 at levels 4 and 5, so rounds grow with the level like the puzzles do; fixed blocks (measurement) always use 6 looks. The first look starts on a tap and gets an 800 ms longer lead-in with a slow closing ring, so the first flash never comes out of nowhere; the rest follow by themselves (fixation 400 to 699 ms, flash, 300 ms mask, the answers, short feedback), about 10 to 20 seconds a round.
- **Staircase.** Display times come from a ladder from 500 ms down by x0.9 per step, rounded to frames (at 60 Hz: 30 … 1 frames). One step shorter after a correct look, six steps longer after a miss (weighted up/down, settles at about 86% correct, so most looks are hits). Display times never go below 50 ms: a player who gets there moves up a level instead of chasing ever shorter flashes. A fresh staircase starts at 300 ms and earns every step. It carries over between rounds of the same level (within a block in research sessions, between visits in free play), and each carried-over round starts two steps slower so it opens with a likely hit.
- **Levels.** Two rounds in a row at or under the level's display-time target move up a level; Glimpse never moves down. The targets are game settings, not study values.
- **Field size.** The field scales with the screen (radius logged as `field_px`). On a phone held at 35 cm the outer ring sits about 4 to 5 degrees from the middle, on a 24-inch monitor at 60 cm about 6. The clinical test places its targets about 11 cm out, which is 10 degrees or more at desktop viewing distances, so eccentricity is the main setting gap on phones.
- **Scenes.** Rounds in adaptive blocks and free play are set in a meadow (rabbit or hedgehog; find a bird, butterfly or snail among leaves), the sea (fish or turtle; a starfish, sailboat or jellyfish among shells) or a sunset sky (plane or balloon; a kite, rocket or star among clouds), with the target changing from look to look. Fixed blocks and practice always use the classic meadow set with the bird, so measurement stays comparable. The scene is logged with each round and the target with each look.
- **Stimuli** are our own silhouettes, not the vehicles of the clinical test, so a check built on that test stays a transfer measure.

## Profile

The menu's Profile shows every game under one of the concept paper's five areas (Reaction, Memory, Patterns, Problem solving, Focus); Memory and Focus have no game yet. Each game shows its level and stars; tapping it shows cards played, solved, time, one figure of its own (fewest-move solves, tries per code, planning time or best flash) and the evidence level of its format (causal, near or plausible). The numbers come from free play on this device (`pr1.gstats` in local storage, built from the logs the first time). They are game progress only: nothing in the profile scores an area, because area values belong to the checks.

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
npm test        # determinism, solvability, labels vs brute force, both clue styles, every Conduit pipe needed, taps per level, Glimpse balance and staircase vs a simulated observer, speed
```

Puzzle generation runs in a Web Worker built from the same engine source, with a main-thread fallback.

## Hosting

`dist/puzzle-reel.html` is one self-contained HTML file, so any static host works, including GitHub Pages (deploy from the `main` branch; the site root redirects to the page). Outside claude.ai the Save buttons download files directly.

## Reproducibility

A puzzle's seed is `fnv1a(sessionSeed | block | game | level | occurrence)`, and generators are deterministic, so the same session seed and plan give the same puzzles on every device. For Glimpse the seed fixes what is shown in every look (animal, bird position, leaves, fixation time, mask); display times follow the participant's answers. Practice rounds are fixed. The puzzle id (`B{block}-{game}-L{level}-{n}`, or `P-{game}` for practice) and seed are logged with every event. Regenerate any puzzle with `Engines.games[game].generate(level, seed, clueStyle)`.

## Data

Logs stay in the browser's local storage until exported from the Data panel as CSV (moves and looks, puzzles and rounds) or JSON. The in-app codebook ("What the columns mean", or Save codebook) documents every column and move label, the Glimpse levels and its timing method.
