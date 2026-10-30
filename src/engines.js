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
        res = { d: 0, p: 1, m: 0, s: 0 };
      } else {
        const occ = obOccupancy(p, st);
        let best = Infinity, ps = 0, m = 0, sl = Infinity;
        for (let i = 0; i < n; i++) {
          if (st[i] === EXIT) continue;
          const na = obSlide(p, st, occ, i);
          if (na === st[i]) continue;
          m++;
          const ns = st.slice();
          ns[i] = na;
          const r = solve(ns);
          if (r.d + 1 < best) best = r.d + 1;
          const rs = r.s + (na === EXIT ? 0 : 1);
          if (rs < sl) sl = rs;
          ps += r.p;
        }
        res = { d: best, p: m ? ps / m : 0, m, s: sl };
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
      minSlides: r0.s,     // 0: tapping only cars with a clear way out always works
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

  // Plants a pinwheel: four cars that each block the next (X <- Y <- Z <- W <- X),
  // so none of them can leave until one slides part of the way. In the base
  // layout X (east) and Z (west) have room to slide past the car they block;
  // W and Y do not. g: columns between X's front and Y; q: rows between W and X.
  // Any of 8 rotations and mirror images, at a random place where it fits.
  function obPlantLoop(L, rng, occ, cars) {
    const w = L.w, h = L.h;
    for (let attempt = 0; attempt < 400; attempt++) {
      const g = 3 + (rng() < 0.3 ? 1 : 0), q = 1 + (rng() < 0.35 ? 1 : 0);
      // cars as [rear..front] cells and a direction, in base coordinates
      const base = [
        { cells: [[0, 1 + q], [1, 1 + q]], d: [1, 0] },              // X, east
        { cells: [[g + 1, 2 + q], [g + 1, 1 + q]], d: [0, -1] },     // Y, north
        { cells: [[g + 2, 1], [g + 1, 1]], d: [-1, 0] },             // Z, west
        { cells: [[1, 0], [1, 1]], d: [0, 1] },                      // W, south
      ];
      const sym = rng.int(8);
      const tf = (v) => { let x = v[0], y = v[1]; for (let k = 0; k < (sym & 3); k++) { const t = x; x = -y; y = t; } return sym & 4 ? [-x, y] : [x, y]; };
      let cs = base.map((c) => ({ cells: c.cells.map(tf), d: tf(c.d) }));
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const c of cs) for (const [x, y] of c.cells) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
      if (maxX - minX >= w || maxY - minY >= h) continue;
      const ox = rng.int(w - (maxX - minX)) - minX, oy = rng.int(h - (maxY - minY)) - minY;
      cs = cs.map((c) => ({ cells: c.cells.map(([x, y]) => [x + ox, y + oy]), d: c.d }));
      const mine = new Set();
      for (const c of cs) for (const [x, y] of c.cells) mine.add(y * w + x);
      let ok = true;
      for (const id of mine) if (occ[id] !== -1) ok = false;
      // every lane, from each front to the edge, is clear of earlier cars
      for (const c of cs) {
        if (!ok) break;
        let [x, y] = c.cells[c.cells.length - 1];
        for (x += c.d[0], y += c.d[1]; x >= 0 && y >= 0 && x < w && y < h; x += c.d[0], y += c.d[1]) {
          if (occ[y * w + x] !== -1) { ok = false; break; }
        }
      }
      if (!ok) continue;
      for (const c of cs) {
        const id = cars.length;
        const [rx, ry] = c.cells[0];
        cars.push({ x: rx, y: ry, dir: dirOf(c.d), len: c.cells.length });
        for (const [x, y] of c.cells) occ[y * w + x] = id;
      }
      return true;
    }
    return false;
  }

  // Lots that need planning: traps first (cleared last), then pinwheels, then
  // ordinary cars with a clear way out (cleared first). Every pinwheel needs one
  // slide, so the lot cannot be cleared by tapping only cars with a clear way out.
  function obBuild(L, rng) {
    const w = L.w, h = L.h;
    const occ = new Int16Array(w * h).fill(-1);
    const cars = [];
    let planted = 0;
    for (let g = 0; g < (L.traps || 0); g++) {
      if (cars.length + 4 > L.cars) break;
      if (obPlantTrap(L, rng, occ, cars)) planted++;
    }
    if (L.traps && planted < 1) return null;
    for (let g = 0; g < (L.loops || 0); g++) if (!obPlantLoop(L, rng, occ, cars)) return null;
    let tries = 0;
    while (cars.length < L.cars && tries < 900) {
      tries++;
      const len = rng() < L.truck ? 3 : 2;
      const dir = DIRS[rng.int(4)];
      const d = DIR[dir];
      const x = rng.int(w), y = rng.int(h);
      const fx = x + (len - 1) * d[0], fy = y + (len - 1) * d[1];
      if (fx < 0 || fy < 0 || fx >= w || fy >= h) continue;
      let ok = true;
      for (let k = 0; k < len && ok; k++) if (occ[(y + k * d[1]) * w + (x + k * d[0])] !== -1) ok = false;
      for (let lx = fx + d[0], ly = fy + d[1]; ok && lx >= 0 && ly >= 0 && lx < w && ly < h; lx += d[0], ly += d[1]) if (occ[ly * w + lx] !== -1) ok = false;
      if (!ok) continue;
      const id = cars.length;
      cars.push({ x, y, dir, len });
      for (let k = 0; k < len; k++) occ[(y + k * d[1]) * w + (x + k * d[0])] = id;
    }
    return cars.length === L.cars ? cars : null;
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
    // loops: pinwheels, each needing one slide part of the way (so tapping only
    // cars with a clear way out stops working); traps: tempting dead ends;
    // band: target range for the chance that random tapping clears the lot
    levels: {
      1: { w: 5, h: 5, cars: 5, truck: 0, loops: 0, traps: 0, band: [0.99, 1], attempts: 40 },
      2: { w: 6, h: 6, cars: 7, truck: 0.1, loops: 0, traps: 0, band: [0.99, 1], attempts: 40 },
      3: { w: 6, h: 6, cars: 8, truck: 0.1, loops: 1, traps: 0, band: [0, 1], attempts: 40 },
      4: { w: 7, h: 7, cars: 10, truck: 0.15, loops: 1, traps: 1, band: [0.1, 0.55], attempts: 200 },
      5: { w: 7, h: 7, cars: 11, truck: 0.15, loops: 2, traps: 0, band: [0, 0.3], attempts: 200 },
    },
    describe(p) { return p.w + '×' + p.h + ' lot, ' + p.cars.length + ' cars'; },
    generate(level, seed) {
      const L = this.levels[level];
      const rng = makeRng(seed);
      let best = null, bestGap = Infinity;
      for (let attempt = 0; attempt < L.attempts; attempt++) {
        const placed = L.loops ? obBuild(L, rng) : obPlace(L, rng);
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
        const fallback = Object.assign({}, L, { traps: 0, loops: Math.min(1, L.loops || 0) });
        for (let attempt = 0; !best && attempt < 200; attempt++) {
          const placed = fallback.loops ? obBuild(fallback, rng) : obPlace(fallback, rng);
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
          slides_needed: an.minSlides,
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
  // With `dry` set to the source tile, two-arm pipes other than the source may
  // also stay out of the network (dry). Those solutions are counted in
  // `bypass`: every plant watered, no open end, some pipe left out. Counting
  // arms shows no other tile can be left out: the network keeps 2(n-1) minus
  // the arms of the dry tiles, and a connected network needs at least two per
  // tile it keeps, so every dry tile has exactly two arms.
  function cdSolve(w, h, tiles, limit, dry) {
    const n = w * h;
    const canDry = dry != null;
    const cand = [], dryBit = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const seen = [];
      for (let r = 0; r < 4; r++) {
        const m = rotCW(tiles[i], r);
        if (seen.indexOf(m) < 0) seen.push(m);
      }
      if (canDry && i !== dry && bits(tiles[i]) === 2) { dryBit[i] = 1 << seen.length; seen.push(0); }
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
      const loose = new Uint8Array(n), size = new Int32Array(n), wet = new Int32Array(n);
      let mustWet = 0;
      for (let i = 0; i < n; i++) {
        const r = find(i);
        size[r]++;
        if (!(dom[i] & dryBit[i])) { wet[r]++; mustWet++; }
        if (!loose[r]) for (const s of SIDES) if (sideState(dom, i, s) === 2) { loose[r] = 1; break; }
      }
      for (let i = 0; i < n; i++) {
        if (find(i) !== i || loose[i] || size[i] === n) continue;
        if (!canDry) return false;
        if (size[i] === 1 && dom[i] === dryBit[i]) continue; // a pipe left dry
        if (find(dry) === i && wet[i] === mustWet) continue; // the source's network holds every tile that must be wet
        return false;
      }
      return true;
    };
    let solutions = 0, nodes = 0, bypass = 0;
    let first = null;
    const done = () => solutions >= limit || bypass > 0;
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
        let left = 0;
        for (let i = 0; i < n; i++) if (dryBit[i] && dom[i] === dryBit[i]) left++;
        if (left) bypass++;
        else if (!first) first = Array.from(dom, (d, i) => cand[i][Math.log2(d) | 0]);
        return;
      }
      for (let k = 0; k < cand[bi].length && !done(); k++) {
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
    return { solutions, bypass, nodes, forced, first, exhausted: nodes > 200000 };
  }

  const Conduit = {
    id: 'conduit',
    name: 'Conduit',
    noun: 'tile',
    rule: 'Tap a tile to turn it a quarter turn. Water flows from the square source along connected pipes.',
    goal: 'Connect every pipe to the source with no open ends.',
    keepRight: 0.25,     // share of tiles that start in their solved turn
    minTurns: 0.42,      // turns to solve per tile, at least
    maxTurns: 0.5,       // and at most, so taps per board follow the shared ladder (about 6, 8, 10, 12, 14)
    // pick: how many unique boards to compare; the one that needs the most
    // search beyond local edge rules is kept, so higher levels need more reasoning
    levels: {
      1: { w: 3, h: 4, pick: 1, attempts: 160 },
      2: { w: 4, h: 4, pick: 1, attempts: 160 },
      3: { w: 4, h: 5, pick: 1, attempts: 160 },
      4: { w: 5, h: 5, pick: 8, attempts: 240 },
      5: { w: 5, h: 6, pick: 8, attempts: 300 },
    },
    describe(p) { return p.w + '×' + p.h + ' grid'; },
    // turns a board of this many tiles needs: at least two values to aim for
    turnRange(tiles) {
      const lo = Math.ceil(tiles * this.minTurns);
      return [lo, Math.max(lo + 1, Math.floor(tiles * this.maxTurns))];
    },
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
        // every pipe must be needed: no way to water every plant without a
        // leak while some pipe stays dry, so a garden in bloom is a solved board
        const dry = cdSolve(w, h, sol, 2, src);
        if (dry.bypass || dry.exhausted) continue;
        found++;
        if (!chosen || res.nodes > chosen.res.nodes || (res.nodes === chosen.res.nodes && res.forced < chosen.res.forced)) {
          chosen = { sol, res };
        }
      }
      if (!chosen) throw new Error('Conduit: no unique puzzle for level ' + level + ' seed ' + seed);
      const sol = chosen.sol;
      const per = sol.map(periodOf);
      // Starting turns: a pipe never starts pointing off the board, and some
      // inner tiles start right, so the work is in the reasoning, not the tapping.
      const valid = sol.map((m, i) => {
        const x = i % w, y = (i / w) | 0, out = [];
        for (let r = 0; r < 4; r++) {
          const mm = rotCW(m, r);
          if (((mm & N) && y === 0) || ((mm & S) && y === h - 1) || ((mm & W) && x === 0) || ((mm & E) && x === w - 1)) continue;
          out.push(r);
        }
        return out;
      });
      const turnsAt = (i, r) => (per[i] - (r % per[i])) % per[i];
      const needOf = (st) => { let d = 0; for (let k = 0; k < sol.length; k++) d += turnsAt(k, st[k]); return d; };
      const [minNeed, maxNeed] = this.turnRange(sol.length);
      let start, need;
      for (let draw = 0; draw < 20; draw++) {
        start = valid.map((vs) => (rng() < this.keepRight ? 0 : vs[rng.int(vs.length)]));
        need = needOf(start);
        // never close to solved, never a long tapping job: turn single tiles to
        // another allowed position that brings the total toward the range
        // without overshooting it
        for (let guard = 0; (need < minNeed || need > maxNeed) && guard < 2000; guard++) {
          const i = rng.int(sol.length);
          const k = turnsAt(i, start[i]);
          const opts = valid[i].filter((r) => { const t = need - k + turnsAt(i, r); return need < minNeed ? t > need && t <= maxNeed : t < need && t >= minNeed; });
          if (!opts.length) continue;
          start[i] = opts[rng.int(opts.length)];
          need = needOf(start);
        }
        if (need >= minNeed && need <= maxNeed) break;
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
    // pin clues say more per try, so their ladder uses longer codes; both
    // ladders keep taps per code near the shared ladder (about 6, 8, 10, 12, 14)
    levels: {
      1: { pin: { P: 2, C: 4, max: 6 }, count: { P: 2, C: 4, max: 6 } },
      2: { pin: { P: 3, C: 4, max: 6 }, count: { P: 2, C: 5, max: 7 } },
      3: { pin: { P: 3, C: 5, max: 6 }, count: { P: 3, C: 3, max: 7 } },
      4: { pin: { P: 4, C: 5, max: 7 }, count: { P: 3, C: 4, max: 7 } },
      5: { pin: { P: 4, C: 6, max: 7 }, count: { P: 3, C: 5, max: 8 } },
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
  // with a weighted up/down staircase that settles at 80% correct.
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
  // Display times from 2 s down in steps of x0.9, as whole frames of the
  // measured frame period T; repeats are dropped, the last step is one frame.
  const GL_STEP = 0.9, GL_TOP = 2000;
  // floorMs: the shortest display time allowed (the ladder stops at the last step at or above it)
  function glLadder(T, floorMs) {
    const out = [];
    for (let ms = GL_TOP; ; ms *= GL_STEP) {
      const f = Math.max(1, Math.round(ms / T));
      if (floorMs && f * T < floorMs - 1e-6 && out.length) return out;
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
  // Scenes. Each has an easy and a harder pair for the middle, three things to
  // find around it and one distractor. Fixed (measurement) blocks and practice
  // use the classic set: meadow, always the bird.
  const GL_THEMES = {
    meadow: { pairs: { easy: ['rabbit', 'hedgehog'], hard: ['cat', 'fox'] }, targets: ['bird', 'butterfly', 'snail'], distractor: 'leaf' },
    sea: { pairs: { easy: ['fish', 'turtle'], hard: ['fish', 'whale'] }, targets: ['star', 'sailboat', 'jellyfish'], distractor: 'shell' },
    sky: { pairs: { easy: ['plane', 'balloon'], hard: ['plane', 'gull'] }, targets: ['kite', 'rocket', 'star'], distractor: 'cloud' },
  };
  const GL_THEME_ORDER = ['meadow', 'sea', 'sky'];
  const GL_LEVEL_THEME = { 1: 'meadow', 2: 'meadow', 3: 'sea', 4: 'sea', 5: 'sky' };
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
    levelDown: false,      // the display time already adapts; levels only add load (free play steps back after a round with under half right)
    trials: 6,             // looks per round in fixed blocks; other rounds use the level's looks (4 to 6). The staircase carries over between rounds
    startMs: 1500,         // a fresh staircase in a research block starts here: a slow, easy look for anyone (free play starts each level at levelStart)
    maxMs: GL_TOP,         // top of the ladder
    warmUp: 2,             // a carried-over round starts this many steps slower, so it opens with a likely hit
    minMs: 50,             // the flash is never shorter than this: past it, the next level asks more instead
    maskMs: 600,           // the crowd after the flash: what matters for masking is that it comes at once; 0.6 s lets the eye take it in
    fixMs: [400, 700],
    up: 6, down: 1,        // weighted up/down: p(correct) settles at up / (up + down) = 6/7, about 86%
    themes: GL_THEMES,
    themeOrder: GL_THEME_ORDER,
    // advanceMs: a round counts as a success when a right answer brings the flash down to this
    // (two in a row: next level). Human speeds for older players and non-gamers: a one-second look
    // moves you up, and the levels add more to see rather than asking for a faster eye. The flash
    // itself keeps adapting at every level, so quick players still see it get shorter.
    // Every level asks for the animal and the thing around it, as practice does; level 1 keeps
    // that thing close to the middle (until engines 1.17 level 1 was the middle only).
    levels: {
      1: { periph: true, rings: [1], distract: 0, pair: 'easy', advanceMs: 1000, looks: 4 },
      2: { periph: true, rings: [2], distract: 0, pair: 'easy', advanceMs: 1000, looks: 4 },
      3: { periph: true, rings: [1, 2, 3], distract: 0, pair: 'easy', advanceMs: 1000, looks: 5 },
      // things in the way come in small steps: a few shells, then twice as many clouds
      // (until engines 1.18: 23, then 47 and the harder pair, a cliff for older players)
      4: { periph: true, rings: [1, 2, 3], distract: 8, pair: 'easy', advanceMs: 1200, looks: 6 },
      5: { periph: true, rings: [1, 2, 3], distract: 16, pair: 'easy', advanceMs: 1200, looks: 6 },
    },
    // where free play starts a level the first time: three steps slower than its target, so a new
    // level opens slow and easy and three right answers in a row reach the target
    levelStart(level) {
      const L = this.levels[level];
      return L && L.advanceMs ? Math.min(this.maxMs, L.advanceMs / Math.pow(GL_STEP, 3)) : this.startMs;
    },
    slots: GL_SLOTS,
    ringR: GL_RING_R,
    slotOf: glSlotOf,
    ladder: glLadder,
    // p is a puzzle (pair given as names) or a level entry (pair given as 'easy' or 'hard')
    describe(p) {
      const pair = Array.isArray(p.pair) ? p.pair.join('/') : p.pair === 'hard' ? 'harder pair' : 'easy pair';
      const rings = p.rings.length === 1 ? 'ring ' + p.rings[0] : 'rings ' + p.rings[0] + '-' + p.rings[p.rings.length - 1];
      const find = p.targetSet ? p.targetSet.join('/') : 'target';
      const among = p.distract ? ', ' + p.distract + ' ' + (p.distractor === 'leaf' ? 'leaves' : p.distractor ? p.distractor + 's' : 'distractors') : '';
      return (p.theme ? p.theme + ': ' : '') + (p.periph ? 'center + ' + find + ' on ' + rings : 'center only') + among + ', ' + pair;
    },
    build(level, seed, L, trials, fixedMs, themeName, targetSet) {
      const theme = GL_THEMES[themeName];
      const pair = theme.pairs[L.pair];
      return {
        game: 'glimpse', level, seed, theme: themeName,
        n: trials.length, periph: L.periph, rings: L.rings.slice(), distract: L.distract, pair: pair.slice(),
        distractor: theme.distractor, targetSet: targetSet.slice(),
        trials, maskMs: this.maskMs, fixedMs: fixedMs || null, advanceMs: L.advanceMs || null,
        reference: null,
        features: {
          looks: trials.length, theme: themeName, periphery: L.periph ? 1 : 0, rings: L.rings.join(' '), distractors: L.distract,
          pair: pair.join('/'), targets: L.periph ? targetSet.join('/') : '', distractor: L.distract ? theme.distractor : '',
          mask_ms: this.maskMs, target_correct: this.up / (this.up + this.down), advance_ms: L.advanceMs || null,
        },
      };
    },
    // variant 'classic': meadow scene, always the bird (fixed blocks); anything else: the scene
    // of its level (meadow at 1 and 2, the sea at 3 and 4, the sky at 5), targets in turn, so
    // moving up a level is also arriving somewhere new
    generate(level, seed, variant) {
      const L = this.levels[level];
      const rng = makeRng(seed);
      const classic = variant === 'classic';
      const n = classic ? this.trials : L.looks || this.trials;
      rng.int(GL_THEME_ORDER.length); // the draw that used to pick the scene, kept so seeds still give the same looks
      const themeName = classic ? 'meadow' : GL_LEVEL_THEME[level] || 'meadow';
      const targetSet = classic ? ['bird'] : GL_THEMES[themeName].targets;
      const tgs = rng.shuffle(Array.from({ length: n }, (_, i) => targetSet[i % targetSet.length]));
      const centers = rng.shuffle(Array.from({ length: n }, (_, i) => i % 2));
      let dirs = [], rings = [];
      if (L.periph) {
        // directions spread evenly (no repeats within 8 looks), rings in equal shares
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
          t.tg = tgs[i];
          t.flip = rng() < 0.5 ? 1 : 0;
          const tgt = glSlotOf(t.ring, t.dir);
          const free = [];
          for (let k = 0; k < GL_SLOTS.length; k++) if (k !== tgt) free.push(k);
          rng.shuffle(free);
          t.d = free.slice(0, L.distract).sort((a, b) => a - b).map((k) => [k, rng.int(360)]);
        }
        trials.push(t);
      }
      return this.build(level, seed, L, trials, null, themeName, targetSet);
    },
    // three slow looks at fixed display times: the bird sits on the middle ring
    practice() {
      const L = { periph: true, rings: [2], distract: 0, pair: 'easy' };
      const spec = [[0, 1], [1, 5], [0, 6]];
      const trials = spec.map((x, i) => ({ c: x[0], fix: 550, mask: 1000 + i, ring: 2, dir: x[1], tg: 'bird', flip: x[1] >= 4 ? 1 : 0, d: [] }));
      return this.build(0, 0, L, trials, [2000, 1200, 700], 'meadow', ['bird']);
    },
    // start: { ms } carries a staircase on (warmUp steps slower); { at } starts a fresh one exactly
    // there (free play, a level's first round); without either it starts fresh at startMs
    newRun(p, start) {
      const at = !p.fixedMs && start && start.at > 0 ? Math.min(this.maxMs, start.at) : null;
      const carried = !at && start && start.ms > 0;
      const ms = p.fixedMs ? null : at || (carried ? Math.min(this.maxMs, start.ms / Math.pow(GL_STEP, this.warmUp)) : this.startMs);
      return { i: 0, ms, start: ms, fresh: !p.fixedMs && !carried, last: 0, rev: [], res: [] };
    },
    // the display time for the next look, given the frame period T in ms
    plan(p, run, T) {
      T = T > 0 ? T : 1000 / 60;
      if (p.fixedMs) {
        const want = p.fixedMs[Math.min(run.i, p.fixedMs.length - 1)];
        const f = Math.max(1, Math.round(want / T));
        return { idx: -1, frames: f, ms: f * T, T };
      }
      const lad = glLadder(T, this.minMs);
      const idx = glNearest(lad, T, run.ms);
      return { idx, frames: lad[idx], ms: lad[idx] * T, T, steps: lad.length };
    },
    // r: { correct, plan, drop }
    record(p, run, r) {
      const out = { i: run.i + 1, ok: r.correct ? 1 : 0, ms: round(r.plan.ms, 2), f: r.plan.frames, T: round(r.plan.T, 3), drop: r.drop ? 1 : 0, rev: 0, next: null };
      if (!p.fixedMs) {
        const lad = glLadder(r.plan.T, this.minMs);
        const dir = r.correct ? 1 : -1;
        let idx = r.plan.idx;
        if (r.correct) idx += this.down;
        else idx -= this.up;
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
      // operating point: geometric mean display time, leaving out a fresh staircase's descent before its first miss
      let from = 0;
      if (run.fresh) { const e = res.findIndex((x) => !x.ok); from = e < 0 ? 0 : e; }
      const tail = res.slice(from);
      const gm = tail.length ? Math.exp(tail.reduce((a, x) => a + Math.log(x.ms), 0) / tail.length) : null;
      const hits = res.filter((x) => x.ok).map((x) => x.ms);
      // the flash after each right answer, as the counter shows it: the shortest is how far the round got
      const reached = res.filter((x) => x.ok && x.next != null).map((x) => x.next);
      return {
        n, correct: k, accuracy: n ? k / n : null,
        threshold_ms: p.fixedMs || gm == null ? null : round(gm, 2),
        best_ms: hits.length ? Math.min.apply(null, hits) : null,
        reach_ms: reached.length ? Math.min.apply(null, reached) : null,
        start_ms: run.start == null ? null : round(run.start, 2),
        end_ms: p.fixedMs || run.ms == null ? null : round(run.ms, 2),
        reversals: run.rev.length,
        refresh_ms: glMedian(res.map((x) => x.T)),
        drops: res.filter((x) => x.drop).length,
      };
    },
    // a success: some right answer brought the flash to the level's target or under. What the
    // counter showed is what counts, and a good round counts even if a slip comes after.
    // (Until engines 1.17: threshold_ms at or under the target, which a fresh round, slow at
    // the start, could miss with every look right.)
    success(p, s) { return p.advanceMs != null && s.reach_ms != null && s.reach_ms <= p.advanceMs + 0.5; },
    progress(p, run) { return { done: run.i, total: p.n }; },
    serialize(run) { return JSON.parse(JSON.stringify(run)); },
    restore(p, data) { return JSON.parse(JSON.stringify(data)); },
  };

  // =====================================================================
  // STACKS: the tower-of-London task. Three posts hold at most 3, 2 and 1
  // pieces. A move takes the top piece of one post and sets it on a post
  // with room; the goal is the arrangement on the card, in as few moves as
  // possible. The 36 arrangements of three pieces form one connected graph,
  // so a breadth-first search from the goal gives the moves left from each.
  // =====================================================================
  const SK_CAPS = [3, 2, 1];
  const SK_THEMES = ['stones', 'harbor', 'bakery'];
  // research blocks: the classic task in three settings (stones at 1 and 2, the harbor at 3 and 4, the bakery at 5)
  const SK_LEVEL_THEME = { 1: 'stones', 2: 'stones', 3: 'harbor', 4: 'harbor', 5: 'bakery' };
  // free play: every level a place of its own, two with a twist that shows on the pieces.
  // cherry: nothing can go on that piece (the scoop with the cherry); size: a piece goes only on a
  // bigger one (piece 0 the biggest), as cake layers do. Ice cream needs three equal cones: on posts
  // of 3, 2 and 1 the cherry leaves only 12 arrangements, none of them 6 moves apart.
  const SK_FREE = {
    1: { theme: 'stones' },
    2: { theme: 'station' },
    3: { theme: 'harbor' },
    4: { theme: 'icecream', caps: [3, 3, 3], cherry: 2 },
    5: { theme: 'cake', n: 4, caps: [4, 4, 4], size: true },
  };
  const SK_CLASSIC = { n: 3, caps: SK_CAPS, cherry: null, size: false };
  const skRules = (p) => ({ n: p.n || 3, caps: p.caps || SK_CAPS, cherry: p.cherry != null ? p.cherry : null, size: !!p.size });
  const skRuleKey = (R) => R.n + '/' + R.caps.join('') + '/' + (R.cherry == null ? '-' : R.cherry) + (R.size ? 's' : '');
  const skKey = (st) => st.map((a) => a.join('')).join('|');
  const skCopy = (st) => st.map((a) => a.slice());
  // why a piece cannot be set on post b: 'full', 'cherry', 'size', or '' when it can
  function skWhyNot(R, st, b, piece) {
    if (st[b].length >= R.caps[b]) return 'full';
    const top = st[b][st[b].length - 1];
    if (top != null && R.cherry === top) return 'cherry';
    if (top != null && R.size && top > piece) return 'size';
    return '';
  }
  function skNext(st, R) {
    R = R || SK_CLASSIC;
    const out = [];
    for (let a = 0; a < 3; a++) {
      if (!st[a].length) continue;
      const pc = st[a][st[a].length - 1];
      for (let b = 0; b < 3; b++) {
        if (a === b || skWhyNot(R, st, b, pc)) continue;
        const ns = skCopy(st);
        ns[b].push(ns[a].pop());
        out.push([a, b, ns]);
      }
    }
    return out;
  }
  const skDistCache = new Map();
  // moves left to this goal from every arrangement, under these rules
  function skDist(goal, R) {
    R = R || SK_CLASSIC;
    const k0 = skKey(goal), ck = skRuleKey(R) + '#' + k0;
    let d = skDistCache.get(ck);
    if (d) return d;
    d = new Map([[k0, 0]]);
    const q = [goal];
    for (let i = 0; i < q.length; i++) {
      const di = d.get(skKey(q[i]));
      for (const [, , ns] of skNext(q[i], R)) {
        const k = skKey(ns);
        if (!d.has(k)) { d.set(k, di + 1); q.push(ns); }
      }
    }
    skDistCache.set(ck, d);
    return d;
  }
  // every arrangement the rules allow (all reachable from the pieces stacked in order on the first post)
  const skAllCache = new Map();
  function skAll(R) {
    R = R || SK_CLASSIC;
    const rk = skRuleKey(R);
    if (!skAllCache.has(rk)) skAllCache.set(rk, Array.from(skDist([Array.from({ length: R.n }, (_, i) => i), [], []], R).keys(), (k) => k.split('|').map((x) => (x ? x.split('').map(Number) : []))));
    return skAllCache.get(rk);
  }
  const SK_ALL = skAll(SK_CLASSIC);

  const Stacks = {
    id: 'stacks',
    name: 'Stacks',
    noun: 'move',
    rule: 'Tap a post to lift its top piece, then tap another post to set it down. A post holds only as many pieces as it is tall.',
    goal: 'Build the arrangement on the card in as few moves as possible.',
    caps: SK_CAPS,
    themes: SK_THEMES,
    free: SK_FREE,
    // moves: the fewest moves from start to goal
    levels: { 1: { moves: 3 }, 2: { moves: 4 }, 3: { moves: 5 }, 4: { moves: 6 }, 5: { moves: 7 } },
    describe(p) { return p.moves + '-move problem' + (p.theme ? ', ' + p.theme : ''); },
    build(level, seed, start, goal, theme, R) {
      R = R || SK_CLASSIC;
      const moves = skDist(goal, R).get(skKey(start));
      return {
        game: 'stacks', level, seed, theme,
        n: R.n, caps: R.caps.slice(), cherry: R.cherry, size: R.size,
        start: skCopy(start), goal: skCopy(goal), moves,
        reference: moves,
        features: { moves, start: skKey(start), goal: skKey(goal), theme, pieces: R.n, caps: R.caps.join(''), twist: R.cherry != null ? 'cherry' : R.size ? 'size' : '' },
      };
    },
    // variant 'classic' (fixed blocks): always the stones; 'free' (free play): the place and rules
    // of its level (SK_FREE); otherwise (adaptive research blocks) the classic task in the setting
    // of its level (river stones at 1 and 2, the harbor at 3 and 4, the bakery at 5)
    generate(level, seed, variant) {
      const L = this.levels[level];
      const rng = makeRng(seed);
      rng.int(3); // the draw that used to pick the setting, kept so seeds still give the same boards
      const F = variant === 'free' ? SK_FREE[level] : null;
      const theme = variant === 'classic' ? 'stones' : F ? F.theme : SK_LEVEL_THEME[level] || 'stones';
      const R = F ? { n: F.n || 3, caps: F.caps || SK_CAPS, cherry: F.cherry != null ? F.cherry : null, size: !!F.size } : SK_CLASSIC;
      const ALL = skAll(R);
      for (let attempt = 0; attempt < 100; attempt++) {
        const goal = ALL[rng.int(ALL.length)];
        const d = skDist(goal, R);
        const starts = ALL.filter((st) => d.get(skKey(st)) === L.moves);
        if (starts.length) return this.build(level, seed, starts[rng.int(starts.length)], goal, theme, R);
      }
      throw new Error('Stacks: no ' + L.moves + '-move problem for seed ' + seed);
    },
    whyNot(p, st, b, piece) { return skWhyNot(skRules(p), st, b, piece); },
    newRun(p) { return { st: skCopy(p.start), hist: [] }; },
    dist(p, st) { return skDist(p.goal, skRules(p)).get(skKey(st)); },
    // take the top piece of post a and set it on post b (posts 0 to 2; logged 1 to 3)
    move(p, run, a, b) {
      const st = run.st;
      if (a === b || !st[a].length) return null;
      const dB = this.dist(p, st);
      const target = 'p' + (a + 1) + '>p' + (b + 1);
      const piece = st[a][st[a].length - 1];
      const why = skWhyNot(skRules(p), st, b, piece);
      if (why) return { kind: 'blocked', target, piece, a, b, from: a + 1, to: b + 1, dBefore: dB, dAfter: dB, cls: 'blocked', why, detail: why };
      st[b].push(st[a].pop());
      run.hist.push([a, b]);
      const dA = this.dist(p, st);
      return { kind: 'move', target, piece, a, b, from: a + 1, to: b + 1, dBefore: dB, dAfter: dA, cls: dA === dB - 1 ? 'optimal' : 'wasted', solved: dA === 0, stuck: false };
    },
    undo(p, run) {
      const m = run.hist.pop();
      if (!m) return null;
      const dB = this.dist(p, run.st);
      run.st[m[0]].push(run.st[m[1]].pop());
      return { target: 'p' + (m[1] + 1) + '>p' + (m[0] + 1), a: m[1], b: m[0], from: m[1] + 1, to: m[0] + 1, dBefore: dB, dAfter: this.dist(p, run.st) };
    },
    restart(p, run) { run.st = skCopy(p.start); run.hist = []; },
    hint(p, run) {
      const R = skRules(p), d = skDist(p.goal, R), m = d.get(skKey(run.st));
      for (const [a, b, ns] of skNext(run.st, R)) if (d.get(skKey(ns)) === m - 1) return { kind: 'target', a, b, target: 'p' + (a + 1) + '>p' + (b + 1) };
      return { kind: 'none' };
    },
    // pieces in their final place: right post, right height, on a finished base
    progress(p, run) {
      let done = 0;
      for (let k = 0; k < 3; k++) for (let i = 0; i < run.st[k].length && run.st[k][i] === p.goal[k][i]; i++) done++;
      return { done, total: p.n || 3 };
    },
    // two moves: the top piece steps aside, the lone piece goes on top
    practice() { return this.build(0, 0, [[0, 1], [2], []], [[0, 2], [], [1]], 'stones'); },
    serialize(run) { return { st: skCopy(run.st), hist: run.hist.map((m) => m.slice()) }; },
    restore(p, data) { return { st: skCopy(data.st), hist: data.hist.map((m) => m.slice()) }; },
  };

  // =====================================================================
  // SWITCHBACK: the dual-task format of the Focus core (adaptive
  // multitasking training, Anguera et al. 2013). Steer a car along a winding
  // road and tap only when one road sign shows (tap the sign itself, or the
  // button that shows it); let every other sign pass. Both tasks adapt as you
  // play: how long a sign stays up changes after every target and every tap
  // on another sign (weighted up/down, about 80% of targets caught), and the
  // speed changes every 1.5 s of driving (up while the car stays on the road,
  // down when it leaves). Each level has two places, picked by the seed, and
  // each place has its own animal: it is on the target sign, and now and then
  // it steps onto the road, where a tap sends it off (or the car brakes).
  // Things to collect lie along the road. The generator fixes the place, the
  // road, the signs, when the animals step out and where the things lie; sign
  // times and speed depend on play.
  // =====================================================================
  const SB_SEG = 0.4;      // road segment length; the camera rides 1 unit above the road
  const SB_KMH = 0.12;     // world units per second for each km/h shown
  const SB_SLOT = 3.0;     // s from an animal stepping out to the next sign
  // each place's animal: on its target sign and on its road
  const SB_ANIMALS = { farm: 'cow', savanna: 'elephant', fields: 'rabbit', desert: 'camel', forest: 'deer', jungle: 'monkey', coast: 'crab', outback: 'kangaroo', village: 'duck', north: 'moose' };
  // signs that are not the target, from nothing in common (L1) to look-alike animals (L5)
  const SB_FOILS = {
    shape: [['round_blue', 'arrow'], ['square_blue', 'P'], ['round_blue', 'turn']],
    color: [['round_red', '50'], ['round_red', 'car'], ['square_blue', 'P']],
    symbol: [['tri', 'bang'], ['tri', 'curve'], ['tri', 'bumps']],
    animal: [['tri', 'bird'], ['tri', 'snail'], ['tri', 'turtle']],
    village: [['tri', 'goose'], ['tri', 'swan'], ['tri', 'hen']],
    north: [['tri', 'reindeer'], ['tri', 'deer'], ['tri', 'bear']],
  };
  // curvature per segment: a straight start, then bends with eased entry and exit;
  // an S joins two opposite bends
  function sbRoad(R, rng, n) {
    const out = [];
    const flat = (len, c) => { for (let i = 0; i < len; i++) out.push(c); };
    const ease = (a, b, len) => { for (let i = 0; i < len; i++) { const t = (i + 0.5) / len; out.push(a + (b - a) * t * t * (3 - 2 * t)); } };
    const pick = (r) => r[0] + rng() * (r[1] - r[0]);
    const len = (r) => r[0] + rng.int(r[1] - r[0] + 1);
    flat(50, 0);
    let side = rng() < 0.5 ? -1 : 1;
    while (out.length < n) {
      flat(len(R.straight), 0);
      const c = side * pick(R.curve);
      ease(0, c, R.ease);
      flat(len(R.hold), c);
      if (rng() < R.s) {
        const c2 = -side * pick(R.curve);
        ease(c, c2, R.ease * 2);
        flat(len(R.hold), c2);
        ease(c2, 0, R.ease);
        side = -side;
      } else ease(c, 0, R.ease);
      if (rng() < 0.7) side = -side;
    }
    return out.slice(0, n).map((x) => Math.round(x * 1000) / 1000);
  }
  // things to collect, in rows of 3 to 5 along the road, straight or slanting across;
  // w is the distance along the road, x across it (0 is the middle)
  function sbItems(rng, half, w0, w1, every) {
    const out = [], lim = half - 0.13;
    let w = w0;
    while (w < w1) {
      const n = 3 + rng.int(3), xa = (rng() * 2 - 1) * lim, xb = rng() < 0.5 ? xa : (xa > 0 ? -1 : 1) * rng() * lim;
      for (let k = 0; k < n; k++) out.push({ w: round(w + k * 1.5, 2), x: round(xa + ((xb - xa) * k) / (n - 1), 3) });
      w += (n - 1) * 1.5 + every * (0.8 + rng() * 0.4);
    }
    return out;
  }

  const Switchback = {
    id: 'switchback',
    name: 'Switchback',
    noun: 'sign',
    kind: 'trials',
    levelDown: false,       // both tasks already adapt as you drive; levels only add load
    seg: SB_SEG,
    kmhToUnits: SB_KMH,
    animals: SB_ANIMALS,
    startMs: 1500,          // a fresh sign staircase starts here
    minMs: 450, maxMs: 2200,
    step: 0.9,              // one step is x0.9 of the time a sign stays up
    up: 4, down: 1,         // a miss: 4 steps longer, a caught target: 1 step shorter (settles near 80% caught)
    upFoil: 2,              // a tap on another sign: 2 steps longer
    warmUp: 2,              // a carried-over round starts this many steps slower, and 6 km/h slower
    speedEvery: 1.5,        // seconds of driving between speed changes
    speedUp: 3, speedDown: 6, speedRange: [-10, 40],
    warm: 2,                // seconds of driving before the road and speed count (the car gets going)
    // places: the seed picks one; beasts: times the place's animal steps onto the road;
    // half: road half-width; s: share of bends that run into an S
    levels: {
      1: { places: ['farm', 'savanna'], beasts: 1, targets: 5, foils: 3, foil: 'shape', gap: 2.8, kmh: 40, advanceKmh: 48, advanceMs: 1100, road: { half: 0.42, straight: [30, 60], curve: [0.5, 0.8], ease: 26, hold: [20, 45], s: 0 } },
      2: { places: ['fields', 'desert'], beasts: 1, targets: 7, foils: 5, foil: 'color', gap: 2.6, kmh: 46, advanceKmh: 54, advanceMs: 1050, road: { half: 0.4, straight: [22, 48], curve: [0.6, 1.0], ease: 22, hold: [16, 40], s: 0.15 } },
      3: { places: ['forest', 'jungle'], beasts: 2, targets: 9, foils: 7, foil: 'symbol', gap: 2.4, kmh: 52, advanceKmh: 60, advanceMs: 1000, road: { half: 0.38, straight: [14, 38], curve: [0.8, 1.2], ease: 18, hold: [12, 34], s: 0.3 } },
      4: { places: ['coast', 'outback'], beasts: 2, targets: 11, foils: 9, foil: 'animal', gap: 2.2, kmh: 58, advanceKmh: 66, advanceMs: 950, road: { half: 0.36, straight: [10, 28], curve: [0.9, 1.4], ease: 15, hold: [10, 28], s: 0.45 } },
      5: { places: ['village', 'north'], beasts: 2, targets: 13, foils: 11, foil: 'similar', gap: 2.0, kmh: 64, advanceKmh: 72, advanceMs: 900, road: { half: 0.34, straight: [6, 22], curve: [1.0, 1.5], ease: 13, hold: [8, 24], s: 0.6 } },
    },
    // p is a puzzle or a level entry
    describe(p) {
      const n = p.signs ? p.signs.filter((x) => x.go).length : p.targets;
      const f = p.signs ? p.signs.length - n : p.foils;
      const nb = Array.isArray(p.beasts) ? p.beasts.length : p.beasts || 0;
      const where = p.place ? p.place + ', ' + p.target + ' sign, ' : p.places.map((q) => q + ' (' + SB_ANIMALS[q] + ')').join(' or ') + ', ';
      return where + n + ' targets and ' + f + ' other sign' + (f === 1 ? '' : 's') + ' (' + p.foil + '), the animal on the road ' + nb + ' time' + (nb === 1 ? '' : 's') + ', from ' + p.kmh + ' km/h';
    },
    build(level, seed, L, place, signs, beasts, items, road, duration, fixed) {
      const target = SB_ANIMALS[place];
      return {
        game: 'switchback', level, seed, place, target, foil: L.foil,
        signs, beasts, items, road, half: L.road.half, duration,
        kmh: L.kmh, minKmh: L.kmh + this.speedRange[0], maxKmh: L.kmh + this.speedRange[1],
        advanceKmh: L.advanceKmh || null, advanceMs: L.advanceMs || null,
        fixedMs: fixed ? fixed.ms : null, fixedKmh: fixed ? fixed.kmh : null,
        reference: null,
        features: {
          place, target, targets: signs.filter((x) => x.go).length, foils: signs.filter((x) => !x.go).length, foil: L.foil,
          animals: beasts.length, items: items.length,
          gap_s: L.gap, road_half: L.road.half, bends: L.road.curve ? L.road.curve.join('-') : 'practice', s_bends: L.road.s || 0,
          kmh: L.kmh, advance_kmh: L.advanceKmh || null, advance_ms: L.advanceMs || null,
          target_hits: this.up / (this.up + this.down),
        },
      };
    },
    generate(level, seed) {
      const L = this.levels[level];
      const rng = makeRng(seed);
      const place = L.places[rng.int(L.places.length)], target = SB_ANIMALS[place];
      const foils = SB_FOILS[L.foil === 'similar' ? place : L.foil];
      // the first sign is a target; after it, never more than three of a kind in a row
      let order;
      for (let tries = 0; tries < 200; tries++) {
        order = [1].concat(rng.shuffle(Array.from({ length: L.targets - 1 + L.foils }, (_, i) => (i < L.targets - 1 ? 1 : 0))));
        let run = 1, ok = true;
        for (let i = 1; i < order.length && ok; i++) { run = order[i] === order[i - 1] ? run + 1 : 1; if (run > 3) ok = false; }
        if (ok) break;
      }
      const fseq = rng.shuffle(Array.from({ length: L.foils }, (_, i) => foils[i % foils.length]));
      // the animal steps out between two signs, once in each part of the drive,
      // never before the third sign or after the last but one
      const after = new Set(), gaps = order.length - 4;
      for (let b = 0; b < L.beasts; b++) {
        const a = Math.floor((b * gaps) / L.beasts), z = Math.floor(((b + 1) * gaps) / L.beasts);
        after.add(2 + a + rng.int(Math.max(1, z - a)));
      }
      let t = 2.6, fi = 0;
      const signs = [], beasts = [];
      order.forEach((go, k) => {
        const f = go ? ['tri', target] : fseq[fi++];
        signs.push({ t: round(t, 2), go, shape: f[0], glyph: f[1] });
        t += L.gap + (rng() - 0.5) * 0.7;
        if (after.has(k)) { beasts.push({ t: round(t, 2), side: rng() < 0.5 ? -1 : 1 }); t += SB_SLOT; }
      });
      const duration = round(signs[signs.length - 1].t + L.gap + 1.5, 2);
      const vmax = (L.kmh + this.speedRange[1]) * SB_KMH, v = L.kmh * SB_KMH;
      const road = sbRoad(L.road, rng, Math.ceil((duration * vmax) / SB_SEG) + 260);
      const items = sbItems(rng, L.road.half, 3 * v + 4, road.length * SB_SEG - 40, 7 * v);
      return this.build(level, seed, L, place, signs, beasts, items, road, duration, null);
    },
    // a slow drive on the farm at a fixed pace: the cow sign, another sign, a cow on
    // the road, the cow sign again; a few apples on the way
    practice() {
      const L = { beasts: 1, targets: 2, foils: 1, foil: 'shape', gap: 3.6, kmh: 36, advanceKmh: null, advanceMs: null, road: { half: 0.44 } };
      const road = [];
      for (let i = 0; i < 80; i++) road.push(0);
      for (let i = 0; i < 30; i++) { const t = (i + 0.5) / 30; road.push(-0.55 * t * t * (3 - 2 * t)); }
      for (let i = 0; i < 40; i++) road.push(-0.55);
      for (let i = 0; i < 30; i++) { const t = (i + 0.5) / 30; road.push(-0.55 * (1 - t * t * (3 - 2 * t))); }
      while (road.length < 720) road.push(0);
      const signs = [{ t: 3.4, go: 1, shape: 'tri', glyph: 'cow' }, { t: 7.6, go: 0, shape: 'round_blue', glyph: 'arrow' }, { t: 14.6, go: 1, shape: 'tri', glyph: 'cow' }];
      const beasts = [{ t: 10.6, side: 1 }];
      const items = [];
      for (let k = 0; k < 4; k++) items.push({ w: 24 + k * 1.5, x: 0 });
      for (let k = 0; k < 4; k++) items.push({ w: 64 + k * 1.5, x: round(-0.24 * (k / 3), 3) });
      return this.build(0, 0, L, 'farm', signs, beasts, items, road.map((x) => Math.round(x * 1000) / 1000), 18.4, { ms: [2600, 2200, 2400], kmh: 36 });
    },
    // start: { ms, kmh } carries both staircases on from an earlier round
    newRun(p, start) {
      const fixed = !!p.fixedMs;
      const carried = !fixed && start && start.ms > 0;
      const ms = fixed ? null : carried ? Math.min(this.maxMs, start.ms / Math.pow(this.step, this.warmUp)) : this.startMs;
      let kmh = fixed ? p.fixedKmh : carried && start.kmh > 0 ? start.kmh - 6 : p.kmh;
      if (!fixed) kmh = Math.max(p.minKmh, Math.min(p.maxKmh, kmh));
      return {
        i: 0, ms, kmh, start: { ms, kmh }, fresh: !fixed && !carried, last: 0, rev: [], res: [], speed: [], stray: 0,
        bi: 0, ba: [], items: [],
        drive: { t: 0, on: 0, vt: 0, vs: 0, off: 0, brake: 0 },
      };
    },
    // how long sign k stays up: the staircase, but always clear of the next sign or animal
    windowMs(p, run, k) {
      if (p.fixedMs) return p.fixedMs[Math.min(k, p.fixedMs.length - 1)];
      const t = p.signs[k].t;
      let next = p.signs[k + 1] ? p.signs[k + 1].t : p.duration;
      for (const b of p.beasts) if (b.t > t && b.t < next) next = b.t;
      return Math.round(Math.min(run.ms, (next - t - 0.45) * 1000));
    },
    // r: { responded, rt, planned }; one record per sign, in order
    record(p, run, r) {
      const sg = p.signs[run.i];
      const cls = sg.go ? (r.responded ? 'hit' : 'miss') : (r.responded ? 'false_alarm' : 'correct_rejection');
      const out = { i: run.i + 1, go: sg.go, cls, rt: r.responded ? Math.round(r.rt) : null, ms: r.planned, kmh: Math.round(r.kmh || run.kmh), next: null, rev: 0 };
      if (!p.fixedMs && cls !== 'correct_rejection') {
        const dir = cls === 'hit' ? 1 : -1;
        const k = cls === 'hit' ? -this.down : cls === 'miss' ? this.up : this.upFoil;
        run.ms = Math.max(this.minMs, Math.min(this.maxMs, run.ms * Math.pow(this.step, -k)));
        if (run.last && dir !== run.last) { out.rev = 1; run.rev.push(r.planned); }
        run.last = dir;
        out.next = Math.round(run.ms);
      }
      run.res.push(out);
      run.i++;
      return out;
    },
    // the animal on the road: shooed (tapped away; rt from when it stepped out) or braked for
    beast(p, run, r) {
      const out = { i: run.bi + 1, cls: r.shooed ? 'shooed' : 'braked', rt: r.shooed ? Math.round(r.rt) : null };
      run.ba.push(out);
      run.bi++;
      return out;
    },
    // the car went past thing k (in order along the road), with it or without it
    item(p, run, k, got) {
      if (k !== run.items.length) return false;
      run.items.push(got ? 1 : 0);
      return true;
    },
    // f: share of the last speedEvery seconds with the car on the road
    speedStep(p, run, f) {
      if (p.fixedMs) return null;
      const from = run.kmh;
      if (f >= 0.97) run.kmh = Math.min(p.maxKmh, run.kmh + this.speedUp);
      else if (f < 0.85) run.kmh = Math.max(p.minKmh, run.kmh - this.speedDown);
      const out = { from, to: run.kmh, on: round(f, 3) };
      if (run.kmh !== from) run.speed.push(out);
      return out;
    },
    summary(p, run) {
      const res = run.res, n = res.length;
      const count = (c) => res.filter((x) => x.cls === c).length;
      const hits = count('hit'), misses = count('miss'), fas = count('false_alarm'), crs = count('correct_rejection');
      // operating point: geometric mean time up over the targets, leaving out a fresh staircase's descent before its first miss
      const go = res.filter((x) => x.go);
      let from = 0;
      if (run.fresh) { const e = go.findIndex((x) => x.cls === 'miss'); from = e < 0 ? 0 : e; }
      const tail = go.slice(from);
      const gm = tail.length ? Math.exp(tail.reduce((a, x) => a + Math.log(x.ms), 0) / tail.length) : null;
      const rts = res.filter((x) => x.cls === 'hit').map((x) => x.rt);
      const reached = res.filter((x) => x.cls === 'hit' && x.next != null).map((x) => x.next);
      const shoo = run.ba.filter((b) => b.cls === 'shooed').map((b) => b.rt);
      const D = run.drive;
      return {
        n, hits, misses, false_alarms: fas, correct_rejections: crs, stray: run.stray,
        correct: hits + crs, accuracy: n ? (hits + crs) / n : null,
        threshold_ms: p.fixedMs || gm == null ? null : Math.round(gm),
        reach_ms: reached.length ? Math.min.apply(null, reached) : null,
        rt_mean_ms: rts.length ? Math.round(rts.reduce((a, x) => a + x, 0) / rts.length) : null,
        start_ms: run.start.ms == null ? null : Math.round(run.start.ms), end_ms: p.fixedMs ? null : Math.round(run.ms),
        reversals: run.rev.length,
        animals: run.ba.length, shooed: shoo.length, animal_rt_mean_ms: shoo.length ? Math.round(shoo.reduce((a, x) => a + x, 0) / shoo.length) : null,
        items: run.items.length, collected: run.items.filter((x) => x).length,
        on_road: D.t > 0 ? round(D.on / D.t, 4) : null, off_road_episodes: D.off, brake_s: round(D.brake, 2),
        speed_mean_kmh: D.vs > 0 ? round(D.vt / D.vs, 1) : null, speed_start_kmh: run.start.kmh, speed_end_kmh: run.kmh,
      };
    },
    // a caught target brought the sign time to the level's or under (until engines 1.17: threshold_ms),
    // and the drive kept the level's speed on average
    success(p, s) {
      return p.advanceMs != null && s.reach_ms != null && s.reach_ms <= p.advanceMs && s.speed_mean_kmh != null && s.speed_mean_kmh >= p.advanceKmh;
    },
    progress(p, run) { return { done: run.i, total: p.signs.length }; },
    serialize(run) { return JSON.parse(JSON.stringify(run)); },
    restore(p, data) { return JSON.parse(JSON.stringify(data)); },
  };

  // =====================================================================
  // KEEPSAKE: object-location memory (the Memory Path format). A few things
  // sit on stepping stones across one park map; after a short look they hop
  // into a basket, and the player puts each back on its stone. Levels add
  // things, stones and study time. The map never changes, so its landmarks
  // can be learned; which stones are out and what sits where come from the seed.
  // =====================================================================
  // twelve stones on a 100 x 120 map, placed by hand beside the path and the landmarks
  const KS_STONES = [
    [62, 111], [15, 101], [44, 94], [83, 89], [57, 78], [12, 74],
    [86, 63], [47, 60], [20, 46], [61, 41], [44, 22], [84, 30],
  ];
  const KS_ITEMS = ['apple', 'key', 'mug', 'ball', 'hat', 'book', 'bell', 'umbrella', 'carrot', 'fish', 'sock', 'teapot'];
  function ksDist(a, b) { return Math.hypot(KS_STONES[a][0] - KS_STONES[b][0], KS_STONES[a][1] - KS_STONES[b][1]); }

  const Keepsake = {
    id: 'keepsake',
    name: 'Keepsake',
    noun: 'thing',
    stones: KS_STONES,
    items: KS_ITEMS,
    // about two seconds of look for each thing; two empty stones on top
    levels: {
      1: { items: 2, stones: 4, studyMs: 5000 },
      2: { items: 3, stones: 5, studyMs: 7000 },
      3: { items: 4, stones: 6, studyMs: 9000 },
      4: { items: 5, stones: 7, studyMs: 10000 },
      5: { items: 6, stones: 8, studyMs: 11000 },
    },
    spread: 26,             // stones out on one card stay at least this far apart where the map allows
    describe(p) {
      const n = p.things ? p.things.length : p.items, k = p.out ? p.out.length : p.stones;
      return n + ' things on ' + k + ' stones, ' + (p.studyMs / 1000) + ' s to look';
    },
    build(level, seed, out, things, tray, studyMs) {
      let near = Infinity;
      for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) near = Math.min(near, ksDist(out[i], out[j]));
      return {
        game: 'keepsake', level, seed,
        out: out.slice(), things: things.map((t) => ({ name: t.name, stone: t.stone })), tray: tray.slice(), studyMs,
        reference: things.length,
        features: { things: things.length, stones: out.length, empty_stones: out.length - things.length, study_ms: studyMs, nearest_stones: round(near, 1), names: things.map((t) => t.name).join(' ') },
      };
    },
    generate(level, seed) {
      const L = this.levels[level];
      const rng = makeRng(seed);
      // spread out: take stones in seeded order, skipping any too close to one already out
      const order = rng.shuffle(KS_STONES.map((_, i) => i)), out = [];
      for (const k of order) if (out.length < L.stones && out.every((o) => ksDist(o, k) >= this.spread)) out.push(k);
      for (const k of order) if (out.length < L.stones && out.indexOf(k) < 0) out.push(k);
      out.sort((a, b) => a - b);
      const held = rng.shuffle(out.slice()).slice(0, L.items);
      const names = rng.shuffle(KS_ITEMS.slice()).slice(0, L.items);
      const things = held.map((stone, k) => ({ name: names[k], stone }));
      const tray = rng.shuffle(things.map((_, k) => k));
      return this.build(level, seed, out, things, tray, L.studyMs);
    },
    // two things on four stones, a long look
    practice() {
      return this.build(0, 0, [2, 4, 8, 10], [{ name: 'apple', stone: 4 }, { name: 'key', stone: 10 }], [1, 0], 5000);
    },
    // placed: the stone each thing was put on (the answer); at: the stone it sits on now
    newRun() { return { placed: {}, at: {}, order: [], studied: null }; },
    // put thing k on stone s; one try each. With reveal (feedback on), a thing
    // put on the wrong stone moves to its own, so only right things stay out.
    place(p, run, k, s, reveal) {
      if (run.placed[k] != null || p.out.indexOf(s) < 0) return null;
      for (const key in run.at) if (run.at[key] === s) return { kind: 'blocked', k, s };
      const th = p.things[k];
      const ok = s === th.stone;
      run.placed[k] = s;
      run.at[k] = reveal && !ok ? th.stone : s;
      run.order.push(k);
      return { kind: 'move', k, name: th.name, stone: s, truth: th.stone, cls: ok ? 'correct' : 'wrong', dist: round(ksDist(s, th.stone), 1), n: run.order.length, done: run.order.length === p.things.length };
    },
    summary(p, run) {
      const n = p.things.length;
      let correct = 0, dsum = 0;
      for (let k = 0; k < n; k++) {
        if (run.placed[k] == null) continue;
        if (run.placed[k] === p.things[k].stone) correct++;
        dsum += ksDist(run.placed[k], p.things[k].stone);
      }
      const placed = run.order.length;
      return { n, placed, correct, accuracy: n ? correct / n : null, mean_error: placed ? round(dsum / placed, 2) : null, study_ms: run.studied };
    },
    // at most one thing on the wrong stone
    success(p, s) { return s.placed === s.n && s.correct >= s.n - 1; },
    progress(p, run) { return { done: run.order.length, total: p.things.length }; },
    serialize(run) { return JSON.parse(JSON.stringify(run)); },
    restore(p, data) { return JSON.parse(JSON.stringify(data)); },
  };

  function round(x, k) { const f = Math.pow(10, k); return Math.round(x * f) / f; }

  const Engines = {
    version: '1.19.0',
    fnv1a, makeRng, puzzleSeed,
    games: { outbound: Outbound, conduit: Conduit, tumbler: Tumbler, glimpse: Glimpse, stacks: Stacks, switchback: Switchback, keepsake: Keepsake },
    order: ['outbound', 'conduit', 'tumbler', 'glimpse', 'stacks', 'switchback', 'keepsake'],
    EXIT,
    internals: { ksDist, sbRoad, sbItems, obBuild, obPlantLoop, obAnalyze, obOccupancy, obSlide, cdSolve, rotCW, tbSpace, tbCount, tbPin, tbMarks, tbBest, tbEntropy, tbEncode, tbDecode, tbSolverPath, tbCanonical, tbSeen, periodOf, glLadder, glNearest, glSlotOf, skDist, skKey, skNext, skAll, SK_ALL },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engines;
  else root.Engines = Engines;
})(typeof window !== 'undefined' ? window : globalThis);
