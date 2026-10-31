// Run: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engines.js');
const { obAnalyze, obOccupancy, obSlide, cdSolve, tbSpace, tbCount, tbPin, tbMarks, tbBest, tbEntropy, tbEncode, tbSeen } = E.internals;
const O = E.games.outbound, C = E.games.conduit, T = E.games.tumbler;

const strip = (p) => JSON.stringify(p, (k, v) => (k === 'an' ? undefined : v));

test('generators are deterministic for a given level and seed', () => {
  for (const g of E.order) {
    for (const lv of [1, 3, 5]) {
      const a = E.games[g].generate(lv, 12345);
      const b = E.games[g].generate(lv, 12345);
      if (g === 'tumbler') assert.notEqual(strip(a), strip(E.games[g].generate(lv, 12345, 'count')), 'clue style changes the puzzle');
      assert.equal(strip(a), strip(b), g + ' L' + lv);
      const c = E.games[g].generate(lv, 12346);
      assert.notEqual(strip(a), strip(c), g + ' L' + lv + ' different seed');
    }
  }
});

test('puzzle seeds depend on every part of the address', () => {
  const base = E.puzzleSeed(42, 0, 'outbound', 2, 0);
  assert.equal(base, E.puzzleSeed(42, 0, 'outbound', 2, 0));
  for (const s of [E.puzzleSeed(43, 0, 'outbound', 2, 0), E.puzzleSeed(42, 1, 'outbound', 2, 0), E.puzzleSeed(42, 0, 'conduit', 2, 0), E.puzzleSeed(42, 0, 'outbound', 3, 0), E.puzzleSeed(42, 0, 'outbound', 2, 1)]) {
    assert.notEqual(base, s);
  }
});

// Independent check: brute-force search from a state, no memo shared with the engine.
function obSolvable(p, st, seen = new Set()) {
  if (st.every((a) => a === E.EXIT)) return true;
  const key = st.join(',');
  if (seen.has(key)) return false;
  seen.add(key);
  const occ = obOccupancy(p, st);
  for (let i = 0; i < st.length; i++) {
    if (st[i] === E.EXIT) continue;
    const na = obSlide(p, st, occ, i);
    if (na === st[i]) continue;
    const ns = st.slice(); ns[i] = na;
    if (obSolvable(p, ns, seen)) return true;
  }
  return false;
}

test('outbound: every level is solvable, hints follow an optimal path, labels match distances', () => {
  for (const lv of [1, 2, 3, 4, 5]) {
    for (let s = 0; s < 12; s++) {
      const p = O.generate(lv, 500 + s);
      assert.ok(Number.isFinite(p.an.optimal), 'solvable');
      assert.equal(p.cars.length, O.levels[lv].cars);
      assert.ok(p.an.optimal >= p.cars.length);
      // follow hints: must solve in exactly `optimal` moves, each labelled optimal
      const run = O.newRun(p);
      let moves = 0;
      for (;;) {
        const h = O.hint(p, run);
        if (h.kind !== 'target') break;
        const r = O.tap(p, run, h.index);
        assert.equal(r.cls, 'optimal');
        moves++;
        if (r.solved) break;
      }
      assert.equal(moves, p.an.optimal, 'hint path length L' + lv);
      assert.ok(run.st.every((a) => a === E.EXIT));
    }
  }
});

test('outbound: random play labels dead ends correctly and undo restores state', () => {
  const rng = E.makeRng(99);
  let deadEnds = 0, checked = 0;
  for (const lv of [3, 4, 5]) {
    for (let s = 0; s < 10; s++) {
      const p = O.generate(lv, 900 + s);
      const run = O.newRun(p);
      for (let step = 0; step < 60; step++) {
        const mov = O.movable(p, run);
        if (!mov.length) break;
        const before = run.st.slice();
        const r = O.tap(p, run, mov[rng.int(mov.length)]);
        assert.equal(r.kind, 'move');
        const truth = obSolvable(p, run.st.slice());
        assert.equal(Number.isFinite(r.dAfter), truth, 'distance label agrees with brute force');
        if (r.cls === 'dead_end') {
          deadEnds++;
          assert.equal(truth, false);
          assert.ok(Number.isFinite(r.dBefore));
        }
        if (r.cls === 'optimal') assert.equal(r.dAfter, r.dBefore - 1);
        if (r.cls === 'wasted') assert.ok(r.dAfter >= r.dBefore);
        checked++;
        // undo then redo must round-trip
        const u = O.undo(p, run);
        assert.deepEqual(run.st, before);
        assert.equal(u.to, r.from);
        O.tap(p, run, r.index);
        if (r.solved) break;
      }
    }
  }
  assert.ok(deadEnds > 0, 'random play should hit at least one planted trap');
  assert.ok(checked > 100);
});

test('outbound: slides from level 2, dead ends from level 3, and a sensible player clears less and less', () => {
  const avg = {};
  for (const lv of [1, 2, 3, 4, 5]) {
    let sum = 0, trapped = 0;
    for (let s = 0; s < 20; s++) {
      const p = O.generate(lv, 2000 + s);
      // a sensible player: drives out any car that can leave, and only then slides one at random
      sum += p.an.pSmart;
      if (p.an.deadStates > 0) trapped++;
      // level 1 clears by tapping only cars with a clear way out; each pinwheel needs a slide,
      // and in the denser lots of levels 3 to 5 cars that hold each other up can need more
      if (O.levels[lv].dense) assert.ok(p.an.minSlides >= O.levels[lv].loops, 'L' + lv + ' slides');
      else assert.equal(p.an.minSlides, O.levels[lv].loops, 'L' + lv + ' slides');
      if (O.levels[lv].maxOpt) assert.ok(p.an.optimal <= O.levels[lv].maxOpt, 'L' + lv + ' taps ' + p.an.optimal);
    }
    avg[lv] = sum / 20;
    if (lv >= 3) assert.ok(trapped >= 18, 'L' + lv + ' trapped ' + trapped);
  }
  assert.ok(avg[1] === 1 && avg[2] === 1, 'levels 1 and 2 are cleared by sensible play: ' + JSON.stringify(avg));
  assert.ok(avg[3] < 0.7 && avg[3] > avg[4] && avg[4] > avg[5] && avg[5] <= 0.3, 'harder at every level from 3: ' + JSON.stringify(avg));
});

test('outbound: a pinwheel cannot be cleared without a slide, and one slide frees it', () => {
  const { obPlantLoop } = E.internals;
  for (let s = 0; s < 30; s++) {
    const rng = E.makeRng(40 + s);
    const occ = new Int16Array(36).fill(-1);
    const cars = [];
    assert.ok(obPlantLoop({ w: 6, h: 6 }, rng, occ, cars));
    const p = { w: 6, h: 6, cars };
    const an = obAnalyze(p);
    assert.equal(an.minSlides, 1);
    assert.equal(an.optimal, 5, 'one slide and four exits');
    assert.deepEqual(O.movable({ w: 6, h: 6, cars }, { st: [0, 0, 0, 0] }).length > 0, true);
  }
});

test('conduit: one solution (or a few from level 3), scrambled start, labels match distance', () => {
  for (const lv of [1, 2, 3, 4, 5]) {
    for (let s = 0; s < 10; s++) {
      const p = C.generate(lv, 300 + s);
      const res = cdSolve(p.w, p.h, p.sol, 5);
      assert.equal(res.solutions, p.alts ? p.alts.length : 1, 'solutions L' + lv);
      if (lv < 3) assert.equal(p.alts, null, 'one solution at L' + lv);
      const run = C.newRun(p);
      assert.equal(C.dist(p, run.rot), p.reference);
      assert.ok(p.reference > 0);
      // tapping a solved tile is wasted; a wrong tile is optimal
      let solvedTile = -1, wrongTile = -1;
      for (let i = 0; i < p.sol.length; i++) {
        if (C.needAt(p, run.rot, i) === 0 && p.per[i] > 1 && solvedTile < 0) solvedTile = i;
        if (C.needAt(p, run.rot, i) > 0 && wrongTile < 0) wrongTile = i;
      }
      const r1 = C.tap(p, run, wrongTile);
      assert.equal(r1.cls, 'optimal');
      assert.equal(r1.dAfter, r1.dBefore - 1);
      C.undo(p, run);
      assert.equal(C.dist(p, run.rot), p.reference);
      if (solvedTile >= 0) {
        const r2 = C.tap(p, run, solvedTile);
        assert.equal(r2.cls, 'wasted');
        assert.ok(r2.dAfter > r2.dBefore);
        C.undo(p, run);
      }
      // solve by turning each tile the needed number of times
      let last;
      for (let i = 0; i < p.sol.length; i++) {
        const need = C.needAt(p, run.rot, i);
        for (let k = 0; k < need; k++) last = C.tap(p, run, i);
      }
      assert.ok(last.solved);
      const on = C.connected(p, run);
      assert.ok(on.every((v) => v === 1), 'all tiles connected when solved');
    }
  }
});

