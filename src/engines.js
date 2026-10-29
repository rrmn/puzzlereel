/* Puzzle Reel engines: pure, deterministic, DOM-free.
 * Every generator takes (level, seed) and returns the same puzzle for the same pair.
 * Every game exposes the same run interface so one harness can log and score moves. */
(function (root) {
  'use strict';

  // ---------- seeded randomness ----------
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seed) {
    const r = mulberry32(seed);
    r.int = (n) => Math.floor(r() * n);
    r.shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    };
    return r;
  }
  function puzzleSeed(sessionSeed, block, game, level, j) {
    return fnv1a(sessionSeed + '|' + block + '|' + game + '|' + level + '|' + j);
  }

  // =====================================================================
  // OUTBOUND: cars only drive forward. A tapped car leaves the lot if its
  // lane is clear, otherwise it slides until it bumps into something.
  // Forward-only movement makes the state graph acyclic, so we can label
  // every reachable state with its distance to the goal.
  // =====================================================================
  const DIR = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  const DIRS = ['N', 'E', 'S', 'W'];
  const EXIT = -1;

  function obOccupancy(p, st) {
    const occ = new Int16Array(p.w * p.h).fill(-1);
    for (let i = 0; i < p.cars.length; i++) {
      const a = st[i];
      if (a === EXIT) continue;
      const c = p.cars[i];
      const d = DIR[c.dir];
      for (let k = 0; k < c.len; k++) {
        occ[(c.y + (k + a) * d[1]) * p.w + (c.x + (k + a) * d[0])] = i;
      }
    }
    return occ;
  }
  // New advance for car i: EXIT if it leaves, unchanged if it cannot move.
  function obSlide(p, st, occ, i) {
    const c = p.cars[i];
    const a = st[i];
    const d = DIR[c.dir];
    let fx = c.x + (c.len - 1 + a) * d[0];
    let fy = c.y + (c.len - 1 + a) * d[1];
    let steps = 0;
    for (;;) {
      const nx = fx + d[0], ny = fy + d[1];
      if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) return EXIT;
      if (occ[ny * p.w + nx] !== -1) return a + steps;
      fx = nx; fy = ny; steps++;
    }
  }
  function obKey(st, B) {
    let k = 0;
    for (let i = st.length - 1; i >= 0; i--) k = k * B + (st[i] === EXIT ? B - 1 : st[i]);
    return k;
  }
  function obMovable(p, st) {
    const occ = obOccupancy(p, st);
    const out = [];
    for (let i = 0; i < p.cars.length; i++) {
      if (st[i] === EXIT) continue;
      if (obSlide(p, st, occ, i) !== st[i]) out.push(i);
    }
    return out;
  }

  // Full analysis of the reachable state graph.
  // d: fewest taps to clear the lot (Infinity = dead end)
  // p: chance a player tapping movable cars at random clears the lot
  function obAnalyze(p) {
    const n = p.cars.length;
    const B = Math.max(p.w, p.h) + 2;
    const memo = new Map();
    let deadStates = 0;
    function solve(st) {
      const key = obKey(st, B);
      const hit = memo.get(key);
      if (hit) return hit;
      let left = 0;
      for (let i = 0; i < n; i++) if (st[i] !== EXIT) left++;
      let res;
      if (left === 0) {
        res = { d: 0, p: 1, m: 0 };
      } else {
        const occ = obOccupancy(p, st);
        let best = Infinity, ps = 0, m = 0;
        for (let i = 0; i < n; i++) {
          if (st[i] === EXIT) continue;
          const na = obSlide(p, st, occ, i);
          if (na === st[i]) continue;
          m++;
          const ns = st.slice();
          ns[i] = na;
          const r = solve(ns);
          if (r.d + 1 < best) best = r.d + 1;
          ps += r.p;
        }
        res = { d: best, p: m ? ps / m : 0, m };
        if (best === Infinity) deadStates++;
      }
      memo.set(key, res);
      return res;
    }
    const start = new Array(n).fill(0);
    const r0 = solve(start);
    // first-move profile
    const occ = obOccupancy(p, start);
    let firstMoves = 0, safeFirst = 0, optimalFirst = 0;
    for (let i = 0; i < n; i++) {
      const na = obSlide(p, start, occ, i);
      if (na === 0) continue;
      firstMoves++;
      const ns = start.slice(); ns[i] = na;
      const r = memo.get(obKey(ns, B));
      if (r.d !== Infinity) safeFirst++;
      if (r.d === r0.d - 1) optimalFirst++;
    }
    return {
      memo, B,
      optimal: r0.d,
      pRandom: r0.p,
      states: memo.size,
      deadStates,
      firstMoves, safeFirst, optimalFirst,
    };
  }

  function dirOf(v) { return v[0] === 1 ? 'E' : v[0] === -1 ? 'W' : v[1] === 1 ? 'S' : 'N'; }

  // Plants a four-car trap. A sits in a lane that crosses V's lane. If A is
  // driven too early it slides onto that crossing, stops against B, and the
  // cycle A <- B <- Z <- V <- A can no longer be broken. Cars are added in an
  // order that keeps the lot solvable (V, then Z, then B, then A).
  function obPlantTrap(L, rng, occ, cars) {
    const w = L.w, h = L.h;
    const inb = (c) => c[0] >= 0 && c[1] >= 0 && c[0] < w && c[1] < h;
    const isFree = (c) => inb(c) && occ[c[1] * w + c[0]] === -1;
    const add = (a, v, k) => [a[0] + v[0] * k, a[1] + v[1] * k];
    const laneOf = (front, d) => {
      const out = [];
      let c = add(front, d, 1);
      while (inb(c)) { out.push(c); c = add(c, d, 1); }
      return out;
    };
    const clearLane = (front, d, extra) => laneOf(front, d).every((c) => isFree(c) && !(extra && extra.some((e) => e[0] === c[0] && e[1] === c[1])));
    const carCells = (rear, d, len) => { const out = []; for (let k = 0; k < len; k++) out.push(add(rear, d, k)); return out; };
    const len = () => (rng() < L.truck ? 3 : 2);
    for (let attempt = 0; attempt < 80; attempt++) {
      // A
      const d = DIR[DIRS[rng.int(4)]];
      const la = len();
      const aRear = [rng.int(w), rng.int(h)];
      const aCells = carCells(aRear, d, la);
      if (!aCells.every(isFree)) continue;
      const aFront = aCells[la - 1];
      if (!clearLane(aFront, d)) continue;
      const lane = laneOf(aFront, d);
      if (lane.length < 3) continue;
      // B: perpendicular, covering lane[k]; facing n
      const k = 1 + rng.int(lane.length - 1);
      const n = rng() < 0.5 ? [-d[1], d[0]] : [d[1], -d[0]];
      const lb = 2;
      const off = rng.int(lb);
      const bRear = add(lane[k], n, -off);
      const bCells = carCells(bRear, n, lb);
      if (!bCells.every(isFree) || bCells.some((c) => aCells.some((e) => e[0] === c[0] && e[1] === c[1]))) continue;
      const bFront = bCells[lb - 1];
      const bLane = laneOf(bFront, n);
      if (bLane.length < 2) continue;
      if (!clearLane(bFront, n, aCells)) continue;
      // X: a cell A covers only after sliding up to B
      const lo = Math.max(0, k - la);
      const xi = lo + rng.int(k - lo);
      const X = lane[xi];
      // Z: in B's lane, parallel to A, facing back toward X's line
      const t = rng.int(Math.min(2, bLane.length - 1));
      const Q = bLane[t];
      const lz = 2;
      const zDir = [-d[0], -d[1]];
      const zCells = carCells(add(Q, zDir, -(lz - 1)), zDir, lz); // rear first, front = Q
      const taken = aCells.concat(bCells);
      if (!zCells.every((c) => isFree(c) && !taken.some((e) => e[0] === c[0] && e[1] === c[1]))) continue;
      if (!clearLane(Q, zDir, taken)) continue;
      // P: where Z's lane meets X's line
      const P = add(Q, zDir, k - xi);
      // V: on X's line beyond A's lane, covering P, facing A's lane
      const vDir = [-n[0], -n[1]];
      const lv = 2;
      const q = rng.int(lv);
      const vFront = add(P, vDir, q);
      const vCells = carCells(add(vFront, vDir, -(lv - 1)), vDir, lv);
      // front must stay strictly on Z's side of A's lane
      const sideDist = (c) => (c[0] - X[0]) * n[0] + (c[1] - X[1]) * n[1];
      if (sideDist(vFront) < 1) continue;
      const taken2 = taken.concat(zCells);
      if (!vCells.every((c) => isFree(c) && !taken2.some((e) => e[0] === c[0] && e[1] === c[1]))) continue;
      if (!clearLane(vFront, vDir, taken2)) continue;
      // commit in solvable order: A, B, Z, V (V leaves first)
      const commit = (rear, dv, l) => {
        const id = cars.length;
        cars.push({ x: rear[0], y: rear[1], dir: dirOf(dv), len: l });
        for (const c of carCells(rear, dv, l)) occ[c[1] * w + c[0]] = id;
      };
      commit(aRear, d, la);
      commit(bRear, n, lb);
      commit(zCells[0], zDir, lz);
      commit(vCells[0], vDir, lv);
      return true;
    }
    return false;
  }

  // Constructive placement: each new car must have a clear lane to the edge
  // past the cars already placed, so clearing them in reverse order always works.
  function obPlace(L, rng) {
    const w = L.w, h = L.h;
    const occ = new Int16Array(w * h).fill(-1);
    const cars = [];
    let planted = 0;
    for (let g = 0; g < (L.traps || 0); g++) {
      if (cars.length + 4 > L.cars) break;
      if (obPlantTrap(L, rng, occ, cars)) planted++;
    }
    if (L.traps && planted < 1) return null;
    let tries = 0;
    while (cars.length < L.cars && tries < 600) {
      tries++;
      const len = rng() < L.truck ? 3 : 2;
      const dir = DIRS[rng.int(4)];
      const d = DIR[dir];
      const x = rng.int(w), y = rng.int(h);
      const fx = x + (len - 1) * d[0], fy = y + (len - 1) * d[1];
      if (fx < 0 || fy < 0 || fx >= w || fy >= h) continue;
      let ok = true;
      for (let k = 0; k < len && ok; k++) if (occ[(y + k * d[1]) * w + (x + k * d[0])] !== -1) ok = false;
      if (!ok) continue;
      let lx = fx + d[0], ly = fy + d[1];
      while (ok && lx >= 0 && ly >= 0 && lx < w && ly < h) {
        if (occ[ly * w + lx] !== -1) ok = false;
        lx += d[0]; ly += d[1];
      }
      if (!ok) continue;
      const id = cars.length;
      cars.push({ x, y, dir, len });
      for (let k = 0; k < len; k++) occ[(y + k * d[1]) * w + (x + k * d[0])] = id;
    }
    return cars.length === L.cars ? cars : null;
  }

  const Outbound = {
    id: 'outbound',
    name: 'Outbound',
    noun: 'car',
    rule: 'Tap a car to drive it forward. It leaves the lot if the way is clear, or stops when it bumps into something.',
    goal: 'Clear the lot.',
    // band: target range for the chance that random tapping clears the lot
    levels: {
      1: { w: 5, h: 5, cars: 5, truck: 0, traps: 0, band: [0.99, 1], attempts: 40 },
      2: { w: 6, h: 6, cars: 7, truck: 0.1, traps: 0, band: [0.99, 1], attempts: 40 },
      3: { w: 6, h: 6, cars: 8, truck: 0.15, traps: 1, band: [0.2, 0.75], attempts: 120 },
      4: { w: 6, h: 6, cars: 10, truck: 0.2, traps: 2, band: [0.1, 0.4], attempts: 160 },
      5: { w: 7, h: 7, cars: 12, truck: 0.25, traps: 3, band: [0, 0.18], attempts: 200 },
    },
    describe(p) { return p.w + '×' + p.h + ' lot, ' + p.cars.length + ' cars'; },
    generate(level, seed) {
      const L = this.levels[level];
      const rng = makeRng(seed);
      let best = null, bestGap = Infinity;
      for (let attempt = 0; attempt < L.attempts; attempt++) {
        const placed = obPlace(L, rng);
        if (!placed) continue;
        rng.shuffle(placed); // car ids must not reveal the solution order
        const p = { w: L.w, h: L.h, cars: placed };
        const an = obAnalyze(p);
        if (an.optimal === Infinity) continue;
        const lo = L.band[0], hi = L.band[1];
        const gap = an.pRandom < lo ? lo - an.pRandom : an.pRandom > hi ? an.pRandom - hi : 0;
        if (gap < bestGap) { best = { p, an }; bestGap = gap; }
        if (gap === 0) break;
      }
      if (!best) {
        // extremely rare: fall back to a lot without planted traps
        const fallback = Object.assign({}, L, { traps: 0 });
        for (let attempt = 0; !best && attempt < 200; attempt++) {
          const placed = obPlace(fallback, rng);
          if (!placed) continue;
          rng.shuffle(placed);
          const p = { w: L.w, h: L.h, cars: placed };
          const an = obAnalyze(p);
          if (an.optimal !== Infinity) best = { p, an };
        }
        bestGap = Infinity;
      }
      const cars = best.p.cars.map((c, i) => ({
        id: i, label: 'c' + (i + 1), x: c.x, y: c.y, dir: c.dir, len: c.len,
        color: (i * 7 + rng.int(3)) % 10,
      }));
      const an = best.an;
      return {
        game: 'outbound', level, seed,
        w: L.w, h: L.h, cars,
        an,
        reference: an.optimal,
        features: {
          cars: cars.length,
          trucks: cars.filter((c) => c.len === 3).length,
          optimal_moves: an.optimal,
          p_random_solve: round(an.pRandom, 4),
          reachable_states: an.states,
          dead_end_states: an.deadStates,
          first_moves: an.firstMoves,
          safe_first_moves: an.safeFirst,
          in_band: bestGap === 0,
        },
      };
    },
    newRun(p) { return { st: new Array(p.cars.length).fill(0), hist: [] }; },
    dist(p, st) {
      const r = p.an.memo.get(obKey(st, p.an.B));
      return r ? r.d : Infinity;
    },
    remaining(p, run) { return run.st.filter((a) => a !== EXIT).length; },
    movable(p, run) { return obMovable(p, run.st); },
    // Tap car i. Returns a scored action record.
    tap(p, run, i) {
      if (run.st[i] === EXIT) return null;
      const occ = obOccupancy(p, run.st);
      const from = run.st[i];
      const to = obSlide(p, run.st, occ, i);
      const dB = this.dist(p, run.st);
      if (to === from) {
        return { kind: 'blocked', target: p.cars[i].label, index: i, from, to, dBefore: dB, dAfter: dB, cls: 'blocked' };
      }
      run.hist.push([i, from]);
      run.st[i] = to;
      const dA = this.dist(p, run.st);
      let cls;
      if (dB === Infinity) cls = 'in_dead_end';
      else if (dA === Infinity) cls = 'dead_end';
      else if (dA === dB - 1) cls = 'optimal';
      else cls = 'wasted';
      const solved = run.st.every((a) => a === EXIT);
      const stuck = !solved && obMovable(p, run.st).length === 0;
      return { kind: 'move', target: p.cars[i].label, index: i, from, to, exited: to === EXIT, dBefore: dB, dAfter: dA, cls, solved, stuck };
    },
    undo(p, run) {
      const h = run.hist.pop();
      if (!h) return null;
      const i = h[0], back = h[1];
      const was = run.st[i];
      const dB = this.dist(p, run.st);
      run.st[i] = back;
      return { target: p.cars[i].label, index: i, from: was, to: back, dBefore: dB, dAfter: this.dist(p, run.st) };
    },
    restart(p, run) { run.st.fill(0); run.hist = []; },
    hint(p, run) {
      const dB = this.dist(p, run.st);
      if (dB === Infinity) return { kind: 'dead_end' };
      const occ = obOccupancy(p, run.st);
      for (let i = 0; i < p.cars.length; i++) {
        if (run.st[i] === EXIT) continue;
        const na = obSlide(p, run.st, occ, i);
        if (na === run.st[i]) continue;
        const ns = run.st.slice(); ns[i] = na;
        if (this.dist(p, ns) === dB - 1) return { kind: 'target', index: i, target: p.cars[i].label };
      }
      return { kind: 'none' };
    },
    progress(p, run) { return { done: p.cars.length - this.remaining(p, run), total: p.cars.length }; },
    // the car standing in front of car i, or -1 when its lane is clear
    blocker(p, run, i) {
      if (run.st[i] === EXIT) return -1;
      const occ = obOccupancy(p, run.st);
      const c = p.cars[i], a = run.st[i], d = DIR[c.dir];
      let x = c.x + (c.len - 1 + a) * d[0], y = c.y + (c.len - 1 + a) * d[1];
      for (;;) {
        x += d[0]; y += d[1];
        if (x < 0 || y < 0 || x >= p.w || y >= p.h) return -1;
        const o = occ[y * p.w + x];
        if (o !== -1) return o;
      }
    },
    // cars that can never leave from the current state (empty unless in a dead end)
    stuckCars(p, run) {
      const n = p.cars.length, B = p.an.B;
      const canLeave = new Array(n).fill(false);
      const seen = new Set([obKey(run.st, B)]);
      const stack = [run.st.slice()];
      while (stack.length && seen.size < 20000) {
        const st = stack.pop();
        const occ = obOccupancy(p, st);
        for (let i = 0; i < n; i++) {
          if (st[i] === EXIT) { canLeave[i] = true; continue; }
          const na = obSlide(p, st, occ, i);
          if (na === st[i]) continue;
          const ns = st.slice(); ns[i] = na;
          const k = obKey(ns, B);
          if (!seen.has(k)) { seen.add(k); stack.push(ns); }
        }
      }
      const out = [];
      for (let i = 0; i < n; i++) if (run.st[i] !== EXIT && !canLeave[i]) out.push(i);
      return out;
    },
    // three cars in a chain: red frees blue, blue frees yellow
    practice() {
      const raw = [
        { x: 1, y: 1, dir: 'E', len: 2, color: 0 },
        { x: 2, y: 3, dir: 'N', len: 2, color: 1 },
        { x: 0, y: 3, dir: 'E', len: 2, color: 2 },
      ];
      const cars = raw.map((c, i) => Object.assign({ id: i, label: 'c' + (i + 1) }, c));
      const p = { w: 4, h: 4, cars };
      const an = obAnalyze(p);
      return {
        game: 'outbound', level: 0, seed: 0, w: 4, h: 4, cars, an,
        reference: an.optimal,
        features: { cars: 3, trucks: 0, optimal_moves: an.optimal, p_random_solve: round(an.pRandom, 4), reachable_states: an.states, dead_end_states: an.deadStates, practice: true },
      };
    },
    serialize(run) { return { st: run.st.slice(), hist: run.hist.map((h) => h.slice()) }; },
    restore(p, data) { return { st: data.st.slice(), hist: data.hist.map((h) => h.slice()) }; },
  };

  // =====================================================================
  // CONDUIT: every tile is part of one spanning tree. Tiles start rotated.
  // A tap turns a tile a quarter turn clockwise. Puzzles have exactly one
  // solution, so each tile has a known number of taps left.
  // =====================================================================
  const N = 1, E = 2, S = 4, W = 8;
  const SIDES = [N, E, S, W];
  const OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };
  const DXY = { 1: [0, -1], 2: [1, 0], 4: [0, 1], 8: [-1, 0] };
  function rotCW(m, r) {
    r = ((r % 4) + 4) % 4;
    for (let k = 0; k < r; k++) m = ((m << 1) | (m >> 3)) & 15;
    return m;
  }
  function bits(m) { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; }
  function periodOf(m) { return rotCW(m, 1) === m ? 1 : rotCW(m, 2) === m ? 2 : 4; }

  // Random spanning tree grown from the source; no four-way crossings.
  function cdTree(w, h, src, rng) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const masks = new Array(w * h).fill(0);
      const inTree = new Uint8Array(w * h);
      const frontier = [];
      const addFrontier = (c) => {
        const x = c % w, y = (c / w) | 0;
        for (const s of SIDES) {
          const nx = x + DXY[s][0], ny = y + DXY[s][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nc = ny * w + nx;
          if (!inTree[nc]) frontier.push([c, s, nc]);
        }
      };
      inTree[src] = 1;
      addFrontier(src);
      let count = 1;
      while (frontier.length && count < w * h) {
        const idx = rng.int(frontier.length);
        const e = frontier[idx];
        frontier[idx] = frontier[frontier.length - 1];
        frontier.pop();
        const c = e[0], s = e[1], nc = e[2];
        if (inTree[nc]) continue;
        if (bits(masks[c]) >= 3) continue;
        masks[c] |= s;
        masks[nc] |= OPP[s];
        inTree[nc] = 1;
        count++;
        addFrontier(nc);
      }
      if (count === w * h) return masks;
    }
    return null;
  }

  // Constraint solver: counts solutions (up to `limit`) for a set of tiles
  // whose rotations are unknown. Edges must agree, borders stay closed,
  // and the network must be one tree.
  function cdSolve(w, h, tiles, limit) {
    const n = w * h;
    const cand = [];
    for (let i = 0; i < n; i++) {
      const seen = [];
      for (let r = 0; r < 4; r++) {
        const m = rotCW(tiles[i], r);
        if (seen.indexOf(m) < 0) seen.push(m);
      }
      cand.push(seen);
    }
    const dom0 = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const x = i % w, y = (i / w) | 0;
      let d = 0;
      for (let k = 0; k < cand[i].length; k++) {
        const m = cand[i][k];
        if ((m & N) && y === 0) continue;
        if ((m & S) && y === h - 1) continue;
        if ((m & W) && x === 0) continue;
        if ((m & E) && x === w - 1) continue;
        d |= 1 << k;
      }
      dom0[i] = d;
    }
    const sideState = (dom, i, s) => {
      let open = 0, closed = 0;
      const c = cand[i];
      for (let k = 0; k < c.length; k++) {
        if (!(dom[i] & (1 << k))) continue;
        if (c[k] & s) open++; else closed++;
      }
      if (!open && !closed) return -1;
      return open && closed ? 2 : open ? 1 : 0;
    };
    const propagate = (dom, queue) => {
      while (queue.length) {
        const i = queue.pop();
        const x = i % w, y = (i / w) | 0;
        if (!dom[i]) return false;
        for (const s of SIDES) {
          const st = sideState(dom, i, s);
          if (st === -1) return false;
          if (st === 2) continue;
          const nx = x + DXY[s][0], ny = y + DXY[s][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          const os = OPP[s];
          let nd = 0;
          const cj = cand[j];
          for (let k = 0; k < cj.length; k++) {
            if (!(dom[j] & (1 << k))) continue;
            if (((cj[k] & os) ? 1 : 0) === st) nd |= 1 << k;
          }
          if (nd !== dom[j]) {
            if (!nd) return false;
            dom[j] = nd;
            queue.push(j);
          }
        }
      }
      return true;
    };
    const globalOk = (dom) => {
      const parent = new Int32Array(n);
      for (let i = 0; i < n; i++) parent[i] = i;
      const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
      for (let i = 0; i < n; i++) {
        const x = i % w, y = (i / w) | 0;
        if (x < w - 1 && sideState(dom, i, E) === 1) {
          const a = find(i), b = find(i + 1);
          if (a === b) return false;
          parent[a] = b;
        }
        if (y < h - 1 && sideState(dom, i, S) === 1) {
          const a = find(i), b = find(i + w);
          if (a === b) return false;
          parent[a] = b;
        }
      }
      const loose = new Uint8Array(n), size = new Int32Array(n);
      for (let i = 0; i < n; i++) {
        const r = find(i);
        size[r]++;
        if (!loose[r]) for (const s of SIDES) if (sideState(dom, i, s) === 2) { loose[r] = 1; break; }
      }
      for (let i = 0; i < n; i++) if (find(i) === i && !loose[i] && size[i] < n) return false;
      return true;
    };
    let solutions = 0, nodes = 0;
    let first = null;
    const dfs = (dom) => {
      nodes++;
      if (nodes > 200000) return;
      if (!globalOk(dom)) return;
      let bi = -1, bc = 9;
      for (let i = 0; i < n; i++) {
        const c = bits(dom[i]);
        if (c > 1 && c < bc) { bc = c; bi = i; }
      }
      if (bi === -1) {
        solutions++;
        if (!first) first = Array.from(dom, (d, i) => cand[i][Math.log2(d) | 0]);
        return;
      }
      for (let k = 0; k < cand[bi].length && solutions < limit; k++) {
        if (!(dom[bi] & (1 << k))) continue;
        const d2 = dom.slice();
        d2[bi] = 1 << k;
        if (propagate(d2, [bi])) dfs(d2);
      }
    };
    const dom = dom0.slice();
    const all = [];
    for (let i = 0; i < n; i++) all.push(i);
    if (!propagate(dom, all)) return { solutions: 0, nodes: 0, forced: 0 };
    let forced = 0;
    for (let i = 0; i < n; i++) if (bits(dom[i]) === 1) forced++;
    dfs(dom);
    return { solutions, nodes, forced, first, exhausted: nodes > 200000 };
  }

  const Conduit = {
    id: 'conduit',
    name: 'Conduit',
    noun: 'tile',
    rule: 'Tap a tile to turn it a quarter turn. Water flows from the square source along connected pipes.',
    goal: 'Connect every pipe to the source with no open ends.',
    // pick: how many unique boards to compare; the one that needs the most
    // search beyond local edge rules is kept, so higher levels need more reasoning
    levels: {
      1: { w: 4, h: 4, pick: 1, attempts: 80 },
      2: { w: 5, h: 5, pick: 1, attempts: 80 },
      3: { w: 6, h: 6, pick: 1, attempts: 100 },
      4: { w: 6, h: 6, pick: 8, attempts: 160 },
      5: { w: 7, h: 7, pick: 8, attempts: 200 },
    },
    describe(p) { return p.w + '×' + p.h + ' grid'; },
    generate(level, seed) {
      const L = this.levels[level];
      const rng = makeRng(seed);
      const w = L.w, h = L.h;
      const src = ((h / 2) | 0) * w + ((w / 2) | 0);
      let chosen = null, found = 0;
      for (let attempt = 0; attempt < L.attempts && found < L.pick; attempt++) {
        const sol = cdTree(w, h, src, rng);
        if (!sol) continue;
        const res = cdSolve(w, h, sol, 2);
        if (res.solutions !== 1 || res.exhausted) continue;
        found++;
        if (!chosen || res.nodes > chosen.res.nodes || (res.nodes === chosen.res.nodes && res.forced < chosen.res.forced)) {
          chosen = { sol, res };
        }
      }
      if (!chosen) throw new Error('Conduit: no unique puzzle for level ' + level + ' seed ' + seed);
      const sol = chosen.sol;
      const per = sol.map(periodOf);
      const start = sol.map((m, i) => rng.int(4));
      // make sure the board does not start nearly solved
      let need = 0;
      for (let i = 0; i < sol.length; i++) need += (per[i] - (start[i] % per[i])) % per[i];
      const minNeed = Math.ceil(sol.length * 0.9);
      let guard = 0;
      while (need < minNeed && guard < 500) {
        const i = rng.int(sol.length);
        if (per[i] > 1 && start[i] % per[i] === 0) {
          start[i] = 1 + rng.int(per[i] - 1);
          need = 0;
          for (let k = 0; k < sol.length; k++) need += (per[k] - (start[k] % per[k])) % per[k];
        }
        guard++;
      }
      const tally = { end: 0, straight: 0, elbow: 0, tee: 0 };
      for (const m of sol) {
        const b = bits(m);
        if (b === 1) tally.end++;
        else if (b === 3) tally.tee++;
        else if (m === (N | S) || m === (E | W)) tally.straight++;
        else tally.elbow++;
      }
      return {
        game: 'conduit', level, seed,
        w, h, src, sol, per, start,
        reference: need,
        features: {
          tiles: w * h,
          optimal_turns: need,
          forced_by_local_rules: chosen.res.forced,
          search_nodes: chosen.res.nodes,
          ends: tally.end, straights: tally.straight, elbows: tally.elbow, tees: tally.tee,
        },
      };
    },
    newRun(p) { return { rot: p.start.slice(), hist: [] }; },
    needAt(p, rot, i) { const per = p.per[i]; return (per - (rot[i] % per)) % per; },
    dist(p, rot) { let d = 0; for (let i = 0; i < rot.length; i++) d += this.needAt(p, rot, i); return d; },
    maskAt(p, run, i) { return rotCW(p.sol[i], run.rot[i]); },
    connected(p, run) {
      const n = p.w * p.h;
      const on = new Uint8Array(n);
      const stack = [p.src];
      on[p.src] = 1;
      while (stack.length) {
        const i = stack.pop();
        const m = this.maskAt(p, run, i);
        const x = i % p.w, y = (i / p.w) | 0;
        for (const s of SIDES) {
          if (!(m & s)) continue;
          const nx = x + DXY[s][0], ny = y + DXY[s][1];
          if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) continue;
          const j = ny * p.w + nx;
          if (on[j]) continue;
          if (this.maskAt(p, run, j) & OPP[s]) { on[j] = 1; stack.push(j); }
        }
      }
      return on;
    },
    tap(p, run, i) {
      const dB = this.dist(p, run.rot);
      const nB = this.needAt(p, run.rot, i);
      const from = run.rot[i];
      run.rot[i] = (from + 1) % 4;
      run.hist.push(i);
      const dA = this.dist(p, run.rot);
      const cls = p.per[i] === 1 ? 'neutral' : nB > 0 ? 'optimal' : 'wasted';
      const x = i % p.w, y = (i / p.w) | 0;
      return { kind: 'move', target: 'r' + (y + 1) + 'c' + (x + 1), index: i, from, to: run.rot[i], dBefore: dB, dAfter: dA, cls, solved: dA === 0, stuck: false };
    },
    undo(p, run) {
      const i = run.hist.pop();
      if (i === undefined) return null;
      const dB = this.dist(p, run.rot);
      const from = run.rot[i];
      run.rot[i] = (from + 3) % 4;
      const x = i % p.w, y = (i / p.w) | 0;
      return { target: 'r' + (y + 1) + 'c' + (x + 1), index: i, from, to: run.rot[i], dBefore: dB, dAfter: this.dist(p, run.rot) };
    },
    restart(p, run) { run.rot = p.start.slice(); run.hist = []; },
    hint(p, run) {
      const on = this.connected(p, run);
      let fallback = -1;
      for (let i = 0; i < run.rot.length; i++) {
        if (this.needAt(p, run.rot, i) === 0) continue;
        if (fallback < 0) fallback = i;
        const x = i % p.w, y = (i / p.w) | 0;
        for (const s of SIDES) {
          const nx = x + DXY[s][0], ny = y + DXY[s][1];
          if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) continue;
          if (on[ny * p.w + nx]) return { kind: 'target', index: i };
        }
      }
      return fallback >= 0 ? { kind: 'target', index: fallback } : { kind: 'none' };
    },
    // 3x3 garden: five plants, three tiles one turn away from right
    practice() {
      const w = 3, h = 3;
      const sol = [2, 14, 8, 2, 13, 4, 2, 11, 9];
      const start = [0, 0, 0, 3, 0, 3, 0, 0, 3];
      const res = cdSolve(w, h, sol, 2);
      if (res.solutions !== 1) throw new Error('Conduit practice board is not unique');
      const per = sol.map(periodOf);
      let need = 0;
      for (let i = 0; i < sol.length; i++) need += (per[i] - (start[i] % per[i])) % per[i];
      return {
        game: 'conduit', level: 0, seed: 0, w, h, src: 4, sol, per, start,
        reference: need,
        features: { tiles: 9, optimal_turns: need, forced_by_local_rules: res.forced, search_nodes: res.nodes, practice: true },
      };
    },
    progress(p, run) {
      const on = this.connected(p, run);
      let c = 0;
      for (let i = 0; i < on.length; i++) c += on[i];
      return { done: c, total: on.length };
    },
    serialize(run) { return { rot: run.rot.slice(), hist: run.hist.slice() }; },
    restore(p, data) { return { rot: data.rot.slice(), hist: data.hist.slice() }; },
  };

  // =====================================================================
  // TUMBLER: a hidden code of P pins in C colors (repeats allowed).
  // Two clue styles:
  //   pin   - every pin of a try is marked: right spot, elsewhere, or absent
  //           (repeated colors are matched left to right, as in Wordle)
  //   count - only the number of right-spot and right-color pins is shown
  // We track the set of codes still consistent with every clue and score
  // each try by the information it was expected to give.
  // =====================================================================
  const spaceCache = new Map();
  function tbSpace(P, C) {
    const key = P + ':' + C;
    if (spaceCache.has(key)) return spaceCache.get(key);
    const total = Math.pow(C, P);
    const dig = new Uint8Array(total * P);
    const cnt = new Uint8Array(total * C);
    for (let code = 0; code < total; code++) {
      let v = code;
      for (let k = P - 1; k >= 0; k--) {
        const d = v % C;
        v = (v / C) | 0;
        dig[code * P + k] = d;
        cnt[code * C + d]++;
      }
    }
    const all = new Int32Array(total);
    for (let i = 0; i < total; i++) all[i] = i;
    const sp = { P, C, total, dig, cnt, all, rem: new Int8Array(C), firstBest: {}, canon: new Map() };
    spaceCache.set(key, sp);
    return sp;
  }
  // count clue: exact * (P + 1) + right-color-wrong-spot
  function tbCount(sp, a, b) {
    const P = sp.P, C = sp.C, dig = sp.dig, cnt = sp.cnt;
    let ex = 0, com = 0;
    const ao = a * P, bo = b * P;
    for (let k = 0; k < P; k++) if (dig[ao + k] === dig[bo + k]) ex++;
    const ac = a * C, bc = b * C;
    for (let c = 0; c < C; c++) {
      const x = cnt[ac + c], y = cnt[bc + c];
      com += x < y ? x : y;
    }
    return ex * (P + 1) + (com - ex);
  }
  // pin clue for try a against code b: base-3 number of per-pin marks
  // (2 right spot, 1 elsewhere, 0 absent), first pin most significant
  function tbPin(sp, a, b) {
    const P = sp.P, dig = sp.dig, rem = sp.rem;
    rem.fill(0);
    const ao = a * P, bo = b * P;
    for (let k = 0; k < P; k++) if (dig[ao + k] !== dig[bo + k]) rem[dig[bo + k]]++;
    let key = 0;
    for (let k = 0; k < P; k++) {
      const g = dig[ao + k];
      let m = 0;
      if (g === dig[bo + k]) m = 2;
      else if (rem[g] > 0) { m = 1; rem[g]--; }
      key = key * 3 + m;
    }
    return key;
  }
  const tbFn = (mode) => (mode === 'count' ? tbCount : tbPin);
  const tbKeys = (sp, mode) => (mode === 'count' ? (sp.P + 1) * (sp.P + 1) : Math.pow(3, sp.P));
  const tbWin = (sp, mode) => (mode === 'count' ? sp.P * (sp.P + 1) : Math.pow(3, sp.P) - 1);
  function tbMarks(sp, key) {
    const out = new Array(sp.P);
    for (let k = sp.P - 1; k >= 0; k--) { out[k] = key % 3; key = Math.floor(key / 3); }
    return out;
  }
  function tbEntropy(sp, g, S, buf, mode) {
    const f = tbFn(mode);
    buf.fill(0);
    for (let i = 0; i < S.length; i++) buf[f(sp, g, S[i])]++;
    let H = 0;
    const n = S.length;
    for (let k = 0; k < buf.length; k++) {
      if (!buf[k]) continue;
      const q = buf[k] / n;
      H -= q * Math.log2(q);
    }
    return H;
  }
  // One representative code per pattern of repeats (AAAA, AAAB, AABB, AABC, ABCD...).
  // With no clues yet, every code with the same pattern is equally informative.
  function tbPatternReps(sp) {
    const out = [];
    const parts = [];
    const rec = (left, max, acc) => {
      if (left === 0) { if (acc.length <= sp.C) parts.push(acc.slice()); return; }
      for (let k = Math.min(left, max); k >= 1; k--) { acc.push(k); rec(left - k, k, acc); acc.pop(); }
    };
    rec(sp.P, sp.P, []);
    for (const part of parts) {
      const digits = [];
      part.forEach((m, color) => { for (let k = 0; k < m; k++) digits.push(color); });
      out.push(tbEncode(sp, digits));
    }
    return out;
  }
  function tbEncode(sp, digits) {
    let v = 0;
    for (let k = 0; k < sp.P; k++) v = v * sp.C + digits[k];
    return v;
  }
  function tbDecode(sp, code) {
    const out = [];
    for (let k = 0; k < sp.P; k++) out.push(sp.dig[code * sp.P + k]);
    return out;
  }
  // Colors no try has used yet are interchangeable, so only one ordering of
  // them needs checking: a code is kept when its unseen colors first appear
  // in increasing order (e.g. with C..G unseen, CCDE is kept, DDCE is not).
  function tbCanonical(sp, seen) {
    if (sp.canon.has(seen)) return sp.canon.get(seen);
    const unseen = [];
    for (let c = 0; c < sp.C; c++) if (!(seen & (1 << c))) unseen.push(c);
    const out = [];
    for (let code = 0; code < sp.total; code++) {
      let next = 0, used = 0, ok = true;
      for (let k = 0; k < sp.P && ok; k++) {
        const d = sp.dig[code * sp.P + k];
        if (seen & (1 << d)) continue;
        if (used & (1 << d)) continue;
        if (d !== unseen[next]) ok = false;
        else { used |= 1 << d; next++; }
      }
      if (ok) out.push(code);
    }
    const arr = Int32Array.from(out);
    sp.canon.set(seen, arr);
    return arr;
  }
  // colors that clues or revealed pins have singled out
  function tbSeen(sp, codes, revealed) {
    let seen = 0;
    for (const g of codes) for (let k = 0; k < sp.P; k++) seen |= 1 << sp.dig[g * sp.P + k];
    if (revealed) for (const c of revealed) if (c != null) seen |= 1 << c;
    return seen;
  }
  // Most informative try for the current candidate set.
  // Ties go to a code that could still be the answer, then to the lowest code.
  function tbBest(sp, S, seen, mode) {
    mode = mode || 'pin';
    const full = S.length === sp.total;
    if (full && sp.firstBest[mode]) return sp.firstBest[mode];
    const buf = new Int32Array(tbKeys(sp, mode));
    const inS = new Uint8Array(sp.total);
    for (let i = 0; i < S.length; i++) inS[S[i]] = 1;
    const candidates = full ? tbPatternReps(sp) : tbCanonical(sp, seen || 0);
    let best = -1, bestCode = -1, bestIn = false;
    for (let i = 0; i < candidates.length; i++) {
      const g = candidates[i];
      const H = tbEntropy(sp, g, S, buf, mode);
      if (H > best + 1e-12 || (Math.abs(H - best) <= 1e-12 && inS[g] && !bestIn)) {
        best = H; bestCode = g; bestIn = !!inS[g];
      }
    }
    const res = { H: best, code: bestCode };
    if (full) sp.firstBest[mode] = res;
    return res;
  }
  function tbFilter(sp, S, g, fb, mode) {
    const f = tbFn(mode);
    const out = [];
    for (let i = 0; i < S.length; i++) if (f(sp, g, S[i]) === fb) out.push(S[i]);
    return Int32Array.from(out);
  }
  function tbFilterPin(sp, S, k, color) {
    const out = [];
    for (let i = 0; i < S.length; i++) if (sp.dig[S[i] * sp.P + k] === color) out.push(S[i]);
    return Int32Array.from(out);
  }
  // Tries a greedy most-informative-try strategy needs for this code.
  function tbSolverPath(sp, secret, mode) {
    mode = mode || 'pin';
    let S = sp.all;
    const path = [];
    const win = tbWin(sp, mode), f = tbFn(mode);
    for (let step = 0; step < 30; step++) {
      const g = tbBest(sp, S, tbSeen(sp, path), mode).code;
      path.push(g);
      const fb = f(sp, g, secret);
      if (fb === win) break;
      S = tbFilter(sp, S, g, fb, mode);
    }
    return path;
  }

  const Tumbler = {
    id: 'tumbler',
    name: 'Tumbler',
    noun: 'try',
    // pin clues say more per try, so their ladder uses longer codes
    levels: {
      1: { pin: { P: 3, C: 4, max: 6 }, count: { P: 3, C: 4, max: 8 } },
      2: { pin: { P: 4, C: 5, max: 6 }, count: { P: 3, C: 5, max: 9 } },
      3: { pin: { P: 4, C: 6, max: 7 }, count: { P: 4, C: 5, max: 10 } },
      4: { pin: { P: 5, C: 6, max: 7 }, count: { P: 4, C: 6, max: 10 } },
      5: { pin: { P: 5, C: 7, max: 8 }, count: { P: 4, C: 7, max: 12 } },
    },
    letters: 'ABCDEFG',
    describe(p) { return p.P + ' pins, ' + p.C + ' colors, ' + (p.clue === 'count' ? 'count clues' : 'pin clues'); },
    build(level, seed, P, C, max, secret, clue) {
      const sp = tbSpace(P, C);
      const path = tbSolverPath(sp, secret, clue);
      return {
        game: 'tumbler', level, seed, clue,
        P, C, max,
        secret,
        secretDigits: tbDecode(sp, secret),
        reference: path.length,
        features: {
          pins: P, colors: C, max_tries: max, clues: clue,
          possible_codes: sp.total,
          bits: round(Math.log2(sp.total), 3),
          solver_tries: path.length,
          solver_path: path.map((c) => this.toLetters(sp, c)).join(' '),
        },
      };
    },
    generate(level, seed, variant) {
      const clue = variant === 'count' ? 'count' : 'pin';
      const L = this.levels[level][clue];
      const rng = makeRng(seed);
      const sp = tbSpace(L.P, L.C);
      return this.build(level, seed, L.P, L.C, L.max, rng.int(sp.total), clue);
    },
    // two pins, three colors: the first guided try lands both colors in the wrong spots
    practice(variant) {
      const clue = variant === 'count' ? 'count' : 'pin';
      const sp = tbSpace(2, 3);
      return this.build(0, 0, 2, 3, 5, tbEncode(sp, [1, 0]), clue);
    },
    toLetters(sp, code) { return tbDecode(sp, code).map((d) => this.letters[d]).join(''); },
    newRun(p) { return { tries: [], S: tbSpace(p.P, p.C).all, revealed: new Array(p.P).fill(null) }; },
    candidates(p, run) { return run.S.length; },
    // Scores a try against the hidden code. Feedback is immediate; the
    // comparison with the most informative possible try is filled in by
    // annotate(), which is slower and can run after the board updates.
    guess(p, run, digits) {
      const sp = tbSpace(p.P, p.C);
      const mode = p.clue;
      const g = tbEncode(sp, digits);
      const S = run.S;
      const before = S.length;
      let consistent = false;
      for (let i = 0; i < S.length; i++) if (S[i] === g) { consistent = true; break; }
      const Hg = tbEntropy(sp, g, S, new Int32Array(tbKeys(sp, mode)), mode);
      const fb = tbFn(mode)(sp, g, p.secret);
      const marks = tbMarks(sp, tbPin(sp, g, p.secret));
      const exact = marks.filter((m) => m === 2).length;
      const partial = marks.filter((m) => m === 1).length;
      const S2 = tbFilter(sp, S, g, fb, mode);
      const seenBefore = tbSeen(sp, run.tries.map((t) => tbEncode(sp, t.digits)), run.revealed);
      run.S = S2;
      run.tries.push({ digits: digits.slice(), exact, partial, marks });
      const solved = exact === p.P;
      const failed = !solved && run.tries.length >= p.max;
      return {
        kind: 'move',
        target: this.toLetters(sp, g),
        exact, partial, marks: mode === 'pin' ? marks : null,
        candsBefore: before, candsAfter: S2.length,
        consistent,
        infoExpected: Hg, infoBest: null, infoActual: Math.log2(before / S2.length),
        bestTry: null,
        dBefore: before, dAfter: S2.length,
        cls: solved ? 'solved' : null, solved, failed, stuck: false,
        _S: S, _seen: seenBefore,
      };
    },
    annotate(p, rec) {
      if (!rec._S) return rec;
      const sp = tbSpace(p.P, p.C);
      const best = tbBest(sp, rec._S, rec._seen, p.clue);
      rec.infoBest = best.H;
      rec.bestTry = this.toLetters(sp, best.code);
      if (!rec.solved) {
        if (rec.infoExpected <= 1e-9) rec.cls = 'zero_info';
        else if (rec.infoExpected >= best.H - 1e-9) rec.cls = 'optimal';
        else rec.cls = 'suboptimal';
      }
      delete rec._S;
      delete rec._seen;
      return rec;
    },
    // Hint: reveal the leftmost pin the clues have not pinned down yet.
    hint(p, run) {
      const sp = tbSpace(p.P, p.C);
      let k = -1;
      for (let i = 0; i < p.P && k < 0; i++) {
        if (run.revealed[i] != null) continue;
        let first = -1, varies = false;
        for (let j = 0; j < run.S.length && !varies; j++) {
          const d = sp.dig[run.S[j] * p.P + i];
          if (first < 0) first = d; else if (d !== first) varies = true;
        }
        if (varies) k = i;
      }
      if (k < 0) return { kind: 'none' };
      const color = p.secretDigits[k];
      const before = run.S.length;
      run.revealed[k] = color;
      run.S = tbFilterPin(sp, run.S, k, color);
      return { kind: 'reveal', pos: k, color, target: 'pin' + (k + 1) + '=' + this.letters[color], candsBefore: before, candsAfter: run.S.length };
    },
    progress(p, run) { return { done: run.tries.length, total: p.max }; },
    serialize(run) {
      return { tries: run.tries.map((t) => ({ digits: t.digits.slice(), exact: t.exact, partial: t.partial, marks: t.marks.slice() })), revealed: run.revealed.slice() };
    },
    restore(p, data) {
      const sp = tbSpace(p.P, p.C);
      let S = sp.all;
      const tries = data.tries.map((t) => {
        const g = tbEncode(sp, t.digits);
        const marks = t.marks || tbMarks(sp, tbPin(sp, g, p.secret));
        S = tbFilter(sp, S, g, tbFn(p.clue)(sp, g, p.secret), p.clue);
        return { digits: t.digits.slice(), exact: t.exact, partial: t.partial, marks: marks.slice() };
      });
      const revealed = data.revealed ? data.revealed.slice() : new Array(p.P).fill(null);
      revealed.forEach((c, k) => { if (c != null) S = tbFilterPin(sp, S, k, c); });
      return { tries, S, revealed };
    },
  };

  // =====================================================================
  // GLIMPSE: speed of processing in the useful-field-of-view format.
  // An animal in the middle (one of two) and, from level 2, a bird around it
  // flash for a few screen frames, then a mask covers them. The player picks
  // the animal, then taps where the bird was. Display time adapts every look
  // with a weighted up/down staircase that settles at 75% correct.
  // The generator fixes what is shown; display times depend on the answers.
  // =====================================================================
  const GL_RING_R = [0.34, 0.62, 0.88];   // ring radius as a share of the field radius
  const GL_RING_N = [8, 16, 24];          // 48 positions: the bird plus up to 47 leaves
  const GL_SLOTS = [];
  GL_RING_R.forEach((r, i) => {
    for (let k = 0; k < GL_RING_N[i]; k++) GL_SLOTS.push({ ring: i + 1, a: (360 * k) / GL_RING_N[i], r });
  });
  // direction 0 = up, then clockwise in 45 degree steps
  function glSlotOf(ring, dir) {
    let base = 0;
    for (let i = 0; i < ring - 1; i++) base += GL_RING_N[i];
    return base + (dir * GL_RING_N[ring - 1]) / 8;
  }
  // Display times from 500 ms down in steps of x0.85, as whole frames of the
  // measured frame period T; repeats are dropped, the last step is one frame.
  function glLadder(T) {
    const out = [];
    for (let ms = 500; ; ms *= 0.85) {
      const f = Math.max(1, Math.round(ms / T));
      if (!out.length || f < out[out.length - 1]) out.push(f);
      if (f === 1) return out;
    }
  }
  function glNearest(lad, T, ms) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < lad.length; i++) {
      const d = Math.abs(Math.log((lad[i] * T) / ms));
      if (d < bd - 1e-9) { bd = d; best = i; }
    }
    return best;
  }
  function glMedian(xs) {
    if (!xs.length) return null;
    const a = xs.slice().sort((x, y) => x - y), m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  const Glimpse = {
    id: 'glimpse',
    name: 'Glimpse',
    noun: 'look',
    kind: 'trials',
    levelDown: false,      // the display time already adapts; levels only add load
    trials: 10,
    startMs: 500,
    maskMs: 500,
    fixMs: [500, 900],
    up: 3, down: 1,        // weighted up/down: p(correct) settles at up / (up + down) = 0.75
    fastDown: 3,           // a fresh staircase drops 3 steps per correct look until the first miss
    pairs: { easy: ['rabbit', 'cat'], hard: ['cat', 'fox'] },
    // advanceMs: a round at or under this display time counts as a success (two in a row: next level)
    levels: {
      1: { periph: false, rings: [], distract: 0, pair: 'easy', advanceMs: 60 },
      2: { periph: true, rings: [2], distract: 0, pair: 'easy', advanceMs: 90 },
      3: { periph: true, rings: [1, 2, 3], distract: 0, pair: 'easy', advanceMs: 120 },
      4: { periph: true, rings: [1, 2, 3], distract: 23, pair: 'easy', advanceMs: 180 },
      5: { periph: true, rings: [1, 2, 3], distract: 47, pair: 'hard', advanceMs: 240 },
    },
    slots: GL_SLOTS,
    ringR: GL_RING_R,
    slotOf: glSlotOf,
    ladder: glLadder,
    describe(p) {
      const pair = Array.isArray(p.pair) ? p.pair : this.pairs[p.pair];
      const rings = p.rings.length === 1 ? 'ring ' + p.rings[0] : 'rings ' + p.rings[0] + '-' + p.rings[p.rings.length - 1];
      return (p.periph ? 'center + bird on ' + rings : 'center only') + (p.distract ? ', ' + p.distract + ' leaves' : '') + ', ' + pair.join('/');
    },
    build(level, seed, L, trials, fixedMs) {
      const pair = this.pairs[L.pair];
      return {
        game: 'glimpse', level, seed,
        n: trials.length, periph: L.periph, rings: L.rings.slice(), distract: L.distract, pair: pair.slice(),
        trials, maskMs: this.maskMs, fixedMs: fixedMs || null, advanceMs: L.advanceMs || null,
        reference: null,
        features: {
          looks: trials.length, periphery: L.periph ? 1 : 0, rings: L.rings.join(' '), leaves: L.distract,
          pair: pair.join('/'), mask_ms: this.maskMs, target_correct: this.up / (this.up + this.down),
          advance_ms: L.advanceMs || null,
        },
      };
    },
    generate(level, seed) {
      const L = this.levels[level];
      const rng = makeRng(seed);
      const n = this.trials;
      const centers = rng.shuffle(Array.from({ length: n }, (_, i) => i % 2));
      let dirs = [], rings = [];
      if (L.periph) {
        // every direction at least once per round, rings in equal shares
        while (dirs.length < n) dirs = dirs.concat(rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]));
        dirs = rng.shuffle(dirs.slice(0, n));
        rings = rng.shuffle(Array.from({ length: n }, (_, i) => L.rings[i % L.rings.length]));
      }
      const trials = [];
      for (let i = 0; i < n; i++) {
        const t = { c: centers[i], fix: this.fixMs[0] + rng.int(this.fixMs[1] - this.fixMs[0]), mask: (rng() * 4294967296) >>> 0 };
        if (L.periph) {
          t.ring = rings[i];
          t.dir = dirs[i];
          t.flip = rng() < 0.5 ? 1 : 0;
          const tgt = glSlotOf(t.ring, t.dir);
          const free = [];
          for (let k = 0; k < GL_SLOTS.length; k++) if (k !== tgt) free.push(k);
          rng.shuffle(free);
          t.d = free.slice(0, L.distract).sort((a, b) => a - b).map((k) => [k, rng.int(360)]);
        }
        trials.push(t);
      }
      return this.build(level, seed, L, trials);
    },
    // four looks with long, fixed display times: the bird sits on the middle ring
    practice() {
      const L = { periph: true, rings: [2], distract: 0, pair: 'easy' };
      const spec = [[0, 1], [1, 5], [0, 6], [1, 3]];
      const trials = spec.map((x, i) => ({ c: x[0], fix: 650, mask: 1000 + i, ring: 2, dir: x[1], flip: x[1] >= 4 ? 1 : 0, d: [] }));
      return this.build(0, 0, L, trials, [1000, 700, 450, 300]);
    },
    // start: { ms } carries a staircase on; without it the staircase starts fresh at 500 ms
    newRun(p, start) {
      const carried = start && start.ms > 0;
      const ms = p.fixedMs ? null : carried ? Math.min(this.startMs, start.ms) : this.startMs;
      return { i: 0, ms, start: ms, fresh: !p.fixedMs && !carried, fast: !p.fixedMs && !carried, last: 0, rev: [], res: [] };
    },
    // the display time for the next look, given the frame period T in ms
    plan(p, run, T) {
      T = T > 0 ? T : 1000 / 60;
      if (p.fixedMs) {
        const want = p.fixedMs[Math.min(run.i, p.fixedMs.length - 1)];
        const f = Math.max(1, Math.round(want / T));
        return { idx: -1, frames: f, ms: f * T, T };
      }
      const lad = glLadder(T);
      const idx = glNearest(lad, T, run.ms);
      return { idx, frames: lad[idx], ms: lad[idx] * T, T, steps: lad.length };
    },
    // r: { correct, plan, drop }
    record(p, run, r) {
      const out = { i: run.i + 1, ok: r.correct ? 1 : 0, ms: round(r.plan.ms, 2), f: r.plan.frames, T: round(r.plan.T, 3), drop: r.drop ? 1 : 0, rev: 0, next: null };
      if (!p.fixedMs) {
        const lad = glLadder(r.plan.T);
        const dir = r.correct ? 1 : -1;
        let idx = r.plan.idx;
        if (r.correct) idx += run.fast ? this.fastDown : this.down;
        else { idx -= this.up; run.fast = false; }
        idx = Math.max(0, Math.min(lad.length - 1, idx));
        if (run.last && dir !== run.last) { out.rev = 1; run.rev.push(out.ms); }
        run.last = dir;
        run.ms = lad[idx] * r.plan.T;
        out.next = round(run.ms, 2);
      }
      run.res.push(out);
      run.i++;
      return out;
    },
    summary(p, run) {
      const res = run.res, n = res.length;
      const k = res.filter((x) => x.ok).length;
      // operating point: geometric mean display time once a fresh staircase has stopped its quick descent
      let from = 0;
      if (run.fresh) { const e = res.findIndex((x) => !x.ok); from = e < 0 ? 0 : e; }
      const tail = res.slice(from);
      const gm = tail.length ? Math.exp(tail.reduce((a, x) => a + Math.log(x.ms), 0) / tail.length) : null;
      const hits = res.filter((x) => x.ok).map((x) => x.ms);
      return {
        n, correct: k, accuracy: n ? k / n : null,
        threshold_ms: p.fixedMs || gm == null ? null : round(gm, 2),
        best_ms: hits.length ? Math.min.apply(null, hits) : null,
        start_ms: run.start == null ? null : round(run.start, 2),
        end_ms: p.fixedMs || run.ms == null ? null : round(run.ms, 2),
        reversals: run.rev.length,
        refresh_ms: glMedian(res.map((x) => x.T)),
        drops: res.filter((x) => x.drop).length,
      };
    },
    progress(p, run) { return { done: run.i, total: p.n }; },
    serialize(run) { return JSON.parse(JSON.stringify(run)); },
    restore(p, data) { return JSON.parse(JSON.stringify(data)); },
  };

  function round(x, k) { const f = Math.pow(10, k); return Math.round(x * f) / f; }

  const Engines = {
    version: '1.2.0',
    fnv1a, makeRng, puzzleSeed,
    games: { outbound: Outbound, conduit: Conduit, tumbler: Tumbler, glimpse: Glimpse },
    order: ['outbound', 'conduit', 'tumbler', 'glimpse'],
    EXIT,
    internals: { obAnalyze, obOccupancy, obSlide, cdSolve, rotCW, tbSpace, tbCount, tbPin, tbMarks, tbBest, tbEntropy, tbEncode, tbDecode, tbSolverPath, tbCanonical, tbSeen, periodOf, glLadder, glNearest, glSlotOf },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engines;
  else root.Engines = Engines;
})(typeof window !== 'undefined' ? window : globalThis);
