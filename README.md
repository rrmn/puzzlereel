# Puzzle Reel

A swipe feed of seven games with a research session harness: four solver-scored puzzles, a speed-of-processing task, a dual task and an object-location memory task.

- **Outbound**: a parking lot. Cars only drive forward; a tapped car leaves the lot or rolls until it bumps something. From level 3, lots contain pinwheels (four cars that each block the next, so one must first slide part of the way); level 4 adds a planted trap (a move after which the lot can no longer be cleared). With feedback on, levels 1 to 3 mark every move and flag a dead end at once; levels 4 and 5 stay quiet until no car can move.
- **Conduit**: a garden. Turn pipe tiles until water from the well reaches every plant with no leaks. The water visibly runs through each connected pipe from the well, so every flower that opens shows which turn watered it. Every board has exactly one solution, and every pipe is part of it: a board where the plants could be watered around some pipe is never dealt, so a garden in full bloom is always a solved board.
- **Tumbler**: a vault. Crack a hidden color code. Clues either mark every pin (right spot, elsewhere, absent, as in Wordle) or give only the two counts, as in classic Mastermind.
- **Glimpse**: speed of processing in the useful-field-of-view format. An animal in the middle and, from level 2, a bird around it flash for a few screen frames, then a pattern mask. Pick the animal, then tap where the bird was. Display time adapts on every look.
- **Stacks**: the tower-of-London task. Three pieces on three posts that hold 3, 2 and 1; lift the top piece of a post and set it on another until the arrangement matches the goal, in as few moves as possible. Planning time before the first move is logged. It cycles between three settings with the same rules: river stones on stakes, containers moved by a harbor crane, and cake layers on stands (fixed blocks and practice always use the stones).
- **Switchback**: the dual-task format (adaptive multitasking training). Steer a car along a winding road and tap the target sign whenever it comes up (the sign itself, or the button that shows it); let every other sign pass. Each place has its own animal on the target sign, and now and then that animal wanders onto the road: tap it and it moves on. Things to collect lie along the road. How long a sign stays up and how fast the car goes both adapt as you drive.
- **Keepsake**: object-location memory. A few things sit on stepping stones across a park; after a short look they hop into a basket, and you put each back on its stone. Levels add things and stones.

Each game opens with a short practice round and a guiding hand, so it can be learned by playing. A practice round has to be played right before the game goes on (a puzzle solved; Glimpse with at most one miss, Switchback with every sign right, Keepsake with every thing on its stone). If it is not, it says "Once more" and comes round again, up to three tries, and only then moves on; practice rows log `success` as that pass. The cards after practice start at level 1. Rounds of the three trial games (Glimpse, Switchback, Keepsake) get confetti only at three stars or a passed practice; two stars get the win chime without confetti, and fewer a soft note. Puzzle moves are scored against a solver: distance to the goal before and after each move for Outbound and Conduit, and expected versus best-possible information (bits) for each Tumbler try.

## Levels and effort

Every game has levels 1 to 5, and a level asks about the same effort in each game. The fewest taps that finish a card, averaged over generated cards (`npm test` prints and checks this table):

| Level | Outbound | Conduit | Tumbler, per-pin clues | Tumbler, count clues | Glimpse | Stacks | Switchback | Keepsake |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5 (5×5 lot, 5 cars) | 6.5 (3×4) | 7.0 (2 pins, 4 colors) | 8.4 (2 pins, 4 colors) | 5 (4 looks) | 6 (3 moves) | 7 (5 of 8 signs, 1 animal) | 7 (3 things, 6 stones) |
| 2 | 7 (6×6, 7 cars) | 7.6 (4×4) | 9.3 (3 pins, 4 colors) | 9.1 (2 pins, 5 colors) | 9 (4 looks) | 8 (4 moves) | 9 (7 of 12, 1) | 9 (4 of 7) |
| 3 | 9 (6×6, 8 cars, 1 pinwheel) | 9.6 (4×5) | 10.7 (3 pins, 5 colors) | 11.2 (3 pins, 3 colors) | 11 (5 looks) | 10 (5 moves) | 12 (9 of 16, 2) | 11 (5 of 8) |
| 4 | 11 (7×7, 10 cars, 1 pinwheel, 1 trap) | 11.7 (5×5) | 13.3 (4 pins, 5 colors) | 13.7 (3 pins, 4 colors) | 13 (6 looks) | 12 (6 moves) | 14 (11 of 20, 2) | 13 (6 of 10) |
| 5 | 13 (7×7, 11 cars, 2 pinwheels) | 14.5 (5×6) | 13.7 (4 pins, 6 colors) | 14.0 (3 pins, 5 colors) | 13 (6 looks) | 14 (7 moves) | 16 (13 of 24, 2) | 15 (7 of 12) |

