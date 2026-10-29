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

test('outbound: levels 3-5 need slides, levels 4-5 have dead ends, and they get harder', () => {
  const avg = {};
  for (const lv of [1, 2, 3, 4, 5]) {
    let sum = 0, trapped = 0;
    for (let s = 0; s < 20; s++) {
      const p = O.generate(lv, 2000 + s);
      sum += p.an.pRandom;
      if (p.an.deadStates > 0) trapped++;
      // levels 1-2 clear by tapping only cars with a clear way out; each pinwheel adds a needed slide
      assert.equal(p.an.minSlides, O.levels[lv].loops, 'L' + lv + ' slides');
    }
    avg[lv] = sum / 20;
    if (lv >= 4) assert.ok(trapped >= 18, 'L' + lv + ' trapped ' + trapped);
  }
  assert.ok(avg[1] >= avg[3] && avg[3] > avg[4] && avg[4] > avg[5], JSON.stringify(avg));
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

test('conduit: unique solution, scrambled start, labels match distance', () => {
  for (const lv of [1, 2, 3, 4, 5]) {
    for (let s = 0; s < 10; s++) {
      const p = C.generate(lv, 300 + s);
      const res = cdSolve(p.w, p.h, p.sol, 2);
      assert.equal(res.solutions, 1, 'unique L' + lv);
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
  const budget = { outbound: 2500, conduit: 400, tumbler: 600, glimpse: 50, stacks: 50 };
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

test('glimpse: the frame ladder runs from about 500 ms to one frame at any refresh rate', () => {
  for (const hz of [30, 50, 60, 90, 120, 144]) {
    const T = 1000 / hz;
    const lad = glLadder(T);
    assert.equal(lad[lad.length - 1], 1);
    assert.ok(Math.abs(lad[0] * T - 500) <= T / 2 + 1e-9, hz + ' Hz starts at 500 ms');
    for (let i = 1; i < lad.length; i++) assert.ok(lad[i] < lad[i - 1], 'strictly shorter');
  }
  assert.deepEqual(glLadder(1000 / 60), [30, 27, 24, 22, 20, 18, 16, 14, 13, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
});

test('glimpse: a fresh staircase starts at 300 ms, one step shorter after a hit, six longer after a miss, never under 50 ms', () => {
  const p = G.generate(2, 77);
  const run = G.newRun(p, null);
  const T = 1000 / 60;
  const steps = [];
  for (const ok of [1, 1, 0, 1, 1, 0]) {
    const plan = G.plan(p, run, T);
    steps.push(plan.idx);
    G.record(p, run, { correct: !!ok, plan });
  }
  assert.deepEqual(steps, [5, 6, 7, 1, 2, 3]);
  const sm = G.summary(p, run);
  assert.equal(sm.correct, 4);
  assert.equal(sm.reversals, 3);
  assert.equal(Math.round(run.ms), 500, 'six steps up after the last miss, capped at the top');
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
  assert.deepEqual(shown, [60, 36, 21]);
  assert.equal(G.summary(a, run).threshold_ms, null);
});

test('glimpse: runs survive serialize/restore', () => {
  const p = G.generate(4, 3);
  const run = G.newRun(p, { ms: 120 });
  for (let i = 0; i < 4; i++) G.record(p, run, { correct: i % 2 === 0, plan: G.plan(p, run, 1000 / 60) });
  const back = G.restore(p, JSON.parse(JSON.stringify(G.serialize(run))));
  assert.deepEqual(back, run);
  assert.deepEqual(G.plan(p, back, 1000 / 60), G.plan(p, run, 1000 / 60));
});

test('glimpse: fixed blocks use the classic set; others get a seeded scene and take turns with its targets', () => {
  for (const lv of [2, 3, 4, 5]) {
    const L = G.levels[lv];
    for (let s = 0; s < 12; s++) {
      const c = G.generate(lv, 300 + s, 'classic');
      assert.equal(c.n, G.trials, 'fixed blocks always have the full round');
      assert.equal(c.theme, 'meadow');
      assert.ok(c.trials.every((t) => t.tg === 'bird'));
      assert.deepEqual(c.pair, G.themes.meadow.pairs[L.pair]);
      const m = G.generate(lv, 300 + s, 'mix');
      assert.ok(G.themeOrder.includes(m.theme));
      const th = G.themes[m.theme];
      assert.deepEqual(m.pair, th.pairs[L.pair]);
      assert.equal(m.distractor, th.distractor);
      const shares = th.targets.map((tg) => m.trials.filter((t) => t.tg === tg).length);
      assert.ok(Math.max(...shares) - Math.min(...shares) <= 1, 'targets take turns: ' + shares.join(' '));
      assert.equal(m.n, L.looks);
      assert.ok(!th.targets.includes(th.distractor), 'a target is never the distractor');
    }
  }
  const seen = new Set();
  for (let s = 0; s < 30; s++) seen.add(G.generate(3, 50 + s, 'mix').theme);
  assert.equal(seen.size, G.themeOrder.length, 'every scene comes up');
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
      const r = cdSolve(p.w, p.h, p.sol, 2, p.src);
      assert.equal(r.bypass, 0, 'L' + lv + ' seed ' + (1500 + s));
      assert.equal(r.solutions, 1);
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
    glimpse: (lv, s) => { const p = G.generate(lv, s, 'mix'); return 1 + p.n * (p.periph ? 2 : 1); },
    // one tap lifts a piece, one sets it down
    stacks: (lv, s) => 2 * E.games.stacks.generate(lv, s).reference,
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
      assert.deepEqual(K.progress(p, run), { done: 3, total: 3 });
      // a wasted move, then undo puts everything back
      const r2 = K.newRun(p);
      const opts = E.internals.skNext(r2.st).filter(([, , ns]) => K.dist(p, ns) >= p.reference);
      if (!opts.length) continue; // every first move helps here
      const w = K.move(p, r2, opts[0][0], opts[0][1]);
      assert.equal(w.cls, 'wasted');
      const u = K.undo(p, r2);
      assert.equal(u.dAfter, p.reference);
      assert.deepEqual(r2.st, p.start);
    }
  }
  assert.equal(E.internals.SK_ALL.length, 36, 'three pieces on posts of 3, 2 and 1 have 36 arrangements');
  for (let s = 0; s < 20; s++) assert.equal(K.generate(3, 50 + s, 'classic').theme, 'stones', 'fixed blocks keep one setting');
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