function naiveCount(a, b) {
  let exact = 0;
  const ca = {}, cb = {};
  for (let k = 0; k < a.length; k++) {
    if (a[k] === b[k]) exact++;
    ca[a[k]] = (ca[a[k]] || 0) + 1;
    cb[b[k]] = (cb[b[k]] || 0) + 1;
  }
  let common = 0;
  for (const c in ca) common += Math.min(ca[c], cb[c] || 0);
  return [exact, common - exact];
}
// Wordle rules: exact first, then repeated colors marked left to right while unmatched copies remain
function naivePin(guess, code) {
  const marks = new Array(guess.length).fill(0);
  const left = {};
  for (let k = 0; k < guess.length; k++) {
    if (guess[k] === code[k]) marks[k] = 2;
    else left[code[k]] = (left[code[k]] || 0) + 1;
  }
  for (let k = 0; k < guess.length; k++) {
    if (marks[k] === 2) continue;
    if (left[guess[k]] > 0) { marks[k] = 1; left[guess[k]]--; }
  }
  return marks;
}

test('tumbler: both clue styles match naive implementations', () => {
  const rng = E.makeRng(7);
  for (const [P, C] of [[4, 6], [5, 7], [3, 4]]) {
    const sp = tbSpace(P, C);
    for (let k = 0; k < 3000; k++) {
      const a = rng.int(sp.total), b = rng.int(sp.total);
      const A = T.toLetters(sp, a), B = T.toLetters(sp, b);
      const fb = tbCount(sp, a, b);
      const [ex, pa] = naiveCount(A, B);
      assert.equal(Math.floor(fb / (P + 1)), ex);
      assert.equal(fb % (P + 1), pa);
      assert.deepEqual(tbMarks(sp, tbPin(sp, a, b)), naivePin(A, B), A + ' vs ' + B);
    }
  }
  // repeated colors: one A in the code marks only the first extra A
  const sp = tbSpace(4, 6);
  assert.deepEqual(tbMarks(sp, tbPin(sp, tbEncode(sp, [0, 0, 1, 1]), tbEncode(sp, [2, 0, 0, 3]))), [1, 2, 0, 0]);
  assert.deepEqual(tbMarks(sp, tbPin(sp, tbEncode(sp, [0, 0, 0, 1]), tbEncode(sp, [1, 2, 3, 0]))), [1, 0, 0, 1]);
});

test('tumbler: symmetry pruning finds the same best information as a full search', () => {
  const rng = E.makeRng(11);
  for (const mode of ['pin', 'count']) {
    for (const lv of [2, 3, 4]) {
      for (let trial = 0; trial < 5; trial++) {
        const p = T.generate(lv, 60 + trial, mode);
        const sp = tbSpace(p.P, p.C);
        const run = T.newRun(p);
        for (let step = 0; step < 3; step++) {
          if (step === 1 && trial % 2 === 0) T.hint(p, run); // revealed pins must count as seen colors
          const digits = Array.from({ length: p.P }, () => rng.int(Math.min(p.C, 2 + step * 2)));
          const r = T.guess(p, run, digits);
          if (r.solved || run.S.length <= 1) break;
          const seen = tbSeen(sp, run.tries.map((t) => tbEncode(sp, t.digits)), run.revealed);
          const fast = tbBest(sp, run.S, seen, mode).H;
          let slow = -1;
          const buf = new Int32Array(mode === 'pin' ? Math.pow(3, p.P) : (p.P + 1) * (p.P + 1));
          for (let g = 0; g < sp.total; g++) slow = Math.max(slow, tbEntropy(sp, g, run.S, buf, mode));
          assert.ok(Math.abs(fast - slow) < 1e-9, mode + ' L' + lv + ' step ' + step + ': ' + fast + ' vs ' + slow);
        }
      }
    }
  }
});

test('tumbler: solver path cracks the code, annotate labels tries, hints narrow the codes', () => {
  for (const mode of ['pin', 'count']) {
    for (const lv of [1, 2, 3, 4, 5]) {
      for (let s = 0; s < 4; s++) {
        const p = T.generate(lv, 80 + s, mode);
        assert.equal(p.clue, mode);
        const parts = p.features.solver_path.split(' ');
        assert.equal(parts[parts.length - 1], p.secretDigits.map((d) => T.letters[d]).join(''));
        assert.equal(parts.length, p.reference);
        assert.ok(p.reference <= p.max, 'solver fits in the allowed tries');
        const run = T.newRun(p);
        for (const word of parts) {
          const r = T.annotate(p, T.guess(p, run, word.split('').map((ch) => T.letters.indexOf(ch))));
          assert.ok(r.cls === 'optimal' || r.cls === 'solved', r.cls);
        }
        assert.ok(run.tries[run.tries.length - 1].exact === p.P);
      }
    }
  }
  // repeating a try gives no information
  const p = T.generate(3, 1, 'count');
  const run = T.newRun(p);
  const g = p.secretDigits.map((d) => (d + 1) % p.C);
  T.annotate(p, T.guess(p, run, g));
  const again = T.annotate(p, T.guess(p, run, g));
  assert.equal(again.cls, 'zero_info');
  assert.equal(again.consistent, false);
  // a hint reveals a true pin and keeps the code among the candidates
  const q = T.generate(4, 9, 'pin');
  const r2 = T.newRun(q);
  const hint = T.hint(q, r2);
  assert.equal(hint.kind, 'reveal');
  assert.equal(hint.color, q.secretDigits[hint.pos]);
  assert.ok(Array.from(r2.S).includes(q.secret));
  assert.ok(hint.candsAfter < hint.candsBefore);
});

test('practice boards are small, solvable and unique', () => {
  const ob = O.practice();
  assert.equal(ob.reference, 3);
  const run = O.newRun(ob);
  assert.equal(O.tap(ob, run, 1).cls, 'blocked'); // blue waits for red
  assert.equal(O.blocker(ob, run, 1), 0);
  const cd = C.practice();
  assert.equal(cdSolve(cd.w, cd.h, cd.sol, 2).solutions, 1);
  assert.equal(cd.reference, 3);
  for (const mode of ['pin', 'count']) {
    const tb = T.practice(mode);
    assert.equal(tb.P, 2);
    const r = T.newRun(tb);
    const first = T.guess(tb, r, [0, 1]); // red, blue: both colors in the wrong spots
    assert.equal(first.partial, 2);
    assert.ok(T.guess(tb, r, [1, 0]).solved);
  }
});

test('outbound: stuck cars are reported only in dead ends', () => {
  let checked = 0;
  for (let s = 0; s < 12; s++) {
    const p = O.generate(4, 700 + s);
    const run = O.newRun(p);
    assert.deepEqual(O.stuckCars(p, run), []);
    for (let step = 0; step < 40; step++) {
      const mov = O.movable(p, run);
      if (!mov.length) break;
      let pick = mov[0];
      for (const i of mov) {
        const ns = run.st.slice(); ns[i] = obSlide(p, ns, obOccupancy(p, ns), i);
        if (O.dist(p, ns) === Infinity) { pick = i; break; }
      }
      const r = O.tap(p, run, pick);
      const stuck = O.stuckCars(p, run);
      if (r.dAfter === Infinity) { assert.ok(stuck.length >= 2, 'a dead end traps at least two cars'); checked++; break; }
      assert.deepEqual(stuck, []);
    }
  }
  assert.ok(checked > 0);
});

