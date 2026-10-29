// Run: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engines.js');
const { obAnalyze, obOccupancy, obSlide, cdSolve, tbSpace, tbFeedback, tbBest, tbEntropy, tbEncode, tbSeen } = E.internals;
const O = E.games.outbound, C = E.games.conduit, T = E.games.tumbler;

const strip = (p) => JSON.stringify(p, (k, v) => (k === 'an' ? undefined : v));

test('generators are deterministic for a given level and seed', () => {
  for (const g of E.order) {
    for (const lv of [1, 3, 5]) {
      const a = E.games[g].generate(lv, 12345);
      const b = E.games[g].generate(lv, 12345);
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

test('outbound: levels 3-5 contain traps and get harder', () => {
  const avg = {};
  for (const lv of [1, 2, 3, 4, 5]) {
    let sum = 0, trapped = 0;
    for (let s = 0; s < 20; s++) {
      const p = O.generate(lv, 2000 + s);
      sum += p.an.pRandom;
      if (p.an.deadStates > 0) trapped++;
    }
    avg[lv] = sum / 20;
    if (lv >= 3) assert.ok(trapped >= 18, 'L' + lv + ' trapped ' + trapped);
  }
  assert.ok(avg[1] > avg[3] && avg[3] > avg[4] && avg[4] > avg[5], JSON.stringify(avg));
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

function naiveFeedback(a, b) {
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

test('tumbler: feedback matches a naive implementation', () => {
  const sp = tbSpace(4, 6);
  const rng = E.makeRng(7);
  for (let k = 0; k < 2000; k++) {
    const a = rng.int(sp.total), b = rng.int(sp.total);
    const fb = tbFeedback(sp, a, b);
    const [ex, pa] = naiveFeedback(T.toLetters(sp, a), T.toLetters(sp, b));
    assert.equal(Math.floor(fb / 5), ex);
    assert.equal(fb % 5, pa);
  }
});

test('tumbler: symmetry pruning finds the same best information as a full search', () => {
  const rng = E.makeRng(11);
  for (const lv of [3, 4, 5]) {
    const L = T.levels[lv];
    const sp = tbSpace(L.P, L.C);
    for (let trial = 0; trial < 8; trial++) {
      const p = T.generate(lv, 60 + trial);
      const run = T.newRun(p);
      for (let step = 0; step < 3; step++) {
        const digits = Array.from({ length: L.P }, () => rng.int(Math.min(L.C, 2 + step * 2)));
        const r = T.guess(p, run, digits);
        if (r.solved) break;
        const seen = tbSeen(sp, run.tries.map((t) => tbEncode(sp, t.digits)));
        const fast = tbBest(sp, run.S, seen).H;
        let slow = -1;
        const buf = new Int32Array((L.P + 1) * (L.P + 1));
        for (let g = 0; g < sp.total; g++) slow = Math.max(slow, tbEntropy(sp, g, run.S, buf));
        assert.ok(Math.abs(fast - slow) < 1e-9, 'L' + lv + ' step ' + step + ': ' + fast + ' vs ' + slow);
      }
    }
  }
});

test('tumbler: solver path cracks the code, annotate labels tries', () => {
  for (const lv of [1, 2, 3, 4, 5]) {
    for (let s = 0; s < 6; s++) {
      const p = T.generate(lv, 80 + s);
      const parts = p.features.solver_path.split(' ');
      assert.equal(parts[parts.length - 1], p.secretDigits.map((d) => T.letters[d]).join(''));
      assert.equal(parts.length, p.reference);
      // replay the solver's tries: each must be labelled optimal (or solved)
      const run = T.newRun(p);
      for (const word of parts) {
        const r = T.annotate(p, T.guess(p, run, word.split('').map((ch) => T.letters.indexOf(ch))));
        assert.ok(r.cls === 'optimal' || r.cls === 'solved', r.cls);
        assert.ok(r.consistent || r.cls !== 'solved');
      }
      assert.ok(run.tries[run.tries.length - 1].exact === p.P);
    }
  }
  // repeating a try gives no information
  const p = T.generate(3, 1);
  const run = T.newRun(p);
  const g = p.secretDigits.map((d) => (d + 1) % p.C);
  T.annotate(p, T.guess(p, run, g));
  const again = T.annotate(p, T.guess(p, run, g));
  assert.equal(again.cls, 'zero_info');
  assert.equal(again.consistent, false);
});

test('serialize/restore round-trips runs for every game', () => {
  const p1 = O.generate(4, 5); const r1 = O.newRun(p1);
  O.tap(p1, r1, O.movable(p1, r1)[0]);
  assert.deepEqual(O.restore(p1, JSON.parse(JSON.stringify(O.serialize(r1)))), r1);
  const p2 = C.generate(3, 5); const r2 = C.newRun(p2);
  C.tap(p2, r2, 3); C.tap(p2, r2, 7);
  assert.deepEqual(C.restore(p2, JSON.parse(JSON.stringify(C.serialize(r2)))), r2);
  const p3 = T.generate(4, 5); const r3 = T.newRun(p3);
  T.guess(p3, r3, [0, 0, 1, 1]); T.guess(p3, r3, [2, 3, 4, 5]);
  const back = T.restore(p3, JSON.parse(JSON.stringify(T.serialize(r3))));
  assert.deepEqual(Array.from(back.S), Array.from(r3.S));
});

test('generation is fast enough to run ahead of play', () => {
  const budget = { outbound: 2500, conduit: 400, tumbler: 600 };
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
