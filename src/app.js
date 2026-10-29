(function () {
  'use strict';
  const E = window.Engines;
  const APP_VERSION = '1.0.0';
  const ORDER = E.order;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const FREE_COUNT = 1000000;
  const LABEL = { mixed: 'All three', outbound: 'Outbound', conduit: 'Conduit', tumbler: 'Tumbler' };

  // ---------------------------------------------------------------- helpers
  const $ = (sel, root) => (root || document).querySelector(sel);
  function h(tag, attrs) {
    const el = document.createElement(tag);
    setAttrs(el, attrs);
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function s(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    setAttrs(el, attrs);
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function setAttrs(el, attrs) {
    if (!attrs) return;
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  function add(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach((k) => add(el, k)); return; }
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  const now = () => performance.now();
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const r4 = (x) => (x == null || !isFinite(x) ? '' : Math.round(x * 10000) / 10000);
  const fin = (x) => (x == null ? '' : x === Infinity ? 'inf' : x);
  function clock(ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  }
  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }
  function uid() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function randomSeed() { return Math.floor(Math.random() * 900000000) + 100000000; }
  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
    },
    del(key) { try { localStorage.removeItem(key); } catch (e) { /* storage unavailable */ } },
  };

  let toastTimer = null;
  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2400);
  }

  // ------------------------------------------------- puzzle generation
  // Generation runs in a worker built from the same engine source, so the
  // next puzzle is ready while the current one is played. Same seed, same puzzle.
  function safeGenerate(game, level, seed) {
    let lastErr = null;
    for (let k = 0; k < 4; k++) {
      try { return E.games[game].generate(level, (seed + k) >>> 0); } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }
  const Gen = {
    worker: null, nextId: 1, waits: new Map(), cache: new Map(), inflight: new Map(),
    init() {
      try {
        if (typeof Worker === 'undefined' || typeof PuzzleEnginesFactory !== 'function') return;
        const src = '(' + PuzzleEnginesFactory.toString() + ')(self);\n' +
          'self.onmessage = function (e) { var d = e.data, p = null, err = null;' +
          ' for (var k = 0; k < 4 && !p; k++) { try { p = self.Engines.games[d.game].generate(d.level, (d.seed + k) >>> 0); } catch (x) { err = x; } }' +
          ' if (p) self.postMessage({ id: d.id, puzzle: p }); else self.postMessage({ id: d.id, error: String(err && err.message || err) }); };';
        const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        const w = new Worker(url);
        w.onmessage = (e) => {
          const job = this.waits.get(e.data.id);
          if (!job) return;
          this.waits.delete(e.data.id);
          clearTimeout(job.timer);
          if (e.data.error) job.fallback(); else job.resolve(e.data.puzzle);
        };
        w.onerror = () => this.fail();
        this.worker = w;
      } catch (e) { this.worker = null; }
    },
    fail() {
      this.worker = null;
      for (const job of this.waits.values()) { clearTimeout(job.timer); job.fallback(); }
      this.waits.clear();
    },
    key(g, l, sd) { return g + '|' + l + '|' + sd; },
    put(k, p) {
      this.cache.set(k, p);
      while (this.cache.size > 14) this.cache.delete(this.cache.keys().next().value);
    },
    peek(g, l, sd) { return this.cache.get(this.key(g, l, sd)) || null; },
    sync(g, l, sd) {
      const k = this.key(g, l, sd);
      let p = this.cache.get(k);
      if (!p) { p = safeGenerate(g, l, sd); this.put(k, p); }
      return p;
    },
    get(g, l, sd) {
      const k = this.key(g, l, sd);
      if (this.cache.has(k)) return Promise.resolve(this.cache.get(k));
      if (this.inflight.has(k)) return this.inflight.get(k);
      const pr = new Promise((resolve, reject) => {
        const viaMain = () => setTimeout(() => { try { resolve(safeGenerate(g, l, sd)); } catch (e) { reject(e); } }, 0);
        if (!this.worker) { viaMain(); return; }
        const id = this.nextId++;
        const job = {
          resolve, fallback: viaMain,
          timer: setTimeout(() => { if (this.waits.has(id)) { this.waits.delete(id); viaMain(); } }, 20000),
        };
        this.waits.set(id, job);
        try { this.worker.postMessage({ id, game: g, level: l, seed: sd }); } catch (e) { this.waits.delete(id); clearTimeout(job.timer); viaMain(); }
      }).then((p) => { this.put(k, p); this.inflight.delete(k); return p; }, (e) => { this.inflight.delete(k); throw e; });
      this.inflight.set(k, pr);
      return pr;
    },
  };

  // ------------------------------------------------------- sequencing
  // A plan is a list of blocks. Puzzle seeds come from (session seed, block,
  // game, level, occurrence), so fixed blocks give everyone the same puzzles
  // and adaptive blocks give everyone the same puzzle at each level.
  function seqInit(blocks, seed) { return { seed, blocks: clone(blocks), b: 0, k: 0, n: 0, adapt: {}, counts: {} }; }
  function seqTotal(S) { return S.blocks.reduce((a, b) => a + b.count, 0); }
  function seqNext(S) {
    while (S.b < S.blocks.length && S.k >= S.blocks[S.b].count) { S.b++; S.k = 0; }
    if (S.b >= S.blocks.length) return null;
    const B = S.blocks[S.b];
    const game = B.game === 'mixed' ? ORDER[S.k % ORDER.length] : B.game;
    const akey = S.b + ':' + game;
    if (!S.adapt[akey]) S.adapt[akey] = { level: B.level, streak: 0 };
    const level = B.adaptive ? S.adapt[akey].level : B.level;
    const ckey = S.b + ':' + game + ':' + level;
    const j = S.counts[ckey] || 0;
    S.counts[ckey] = j + 1;
    const spec = {
      seq: S.n + 1, block: S.b + 1, inBlock: S.k + 1, game, level, adaptive: !!B.adaptive, j,
      seed: E.puzzleSeed(S.seed, S.b, game, level, j),
    };
    spec.id = 'B' + spec.block + '-' + game + '-L' + level + '-' + (j + 1);
    S.k++;
    S.n++;
    return spec;
  }
  // 2-up / 1-down staircase per game within a block
  function seqRecord(S, spec, success) {
    if (!spec.adaptive) return null;
    const a = S.adapt[(spec.block - 1) + ':' + spec.game];
    if (!a) return null;
    const before = a.level;
    if (success) {
      a.streak++;
      if (a.streak >= 2) { a.level = Math.min(5, a.level + 1); a.streak = 0; }
    } else {
      a.level = Math.max(1, a.level - 1);
      a.streak = 0;
    }
    return { from: before, to: a.level, changed: a.level !== before };
  }

  // --------------------------------------------------------- defaults
  const FREE_OPTIONS = { feedback: true, hints: true, undo: true, skip: true, counter: true, par: 1.5, limit: 0 };
  const STUDY_OPTIONS = { feedback: false, hints: false, undo: true, skip: false, counter: false, par: 1.5, limit: 0 };
  const PRESETS = [
    { id: 'prepost', name: 'Pre / train / post', blocks: [
      { game: 'mixed', count: 3, level: 2, adaptive: false },
      { game: 'outbound', count: 8, level: 2, adaptive: true },
      { game: 'mixed', count: 3, level: 2, adaptive: false },
    ] },
    { id: 'practice', name: 'Mixed practice', blocks: [{ game: 'mixed', count: 12, level: 2, adaptive: true }] },
    { id: 'fixed', name: 'Fixed set', blocks: [{ game: 'mixed', count: 6, level: 3, adaptive: false }] },
  ];

  // ------------------------------------------------------- sessions
  const Sessions = {
    index() { return store.get('pr1.index', []); },
    load(id) { return store.get('pr1.s.' + id, null); },
    save(S) {
      const ok = store.set('pr1.s.' + S.id, S);
      const idx = this.index().filter((x) => x.id !== S.id);
      idx.unshift({ id: S.id, kind: S.kind, participant: S.participant, condition: S.condition, startedAt: S.startedAt, status: S.status, puzzles: S.puzzles.length });
      return store.set('pr1.index', idx) && ok;
    },
    all() { return this.index().map((x) => this.load(x.id)).filter(Boolean); },
    prune() {
      const idx = this.index();
      const free = idx.filter((x) => x.kind === 'free');
      if (free.length <= 6) return;
      const drop = new Set(free.slice(6).map((x) => x.id));
      for (const id of drop) store.del('pr1.s.' + id);
      store.set('pr1.index', idx.filter((x) => !drop.has(x.id)));
    },
    clear() {
      for (const x of this.index()) store.del('pr1.s.' + x.id);
      store.del('pr1.index');
      store.del('pr1.active');
    },
  };
  function newSession(kind, setup) {
    return {
      id: uid(), kind,
      participant: (setup.participant || '').trim(),
      condition: (setup.condition || '').trim(),
      seed: setup.seed >>> 0,
      options: Object.assign({}, setup.options),
      blocks: clone(setup.blocks),
      app_version: APP_VERSION, engine_version: E.version,
      device: {
        user_agent: navigator.userAgent,
        screen: (screen.width || 0) + 'x' + (screen.height || 0),
        pixel_ratio: window.devicePixelRatio || 1,
        touch: 'ontouchstart' in window ? 1 : 0,
      },
      startedAt: new Date().toISOString(), endedAt: null, status: 'active',
      t0wall: Date.now(),
      seq: seqInit(setup.blocks, setup.seed >>> 0),
      events: [], puzzles: [],
      hasMoves: false,
      live: null,
    };
  }

  // --------------------------------------------------------- visuals
  const CAR_COLORS = [
    { fill: '#E4572E', dark: false }, { fill: '#2E86DE', dark: false }, { fill: '#F3C316', dark: true },
    { fill: '#1FA39B', dark: false }, { fill: '#8E5BD8', dark: false }, { fill: '#F08A3E', dark: true },
    { fill: '#5DAA3F', dark: false }, { fill: '#D9508A', dark: false }, { fill: '#E9EDEF', dark: true }, { fill: '#9AA4AD', dark: true },
  ];
  const PEGS = [
    { name: 'red', fill: '#D7263D', ink: '#FFFFFF', glyph: 'M8 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8z' },
    { name: 'blue', fill: '#1B65D1', ink: '#FFFFFF', glyph: 'M4 4h8v8H4z' },
    { name: 'yellow', fill: '#F3C316', ink: '#1A1606', glyph: 'M8 3l5 9H3z' },
    { name: 'green', fill: '#2E9E5B', ink: '#FFFFFF', glyph: 'M8 2.5l5.5 5.5L8 13.5 2.5 8z' },
    { name: 'purple', fill: '#7D4CDB', ink: '#FFFFFF', glyph: 'M6.5 3h3v3.5H13v3H9.5V13h-3V9.5H3v-3h3.5z' },
    { name: 'orange', fill: '#F07B1E', ink: '#1A1606', glyph: 'M8 2.2l1.7 3.6 3.9.5-2.9 2.7.7 3.9L8 11l-3.4 1.9.7-3.9-2.9-2.7 3.9-.5z' },
    { name: 'teal', fill: '#13A3A8', ink: '#1A1606', glyph: 'M3 6.5h10v3H3z' },
  ];
  const DIRV = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  const ANGLE = { N: 0, E: 90, S: 180, W: 270 };
  const DIRNAME = { N: 'up', E: 'right', S: 'down', W: 'left' };
  const SIDEV = { 1: [0, -1], 2: [1, 0], 4: [0, 1], 8: [-1, 0] };

  const HEADLINE = {
    outbound: { solved: 'Lot cleared', failed: 'No way out', skipped: 'Skipped', timeout: "Time's up", abandoned: 'Stopped' },
    conduit: { solved: 'Water flows', failed: 'Stopped', skipped: 'Skipped', timeout: "Time's up", abandoned: 'Stopped' },
    tumbler: { solved: 'Code cracked', failed: 'Out of tries', skipped: 'Skipped', timeout: "Time's up", abandoned: 'Stopped' },
  };
  const VERDICT = {
    outbound: { optimal: 'Best move', wasted: 'Extra move', dead_end: 'Dead end: the lot can no longer be cleared', in_dead_end: 'Still in a dead end', blocked: 'Blocked' },
    conduit: { optimal: 'Turned toward the solution', wasted: 'That tile was already right' },
    tumbler: { optimal: 'Most informative try', suboptimal: 'A sharper try was possible', zero_info: 'This try tells you nothing new', solved: 'Cracked' },
  };
  const APPLIES = {
    outbound: ['optimal', 'wasted', 'dead_end', 'in_dead_end', 'blocked', 'undo', 'restart', 'hint'],
    conduit: ['optimal', 'wasted', 'undo', 'restart', 'hint'],
    tumbler: ['optimal', 'suboptimal', 'zero_info', 'inconsistent', 'hint'],
  };

  function blankCounts() {
    return { moves: 0, optimal: 0, wasted: 0, dead_end: 0, in_dead_end: 0, blocked: 0, undo: 0, restart: 0, hint: 0, suboptimal: 0, zero_info: 0, inconsistent: 0, neutral: 0, solved: 0, infoRatioSum: 0, infoRatioN: 0 };
  }

  // ============================================================== cards
  class Card {
    constructor(app, spec, puzzle, snap) {
      this.app = app;
      this.spec = spec;
      this.p = puzzle;
      this.G = E.games[spec.game];
      this.o = app.session.options;
      this.par = Math.max(1, Math.ceil(puzzle.reference * this.o.par));
      this.run = snap ? this.G.restore(puzzle, snap.run) : this.G.newRun(puzzle);
      this.c = snap ? Object.assign(blankCounts(), snap.c) : blankCounts();
      this.t0 = now() - (snap ? snap.elapsed : 0);
      this.frozen = snap && snap.summary ? snap.elapsed : null;
      this.firstMove = snap ? snap.firstMove : null;
      this.hiddenMs = snap ? snap.hiddenMs : 0;
      this.hiddenAt = null;
      this.startedAt = snap ? snap.startedAt : new Date().toISOString();
      this.summary = snap ? snap.summary : null;
      this.extra = snap ? snap.extra : null;
      this.busy = false;
      this.timers = new Set();
      this.el = h('article', { class: 'card', 'data-game': spec.game, 'aria-label': this.G.name + ', level ' + spec.level });
      this.buildFrame();
      this.buildBoard();
      this.refresh();
      this.updateMeta();
      if (this.summary) this.showResult(this.summary);
    }
    later(fn, ms) { const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms); this.timers.add(t); return t; }
    destroy() {
      clearInterval(this.tick);
      for (const t of this.timers) clearTimeout(t);
      this.timers.clear();
    }
    elapsed() { return this.frozen != null ? this.frozen : now() - this.t0; }
    buildFrame() {
      this.metaEl = h('div', { class: 'meta', 'aria-live': 'off' });
      const head = h('header', { class: 'card-head' },
        h('span', { class: 'badge ' + this.spec.game, text: this.G.name }),
        h('span', { class: 'lvl', title: 'Level', text: 'L' + this.spec.level }),
        this.metaEl);
      const rule = h('p', { class: 'rule' }, this.G.rule + ' ', h('strong', { text: this.G.goal }));
      this.wrap = h('div', { class: 'board-wrap' });
      this.verdictEl = h('div', { class: 'verdict', role: 'status' });
      this.wrap.append(this.verdictEl);
      this.noticeEl = h('div', { class: 'notice', hidden: true });
      this.toolsEl = h('footer', { class: 'tools' });
      this.el.append(head, rule, this.wrap, this.noticeEl, this.toolsEl);
      this.buildTools();
    }
    buildTools() {
      const t = this.toolsEl;
      t.textContent = '';
      if (this.o.undo && this.G.undo) {
        t.append(h('button', { class: 'btn tool', type: 'button', onclick: () => this.doUndo() }, 'Undo'));
        t.append(h('button', { class: 'btn tool', type: 'button', onclick: () => this.doRestart() }, 'Restart'));
      }
      if (this.o.hints) t.append(h('button', { class: 'btn tool', type: 'button', onclick: () => this.doHint() }, 'Hint'));
      t.append(h('span', { class: 'spacer' }));
      if (this.o.skip) {
        this.skipBtn = h('button', { class: 'btn tool', type: 'button', onclick: () => this.doSkip() }, 'Skip');
        t.append(this.skipBtn);
      }
      t.hidden = !t.querySelector('button');
    }
    start() {
      this.t0 = now();
      this.log('puzzle_start', {
        detail: JSON.stringify({ params: this.G.describe(this.p), reference: this.p.reference, par: this.par, features: this.p.features }),
      });
      this.startTimer();
    }
    startTimer() {
      clearInterval(this.tick);
      if (this.summary) return;
      this.tick = setInterval(() => this.updateMeta(), 1000);
    }
    updateMeta() {
      const m = this.metaEl;
      m.textContent = '';
      const t = this.elapsed();
      if (this.o.counter) {
        if (this.spec.game === 'tumbler') {
          const n = this.summary ? this.run.tries.length : Math.min(this.run.tries.length + 1, this.p.max);
          m.append(h('span', null, (this.summary ? 'Tries ' : 'Try ') + '', h('b', { text: String(n) }), '/' + this.p.max));
        }
        else m.append(h('span', null, 'Moves ', h('b', { text: String(this.c.moves) }), ' · par ' + this.par));
        if (!this.o.limit) m.append(h('span', { text: clock(t) }));
      }
      if (this.o.limit) {
        const left = this.o.limit * 1000 - t;
        m.append(h('span', null, h('b', { text: clock(left) }), ' left'));
        if (left <= 0 && !this.summary) this.resolve('timeout');
      }
    }
    log(event, fields) { this.app.logPuzzle(this, event, fields || {}); }
    verdict(cls, extraText) {
      const map = VERDICT[this.spec.game] || {};
      const text = (map[cls] || '') + (extraText || '');
      if (!text) return;
      const v = this.verdictEl;
      v.className = 'verdict show ' + cls;
      v.textContent = text;
      clearTimeout(this.verdictTimer);
      this.verdictTimer = this.later(() => { v.className = 'verdict'; }, 1700);
    }
    note(text, buttons) {
      const n = this.noticeEl;
      n.textContent = '';
      n.append(h('p', { text }));
      (buttons || []).forEach((b) => n.append(b));
      n.hidden = false;
    }
    hideNotice() { this.noticeEl.hidden = true; }
    moveFields(rec) {
      return {
        move_no: this.c.moves, target: rec.target,
        from: this.pos(rec.from), to: this.pos(rec.to),
        d_before: fin(rec.dBefore), d_after: fin(rec.dAfter), cls: rec.cls,
      };
    }
    pos(v) { return v == null ? '' : v; }
    commit(rec) {
      if (rec.kind === 'blocked') {
        this.c.blocked++;
        this.log('blocked', this.moveFields(rec));
        if (this.o.feedback) this.verdict('blocked');
        this.app.touch();
        return;
      }
      this.c.moves++;
      this.app.session.hasMoves = true;
      if (this.firstMove == null) this.firstMove = rec.t_ms != null ? rec.t_ms : Math.round(this.elapsed());
      if (rec.cls && this.c[rec.cls] != null) this.c[rec.cls]++;
      if (rec.consistent === false && !rec.solved) this.c.inconsistent++;
      if (rec.infoBest > 0) { this.c.infoRatioSum += rec.infoExpected / rec.infoBest; this.c.infoRatioN++; }
      const f = this.moveFields(rec);
      if (rec.t_ms != null) f.t_ms = rec.t_ms;
      this.log('move', f);
      if (this.o.feedback) this.verdict(rec.cls, this.verdictExtra ? this.verdictExtra(rec) : '');
      this.updateMeta();
      if (rec.solved) { this.resolve('solved'); return; }
      if (rec.failed) { this.resolve('failed'); return; }
      if (rec.stuck) this.showStuck();
      this.app.touch();
    }
    doUndo() {
      if (this.summary || this.busy) return;
      const r = this.G.undo(this.p, this.run);
      if (!r) return;
      this.c.undo++;
      this.log('undo', { move_no: this.c.moves, target: r.target, from: this.pos(r.from), to: this.pos(r.to), d_before: fin(r.dBefore), d_after: fin(r.dAfter) });
      this.hideNotice();
      this.afterUndo(r);
      this.updateMeta();
      this.app.touch();
    }
    doRestart() {
      if (this.summary || this.busy) return;
      const dB = this.G.dist ? fin(this.G.dist(this.p, this.spec.game === 'outbound' ? this.run.st : this.run.rot)) : '';
      this.G.restart(this.p, this.run);
      this.c.restart++;
      const dA = this.G.dist ? fin(this.G.dist(this.p, this.spec.game === 'outbound' ? this.run.st : this.run.rot)) : '';
      this.log('restart', { move_no: this.c.moves, d_before: dB, d_after: dA });
      this.hideNotice();
      this.refresh(true);
      this.updateMeta();
      this.app.touch();
    }
    doHint() {
      if (this.summary || this.busy) return;
      const hint = this.G.hint(this.p, this.run);
      this.c.hint++;
      this.log('hint', { move_no: this.c.moves, target: hint.target != null ? hint.target : '', detail: JSON.stringify(hint) });
      this.showHint(hint);
      this.app.touch();
    }
    doSkip() {
      if (this.summary || this.busy) return;
      if (!this.skipArmed) {
        this.skipArmed = true;
        this.skipBtn.textContent = 'Tap again to skip';
        this.later(() => { this.skipArmed = false; if (this.skipBtn) this.skipBtn.textContent = 'Skip'; }, 2500);
        return;
      }
      this.resolve('skipped');
    }
    showStuck() {
      const btns = [];
      if (this.o.undo) {
        btns.push(h('button', { class: 'btn', type: 'button', onclick: () => this.doUndo() }, 'Undo'));
        btns.push(h('button', { class: 'btn', type: 'button', onclick: () => this.doRestart() }, 'Restart'));
        this.note('No car can move, and cars are still in the lot.', btns);
      } else {
        this.note('No car can move, and cars are still in the lot.');
        this.later(() => this.resolve('failed'), 1400);
      }
    }
    resolve(outcome) {
      if (this.summary) return;
      clearInterval(this.tick);
      if (this.hiddenAt != null) { this.hiddenMs += now() - this.hiddenAt; this.hiddenAt = null; }
      const dur = Math.round(this.elapsed());
      this.frozen = dur;
      const solved = outcome === 'solved';
      const sm = {
        outcome,
        success: solved && this.c.moves <= this.par,
        duration_ms: dur,
        first_move_ms: this.firstMove,
        hidden_ms: Math.round(this.hiddenMs),
        moves: this.c.moves,
        reference: this.p.reference,
        par: this.par,
        efficiency: this.c.moves ? r4(this.p.reference / this.c.moves) : '',
      };
      this.summary = sm;
      this.hideNotice();
      const res = this.app.onPuzzleEnd(this, sm);
      sm.level_next = res.level_next;
      sm.level_change = res.change && res.change.changed ? res.change : null;
      if (this.onResolved) this.onResolved(outcome);
      this.showResult(sm);
    }
    showResult(sm) {
      if (this.resultEl) this.resultEl.remove();
      const panel = h('section', { class: 'result', 'aria-label': 'Result' });
      panel.append(h('h3', { text: (HEADLINE[this.spec.game] || {})[sm.outcome] || 'Done' }));
      if (this.o.counter) {
        const stats = h('div', { class: 'stats' });
        stats.append(h('span', null, 'Time ', h('b', { text: clock(sm.duration_ms) })));
        const unit = this.spec.game === 'tumbler' ? 'Tries ' : this.spec.game === 'conduit' ? 'Turns ' : 'Moves ';
        stats.append(h('span', null, unit, h('b', { text: String(sm.moves) }), ' · par ' + sm.par));
        const refLabel = this.spec.game === 'tumbler' ? 'Solver needed ' : 'Fewest possible ';
        stats.append(h('span', null, refLabel, h('b', { text: String(sm.reference) })));
        if (this.spec.game === 'outbound' && this.c.dead_end) stats.append(h('span', null, 'Dead ends ', h('b', { text: String(this.c.dead_end) })));
        panel.append(stats);
      }
      const row = h('div', { class: 'row' });
      const last = this.app.isLast(this.spec);
      const next = h('button', { class: 'btn primary', type: 'button', onclick: () => this.app.next() }, last ? 'Finish' : 'Next puzzle');
      row.append(next);
      if (this.o.counter) {
        if (sm.outcome === 'solved') row.append(h('span', { class: 'pill ' + (sm.success ? 'ok' : 'warn'), text: sm.success ? 'At or under par' : 'Over par' }));
        if (sm.level_change) row.append(h('span', { class: 'pill ' + (sm.level_change.to > sm.level_change.from ? 'ok' : 'warn'), text: 'Next ' + this.G.name + ': L' + sm.level_change.to }));
      }
      if (!last) row.append(h('span', { class: 'swipe', text: 'or swipe up' }));
      panel.append(row);
      this.el.append(panel);
      this.el.classList.add('resolved');
      this.resultEl = panel;
      this.later(() => { try { next.focus({ preventScroll: true }); } catch (e) { /* focus is optional */ } }, 60);
    }
    snapshot() {
      return {
        spec: this.spec,
        run: this.G.serialize(this.run),
        c: this.c,
        elapsed: Math.round(this.elapsed()),
        firstMove: this.firstMove,
        hiddenMs: Math.round(this.hiddenMs + (this.hiddenAt != null ? now() - this.hiddenAt : 0)),
        startedAt: this.startedAt,
        summary: this.summary,
        extra: this.extraSnapshot ? this.extraSnapshot() : null,
      };
    }
    onKey() { return false; }
  }

  // ------------------------------------------------------------ Outbound
  class OutboundCard extends Card {
    pos(v) { return v === E.EXIT ? 'exit' : v == null ? '' : v; }
    buildBoard() {
      const p = this.p, U = 10, pad = 3;
      const W = p.w * U, H = p.h * U;
      const svgEl = s('svg', { class: 'board', viewBox: (-pad) + ' ' + (-pad) + ' ' + (W + pad * 2) + ' ' + (H + pad * 2), role: 'group', 'aria-label': 'Parking lot, ' + p.w + ' by ' + p.h + ', ' + p.cars.length + ' cars' });
      svgEl.append(s('rect', { class: 'lot-ground', x: -pad, y: -pad, width: W + pad * 2, height: H + pad * 2, rx: 4 }));
      for (let x = 1; x < p.w; x++) svgEl.append(s('line', { class: 'lot-line', x1: x * U, y1: 0.8, x2: x * U, y2: H - 0.8 }));
      for (let y = 1; y < p.h; y++) svgEl.append(s('line', { class: 'lot-line', x1: 0.8, y1: y * U, x2: W - 0.8, y2: y * U }));
      svgEl.append(s('rect', { class: 'lot-curb', x: 0, y: 0, width: W, height: H, rx: 1.5 }));
      this.carEls = p.cars.map((c, i) => { const g = this.drawCar(c, i); svgEl.append(g); return g; });
      this.svg = svgEl;
      this.wrap.prepend(svgEl);
    }
    center(c, adv) {
      const d = DIRV[c.dir];
      const rx = c.x + adv * d[0], ry = c.y + adv * d[1];
      const fx = rx + (c.len - 1) * d[0], fy = ry + (c.len - 1) * d[1];
      return [((rx + fx) / 2 + 0.5) * 10, ((ry + fy) / 2 + 0.5) * 10];
    }
    drawCar(c, i) {
      const L = c.len * 10;
      const col = CAR_COLORS[c.color % CAR_COLORS.length];
      const mark = col.dark ? 'rgba(20,20,20,0.75)' : 'rgba(255,255,255,0.92)';
      const g = s('g', { class: 'car', tabindex: '0', role: 'button', 'aria-label': 'Car ' + c.label + (c.len === 3 ? ', truck' : '') + ', facing ' + DIRNAME[c.dir] });
      const body = s('g', { transform: 'rotate(' + ANGLE[c.dir] + ')' });
      const top = -L / 2;
      body.append(s('rect', { class: 'halo', x: -4.8, y: top + 0.2, width: 9.6, height: L - 0.4, rx: 3.1 }));
      body.append(s('rect', { x: -4.1, y: top + 0.9, width: 8.2, height: L - 1.8, rx: 2.4, fill: col.fill }));
      body.append(s('rect', { x: -3.4, y: top + 1.05, width: 1.7, height: 0.9, rx: 0.4, fill: '#FFF6CF' }));
      body.append(s('rect', { x: 1.7, y: top + 1.05, width: 1.7, height: 0.9, rx: 0.4, fill: '#FFF6CF' }));
      if (c.len === 3) {
        body.append(s('rect', { x: -3.3, y: top + 2.6, width: 6.6, height: 5.2, rx: 1.2, fill: 'rgba(0,0,0,0.26)' }));
        body.append(s('rect', { x: -3.3, y: top + 2.6, width: 6.6, height: 1.6, rx: 0.8, fill: 'rgba(255,255,255,0.55)' }));
        body.append(s('rect', { x: -3.6, y: top + 9.0, width: 7.2, height: L - 10.4, rx: 1, fill: 'rgba(255,255,255,0.22)' }));
      } else {
        body.append(s('rect', { x: -3.3, y: top + 3.0, width: 6.6, height: L - 6.4, rx: 1.4, fill: 'rgba(0,0,0,0.24)' }));
        body.append(s('rect', { x: -3.3, y: top + 3.0, width: 6.6, height: 1.9, rx: 0.9, fill: 'rgba(255,255,255,0.6)' }));
      }
      const cy = c.len === 3 ? top + 5.6 : top + L / 2 + 0.8;
      body.append(s('path', { d: 'M -1.7 ' + (cy + 0.9) + ' L 0 ' + (cy - 0.8) + ' L 1.7 ' + (cy + 0.9), fill: 'none', stroke: mark, 'stroke-width': 0.95, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      g.append(body);
      g.addEventListener('click', () => this.tap(i));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.tap(i); } });
      return g;
    }
    place(i, instant) {
      const c = this.p.cars[i], g = this.carEls[i], a = this.run.st[i];
      if (a === E.EXIT) {
        g.style.display = 'none';
        return;
      }
      g.style.display = '';
      g.classList.remove('leaving');
      const xy = this.center(c, a);
      if (instant) g.style.transition = 'none';
      g.style.opacity = '1';
      g.style.transform = 'translate(' + xy[0] + 'px,' + xy[1] + 'px)';
      if (instant) { void g.getBoundingClientRect(); g.style.transition = ''; }
    }
    refresh(animated) { this.p.cars.forEach((c, i) => this.place(i, !animated)); }
    tap(i) {
      if (this.summary || this.busy) return;
      const rec = this.G.tap(this.p, this.run, i);
      if (!rec) return;
      if (rec.kind === 'blocked') this.shake(i);
      else this.animateMove(i, rec);
      if (this.o.feedback) this.flash(i, rec.cls);
      this.commit(rec);
    }
    animateMove(i, rec) {
      const c = this.p.cars[i], g = this.carEls[i];
      if (rec.exited) {
        const far = Math.max(this.p.w, this.p.h) + c.len + 2;
        const xy = this.center(c, rec.from + far);
        g.classList.add('leaving');
        g.style.transform = 'translate(' + xy[0] + 'px,' + xy[1] + 'px)';
        g.style.opacity = '0';
        this.later(() => { if (this.run.st[i] === E.EXIT) g.style.display = 'none'; }, 460);
      } else {
        this.place(i, false);
      }
    }
    shake(i) {
      const g = this.carEls[i];
      g.classList.remove('shake');
      void g.getBoundingClientRect();
      g.classList.add('shake');
      this.later(() => g.classList.remove('shake'), 320);
    }
    flash(i, cls) {
      const g = this.carEls[i];
      const k = 'flash-' + cls;
      g.classList.add(k);
      this.later(() => g.classList.remove(k), 750);
    }
    afterUndo(r) {
      const g = this.carEls[r.index];
      if (r.from === E.EXIT) {
        this.place(r.index, true);
        if (!reducedMotion()) g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
      } else this.place(r.index, false);
    }
    showHint(hint) {
      if (hint.kind === 'target') {
        const g = this.carEls[hint.index];
        g.classList.add('hinted');
        this.later(() => g.classList.remove('hinted'), 2700);
      } else if (hint.kind === 'dead_end') {
        this.note('The lot can no longer be cleared from here. Undo a move or restart.', this.o.undo ? [
          h('button', { class: 'btn', type: 'button', onclick: () => this.doUndo() }, 'Undo'),
        ] : []);
      }
    }
  }

  // ------------------------------------------------------------- Conduit
  class ConduitCard extends Card {
    buildBoard() {
      const p = this.p, U = 10, pad = 1.5;
      const svgEl = s('svg', { class: 'board', viewBox: (-pad) + ' ' + (-pad) + ' ' + (p.w * U + pad * 2) + ' ' + (p.h * U + pad * 2), role: 'group', 'aria-label': 'Pipe grid, ' + p.w + ' by ' + p.h });
      svgEl.append(s('rect', { class: 'lot-ground', x: -pad, y: -pad, width: p.w * U + pad * 2, height: p.h * U + pad * 2, rx: 3 }));
      this.angle = this.run.rot.map((r) => r * 90);
      this.cells = [];
      this.tiles = [];
      for (let i = 0; i < p.w * p.h; i++) {
        const x = i % p.w, y = (i / p.w) | 0;
        const cx = x * U + U / 2, cy = y * U + U / 2;
        const cell = s('g', { class: 'cell', tabindex: '0', role: 'button', 'aria-label': 'Tile row ' + (y + 1) + ', column ' + (x + 1) + (i === p.src ? ', source' : '') });
        cell.append(s('rect', { class: 'bed', x: x * U + 0.45, y: y * U + 0.45, width: U - 0.9, height: U - 0.9, rx: 1.6 }));
        const tile = s('g', { class: 'tile' });
        tile.style.transformOrigin = cx + 'px ' + cy + 'px';
        const m = p.sol[i];
        let deg = 0;
        for (const side of [1, 2, 4, 8]) {
          if (!(m & side)) continue;
          deg++;
          tile.append(s('line', { class: 'pipe', x1: cx, y1: cy, x2: cx + SIDEV[side][0] * 5, y2: cy + SIDEV[side][1] * 5 }));
        }
        if (i !== p.src) {
          if (deg === 1) tile.append(s('circle', { class: 'cap', cx, cy, r: 2.2 }));
          else if (deg >= 3) tile.append(s('circle', { class: 'hub', cx, cy, r: 1.75 }));
        }
        cell.append(tile);
        if (i === p.src) {
          cell.append(s('rect', { class: 'source-mark', x: cx - 3.1, y: cy - 3.1, width: 6.2, height: 6.2, rx: 1.3 }));
          cell.append(s('path', { class: 'source-drop', d: 'M' + cx + ' ' + (cy - 2.1) + ' C ' + (cx + 1.6) + ' ' + (cy - 0.2) + ', ' + (cx + 1.5) + ' ' + (cy + 1.9) + ', ' + cx + ' ' + (cy + 1.9) + ' C ' + (cx - 1.5) + ' ' + (cy + 1.9) + ', ' + (cx - 1.6) + ' ' + (cy - 0.2) + ', ' + cx + ' ' + (cy - 2.1) + ' Z' }));
        }
        cell.append(s('rect', { class: 'ring', x: x * U + 0.45, y: y * U + 0.45, width: U - 0.9, height: U - 0.9, rx: 1.6 }));
        cell.addEventListener('click', () => this.tap(i));
        cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.tap(i); } });
        svgEl.append(cell);
        this.cells.push(cell);
        this.tiles.push(tile);
      }
      this.svg = svgEl;
      this.wrap.prepend(svgEl);
    }
    setAngle(i, instant) {
      const t = this.tiles[i];
      if (instant) t.style.transition = 'none';
      t.style.transform = 'rotate(' + this.angle[i] + 'deg)';
      if (instant) { void t.getBoundingClientRect(); t.style.transition = ''; }
    }
    wet() {
      const on = this.G.connected(this.p, this.run);
      this.tiles.forEach((t, i) => t.classList.toggle('wet', !!on[i]));
    }
    refresh(animated) {
      this.angle = this.run.rot.map((r, i) => {
        if (!animated || this.angle[i] == null) return r * 90;
        const cur = this.angle[i];
        const base = cur - (((cur % 360) + 360) % 360);
        return base + r * 90;
      });
      this.tiles.forEach((t, i) => this.setAngle(i, !animated));
      this.wet();
      this.svg.classList.toggle('solved', !!(this.summary && this.summary.outcome === 'solved'));
    }
    tap(i) {
      if (this.summary || this.busy) return;
      const rec = this.G.tap(this.p, this.run, i);
      this.angle[i] += 90;
      this.setAngle(i, false);
      this.wet();
      if (this.o.feedback) this.flash(i, rec.cls);
      this.commit(rec);
    }
    flash(i, cls) {
      const k = 'flash-' + cls;
      this.cells[i].classList.add(k);
      this.later(() => this.cells[i].classList.remove(k), 650);
    }
    afterUndo(r) {
      this.angle[r.index] -= 90;
      this.setAngle(r.index, false);
      this.wet();
    }
    showHint(hint) {
      if (hint.kind !== 'target') return;
      const c = this.cells[hint.index];
      c.classList.add('hinted');
      this.later(() => c.classList.remove('hinted'), 2700);
    }
    onResolved(outcome) { if (outcome === 'solved') this.svg.classList.add('solved'); }
  }

  // ------------------------------------------------------------- Tumbler
  function pegGlyph(c) {
    const pg = PEGS[c];
    return s('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' }, s('path', { d: pg.glyph, fill: pg.ink }));
  }
  function peg(c, tag, attrs) {
    const el = h(tag || 'span', Object.assign({ class: 'peg' }, attrs || {}));
    if (c == null) { el.classList.add('blank'); return el; }
    el.style.background = PEGS[c].fill;
    el.append(pegGlyph(c));
    return el;
  }
  class TumblerCard extends Card {
    buildBoard() {
      const p = this.p;
      this.draft = this.extra && Array.isArray(this.extra.draft) ? this.extra.draft.slice() : new Array(p.P).fill(null);
      const tb = h('div', { class: 'tb' });
      this.rowsEl = h('div', { class: 'tb-rows', role: 'list', 'aria-label': 'Tries' });
      this.palEl = h('div', { class: 'tb-palette', role: 'group', 'aria-label': 'Colors' });
      for (let c = 0; c < p.C; c++) {
        this.palEl.append(peg(c, 'button', { type: 'button', 'aria-label': 'Add ' + PEGS[c].name + ' (key ' + (c + 1) + ')', onclick: () => this.put(c) }));
      }
      this.clearBtn = h('button', { class: 'btn', type: 'button', onclick: () => this.clearDraft() }, 'Clear');
      this.tryBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => this.submit() }, 'Try this code');
      this.actionsEl = h('div', { class: 'tb-actions' }, this.clearBtn, this.tryBtn);
      tb.append(this.rowsEl, this.palEl, this.actionsEl);
      this.wrap.prepend(tb);
    }
    put(c) {
      if (this.summary || this.busy) return;
      const k = this.draft.indexOf(null);
      if (k < 0) return;
      this.draft[k] = c;
      this.refresh();
    }
    clearSlot(k) {
      if (this.summary || this.busy) return;
      this.draft[k] = null;
      this.refresh();
    }
    clearDraft() {
      if (this.summary || this.busy) return;
      this.draft = new Array(this.p.P).fill(null);
      this.refresh();
    }
    refresh() {
      const p = this.p, tries = this.run.tries;
      this.rowsEl.textContent = '';
      let activeEl = null;
      for (let r = 0; r < p.max; r++) {
        const row = h('div', { class: 'tb-row', role: 'listitem' });
        row.append(h('span', { class: 'n', text: String(r + 1) }));
        const pins = h('div', { class: 'tb-pins' });
        if (r < tries.length) {
          const t = tries[r];
          t.digits.forEach((d) => pins.append(peg(d)));
          row.append(pins, this.feedbackEl(t.exact, t.partial));
          row.setAttribute('aria-label', 'Try ' + (r + 1) + ': ' + t.digits.map((d) => PEGS[d].name).join(', ') + '. ' + t.exact + ' right spot, ' + t.partial + ' wrong spot.');
        } else if (r === tries.length && !this.summary) {
          row.classList.add('active');
          this.draft.forEach((d, k) => {
            const b = peg(d, 'button', { type: 'button', 'aria-label': d == null ? 'Empty slot ' + (k + 1) : 'Remove ' + PEGS[d].name + ' from slot ' + (k + 1), onclick: () => this.clearSlot(k) });
            pins.append(b);
          });
          row.append(pins, h('span', { class: 'tb-fbtext', text: '' }));
          activeEl = row;
        } else {
          for (let k = 0; k < p.P; k++) pins.append(h('span', { class: 'peg empty' }));
          row.append(pins, h('span'));
        }
        this.rowsEl.append(row);
      }
      if (this.summary && this.summary.outcome !== 'solved') {
        const row = h('div', { class: 'tb-row active', 'aria-label': 'The code' });
        const pins = h('div', { class: 'tb-pins' });
        p.secretDigits.forEach((d) => pins.append(peg(d)));
        row.append(h('span', { class: 'n', text: '=' }), pins, h('span', { class: 'tb-fbtext', text: 'code' }));
        this.rowsEl.append(row);
        activeEl = row;
      }
      const full = this.draft.every((d) => d != null);
      this.tryBtn.disabled = !full || !!this.summary || this.busy;
      this.clearBtn.disabled = this.draft.every((d) => d == null) || !!this.summary;
      this.palEl.querySelectorAll('button').forEach((b) => { b.disabled = !!this.summary || full; });
      const target = activeEl || this.rowsEl.lastChild;
      if (target) this.later(() => { try { target.scrollIntoView({ block: 'nearest' }); } catch (e) { /* optional */ } }, 0);
    }
    feedbackEl(exact, partial) {
      const box = h('div', { class: 'tb-fb', 'aria-hidden': 'true' });
      for (let k = 0; k < this.p.P; k++) box.append(h('i', { class: k < exact ? 'x' : k < exact + partial ? 'p' : '' }));
      const wrap = h('span', { style: 'display:flex;align-items:center;gap:8px' }, h('span', { class: 'tb-fbtext', text: '●' + exact + ' ○' + partial }), box);
      return wrap;
    }
    submit() {
      if (this.summary || this.busy) return;
      if (this.draft.some((d) => d == null)) return;
      const t = Math.round(this.elapsed());
      const rec = this.G.guess(this.p, this.run, this.draft.slice());
      rec.t_ms = t;
      this.draft = new Array(this.p.P).fill(null);
      this.busy = true;
      this.refresh();
      // feedback is on screen now; the slower information score follows
      requestAnimationFrame(() => this.later(() => {
        this.G.annotate(this.p, rec);
        this.busy = false;
        this.commit(rec);
        if (!this.summary) this.refresh();
      }, 0));
    }
    moveFields(rec) {
      return {
        move_no: this.c.moves, target: rec.target, cls: rec.cls,
        exact: rec.exact, partial: rec.partial,
        cands_before: rec.candsBefore, cands_after: rec.candsAfter,
        consistent: rec.consistent ? 1 : 0,
        info_expected: r4(rec.infoExpected), info_best: r4(rec.infoBest), info_actual: r4(rec.infoActual),
        best_try: rec.bestTry || '',
      };
    }
    verdictExtra(rec) {
      if (rec.solved) return '';
      return rec.consistent ? '' : ' · it did not fit earlier clues';
    }
    showHint(hint) {
      const n = hint.count;
      const v = this.verdictEl;
      v.className = 'verdict show info';
      v.textContent = n === 1 ? 'Only one code fits your clues' : n + ' codes still fit your clues';
      clearTimeout(this.verdictTimer);
      this.verdictTimer = this.later(() => { v.className = 'verdict'; }, 2600);
    }
    onResolved() { this.refresh(); }
    extraSnapshot() { return { draft: this.draft.slice() }; }
    onKey(e) {
      if (this.summary) return false;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= this.p.C) { this.put(n - 1); return true; }
      if (e.key === 'Backspace') {
        let k = -1;
        this.draft.forEach((d, i) => { if (d != null) k = i; });
        if (k >= 0) this.clearSlot(k);
        return true;
      }
      if (e.key === 'Enter') { this.submit(); return true; }
      return false;
    }
  }

  function makeCard(app, spec, puzzle, snap) {
    if (spec.game === 'outbound') return new OutboundCard(app, spec, puzzle, snap);
    if (spec.game === 'conduit') return new ConduitCard(app, spec, puzzle, snap);
    return new TumblerCard(app, spec, puzzle, snap);
  }

  // ============================================================ export
  const EVENT_COLS = ['session_id', 'participant', 'condition', 'session_kind', 'session_seed', 'app_version', 'event_index', 'event', 'wall_time', 't_session_ms', 'seq', 'block', 'puzzle_id', 'puzzle_seed', 'game', 'level', 'adaptive', 't_ms', 'move_no', 'target', 'from', 'to', 'd_before', 'd_after', 'cls', 'exact', 'partial', 'cands_before', 'cands_after', 'consistent', 'info_expected', 'info_best', 'info_actual', 'best_try', 'detail'];
  const PUZZLE_COLS = ['session_id', 'participant', 'condition', 'session_kind', 'session_seed', 'app_version', 'seq', 'block', 'in_block', 'puzzle_id', 'puzzle_seed', 'game', 'level', 'adaptive', 'params', 'outcome', 'success', 'started_at', 'ended_at', 'duration_ms', 'first_move_ms', 'hidden_ms', 'moves', 'reference', 'par', 'efficiency', 'n_optimal', 'n_wasted', 'n_dead_end', 'n_in_dead_end', 'n_blocked', 'n_undo', 'n_restart', 'n_hint', 'n_suboptimal', 'n_zero_info', 'n_inconsistent', 'mean_info_ratio', 'level_next', 'features'];

  function sessionFields(S) {
    return { session_id: S.id, participant: S.participant, condition: S.condition, session_kind: S.kind, session_seed: S.seed, app_version: S.app_version };
  }
  function csv(cols, rows) {
    const esc = (v) => {
      if (v == null) return '';
      const t = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    };
    return [cols.join(',')].concat(rows.map((r) => cols.map((c) => esc(r[c])).join(','))).join('\r\n') + '\r\n';
  }
  function eventsCSV(list) {
    const rows = [];
    for (const S of list) {
      const base = sessionFields(S);
      for (const e of S.events) rows.push(Object.assign({}, base, e, { event_index: e.i }));
    }
    return csv(EVENT_COLS, rows);
  }
  function puzzlesCSV(list) {
    const rows = [];
    for (const S of list) {
      const base = sessionFields(S);
      for (const p of S.puzzles) rows.push(Object.assign({}, base, p));
    }
    return csv(PUZZLE_COLS, rows);
  }
  function exportJSON(list) {
    return JSON.stringify({
      app: 'Puzzle Reel', app_version: APP_VERSION, engine_version: E.version, exported_at: new Date().toISOString(),
      sessions: list.map((S) => {
        const out = Object.assign({}, S);
        delete out.live; delete out.hasMoves; delete out.t0wall;
        return out;
      }),
    }, null, 1);
  }
  function codebookMarkdown() {
    const lv = (g) => Object.keys(E.games[g].levels).map((k) => {
      const L = E.games[g].levels[k];
      const desc = E.games[g].describe(Object.assign({}, L, { cars: { length: L.cars } }));
      const extra = g === 'outbound' ? ', ' + (L.traps || 0) + ' planted trap' + (L.traps === 1 ? '' : 's') : g === 'tumbler' ? ', ' + L.max + ' tries' : '';
      return '- L' + k + ': ' + desc + extra;
    }).join('\n');
    const lines = [
      '# Puzzle Reel codebook (app ' + APP_VERSION + ', engines ' + E.version + ')', '',
      'Every puzzle is generated from (session seed, block, game, level, occurrence). The same seed and plan produce the same puzzles on any device.', '',
      '## Event columns', '',
    ].concat(CODEBOOK.events.map((r) => '- `' + r[0] + '`: ' + r[1]), ['', '## Puzzle columns', ''], CODEBOOK.puzzles.map((r) => '- `' + r[0] + '`: ' + r[1]), ['', '## Move labels (`cls`)', ''],
      Object.keys(CODEBOOK.classes).map((g) => '- ' + E.games[g].name + ': ' + CODEBOOK.classes[g]),
      ['', '## Tumbler colors', '', CODEBOOK.colors, '', '## Levels', '', '### Outbound', lv('outbound'), 'L3 to L5 contain planted traps; difficulty is set by the chance that random tapping clears the lot (feature `p_random_solve`).', '', '### Conduit', lv('conduit'), 'L4 and L5 keep the board that needs the most search beyond local edge rules out of 8 candidates.', '', '### Tumbler', lv('tumbler'), '', '## Adaptive blocks', '', 'Per game within a block: two successes in a row move up one level, one miss moves down one level (2-up/1-down staircase, levels 1 to 5). A success is a solve with `moves <= par`, where par = ceil(reference x par multiplier).', '']);
    return lines.join('\n');
  }
  const CODEBOOK = {
    events: [
      ['session_id', 'random id for one sitting'],
      ['participant / condition', 'as typed in session setup'],
      ['session_kind', 'study or free (free play)'],
      ['session_seed', 'seed that, with the plan, fixes every puzzle'],
      ['event_index', 'order of the event within the session'],
      ['event', 'session_start, puzzle_start, move, blocked, undo, restart, hint, hidden, visible, puzzle_end, level_change, resume, session_end'],
      ['wall_time / t_session_ms', 'clock time, and ms since the session started'],
      ['seq / block', 'puzzle number in the session, and its block'],
      ['puzzle_id', 'B{block}-{game}-L{level}-{occurrence}; the same id and seed mean the same puzzle'],
      ['t_ms', 'ms since this puzzle appeared (Tumbler: when the try was submitted)'],
      ['move_no', 'state-changing moves so far in this puzzle, including moves later undone'],
      ['target', 'Outbound: car id (c1...). Conduit: tile r{row}c{col}. Tumbler: the try as letters'],
      ['from / to', 'Outbound: cells driven forward from the start position, or exit. Conduit: quarter turns clockwise away from the solved orientation'],
      ['d_before / d_after', 'fewest moves still needed (Outbound) or turns still needed (Conduit) before and after; inf = the puzzle can no longer be solved'],
      ['cls', 'move label, see below'],
      ['exact / partial', 'Tumbler feedback: right color right spot, right color wrong spot'],
      ['cands_before / cands_after', 'Tumbler: codes consistent with all clues before and after the try'],
      ['consistent', 'Tumbler: 1 if the try could still have been the code'],
      ['info_expected / info_best / info_actual', 'Tumbler, in bits: expected information of the try, of the most informative possible try, and information actually gained'],
      ['best_try', 'Tumbler: one most informative try at that point'],
      ['detail', 'JSON or text with extra context (puzzle features at puzzle_start, hidden time at visible)'],
    ],
    puzzles: [
      ['params', 'board description'],
      ['outcome', 'solved, failed, skipped, timeout, abandoned'],
      ['success', '1 if solved with moves <= par (drives adaptive levels)'],
      ['duration_ms / first_move_ms / hidden_ms', 'time on the puzzle, time to first move, time the page was hidden'],
      ['moves', 'Outbound: car moves that changed the lot. Conduit: turns. Tumbler: tries'],
      ['reference', 'Outbound: fewest moves. Conduit: fewest turns. Tumbler: tries used by the most-informative-try solver for this code'],
      ['par / efficiency', 'ceil(reference x multiplier); reference / moves (Tumbler can exceed 1 by luck)'],
      ['n_*', 'counts of each move label and of undo, restart, hint; blank when it does not apply to the game'],
      ['mean_info_ratio', 'Tumbler: mean of info_expected / info_best over tries'],
      ['level_next', 'adaptive blocks: this game\'s level for its next puzzle'],
      ['features', 'solver-derived puzzle features (JSON), e.g. p_random_solve, dead_end_states, search_nodes, solver_path'],
    ],
    classes: {
      outbound: 'optimal (one step closer), wasted (no closer, still solvable), dead_end (the lot can no longer be cleared), in_dead_end (a move made while already in a dead end), blocked (the car could not move; logged as its own event)',
      conduit: 'optimal (the tile needed that turn), wasted (the tile was already right)',
      tumbler: 'optimal (as informative as the best possible try), suboptimal (less informative), zero_info (could not narrow the codes), solved (the winning try); consistency is in its own column',
    },
    colors: 'Letters in Tumbler logs: A red (circle), B blue (square), C yellow (triangle), D green (diamond), E purple (plus), F orange (star), G teal (bar). Keys 1 to 7 enter them in order.',
  };

  let downloadsReady = Promise.resolve(null);
  async function saveFile(filename, data) {
    let dl = null;
    try { dl = await downloadsReady; } catch (e) { dl = null; }
    if (dl) {
      try {
        await dl.save({ filename, data });
        toast('Saved ' + filename);
        return;
      } catch (e) {
        const code = e && e.code;
        if (code === 'declined') { toast('Save cancelled'); return; }
        if (code === 'rate_limited') { toast('Another save is waiting for your answer'); return; }
      }
    }
    // A self-hosted copy (no claude.ai viewer around it) can use a normal browser download.
    if (!window.claude) {
      try {
        const type = /\.json$/.test(filename) ? 'application/json' : /\.md$/.test(filename) ? 'text/markdown' : 'text/csv';
        const url = URL.createObjectURL(new Blob([data], { type: type + ';charset=utf-8' }));
        const a = h('a', { href: url, download: filename, hidden: true });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        toast('Saved ' + filename);
        return;
      } catch (e) { /* fall back to the copy box */ }
    }
    showCopy(filename, data);
  }
  function showCopy(filename, data) {
    const ta = h('textarea', { class: 'copybox', readonly: true, id: 'copybox', 'aria-label': filename });
    ta.value = data;
    const copyBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => {
      const done = () => toast('Copied ' + filename);
      const select = () => { ta.focus(); ta.select(); toast('Selected. Copy it with your keyboard or menu.'); };
      try { navigator.clipboard.writeText(data).then(done, select); } catch (e) { select(); }
    } }, 'Copy');
    openSheet('Copy data', [
      h('p', { class: 'empty-state', text: 'Saving files is not available here. Copy the contents and paste them into a file named ' + filename + '.' }),
      ta,
    ], [copyBtn]);
  }

  // ============================================================ sheets
  let escHandler = null;
  function openSheet(title, body, foot) {
    closeSheet();
    const layer = $('#layer');
    const back = h('div', { class: 'sheet-backdrop', onclick: closeSheet });
    const sheet = h('section', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'sheet-head' }, h('h2', { text: title }), h('button', { class: 'btn', type: 'button', onclick: closeSheet }, 'Close')),
      h('div', { class: 'sheet-body' }, body),
      foot ? h('div', { class: 'sheet-foot' }, foot) : null);
    layer.append(back, sheet);
    escHandler = (e) => { if (e.key === 'Escape') closeSheet(); };
    document.addEventListener('keydown', escHandler);
    const first = sheet.querySelector('input, select, textarea, .sheet-body button');
    if (first) setTimeout(() => { try { first.focus({ preventScroll: true }); } catch (e) { /* optional */ } }, 30);
    return sheet;
  }
  function closeSheet() {
    $('#layer').textContent = '';
    if (escHandler) document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
  const sheetOpen = () => !!$('#layer').firstChild;

  function holdButton(label, onDone) {
    const b = h('button', { class: 'btn hold danger', type: 'button', 'aria-label': label + ' (press and hold)' }, h('span', { class: 'fill' }), h('span', { style: 'position:relative', text: label }));
    let timer = null;
    const start = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      if (timer) return;
      b.classList.add('holding');
      timer = setTimeout(() => { timer = null; b.classList.remove('holding'); onDone(); }, 1200);
    };
    const cancel = () => { clearTimeout(timer); timer = null; b.classList.remove('holding'); };
    b.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel', 'keyup', 'blur'].forEach((ev) => b.addEventListener(ev, cancel));
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') start(e); });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  }

  // =============================================================== app
  const App = {
    session: null,
    card: null,
    current: null,
    busy: false,
    saveTimer: null,
    warnedStorage: false,

    boot(data) {
      Gen.init();
      try {
        if (window.claude && typeof window.claude.use === 'function') downloadsReady = window.claude.use('downloads').catch(() => null);
      } catch (e) { downloadsReady = Promise.resolve(null); }
      this.bindGlobal();
      if (data && data.v === 1 && data.session) { this.restore(data.session, data.card, 'page update'); return; }
      const activeId = store.get('pr1.active', null);
      const S = activeId ? Sessions.load(activeId) : null;
      if (S && S.kind === 'study' && S.status === 'active') { this.showResume(S); return; }
      this.startFree(true);
    },

    // ---------- sessions
    startFree(first) {
      this.closeCurrent();
      const S = newSession('free', { seed: randomSeed(), participant: '', condition: '', options: FREE_OPTIONS, blocks: [{ game: 'mixed', count: FREE_COUNT, level: 2, adaptive: true }] });
      this.session = S;
      this.logEvent({ event: 'session_start', detail: JSON.stringify({ options: S.options, blocks: S.blocks }) });
      Sessions.prune();
      this.advance(first);
    },
    startStudy(setup) {
      this.closeCurrent();
      const S = newSession('study', setup);
      this.session = S;
      store.set('pr1.active', S.id);
      this.logEvent({ event: 'session_start', detail: JSON.stringify({ options: S.options, blocks: S.blocks }) });
      this.save();
      this.advance(false);
    },
    closeCurrent() {
      const S = this.session;
      if (!S) return;
      if (this.card && !this.card.summary) this.card.resolve('abandoned');
      if (S.status === 'active') {
        S.status = S.kind === 'free' ? 'closed' : 'ended_early';
        S.endedAt = new Date().toISOString();
        this.logEvent({ event: 'session_end', detail: S.status });
      }
      S.live = null;
      if (S.kind === 'study') store.del('pr1.active');
      this.save();
      if (this.card) this.card.destroy();
      this.card = null;
    },
    finish(status) {
      const S = this.session;
      if (!S || S.status !== 'active') return;
      if (this.card && !this.card.summary) this.card.resolve('abandoned');
      S.status = status;
      S.endedAt = new Date().toISOString();
      this.logEvent({ event: 'session_end', detail: status });
      S.live = null;
      if (S.kind === 'study') store.del('pr1.active');
      this.save();
      if (this.card) this.card.destroy();
      this.card = null;
      this.showEnd();
    },
    isLast(spec) {
      const S = this.session;
      return S.kind === 'study' && spec.seq >= seqTotal(S.seq);
    },

    // ---------- puzzle flow
    next() {
      if (this.busy) return;
      if (this.card && !this.card.summary) return;
      this.advance(false);
    },
    async advance(first) {
      const S = this.session;
      if (!S || S.status !== 'active') return;
      const spec = seqNext(S.seq);
      if (!spec) { this.finish('complete'); return; }
      await this.show(spec, null, first);
    },
    async show(spec, snap, first) {
      this.busy = true;
      try {
        let p = Gen.peek(spec.game, spec.level, spec.seed);
        if (!p && first) {
          try { p = Gen.sync(spec.game, spec.level, spec.seed); } catch (e) { p = null; }
        }
        if (!p) {
          this.swap(h('article', { class: 'card' }, h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Setting up the next puzzle')));
          p = await Gen.get(spec.game, spec.level, spec.seed);
        }
        if (this.card) this.card.destroy();
        const card = makeCard(this, spec, p, snap);
        this.card = card;
        this.swap(card.el);
        if (snap) {
          this.logPuzzle(card, 'resume', { move_no: card.c.moves });
          card.startTimer();
        } else {
          card.start();
        }
        this.prefetch(spec);
        this.renderBar();
        this.touch(true);
      } catch (e) {
        this.swap(h('article', { class: 'card panel-card' }, h('h2', { text: 'Could not set up the puzzle' }), h('p', { text: String(e && e.message || e) }), h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => this.advance(false) }, 'Try the next one'))));
      } finally {
        this.busy = false;
      }
    },
    prefetch(spec) {
      const S = this.session;
      const outcomes = spec.adaptive ? [true, false] : [true];
      for (const ok of outcomes) {
        const c = clone(S.seq);
        seqRecord(c, spec, ok);
        const nx = seqNext(c);
        if (nx) Gen.get(nx.game, nx.level, nx.seed).catch(() => {});
      }
    },
    onPuzzleEnd(card, sm) {
      const S = this.session, sp = card.spec;
      const change = seqRecord(S.seq, sp, sm.success);
      const level_next = sp.adaptive && change ? change.to : '';
      this.logPuzzle(card, 'puzzle_end', { move_no: card.c.moves, cls: sm.outcome, detail: JSON.stringify({ success: sm.success, moves: sm.moves, par: sm.par, reference: sm.reference }) });
      if (change && change.changed) this.logPuzzle(card, 'level_change', { from: change.from, to: change.to });
      const c = card.c, applies = APPLIES[sp.game];
      const n = (k) => (applies.indexOf(k) >= 0 ? c[k] : '');
      S.puzzles.push({
        seq: sp.seq, block: sp.block, in_block: sp.inBlock, puzzle_id: sp.id, puzzle_seed: card.p.seed,
        game: sp.game, level: sp.level, adaptive: sp.adaptive ? 1 : 0, params: card.G.describe(card.p),
        outcome: sm.outcome, success: sm.success ? 1 : 0, started_at: card.startedAt, ended_at: new Date().toISOString(),
        duration_ms: sm.duration_ms, first_move_ms: sm.first_move_ms == null ? '' : sm.first_move_ms, hidden_ms: sm.hidden_ms,
        moves: sm.moves, reference: sm.reference, par: sm.par, efficiency: sm.efficiency,
        n_optimal: n('optimal'), n_wasted: n('wasted'), n_dead_end: n('dead_end'), n_in_dead_end: n('in_dead_end'),
        n_blocked: n('blocked'), n_undo: n('undo'), n_restart: n('restart'), n_hint: n('hint'),
        n_suboptimal: n('suboptimal'), n_zero_info: n('zero_info'), n_inconsistent: n('inconsistent'),
        mean_info_ratio: sp.game === 'tumbler' && c.infoRatioN ? r4(c.infoRatioSum / c.infoRatioN) : '',
        level_next,
        features: JSON.stringify(card.p.features),
      });
      this.renderBar();
      this.touch(true);
      return { level_next, change };
    },

    // ---------- logging & persistence
    logEvent(fields) {
      const S = this.session;
      if (!S) return;
      const e = Object.assign({ i: S.events.length + 1, wall_time: new Date().toISOString(), t_session_ms: Date.now() - S.t0wall }, fields);
      S.events.push(e);
    },
    logPuzzle(card, event, fields) {
      const sp = card.spec;
      this.logEvent(Object.assign({
        event, seq: sp.seq, block: sp.block, puzzle_id: sp.id, puzzle_seed: card.p.seed,
        game: sp.game, level: sp.level, adaptive: sp.adaptive ? 1 : 0, t_ms: Math.round(card.elapsed()),
      }, fields));
    },
    touch(now_) {
      clearTimeout(this.saveTimer);
      if (now_) this.save();
      else this.saveTimer = setTimeout(() => this.save(), 500);
    },
    save() {
      const S = this.session;
      if (!S) return;
      if (S.kind === 'free' && !S.hasMoves) return;
      S.live = this.card && S.status === 'active' ? this.card.snapshot() : null;
      const ok = Sessions.save(S);
      if (!ok && !this.warnedStorage) {
        this.warnedStorage = true;
        toast('This browser is not keeping data between visits. Save your data before closing.', 5000);
      }
    },
    snapshot() {
      return { v: 1, session: this.session, card: this.card && this.session && this.session.status === 'active' ? this.card.snapshot() : null };
    },
    async restore(S, cardSnap, reason) {
      this.session = S;
      if (S.t0wall == null) S.t0wall = Date.parse(S.startedAt) || Date.now();
      if (S.status !== 'active') { this.renderBar(); this.showEnd(); return; }
      if (S.kind === 'study') store.set('pr1.active', S.id);
      this.logEvent({ event: 'resume', detail: reason });
      if (cardSnap && cardSnap.spec) await this.show(cardSnap.spec, cardSnap, false);
      else await this.advance(false);
    },

    // ---------- views
    swap(el) {
      const stage = $('#stage');
      const olds = Array.from(stage.children).filter((c) => c !== el && !c.dataset.leaving);
      stage.append(el);
      const quiet = reducedMotion() || !olds.length || typeof el.animate !== 'function';
      for (const old of olds) {
        old.dataset.leaving = '1';
        if (quiet) { old.remove(); continue; }
        const a = old.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-48px)', opacity: 0 }], { duration: 240, easing: 'ease-in' });
        a.onfinish = () => old.remove();
        setTimeout(() => old.remove(), 600);
      }
      if (!quiet) el.animate([{ transform: 'translateY(56px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
    },
    renderBar() {
      const chip = $('#chip'), act = $('#bar-actions');
      act.textContent = '';
      const S = this.session;
      const studyLive = !!(S && S.kind === 'study' && S.status === 'active');
      $('#bar').className = 'bar ' + (studyLive ? 'study' : 'free');
      if (studyLive) {
        const total = seqTotal(S.seq);
        const at = this.card ? this.card.spec.seq : S.seq.n;
        chip.className = 'chip study';
        chip.textContent = (S.participant || 'Participant') + ' · ' + at + ' of ' + total;
        act.append(holdButton('Hold to end', () => this.finish('ended_early')));
      } else {
        chip.className = 'chip';
        chip.textContent = S && S.kind === 'study' ? (S.participant || 'Session') + ' · finished' : 'Free play';
        act.append(
          h('button', { class: 'btn', type: 'button', onclick: () => this.openData() }, 'Data'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => this.openSetup() }, 'Session'));
      }
    },
    showEnd() {
      const S = this.session;
      const solved = S.puzzles.filter((p) => p.outcome === 'solved').length;
      const atPar = S.puzzles.filter((p) => p.success === 1).length;
      const total = S.puzzles.reduce((a, p) => a + (p.duration_ms || 0), 0);
      const done = S.status === 'complete';
      const name = (S.participant || 'participant').replace(/[^A-Za-z0-9_-]+/g, '_');
      const panel = h('article', { class: 'card panel-card' },
        h('h2', { text: done ? 'Session complete' : 'Session ended' }),
        h('p', { text: done ? 'Thank you. All puzzles in the plan are done.' : 'The session was stopped before the end of the plan. Everything up to now is saved on this device.' }),
        h('div', { class: 'kv' },
          h('div', null, h('span', { text: 'Puzzles' }), h('b', { text: String(S.puzzles.length) })),
          h('div', null, h('span', { text: 'Solved' }), h('b', { text: String(solved) })),
          h('div', null, h('span', { text: 'At or under par' }), h('b', { text: String(atPar) })),
          h('div', null, h('span', { text: 'Time on puzzles' }), h('b', { text: clock(total) }))),
        h('p', { class: 'summary-line', text: (S.participant || '') + (S.condition ? ' · ' + S.condition : '') + ' · seed ' + S.seed + ' · ' + S.events.length + ' events' }),
        h('div', { class: 'row', style: 'display:flex;gap:8px;flex-wrap:wrap' },
          h('button', { class: 'btn', type: 'button', onclick: () => saveFile('puzzle-reel_events_' + name + '_' + stamp() + '.csv', eventsCSV([S])) }, 'Save moves (CSV)'),
          h('button', { class: 'btn', type: 'button', onclick: () => saveFile('puzzle-reel_puzzles_' + name + '_' + stamp() + '.csv', puzzlesCSV([S])) }, 'Save puzzles (CSV)'),
          h('button', { class: 'btn', type: 'button', onclick: () => saveFile('puzzle-reel_' + name + '_' + stamp() + '.json', exportJSON([S])) }, 'Save all (JSON)')),
        h('div', { class: 'row', style: 'display:flex;gap:8px;flex-wrap:wrap' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => this.openSetup({ participant: '', condition: S.condition, seed: S.seed, blocks: S.blocks, options: S.options }) }, 'Next participant'),
          h('button', { class: 'btn', type: 'button', onclick: () => this.startFree(false) }, 'Free play')));
      this.swap(panel);
      this.renderBar();
    },
    showResume(S) {
      this.session = null;
      const at = S.live && S.live.spec ? S.live.spec.seq : S.seq.n;
      const panel = h('article', { class: 'card panel-card' },
        h('h2', { text: 'Session in progress' }),
        h('p', { text: (S.participant || 'A participant') + ' stopped at puzzle ' + Math.max(at, 1) + ' of ' + seqTotal(S.seq) + '. Resume to pick up exactly where they were; the gap is logged.' }),
        h('div', { class: 'row', style: 'display:flex;gap:8px;flex-wrap:wrap' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => this.restore(S, S.live, 'reload') }, 'Resume session'),
          h('button', { class: 'btn danger', type: 'button', onclick: () => { this.restore(S, S.live, 'reload, then ended').then(() => this.finish('ended_early')); } }, 'End it')));
      this.swap(panel);
      $('#bar').className = 'bar study';
      $('#chip').className = 'chip study';
      $('#chip').textContent = (S.participant || 'Session') + ' · paused';
      $('#bar-actions').textContent = '';
    },

    // ---------- session setup
    openSetup(prefill) {
      const last = prefill || store.get('pr1.setup', null);
      const st = clone(last || { participant: '', condition: '', seed: randomSeed(), blocks: PRESETS[0].blocks, options: STUDY_OPTIONS });
      st.options = Object.assign({}, STUDY_OPTIONS, st.options || {});
      if (!st.blocks || !st.blocks.length) st.blocks = clone(PRESETS[0].blocks);
      const err = h('p', { class: 'error', role: 'alert', hidden: true });
      const sumLine = h('p', { class: 'summary-line' });
      const pid = h('input', { type: 'text', id: 'f-pid', autocomplete: 'off', spellcheck: 'false', value: st.participant || '', placeholder: 'e.g. P012' });
      const cond = h('input', { type: 'text', id: 'f-cond', autocomplete: 'off', value: st.condition || '', placeholder: 'optional, e.g. train-outbound' });
      const seed = h('input', { type: 'number', id: 'f-seed', inputmode: 'numeric', min: '1', step: '1', value: String(st.seed) });
      const plan = h('div', { class: 'plan' });
      const renderPlan = () => {
        plan.textContent = '';
        plan.append(h('div', { class: 'plan-row plan-head', 'aria-hidden': 'true' }, h('span'), h('span', { text: 'Game' }), h('span', { text: 'Puzzles' }), h('span', { text: 'Level' }), h('span', { text: 'Adaptive' }), h('span')));
        st.blocks.forEach((b, i) => {
          const game = h('select', { id: 'blk-' + i + '-game', 'aria-label': 'Block ' + (i + 1) + ' game' },
            ['mixed'].concat(ORDER).map((g) => h('option', { value: g, selected: b.game === g }, LABEL[g])));
          game.addEventListener('change', () => { b.game = game.value; updateSum(); });
          const count = h('input', { type: 'number', id: 'blk-' + i + '-count', min: '1', max: '200', step: '1', value: String(b.count), 'aria-label': 'Block ' + (i + 1) + ' puzzles' });
          count.addEventListener('input', () => { b.count = parseInt(count.value, 10) || 0; updateSum(); });
          const level = h('select', { id: 'blk-' + i + '-level', 'aria-label': 'Block ' + (i + 1) + (b.adaptive ? ' starting level' : ' level') },
            [1, 2, 3, 4, 5].map((l) => h('option', { value: String(l), selected: b.level === l }, 'L' + l)));
          level.addEventListener('change', () => { b.level = parseInt(level.value, 10); });
          const ad = h('input', { type: 'checkbox', id: 'blk-' + i + '-adapt', checked: !!b.adaptive, 'aria-label': 'Block ' + (i + 1) + ' adaptive' });
          ad.addEventListener('change', () => { b.adaptive = ad.checked; updateSum(); });
          const rm = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove block ' + (i + 1), disabled: st.blocks.length === 1, onclick: () => { st.blocks.splice(i, 1); renderPlan(); updateSum(); } }, '×');
          plan.append(h('div', { class: 'plan-row' }, h('span', { class: 'idx', text: String(i + 1) }), game, count, level, h('label', { class: 'check' }, ad), rm));
        });
        plan.append(h('div', { class: 'presets' },
          h('button', { class: 'btn', type: 'button', onclick: () => { st.blocks.push({ game: 'mixed', count: 3, level: 2, adaptive: false }); renderPlan(); updateSum(); } }, 'Add block')));
        plan.append(h('div', { class: 'presets' }, h('span', { class: 'help', style: 'align-self:center', text: 'Or start from:' }),
          PRESETS.map((pr) => h('button', { class: 'btn', type: 'button', onclick: () => { st.blocks = clone(pr.blocks); renderPlan(); updateSum(); } }, pr.name))));
      };
      const updateSum = () => {
        const n = st.blocks.reduce((a, b) => a + (b.count || 0), 0);
        const ad = st.blocks.filter((b) => b.adaptive).length;
        sumLine.textContent = n + ' puzzle' + (n === 1 ? '' : 's') + ' in ' + st.blocks.length + ' block' + (st.blocks.length === 1 ? '' : 's') + (ad ? ', ' + ad + ' adaptive' : '') + '.';
      };
      const opt = (key, id, text) => {
        const box = h('input', { type: 'checkbox', id, checked: !!st.options[key] });
        box.addEventListener('change', () => { st.options[key] = box.checked; });
        return h('label', { class: 'check', for: id }, box, text);
      };
      const par = h('input', { type: 'number', id: 'o-par', min: '1', max: '5', step: '0.1', value: String(st.options.par) });
      const limit = h('input', { type: 'number', id: 'o-limit', min: '0', max: '3600', step: '5', value: String(st.options.limit) });
      renderPlan();
      updateSum();
      const startBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => {
        st.participant = pid.value.trim();
        st.condition = cond.value.trim();
        st.seed = parseInt(seed.value, 10);
        st.options.par = parseFloat(par.value);
        st.options.limit = parseInt(limit.value, 10) || 0;
        const problems = [];
        if (!st.participant) problems.push('Enter a participant ID.');
        if (!(st.seed >= 1 && st.seed <= 4294967295)) problems.push('The seed must be a whole number from 1 to 4294967295.');
        if (st.blocks.some((b) => !(b.count >= 1 && b.count <= 200))) problems.push('Each block needs 1 to 200 puzzles.');
        if (!(st.options.par >= 1 && st.options.par <= 5)) problems.push('The par multiplier must be between 1 and 5.');
        if (st.options.limit < 0) problems.push('The time limit cannot be negative.');
        if (problems.length) { err.textContent = problems.join(' '); err.hidden = false; return; }
        const keep = clone(st);
        keep.participant = '';
        store.set('pr1.setup', keep);
        closeSheet();
        this.startStudy(st);
      } }, 'Start session');
      openSheet('New session', [
        h('fieldset', null, h('legend', { text: 'Participant' }),
          h('div', { class: 'fields' },
            h('div', { class: 'field' }, h('label', { for: 'f-pid', text: 'Participant ID' }), pid, h('span', { class: 'help', text: 'Use a code, not a name.' })),
            h('div', { class: 'field' }, h('label', { for: 'f-cond', text: 'Condition' }), cond))),
        h('fieldset', null, h('legend', { text: 'Puzzles' }),
          h('div', { class: 'field' }, h('label', { for: 'f-seed', text: 'Seed' }),
            h('div', { class: 'inline' }, seed, h('button', { class: 'btn', type: 'button', onclick: () => { seed.value = String(randomSeed()); } }, 'New seed')),
            h('span', { class: 'help', text: 'Everyone with the same seed and plan gets the same puzzles in fixed blocks, and the same puzzle at each level in adaptive blocks.' })),
          h('div', { class: 'field' }, h('span', { class: 'lbl', text: 'Plan' }), plan, sumLine,
            h('span', { class: 'help', text: 'All three rotates Outbound, Conduit and Tumbler. Adaptive blocks start at the chosen level, go up after 2 solves at or under par in a row, and down after a miss.' }))),
        h('fieldset', null, h('legend', { text: 'What participants see' }),
          h('div', { class: 'checks' },
            opt('feedback', 'o-feedback', 'Move feedback (best, extra, dead end)'),
            opt('hints', 'o-hints', 'Hint button'),
            opt('undo', 'o-undo', 'Undo and restart'),
            opt('skip', 'o-skip', 'Skipping'),
            opt('counter', 'o-counter', 'Move count, par and timer')),
          h('div', { class: 'fields' },
            h('div', { class: 'field' }, h('label', { for: 'o-par', text: 'Par multiplier' }), par, h('span', { class: 'help', text: 'Par = solver’s moves × this, rounded up.' })),
            h('div', { class: 'field' }, h('label', { for: 'o-limit', text: 'Time limit per puzzle (s)' }), limit, h('span', { class: 'help', text: '0 means no limit.' })))),
        err,
      ], [h('p', { class: 'note', text: 'Data stays on this device until you save it from Data.' }), startBtn]);
    },

    // ---------- data
    openData() {
      this.save();
      const all = Sessions.all();
      let includeFree = false;
      const body = h('div', { style: 'display:flex;flex-direction:column;gap:16px' });
      const render = () => {
        body.textContent = '';
        const list = all.filter((S) => includeFree || S.kind === 'study');
        const nP = list.reduce((a, S) => a + S.puzzles.length, 0);
        const nE = list.reduce((a, S) => a + S.events.length, 0);
        body.append(h('div', { class: 'stats-row' },
          h('div', null, h('b', { text: String(list.length) }), 'sessions'),
          h('div', null, h('b', { text: String(nP) }), 'puzzles'),
          h('div', null, h('b', { text: String(nE) }), 'logged events')));
        const freeBox = h('input', { type: 'checkbox', id: 'd-free', checked: includeFree });
        freeBox.addEventListener('change', () => { includeFree = freeBox.checked; render(); });
        body.append(h('label', { class: 'check', for: 'd-free' }, freeBox, 'Include free play'));
        if (!list.length) {
          body.append(h('p', { class: 'empty-state', text: includeFree ? 'Nothing logged on this device yet. Play a puzzle or start a session.' : 'No study sessions on this device yet. Start one with New session; free play is logged too if you include it.' }));
        } else {
          const rows = list.map((S) => h('tr', null,
            h('td', { text: S.kind === 'study' ? (S.participant || '—') : 'Free play' }),
            h('td', { text: S.condition || '' }),
            h('td', { text: new Date(S.startedAt).toLocaleString() }),
            h('td', { class: 'num', text: String(S.puzzles.length) }),
            h('td', { text: S.status === 'complete' ? 'Complete' : S.status === 'active' ? 'In progress' : S.status === 'ended_early' ? 'Ended early' : 'Closed' }),
            h('td', { class: 'num', text: String(S.seed) })));
          body.append(h('div', { class: 'table-wrap' }, h('table', null,
            h('thead', null, h('tr', null, ['Participant', 'Condition', 'Started', 'Puzzles', 'Status', 'Seed'].map((t) => h('th', { text: t })))),
            h('tbody', null, rows))));
          body.append(h('div', { class: 'row', style: 'display:flex;gap:8px;flex-wrap:wrap' },
            h('button', { class: 'btn primary', type: 'button', onclick: () => saveFile('puzzle-reel_events_' + stamp() + '.csv', eventsCSV(list)) }, 'Save moves (CSV)'),
            h('button', { class: 'btn', type: 'button', onclick: () => saveFile('puzzle-reel_puzzles_' + stamp() + '.csv', puzzlesCSV(list)) }, 'Save puzzles (CSV)'),
            h('button', { class: 'btn', type: 'button', onclick: () => saveFile('puzzle-reel_' + stamp() + '.json', exportJSON(list)) }, 'Save all (JSON)')));
        }
        const cb = h('details', null, h('summary', { class: 'lbl', text: 'What the columns mean' }),
          h('div', { style: 'display:flex;flex-direction:column;gap:6px;margin-top:10px;font-size:13px' },
            CODEBOOK.events.concat(CODEBOOK.puzzles).map((r) => h('p', { style: 'margin:0' }, h('code', { text: r[0] }), ' ', r[1])),
            Object.keys(CODEBOOK.classes).map((g) => h('p', { style: 'margin:0' }, h('strong', { text: E.games[g].name + ' labels: ' }), CODEBOOK.classes[g])),
            h('p', { style: 'margin:0', text: CODEBOOK.colors }),
            h('div', null, h('button', { class: 'btn', type: 'button', onclick: () => saveFile('puzzle-reel_codebook.md', codebookMarkdown()) }, 'Save codebook'))));
        body.append(cb);
        if (all.length) {
          const zone = h('div', { class: 'confirm', hidden: true },
            h('p', { style: 'margin:0', text: 'This removes ' + all.length + ' session' + (all.length === 1 ? '' : 's') + ' from this device, free play included. Save first if you need them.' }),
            h('div', { class: 'row', style: 'display:flex;gap:8px' },
              h('button', { class: 'btn danger', type: 'button', onclick: () => {
                Sessions.clear();
                if (this.session && this.session.kind === 'free') { this.session.events = []; this.session.puzzles = []; this.session.hasMoves = false; }
                closeSheet();
                toast('Deleted all data on this device');
              } }, 'Delete everything'),
              h('button', { class: 'btn', type: 'button', onclick: () => { zone.hidden = true; } }, 'Keep it')));
          body.append(h('div', null, h('button', { class: 'btn danger', type: 'button', onclick: () => { zone.hidden = false; } }, 'Delete data on this device')), zone);
        }
      };
      render();
      openSheet('Data', [body], [h('p', { class: 'note', text: 'Data is stored in this browser only. Save it before clearing browser data or switching devices.' })]);
    },

    // ---------- global input
    bindGlobal() {
      const stage = $('#stage');
      let sw = null;
      stage.addEventListener('pointerdown', (e) => { sw = { x: e.clientX, y: e.clientY, t: now() }; }, { passive: true });
      stage.addEventListener('pointercancel', () => { sw = null; }, { passive: true });
      stage.addEventListener('pointerup', (e) => {
        if (!sw) return;
        const dx = e.clientX - sw.x, dy = e.clientY - sw.y, dt = now() - sw.t;
        sw = null;
        if (dy < -70 && Math.abs(dx) < 70 && dt < 800 && this.card && this.card.summary) this.next();
      }, { passive: true });
      document.addEventListener('keydown', (e) => {
        if (sheetOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        if (tag === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
        const c = this.card;
        if (!c) return;
        if (c.summary) {
          if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); this.next(); }
          return;
        }
        if (c.onKey(e)) e.preventDefault();
      });
      document.addEventListener('visibilitychange', () => {
        const c = this.card;
        if (document.visibilityState === 'hidden') {
          if (c && !c.summary && c.hiddenAt == null) { c.hiddenAt = now(); this.logPuzzle(c, 'hidden', {}); }
          this.save();
        } else if (c && !c.summary && c.hiddenAt != null) {
          const d = now() - c.hiddenAt;
          c.hiddenMs += d;
          c.hiddenAt = null;
          this.logPuzzle(c, 'visible', { detail: String(Math.round(d)) });
          this.touch();
        }
      });
      window.addEventListener('pagehide', () => this.save());
    },
  };

  // hot updates keep an in-progress session when a new version is published
  try {
    if (window.claude && window.claude.hot && typeof window.claude.hot.snapshot === 'function') window.claude.hot.snapshot(() => App.snapshot());
  } catch (e) { /* optional */ }
  const start = (data) => App.boot(data || {});
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.ready === 'function') hot.ready(start);
  else start(hot && hot.data ? hot.data : {});
  window.PuzzleReel = { App, Gen, seqInit, seqNext, seqRecord, eventsCSV, puzzlesCSV, codebookMarkdown };
})();