test('serialize/restore round-trips runs for every game', () => {
  const p1 = O.generate(4, 5); const r1 = O.newRun(p1);
  O.tap(p1, r1, O.movable(p1, r1)[0]);
  assert.deepEqual(O.restore(p1, JSON.parse(JSON.stringify(O.serialize(r1)))), r1);
  const p2 = C.generate(3, 5); const r2 = C.newRun(p2);
  C.tap(p2, r2, 3); C.tap(p2, r2, 7);
  assert.deepEqual(C.restore(p2, JSON.parse(JSON.stringify(C.serialize(r2)))), r2);
  for (const mode of ['pin', 'count']) {
    const p3 = T.generate(4, 5, mode); const r3 = T.newRun(p3);
    T.guess(p3, r3, p3.secretDigits.map(() => 0)); T.hint(p3, r3); T.guess(p3, r3, p3.secretDigits.map((d, k) => k % p3.C));
    const back = T.restore(p3, JSON.parse(JSON.stringify(T.serialize(r3))));
    assert.deepEqual(Array.from(back.S), Array.from(r3.S));
    assert.deepEqual(back.revealed, r3.revealed);
  }
});

test('generation is fast enough to run ahead of play', () => {
  const budget = { outbound: 2500, conduit: 400, tumbler: 600, glimpse: 50, stacks: 50, switchback: 50, keepsake: 20 };
  for (const g of E.order) {
    for (const lv of [1, 2, 3, 4, 5]) {
      let worst = 0;
      for (let s = 0; s < 8; s++) {
        const t0 = Date.now();
        E.games[g].generate(lv, 4000 + s);
        worst = Math.max(worst, Date.now() - t0);
      }
      assert.ok(worst < budget[g], g + ' L' + lv + ' worst ' + worst + 'ms');
    }
  }
});

// ---------------------------------------------------------------- Glimpse
const G = E.games.glimpse;
const { glLadder, glSlotOf } = E.internals;

test('glimpse: rounds are balanced and the bird never shares a spot with a leaf', () => {
  for (const lv of [1, 2, 3, 4, 5]) {
    const L = G.levels[lv];
    for (let s = 0; s < 20; s++) {
      const p = G.generate(lv, 900 + s);
      assert.equal(p.n, L.looks);
      assert.equal(p.trials.filter((t) => t.c === 0).length, Math.ceil(p.n / 2), 'animals in equal shares');
      for (const t of p.trials) {
        assert.ok(t.fix >= G.fixMs[0] && t.fix < G.fixMs[1]);
        if (!L.periph) { assert.equal(t.dir, undefined); continue; }
        assert.ok(L.rings.includes(t.ring));
        assert.equal(t.d.length, L.distract);
        const tgt = glSlotOf(t.ring, t.dir);
        assert.ok(t.d.every(([k]) => k !== tgt && k >= 0 && k < G.slots.length));
        assert.equal(new Set(t.d.map(([k]) => k)).size, t.d.length, 'one leaf per spot');
      }
      if (L.periph) {
        assert.equal(new Set(p.trials.map((t) => t.dir)).size, Math.min(8, p.n), 'directions spread evenly');
        const per = L.rings.map((r) => p.trials.filter((t) => t.ring === r).length);
        assert.ok(Math.max(...per) - Math.min(...per) <= 1, 'rings in equal shares');
      }
    }
  }
});

test('glimpse: direction spots sit on the ring at the right angle, and items cannot overlap', () => {
  for (const ring of [1, 2, 3]) {
    for (let d = 0; d < 8; d++) {
      const sl = G.slots[glSlotOf(ring, d)];
      assert.equal(sl.ring, ring);
      assert.equal(sl.a, d * 45);
    }
  }
  // items are drawn 0.2 R wide (0.34 R in the middle); centers must be further apart
  const xy = G.slots.map((sl) => [Math.sin((sl.a * Math.PI) / 180) * sl.r, -Math.cos((sl.a * Math.PI) / 180) * sl.r]);
  let min = Infinity;
  for (let i = 0; i < xy.length; i++) for (let j = i + 1; j < xy.length; j++) min = Math.min(min, Math.hypot(xy[i][0] - xy[j][0], xy[i][1] - xy[j][1]));
  assert.ok(min > 0.2, 'closest pair ' + min.toFixed(3));
  assert.ok(Math.min(...xy.map(([x, y]) => Math.hypot(x, y))) - 0.1 > 0.17, 'clear of the middle animal');
  assert.ok(Math.max(...xy.map(([x, y]) => Math.hypot(x, y))) + 0.1 < 1, 'inside the field');
});