Outbound counts the solver's moves, Conduit the turns needed, Tumbler the taps along the most informative tries (pins already in the right spot carry into the next row with per-pin clues), Glimpse one tap to start plus one per answer, Stacks two taps per move (lift, set down), Switchback one tap to start plus one per target sign and one per animal on the road (steering and collecting are not counted), and Keepsake one tap to look plus two per thing (pick up, put down). Thinking time is not in these numbers; compare `duration_ms` by game and level in pilot data.

Difficulty grows inside each game in its own way: Outbound needs slides from level 3 and avoids a trap at level 4; Conduit levels 4 and 5 keep the board that needs the most search out of 8; Tumbler adds pins and colors; Glimpse widens the field and adds distractors; Stacks needs more moves, which means more pieces parked out of the way first; Switchback brings tighter, more frequent bends on a narrower road, other signs that look more and more like the target, and more animals on the road; Keepsake puts out more things and more empty stones, with a little more time to look. Levels move the same way in every game. In research blocks, two successes in a row move a level up and one miss moves it down (2-up/1-down), where a success is a solve within par (1.5 times the solver's moves or tries) or, for Glimpse, a round at or under the level's display-time target (Switchback: a drive at or under the level's sign time and at or over its speed). Free play uses the same rule with a quick start: one level up per success until the first miss in that game. In free play the run of successes toward the next level carries over between visits. A skipped or abandoned card never counts as a miss. Skip goes straight to the next card: one tap in free play; in research sessions (when allowed) a second tap on the same button, and the skipped card still uses up its place in the block. Glimpse and Switchback never move down a level, because their timing already adapts as you play.

## Glimpse

| Level | Shows | Like |
| --- | --- | --- |
| 1 | the middle item only (for example rabbit or hedgehog) | processing speed |
| 2 | plus a target on the middle ring, 8 directions | divided attention |
| 3 | the target on any of 3 rings | wider field |
| 4 | plus 23 distractors | selective attention |
| 5 | 47 distractors, and a harder pair (such as cat or fox) | selective attention, finer discrimination |

- **Timing.** Everything shown during a look is drawn on one canvas inside `requestAnimationFrame`, so the flash and the mask change on screen frames. The frame period is measured during each fixation (and snapped to a standard rate within 1.5%), display times are whole frames, and each look logs the planned and the measured on-screen time plus a `frame_drop` flag. Frame timestamps are not photometry: check a new device type with a photodiode before relying on very short times.
- **Rounds.** 4 looks at levels 1 and 2, 5 at level 3, 6 at levels 4 and 5, so rounds grow with the level like the puzzles do; fixed blocks (measurement) always use 6 looks. The first look starts on a tap; the rest follow by themselves. Each look opens with a fixation ring that closes slowly over about a second (fixation 1200 to 1499 ms), then the flash, a 300 ms mask, the answers and short feedback: about 15 to 25 seconds a round.
- **Staircase.** Display times come from a ladder from 800 ms down by x0.9 per step, rounded to frames (at 60 Hz: 48 … 1 frames). One step shorter after a correct look, six steps longer after a miss (weighted up/down, settles at about 86% correct, so most looks are hits). Display times never go below 50 ms: a player who gets there moves up a level instead of chasing ever shorter flashes. A fresh staircase starts at 500 ms and earns every step. It carries over between rounds of the same level (within a block in research sessions, between visits in free play), and each carried-over round starts two steps slower so it opens with a likely hit.
- **Levels.** Two rounds in a row at or under the level's display-time target move up a level; Glimpse never moves down. The targets are game settings, not study values.
- **Field size.** The field scales with the screen (radius logged as `field_px`). On a phone held at 35 cm the outer ring sits about 4 to 5 degrees from the middle, on a 24-inch monitor at 60 cm about 6. The clinical test places its targets about 11 cm out, which is 10 degrees or more at desktop viewing distances, so eccentricity is the main setting gap on phones.
- **Scenes.** Rounds in adaptive blocks and free play are set in a meadow (rabbit or hedgehog; find a bird, butterfly or snail among leaves), the sea (fish or turtle; a starfish, sailboat or jellyfish among shells) or a sunset sky (plane or balloon; a kite, rocket or star among clouds), with the target changing from look to look. Fixed blocks and practice always use the classic meadow set with the bird, so measurement stays comparable. The scene is logged with each round and the target with each look.
- **Stimuli** are our own silhouettes, not the vehicles of the clinical test, so a check built on that test stays a transfer measure.

## Switchback

- **Driving.** The car keeps moving sideways while the wheel is turned, and a bend pushes it outward, more the faster it goes, so holding a bend takes steady steering. Drag anywhere on the road to steer (or use the arrow keys); the wheel shows the lock. Time on the road is logged; leaving it slows the car.
- **Signs.** One sign at a time comes up just right of the road ahead. Tap it when it is the target: on the sign itself (test players went for the sign, not the button), on the sign button at the bottom right, which shows the target, or with Space. The target is the place's animal on a warning triangle. Other signs grow more similar by level: blue signs, red-and-white round signs, warning triangles with symbols, triangles with other animals (bird, snail, turtle), then look-alikes (geese, swans and hens in the village; reindeer, deer and bears in the north). The target stays the same for the whole drive.
- **Animals on the road.** Once a drive at L1 and L2 and twice from L3, the place's animal steps onto the road ahead between two signs and stands in the middle. The car eases off while it is there; a tap on it (or H) and the horn toots, it hurries off, and the car picks up speed again. If it is still there when the car gets close, the car brakes and the animal moves on by itself. In the village the duck brings her ducklings. These moments have their own 3 s between signs, so they never overlap a sign, and the speed measure leaves out the time from the animal stepping out until the car is back to speed (`brake_s`).
- **Things to collect.** Short rows of things float over the road, one kind for each place (apples, watermelon, carrots, water drops, acorns, bananas, starfish, opals, cherries, snowflakes). Driving through them picks them up; they are counted in the corner and logged (`n_items`, `n_collected`), but they are not tapped and do not enter any task measure.
- **Places.** Ten places, two for each level and time of day; the seed picks one. L1 morning: a farm with hedgerows (cows) or the savanna under a snowy mountain, with a balloon over the acacias (elephants). L2 noon: wheat and lavender fields (rabbits) or the desert dunes with a caravan far off (camels). L3 afternoon: a pine forest under snowy peaks (deer) or the jungle, with mist and parrots (monkeys). L4 sunset: the coast road beside the sea (crabs) or the red outback (kangaroos). L5: a village street at dusk (ducks) or the north at night under the northern lights (moose). The landmark at the end (barn, baobab, windmill, oasis, cabin, waterfall, lighthouse, great red rock, village, red cottage) sits small on the skyline where the road runs out; in the last seconds of the drive it comes into reach as a real place beside the road, the car drives through the chequered finish line in front of it and rolls to a stop just past it. The road, its lines, the sign shapes and the car are the same everywhere; `place` is logged, so the animal and the scenery are a covariate within a level. Practice is on the farm, with the cow.
- **Feedback.** With feedback on, a caught target's animal comes off the sign and runs or hops into the field (about 1 s, after the tap); a missed target or a tap on another sign gets a red ring. With feedback off, signs just go. A soft engine hum follows the speed when sound is on.
- **Adapting.** A sign stays up 1.5 s in a fresh round; a caught target makes the next one shorter, a missed target or a tap on another sign longer (settles near 80% of targets caught). Every 1.5 s the speed goes up while the car stays on the road and down when it leaves. Both carry over to the next drive at the same level. A drive succeeds when both reach the level's targets.
- **Evidence.** The format of the Focus core in the concept paper (Anguera et al. 2013: 12 hours over four weeks at home, ages 60 to 85, effects after six months). The animals on the road and the things to collect are our additions: an occasional second response and a reason to steer. They sit in their own time between signs, but they make a drive longer and busier than the original, so compare with the published effect with that in mind. As with every core, the format is proven, not our dose.

## Keepsake

- **The map.** One park, always the same, drawn by hand: a house, a pond, a big tree, a well, a flower bed and a bench along a winding path, with twelve stones placed beside them. The landmarks stay put so they can be learned; each card brings out 4 to 8 stones and puts 2 to 6 things on them, from the seed. Stones and things are drawn large enough to read and tap at arm's length.
- **A card.** Tap the eye to look: the things appear and a timer runs on the basket (5 to 11 s by level; a tap on the basket ends the look early and is logged). The things hop into the basket, then you drag or tap each back onto a stone. One try per thing.
- **Feedback.** With feedback on (free play), a thing on its own stone turns green; one on a wrong stone turns red and moves to its own stone. With feedback off, things stay where they are put.
- **Scoring.** Each placement logs the right and the chosen stone, the distance between them and the time it took. A card succeeds with at most one thing on a wrong stone. Evidence level: near (object-location memory is an established measurement paradigm).

## Profile

The menu's Profile has two views in one sheet.

- **Every game at a glance**, on one phone screen: three big numbers (stars, days played, minutes), then the seven games under the concept paper's five areas (Reaction, Memory, Patterns, Problem solving, Focus). Each row shows the game's picture, its level ladder from Beginner to Master with the next step filling up (half filled when one of the two good cards for it is done; a lighter tint up to the best level reached, for games that can step back), the level's name and the game's stars.
- **One game's own page**, opened by tapping its row (the arrow at the top goes back to the overview, where it was):
  - a header card with the game's picture, its area, level and ladder;
  - **Next**: the good cards still needed as slots that fill in, what a good card is in the game's own terms (Glimpse: a flash at or under the level's target; Switchback: sign time and speed; the others: two or three stars), and a Play button straight into that game;
  - **the player's own curve**: the last twelve rounds, newest on the right. Glimpse shows each round's flash and Switchback each drive's sign time and speed as bars, with a notch at the target that round's level had; bars that met it are in the game's color. The puzzles show each card's stars, Keepsake the things put back on the right stone. Tapping a round reads it out (moves against the best, sign time, things right). When the first two and the last two rounds at the current level show a clear gain, a small badge with a rising arrow sits on that chart (Glimpse: ms shorter; Switchback: sign time shorter, speed higher); otherwise nothing is shown;
  - **three numbers**: cards (rounds, drives), minutes, and one figure of the game's own (fewest-move solves, tries per code, planning time, fastest correct look, best speed, cards with every thing right).

The profile speaks only in the games' own terms: no evidence levels, studies or explanations on screen (those live in this README and the codebook).

In free play the good cards toward the next level carry over between visits, so a run is never lost by closing the app. After a good card that does not level up yet, the result says "One more for Expert" with a slot that fills in; a level up names the new level, and Switchback, like Glimpse, marks a new best.

Everything comes from free play on this device (local storage: `pr1.gstats` totals, `pr1.ghist` the last 24 rounds per game, `pr1.days` the days played, `pr1.lvrun` the run toward each next level; the first three are built from the logs the first time). They are game progress only: nothing in the profile scores an area, because area values belong to the checks.

## Layout

```
src/engines.js   generators, solvers, practice rounds, move scoring, the Glimpse and Switchback staircases, Keepsake scoring (pure, deterministic, no DOM)
src/app.js       feed, scenes, frame-timed canvas, sound, session setup, adaptive levels, logging, export
src/style.css    styles
src/shell.html   page template
build.js         inlines everything into dist/
test/            node tests for the engines
index.html       the built page itself at the site root, so puzzlereel.org opens the app directly
```

## Build and test

No dependencies; Node 18 or later.

```
npm run build   # writes index.html and dist/puzzle-reel.html (standalone, the same page) and dist/artifact.html (claude.ai)
npm test        # determinism, solvability, labels vs brute force, both clue styles, every Conduit pipe needed, taps per level, Glimpse balance and staircase vs a simulated observer, Switchback places, signs, animals, things and staircases, Keepsake placement, speed
```

Puzzle generation runs in a Web Worker built from the same engine source, with a main-thread fallback.

## Hosting

`dist/puzzle-reel.html` is one self-contained HTML file, so any static host works, including GitHub Pages (deploy from the `main` branch; the build also writes the page to `index.html`, so the site root serves the app itself with no redirect). Outside claude.ai the Save buttons download files directly.

## Reproducibility

A puzzle's seed is `fnv1a(sessionSeed | block | game | level | occurrence)`, and generators are deterministic, so the same session seed and plan give the same puzzles on every device. For Glimpse the seed fixes what is shown in every look (animal, bird position, leaves, fixation time, mask); display times follow the participant's answers. Practice rounds are fixed. The puzzle id (`B{block}-{game}-L{level}-{n}`, or `P-{game}` for practice) and seed are logged with every event. Regenerate any puzzle with `Engines.games[game].generate(level, seed, clueStyle)`.

## Data

Logs stay in the browser's local storage until exported from the Data panel as CSV (moves and looks, puzzles and rounds) or JSON. The in-app codebook ("What the columns mean", or Save codebook) documents every column and move label, the Glimpse levels and its timing method.