test('glimpse: the frame ladder runs from about 2000 ms to one frame at any refresh rate', () => {
  for (const hz of [30, 50, 60, 90, 120, 144]) {
    const T = 1000 / hz;
    const lad = glLadder(T);
    assert.equal(lad[lad.length - 1], 1);
    assert.ok(Math.abs(lad[0] * T - 2000) <= T / 2 + 1e-9, hz + ' Hz starts at 2000 ms');
    for (let i = 1; i < lad.length; i++) assert.ok(lad[i] < lad[i - 1], 'strictly shorter');
  }
  assert.deepEqual(glLadder(1000 / 60), [120, 108, 97, 87, 79, 71, 64, 57, 52, 46, 42, 38, 34, 31, 27, 25, 22, 20, 18, 16, 15, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
});

test('glimpse: a fresh staircase starts at 1500 ms, one step shorter after a hit, six longer after a miss, never under 50 ms', () => {
  const p = G.generate(2, 77);
  const run = G.newRun(p, null);
  const T = 1000 / 60;
  const steps = [];
  for (const ok of [1, 1, 0, 1, 1, 0]) {
    const plan = G.plan(p, run, T);
    steps.push(plan.idx);
    G.record(p, run, { correct: !!ok, plan });
  }
  assert.equal(G.startMs, 1500);
  assert.deepEqual(steps, [3, 4, 5, 0, 1, 2]);
  const sm = G.summary(p, run);
  assert.equal(sm.correct, 4);
  assert.equal(sm.reversals, 3);
  assert.equal(Math.round(run.ms), 2000, 'six steps up after the last miss, capped at the top');
  // carried staircases start two steps slower than where they left off
  const run2 = G.newRun(p, { ms: run.ms });
  assert.equal(G.plan(p, run2, T).idx, 0, 'capped at the top of the ladder');
  G.record(p, run2, { correct: true, plan: G.plan(p, run2, T) });
  assert.equal(G.plan(p, run2, T).idx, 1);
  const run3 = G.newRun(p, { ms: 100 });
  assert.equal(Math.round(G.plan(p, run3, T).ms), 117, '100 ms carried starts two steps slower, at 117 ms');
  // a long run of hits stops at the floor: 3 frames at 60 Hz, 6 at 120 Hz
  for (const hz of [60, 120]) {
    const r = G.newRun(p, null);
    let last = null;
    for (let i = 0; i < 40; i++) { last = G.plan(p, r, 1000 / hz); G.record(p, r, { correct: true, plan: last }); }
    assert.equal(Math.round(last.ms), 50, hz + ' Hz floor');
  }
});

test('glimpse: the staircase settles near its target point of a simulated observer', () => {
  // Weibull observer, 2 alternatives in the middle and 8 directions around: chance 1/16
  for (const [alpha, hz] of [[60, 60], [140, 60], [45, 120]]) {
    const beta = 2.2, g = 1 / 16;
    const pc = (ms) => g + (1 - g) * (1 - Math.exp(-Math.pow(ms / alpha, beta)));
    const pT = G.up / (G.up + G.down);
    const dT = alpha * Math.pow(-Math.log(1 - (pT - g) / (1 - g)), 1 / beta);
    const rng = E.makeRng(alpha * 31 + hz);
    const p = G.generate(3, 1);
    const run = G.newRun(p, null);
    const shown = [];
    for (let i = 0; i < 600; i++) {
      const plan = G.plan(p, run, 1000 / hz);
      shown.push(plan.ms);
      G.record(p, run, { correct: rng() < pc(plan.ms), plan });
    }
    const tail = shown.slice(200);
    const gm = Math.exp(tail.reduce((a, x) => a + Math.log(x), 0) / tail.length);
    assert.ok(gm > dT / 1.3 && gm < dT * 1.3, 'alpha ' + alpha + ': settled at ' + gm.toFixed(1) + ' ms, target point ' + dT.toFixed(1));
    const acc = run.res.slice(200).filter((x) => x.ok).length / 400;
    assert.ok(acc > pT - 0.07 && acc < pT + 0.07, 'accuracy ' + acc.toFixed(3));
  }
});

test('glimpse: practice is fixed, uses long display times and does not adapt', () => {
  const a = G.practice(), b = G.practice();
  assert.deepEqual(a, b);
  assert.equal(a.n, 3);
  const run = G.newRun(a, { ms: 40 });
  const T = 1000 / 60;
  const shown = [];
  for (let i = 0; i < a.n; i++) {
    const plan = G.plan(a, run, T);
    shown.push(plan.frames);
    G.record(a, run, { correct: false, plan });
  }
  assert.deepEqual(shown, [120, 72, 42]);
  assert.equal(G.summary(a, run).threshold_ms, null);
});

test('glimpse: every level asks for the thing around the middle; level 1 keeps it close', () => {
  for (const lv of [1, 2, 3, 4, 5]) assert.ok(G.levels[lv].periph, 'L' + lv);
  assert.deepEqual(G.levels[1].rings, [1]);
  assert.deepEqual(G.levels[2].rings, [2], 'level 2 is the practice task, as fixed blocks use it');
});

test('glimpse: things in the way come in small steps, and each level opens three steps above its target', () => {
  const ds = [1, 2, 3, 4, 5].map((lv) => G.levels[lv].distract);
  assert.deepEqual(ds, [0, 0, 0, 8, 16]);
  for (let lv = 2; lv <= 5; lv++) assert.ok(ds[lv - 1] - ds[lv - 2] <= 8, 'L' + lv + ' adds at most 8');
  const T = 1000 / 60;
  for (let lv = 1; lv <= 5; lv++) {
    const p = G.generate(lv, 40 + lv);
    const run = G.newRun(p, { at: G.levelStart(lv) });
    assert.ok(run.fresh, 'a level start is a fresh staircase');
    assert.ok(Math.abs(run.ms - p.advanceMs / Math.pow(0.9, 3)) < 1e-6);
    const first = G.plan(p, run, T).ms;
    assert.ok(first >= 1300 && first <= 1650, 'L' + lv + ' opens slow: ' + Math.round(first) + ' ms');
    // three right answers in a row reach the target; two do not
    let ok2 = null;
    for (let i = 0; i < 3; i++) { G.record(p, run, { correct: true, plan: G.plan(p, run, T) }); if (i === 1) ok2 = G.success(p, G.summary(p, run)); }
    assert.ok(!ok2, 'L' + lv + ': two right are not yet enough');
    assert.ok(G.success(p, G.summary(p, run)), 'L' + lv + ': three right reach ' + p.advanceMs + ' ms');
  }
});

test('glimpse: a run can have its own slowest look (free play: 3 s); without one nothing changes', () => {
  const T = 1000 / 60;
  const p = G.generate(1, 77);
  const run = G.newRun(p, { at: 3000, top: 3000 });
  assert.equal(run.top, 3000);
  assert.ok(Math.abs(G.plan(p, run, T).ms - 3000) < T, 'the first look shows for 3 s');
  G.record(p, run, { correct: true, plan: G.plan(p, run, T) });
  assert.ok(Math.abs(G.plan(p, run, T).ms - 2700) < T, 'a right answer makes the next look a step quicker');
  G.record(p, run, { correct: false, plan: G.plan(p, run, T) });
  assert.ok(G.plan(p, run, T).ms <= 3000 + 1e-6, 'a miss slows it, never past the top');
  // carried over: two steps slower, never past the top
  const c = G.newRun(p, { ms: 2900, top: 3000 });
  assert.ok(c.ms <= 3000 + 1e-6 && !c.fresh);
  // the same calls without a top: the ladder still starts at 2 s, as before
  const r2 = G.newRun(p, { at: 3000 });
  assert.equal(r2.top, undefined);
  assert.ok(G.plan(p, r2, T).ms <= 2000 + 1e-6);
  assert.deepEqual(glLadder(T, G.minMs), glLadder(T, G.minMs, 0));
  const lt = glLadder(T, 0, 3000);
  assert.equal(lt[0], 180, '3 s is 180 frames at 60 Hz');
  assert.equal(lt[lt.length - 1], 1);
});

test('glimpse: a round counts once a right answer brings the flash to the target, as the counter shows it', () => {
  const T = 1000 / 60;
  const play = (lv, answers, start) => {
    const p = G.generate(lv, 31);
    const run = G.newRun(p, start || { at: G.levelStart(lv) });
    for (const ok of answers) G.record(p, run, { correct: !!ok, plan: G.plan(p, run, T) });
    return { p, sm: G.summary(p, run) };
  };
  // a first round with every answer right moves on, slow as its start is
  let r = play(1, [1, 1, 1, 1]);
  assert.ok(r.sm.threshold_ms > r.p.advanceMs, 'the average of the round is still slow');
  assert.ok(G.success(r.p, r.sm), 'but the flash got to ' + r.sm.reach_ms + ' ms');
  // a slip after the target was reached does not take it back
  r = play(1, [1, 1, 1, 0]);
  assert.ok(G.success(r.p, r.sm));
  // a slip before it was reached sends the flash back up
  r = play(1, [1, 0, 1, 1]);
  assert.ok(!G.success(r.p, r.sm), 'reached only ' + r.sm.reach_ms + ' ms');
  // no right answer, nothing reached
  r = play(2, [0, 0, 0, 0]);
  assert.equal(r.sm.reach_ms, null);
  assert.ok(!G.success(r.p, r.sm));
  // practice never counts toward a level
  const pr = G.practice(), run = G.newRun(pr, null);
  for (let i = 0; i < pr.n; i++) G.record(pr, run, { correct: true, plan: G.plan(pr, run, T) });
  assert.ok(!G.success(pr, G.summary(pr, run)));
});

test('switchback: a fresh drive that catches its first three targets reaches the level 1 sign time', () => {
  const B = E.games.switchback;
  const p = B.generate(1, 12);
  const run = B.newRun(p, null);
  let caught = 0;
  for (let k = 0; k < p.signs.length; k++) {
    const go = p.signs[k].go;
    B.record(p, run, { responded: go && caught < 3, rt: 500, planned: run.ms });
    if (go) caught++;
  }
  const sm = B.summary(p, run);
  assert.ok(sm.reach_ms <= p.advanceMs, 'reached ' + sm.reach_ms + ' ms');
  assert.ok(sm.threshold_ms > p.advanceMs, 'though the average over the drive is slower');
});

test('glimpse: runs survive serialize/restore', () => {
  const p = G.generate(4, 3);
  const run = G.newRun(p, { ms: 120 });
  for (let i = 0; i < 4; i++) G.record(p, run, { correct: i % 2 === 0, plan: G.plan(p, run, 1000 / 60) });
  const back = G.restore(p, JSON.parse(JSON.stringify(G.serialize(run))));
  assert.deepEqual(back, run);
  assert.deepEqual(G.plan(p, back, 1000 / 60), G.plan(p, run, 1000 / 60));
});

test('glimpse: every level is a photo trip with its own animals and one thing to find', () => {
  const trip = { 1: 'meadow', 2: 'pond', 3: 'forest', 4: 'jungle', 5: 'night' };
  const seen = new Set();
  for (const lv of [1, 2, 3, 4, 5]) {
    const L = G.levels[lv];
    for (let s = 0; s < 12; s++) {
      const m = G.generate(lv, 300 + s);
      assert.equal(m.theme, trip[lv], 'each level has its own trip, so moving up is arriving somewhere new');
      const th = G.themes[m.theme];
      assert.deepEqual(m.pair, th.pair);
      assert.equal(m.distractor, th.distractor);
      assert.ok(m.trials.every((t) => t.tg === th.target), 'the same thing to find all trip');
      assert.equal(m.target, th.target);
      assert.equal(m.n, L.looks);
      assert.ok(th.target !== th.distractor && !th.pair.includes(th.target), 'the thing to find is never what is in its way, nor a middle animal');
    }
    seen.add(G.themes[trip[lv]].target);
  }
  assert.equal(seen.size, 5, 'a new thing to find on every trip');
});

test('conduit: no pipe starts pointing off the board, and every board needs a bounded number of turns', () => {
  const { rotCW } = E.internals;
  for (const lv of [1, 2, 3, 4, 5]) {
    for (let s = 0; s < 10; s++) {
      const p = C.generate(lv, 1200 + s);
      for (let i = 0; i < p.sol.length; i++) {
        const x = i % p.w, y = (i / p.w) | 0, m = rotCW(p.sol[i], p.start[i]);
        assert.ok(!((m & 1) && y === 0) && !((m & 4) && y === p.h - 1) && !((m & 8) && x === 0) && !((m & 2) && x === p.w - 1), 'tile ' + i + ' points off the board');
      }
      const n = p.w * p.h;
      const [lo, hi] = C.turnRange(n);
      assert.ok(p.reference >= lo && p.reference <= hi, 'L' + lv + ' turns ' + p.reference + ' of ' + n + ' tiles');
      assert.equal(p.reference, C.dist(p, p.start));
    }
  }
});

test('tumbler: per-pin codes stay at four pins or fewer', () => {
  for (const lv of [1, 2, 3, 4, 5]) assert.ok(T.levels[lv].pin.P <= 4);
});

test('conduit: every pipe is needed, so watering every plant without a leak solves the board', () => {
  // a board from play: the source could send water straight down to a plant,
  // leaving two elbows in the corner dry while all seven plants bloomed
  const sol = [4, 6, 14, 8, 5, 1, 7, 8, 7, 14, 11, 12, 1, 1, 2, 9];
  assert.equal(cdSolve(4, 4, sol, 2).solutions, 1, 'one way to connect every pipe');
  assert.equal(cdSolve(4, 4, sol, 2, 10).bypass, 1, 'but the plants can be watered around two pipes');
  const pr = C.practice();
  assert.equal(cdSolve(pr.w, pr.h, pr.sol, 2, pr.src).bypass, 0, 'practice board');
  for (const lv of [1, 2, 3, 4, 5]) {
    for (let s = 0; s < 40; s++) {
      const p = C.generate(lv, 1500 + s);
      const r = cdSolve(p.w, p.h, p.sol, 6, p.src);
      assert.equal(r.bypass, 0, 'L' + lv + ' seed ' + (1500 + s));
      assert.equal(r.solutions, p.alts ? p.alts.length : 1);
    }
  }
});

test('friction: at every level the four games take about the same number of taps', () => {
  // the fewest taps that finish a card: Outbound and Conduit from their solvers,
  // Tumbler along the most informative tries (right-spot pins carry over with
  // per-pin clues), Glimpse one tap to start and one per answer
  const band = { 1: [4, 9], 2: [6, 11], 3: [8, 13], 4: [10, 15], 5: [12, 17] };
  const tumblerTaps = (p) => {
    const sp = tbSpace(p.P, p.C);
    let taps = 0, keep = new Array(p.P).fill(false);
    for (const g of E.internals.tbSolverPath(sp, p.secret, p.clue)) {
      taps += keep.filter((k) => !k).length + 1;
      if (p.clue === 'pin') keep = E.internals.tbMarks(sp, E.internals.tbPin(sp, g, p.secret)).map((m) => m === 2);
    }
    return taps;
  };
  const games = {
    outbound: (lv, s) => O.generate(lv, s).reference,
    conduit: (lv, s) => C.generate(lv, s).reference,
    tumbler: (lv, s) => tumblerTaps(T.generate(lv, s, 'pin')),
    'tumbler (count clues)': (lv, s) => tumblerTaps(T.generate(lv, s, 'count')),
    glimpse: (lv, s) => { const p = G.generate(lv, s); return 1 + p.n * (p.periph ? 2 : 1); },
    // one tap lifts a piece, one sets it down
    stacks: (lv, s) => 2 * E.games.stacks.generate(lv, s).reference,
    // one tap to start, one per target sign and one per animal on the road; steering is not a tap
    switchback: (lv, s) => { const p = E.games.switchback.generate(lv, s); return 1 + p.signs.filter((x) => x.go).length + p.beasts.length; },
    // one tap to look, then pick up and put down each thing
    keepsake: (lv, s) => 1 + 2 * E.games.keepsake.generate(lv, s).things.length,
  };
  const table = {};
  for (const [name, taps] of Object.entries(games)) {
    let prev = 0;
    for (const lv of [1, 2, 3, 4, 5]) {
      let sum = 0;
      for (let s = 0; s < 24; s++) sum += taps(lv, 6000 + s);
      const m = sum / 24;
      (table[name] = table[name] || []).push(m.toFixed(1));
      assert.ok(m >= band[lv][0] && m <= band[lv][1], name + ' L' + lv + ': ' + m.toFixed(1) + ' taps, ladder ' + band[lv].join('-'));
      assert.ok(m >= prev - 0.25, name + ' gets no shorter from L' + (lv - 1) + ' to L' + lv);
      prev = m;
    }
  }
  console.log('# taps per card by level: ' + JSON.stringify(table));
});

test('stacks: each level needs its number of moves, hints follow a shortest path, labels match distances', () => {
  const K = E.games.stacks;
  for (const lv of [1, 2, 3, 4, 5]) {
    for (let s = 0; s < 30; s++) {
      const p = K.generate(lv, 800 + s);
      assert.equal(p.reference, K.levels[lv].moves);
      assert.equal(K.dist(p, p.start), p.reference);
      assert.ok(K.themes.includes(p.theme));
      const run = K.newRun(p);
      let last = null;
      for (let k = 0; k < p.reference; k++) {
        const hnt = K.hint(p, run);
        assert.equal(hnt.kind, 'target');
        last = K.move(p, run, hnt.a, hnt.b);
        assert.equal(last.cls, 'optimal');
        assert.equal(last.dAfter, last.dBefore - 1);
      }
      assert.ok(last.solved, 'solved along the hints in ' + p.reference + ' moves');
      assert.deepEqual(K.progress(p, run), { done: p.n, total: p.n });
      // a wasted move, then undo puts everything back
      const r2 = K.newRun(p);
      const R = { n: p.n, caps: p.caps, cherry: p.cherry, size: p.size };
      const opts = E.internals.skNext(r2.st, R).filter(([, , ns]) => K.dist(p, ns) >= p.reference);
      if (!opts.length) continue; // every first move helps here
      const w = K.move(p, r2, opts[0][0], opts[0][1]);
      assert.equal(w.cls, 'wasted');
      const u = K.undo(p, r2);
      assert.equal(u.dAfter, p.reference);
      assert.deepEqual(r2.st, p.start);
    }
  }
  assert.equal(E.internals.SK_ALL.length, 36, 'three pieces on posts of 3, 2 and 1 have 36 arrangements');
  // each level is a place of its own, the same in free play and research sessions
  const place = { 1: 'stones', 2: 'station', 3: 'harbor', 4: 'cake', 5: 'icecream' };
  for (const lv of [1, 2, 3, 4, 5]) for (let s = 0; s < 6; s++) assert.equal(K.generate(lv, 50 + s).theme, place[lv], 'each level has its own place');
});

test('stacks: a full post refuses a piece, practice takes two moves, runs survive serialize/restore', () => {
  const K = E.games.stacks;
  const p = K.build(2, 1, [[0], [1, 2], []], [[0, 1, 2], [], []], 'harbor');
  const run = K.newRun(p);
  const r = K.move(p, run, 0, 1);
  assert.equal(r.kind, 'blocked', 'the middle post holds two');
  assert.deepEqual(run.st, [[0], [1, 2], []]);
  assert.equal(K.move(p, run, 2, 0), null, 'nothing to lift from an empty post');
  const pr = K.practice();
  assert.equal(pr.reference, 2);
  assert.equal(pr.theme, 'stones');
  const q = K.generate(4, 9);
  const rq = K.newRun(q);
  const h1 = K.hint(q, rq);
  K.move(q, rq, h1.a, h1.b);
  assert.deepEqual(K.restore(q, JSON.parse(JSON.stringify(K.serialize(rq)))), rq);
});

test('stacks: the cake and the ice cream have rules of their own', () => {
  const K = E.games.stacks;
  // the cake: four layers on three stands; a bigger layer never goes on a smaller one
  const cake = K.generate(4, 1);
  assert.equal(cake.n, 4);
  assert.equal(cake.size, true);
  const cakeRules = { n: 4, caps: [4, 4, 4], cherry: null, size: true };
  const c = K.build(4, 1, [[0, 3], [1], [2]], [[0, 1, 2, 3], [], []], 'cake', cakeRules);
  const rc = K.newRun(c);
  const r2 = K.move(c, rc, 1, 0);
  assert.equal(r2.kind, 'blocked');
  assert.equal(r2.why, 'size');
  assert.notEqual(K.move(c, rc, 0, 1).kind, 'blocked', 'the smallest goes on a bigger one');
  assert.equal(E.internals.skAll(cakeRules).length, 81, 'four sized layers on three stands: 3 to the power 4 arrangements');
  // ice cream: four scoops on three cones that hold four each; nothing goes on the scoop with the cherry
  const ice = K.generate(5, 1);
  assert.deepEqual(ice.caps, [4, 4, 4]);
  assert.equal(ice.n, 4);
  assert.equal(ice.cherry, 2);
  const iceRules = { n: 3, caps: [3, 3, 3], cherry: 2, size: false };
  const q = K.build(5, 1, [[0, 2], [1], []], [[0], [1, 2], []], 'icecream', iceRules);
  const rq = K.newRun(q);
  const r1 = K.move(q, rq, 1, 0);
  assert.equal(r1.kind, 'blocked');
  assert.equal(r1.why, 'cherry');
  assert.deepEqual(rq.st, [[0, 2], [1], []]);
  assert.notEqual(K.move(q, rq, 0, 1).kind, 'blocked', 'the scoop with the cherry can still move');
  for (const st of E.internals.skAll(iceRules)) for (const a of st) { const i = a.indexOf(2); assert.ok(i < 0 || i === a.length - 1, 'the cherry is always on top'); }
});

test('conduit: from level 3 about one board in three has more than one solution, and the one that looks nearest takes more turns', () => {
  const { cdLooks } = E.internals;
  for (const lv of [1, 2, 3, 4, 5]) {
    let multi = 0, forcedM = 0, forcedOne = 0;
    const n = 36;
    for (let s = 0; s < n; s++) {
      const p = C.generate(lv, 2600 + s);
      const share = p.features.forced_by_local_rules / p.features.tiles;
      if (!p.alts) { assert.equal(p.features.solutions, 1); forcedOne += share; continue; }
      multi++; forcedM += share;
      assert.ok(lv >= 3, 'one solution at L' + lv);
      assert.ok(p.alts.length >= 2 && p.alts.length <= 4);
      assert.equal(p.features.solutions, p.alts.length);
      // the first solution takes the fewest turns, at least two fewer than any other
      const lk = p.alts.map((w) => cdLooks(p.per, p.start, w));
      assert.equal(lk[0].turns, p.reference);
      assert.equal(C.dist(p, p.start), p.reference);
      for (const x of lk.slice(1)) assert.ok(x.turns >= p.reference + 2, 'L' + lv + ' seed ' + (2600 + s) + ': another solution is as cheap');
      // and another one looks nearer: fewer quarter turns from place, no more tiles out of place
      const decoy = lk.slice(1).filter((x) => x.look < lk[0].look && x.wrong <= lk[0].wrong);
      assert.ok(decoy.length, 'L' + lv + ' seed ' + (2600 + s) + ': the cheapest solution also looks nearest');
      assert.ok(p.features.decoy_extra_turns >= 2);
      // hints and labels lead to the cheapest
      const run = C.newRun(p), h = C.hint(p, run);
      assert.equal(h.kind, 'target');
      assert.ok(C.needAt(p, run.rot, h.index, p.alts[0]) > 0, 'the hint turns a tile toward the cheapest solution');
      let last;
      for (let i = 0; i < p.sol.length; i++) { const k = C.needAt(p, run.rot, i); for (let t = 0; t < k; t++) last = C.tap(p, run, i); }
      assert.ok(last.solved);
      assert.equal(run.hist.length, p.reference);
      assert.equal(last.way, 1);
      assert.equal(last.detail, 'solution 1 of ' + p.alts.length);
      assert.ok(C.connected(p, run).every((v) => v === 1));
      // the garden also comes out right the other way, and the move says which
      const other = C.newRun(p), d = p.alts.indexOf(decoy[0].way);
      other.rot = d >= 0 ? p.alts[d].slice() : other.rot;
      const j = other.rot.findIndex((r, i) => p.per[i] > 1);
      other.rot[j] = (other.rot[j] + 3) % 4;
      const fin = C.tap(p, other, j);
      assert.ok(fin.solved);
      assert.equal(fin.way, d + 1);
      assert.equal(fin.detail, 'solution ' + (d + 1) + ' of ' + p.alts.length);
      assert.ok(C.connected(p, other).every((v) => v === 1));
    }
    if (lv < 3) assert.equal(multi, 0);
    else {
      assert.ok(multi >= 0.15 * n && multi <= 0.55 * n, 'L' + lv + ' boards with more than one solution: ' + multi + ' of ' + n);
      // and they need no less reasoning: local rules settle no more of them
      assert.ok(forcedM / multi <= forcedOne / (n - multi) + 0.05, 'L' + lv + ' settled ' + (forcedM / multi).toFixed(2) + ' against ' + (forcedOne / (n - multi)).toFixed(2));
    }
  }
});

test('conduit: from level 3 local rules settle less and less of the board', () => {
  let prev = 2;
  for (const lv of [1, 2, 3, 4, 5]) {
    // 40 boards, about a third of them with more than one solution from level 3
    let f = 0;
    for (let s = 0; s < 40; s++) { const p = C.generate(lv, 3100 + s); f += p.features.forced_by_local_rules / p.features.tiles; }
    f /= 40;
    if (lv >= 3) assert.ok(f < prev - 0.04, 'L' + lv + ' settled by local rules ' + f.toFixed(2));
    if (lv === 5) assert.ok(f < 0.5, 'L5 needs reasoning across the board: ' + f.toFixed(2));
    prev = f;
  }
});

test('stacks: every level is longer, and from level 2 the boards are the ones whose way looks wrong', () => {
  const K = E.games.stacks;
  let prevMoves = 0, prevQ = 2;
  for (const lv of [1, 2, 3, 4, 5]) {
    const L = K.levels[lv];
    let q = 0, n = 0;
    for (let s = 0; s < 24; s++) {
      const p = K.generate(lv, 800 + s);
      assert.equal(p.moves, L.moves);
      assert.equal(p.n, L.n || 3);
      if (L.qMax != null) { assert.ok(p.features.sensible_solve <= L.qMax + 1e-9, 'L' + lv + ' q ' + p.features.sensible_solve); q += p.features.sensible_solve; n++; }
    }
    assert.ok(L.moves > prevMoves, 'more moves at L' + lv);
    prevMoves = L.moves;
    if (n) { const m = q / n; assert.ok(m <= prevQ + 0.05, 'L' + lv + ' no easier for a goal-directed player: ' + m.toFixed(2)); prevQ = m; }
  }
});

// one drive, checked against its level: signs, the animal on the road, forks, the new animal
// halfway, night, things to collect and the road
function sbCheck(B, L, p) {
  assert.equal(p.target, B.animals[p.place], 'the place\'s own animal is on the target sign');
  assert.equal(p.signs.filter((x) => x.go).length, L.targets);
  assert.equal(p.signs.length, L.targets + L.foils);
  assert.equal(p.signs[0].go, 1, 'the first sign is a target');
  let run = 1;
  for (let i = 1; i < p.signs.length; i++) { run = p.signs[i].go === p.signs[i - 1].go ? run + 1 : 1; assert.ok(run <= 3, 'never more than three of a kind in a row'); }
  // from halfway (levels 4 and 5) the new animal's sign is the one to tap, and the first animal's no longer
  assert.equal(!!p.turn, !!L.turn);
  if (p.turn) assert.equal(p.turn.to, B.turnTo[p.place]);
  p.signs.forEach((sg, k) => {
    const tg = p.turn && k >= p.turn.k ? p.turn.to : p.target;
    if (sg.go) assert.deepEqual([sg.shape, sg.glyph], ['tri', tg]);
    else assert.ok(!(sg.shape === 'tri' && sg.glyph === tg), 'another sign is never the one to tap');
    if (!sg.go && sg.glyph === p.target) assert.ok(p.turn && k >= p.turn.k, 'the first animal is another sign only after the turn');
  });
  if (L.foil === 'similar') for (const sg of p.signs.filter((x) => !x.go)) assert.ok(B.alike[p.place].map((f) => f[1]).concat([p.target]).includes(sg.glyph), 'a look-alike of ' + p.target + ': ' + sg.glyph);
  // gaps: the level's gap, plus 3 s where the animal steps out, 4.6 s at a fork and 3.2 s at the new animal (never before the third sign)
  assert.equal(p.beasts.length, L.beasts);
  assert.equal(p.forks.length, L.forks);
  assert.equal(p.night, !!(L.night && B.nightPlaces[p.place]), 'signs light up late only at dusk and night');
  const events = p.beasts.map((e) => [e.t, 3]).concat(p.forks.map((e) => [e.t, 4.6]), p.turn ? [[p.turn.t, 3.2]] : []);
  for (const [et] of events) assert.ok(et > p.signs[2].t);
  for (let i = 1; i < p.signs.length; i++) {
    const a = p.signs[i - 1], b = p.signs[i], e = events.find(([et]) => et > a.t && et < b.t);
    if (e) {
      assert.ok(Math.abs(b.t - e[0] - e[1]) < 0.011);
      assert.ok(e[0] - a.t >= L.gap - 0.36 && e[0] - a.t <= L.gap + 0.36);
    } else assert.ok(b.t - a.t >= L.gap - 0.36 && b.t - a.t <= L.gap + 0.36, 'gap ' + (b.t - a.t));
  }
  // a sign is always gone before whatever comes next
  const run2 = B.newRun(p);
  run2.ms = 99999;
  for (let k = 0; k < p.signs.length; k++) {
    const t = p.signs[k].t, ends = t + B.windowMs(p, run2, k) / 1000;
    const next = Math.min(p.signs[k + 1] ? p.signs[k + 1].t : p.duration, ...events.map((e) => e[0]).filter((e) => e > t));
    assert.ok(ends <= next - 0.449, 'sign ' + k + ' clear of what follows');
  }
  // things to collect: in order along the road, on the road
  assert.ok(p.items.length >= 12);
  for (let i = 0; i < p.items.length; i++) {
    assert.ok(Math.abs(p.items[i].x) <= p.half - 0.13 + 1e-9);
    if (i) assert.ok(p.items[i].w > p.items[i - 1].w);
  }
  assert.ok(p.road.length * B.seg >= p.duration * p.maxKmh * B.kmhToUnits, 'road long enough at top speed');
  assert.ok(p.road.slice(0, 50).every((c) => c === 0), 'a straight start');
  assert.ok(p.road.every((c) => Math.abs(c) <= L.road.curve[1] + 1e-9));
  assert.ok(p.duration > p.signs[p.signs.length - 1].t);
}

test('switchback: place, animal, signs, things and road follow the level', () => {
  const B = E.games.switchback;
  const seen = {};
  for (const lv of [1, 2, 3, 4, 5]) {
    const L = B.levels[lv];
    for (let s = 0; s < 40; s++) {
      const p = B.generate(lv, 900 + s);
      assert.deepEqual(p, B.generate(lv, 900 + s), 'same seed, same drive');
      assert.ok(L.places.includes(p.place), 'one of the level\'s places');
      seen[p.place] = (seen[p.place] || 0) + 1;
      sbCheck(B, L, p);
    }
  }
  for (const lv of [1, 2, 3, 4, 5]) for (const pl of B.levels[lv].places) assert.ok(seen[pl] >= 8, pl + ' comes up');
});

test('switchback: Master goes round all ten places, each with its own animals', () => {
  const B = E.games.switchback, L = B.levels[5];
  assert.deepEqual(L.tour.slice(0, 2), L.places, 'Master starts with its own two places');
  assert.deepEqual(L.tour.slice().sort(), Object.keys(B.animals).sort(), 'every place is on the tour, once');
  for (const pl of L.tour) {
    assert.ok(B.turnTo[pl] && B.turnTo[pl] !== B.animals[pl], pl + ' has an animal for halfway');
    for (let s = 0; s < 12; s++) {
      const p = B.generate(5, 4100 + s, pl);
      assert.equal(p.place, pl);
      assert.equal(p.turn.to, B.turnTo[pl]);
      sbCheck(B, L, p);
      // the place does not change when the signs, the animals and the forks come, or the road
      const q = B.generate(5, 4100 + s, 'north');
      assert.deepEqual(p.signs.map((x) => [x.t, x.go]), q.signs.map((x) => [x.t, x.go]));
      assert.deepEqual([p.beasts, p.forks, p.turn.t, p.road], [q.beasts, q.forks, q.turn.t, q.road]);
    }
  }
  // the north: the reindeer is a look-alike of the moose before halfway and the sign to tap after it
  let before = 0, after = 0;
  for (let s = 0; s < 40; s++) {
    const p = B.generate(5, 5200 + s, 'north');
    p.signs.forEach((sg, k) => { if (sg.glyph === 'reindeer') { if (k < p.turn.k) { assert.equal(sg.go, 0); before++; } else { assert.equal(sg.go, 1); after++; } } });
  }
  assert.ok(before > 0 && after > 0);
  // a place that is not on the level's list is set aside for the seed's own pick
  for (let s = 0; s < 10; s++) assert.ok(B.levels[3].places.includes(B.generate(3, 300 + s, 'north').place));
  assert.ok(B.levels[5].places.includes(B.generate(5, 77).place), 'without a place, Master picks one of its own two');
});

test('switchback: the sign time and speed staircases', () => {
  const B = E.games.switchback;
  const p = B.generate(3, 77);
  const run = B.newRun(p);
  assert.equal(run.ms, B.startMs);
  assert.equal(run.kmh, p.kmh);
  const go = (k) => p.signs[k].go;
  // a target caught shortens, a target missed lengthens by four steps
  let k = 0;
  while (!go(k)) k++;
  run.i = k;
  let r = B.record(p, run, { responded: true, rt: 600, planned: 1500 });
  assert.equal(r.cls, 'hit');
  assert.ok(Math.abs(run.ms - 1350) < 1e-6);
  while (!go(run.i)) B.record(p, run, { responded: false, rt: null, planned: 1000 });
  r = B.record(p, run, { responded: false, rt: null, planned: run.ms });
  assert.equal(r.cls, 'miss');
  assert.ok(Math.abs(run.ms - Math.min(B.maxMs, 1350 / Math.pow(0.9, 4))) < 1e-6);
  // another sign: tapping lengthens by two steps, letting it pass changes nothing
  while (go(run.i)) B.record(p, run, { responded: true, rt: 500, planned: 900 });
  const before = run.ms;
  r = B.record(p, run, { responded: false, rt: null, planned: 900 });
  assert.equal(r.cls, 'correct_rejection');
  assert.equal(run.ms, before);
  while (go(run.i)) B.record(p, run, { responded: true, rt: 500, planned: 900 });
  const b2 = run.ms;
  r = B.record(p, run, { responded: true, rt: 400, planned: 900 });
  assert.equal(r.cls, 'false_alarm');
  assert.ok(Math.abs(run.ms - Math.min(B.maxMs, b2 / Math.pow(0.9, 2))) < 1e-6);
  // a sign never stays up into the next one
  for (let i = 0; i < p.signs.length - 1; i++) assert.ok(B.windowMs(p, { ms: 99999 }, i) <= (p.signs[i + 1].t - p.signs[i].t - 0.45) * 1000 + 1);
  // the animal on the road and things along the road
  const rb = B.newRun(p);
  assert.deepEqual(B.beast(p, rb, { shooed: true, rt: 812.4 }), { i: 1, cls: 'shooed', rt: 812 });
  assert.equal(B.beast(p, rb, { shooed: false }).cls, 'braked');
  assert.ok(B.item(p, rb, 0, true));
  assert.ok(!B.item(p, rb, 0, true), 'each thing counts once');
  assert.ok(B.item(p, rb, 1, false));
  assert.deepEqual(B.fork(p, rb, { right: true }), { i: 1, cls: 'right_lane' });
  assert.equal(B.fork(p, rb, { right: false }).cls, 'wrong_lane');
  const sb = B.summary(p, rb);
  assert.deepEqual([sb.animals, sb.shooed, sb.animal_rt_mean_ms, sb.items, sb.collected, sb.forks, sb.right_lanes], [2, 1, 812, 2, 1, 2, 1]);
  // speed: up while on the road, down when off it, within the level's range
  const r2 = B.newRun(p);
  B.speedStep(p, r2, 1);
  assert.equal(r2.kmh, p.kmh + B.speedUp);
  B.speedStep(p, r2, 0.9);
  assert.equal(r2.kmh, p.kmh + B.speedUp);
  B.speedStep(p, r2, 0.5);
  assert.equal(r2.kmh, p.kmh + B.speedUp - B.speedDown);
  for (let i = 0; i < 40; i++) B.speedStep(p, r2, 1);
  assert.equal(r2.kmh, p.maxKmh);
  for (let i = 0; i < 40; i++) B.speedStep(p, r2, 0);
  assert.equal(r2.kmh, p.minKmh);
  // carried over: two sign steps and 6 km/h easier
  const r3 = B.newRun(p, { ms: 800, kmh: 70 });
  assert.ok(Math.abs(r3.ms - 800 / 0.81) < 1e-6);
  assert.equal(r3.kmh, 64);
  assert.deepEqual(B.restore(p, JSON.parse(JSON.stringify(B.serialize(run)))), run);
  // practice: fixed sign times and speed
  const pr = B.practice();
  const rp = B.newRun(pr);
  assert.equal(B.windowMs(pr, rp, 0), 2600);
  B.record(pr, rp, { responded: true, rt: 700, planned: 2600 });
  assert.equal(rp.ms, null);
  assert.equal(B.speedStep(pr, rp, 1), null);
  // practice: on the farm, the cow sign, another sign, the cow sign again (the animal on the road comes at level 2)
  assert.equal(pr.place, 'farm');
  assert.equal(pr.target, 'cow');
  assert.deepEqual(pr.signs.map((x) => x.go), [1, 0, 1]);
  assert.equal(pr.beasts.length, 0);
  for (let k = 0; k < pr.signs.length; k++) {
    const t = pr.signs[k].t, ends = t + B.windowMs(pr, rp, k) / 1000;
    const next = Math.min(pr.signs[k + 1] ? pr.signs[k + 1].t : pr.duration, ...pr.beasts.map((e) => e.t).filter((e) => e > t));
    assert.ok(ends <= next - 0.45, 'practice sign ' + k + ' clear of what follows');
  }
});

test('switchback: success needs both the sign time and the speed of the level', () => {
  const B = E.games.switchback;
  const p = B.generate(2, 5);
  const ok = { reach_ms: p.advanceMs, speed_mean_kmh: p.advanceKmh };
  assert.ok(B.success(p, ok));
  assert.ok(!B.success(p, Object.assign({}, ok, { reach_ms: p.advanceMs + 1 })));
  assert.ok(!B.success(p, Object.assign({}, ok, { speed_mean_kmh: p.advanceKmh - 0.5 })));
  assert.ok(!B.success(B.practice(), ok));
});

test('keepsake: things, stones and look time follow the level; same seed, same park', () => {
  const K = E.games.keepsake;
  for (const lv of [1, 2, 3, 4, 5]) {
    const L = K.levels[lv];
    for (let s = 0; s < 40; s++) {
      const p = K.generate(lv, 300 + s);
      assert.deepEqual(p, K.generate(lv, 300 + s));
      assert.equal(p.out.length, L.stones);
      assert.equal(p.things.length, L.items);
      assert.equal(new Set(p.out).size, p.out.length, 'stones are distinct');
      assert.equal(new Set(p.things.map((t) => t.stone)).size, p.things.length, 'one thing per stone');
      assert.equal(new Set(p.things.map((t) => t.name)).size, p.things.length, 'things are distinct');
      for (const t of p.things) { assert.ok(p.out.includes(t.stone)); assert.ok(K.items.includes(t.name)); }
      assert.deepEqual(p.tray.slice().sort((a, b) => a - b), p.things.map((_, k) => k));
      assert.equal(p.studyMs, L.studyMs);
    }
  }
  let near = Infinity;
  for (let i = 0; i < K.stones.length; i++) for (let j = i + 1; j < K.stones.length; j++) near = Math.min(near, E.internals.ksDist(i, j));
  assert.ok(near >= 20, 'stones stay apart: ' + near.toFixed(1));
});

test('keepsake: one try per thing, a taken stone refuses, feedback moves a wrong thing home', () => {
  const K = E.games.keepsake;
  const p = K.generate(3, 11);
  const empty = p.out.filter((st) => !p.things.some((t) => t.stone === st));
  // without feedback: a wrong thing stays where it was put
  let run = K.newRun();
  let r = K.place(p, run, 0, p.things[0].stone);
  assert.equal(r.cls, 'correct');
  assert.equal(r.dist, 0);
  assert.equal(K.place(p, run, 0, empty[0]), null, 'one try each');
  assert.equal(K.place(p, run, 1, p.things[0].stone).kind, 'blocked');
  r = K.place(p, run, 1, empty[0]);
  assert.equal(r.cls, 'wrong');
  assert.ok(r.dist > 0);
  assert.equal(run.at[1], empty[0]);
  assert.equal(K.place(p, run, 2, empty[0]).kind, 'blocked', 'the wrong stone is taken');
  // with feedback: the wrong thing moves to its own stone, which frees the one it was put on
  run = K.newRun();
  r = K.place(p, run, 1, empty[0], true);
  assert.equal(r.cls, 'wrong');
  assert.equal(run.at[1], p.things[1].stone);
  assert.equal(K.place(p, run, 2, empty[0], true).cls, 'wrong', 'the stone is free again');
  for (let k = 3; k < p.things.length; k++) K.place(p, run, k, p.things[k].stone, true);
  const last = K.place(p, run, 0, p.things[0].stone, true);
  assert.ok(last.done);
  const sm = K.summary(p, run);
  assert.equal(sm.correct, p.things.length - 2);
  assert.equal(sm.placed, p.things.length);
  assert.ok(!K.success(p, sm), 'two wrong is not a success');
  assert.deepEqual(K.restore(p, JSON.parse(JSON.stringify(K.serialize(run)))), run);
  const pr = K.practice();
  assert.equal(pr.things.length, 2);
  assert.equal(pr.out.length, 4);
});

test('the app script parses (a stray quote in a long text breaks the whole page)', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'src', 'app.js'), 'utf8');
  assert.doesNotThrow(() => new Function(src));
});
