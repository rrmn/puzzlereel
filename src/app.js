(function () {
  'use strict';
  const E = window.Engines;
  const APP_VERSION = '2.4.0';
  const ORDER = E.order;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const FREE_COUNT = 1000000;
  const LABEL = { mixed: 'All games', outbound: 'Outbound', conduit: 'Conduit', tumbler: 'Tumbler', glimpse: 'Glimpse' };

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
    const t = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  }
  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }
  function uid() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function randomSeed() { return Math.floor(Math.random() * 900000000) + 100000000; }
  const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

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

  // ------------------------------------------------------------------ icons
  const ICONS = {
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    restart: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 3.5V9H9"/>',
    hint: '<path d="M9 18h6M10.2 21.5h3.6"/><path d="M12 2.6a6.4 6.4 0 0 0-3.7 11.6c.6.5.9 1.1.9 1.9V17h5.6v-.9c0-.8.3-1.4.9-1.9A6.4 6.4 0 0 0 12 2.6z"/>',
    skip: '<path d="M5.5 5.5 15 12l-9.5 6.5z"/><path d="M18.5 5.5v13"/>',
    next: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    swap: '<path d="M6 8.5h12M15 5.5l3 3-3 3"/><path d="M18 15.5H6M9 12.5l-3 3 3 3"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    tapped: '<path d="M9.5 11.5V5.2a1.7 1.7 0 0 1 3.4 0v5.6"/><path d="M12.9 10.2V9a1.7 1.7 0 0 1 3.4 0v2.2"/><path d="M16.3 10.8a1.7 1.7 0 0 1 3.2.8v3.2a6.7 6.7 0 0 1-6.7 6.7h-.6a6.6 6.6 0 0 1-5.2-2.5l-3-3.8a1.7 1.7 0 0 1 2.6-2.2l2.4 2.4"/>',
    sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8"/><path d="M12 17.2v.1"/>',
    flask: '<path d="M9 3h6M10 3v6.2L4.8 18.1A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.9L14 9.2V3"/><path d="M7.5 14.5h9"/>',
    chart: '<path d="M5 20V11M11 20V5M17 20v-7"/><path d="M3 20h18"/>',
    save: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
    key: '<circle cx="8" cy="15" r="4.2"/><path d="m11 12 8.5-8.5M16.2 6.8l2.2 2.2M13.6 9.4l2 2"/>',
    erase: '<path d="M21 5H9l-6 7 6 7h12z"/><path d="m12.5 9.5 5 5M17.5 9.5l-5 5"/>',
    play: '<path d="M7.5 5.5 18.5 12l-11 6.5z"/>',
    pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
    car: '<path d="M4 16.5V13l2-5.2A2 2 0 0 1 7.9 6.5h8.2a2 2 0 0 1 1.9 1.3L20 13v3.5z"/><path d="M4 13h16"/><circle cx="7.6" cy="16.6" r="1.7"/><circle cx="16.4" cy="16.6" r="1.7"/>',
    drop: '<path d="M12 3.2s6.2 6.6 6.2 11.2a6.2 6.2 0 0 1-12.4 0C5.8 9.8 12 3.2 12 3.2z"/>',
    sprout: '<path d="M12 21v-8"/><path d="M12 13c0-4.2 3-6.8 7.4-6.8 0 4.2-3 6.8-7.4 6.8zM12 15.2c0-3.6-2.6-5.7-6.2-5.7 0 3.6 2.6 5.7 6.2 5.7z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.6"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/><path d="M12 14.5v2.5"/>',
    star: '<path fill="currentColor" stroke="none" d="M12 2.4l2.95 6 6.6.95-4.78 4.66 1.13 6.57L12 17.48l-5.9 3.1 1.13-6.57L2.45 9.35l6.6-.95z"/>',
    flame: '<path fill="currentColor" stroke="none" d="M12.6 2.4c.7 3.3 5 5.5 5 10.4a5.6 5.6 0 0 1-11.2 0c0-2.8 1.5-4.4 2.8-5.6.2 1.8 1 3 2.3 3.7-.6-3.3.3-6.1 1.1-8.5z"/>',
    eye: '<path d="M2.4 12s3.6-6.6 9.6-6.6 9.6 6.6 9.6 6.6-3.6 6.6-9.6 6.6S2.4 12 2.4 12z"/><circle cx="12" cy="12" r="3.1"/>',
    bolt: '<path fill="currentColor" stroke="none" d="M13.6 2.2 4.8 13.4h6.1l-1.4 8.4 8.8-11.2h-6.1z"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  };
  const GAME_ICON = { outbound: 'car', conduit: 'drop', tumbler: 'lock', glimpse: 'eye', mixed: 'grid' };
  function icon(name, cls) {
    const el = document.createElementNS(SVGNS, 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', '2.2');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('aria-hidden', 'true');
    if (cls) el.setAttribute('class', cls);
    el.innerHTML = ICONS[name] || '';
    return el;
  }
  const HAND_SVG = '<svg viewBox="0 0 48 56" aria-hidden="true"><path d="M18 4c2.2 0 4 1.8 4 4v14.5l2.2-.6c1.9-.5 3.9.6 4.4 2.5l.1.4 1.9-.4c1.9-.4 3.8.7 4.3 2.6l.1.5 1.4-.3c2-.4 4 .9 4.4 2.9l.1.6V40c0 7.7-6.3 14-14 14h-2.5c-4.4 0-8.5-2.2-10.9-5.9L6.4 39.5c-1.2-1.9-.7-4.4 1.2-5.6 1.7-1.1 3.9-.8 5.2.7L14 36V8c0-2.2 1.8-4 4-4z" fill="#FFFFFF" stroke="#1F2230" stroke-width="2.6" stroke-linejoin="round"/><path d="M22 29v7M28.7 30v6M34.9 32v5" stroke="#1F2230" stroke-width="2" stroke-linecap="round" opacity="0.35"/></svg>';
  function pips(level, label) {
    const el = h('span', { class: 'pips', 'aria-label': label || 'Level ' + level, role: 'img' });
    for (let i = 1; i <= 5; i++) el.append(h('i', { class: i <= level ? 'on' : '' }));
    return el;
  }

  // ------------------------------------------------------------ sound + touch
  // Small synthesized sounds, no audio files. Off until the first tap.
  const Sound = {
    ctx: null, master: null, nbuf: null, on: true,
    ensure() {
      if (this.ctx) return this.ctx;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.32;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
      return this.ctx;
    },
    // iPhones only start audio from the end of a tap (touchend or click), and
    // only after a sound has started inside that tap, so this runs on every
    // tap until the context is running. It can also come back 'interrupted'.
    unlock() {
      if (!this.on) return;
      const c = this.ensure();
      if (!c || c.state === 'running') return;
      try {
        const src = c.createBufferSource();
        src.buffer = c.createBuffer(1, 1, c.sampleRate || 22050);
        src.connect(c.destination);
        src.start(0);
      } catch (e) { /* ignore */ }
      try { const r = c.resume(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignore */ }
    },
    tone(f0, f1, dur, type, gain, delay) {
      const c = this.ctx;
      if (!c || c.state !== 'running') return;
      const t = c.currentTime + (delay || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.3, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, f0, f1, q, gain, delay) {
      const c = this.ctx;
      if (!c || c.state !== 'running') return;
      const t = c.currentTime + (delay || 0);
      if (!this.nbuf) {
        const len = Math.floor(c.sampleRate * 0.6);
        this.nbuf = c.createBuffer(1, len, c.sampleRate);
        const d = this.nbuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = c.createBufferSource();
      src.buffer = this.nbuf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = q || 1.2;
      bp.frequency.setValueAtTime(f0, t);
      if (f1) bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp); bp.connect(g); g.connect(this.master);
      src.start(t); src.stop(t + dur + 0.05);
    },
    play(name, arg) {
      if (!this.on || !this.ctx) return;
      try { if (SFX[name]) SFX[name](this, arg); } catch (e) { /* sound is optional */ }
    },
  };
  const SFX = {
    vroom: (S) => { S.noise(0.45, 280, 1600, 1.4, 0.32); S.tone(90, 200, 0.4, 'sawtooth', 0.05); },
    roll: (S) => S.noise(0.24, 240, 620, 1.2, 0.2),
    bump: (S) => { S.tone(170, 70, 0.15, 'sine', 0.45); S.noise(0.05, 900, 400, 1, 0.1); },
    honk: (S) => { S.tone(440, 440, 0.08, 'triangle', 0.15); S.tone(370, 370, 0.1, 'triangle', 0.15, 0.09); },
    turn: (S) => { S.noise(0.035, 3000, 2000, 2, 0.15); S.tone(540, 610, 0.05, 'triangle', 0.1); },
    flow: (S) => { S.tone(420, 820, 0.15, 'sine', 0.13); S.tone(620, 1100, 0.12, 'sine', 0.07, 0.05); },
    bloom: (S, n) => S.tone(880 + (n || 0) * 70, 1320 + (n || 0) * 70, 0.17, 'sine', 0.15),
    pop: (S, c) => S.tone(520 + (c || 0) * 55, 780 + (c || 0) * 55, 0.08, 'sine', 0.22),
    unpop: (S) => S.tone(500, 300, 0.07, 'sine', 0.14),
    flip: (S, m) => S.tone(m === 2 ? 990 : m === 1 ? 740 : 330, m === 2 ? 1190 : m === 1 ? 770 : 290, 0.1, 'triangle', 0.18),
    win: (S) => [523, 659, 784, 1047].forEach((f, i) => S.tone(f, f, 0.24, 'triangle', 0.2, i * 0.09)),
    star: (S, i) => { const f = 990 * Math.pow(1.26, i || 0); S.tone(f, f * 1.01, 0.32, 'sine', 0.18); S.tone(f * 2, f * 2, 0.18, 'sine', 0.05, 0.02); },
    level: (S) => [659, 784, 988, 1319].forEach((f, i) => S.tone(f, f, 0.16, 'square', 0.05, i * 0.07)),
    fail: (S) => [392, 330, 247].forEach((f, i) => S.tone(f, f * 0.98, 0.24, 'triangle', 0.17, i * 0.14)),
    dead: (S) => S.tone(240, 105, 0.5, 'sawtooth', 0.06),
    hint: (S) => { S.tone(1320, 1320, 0.12, 'sine', 0.12); S.tone(1760, 1760, 0.18, 'sine', 0.1, 0.08); },
    lose: (S) => S.tone(700, 520, 0.12, 'sine', 0.08),
    look: (S) => { S.tone(380, 620, 0.1, 'sine', 0.12); S.noise(0.06, 2400, 1600, 2, 0.04); },
    pick: (S, k) => S.tone(600 + (k || 0) * 90, 660 + (k || 0) * 90, 0.07, 'triangle', 0.16),
    yes: (S) => { S.tone(880, 880, 0.09, 'sine', 0.16); S.tone(1320, 1320, 0.16, 'sine', 0.14, 0.07); S.tone(2600, 3400, 0.05, 'sine', 0.04, 0.12); },
    no: (S) => S.tone(320, 230, 0.2, 'triangle', 0.13),
    tick: (S) => S.tone(900, 900, 0.03, 'sine', 0.06),
  };
  function buzz(pattern) {
    if (!Sound.on) return;
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* optional */ }
  }

  // --------------------------------------------------------------- effects
  function relPos(card, el) {
    const fr = card.el.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - fr.left, y: r.top + r.height / 2 - fr.top, w: r.width, h: r.height };
  }
  function sparks(card, x, y, colors, n) {
    if (reducedMotion()) return;
    for (let i = 0; i < (n || 10); i++) {
      const a = (Math.PI * 2 * i) / (n || 10) + Math.random() * 0.5;
      const d = 26 + Math.random() * 26;
      const el = h('i', { class: 'spark' });
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.setProperty('--x', Math.cos(a) * d + 'px');
      el.style.setProperty('--y', Math.sin(a) * d + 'px');
      el.style.setProperty('--c', colors[i % colors.length]);
      card.fx.append(el);
      setTimeout(() => el.remove(), 700);
    }
  }
  function confetti(card, colors) {
    if (reducedMotion()) return;
    const cv = h('canvas', { 'aria-hidden': 'true' });
    card.fx.append(cv);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = card.el.clientWidth, H = card.el.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    if (!ctx) { cv.remove(); return; }
    ctx.scale(dpr, dpr);
    const parts = [];
    for (let i = 0; i < 110; i++) {
      parts.push({
        x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.42,
        vx: (Math.random() - 0.5) * 9, vy: -(Math.random() * 9 + 6),
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 5, c: colors[i % colors.length],
      });
    }
    const t0 = now();
    const frame = () => {
      const t = now() - t0;
      ctx.clearRect(0, 0, W, H);
      const fade = t > 1100 ? Math.max(0, 1 - (t - 1100) / 600) : 1;
      for (const p of parts) {
        p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      }
      if (t < 1700 && cv.isConnected) requestAnimationFrame(frame); else cv.remove();
    };
    requestAnimationFrame(frame);
  }
  class Hand {
    constructor(card) {
      this.card = card;
      this.el = h('div', { class: 'hand off', 'aria-hidden': 'true' });
      this.el.innerHTML = HAND_SVG;
      this.el.append(h('span', { class: 'ripple' }));
      card.fx.append(this.el);
    }
    point(target) {
      if (!target || !target.isConnected) { this.hide(); return; }
      const p = relPos(this.card, target);
      if (!p.w) return;
      this.el.style.transform = 'translate(' + (p.x - 17) + 'px,' + (p.y - 4) + 'px)';
      this.el.classList.remove('off');
    }
    hide() { this.el.classList.add('off'); }
  }

  // ------------------------------------------------- puzzle generation
  // Generation runs in a worker built from the same engine source, so the
  // next puzzle is ready while the current one is played. Same seed, same puzzle.
  function safeGenerate(game, level, seed, variant) {
    let lastErr = null;
    for (let k = 0; k < 4; k++) {
      try { return E.games[game].generate(level, (seed + k) >>> 0, variant); } catch (e) { lastErr = e; }
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
          ' for (var k = 0; k < 4 && !p; k++) { try { p = self.Engines.games[d.game].generate(d.level, (d.seed + k) >>> 0, d.variant); } catch (x) { err = x; } }' +
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
    key(g, l, sd, v) { return g + '|' + l + '|' + sd + '|' + (v || ''); },
    put(k, p) {
      this.cache.set(k, p);
      while (this.cache.size > 14) this.cache.delete(this.cache.keys().next().value);
    },
    peek(g, l, sd, v) { return this.cache.get(this.key(g, l, sd, v)) || null; },
    sync(g, l, sd, v) {
      const k = this.key(g, l, sd, v);
      let p = this.cache.get(k);
      if (!p) { p = safeGenerate(g, l, sd, v); this.put(k, p); }
      return p;
    },
    get(g, l, sd, v) {
      const k = this.key(g, l, sd, v);
      if (this.cache.has(k)) return Promise.resolve(this.cache.get(k));
      if (this.inflight.has(k)) return this.inflight.get(k);
      const pr = new Promise((resolve, reject) => {
        const viaMain = () => setTimeout(() => { try { resolve(safeGenerate(g, l, sd, v)); } catch (e) { reject(e); } }, 0);
        if (!this.worker) { viaMain(); return; }
        const id = this.nextId++;
        const job = {
          resolve, fallback: viaMain,
          timer: setTimeout(() => { if (this.waits.has(id)) { this.waits.delete(id); viaMain(); } }, 20000),
        };
        this.waits.set(id, job);
        try { this.worker.postMessage({ id, game: g, level: l, seed: sd, variant: v }); } catch (e) { this.waits.delete(id); clearTimeout(job.timer); viaMain(); }
      }).then((p) => { this.put(k, p); this.inflight.delete(k); return p; }, (e) => { this.inflight.delete(k); throw e; });
      this.inflight.set(k, pr);
      return pr;
    },
  };

  // ------------------------------------------------------- sequencing
  // A plan is a list of blocks. Puzzle seeds come from (session seed, block,
  // game, level, occurrence), so fixed blocks give everyone the same puzzles
  // and adaptive blocks give everyone the same puzzle at each level.
  function seqInit(blocks, seed, clue) { return { seed, clue: clue || 'pin', blocks: clone(blocks), b: 0, k: 0, n: 0, adapt: {}, counts: {} }; }
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
      variant: game === 'tumbler' ? (S.clue || 'pin') : game === 'glimpse' ? (B.adaptive ? 'mix' : 'classic') : '',
    };
    spec.id = 'B' + spec.block + '-' + game + '-L' + level + '-' + (j + 1);
    S.k++;
    S.n++;
    return spec;
  }
  // 2-up / 1-down staircase per game within a block (upAfter can make it
  // 1-up in free play). Glimpse never steps down: its display time already
  // adapts on every look.
  function seqRecord(S, spec, success, upAfter) {
    if (!spec.adaptive) return null;
    const a = S.adapt[(spec.block - 1) + ':' + spec.game];
    if (!a) return null;
    const before = a.level;
    if (success) {
      a.streak++;
      if (a.streak >= (upAfter || 2)) { a.level = Math.min(5, a.level + 1); a.streak = 0; }
    } else {
      if (E.games[spec.game].levelDown !== false) a.level = Math.max(1, a.level - 1);
      a.streak = 0;
    }
    return { from: before, to: a.level, changed: a.level !== before };
  }
  function practiceSpec(game, variant) {
    return { seq: 0, block: 0, inBlock: 0, game, level: 0, adaptive: false, j: 0, seed: 0, variant: game === 'tumbler' ? (variant || 'pin') : '', id: 'P-' + game, practice: true };
  }

  // --------------------------------------------------------- defaults
  const FREE_OPTIONS = { feedback: true, hints: true, undo: true, skip: true, counter: true, par: 1.5, limit: 0, practice: true, sound: true, clue: 'pin' };
  const STUDY_OPTIONS = { feedback: false, hints: false, undo: true, skip: false, counter: false, par: 1.5, limit: 0, practice: true, sound: false, clue: 'pin' };
  const PRESETS = [
    { id: 'prepost', name: 'Pre / train / post', blocks: [
      { game: 'mixed', count: 4, level: 2, adaptive: false },
      { game: 'outbound', count: 8, level: 2, adaptive: true },
      { game: 'mixed', count: 4, level: 2, adaptive: false },
    ] },
    { id: 'speed', name: 'Glimpse training', blocks: [
      { game: 'glimpse', count: 4, level: 2, adaptive: false },
      { game: 'glimpse', count: 16, level: 2, adaptive: true },
      { game: 'glimpse', count: 4, level: 2, adaptive: false },
    ] },
    { id: 'practice', name: 'Mixed practice', blocks: [{ game: 'mixed', count: 12, level: 2, adaptive: true }] },
    { id: 'fixed', name: 'Fixed set', blocks: [{ game: 'mixed', count: 8, level: 3, adaptive: false }] },
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
    const options = Object.assign({}, kind === 'free' ? FREE_OPTIONS : STUDY_OPTIONS, setup.options || {});
    return {
      id: uid(), kind,
      participant: (setup.participant || '').trim(),
      condition: (setup.condition || '').trim(),
      seed: setup.seed >>> 0,
      options,
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
      seq: seqInit(setup.blocks, setup.seed >>> 0, options.clue),
      events: [], puzzles: [],
      practiced: {}, pending: null,
      hasMoves: false,
      live: null,
    };
  }

  // ------------------------------------------------------------- palettes
  const CAR_COLORS = [
    { fill: '#F2564D', dark: false }, { fill: '#3D8BFD', dark: false }, { fill: '#FFC93C', dark: true },
    { fill: '#22BFB0', dark: false }, { fill: '#9B6BFF', dark: false }, { fill: '#FF8A3D', dark: true },
    { fill: '#4CC38A', dark: false }, { fill: '#FF6FA7', dark: false }, { fill: '#F4F5F7', dark: true }, { fill: '#56688F', dark: false },
  ];
  const PEGS = [
    { name: 'red', fill: '#F04E5E', ink: '#FFFFFF', glyph: 'M8 3.6a4.4 4.4 0 1 1 0 8.8a4.4 4.4 0 1 1 0-8.8z' },
    { name: 'blue', fill: '#3A7BFF', ink: '#FFFFFF', glyph: 'M3.8 3.8h8.4v8.4H3.8z' },
    { name: 'yellow', fill: '#FFCB2E', ink: '#3A2A00', glyph: 'M8 2.6l5.6 10H2.4z' },
    { name: 'green', fill: '#2DBF6C', ink: '#FFFFFF', glyph: 'M8 2.2l5.8 5.8L8 13.8 2.2 8z' },
    { name: 'purple', fill: '#A066FF', ink: '#FFFFFF', glyph: 'M6.4 2.8h3.2v3.6h3.6v3.2H9.6v3.6H6.4V9.6H2.8V6.4h3.6z' },
    { name: 'orange', fill: '#FF8C2E', ink: '#3A1E00', glyph: 'M8 2l1.8 3.8 4.1.5-3 2.9.8 4.1L8 11.3l-3.7 2 .8-4.1-3-2.9 4.1-.5z' },
    { name: 'teal', fill: '#16C2C2', ink: '#053A3A', glyph: 'M2.8 6.4h10.4v3.2H2.8z' },
  ];
  const CONFETTI = {
    outbound: ['#F2564D', '#3D8BFD', '#FFC93C', '#22BFB0', '#FFFFFF'],
    conduit: ['#2E9CF2', '#FF6FA7', '#FFD23F', '#2FA75A', '#FFFFFF'],
    tumbler: ['#FFC83A', '#F04E5E', '#3A7BFF', '#2DBF6C', '#A066FF', '#FFFFFF'],
    glimpse: ['#FFFFFF', '#FFC83A', '#3D8BFD', '#FF8A3D', '#7CE3B0'],
  };
  const DIRV = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  const ANGLE = { N: 0, E: 90, S: 180, W: 270 };
  const DIRNAME = { N: 'up', E: 'right', S: 'down', W: 'left' };
  const SIDEV = { 1: [0, -1], 2: [1, 0], 4: [0, 1], 8: [-1, 0] };
  const OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };
  const APPLIES = {
    outbound: ['optimal', 'wasted', 'dead_end', 'in_dead_end', 'blocked', 'undo', 'restart', 'hint'],
    conduit: ['optimal', 'wasted', 'undo', 'restart', 'hint'],
    tumbler: ['optimal', 'suboptimal', 'zero_info', 'inconsistent', 'hint'],
    glimpse: [],
  };
  function blankCounts() {
    return { moves: 0, optimal: 0, wasted: 0, dead_end: 0, in_dead_end: 0, blocked: 0, undo: 0, restart: 0, hint: 0, suboptimal: 0, zero_info: 0, inconsistent: 0, neutral: 0, solved: 0, infoRatioSum: 0, infoRatioN: 0 };
  }
  function starsFor(sm) {
    if (sm.outcome !== 'solved') return 0;
    return sm.moves <= sm.reference ? 3 : sm.moves <= sm.par ? 2 : 1;
  }

  // ============================================================== cards
  class Card {
    constructor(app, spec, puzzle, snap) {
      this.app = app;
      this.spec = spec;
      this.p = puzzle;
      this.G = E.games[spec.game];
      this.practice = !!spec.practice;
      this.o = app.session.options;
      this.par = puzzle.reference == null ? null : Math.max(1, Math.ceil(puzzle.reference * this.o.par));
      this.run = snap ? this.G.restore(puzzle, snap.run) : this.freshRun(puzzle);
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
      this.el = h('article', { class: 'scene', 'data-game': spec.game, 'aria-label': this.G.name + (this.practice ? ', practice' : ', level ' + spec.level) });
      this.build();
      this.buildBoard();
      this.refresh(false);
      this.updateStatus();
      if (this.summary) this.showResult(this.summary, true);
    }
    freshRun(p) { return this.G.newRun(p); }
    usesClock() { return true; }
    later(fn, ms) { const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms); this.timers.add(t); return t; }
    destroy() {
      clearInterval(this.tick);
      for (const t of this.timers) clearTimeout(t);
      this.timers.clear();
    }
    elapsed() { return this.frozen != null ? this.frozen : now() - this.t0; }
    build() {
      const sp = this.spec;
      const title = h('div', { class: 'title' },
        h('span', { class: 'game-ico' }, icon(GAME_ICON[sp.game])),
        h('span', { class: 'game-name', text: this.G.name }),
        this.practice ? h('span', { class: 'tag', text: 'Practice' }) : pips(sp.level));
      this.goalEl = h('span', { class: 'goal', role: 'status' });
      this.meterEl = h('span', { class: 'meter', role: 'img' });
      this.meterStars = [0, 1, 2].map(() => icon('star'));
      this.meterEl.append(this.meterStars[0], this.meterStars[1], this.meterStars[2]);
      this.clockEl = h('span', { class: 'clock', hidden: true });
      const status = h('div', { class: 'status' }, this.goalEl, this.meterEl, this.clockEl);
      this.head = h('div', { class: 'scene-head' }, title, status);
      this.area = h('div', { class: 'board-area' });
      this.toolsEl = h('div', { class: 'tools' });
      this.fx = h('div', { class: 'fx' });
      this.el.append(this.head, this.area, this.toolsEl, this.fx);
      this.buildTools();
      this.bindDrag();
    }
    tool(name, label, fn) {
      return h('button', { class: 'tool', type: 'button', 'aria-label': label, onclick: fn }, h('span', { class: 'disc' }, icon(name)), h('span', { class: 'lab', text: label }));
    }
    buildTools() {
      const t = this.toolsEl;
      t.textContent = '';
      if (this.o.undo && this.G.undo) {
        this.undoBtn = this.tool('undo', 'Undo', () => this.doUndo());
        this.restartBtn = this.tool('restart', 'Restart', () => this.doRestart());
        t.append(this.undoBtn, this.restartBtn);
      }
      if (this.o.hints && !this.practice && this.G.hint) {
        this.hintBtn = this.tool('hint', 'Hint', () => this.doHint());
        t.append(this.hintBtn);
      }
      if (this.o.skip || this.practice) {
        this.skipBtn = this.tool('skip', 'Skip', () => this.doSkip());
        t.append(this.skipBtn);
      }
      t.hidden = !t.children.length;
    }
    start() {
      this.t0 = now();
      this.log('puzzle_start', {
        detail: JSON.stringify({ params: this.G.describe(this.p), reference: this.p.reference, par: this.par, practice: this.practice ? 1 : 0, features: this.p.features }),
      });
      this.startTimer();
      this.later(() => this.guide(), 520);
    }
    startTimer() {
      clearInterval(this.tick);
      if (this.summary) return;
      if (this.o.limit && this.usesClock()) this.tick = setInterval(() => this.updateStatus(), 500);
    }
    potentialStars() { const m = this.c.moves; return m <= this.p.reference ? 3 : m <= this.par ? 2 : 1; }
    updateStatus() {
      this.goal();
      const showStars = this.o.counter && !this.practice;
      this.meterEl.hidden = !showStars;
      if (showStars) {
        const n = this.summary ? (this.summary.stars || 0) : this.potentialStars();
        this.meterStars.forEach((st, i) => {
          const lost = i >= n;
          if (lost && !st.classList.contains('lost') && this.c.moves) Sound.play('lose');
          st.classList.toggle('lost', lost);
        });
        this.meterEl.setAttribute('aria-label', n + ' stars possible, ' + this.c.moves + ' moves');
      }
      if (this.o.limit && !this.practice && this.usesClock()) {
        const left = this.o.limit * 1000 - this.elapsed();
        this.clockEl.hidden = false;
        this.clockEl.textContent = clock(left);
        this.clockEl.classList.toggle('low', left < 10000);
        if (left <= 0 && !this.summary) this.resolve('timeout');
      }
      if (this.undoBtn) this.undoBtn.disabled = !!this.summary || !this.hasHistory();
      if (this.restartBtn) this.restartBtn.disabled = !!this.summary || !this.hasHistory();
    }
    goal() {}
    hasHistory() { return false; }
    log(event, fields) { this.app.logPuzzle(this, event, fields || {}); }
    moveFields(rec) {
      return {
        move_no: this.c.moves, target: rec.target,
        from: this.pos(rec.from), to: this.pos(rec.to),
        d_before: fin(rec.dBefore), d_after: fin(rec.dAfter), cls: rec.cls,
        detail: rec.detail || '',
      };
    }
    pos(v) { return v == null ? '' : v; }
    commit(rec) {
      if (rec.kind === 'blocked') {
        this.c.blocked++;
        this.log('blocked', this.moveFields(rec));
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
      this.updateStatus();
      if (rec.solved) { this.resolve('solved'); return; }
      if (rec.failed) { this.resolve('failed'); return; }
      if (rec.stuck) this.showStuck();
      this.later(() => this.guide(), 380);
      this.app.touch();
    }
    guide() {
      if (!this.practice || this.summary) { if (this.hand) this.hand.hide(); return; }
      const target = this.guideTarget();
      if (!target) { if (this.hand) this.hand.hide(); return; }
      if (!this.hand) this.hand = new Hand(this);
      this.hand.point(target);
    }
    guideTarget() { return null; }
    hideHand() { if (this.hand) this.hand.hide(); }
    pointAt(el, ms) {
      if (!this.hand) this.hand = new Hand(this);
      this.hand.point(el);
      clearTimeout(this.handTimer);
      this.handTimer = this.later(() => this.hideHand(), ms || 2400);
    }
    call(btn, on) { if (btn) btn.classList.toggle('call', !!on); }
    doUndo() {
      if (this.summary || this.busy) return;
      const r = this.G.undo(this.p, this.run);
      if (!r) return;
      this.c.undo++;
      this.log('undo', { move_no: this.c.moves, target: r.target, from: this.pos(r.from), to: this.pos(r.to), d_before: fin(r.dBefore), d_after: fin(r.dAfter) });
      this.call(this.undoBtn, false);
      this.call(this.restartBtn, false);
      this.afterUndo(r);
      this.updateStatus();
      this.later(() => this.guide(), 300);
      this.app.touch();
    }
    doRestart() {
      if (this.summary || this.busy) return;
      const key = this.spec.game === 'outbound' ? 'st' : 'rot';
      const dB = fin(this.G.dist(this.p, this.run[key]));
      this.G.restart(this.p, this.run);
      this.c.restart++;
      this.log('restart', { move_no: this.c.moves, d_before: dB, d_after: fin(this.G.dist(this.p, this.run[key])) });
      this.call(this.undoBtn, false);
      this.call(this.restartBtn, false);
      this.refresh(true);
      this.updateStatus();
      this.later(() => this.guide(), 400);
      this.app.touch();
    }
    doHint() {
      if (this.summary || this.busy) return;
      const hint = this.G.hint(this.p, this.run);
      this.c.hint++;
      this.log('hint', { move_no: this.c.moves, target: hint.target != null ? hint.target : '', cands_before: hint.candsBefore != null ? hint.candsBefore : '', cands_after: hint.candsAfter != null ? hint.candsAfter : '', detail: JSON.stringify(hint) });
      Sound.play('hint');
      this.showHint(hint);
      this.app.touch();
    }
    doSkip() {
      if (this.summary || this.busy) return;
      if (!this.skipArmed) {
        this.skipArmed = true;
        this.skipBtn.classList.add('armed');
        this.skipBtn.querySelector('.lab').textContent = 'Sure?';
        this.later(() => {
          this.skipArmed = false;
          if (this.skipBtn) { this.skipBtn.classList.remove('armed'); this.skipBtn.querySelector('.lab').textContent = 'Skip'; }
        }, 2600);
        return;
      }
      this.resolve('skipped');
    }
    showStuck() {
      if (this.o.undo) {
        this.call(this.undoBtn, true);
        this.call(this.restartBtn, true);
      } else {
        this.later(() => this.resolve('failed'), 1300);
      }
    }
    resolve(outcome) {
      if (this.summary) return;
      clearInterval(this.tick);
      if (this.beforeResolve) this.beforeResolve(outcome);
      if (this.hiddenAt != null) { this.hiddenMs += now() - this.hiddenAt; this.hiddenAt = null; }
      const dur = Math.round(this.elapsed());
      this.frozen = dur;
      const sm = this.makeSummary(outcome, dur);
      this.summary = sm;
      this.hideHand();
      this.call(this.undoBtn, false);
      this.call(this.restartBtn, false);
      const res = this.app.onPuzzleEnd(this, sm);
      sm.level_next = res.level_next;
      sm.level_change = res.change && res.change.changed ? res.change : null;
      this.updateStatus();
      if (this.onResolved) this.onResolved(outcome);
      this.later(() => this.showResult(sm, false), this.celebrate(sm));
    }
    makeSummary(outcome, dur) {
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
      sm.stars = starsFor(sm);
      return sm;
    }
    // sound and confetti at the end; returns the delay before the result card
    celebrate(sm) {
      if (sm.outcome === 'solved') {
        Sound.play('win');
        buzz([18, 50, 18]);
        this.later(() => confetti(this, CONFETTI[this.spec.game]), 120);
        return 650;
      }
      if (sm.outcome === 'failed' || sm.outcome === 'timeout') {
        Sound.play('fail');
        buzz(60);
      }
      return 420;
    }
    resultStats(sm) {
      const unit = this.spec.game === 'tumbler' ? ['try', 'tries'] : this.spec.game === 'conduit' ? ['turn', 'turns'] : ['move', 'moves'];
      const refWord = this.spec.game === 'tumbler' ? 'solver ' : 'best ';
      return h('div', { class: 'res-stats' },
        h('span', null, icon('tapped'), h('b', { text: String(sm.moves) }), ' ' + unit[sm.moves === 1 ? 0 : 1], h('span', { text: ' · ' + refWord + sm.reference })),
        h('span', null, icon('clock'), h('b', { text: clock(sm.duration_ms) })));
    }
    resultTitle(sm) {
      if (sm.outcome === 'solved') {
        if (this.practice) return 'Got it!';
        if (!this.o.counter) return 'Solved!';
        return sm.stars === 3 ? 'Perfect!' : sm.stars === 2 ? 'Great!' : 'Solved!';
      }
      if (sm.outcome === 'failed') return this.spec.game === 'tumbler' ? 'Locked out' : 'Stuck!';
      if (sm.outcome === 'timeout') return "Time's up";
      if (sm.outcome === 'skipped') return 'Skipped';
      return 'Stopped';
    }
    showResult(sm, instant) {
      if (this.resultEl) this.resultEl.remove();
      const panel = h('section', { class: 'result', 'aria-label': 'Result' });
      const solved = sm.outcome === 'solved' || sm.outcome === 'complete';
      const showStars = solved && this.o.counter && !this.practice;
      if (showStars) {
        const row = h('div', { class: 'res-stars', role: 'img', 'aria-label': sm.stars + ' of 3 stars' });
        const st = [0, 1, 2].map(() => icon('star'));
        st.forEach((x) => row.append(x));
        panel.append(row);
        st.forEach((x, i) => {
          const go = () => { x.classList.add('in'); if (i < sm.stars) { x.classList.add('gold'); if (!instant) Sound.play('star', i); } };
          if (instant) go(); else this.later(go, 220 + i * 260);
        });
      } else {
        const kind = solved ? '' : sm.outcome === 'skipped' || sm.outcome === 'abandoned' ? ' skip' : ' miss';
        panel.append(h('div', { class: 'res-icon' + kind }, icon(solved ? 'check' : sm.outcome === 'skipped' || sm.outcome === 'abandoned' ? 'skip' : 'x')));
      }
      panel.append(h('h3', { class: 'res-title', text: this.resultTitle(sm) }));
      if (this.o.counter && !this.practice && sm.outcome !== 'abandoned') {
        const stats = this.resultStats(sm);
        if (stats) panel.append(stats);
      }
      if (sm.newBest && this.o.counter && !this.practice) {
        panel.append(h('div', { class: 'res-level best' }, icon('bolt'), 'New best · ' + Math.round(sm.newBest) + ' ms'));
        if (!instant) this.later(() => Sound.play('level'), 700);
      }
      if (sm.level_change && this.o.counter) {
        const up = sm.level_change.to > sm.level_change.from;
        panel.append(h('div', { class: 'res-level' + (up ? '' : ' down') }, (up ? 'Level up' : 'Level ') + (up ? ' · ' : '') + 'L' + sm.level_change.to, pips(sm.level_change.to)));
        if (up && !instant) this.later(() => Sound.play('level'), 900);
      }
      const last = this.app.isLast(this.spec);
      const next = h('button', { class: 'next', type: 'button', onclick: () => this.app.next() }, last ? 'Finish' : 'Next', icon('next'));
      panel.append(next);
      if (!last) panel.append(h('div', { class: 'swipe', 'aria-hidden': 'true' }, icon('up')));
      this.el.append(panel);
      this.el.classList.add('resolved');
      this.resultEl = panel;
      this.later(() => { try { next.focus({ preventScroll: true, focusVisible: false }); } catch (e) { /* optional */ } }, 80);
    }
    bindDrag() {
      let d = null;
      this.el.addEventListener('pointerdown', (e) => {
        if (!this.summary || (e.target.closest && e.target.closest('button'))) return;
        d = { y: e.clientY, t: now(), id: e.pointerId, dy: 0 };
        try { this.el.setPointerCapture(e.pointerId); } catch (x) { /* optional */ }
      });
      this.el.addEventListener('pointermove', (e) => {
        if (!d || e.pointerId !== d.id) return;
        const raw = e.clientY - d.y;
        d.dy = raw < 0 ? raw : raw * 0.25;
        this.el.style.transition = 'none';
        this.el.style.transform = 'translateY(' + d.dy + 'px)';
      });
      const end = () => {
        if (!d) return;
        const v = d.dy / Math.max(1, now() - d.t);
        const go = d.dy < -90 || (d.dy < -30 && v < -0.45);
        const dy = d.dy;
        d = null;
        if (go) this.app.next(dy);
        else { this.el.style.transition = 'transform 0.3s cubic-bezier(.3,1.5,.5,1)'; this.el.style.transform = ''; }
      };
      this.el.addEventListener('pointerup', end);
      this.el.addEventListener('pointercancel', end);
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
    hasHistory() { return this.run.hist.length > 0; }
    buildBoard() {
      const p = this.p, U = 10, R = 4.4;
      const W = p.w * U, H = p.h * U;
      this.uid = 'ob' + Math.random().toString(36).slice(2, 8);
      const svgEl = s('svg', { class: 'board', viewBox: [-R - 0.6, -R - 0.6, W + 2 * R + 1.2, H + 2 * R + 1.2].join(' '), role: 'group', 'aria-label': 'Parking lot with ' + p.cars.length + ' cars' });
      svgEl.append(s('defs', null,
        s('filter', { id: this.uid + 'b', x: '-40%', y: '-40%', width: '180%', height: '180%' }, s('feGaussianBlur', { stdDeviation: '0.75' })),
        s('linearGradient', { id: this.uid + 'g', x1: '0', y1: '0', x2: '1', y2: '0' },
          s('stop', { offset: '0', 'stop-color': '#FFFFFF', 'stop-opacity': '0.42' }),
          s('stop', { offset: '0.5', 'stop-color': '#FFFFFF', 'stop-opacity': '0' }))));
      svgEl.append(s('rect', { class: 'road', x: -R, y: -R, width: W + 2 * R, height: H + 2 * R, rx: 6.5 }));
      svgEl.append(s('rect', { class: 'road-dash', x: -R / 2, y: -R / 2, width: W + R, height: H + R, rx: 4.2 }));
      svgEl.append(s('rect', { class: 'lot', x: 0, y: 0, width: W, height: H, rx: 2.5 }));
      for (let x = 1; x < p.w; x++) svgEl.append(s('line', { class: 'stall', x1: x * U, y1: 1.2, x2: x * U, y2: H - 1.2 }));
      for (let y = 1; y < p.h; y++) svgEl.append(s('line', { class: 'stall', x1: 1.2, y1: y * U, x2: W - 1.2, y2: y * U }));
      svgEl.append(s('rect', { class: 'curb', x: 0, y: 0, width: W, height: H, rx: 2.5 }));
      this.carEls = p.cars.map((c, i) => { const g = this.drawCar(c, i); svgEl.append(g); return g; });
      this.svg = svgEl;
      this.area.append(svgEl);
    }
    center(c, adv) {
      const d = DIRV[c.dir];
      const rx = c.x + adv * d[0], ry = c.y + adv * d[1];
      const fx = rx + (c.len - 1) * d[0], fy = ry + (c.len - 1) * d[1];
      return [((rx + fx) / 2 + 0.5) * 10, ((ry + fy) / 2 + 0.5) * 10];
    }
    drawCar(c, i) {
      const L = c.len * 10, top = -L / 2, bot = L / 2;
      const col = CAR_COLORS[c.color % CAR_COLORS.length];
      const glass = '#24334A';
      const g = s('g', { class: 'car', tabindex: '0', role: 'button', 'aria-label': (c.len === 3 ? 'Truck' : 'Car') + ' facing ' + DIRNAME[c.dir] });
      const rot = s('g', { transform: 'rotate(' + ANGLE[c.dir] + ')' });
      const anim = s('g', { class: 'anim' });
      anim.append(
        s('rect', { x: -4.2, y: top + 0.8, width: 8.4, height: L - 1.6, rx: 3, fill: 'rgba(10,12,20,0.5)', filter: 'url(#' + this.uid + 'b)', transform: 'translate(0.7 1.1)' }),
        s('rect', { x: -4.8, y: top + 2.1, width: 1.6, height: 2.7, rx: 0.7, fill: '#1B1E26' }),
        s('rect', { x: 3.2, y: top + 2.1, width: 1.6, height: 2.7, rx: 0.7, fill: '#1B1E26' }),
        s('rect', { x: -4.8, y: bot - 4.8, width: 1.6, height: 2.7, rx: 0.7, fill: '#1B1E26' }),
        s('rect', { x: 3.2, y: bot - 4.8, width: 1.6, height: 2.7, rx: 0.7, fill: '#1B1E26' }),
        s('rect', { x: -4.2, y: top + 0.8, width: 8.4, height: L - 1.6, rx: 3, fill: col.fill }),
        s('rect', { x: -4.2, y: top + 0.8, width: 8.4, height: L - 1.6, rx: 3, fill: 'url(#' + this.uid + 'g)' }));
      if (c.len === 3) {
        anim.append(
          s('path', { d: 'M-3.2 ' + (top + 4.8) + ' L-2.6 ' + (top + 2.6) + ' L2.6 ' + (top + 2.6) + ' L3.2 ' + (top + 4.8) + ' Z', fill: glass }),
          s('rect', { x: -3.2, y: top + 4.8, width: 6.4, height: 3.4, rx: 1.1, fill: 'rgba(0,0,0,0.14)' }),
          s('rect', { x: -3.8, y: top + 9.4, width: 7.6, height: L - 11, rx: 1.4, fill: 'rgba(255,255,255,0.3)' }),
          s('path', { d: 'M-3 ' + (top + 14) + 'H3M-3 ' + (top + 18) + 'H3M-3 ' + (top + 22) + 'H3', stroke: 'rgba(0,0,0,0.16)', 'stroke-width': 0.6, fill: 'none' }));
      } else {
        anim.append(
          s('path', { d: 'M-3.2 ' + (top + 5.4) + ' L-2.6 ' + (top + 2.9) + ' L2.6 ' + (top + 2.9) + ' L3.2 ' + (top + 5.4) + ' Z', fill: glass }),
          s('rect', { x: -3.2, y: top + 5.4, width: 6.4, height: L - 10.8, rx: 1.4, fill: 'rgba(0,0,0,0.12)' }),
          s('path', { d: 'M-3.1 ' + (bot - 5.4) + ' L3.1 ' + (bot - 5.4) + ' L2.6 ' + (bot - 3.4) + ' L-2.6 ' + (bot - 3.4) + ' Z', fill: glass, opacity: 0.85 }));
      }
      anim.append(
        s('rect', { x: -3.6, y: top + 1.0, width: 1.7, height: 1.0, rx: 0.5, fill: '#FFF4BE' }),
        s('rect', { x: 1.9, y: top + 1.0, width: 1.7, height: 1.0, rx: 0.5, fill: '#FFF4BE' }),
        s('rect', { x: -3.5, y: bot - 1.9, width: 1.5, height: 0.8, rx: 0.4, fill: '#FF4D4D' }),
        s('rect', { x: 2.0, y: bot - 1.9, width: 1.5, height: 0.8, rx: 0.4, fill: '#FF4D4D' }));
      const cy = c.len === 3 ? top + 9.4 + (L - 11) / 2 : 0.4;
      anim.append(s('path', { d: 'M-1.9 ' + (cy + 1.1) + ' L0 ' + (cy - 0.9) + ' L1.9 ' + (cy + 1.1), fill: 'none', stroke: col.dark ? 'rgba(30,30,30,0.72)' : 'rgba(255,255,255,0.95)', 'stroke-width': 1.05, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      anim.append(s('rect', { class: 'halo', x: -5.4, y: top - 0.1, width: 10.8, height: L + 0.2, rx: 3.8 }));
      rot.append(anim);
      g.append(rot);
      g.anim = anim;
      g.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); this.press(i); });
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.press(i); } });
      return g;
    }
    place(i, instant) {
      const c = this.p.cars[i], g = this.carEls[i], a = this.run.st[i];
      if (a === E.EXIT) { g.style.display = 'none'; return; }
      g.style.display = '';
      g.classList.remove('leaving');
      const xy = this.center(c, a);
      if (instant) g.style.transition = 'none';
      g.style.opacity = '1';
      g.style.transform = 'translate(' + xy[0] + 'px,' + xy[1] + 'px)';
      if (instant) { void g.getBoundingClientRect(); g.style.transition = ''; }
    }
    refresh(animated) {
      this.p.cars.forEach((c, i) => this.place(i, !animated));
      this.markStuck();
    }
    goal() {
      const left = this.G.remaining(this.p, this.run);
      if (this.goalCount === left && this.goalEl.firstChild) return;
      this.goalCount = left;
      this.goalEl.textContent = '';
      this.goalEl.append(icon('car'), h('span', { text: String(left) }));
      this.goalEl.setAttribute('aria-label', left + ' cars left');
    }
    anim(i, frames, ms, delay) {
      const a = this.carEls[i] && this.carEls[i].anim;
      if (!a || typeof a.animate !== 'function' || reducedMotion()) return;
      a.animate(frames, { duration: ms, delay: delay || 0, easing: 'ease-out' });
    }
    press(i) {
      if (this.summary || this.busy) return;
      Sound.unlock();
      const blocker = this.G.blocker(this.p, this.run, i);
      const rec = this.G.tap(this.p, this.run, i);
      if (!rec) return;
      this.hideHand();
      this.anim(i, [{ transform: 'scale(1)' }, { transform: 'scale(0.93)' }, { transform: 'scale(1)' }], 160);
      if (rec.kind === 'blocked') {
        this.anim(i, [{ transform: 'translateY(0)' }, { transform: 'translateY(-1.8px)' }, { transform: 'translateY(0)' }], 200);
        if (blocker >= 0) this.anim(blocker, [{ transform: 'rotate(0)' }, { transform: 'rotate(-6deg)' }, { transform: 'rotate(5deg)' }, { transform: 'rotate(0)' }], 320, 90);
        rec.detail = blocker >= 0 ? 'blocked by ' + this.p.cars[blocker].label : '';
        Sound.play('honk');
        buzz(12);
      } else if (rec.exited) {
        this.driveOut(i, rec);
        Sound.play('vroom');
        buzz(10);
        this.goalEl.classList.remove('bump');
        void this.goalEl.offsetWidth;
        this.goalEl.classList.add('bump');
      } else {
        this.place(i, false);
        Sound.play('roll');
        const b = this.G.blocker(this.p, this.run, i);
        this.later(() => {
          this.anim(i, [{ transform: 'scale(1,1)' }, { transform: 'scale(1.07,0.9)' }, { transform: 'scale(1,1)' }], 240);
          if (b >= 0) this.anim(b, [{ transform: 'rotate(0)' }, { transform: 'rotate(-5deg)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(0)' }], 300);
          Sound.play('bump');
          buzz(16);
        }, 250);
      }
      if (this.o.feedback && !this.practice && rec.kind !== 'blocked') this.flash(i, rec.cls);
      this.commit(rec);
      if (this.o.feedback && !this.practice && rec.cls === 'dead_end') { Sound.play('dead'); this.markStuck(); this.call(this.undoBtn, true); }
    }
    driveOut(i, rec) {
      const c = this.p.cars[i], g = this.carEls[i];
      const far = Math.max(this.p.w, this.p.h) + c.len + 3;
      const xy = this.center(c, rec.from + far);
      g.classList.add('leaving');
      g.style.transform = 'translate(' + xy[0] + 'px,' + xy[1] + 'px)';
      g.style.opacity = '0';
      this.later(() => { if (this.run.st[i] === E.EXIT) g.style.display = 'none'; }, 560);
    }
    flash(i, cls) {
      const g = this.carEls[i];
      const k = 'q-' + cls;
      g.classList.add(k);
      this.later(() => g.classList.remove(k), 800);
    }
    markStuck() {
      const stuck = this.o.feedback && !this.practice && this.G.dist(this.p, this.run.st) === Infinity ? new Set(this.G.stuckCars(this.p, this.run)) : new Set();
      this.carEls.forEach((g, i) => g.classList.toggle('stuck', stuck.has(i)));
    }
    afterUndo(r) {
      const g = this.carEls[r.index];
      if (r.from === E.EXIT) {
        this.place(r.index, true);
        if (!reducedMotion() && typeof g.animate === 'function') g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
      } else this.place(r.index, false);
      this.markStuck();
    }
    showStuck() {
      if (this.o.feedback && !this.practice) this.markStuck();
      super.showStuck();
    }
    showHint(hint) {
      if (hint.kind === 'target') {
        const g = this.carEls[hint.index];
        g.classList.add('hinted');
        this.later(() => g.classList.remove('hinted'), 2800);
        this.pointAt(g, 2600);
      } else if (hint.kind === 'dead_end') {
        this.call(this.undoBtn, true);
        if (this.undoBtn) this.pointAt(this.undoBtn, 2600);
      }
    }
    guideTarget() {
      const hnt = this.G.hint(this.p, this.run);
      return hnt.kind === 'target' ? this.carEls[hnt.index] : null;
    }
  }

  // ------------------------------------------------------------- Conduit
  class ConduitCard extends Card {
    hasHistory() { return this.run.hist.length > 0; }
    buildBoard() {
      const p = this.p, U = 10, pad = 1.4;
      const svgEl = s('svg', { class: 'board', viewBox: [-pad, -pad, p.w * U + pad * 2, p.h * U + pad * 2].join(' '), role: 'group', 'aria-label': 'Garden, ' + p.w + ' by ' + p.h + ' tiles' });
      svgEl.append(s('rect', { class: 'soil', x: -pad, y: -pad, width: p.w * U + pad * 2, height: p.h * U + pad * 2, rx: 4.5 }));
      this.angle = this.run.rot.map((r) => r * 90);
      this.cells = []; this.tiles = []; this.arms = []; this.plants = {};
      this.plantCount = 0;
      for (let i = 0; i < p.w * p.h; i++) {
        const x = i % p.w, y = (i / p.w) | 0;
        const cx = x * U + U / 2, cy = y * U + U / 2;
        const m = p.sol[i];
        let deg = 0;
        for (const sd of [1, 2, 4, 8]) if (m & sd) deg++;
        const isPlant = deg === 1 && i !== p.src;
        const cell = s('g', { class: 'cell', tabindex: '0', role: 'button', 'aria-label': (i === p.src ? 'Water source' : isPlant ? 'Plant' : 'Pipe') + ', row ' + (y + 1) + ', column ' + (x + 1) });
        cell.append(s('rect', { class: 'bed', x: x * U + 0.45, y: y * U + 0.45, width: U - 0.9, height: U - 0.9, rx: 2.2 }));
        cell.append(s('rect', { class: 'bed-shade', x: x * U + 0.45, y: y * U + 8.3, width: U - 0.9, height: 1.25, rx: 0.6 }));
        const tile = s('g', { class: 'tile' });
        tile.style.transformOrigin = cx + 'px ' + cy + 'px';
        const arms = [];
        for (const sd of [1, 2, 4, 8]) {
          if (!(m & sd)) continue;
          const ex = cx + SIDEV[sd][0] * 5, ey = cy + SIDEV[sd][1] * 5;
          const flowEl = s('line', { class: 'flow', x1: cx, y1: cy, x2: ex, y2: ey });
          tile.append(s('line', { class: 'case', x1: cx, y1: cy, x2: ex, y2: ey }), s('line', { class: 'core', x1: cx, y1: cy, x2: ex, y2: ey }), flowEl);
          arms.push({ side: sd, flow: flowEl });
        }
        if (deg >= 2) tile.append(s('circle', { class: 'hub', cx, cy, r: 1.95 }));
        cell.append(tile);
        if (i === p.src) {
          cell.append(s('circle', { class: 'well', cx, cy, r: 3.4 }), s('circle', { class: 'well-rim', cx, cy, r: 2.5 }),
            s('path', { class: 'well-drop', d: 'M' + cx + ' ' + (cy - 1.9) + 'C' + (cx + 1.5) + ' ' + (cy - 0.2) + ' ' + (cx + 1.4) + ' ' + (cy + 1.7) + ' ' + cx + ' ' + (cy + 1.7) + 'C' + (cx - 1.4) + ' ' + (cy + 1.7) + ' ' + (cx - 1.5) + ' ' + (cy - 0.2) + ' ' + cx + ' ' + (cy - 1.9) + 'Z' }));
        }
        if (isPlant) {
          const plant = this.drawPlant(cx, cy);
          cell.append(plant);
          this.plants[i] = plant;
          this.plantCount++;
        }
        cell.append(s('rect', { class: 'ring', x: x * U + 0.45, y: y * U + 0.45, width: U - 0.9, height: U - 0.9, rx: 2.2 }));
        cell.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); this.press(i); });
        cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.press(i); } });
        svgEl.append(cell);
        this.cells.push(cell);
        this.tiles.push(tile);
        this.arms.push(arms);
      }
      this.leaks = s('g', { class: 'leaks', 'aria-hidden': 'true' });
      svgEl.append(this.leaks);
      this.svg = svgEl;
      this.wetSet = new Set();
      this.area.append(svgEl);
    }
    drawPlant(cx, cy) {
      const g = s('g', { class: 'plant', transform: 'translate(' + cx * 0.22 + ' ' + (cy * 0.22 + 0.5) + ') scale(0.78)' });
      g.append(
        s('path', { class: 'leaf l', d: 'M' + (cx - 0.2) + ' ' + (cy - 0.9) + 'C' + (cx - 3.2) + ' ' + (cy - 1.3) + ' ' + (cx - 3.8) + ' ' + (cy - 3.4) + ' ' + (cx - 3.6) + ' ' + (cy - 4.3) + 'C' + (cx - 1.5) + ' ' + (cy - 4.2) + ' ' + (cx - 0.4) + ' ' + (cy - 2.7) + ' ' + (cx - 0.2) + ' ' + (cy - 0.9) + 'Z' }),
        s('path', { class: 'leaf r', d: 'M' + (cx + 0.2) + ' ' + (cy - 0.9) + 'C' + (cx + 3.2) + ' ' + (cy - 1.3) + ' ' + (cx + 3.8) + ' ' + (cy - 3.4) + ' ' + (cx + 3.6) + ' ' + (cy - 4.3) + 'C' + (cx + 1.5) + ' ' + (cy - 4.2) + ' ' + (cx + 0.4) + ' ' + (cy - 2.7) + ' ' + (cx + 0.2) + ' ' + (cy - 0.9) + 'Z' }));
      const bloom = s('g', { class: 'bloom' });
      for (let k = 0; k < 5; k++) {
        const a = (Math.PI * 2 * k) / 5 - Math.PI / 2;
        bloom.append(s('circle', { cx: cx + Math.cos(a) * 1.15, cy: cy - 3.2 + Math.sin(a) * 1.15, r: 1.0, fill: '#FF6FA7' }));
      }
      bloom.append(s('circle', { cx, cy: cy - 3.2, r: 0.75, fill: '#FFD23F' }));
      g.append(bloom,
        s('path', { class: 'pot', d: 'M' + (cx - 2.3) + ' ' + (cy - 0.3) + 'h4.6l-0.65 3.4h-3.3z' }),
        s('rect', { class: 'rim', x: cx - 2.65, y: cy - 0.95, width: 5.3, height: 1.05, rx: 0.45 }));
      return g;
    }
    setAngle(i, instant) {
      const t = this.tiles[i];
      if (instant) t.style.transition = 'none';
      t.style.transform = 'rotate(' + this.angle[i] + 'deg)';
      if (instant) { void t.getBoundingClientRect(); t.style.transition = ''; }
    }
    // water: spreads from the source in waves, flows away from it, leaks at open ends
    update() {
      const p = this.p, n = p.w * p.h;
      const mask = (i) => this.G.maskAt(p, this.run, i);
      const depth = new Int16Array(n).fill(-1), parent = new Int8Array(n);
      depth[p.src] = 0;
      const queue = [p.src];
      while (queue.length) {
        const i = queue.shift();
        const m = mask(i), x = i % p.w, y = (i / p.w) | 0;
        for (const sd of [1, 2, 4, 8]) {
          if (!(m & sd)) continue;
          const nx = x + SIDEV[sd][0], ny = y + SIDEV[sd][1];
          if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) continue;
          const j = ny * p.w + nx;
          if (depth[j] >= 0 || !(mask(j) & OPP[sd])) continue;
          depth[j] = depth[i] + 1;
          parent[j] = OPP[sd];
          queue.push(j);
        }
      }
      let newlyWet = 0, minNew = Infinity;
      for (let i = 0; i < n; i++) if (depth[i] >= 0 && !this.wetSet.has(i)) minNew = Math.min(minNew, depth[i]);
      const watered = [];
      let wateredCount = 0;
      for (let i = 0; i < n; i++) {
        const wet = depth[i] >= 0;
        const was = this.wetSet.has(i);
        const delay = wet && !was ? Math.min(600, (depth[i] - minNew) * 55) : 0;
        this.tiles[i].style.setProperty('--d', delay + 'ms');
        this.tiles[i].classList.toggle('wet', wet);
        const r = this.run.rot[i];
        for (const arm of this.arms[i]) arm.flow.classList.toggle('in', wet && i !== p.src && E.internals.rotCW(arm.side, r) === parent[i]);
        const plant = this.plants[i];
        if (plant) {
          plant.style.setProperty('--d', delay + 'ms');
          plant.classList.toggle('wet', wet);
          if (wet) wateredCount++;
          if (wet && !was) watered.push(i);
        }
        if (wet && !was) newlyWet++;
        if (wet) this.wetSet.add(i); else this.wetSet.delete(i);
      }
      // leaks: a wet pipe end that opens onto nothing
      this.leaks.textContent = '';
      for (let i = 0; i < n; i++) {
        if (depth[i] < 0) continue;
        const m = mask(i), x = i % p.w, y = (i / p.w) | 0;
        for (const sd of [1, 2, 4, 8]) {
          if (!(m & sd)) continue;
          const nx = x + SIDEV[sd][0], ny = y + SIDEV[sd][1];
          const open = nx < 0 || ny < 0 || nx >= p.w || ny >= p.h || !(mask(ny * p.w + nx) & OPP[sd]);
          if (!open) continue;
          const ex = x * 10 + 5 + SIDEV[sd][0] * 4.6, ey = y * 10 + 5 + SIDEV[sd][1] * 4.6;
          const g = s('g', null);
          for (let k = 0; k < 3; k++) {
            const dot = s('circle', { class: 'drip', cx: ex, cy: ey, r: 0.75 });
            dot.style.setProperty('--dx', (SIDEV[sd][0] * 2.4 + (k - 1) * 0.9) + 'px');
            dot.style.setProperty('--dy', (SIDEV[sd][1] * 2.4 + 1.6 + k * 0.4) + 'px');
            g.append(dot);
          }
          this.leaks.append(g);
        }
      }
      this.watered = wateredCount;
      return { newlyWet, watered };
    }
    refresh(animated) {
      this.angle = this.run.rot.map((r, i) => {
        if (!animated || this.angle[i] == null) return r * 90;
        const cur = this.angle[i];
        const base = cur - (((cur % 360) + 360) % 360);
        return base + r * 90;
      });
      this.tiles.forEach((t, i) => this.setAngle(i, !animated));
      this.update();
      this.goal();
      this.svg.classList.toggle('solved', !!(this.summary && this.summary.outcome === 'solved'));
    }
    goal() {
      if (this.plantCount == null) return;
      const w = this.watered || 0;
      this.goalEl.textContent = '';
      this.goalEl.append(icon('sprout'), h('span', { text: w + '/' + this.plantCount }));
      this.goalEl.setAttribute('aria-label', w + ' of ' + this.plantCount + ' plants watered');
    }
    press(i) {
      if (this.summary || this.busy) return;
      Sound.unlock();
      const rec = this.G.tap(this.p, this.run, i);
      this.angle[i] += 90;
      this.setAngle(i, false);
      Sound.play('turn');
      buzz(7);
      this.hideHand();
      const before = this.watered || 0;
      const ch = this.update();
      if (ch.newlyWet) Sound.play('flow');
      ch.watered.forEach((k, idx) => this.later(() => Sound.play('bloom', idx), 160 + idx * 110));
      if ((this.watered || 0) !== before) { this.goalEl.classList.remove('bump'); void this.goalEl.offsetWidth; this.goalEl.classList.add('bump'); }
      if (this.o.feedback && !this.practice) this.flash(i, rec.cls);
      this.commit(rec);
    }
    flash(i, cls) {
      const k = 'q-' + cls;
      this.cells[i].classList.add(k);
      this.later(() => this.cells[i].classList.remove(k), 650);
    }
    afterUndo(r) {
      this.angle[r.index] -= 90;
      this.setAngle(r.index, false);
      this.update();
      this.goal();
    }
    showHint(hint) {
      if (hint.kind !== 'target') return;
      const c = this.cells[hint.index];
      c.classList.add('hinted');
      this.later(() => c.classList.remove('hinted'), 2800);
      this.pointAt(c, 2600);
    }
    guideTarget() {
      const hnt = this.G.hint(this.p, this.run);
      return hnt.kind === 'target' ? this.cells[hnt.index] : null;
    }
    onResolved(outcome) { if (outcome === 'solved') this.svg.classList.add('solved'); }
  }

  // ------------------------------------------------------------- Tumbler
  function gem(c, tag, attrs) {
    const el = h(tag || 'span', Object.assign({ class: 'gem' }, attrs || {}));
    if (c == null) { el.classList.add('empty'); return el; }
    el.style.setProperty('--c', PEGS[c].fill);
    el.append(s('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' }, s('path', { d: PEGS[c].glyph, fill: PEGS[c].ink })));
    return el;
  }
  class TumblerCard extends Card {
    buildBoard() {
      const p = this.p;
      this.signals = (this.extra && this.extra.signals) || [];
      this.draft = this.extra && Array.isArray(this.extra.draft) ? this.extra.draft.slice() : this.freshDraft();
      this.flipRow = -1;
      const vault = h('div', { class: 'vault' });
      this.lightsEl = h('div', { class: 'lights', role: 'img' });
      this.rowsEl = h('div', { class: 'rows', role: 'list', 'aria-label': 'Tries' });
      this.palEl = h('div', { class: 'palette', role: 'group', 'aria-label': 'Colors' });
      for (let c = 0; c < p.C; c++) {
        const b = gem(c, 'button', { type: 'button', 'aria-label': 'Add ' + PEGS[c].name + ' (key ' + (c + 1) + ')' });
        b.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); this.put(c); });
        b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.put(c); } });
        this.palEl.append(b);
      }
      this.clearBtn = h('button', { class: 'vbtn ghost', type: 'button', 'aria-label': 'Clear the row', onclick: () => this.clearDraft() }, icon('erase'));
      this.tryBtn = h('button', { class: 'vbtn go', type: 'button', onclick: () => this.submit() }, icon('key'), 'Try');
      vault.append(this.lightsEl, this.rowsEl, this.palEl, h('div', { class: 'vault-actions' }, this.clearBtn, this.tryBtn));
      this.vault = vault;
      this.area.append(vault);
    }
    // revealed pins are locked in; with per-pin clues, pins already in the right
    // spot carry into the next row too (those can still be changed)
    freshDraft() {
      const d = this.run.revealed.map((c) => (c == null ? null : c));
      const last = this.run.tries[this.run.tries.length - 1];
      if (this.p.clue === 'pin' && last && last.marks) last.marks.forEach((m, k) => { if (m === 2 && d[k] == null) d[k] = last.digits[k]; });
      return d;
    }
    hasHistory() { return false; }
    goal() { this.goalEl.hidden = true; }
    put(c) {
      if (this.summary || this.busy) return;
      Sound.unlock();
      const k = this.draft.indexOf(null);
      if (k < 0) return;
      this.draft[k] = c;
      this.popAt = k;
      Sound.play('pop', c);
      buzz(6);
      this.refresh();
      this.later(() => this.guide(), 120);
    }
    clearSlot(k) {
      if (this.summary || this.busy || this.run.revealed[k] != null || this.draft[k] == null) return;
      this.draft[k] = null;
      Sound.play('unpop');
      this.refresh();
      this.later(() => this.guide(), 120);
    }
    clearDraft() {
      if (this.summary || this.busy) return;
      this.draft = this.freshDraft();
      Sound.play('unpop');
      this.refresh();
      this.later(() => this.guide(), 120);
    }
    refresh() {
      const p = this.p, tries = this.run.tries;
      this.lightsEl.textContent = '';
      for (let i = 0; i < p.max; i++) this.lightsEl.append(h('i', { class: i < p.max - tries.length ? '' : 'out' }));
      this.lightsEl.setAttribute('aria-label', (p.max - tries.length) + ' tries left');
      this.rowsEl.textContent = '';
      let focusRow = null;
      for (let r = 0; r < p.max; r++) {
        const row = h('div', { class: 'row', role: 'listitem' });
        if (r < tries.length) {
          const t = tries[r];
          const marks = p.clue === 'pin' ? t.marks : null;
          t.digits.forEach((d, k) => {
            const g = gem(d);
            if (marks) {
              const show = () => {
                g.classList.add('m' + marks[k]);
                if (marks[k] > 0) g.append(h('span', { class: 'badge' }, icon(marks[k] === 2 ? 'check' : 'swap')));
              };
              if (r === this.flipRow) {
                g.style.animationDelay = k * 150 + 'ms';
                g.classList.add('flip');
                this.later(() => { show(); Sound.play('flip', marks[k]); }, k * 150 + 160);
              } else show();
            }
            row.append(g);
          });
          if (p.clue === 'count') {
            const cnt = h('div', { class: 'counts', 'aria-hidden': 'true' });
            for (let k = 0; k < p.P; k++) cnt.append(h('i', { class: k < t.exact ? 'x' : k < t.exact + t.partial ? 'p' : '' }));
            if (r === this.flipRow) { cnt.style.opacity = '0'; this.later(() => { cnt.style.opacity = '1'; Sound.play('flip', t.exact ? 2 : t.partial ? 1 : 0); }, 260); }
            row.append(cnt);
          }
          const sig = this.signals[r];
          if (sig && this.o.feedback && !this.practice) {
            const meter = h('span', { class: 'signal s' + sig.level, 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
            if (sig.off) meter.append(h('span', { class: 'warn' }));
            row.append(meter);
          }
          row.setAttribute('aria-label', 'Try ' + (r + 1) + ': ' + t.digits.map((d) => PEGS[d].name).join(', ') + '. ' + t.exact + ' right spot, ' + t.partial + ' right color elsewhere.');
          if (r === tries.length - 1) focusRow = row;
        } else if (r === tries.length && !this.summary) {
          row.classList.add('active');
          const firstEmpty = this.draft.indexOf(null);
          this.draft.forEach((d, k) => {
            const locked = this.run.revealed[k] != null;
            const b = gem(d, 'button', { type: 'button', 'aria-label': d == null ? 'Empty slot ' + (k + 1) : (locked ? 'Revealed ' : 'Remove ') + PEGS[d].name + ' in slot ' + (k + 1) });
            if (d == null && k === firstEmpty) b.classList.add('up-next');
            if (locked) b.classList.add('locked');
            if (k === this.popAt && d != null) b.classList.add('pop');
            b.addEventListener('click', () => this.clearSlot(k));
            row.append(b);
          });
          focusRow = row;
        } else {
          for (let k = 0; k < p.P; k++) row.append(gem(null));
        }
        this.rowsEl.append(row);
      }
      this.popAt = -1;
      if (this.summary && this.summary.outcome !== 'solved') {
        const row = h('div', { class: 'row code', 'aria-label': 'The code' });
        p.secretDigits.forEach((d) => row.append(gem(d)));
        this.rowsEl.append(row);
        focusRow = row;
      }
      const full = this.draft.every((d) => d != null);
      this.tryBtn.disabled = !full || !!this.summary || this.busy;
      this.clearBtn.disabled = !!this.summary || this.draft.every((d, k) => d == null || this.run.revealed[k] != null);
      this.palEl.querySelectorAll('button').forEach((b) => { b.disabled = !!this.summary || full; });
      if (focusRow) this.later(() => { try { focusRow.scrollIntoView({ block: 'nearest' }); } catch (e) { /* optional */ } }, 0);
    }
    submit() {
      if (this.summary || this.busy) return;
      if (this.draft.some((d) => d == null)) return;
      Sound.unlock();
      const t = Math.round(this.elapsed());
      const rec = this.G.guess(this.p, this.run, this.draft.slice());
      rec.t_ms = t;
      this.draft = this.freshDraft();
      this.busy = true;
      this.hideHand();
      this.flipRow = this.run.tries.length - 1;
      this.refresh();
      this.flipRow = -1;
      const settle = this.p.clue === 'pin' ? this.p.P * 150 + 260 : 320;
      // feedback is on screen first; the slower information score follows
      this.later(() => {
        this.G.annotate(this.p, rec);
        const ratio = rec.infoBest > 0 ? rec.infoExpected / rec.infoBest : 0;
        this.signals[this.run.tries.length - 1] = {
          level: rec.cls === 'optimal' || rec.cls === 'solved' ? 3 : rec.cls === 'zero_info' ? 0 : ratio >= 0.6 ? 2 : 1,
          off: !rec.consistent && !rec.solved,
        };
        this.busy = false;
        if (rec.solved) this.vault.classList.add('open');
        else if (rec.failed) { this.vault.classList.remove('shake'); void this.vault.offsetWidth; this.vault.classList.add('shake'); }
        this.commit(rec);
        if (!this.summary) this.refresh();
      }, settle);
    }
    moveFields(rec) {
      return {
        move_no: this.c.moves, target: rec.target, cls: rec.cls,
        exact: rec.exact, partial: rec.partial, marks: rec.marks ? rec.marks.join('') : '',
        cands_before: rec.candsBefore, cands_after: rec.candsAfter,
        consistent: rec.consistent ? 1 : 0,
        info_expected: r4(rec.infoExpected), info_best: r4(rec.infoBest), info_actual: r4(rec.infoActual),
        best_try: rec.bestTry || '',
      };
    }
    showHint(hint) {
      if (hint.kind !== 'reveal') return;
      if (this.draft[hint.pos] == null || this.draft[hint.pos] !== hint.color) this.draft[hint.pos] = hint.color;
      this.popAt = hint.pos;
      this.refresh();
      const row = this.rowsEl.querySelector('.row.active');
      const slot = row && row.children[hint.pos];
      if (slot) { const p = relPos(this, slot); sparks(this, p.x, p.y, ['#FFC83A', '#FFFFFF', PEGS[hint.color].fill], 12); }
    }
    guideTarget() {
      if (this.run.tries.length) return null;
      const k = this.draft.indexOf(null);
      if (k === 0 || (k === 1 && this.draft[0] === 0)) return this.palEl.children[k === 0 ? 0 : 1];
      if (k === 1) return this.rowsEl.querySelector('.row.active .gem');
      if (k < 0) return this.tryBtn;
      return null;
    }
    onResolved() { this.refresh(); }
    extraSnapshot() { return { draft: this.draft.slice(), signals: this.signals.slice() }; }
    onKey(e) {
      if (this.summary) return false;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= this.p.C) { this.put(n - 1); return true; }
      if (e.key === 'Backspace') {
        let k = -1;
        this.draft.forEach((d, i) => { if (d != null && this.run.revealed[i] == null) k = i; });
        if (k >= 0) this.clearSlot(k);
        return true;
      }
      if (e.key === 'Enter') { this.submit(); return true; }
      return false;
    }
  }

  // ------------------------------------------------------------- Glimpse
  // All shapes share one 100 x 100 box, so the flash, the mask and the answer
  // buttons draw exactly the same silhouettes. Everything shown during a look
  // is drawn on one canvas inside requestAnimationFrame callbacks, so the
  // flash and the mask change on whole screen frames.
  const GL_PATHS = {
    rabbit: 'M35.18 8.33A8.5 22 -10 1 1 42.82 51.67A8.5 22 -10 1 1 35.18 8.33Z M64.82 8.33A8.5 22 10 1 1 57.18 51.67A8.5 22 10 1 1 64.82 8.33Z M50 39A25 25 0 1 1 50 89A25 25 0 1 1 50 39Z',
    cat: 'M50 33A31 27 0 1 1 50 87A31 27 0 1 1 50 33Z M21 50L25 13L48 35Z M79 50L52 35L75 13Z',
    fox: 'M50 30L58 30L80 7Q85 23 83 40Q91 50 89 58Q79 71 64 77Q56 88 50 93Q44 88 36 77Q21 71 11 58Q9 50 17 40Q15 23 20 7L42 30Z',
    bird: 'M44 36A30 22 0 1 1 44 80A30 22 0 1 1 44 36Z M70 25A15 15 0 1 1 70 55A15 15 0 1 1 70 25Z M84 35L97 41L84 47Z M22 50L8 59L2 33Z',
    leaf: 'M50 5C81 22 83 68 50 94C17 68 19 22 50 5Z M48 88L52 88L52 99L48 99Z',
    butterfly: 'M45.5 54A4.5 22 0 1 1 54.5 54A4.5 22 0 1 1 45.5 54Z M13.2 46.8A20 15 -20 1 1 50.8 33.2A20 15 -20 1 1 13.2 46.8Z M49.2 33.2A20 15 20 1 1 86.8 46.8A20 15 20 1 1 49.2 33.2Z M23.3 57.1A14 12 25 1 1 48.7 68.9A14 12 25 1 1 23.3 57.1Z M51.3 68.9A14 12 -25 1 1 76.7 57.1A14 12 -25 1 1 51.3 68.9Z M49 34L39 17L42 15L52 33Z M51 34L48 33L58 15L61 17Z M40 11.5A3.5 3.5 0 1 1 40 18.5A3.5 3.5 0 1 1 40 11.5Z M60 11.5A3.5 3.5 0 1 1 60 18.5A3.5 3.5 0 1 1 60 11.5Z',
    snail: 'M44 20A25 25 0 1 1 44 70A25 25 0 1 1 44 20Z M47 38A8 8 0 1 0 47 54A8 8 0 1 0 47 38Z M8 77Q10 68 22 67L68 66Q76 64 80 55Q84 47 90 49Q96 52 94 62Q91 75 78 77Z M82 52L77 33L81 32L86 51Z M87 51L91 32L95 33L91 52Z M79 27A4.5 4.5 0 1 1 79 36A4.5 4.5 0 1 1 79 27Z M93 28A4.5 4.5 0 1 1 93 37A4.5 4.5 0 1 1 93 28Z',
    fish: 'M24 50A32 18 0 1 1 88 50A32 18 0 1 1 24 50Z M32 50L14 70L22 50L14 30Z M46 34L60 20L68 34Z M76 42A3.5 3.5 0 1 0 76 49A3.5 3.5 0 1 0 76 42Z',
    turtle: 'M50 22A26 30 0 1 1 50 82A26 30 0 1 1 50 22Z M50 5A10 10 0 1 1 50 25A10 10 0 1 1 50 5Z M12.5 24A14 7 35 1 1 35.5 40A14 7 35 1 1 12.5 24Z M64.5 40A14 7 -35 1 1 87.5 24A14 7 -35 1 1 64.5 40Z M20 80A10 5.5 -37 1 1 36 68A10 5.5 -37 1 1 20 80Z M64 68A10 5.5 37 1 1 80 80A10 5.5 37 1 1 64 68Z M46 80L54 80L50 93Z',
    whale: 'M24 56A32 20 0 1 1 88 56A32 20 0 1 1 24 56Z M32 60L14 40L20 36L36 50Z M3.8 38.4A13 5 -20 1 1 28.2 29.6A13 5 -20 1 1 3.8 38.4Z M50.2 69.5A9 4 30 1 1 65.8 78.5A9 4 30 1 1 50.2 69.5Z M76 50A3.5 3.5 0 1 0 76 57A3.5 3.5 0 1 0 76 50Z',
    star: 'M50 6L62.34 35.01L93.75 37.79L69.97 58.49L77.04 89.21L50 73L22.96 89.21L30.03 58.49L6.25 37.79L37.66 35.01Z',
    sailboat: 'M12 70L88 70L76 86L24 86Z M51 8L51 64L14 64Z M58 18L85 64L58 64Z M51 8L56 8L56 70L51 70Z',
    jellyfish: 'M18 52A32 36 0 0 1 82 52Q74 59 66 52Q58 59 50 52Q42 59 34 52Q26 59 18 52Z M27 54L35 54Q31 68 37 80Q41 90 35 97L27 97Q33 90 29 80Q23 68 27 54Z M46 54L54 54Q58 66 52 78Q48 88 54 97L46 97Q40 88 44 78Q50 66 46 54Z M65 54L73 54Q69 68 75 80Q79 90 73 97L65 97Q71 90 67 80Q61 68 65 54Z',
    shell: 'M50 90L14 46Q10 34 18 28Q20 16 32 14Q38 6 50 8Q62 6 68 14Q80 16 82 28Q90 34 86 46Z M37 84L63 84L65 95L35 95Z',
    plane: 'M46 12Q50 3 54 12L55 84Q50 93 45 84Z M54 34L94 54L94 61L54 52L46 52L6 61L6 54L46 34Z M53 72L72 84L72 89L53 84L47 84L28 89L28 84L47 72Z',
    balloon: 'M50 5C74 5 87 23 87 41C87 59 67 70 59 76L41 76C33 70 13 59 13 41C13 23 26 5 50 5Z M40 75L43.5 75L45.5 86L42 86Z M56.5 75L60 75L58 86L54.5 86Z M39 85L61 85L59 97L41 97Z',
    gull: 'M50 40Q60 29 74 29Q87 29 97 41Q84 38 74 43Q62 47 56 60L44 60Q38 47 26 43Q16 38 3 41Q13 29 26 29Q40 29 50 40Z M50 32A7.5 7.5 0 1 1 50 47A7.5 7.5 0 1 1 50 32Z M43 53A7 12 0 1 1 57 53A7 12 0 1 1 43 53Z',
    kite: 'M50 5L79 38L50 76L21 38Z M47 74L53 74Q58 82 53 88Q49 93 53 98L47 98Q43 93 47 88Q52 82 47 74Z M40 81L50 86L40 91Z M60 81L60 91L50 86Z',
    rocket: 'M50 5Q65 18 65 46L65 72L35 72L35 46Q35 18 50 5Z M50 33A7 7 0 1 0 50 47A7 7 0 1 0 50 33Z M35 52L35 72L20 85L20 74Z M65 52L80 74L80 85L65 72Z M41 72L59 72L50 95Z',
    cloud: 'M20 72A15 15 0 0 1 21 43A17 17 0 0 1 46 28A19 19 0 0 1 78 38A16 16 0 0 1 82 72Z',
  };

  // per scene: field, ink (the silhouettes), and the scene background
  const GL_STYLE = {
    meadow: { field: '#F7FBF2', ink: '#18291F', bg1: '#3A86EE', bg2: '#152C78' },
    sea: { field: '#EEF8FB', ink: '#0B2C3F', bg1: '#1FB2C6', bg2: '#0A3961' },
    sky: { field: '#FFF6EE', ink: '#2A1846', bg1: '#FF9A6A', bg2: '#5A2A88' },
  };
  // the thing that was there, shown afterwards as a bright sticker
  const GL_STICKER = { bird: '#3D8BFD', butterfly: '#FF6FA7', snail: '#FF9F1C', star: '#FFB81F', sailboat: '#FF5D5D', jellyfish: '#A774FF', kite: '#FF5D5D', rocket: '#3D8BFD' };
  const GL_DIRS = ['up', 'up right', 'right', 'down right', 'down', 'down left', 'left', 'up left'];
  const GL_NUMPAD = { 8: 0, 9: 1, 6: 2, 3: 3, 2: 4, 1: 5, 4: 6, 7: 7 };
  const GL_P2D = {};
  function glPath(name) {
    if (!(name in GL_P2D)) { try { GL_P2D[name] = new Path2D(GL_PATHS[name]); } catch (e) { GL_P2D[name] = null; } }
    return GL_P2D[name];
  }
  function glDraw(ctx, name, x, y, size, rot, flip) {
    const p = glPath(name);
    if (!p) return;
    const k = size / 100;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(flip ? -k : k, k);
    ctx.translate(-50, -50);
    ctx.fill(p);
    ctx.restore();
  }
  function glSvg(name) {
    return s('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' }, s('path', { d: GL_PATHS[name] }));
  }
  function glXY(G, R, slot) {
    const sl = G.slots[slot], a = (sl.a * Math.PI) / 180;
    return [R + Math.sin(a) * sl.r * R, R - Math.cos(a) * sl.r * R];
  }
  // the middle item at 0.34 R, the target and distractors at 0.2 R, all in one ink on the pale field
  const GL_CENTER = 0.34, GL_ITEM = 0.2;
  function glStim(ctx, R, p, t, G, ink) {
    ctx.fillStyle = ink;
    glDraw(ctx, p.pair[t.c], R, R, GL_CENTER * R, 0, false);
    if (!p.periph) return;
    const size = GL_ITEM * R;
    const b = glXY(G, R, G.slotOf(t.ring, t.dir));
    glDraw(ctx, t.tg || 'bird', b[0], b[1], size, 0, !!t.flip);
    for (const d of t.d) { const q = glXY(G, R, d[0]); glDraw(ctx, p.distractor || 'leaf', q[0], q[1], size, d[1], false); }
  }
  // pattern mask: outlines of the scene's own shapes on every position an item can take
  // (the 48 ring spots and the middle), then a scatter of outlines and short strokes
  function glMask(ctx, R, seed, names, ink, G) {
    const rng = E.makeRng(seed);
    const pt = (maxR) => { const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * maxR; return [R + Math.cos(a) * r, R + Math.sin(a) * r]; };
    const outline = (x, y, size) => {
      const path = glPath(names[rng.int(names.length)]);
      if (!path) return;
      const k = size / 100;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rng() * Math.PI * 2);
      ctx.scale(k, k);
      ctx.translate(-50, -50);
      ctx.lineWidth = (0.014 * R) / k;
      ctx.stroke(path);
      ctx.restore();
    };
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const jit = () => (rng() - 0.5) * 0.08 * R;
    for (let k = 0; k < G.slots.length; k++) { const q = glXY(G, R, k); outline(q[0] + jit(), q[1] + jit(), (0.18 + rng() * 0.1) * R); }
    for (let k = 0; k < 3; k++) outline(R + jit(), R + jit(), (0.26 + rng() * 0.14) * R);
    for (let i = 0; i < 18; i++) { const q = pt(1.02 * R); outline(q[0], q[1], (0.14 + rng() * 0.18) * R); }
    for (let i = 0; i < 110; i++) {
      const q = pt(1.05 * R);
      const len = (0.035 + rng() * 0.1) * R, a = rng() * Math.PI * 2;
      ctx.lineWidth = (0.008 + rng() * 0.014) * R;
      ctx.beginPath();
      if (rng() < 0.55) { ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + Math.cos(a) * len, q[1] + Math.sin(a) * len); }
      else ctx.arc(q[0], q[1], len * 0.6, a, a + 1 + rng() * 3);
      ctx.stroke();
    }
    ctx.restore();
  }
  // fixation: a dot inside a ring that closes in over the first GL_RING_MS
  const GL_RING_MS = 260;
  function glFix(ctx, R, k, ink) {
    const e = k == null ? 1 : 1 - Math.pow(1 - Math.min(1, k), 3);
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.arc(R, R, Math.max(3, 0.022 * R), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35 + 0.65 * e;
    ctx.lineWidth = Math.max(1.5, 0.009 * R);
    ctx.beginPath();
    ctx.arc(R, R, (0.075 + 0.2 * (1 - e)) * R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const raf = (fn) => (window.requestAnimationFrame ? window.requestAnimationFrame(fn) : setTimeout(() => fn(now()), 16));
  const caf = (id) => { if (id == null) return; if (window.cancelAnimationFrame) window.cancelAnimationFrame(id); else clearTimeout(id); };
  // frame period: median interval between animation frames during fixation,
  // snapped to a standard refresh rate when within 1.5% (timestamps can be coarse)
  const GL_RATES = [24, 30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];
  function frameEstimate(deltas, fallback) {
    const xs = deltas.slice(2).filter((d) => d > 2 && d < 120).sort((a, b) => a - b);
    if (xs.length < 8) return fallback;
    const m = xs[xs.length >> 1];
    for (const hz of GL_RATES) { const P = 1000 / hz; if (Math.abs(m - P) / P < 0.015) return P; }
    return Math.max(4, Math.min(70, m));
  }

  class GlimpseCard extends Card {
    freshRun(p) { return this.G.newRun(p, this.app.glimpseStart(this.spec)); }
    usesClock() { return false; }
    potentialStars() { return 3; }
    refresh() {}
    buildBoard() {
      const p = this.p;
      this.phase = this.summary ? 'done' : 'ready';
      this.D = 0; this.R = 0; this.dpr = 1;
      const look = GL_STYLE[p.theme] || GL_STYLE.meadow;
      this.ink = look.ink;
      this.maskShapes = p.pair.concat(p.targetSet || ['bird'], [p.distractor || 'leaf']);
      this.el.dataset.theme = p.theme || 'meadow';
      this.el.style.setProperty('--bg1', look.bg1);
      this.el.style.setProperty('--bg2', look.bg2);
      this.lens = h('div', { class: 'gl-lens' });
      this.lens.style.setProperty('--gl-ink', look.ink);
      this.lens.style.setProperty('--gl-field', look.field);
      this.canvas = h('canvas', { class: 'gl-canvas', 'aria-hidden': 'true' });
      this.stimC = document.createElement('canvas');
      this.maskC = document.createElement('canvas');
      this.goBtn = h('button', { class: 'gl-go', type: 'button', 'aria-label': 'Look' }, icon('eye'));
      this.goBtn.addEventListener('click', () => this.begin());
      this.choiceEl = h('div', { class: 'gl-choices', role: 'group', 'aria-label': 'Which animal', hidden: true });
      this.choiceBtns = p.pair.map((name, k) => {
        const b = h('button', { class: 'gl-choice', type: 'button', 'aria-label': name }, glSvg(name));
        b.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); e.stopPropagation(); this.pick(k); });
        b.addEventListener('click', () => this.pick(k));
        this.choiceEl.append(b);
        return b;
      });
      this.spotsEl = h('div', { class: 'gl-spots', role: 'group', 'aria-label': 'Where the bird was', hidden: true });
      this.spotBtns = GL_DIRS.map((name, d) => {
        const b = h('button', { class: 'gl-spot', type: 'button', 'aria-label': name });
        b.addEventListener('click', () => this.where(d));
        this.spotsEl.append(b);
        return b;
      });
      this.lens.addEventListener('pointerdown', (e) => this.lensDown(e));
      this.dotsEl = h('div', { class: 'gl-dots', 'aria-hidden': 'true' });
      this.lens.append(this.canvas, this.spotsEl, this.choiceEl, this.goBtn);
      this.area.classList.add('gl-area');
      this.area.append(h('div', { class: 'gl-wrap' }, this.lens, this.dotsEl));
      if (this.phase === 'done') this.goBtn.hidden = true;
      else if (this.run.i >= p.n) this.later(() => this.resolve('complete'), 0);
      this.renderDots();
      if (typeof ResizeObserver !== 'undefined') {
        this.ro = new ResizeObserver(() => this.onResize());
        this.ro.observe(this.area);
      } else {
        this.onWinResize = () => this.onResize();
        window.addEventListener('resize', this.onWinResize);
      }
    }
    destroy() {
      super.destroy();
      caf(this.rafId);
      this.st = null;
      if (this.ro) this.ro.disconnect();
      if (this.onWinResize) window.removeEventListener('resize', this.onWinResize);
      this.app.steady(false);
    }
    // ---- layout
    onResize() {
      const changed = this.layout();
      if (changed) this.abort('resize');
    }
    layout() {
      const aw = this.area.clientWidth - 28, ah = this.area.clientHeight - 24 - 26;
      if (aw <= 0 || ah <= 0) return false;
      let D = Math.floor(Math.min(aw, ah, 720));
      D = Math.max(180, D - (D % 2));
      // keep the field (and so every eccentricity) fixed through small layout shifts
      if (this.D && Math.abs(D - this.D) < this.D * 0.04) return false;
      this.D = D;
      this.R = D / 2;
      this.lens.style.width = D + 'px';
      this.lens.style.height = D + 'px';
      this.lens.style.setProperty('--R', this.R + 'px');
      this.dpr = Math.min(3, window.devicePixelRatio || 1);
      const px = Math.round(D * this.dpr);
      [this.canvas, this.stimC, this.maskC].forEach((c) => { c.width = px; c.height = px; });
      this.ctx = this.canvas.getContext('2d');
      this.placeSpots();
      this.clearReveal();
      return true;
    }
    placeSpots() {
      if (!this.R) return;
      const t = this.p.trials[Math.min(this.run.i, this.p.n - 1)];
      const rr = this.G.ringR[((t && t.ring) || 2) - 1] * this.R;
      const size = Math.round(Math.max(30, Math.min(48, 0.24 * this.R)));
      this.spotBtns.forEach((b, d) => {
        const a = (d * Math.PI) / 4;
        b.style.left = this.R + Math.sin(a) * rr + 'px';
        b.style.top = this.R - Math.cos(a) * rr + 'px';
        b.style.width = size + 'px';
        b.style.height = size + 'px';
        b.style.margin = -size / 2 + 'px 0 0 ' + -size / 2 + 'px';
      });
    }
    // ---- drawing
    blit(src) {
      const c = this.ctx;
      if (!c) return;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, this.canvas.width, this.canvas.height);
      if (src) c.drawImage(src, 0, 0);
    }
    drawFix(k) {
      this.blit(null);
      if (!this.ctx) return;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      glFix(this.ctx, this.R, k, this.ink);
    }
    prepare() {
      const t = this.p.trials[this.run.i], W = this.canvas.width, k = this.dpr;
      const sc = this.stimC.getContext('2d');
      sc.setTransform(1, 0, 0, 1, 0, 0);
      sc.clearRect(0, 0, W, W);
      sc.setTransform(k, 0, 0, k, 0, 0);
      glStim(sc, this.R, this.p, t, this.G, this.ink);
      const mc = this.maskC.getContext('2d');
      mc.setTransform(1, 0, 0, 1, 0, 0);
      mc.clearRect(0, 0, W, W);
      mc.setTransform(k, 0, 0, k, 0, 0);
      glMask(mc, this.R, t.mask, this.maskShapes, this.ink, this.G);
    }
    // ---- one look: fixation, flash, mask, then the two answers
    begin() {
      if (this.summary || this.phase !== 'ready' || this.run.i >= this.p.n) return;
      Sound.unlock();
      Sound.play('look');
      this.hideHand();
      this.startLook();
    }
    startLook() {
      if (!this.R) this.layout();
      if (!this.ctx) { this.phase = 'ready'; return; }
      this.prepare();
      this.goBtn.classList.add('away');
      this.goBtn.disabled = true;
      this.app.steady(true);
      this.phase = 'fix';
      this.runLook();
    }
    runLook() {
      const p = this.p, t = p.trials[this.run.i];
      const st = { deltas: [], start: null, last: null, onset: null, offset: null, end: null, gap: 0, plan: null, T: null };
      this.st = st;
      const step = (ts) => {
        if (this.st !== st) return;
        if (st.last != null) {
          const d = ts - st.last;
          if (this.phase === 'fix') st.deltas.push(d);
          else if (this.phase === 'stim') st.gap = Math.max(st.gap, d);
        }
        st.last = ts;
        if (this.phase === 'fix') {
          if (st.start == null) { st.start = ts; this.drawFix(0); }
          else if (ts - st.start < GL_RING_MS) this.drawFix((ts - st.start) / GL_RING_MS);
          else if (!st.ringDone) { st.ringDone = true; this.drawFix(1); }
          if (st.start !== ts && ts - st.start >= t.fix) {
            st.T = frameEstimate(st.deltas, this.app.frameMs);
            this.app.frameMs = st.T;
            st.plan = this.G.plan(p, this.run, st.T);
            this.blit(this.stimC);
            st.onset = ts;
            this.phase = 'stim';
          }
        } else if (this.phase === 'stim') {
          if (ts - st.onset >= (st.plan.frames - 0.5) * st.T) {
            this.blit(this.maskC);
            st.offset = ts;
            this.phase = 'mask';
          }
        } else if (this.phase === 'mask') {
          if (ts - st.offset >= p.maskMs - st.T / 2) {
            this.blit(null);
            st.end = ts;
            this.app.steady(false);
            this.askWhat();
            return;
          }
        } else return;
        this.rafId = raf(step);
      };
      this.rafId = raf(step);
    }
    abort(reason) {
      const ph = this.phase;
      if (ph !== 'fix' && ph !== 'stim' && ph !== 'mask') return;
      caf(this.rafId);
      this.rafId = null;
      this.st = null;
      this.blit(null);
      this.app.steady(false);
      this.log('interrupted', { move_no: this.run.i + 1, detail: ph + ', ' + reason });
      this.phase = 'ready';
      this.goBtn.disabled = false;
      this.goBtn.classList.remove('away');
    }
    onHidden() { this.abort('page hidden'); }
    askWhat() {
      this.phase = 'what';
      this.ans = {};
      this.choiceBtns.forEach((b) => { b.className = 'gl-choice'; b.disabled = false; });
      this.choiceEl.classList.remove('gone');
      this.choiceEl.hidden = false;
      this.whatAt = now();
      this.later(() => this.guide(), 260);
    }
    pick(k) {
      if (this.phase !== 'what') return;
      Sound.unlock();
      this.ans.c = k;
      this.ans.rtC = Math.round(now() - this.whatAt);
      Sound.play('pick', k);
      buzz(6);
      this.choiceBtns[k].classList.add('picked');
      this.hideHand();
      if (this.p.periph) this.askWhere(); else this.finishLook();
    }
    askWhere() {
      this.phase = 'where';
      this.choiceEl.classList.add('gone');
      this.placeSpots();
      this.spotBtns.forEach((b) => { b.className = 'gl-spot'; b.disabled = false; });
      this.spotsEl.hidden = false;
      this.whereAt = now();
      this.later(() => this.guide(), 260);
    }
    lensDown(e) {
      if (this.phase !== 'where' || e.button > 0) return;
      const r = this.lens.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < 0.16 * this.R) return;
      e.preventDefault();
      let a = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (a < 0) a += 360;
      this.where(Math.round(a / 45) % 8);
    }
    where(d) {
      if (this.phase !== 'where') return;
      Sound.unlock();
      this.ans.d = d;
      this.ans.rtW = Math.round(now() - this.whereAt);
      this.spotBtns[d].classList.add('picked');
      Sound.play('pick', 2);
      buzz(6);
      this.hideHand();
      this.finishLook();
    }
    finishLook() {
      this.phase = 'fb';
      const p = this.p, t = p.trials[this.run.i], st = this.st, a = this.ans;
      const cOk = a.c === t.c, dOk = p.periph ? a.d === t.dir : true;
      const correct = cOk && dOk;
      const measured = st.offset - st.onset;
      const planned = st.plan.frames * st.T;
      const drop = Math.abs(measured - planned) > 0.5 * st.T || st.gap > 1.5 * st.T;
      const rec = this.G.record(p, this.run, { correct, plan: st.plan, drop });
      this.st = null;
      this.c.moves++;
      this.app.session.hasMoves = true;
      this.log('trial', {
        move_no: rec.i,
        cls: correct ? 'correct' : !cOk && !dOk ? 'both_wrong' : !cOk ? 'center_wrong' : 'where_wrong',
        refresh_ms: r4(st.T), frames: st.plan.frames, flash_ms: r4(planned), flash_measured_ms: r4(measured), frame_drop: drop ? 1 : 0,
        fix_ms: Math.round(st.onset - st.start), mask_ms: Math.round(st.end - st.offset),
        target: p.periph ? t.tg || 'bird' : '', shown: p.pair[t.c], chosen: p.pair[a.c],
        ring: p.periph ? t.ring : '', dir: p.periph ? t.dir : '', dir_chosen: p.periph ? a.d : '', n_distract: p.periph ? t.d.length : '',
        rt_center_ms: a.rtC, rt_where_ms: p.periph ? a.rtW : '',
        stair_next_ms: rec.next == null ? '' : rec.next, reversal: p.fixedMs ? '' : rec.rev,
        field_px: Math.round(this.R),
      });
      const show = this.o.feedback || this.practice;
      this.feedback(correct, cOk, dOk, t, a, show);
      this.renderDots();
      this.updateStatus();
      this.app.touch();
      this.later(() => this.nextLook(), show ? 700 : 300);
    }
    feedback(correct, cOk, dOk, t, a, show) {
      if (!show) { Sound.play('tick'); return; }
      let spark = null;
      // what was there: the animal in the middle, ringed green or red
      this.choiceEl.hidden = true;
      const ans = h('div', { class: 'gl-answer ' + (cOk ? 'ok' : 'bad'), 'aria-hidden': 'true' }, glSvg(this.p.pair[t.c]));
      this.lens.append(ans);
      this.answerEl = ans;
      if (this.p.periph) {
        this.spotBtns.forEach((b, d) => { b.disabled = true; b.classList.toggle('fade', d !== t.dir && d !== a.d); });
        this.spotBtns[t.dir].classList.add('ok');
        if (!dOk) this.spotBtns[a.d].classList.add('bad');
        const q = glXY(this.G, this.R, this.G.slotOf(t.ring, t.dir));
        const size = Math.round(0.24 * this.R);
        const tg = t.tg || 'bird';
        const bird = h('div', { class: 'gl-bird' + (t.flip ? ' flip' : ''), 'aria-hidden': 'true' },
          s('svg', { viewBox: '-6 -6 112 112' }, s('path', { d: GL_PATHS[tg], fill: GL_STICKER[tg] || '#3D8BFD', stroke: '#FFFFFF', 'stroke-width': 9, 'stroke-linejoin': 'round', 'paint-order': 'stroke' })));
        bird.style.cssText = 'left:' + q[0] + 'px;top:' + q[1] + 'px;width:' + size + 'px;height:' + size + 'px;margin:' + -size / 2 + 'px 0 0 ' + -size / 2 + 'px';
        this.lens.append(bird);
        this.revealEl = bird;
        spark = q;
      }
      Sound.play(correct ? 'yes' : 'no');
      buzz(correct ? 12 : [24, 40, 24]);
      if (correct) {
        const L = relPos(this, this.lens);
        const q = spark || [this.R, this.R];
        sparks(this, L.x - this.R + q[0], L.y - this.R + q[1], ['#FFC83A', '#FFFFFF', '#7CE3B0'], 12);
      }
    }
    clearReveal() {
      if (this.revealEl) { this.revealEl.remove(); this.revealEl = null; }
      if (this.answerEl) { this.answerEl.remove(); this.answerEl = null; }
    }
    nextLook() {
      if (this.summary) return;
      this.clearReveal();
      this.choiceEl.hidden = true;
      this.spotsEl.hidden = true;
      if (this.run.i >= this.p.n) { this.resolve('complete'); return; }
      this.placeSpots();
      this.startLook();
    }
    // ---- status
    nextMs() {
      if (this.p.fixedMs) return this.p.fixedMs[Math.min(this.run.i, this.p.n - 1)];
      return this.run.ms;
    }
    goal() {
      const ms = this.nextMs();
      const txt = Math.round(ms) + ' ms';
      if (this.goalTxt !== txt) {
        const faster = this.goalMs != null && ms < this.goalMs;
        this.goalTxt = txt;
        this.goalMs = ms;
        this.goalEl.textContent = '';
        this.goalEl.append(icon('bolt'), h('span', { text: txt }));
        if (faster) { this.goalEl.classList.remove('bump'); void this.goalEl.offsetWidth; this.goalEl.classList.add('bump'); }
      }
      this.goalEl.classList.add('speed');
      this.goalEl.hidden = !(this.o.counter || this.practice);
      this.goalEl.setAttribute('aria-label', 'Next flash ' + txt);
    }
    updateStatus() {
      super.updateStatus();
      this.meterEl.hidden = true;
    }
    renderDots() {
      const n = this.p.n, res = this.run.res, show = this.o.feedback || this.practice;
      this.dotsEl.textContent = '';
      for (let i = 0; i < n; i++) {
        const r = res[i];
        this.dotsEl.append(h('i', { class: r ? (show ? (r.ok ? 'ok' : 'bad') : 'done') : i === res.length && !this.summary ? 'now' : '' }));
      }
    }
    guideTarget() {
      if (this.summary) return null;
      if (this.phase === 'ready') return this.goBtn;
      if (this.run.i !== 0) return null;
      const t = this.p.trials[this.run.i];
      if (this.phase === 'what') return this.choiceBtns[t.c];
      if (this.phase === 'where') return this.spotBtns[t.dir];
      return null;
    }
    // ---- end of the round
    beforeResolve() {
      caf(this.rafId);
      this.rafId = null;
      this.st = null;
      this.blit(null);
      this.app.steady(false);
      this.phase = 'done';
      this.goBtn.hidden = true;
      this.choiceEl.hidden = true;
      this.spotsEl.hidden = true;
      this.clearReveal();
    }
    makeSummary(outcome, dur) {
      const g = this.G.summary(this.p, this.run);
      const complete = outcome === 'complete';
      // a finished round always earns a star; misses take the other two away
      const miss = g.n - g.correct;
      const stars = complete && !this.practice ? (miss <= 1 ? 3 : miss === 2 ? 2 : 1) : 0;
      return {
        outcome,
        success: complete && !this.practice && g.threshold_ms != null && this.p.advanceMs != null && g.threshold_ms <= this.p.advanceMs,
        duration_ms: dur, first_move_ms: null, hidden_ms: Math.round(this.hiddenMs),
        moves: g.n, reference: null, par: null, efficiency: '',
        stars, gl: g,
      };
    }
    celebrate(sm) {
      this.renderDots();
      if (sm.outcome !== 'complete') return 300;
      Sound.play('win');
      if (sm.stars >= 3 || this.practice) {
        buzz([18, 50, 18]);
        this.later(() => confetti(this, CONFETTI.glimpse), 120);
        return 650;
      }
      return 480;
    }
    resultTitle(sm) {
      if (sm.outcome !== 'complete') return super.resultTitle(sm);
      if (this.practice) return 'Got it!';
      if (!this.o.counter) return 'Done!';
      if (sm.gl.correct === sm.gl.n) return 'Perfect!';
      return sm.stars === 3 ? 'Great!' : sm.stars === 2 ? 'Nice!' : 'Done!';
    }
    resultStats(sm) {
      const g = sm.gl;
      if (!g || !g.n) return null;
      return h('div', { class: 'res-stats' },
        h('span', { 'aria-label': 'Fastest correct look' }, icon('bolt'), h('b', { text: g.best_ms != null ? Math.round(g.best_ms) + ' ms' : '–' })),
        h('span', { 'aria-label': 'Looks right' }, icon('eye'), h('b', { text: g.correct + '/' + g.n })));
    }
    onKey(e) {
      if (this.summary) return false;
      const k = e.key;
      if (this.phase === 'ready' && (k === ' ' || k === 'Enter')) { this.begin(); return true; }
      if (this.phase === 'what') {
        if (k === 'ArrowLeft' || k === '1') { this.pick(0); return true; }
        if (k === 'ArrowRight' || k === '2') { this.pick(1); return true; }
      }
      if (this.phase === 'where') {
        const n = parseInt(k, 10);
        if (GL_NUMPAD[n] != null) { this.where(GL_NUMPAD[n]); return true; }
        const arrows = { ArrowUp: 0, ArrowRight: 2, ArrowDown: 4, ArrowLeft: 6 };
        if (arrows[k] != null) { this.where(arrows[k]); return true; }
      }
      return false;
    }
  }

  function makeCard(app, spec, puzzle, snap) {
    if (spec.game === 'outbound') return new OutboundCard(app, spec, puzzle, snap);
    if (spec.game === 'conduit') return new ConduitCard(app, spec, puzzle, snap);
    if (spec.game === 'glimpse') return new GlimpseCard(app, spec, puzzle, snap);
    return new TumblerCard(app, spec, puzzle, snap);
  }

  // ============================================================ export
  const EVENT_COLS = ['session_id', 'participant', 'condition', 'session_kind', 'session_seed', 'app_version', 'event_index', 'event', 'wall_time', 't_session_ms', 'seq', 'block', 'puzzle_id', 'puzzle_seed', 'game', 'level', 'adaptive', 'practice', 't_ms', 'move_no', 'target', 'from', 'to', 'd_before', 'd_after', 'cls', 'exact', 'partial', 'marks', 'cands_before', 'cands_after', 'consistent', 'info_expected', 'info_best', 'info_actual', 'best_try',
    'refresh_ms', 'frames', 'flash_ms', 'flash_measured_ms', 'frame_drop', 'fix_ms', 'mask_ms', 'shown', 'chosen', 'ring', 'dir', 'dir_chosen', 'n_distract', 'rt_center_ms', 'rt_where_ms', 'stair_next_ms', 'reversal', 'field_px', 'detail'];
  const PUZZLE_COLS = ['session_id', 'participant', 'condition', 'session_kind', 'session_seed', 'app_version', 'seq', 'block', 'in_block', 'puzzle_id', 'puzzle_seed', 'game', 'level', 'adaptive', 'practice', 'params', 'outcome', 'success', 'stars', 'started_at', 'ended_at', 'duration_ms', 'first_move_ms', 'hidden_ms', 'moves', 'reference', 'par', 'efficiency', 'n_optimal', 'n_wasted', 'n_dead_end', 'n_in_dead_end', 'n_blocked', 'n_undo', 'n_restart', 'n_hint', 'n_suboptimal', 'n_zero_info', 'n_inconsistent', 'mean_info_ratio',
    'n_correct', 'accuracy', 'threshold_ms', 'best_ms', 'start_ms', 'end_ms', 'n_reversals', 'refresh_ms', 'n_frame_drops', 'field_px', 'level_next', 'features'];

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
        delete out.live; delete out.hasMoves; delete out.t0wall; delete out.pending;
        return out;
      }),
    }, null, 1);
  }
  const CODEBOOK = {
    events: [
      ['session_id', 'random id for one sitting'],
      ['participant / condition', 'as typed in the session setup'],
      ['session_kind', 'study, or free for free play'],
      ['session_seed', 'with the plan, this fixes every puzzle'],
      ['event_index', 'order of the event within the session'],
      ['event', 'session_start, puzzle_start, move, blocked, undo, restart, hint, trial (one Glimpse look), interrupted (a Glimpse look stopped before the answers, not scored), hidden, visible, puzzle_end, level_change, resume, session_end'],
      ['wall_time / t_session_ms', 'clock time, and ms since the session started'],
      ['seq / block', 'puzzle number in the plan and its block; practice boards have block 0 and seq 0'],
      ['puzzle_id', 'B{block}-{game}-L{level}-{occurrence}, or P-{game} for a practice board'],
      ['practice', '1 for a practice board (fixed, the same for everyone)'],
      ['t_ms', 'ms since this puzzle appeared (Tumbler: when the try was submitted)'],
      ['move_no', 'state-changing moves so far in this puzzle, including moves later undone; Glimpse: the look number in the round'],
      ['target', 'Outbound: car id (c1...). Conduit: tile r{row}c{col}. Tumbler: the try as letters, or pin{n}={letter} for a revealed pin. Glimpse: the thing out around the middle (bird, butterfly, star...)'],
      ['from / to', 'Outbound: cells driven forward from the start position, or exit. Conduit: quarter turns clockwise away from the solved orientation'],
      ['d_before / d_after', 'fewest moves (Outbound) or turns (Conduit) still needed before and after; inf = can no longer be solved'],
      ['cls', 'move label, see below'],
      ['exact / partial', 'Tumbler: pins with the right color in the right spot, and right colors in the wrong spot'],
      ['marks', 'Tumbler with per-pin clues: one digit per pin, 2 right spot, 1 elsewhere, 0 not in the code'],
      ['cands_before / cands_after', 'Tumbler: codes still consistent with every clue before and after the try or hint'],
      ['consistent', 'Tumbler: 1 if the try could still have been the code'],
      ['info_expected / info_best / info_actual', 'Tumbler, in bits: expected information of the try, of the most informative possible try, and information actually gained'],
      ['best_try', 'Tumbler: one most informative try at that point'],
      ['refresh_ms', 'Glimpse: screen frame period measured during the fixation just before the flash (median interval between animation frames, snapped to the nearest standard rate such as 60 or 120 Hz when within 1.5%)'],
      ['frames / flash_ms', 'Glimpse: planned display time in whole frames, and frames x refresh_ms'],
      ['flash_measured_ms', 'Glimpse: time between the animation frame that drew the flash and the one that drew the mask'],
      ['frame_drop', 'Glimpse: 1 if flash_measured_ms missed the plan by more than half a frame, or a frame interval during the flash exceeded 1.5 periods; consider excluding these looks'],
      ['fix_ms / mask_ms', 'Glimpse: measured fixation time before the flash (planned 400 to 699, seeded) and mask time (planned 300)'],
      ['shown / chosen', 'Glimpse: the item in the middle, and the one picked'],
      ['ring / dir / dir_chosen', 'Glimpse: the bird\'s ring (1 inner to 3 outer) and direction (0 = up, clockwise in 45 degree steps), and the direction tapped'],
      ['n_distract', 'Glimpse: distractors around the target (leaves, shells or clouds, by scene)'],
      ['rt_center_ms / rt_where_ms', 'Glimpse: time to pick the animal from when the choices appeared, and to tap a place from when the spots appeared; answers are not speeded'],
      ['stair_next_ms / reversal', 'Glimpse: display time planned for the next look, and 1 if this look reversed the staircase direction'],
      ['field_px', 'Glimpse: field radius in CSS pixels; degrees of visual angle depend on the screen and viewing distance'],
      ['detail', 'extra context: puzzle features at puzzle_start, the blocking car for blocked taps, hidden time at visible, the phase of an interrupted look'],
    ],
    puzzles: [
      ['params', 'board description'],
      ['outcome', 'solved, failed, skipped, timeout, abandoned; Glimpse rounds end complete when every look is answered'],
      ['success', '1 if solved with moves <= par (drives adaptive levels); Glimpse: a complete round with threshold_ms at or under the level\'s target'],
      ['stars', '3 = solved in the fewest moves, 2 = at or under par, 1 = solved, 0 = not solved. Glimpse: 3 = at most 1 miss in the round, 2 = two misses, 1 = more; every finished round earns at least 1'],
      ['duration_ms / first_move_ms / hidden_ms', 'time on the puzzle, time to first move, time the page was hidden'],
      ['moves', 'Outbound: car moves that changed the lot. Conduit: turns. Tumbler: tries'],
      ['reference', 'Outbound: fewest moves. Conduit: fewest turns. Tumbler: tries used by the most-informative-try solver for this code'],
      ['par / efficiency', 'ceil(reference x multiplier); reference / moves (Tumbler can exceed 1 by luck)'],
      ['n_*', 'counts of each move label and of undo, restart, hint; blank when it does not apply to the game'],
      ['mean_info_ratio', 'Tumbler: mean of info_expected / info_best over tries'],
      ['n_correct / accuracy', 'Glimpse: looks with the animal and the place both right, and their share'],
      ['threshold_ms', 'Glimpse: geometric mean display time over the round, leaving out a fresh staircase\'s descent before its first miss; the staircase settles at 80% correct'],
      ['best_ms', 'Glimpse: shortest display time answered correctly'],
      ['start_ms / end_ms', 'Glimpse: staircase value at the start of the round, and the value carried to the next round'],
      ['n_reversals', 'Glimpse: staircase reversals in the round'],
      ['refresh_ms / n_frame_drops / field_px', 'Glimpse: median frame period over the round, looks flagged frame_drop, field radius in CSS pixels'],
      ['level_next', 'adaptive blocks: this game\'s level for its next puzzle'],
      ['features', 'solver-derived puzzle features (JSON), such as p_random_solve, dead_end_states, search_nodes, solver_path'],
    ],
    classes: {
      outbound: 'optimal (one step closer), wasted (no closer, still solvable), dead_end (the lot can no longer be cleared), in_dead_end (a move made while already in a dead end), blocked (the car could not move; its own event)',
      conduit: 'optimal (the tile needed that turn), wasted (the tile was already right)',
      tumbler: 'optimal (as informative as the best possible try), suboptimal (less informative), zero_info (could not narrow the codes), solved (the winning try); consistency is its own column',
      glimpse: 'correct (animal and place right; only the animal at level 1), center_wrong, where_wrong, both_wrong',
    },
    colors: 'Tumbler letters: A red (circle), B blue (square), C yellow (triangle), D green (diamond), E purple (plus), F orange (star), G teal (bar). Keys 1 to 7 enter them in order.',
  };
  function codebookMarkdown() {
    const lv = (g) => Object.keys(E.games[g].levels).map((k) => {
      const L = E.games[g].levels[k];
      if (g === 'tumbler') return '- L' + k + ': per-pin clues ' + L.pin.P + ' pins x ' + L.pin.C + ' colors, ' + L.pin.max + ' tries; count clues ' + L.count.P + ' pins x ' + L.count.C + ' colors, ' + L.count.max + ' tries';
      if (g === 'glimpse') return '- L' + k + ': ' + E.games.glimpse.describe(L) + '; ' + L.looks + ' looks a round; success at threshold_ms <= ' + L.advanceMs;
      const desc = E.games[g].describe(Object.assign({}, L, { cars: { length: L.cars } }));
      return '- L' + k + ': ' + desc + (g === 'outbound' ? ', ' + (L.traps || 0) + ' planted trap' + (L.traps === 1 ? '' : 's') : '');
    }).join('\n');
    const lines = [
      '# Puzzle Reel codebook (app ' + APP_VERSION + ', engines ' + E.version + ')', '',
      'Every puzzle comes from (session seed, block, game, level, occurrence). The same seed and plan give the same puzzles on any device. Practice boards are fixed.', '',
      '## Event columns', '',
    ].concat(CODEBOOK.events.map((r) => '- `' + r[0] + '`: ' + r[1]), ['', '## Puzzle columns', ''], CODEBOOK.puzzles.map((r) => '- `' + r[0] + '`: ' + r[1]), ['', '## Move labels (`cls`)', ''],
      Object.keys(CODEBOOK.classes).map((g) => '- ' + E.games[g].name + ': ' + CODEBOOK.classes[g]),
      ['', '## Tumbler', '', CODEBOOK.colors, 'Per-pin clues mark every pin (repeated colors are matched left to right, as in Wordle). Count clues only give the two totals. A hint reveals the leftmost pin the clues have not settled. With per-pin clues, pins already in the right spot are filled into the next row; the player can change them.', '',
        '## Levels', '', '### Outbound', lv('outbound'), 'L1 and L2 can be cleared by tapping only cars with a clear way out. L3 to L5 contain pinwheels, four cars that each block the next, so one car must first slide part of the way (feature `slides_needed`: 1 at L3 and L4, 2 at L5); L4 adds a planted trap, and L4 and L5 are chosen by the chance that random tapping clears the lot (feature `p_random_solve`).', '', '### Conduit', lv('conduit'), 'L4 and L5 keep the board that needs the most search beyond local edge rules out of 8 candidates. Tiles start turned so that no pipe points off the board and about a quarter sit in their solved turn; every board needs between 0.42 and 0.5 turns per tile. Every pipe is needed: a board is rejected when all plants could get water without a leak while some pipe stays dry, so a garden in full bloom always means a solved board.', '', '### Tumbler', lv('tumbler'), '', '### Glimpse', lv('glimpse'),
        'Rings sit at 0.34, 0.62 and 0.88 of the field radius with 8, 16 and 24 positions (48 in all: the bird plus up to 47 leaves). The bird is always on one of the 8 directions. The animal is drawn 0.34 field radii wide, the bird and leaves 0.2. The level targets are game settings, not values from a study.', '',
        '## Glimpse scenes', '',
        Object.keys(E.games.glimpse.themes).map((k) => { const t = E.games.glimpse.themes[k]; return '- ' + k + ': middle ' + t.pairs.easy.join(' or ') + ' (harder pair ' + t.pairs.hard.join(' or ') + '), find ' + t.targets.join(', ') + ', among ' + t.distractor + 's'; }).join('\n'),
        'Fixed blocks and practice always use the classic set (meadow, always the bird), so measurement stays comparable. Adaptive blocks and free play draw the scene from the puzzle seed and take turns with its three targets. The scene is in `params` and `features`; each look logs its target in `target`.', '',
        '## Glimpse timing', '',
        'A round is 4 looks at levels 1 and 2, 5 at level 3 and 6 at levels 4 and 5, so rounds grow with the level like the puzzles do; rounds in fixed blocks are always 6 looks. The first look starts when the player taps the eye; the rest follow on their own after the feedback. Each look: a fixation mark for 400 to 699 ms (seeded) with a ring closing in over the first 260 ms, the flash, a 300 ms pattern mask, then the two answers (unspeeded). Everything shown during a look is drawn on one canvas in requestAnimationFrame callbacks, so the flash and the mask start on screen frames. The frame period is measured during each fixation.',
        'Display times come from a ladder that starts at 500 ms and shrinks by x0.9 per step, rounded to whole frames (at 60 Hz: 30, 27, 24, 22, 20, 18, 16, 14, 13, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1 frames). After a correct look the next is one step shorter, after a miss four steps longer (weighted up/down, settles at 80% correct). A fresh staircase starts at 300 ms, so a strong player needs about 10 correct looks to reach their own level; use at least 4 rounds per measurement block, or carried values. At level 2 and up a look is correct only when the animal and the place are both right.',
        'The staircase carries over between rounds of the same level: within a block in research sessions (each block starts fresh, and a new level starts 83 ms above the level below it when that one has a value), and between visits in free play. A carried-over round starts one step slower than where the last one ended, so it opens with a likely hit. Practice is 3 looks at fixed times of 1000, 600 and 350 ms.',
        'Browsers report frame timestamps, not the moment light leaves the screen; `flash_measured_ms` checks the frame count, not photometric onset. Phones in power saving and some embedded views run at 30 frames per second, which shows up in `refresh_ms`.', '',
        '## Taps per card', '', 'Levels follow one ladder of effort across the games. The fewest taps that finish a card (Outbound: solver moves; Conduit: needed turns; Tumbler: taps along the most informative tries, with right-spot pins carried over; Glimpse: one tap to start and one per answer) average about 5 to 7 at L1, 7 to 9 at L2, 9 to 11 at L3, 11 to 13 at L4 and 13 to 15 at L5. Count clues take one or two taps more than per-pin clues at the same level. Thinking time is not in these numbers: compare `duration_ms` by game and level in pilot data.', '',
        '## Adaptive blocks', '', 'Per game within a block: two successes in a row move up one level, one miss moves down one level (2-up/1-down staircase, levels 1 to 5). A success is a solve with `moves <= par`, where par = ceil(reference x par multiplier). Glimpse never moves down a level: its display time already adapts on every look. Free play uses the same rule for every game, with a quick start: one level up per success until the first miss in that game, then two in a row.', '']);
    return lines.join('\n');
  }

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
      h('p', { class: 'empty-state', text: 'Saving files is not available here. Copy this into a file named ' + filename + '.' }),
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
      h('div', { class: 'sheet-head' }, h('h2', { text: title }), h('button', { class: 'x', type: 'button', 'aria-label': 'Close', onclick: closeSheet }, icon('x'))),
      h('div', { class: 'sheet-body' }, body),
      foot ? h('div', { class: 'sheet-foot' }, foot) : null);
    layer.append(back, sheet);
    escHandler = (e) => { if (e.key === 'Escape') closeSheet(); };
    document.addEventListener('keydown', escHandler);
    const first = sheet.querySelector('.sheet-body input[type="text"]');
    if (first) setTimeout(() => { try { first.focus({ preventScroll: true }); } catch (e) { /* optional */ } }, 40);
    return sheet;
  }
  function closeSheet() {
    $('#layer').textContent = '';
    if (escHandler) document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
  const sheetOpen = () => !!$('#layer').firstChild;

  function holdEnd(onDone) {
    const b = h('button', { class: 'hud-btn holdx', type: 'button', 'aria-label': 'End the session (press and hold)' }, icon('x'));
    b.append(s('svg', { class: 'ring', viewBox: '0 0 44 44', 'aria-hidden': 'true' }, s('circle', { cx: 22, cy: 22, r: 20 })));
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
  function toggle(id, checked, onChange) {
    const input = h('input', { type: 'checkbox', id, checked: !!checked, role: 'switch' });
    input.addEventListener('change', () => onChange(input.checked));
    return h('span', { class: 'switch' }, input, h('span'));
  }

  // =============================================================== app
  const App = {
    session: null,
    card: null,
    busy: false,
    saveTimer: null,
    warnedStorage: false,
    frameMs: 1000 / 60,

    // decorative animations pause while a Glimpse look is on screen
    steady(on) { const a = $('#app'); if (a) a.classList.toggle('steady', !!on); },
    // Glimpse staircases carry over per level: within a block in research
    // sessions, between visits in free play. A level without a value starts
    // 83 ms (5 frames at 60 Hz) above the level below it, if that one has a value.
    glimpseBook(spec) {
      const S = this.session;
      if (S.kind === 'free') return { book: store.get('pr1.glimpse', {}), free: true };
      if (!S.glimpse) S.glimpse = {};
      const key = 'b' + spec.block;
      if (!S.glimpse[key]) S.glimpse[key] = {};
      return { book: S.glimpse[key], free: false };
    },
    glimpseStart(spec) {
      if (spec.practice) return null;
      const { book } = this.glimpseBook(spec);
      if (book[spec.level] > 0) return { ms: book[spec.level] };
      for (let k = spec.level - 1; k >= 1; k--) if (book[k] > 0) return { ms: Math.min(E.games.glimpse.startMs, book[k] + 83) };
      return null;
    },
    glimpseKeep(spec, ms) {
      if (spec.practice || !(ms > 0)) return;
      const { book, free } = this.glimpseBook(spec);
      book[spec.level] = Math.round(ms * 100) / 100;
      if (free) store.set('pr1.glimpse', book);
    },

    boot(data) {
      Gen.init();
      try {
        if (window.claude && typeof window.claude.use === 'function') downloadsReady = window.claude.use('downloads').catch(() => null);
      } catch (e) { downloadsReady = Promise.resolve(null); }
      this.bindGlobal();
      store.del('pr1.focus');
      if (data && data.v === 2 && data.session) {
        const S = data.session;
        if (data.engine === E.version) { this.restore(S, data.card, 'page update'); return; }
        // the games changed: a study picks up at the same puzzle, built fresh; free play starts over as the full mix
        if (S.kind === 'study' && S.status === 'active') {
          if (data.card && data.card.spec && !data.card.spec.practice && !data.card.summary) S.pending = data.card.spec;
          this.restore(S, null, 'page update, games changed');
          return;
        }
        if (S.kind === 'free' && S.status === 'active' && S.hasMoves) {
          S.status = 'closed';
          S.endedAt = new Date().toISOString();
          S.live = null;
          Sessions.save(S);
        }
      }
      const activeId = store.get('pr1.active', null);
      const S = activeId ? Sessions.load(activeId) : null;
      if (S && S.kind === 'study' && S.status === 'active' && S.app_version === APP_VERSION) { this.showResume(S); return; }
      this.startFree(true);
    },
    applySound() {
      const S = this.session;
      Sound.on = S && S.kind === 'study' ? !!S.options.sound : store.get('pr1.sound', true) !== false;
    },

    // ---------- sessions
    startFree(first, focus) {
      this.closeCurrent();
      let game = focus || 'mixed';
      if (game !== 'mixed' && ORDER.indexOf(game) < 0) game = 'mixed';
      const levels = store.get('pr1.levels', {});
      const S = newSession('free', { seed: randomSeed(), participant: '', condition: '', options: FREE_OPTIONS, blocks: [{ game, count: FREE_COUNT, level: 2, adaptive: true }] });
      ORDER.forEach((g) => { S.seq.adapt['0:' + g] = { level: Math.min(5, Math.max(1, levels[g] || 2)), streak: 0 }; });
      S.practiced = Object.assign({}, store.get('pr1.practiced', {}));
      // the mixed feed opens with a game this player has not tried yet
      if (game === 'mixed') { const k = ORDER.findIndex((g) => !S.practiced[g]); if (k > 0) S.seq.k = k; }
      this.session = S;
      this.applySound();
      this.logEvent({ event: 'session_start', detail: JSON.stringify({ options: S.options, blocks: S.blocks }) });
      Sessions.prune();
      this.advance(first);
    },
    startStudy(setup) {
      this.closeCurrent();
      const S = newSession('study', setup);
      this.session = S;
      this.applySound();
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
      S.pending = null;
      if (S.kind === 'study') store.del('pr1.active');
      this.save();
      if (this.card) this.card.destroy();
      this.card = null;
      this.showEnd();
    },
    isLast(spec) {
      const S = this.session;
      return !spec.practice && S.kind === 'study' && spec.seq >= seqTotal(S.seq);
    },
    needsPractice(game) {
      const S = this.session;
      return !!S.options.practice && !S.practiced[game];
    },

    // ---------- puzzle flow
    next(fromDy) {
      if (this.busy) return;
      if (this.card && !this.card.summary) return;
      this.advance(false, fromDy);
    },
    async advance(first, fromDy) {
      const S = this.session;
      if (!S || S.status !== 'active') return;
      const spec = S.pending || seqNext(S.seq);
      S.pending = null;
      if (!spec) { this.finish('complete'); return; }
      if (this.needsPractice(spec.game)) {
        S.pending = spec;
        await this.show(practiceSpec(spec.game, spec.variant), null, true, fromDy);
        return;
      }
      await this.show(spec, null, first, fromDy);
    },
    async show(spec, snap, first, fromDy) {
      this.busy = true;
      try {
        let p = null;
        if (spec.practice) p = E.games[spec.game].practice(spec.variant);
        else {
          p = Gen.peek(spec.game, spec.level, spec.seed, spec.variant);
          if (!p && first) { try { p = Gen.sync(spec.game, spec.level, spec.seed, spec.variant); } catch (e) { p = null; } }
          if (!p) {
            this.swap(this.panel([h('div', { class: 'spinner', role: 'status', 'aria-label': 'Loading' })], spec.game), fromDy);
            fromDy = 0;
            p = await Gen.get(spec.game, spec.level, spec.seed, spec.variant);
          }
        }
        if (this.card) this.card.destroy();
        const card = makeCard(this, spec, p, snap);
        this.card = card;
        $('#app').dataset.scene = spec.game;
        this.swap(card.el, fromDy);
        if (snap) {
          this.logPuzzle(card, 'resume', { move_no: card.c.moves });
          card.startTimer();
          card.later(() => card.guide(), 520);
        } else {
          card.start();
        }
        if (!spec.practice) this.prefetch(spec);
        else if (this.session.pending) this.prefetchSpec(this.session.pending);
        this.renderHud();
        this.touch(true);
      } catch (e) {
        this.swap(this.panel([
          h('h2', { text: 'That puzzle did not load' }),
          h('p', { text: String((e && e.message) || e) }),
          h('div', { class: 'stack' }, h('button', { class: 'wide solid', type: 'button', onclick: () => this.advance(false) }, 'Try the next one', icon('next'))),
        ]));
      } finally {
        this.busy = false;
      }
    },
    prefetchSpec(spec) { Gen.get(spec.game, spec.level, spec.seed, spec.variant).catch(() => {}); },
    // Free play, every game alike: one level up per success until the first miss
    // in that game, then two successes in a row per level. Research blocks: always two.
    upAfter(game) {
      if (!this.session || this.session.kind !== 'free') return 2;
      return store.get('pr1.settled', {})[game] ? 2 : 1;
    },
    prefetch(spec) {
      const S = this.session;
      const outcomes = spec.adaptive ? [true, false] : [true];
      for (const ok of outcomes) {
        const c = clone(S.seq);
        seqRecord(c, spec, ok, this.upAfter(spec.game));
        const nx = seqNext(c);
        if (nx) this.prefetchSpec(nx);
      }
    },
    onPuzzleEnd(card, sm) {
      const S = this.session, sp = card.spec;
      // leaving a puzzle by switching games or ending the session is not a miss
      const change = sp.practice || sm.outcome === 'abandoned' ? null : seqRecord(S.seq, sp, sm.success, this.upAfter(sp.game));
      const level_next = sp.adaptive && change ? change.to : '';
      this.logPuzzle(card, 'puzzle_end', { move_no: card.c.moves, cls: sm.outcome, detail: JSON.stringify({ success: sm.success, stars: sm.stars, moves: sm.moves, par: sm.par, reference: sm.reference }) });
      if (change && change.changed) this.logPuzzle(card, 'level_change', { from: change.from, to: change.to });
      const c = card.c, applies = APPLIES[sp.game];
      const n = (k) => (applies.indexOf(k) >= 0 ? c[k] : '');
      const g = sm.gl || null;
      if (g && !sp.practice && g.n) {
        this.glimpseKeep(sp, card.run.ms);
        if (S.kind === 'free' && g.best_ms != null && sm.outcome === 'complete') {
          const best = store.get('pr1.glbest', {});
          if (best[sp.level] != null && g.best_ms < best[sp.level] - 0.5) sm.newBest = g.best_ms;
          if (best[sp.level] == null || g.best_ms < best[sp.level]) { best[sp.level] = g.best_ms; store.set('pr1.glbest', best); }
        }
      }
      S.puzzles.push({
        seq: sp.seq, block: sp.block, in_block: sp.inBlock, puzzle_id: sp.id, puzzle_seed: card.p.seed,
        game: sp.game, level: sp.level, adaptive: sp.adaptive ? 1 : 0, practice: sp.practice ? 1 : 0, params: card.G.describe(card.p),
        outcome: sm.outcome, success: sm.success ? 1 : 0, stars: sm.stars, started_at: card.startedAt, ended_at: new Date().toISOString(),
        duration_ms: sm.duration_ms, first_move_ms: sm.first_move_ms == null ? '' : sm.first_move_ms, hidden_ms: sm.hidden_ms,
        moves: sm.moves, reference: sm.reference, par: sm.par, efficiency: sm.efficiency,
        n_optimal: n('optimal'), n_wasted: n('wasted'), n_dead_end: n('dead_end'), n_in_dead_end: n('in_dead_end'),
        n_blocked: n('blocked'), n_undo: n('undo'), n_restart: n('restart'), n_hint: n('hint'),
        n_suboptimal: n('suboptimal'), n_zero_info: n('zero_info'), n_inconsistent: n('inconsistent'),
        mean_info_ratio: sp.game === 'tumbler' && c.infoRatioN ? r4(c.infoRatioSum / c.infoRatioN) : '',
        n_correct: g ? g.correct : '', accuracy: g && g.n ? r4(g.accuracy) : '',
        threshold_ms: g && g.threshold_ms != null ? g.threshold_ms : '', best_ms: g && g.best_ms != null ? g.best_ms : '',
        start_ms: g && g.start_ms != null ? g.start_ms : '', end_ms: g && g.end_ms != null ? g.end_ms : '',
        n_reversals: g ? g.reversals : '', refresh_ms: g && g.refresh_ms != null ? r4(g.refresh_ms) : '',
        n_frame_drops: g ? g.drops : '', field_px: g && card.R ? Math.round(card.R) : '',
        level_next,
        features: JSON.stringify(card.p.features),
      });
      if (sp.practice) {
        S.practiced[sp.game] = true;
        if (S.kind === 'free') store.set('pr1.practiced', S.practiced);
      } else if (S.kind === 'free') {
        if (!sm.success && sm.outcome !== 'abandoned') {
          const settled = store.get('pr1.settled', {});
          if (!settled[sp.game]) { settled[sp.game] = true; store.set('pr1.settled', settled); }
        }
        // free play keeps stars, a streak and per-game levels between visits
        if (sm.outcome !== 'abandoned') {
          const won = sm.outcome === 'solved' || (sm.outcome === 'complete' && sm.stars > 0);
          store.set('pr1.stars', store.get('pr1.stars', 0) + sm.stars);
          store.set('pr1.streak', won ? store.get('pr1.streak', 0) + 1 : 0);
        }
        if (change) { const lv = store.get('pr1.levels', {}); lv[sp.game] = change.to; store.set('pr1.levels', lv); }
        this.hudBump = sm.stars > 0;
      }
      this.renderHud();
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
        game: sp.game, level: sp.level, adaptive: sp.adaptive ? 1 : 0, practice: sp.practice ? 1 : 0, t_ms: Math.round(card.elapsed()),
      }, fields));
    },
    touch(immediate) {
      clearTimeout(this.saveTimer);
      if (immediate) this.save();
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
      return { v: 2, engine: E.version, session: this.session, card: this.card && this.session && this.session.status === 'active' ? this.card.snapshot() : null };
    },
    async restore(S, cardSnap, reason) {
      this.session = S;
      if (S.t0wall == null) S.t0wall = Date.parse(S.startedAt) || Date.now();
      if (!S.practiced) S.practiced = {};
      this.applySound();
      if (S.status !== 'active') { this.renderHud(); this.showEnd(); return; }
      if (S.kind === 'study') store.set('pr1.active', S.id);
      this.logEvent({ event: 'resume', detail: reason });
      if (cardSnap && cardSnap.spec) await this.show(cardSnap.spec, cardSnap, false);
      else await this.advance(false);
    },

    // ---------- views
    panel(kids, scene) {
      const el = h('article', { class: 'scene panel' }, h('div', { class: 'panel-body' }, kids));
      if (scene) el.setAttribute('data-game', scene);
      return el;
    },
    swap(el, fromDy) {
      const stage = $('#stage');
      const olds = Array.from(stage.children).filter((c) => c !== el && !c.dataset.leaving);
      stage.append(el);
      const canAnimate = typeof el.animate === 'function';
      const quiet = reducedMotion() || !olds.length || !canAnimate;
      const H = stage.clientHeight || 800;
      for (const old of olds) {
        old.dataset.leaving = '1';
        if (quiet) { old.remove(); continue; }
        const a = old.animate([{ transform: 'translateY(' + (fromDy || 0) + 'px)' }, { transform: 'translateY(' + -H + 'px)' }], { duration: 400, easing: 'cubic-bezier(.3,.6,.2,1)' });
        a.onfinish = () => old.remove();
        setTimeout(() => old.remove(), 800);
      }
      if (!quiet) el.animate([{ transform: 'translateY(' + H + 'px)' }, { transform: 'translateY(0)' }], { duration: 400, easing: 'cubic-bezier(.3,.6,.2,1)' });
      else if (olds.length && canAnimate) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
    },
    renderHud() {
      const S = this.session;
      const L = $('#hud-left'), M = $('#hud-mid'), R = $('#hud-right');
      L.textContent = ''; M.textContent = ''; R.textContent = '';
      const study = !!(S && S.kind === 'study' && S.status === 'active');
      if (study) {
        L.append(h('span', { class: 'who', text: S.participant || 'Participant' }));
        const total = seqTotal(S.seq);
        const at = this.card && !this.card.spec.practice ? this.card.spec.seq : S.pending ? S.pending.seq : S.seq.n;
        if (total <= 40) {
          const segs = h('div', { class: 'segs', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(at), 'aria-label': 'Puzzle ' + at + ' of ' + total });
          for (let i = 1; i <= total; i++) segs.append(h('i', { class: i < at ? 'done' : i === at ? 'now' : '' }));
          M.append(segs);
        } else {
          const bar = h('div', { class: 'segbar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(at) }, h('b'));
          bar.firstChild.style.width = Math.round((100 * Math.max(0, at - 1)) / total) + '%';
          M.append(bar);
        }
        R.append(holdEnd(() => this.finish('ended_early')));
      } else {
        L.append(h('button', { class: 'hud-btn', type: 'button', 'aria-label': 'Menu', onclick: () => this.openMenu() }, icon('menu')));
        const only = S && S.kind === 'free' && S.blocks[0] && S.blocks[0].game !== 'mixed' ? S.blocks[0].game : null;
        if (only) {
          M.append(h('button', { class: 'only-chip', type: 'button', 'aria-label': 'Only ' + LABEL[only] + '. Back to all games', onclick: () => this.startFree(false, 'mixed') },
            icon(GAME_ICON[only]), h('span', { text: LABEL[only] + ' only' }), h('span', { class: 'chip-x' }, icon('x'))));
        } else {
          M.append(h('div', { class: 'wordmark' }, h('span', { class: 'logo', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')), 'Puzzle Reel'));
        }
        if (!S || S.kind === 'free') {
          const stars = h('span', { class: 'pill', 'aria-label': store.get('pr1.stars', 0) + ' stars' }, icon('star', 'star'), String(store.get('pr1.stars', 0)));
          R.append(stars);
          const streak = store.get('pr1.streak', 0);
          if (streak >= 2) R.append(h('span', { class: 'pill', 'aria-label': streak + ' solved in a row' }, icon('flame', 'flame'), String(streak)));
          if (this.hudBump) { this.hudBump = false; setTimeout(() => stars.classList.add('bump'), 900); }
        }
      }
    },
    showEnd() {
      const S = this.session;
      $('#app').dataset.scene = 'panel';
      const real = S.puzzles.filter((p) => !p.practice);
      const solved = real.filter((p) => p.outcome === 'solved' || p.outcome === 'complete').length;
      const stars = real.reduce((a, p) => a + (p.stars || 0), 0);
      const total = real.reduce((a, p) => a + (p.duration_ms || 0), 0);
      const done = S.status === 'complete';
      const name = (S.participant || 'participant').replace(/[^A-Za-z0-9_-]+/g, '_');
      const panel = this.panel([
        h('div', { class: 'big-badge' }, icon(done ? 'check' : 'pause')),
        h('h2', { text: done ? 'Session complete' : 'Session ended' }),
        h('p', { text: done ? 'Thank you!' : 'Stopped before the end of the plan. Everything so far is saved on this device.' }),
        h('div', { class: 'tiles' },
          h('div', null, h('b', { text: String(real.length) }), h('span', { text: 'puzzles' })),
          h('div', null, h('b', { text: String(solved) }), h('span', { text: 'solved' })),
          h('div', null, h('b', { text: String(stars) }), h('span', { text: 'stars' })),
          h('div', null, h('b', { text: clock(total) }), h('span', { text: 'on puzzles' }))),
        h('p', { class: 'meta-line', text: [S.participant, S.condition, 'seed ' + S.seed, S.events.length + ' events'].filter(Boolean).join(' · ') }),
        h('div', { class: 'row3' },
          h('button', { class: 'mini', type: 'button', onclick: () => saveFile('puzzle-reel_moves_' + name + '_' + stamp() + '.csv', eventsCSV([S])) }, icon('save'), 'Moves CSV'),
          h('button', { class: 'mini', type: 'button', onclick: () => saveFile('puzzle-reel_puzzles_' + name + '_' + stamp() + '.csv', puzzlesCSV([S])) }, icon('save'), 'Puzzles CSV'),
          h('button', { class: 'mini', type: 'button', onclick: () => saveFile('puzzle-reel_' + name + '_' + stamp() + '.json', exportJSON([S])) }, icon('save'), 'JSON')),
        h('div', { class: 'stack' },
          h('button', { class: 'wide solid', type: 'button', onclick: () => this.openSetup({ participant: '', condition: S.condition, seed: S.seed, blocks: S.blocks, options: S.options }) }, 'Next participant', icon('next')),
          h('button', { class: 'wide soft', type: 'button', onclick: () => this.startFree(false) }, icon('play'), 'Free play')),
      ]);
      this.swap(panel);
      this.renderHud();
    },
    showResume(S) {
      this.session = null;
      $('#app').dataset.scene = 'panel';
      const at = S.live && S.live.spec && !S.live.spec.practice ? S.live.spec.seq : S.pending ? S.pending.seq : S.seq.n;
      const panel = this.panel([
        h('div', { class: 'big-badge' }, icon('pause')),
        h('h2', { text: 'Session paused' }),
        h('p', { text: (S.participant || 'The participant') + ' was on puzzle ' + Math.max(at, 1) + ' of ' + seqTotal(S.seq) + '. Resume to continue exactly there; the gap is logged.' }),
        h('div', { class: 'stack' },
          h('button', { class: 'wide solid', type: 'button', onclick: () => this.restore(S, S.live, 'reload') }, icon('play'), 'Resume'),
          h('button', { class: 'wide soft', type: 'button', onclick: () => { this.restore(S, S.live, 'reload, then ended').then(() => this.finish('ended_early')); } }, 'End session')),
      ]);
      this.swap(panel);
      $('#hud-left').textContent = '';
      $('#hud-right').textContent = '';
      $('#hud-mid').textContent = '';
      $('#hud-left').append(h('span', { class: 'who', text: S.participant || 'Session' }));
    },
    replayPractice() {
      const S = this.session;
      if (!S || S.kind !== 'free') return;
      const game = this.card ? this.card.spec.game : 'outbound';
      if (this.card && !this.card.summary) {
        if (!this.card.spec.practice) S.pending = this.card.spec;
        this.card.summary = { outcome: 'abandoned' };
        this.logPuzzle(this.card, 'puzzle_end', { move_no: this.card.c.moves, cls: 'abandoned', detail: 'replaying practice' });
      }
      this.show(practiceSpec(game, S.options.clue), null, true);
    },

    // ---------- menu
    openMenu() {
      if (this.card && this.card.abort) this.card.abort('menu opened');
      const item =(ico, title, sub, onclick, end) => h('button', { class: 'menu-item', type: 'button', onclick }, h('span', { class: 'ico' }, icon(ico)), h('span', null, h('b', { text: title }), sub ? h('small', { text: sub }) : null), end ? h('span', { class: 'end' }, end) : null);
      const soundToggle = toggle('m-sound', Sound.on, (on) => { store.set('pr1.sound', on); Sound.on = on; if (on) { Sound.unlock(); Sound.play('pop', 3); } });
      const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const soundRow = h('div', { class: 'menu-item' }, h('span', { class: 'ico' }, icon('sound')), h('label', { for: 'm-sound' }, h('b', { text: 'Sound and vibration' }), ios ? h('small', { text: 'Silent mode on iPhone mutes it' }) : null), h('span', { class: 'end' }, soundToggle));
      const S = this.session;
      const focus = S && S.kind === 'free' && S.blocks[0] ? S.blocks[0].game : 'mixed';
      const picker = h('div', { class: 'game-pick', role: 'group', 'aria-label': 'Play' },
        ['mixed'].concat(ORDER).map((g) => h('button', {
          class: 'gp' + (g === focus ? ' on' : ''), type: 'button', 'data-game': g, 'aria-pressed': g === focus ? 'true' : 'false',
          'aria-label': g === 'mixed' ? 'All games' : LABEL[g],
          onclick: () => { closeSheet(); this.startFree(false, g); },
        }, h('span', { class: 'gp-ico' }, icon(GAME_ICON[g])), h('span', { text: g === 'mixed' ? 'All' : LABEL[g] }))));
      openSheet('Puzzle Reel', [picker, h('div', { class: 'menu' },
        soundRow,
        item('help', 'How to play', 'Replay the practice board', () => { closeSheet(); this.replayPractice(); }),
        item('flask', 'Research session', 'Participant, seed, plan and options', () => { closeSheet(); this.openSetup(); }),
        item('chart', 'Data', 'Save logs as CSV or JSON', () => { closeSheet(); this.openData(); }))]);
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
      const cond = h('input', { type: 'text', id: 'f-cond', autocomplete: 'off', value: st.condition || '', placeholder: 'optional' });
      const seed = h('input', { type: 'number', id: 'f-seed', inputmode: 'numeric', min: '1', step: '1', value: String(st.seed) });
      const plan = h('div', { class: 'plan' });
      const updateSum = () => {
        const n = st.blocks.reduce((a, b) => a + (b.count || 0), 0);
        const ad = st.blocks.filter((b) => b.adaptive).length;
        sumLine.textContent = n + ' puzzle' + (n === 1 ? '' : 's') + ' in ' + st.blocks.length + ' block' + (st.blocks.length === 1 ? '' : 's') + (ad ? ', ' + ad + ' adaptive' : '') + '.';
      };
      const renderPlan = () => {
        plan.textContent = '';
        plan.append(h('div', { class: 'plan-row plan-head', 'aria-hidden': 'true' }, h('span'), h('span', { text: 'Game' }), h('span', { text: 'Puzzles' }), h('span', { text: 'Level' }), h('span', { text: 'Adaptive' }), h('span')));
        st.blocks.forEach((b, i) => {
          const game = h('select', { id: 'blk-' + i + '-game', 'aria-label': 'Block ' + (i + 1) + ' game' },
            ['mixed'].concat(ORDER).map((g) => h('option', { value: g, selected: b.game === g }, LABEL[g])));
          game.addEventListener('change', () => { b.game = game.value; updateSum(); });
          const count = h('input', { type: 'number', id: 'blk-' + i + '-count', min: '1', max: '200', step: '1', value: String(b.count), 'aria-label': 'Block ' + (i + 1) + ' puzzles' });
          count.addEventListener('input', () => { b.count = parseInt(count.value, 10) || 0; updateSum(); });
          const level = h('select', { id: 'blk-' + i + '-level', 'aria-label': 'Block ' + (i + 1) + ' level' },
            [1, 2, 3, 4, 5].map((l) => h('option', { value: String(l), selected: b.level === l }, 'L' + l)));
          level.addEventListener('change', () => { b.level = parseInt(level.value, 10); });
          const ad = h('input', { type: 'checkbox', id: 'blk-' + i + '-adapt', checked: !!b.adaptive, 'aria-label': 'Block ' + (i + 1) + ' adaptive' });
          ad.addEventListener('change', () => { b.adaptive = ad.checked; updateSum(); });
          const rm = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove block ' + (i + 1), disabled: st.blocks.length === 1, onclick: () => { st.blocks.splice(i, 1); renderPlan(); updateSum(); } }, icon('x'));
          plan.append(h('div', { class: 'plan-row' }, h('span', { class: 'idx', text: String(i + 1) }), game, count, level, h('label', { class: 'check' }, ad), rm));
        });
        plan.append(h('div', { class: 'presets' },
          h('button', { class: 'btn', type: 'button', onclick: () => { st.blocks.push({ game: 'mixed', count: 3, level: 2, adaptive: false }); renderPlan(); updateSum(); } }, 'Add block'),
          h('span', { class: 'help', text: 'or start from' }),
          PRESETS.map((pr) => h('button', { class: 'btn', type: 'button', onclick: () => { st.blocks = clone(pr.blocks); renderPlan(); updateSum(); } }, pr.name))));
      };
      const opt = (key, id, text) => {
        const box = h('input', { type: 'checkbox', id, checked: !!st.options[key] });
        box.addEventListener('change', () => { st.options[key] = box.checked; });
        return h('label', { class: 'check', for: id }, box, text);
      };
      const par = h('input', { type: 'number', id: 'o-par', min: '1', max: '5', step: '0.1', value: String(st.options.par) });
      const limit = h('input', { type: 'number', id: 'o-limit', min: '0', max: '3600', step: '5', value: String(st.options.limit) });
      const clue = h('select', { id: 'o-clue' },
        h('option', { value: 'pin', selected: st.options.clue !== 'count' }, 'Per pin, like Wordle'),
        h('option', { value: 'count', selected: st.options.clue === 'count' }, 'Counts only, classic'));
      clue.addEventListener('change', () => { st.options.clue = clue.value; });
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
      } }, 'Start session', icon('next'));
      openSheet('Research session', [
        h('fieldset', null, h('legend', { text: 'Participant' }),
          h('div', { class: 'fields' },
            h('div', { class: 'field' }, h('label', { for: 'f-pid', text: 'Participant ID' }), pid, h('span', { class: 'help', text: 'A code, not a name.' })),
            h('div', { class: 'field' }, h('label', { for: 'f-cond', text: 'Condition' }), cond))),
        h('fieldset', null, h('legend', { text: 'Puzzles' }),
          h('div', { class: 'field' }, h('label', { for: 'f-seed', text: 'Seed' }),
            h('div', { class: 'inline' }, seed, h('button', { class: 'btn', type: 'button', onclick: () => { seed.value = String(randomSeed()); } }, 'New seed')),
            h('span', { class: 'help', text: 'Same seed and plan, same puzzles for everyone.' })),
          h('div', { class: 'field' }, h('span', { class: 'lbl', text: 'Plan' }), plan, sumLine,
            h('span', { class: 'help', text: 'All games rotates Outbound, Conduit, Tumbler and Glimpse. Adaptive blocks start at the chosen level, go up after two successes and down after a miss. A Glimpse round is 4 to 6 looks (6 in fixed blocks); its display time adapts on every look and its level never goes down.' }))),
        h('fieldset', null, h('legend', { text: 'What participants see' }),
          h('div', { class: 'checks' },
            opt('practice', 'o-practice', 'Practice board before each new game'),
            opt('feedback', 'o-feedback', 'Feedback on each move or look'),
            opt('counter', 'o-counter', 'Stars, move count and speed'),
            opt('hints', 'o-hints', 'Hint button'),
            opt('undo', 'o-undo', 'Undo and restart'),
            opt('skip', 'o-skip', 'Skip button'),
            opt('sound', 'o-sound', 'Sound and vibration')),
          h('div', { class: 'fields' },
            h('div', { class: 'field' }, h('label', { for: 'o-clue', text: 'Tumbler clues' }), clue),
            h('div', { class: 'field' }, h('label', { for: 'o-par', text: 'Par multiplier' }), par, h('span', { class: 'help', text: 'Par = fewest moves × this, rounded up.' })),
            h('div', { class: 'field' }, h('label', { for: 'o-limit', text: 'Time limit per puzzle (s)' }), limit, h('span', { class: 'help', text: '0 means no limit.' })))),
        err,
      ], [h('p', { class: 'note', text: 'Logs stay on this device until you save them from Data.' }), startBtn]);
    },

    // ---------- data
    openData() {
      this.save();
      const all = Sessions.all();
      let includeFree = false;
      const body = h('div', { style: 'display:flex;flex-direction:column;gap:18px' });
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
          body.append(h('p', { class: 'empty-state', text: includeFree ? 'Nothing logged on this device yet.' : 'No research sessions on this device yet. Start one from the menu; free play is logged too.' }));
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
          body.append(h('div', { class: 'presets' },
            h('button', { class: 'btn primary', type: 'button', onclick: () => saveFile('puzzle-reel_moves_' + stamp() + '.csv', eventsCSV(list)) }, icon('save'), 'Moves CSV'),
            h('button', { class: 'btn', type: 'button', onclick: () => saveFile('puzzle-reel_puzzles_' + stamp() + '.csv', puzzlesCSV(list)) }, icon('save'), 'Puzzles CSV'),
            h('button', { class: 'btn', type: 'button', onclick: () => saveFile('puzzle-reel_' + stamp() + '.json', exportJSON(list)) }, icon('save'), 'Everything (JSON)')));
        }
        body.append(h('details', null, h('summary', { class: 'lbl', text: 'What the columns mean' }),
          h('div', { style: 'display:flex;flex-direction:column;gap:7px;margin-top:12px;font-size:13px' },
            CODEBOOK.events.concat(CODEBOOK.puzzles).map((r) => h('p', { style: 'margin:0' }, h('code', { text: r[0] }), ' ', r[1])),
            Object.keys(CODEBOOK.classes).map((g) => h('p', { style: 'margin:0' }, h('strong', { text: E.games[g].name + ' labels: ' }), CODEBOOK.classes[g])),
            h('p', { style: 'margin:0', text: CODEBOOK.colors }),
            h('div', null, h('button', { class: 'btn', type: 'button', onclick: () => saveFile('puzzle-reel_codebook.md', codebookMarkdown()) }, icon('save'), 'Save codebook')))));
        if (all.length) {
          const zone = h('div', { class: 'confirm', hidden: true },
            h('p', { style: 'margin:0', text: 'This removes ' + all.length + ' session' + (all.length === 1 ? '' : 's') + ' from this device, free play included. Save first if you need them.' }),
            h('div', { class: 'presets' },
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
      openSheet('Data', [body], [h('p', { class: 'note', text: 'Logs live in this browser only. Save them before clearing browser data or switching devices.' })]);
    },

    // ---------- global input
    bindGlobal() {
      const unlock = () => Sound.unlock();
      ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach((ev) => document.addEventListener(ev, unlock, { passive: true, capture: true }));
      document.addEventListener('keydown', (e) => {
        if (sheetOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        if (tag === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
        const c = this.card;
        if (!c) return;
        if (c.summary) {
          if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'ArrowUp') { e.preventDefault(); this.next(); }
          return;
        }
        if (c.onKey(e)) e.preventDefault();
      });
      document.addEventListener('visibilitychange', () => {
        const c = this.card;
        if (document.visibilityState === 'hidden') {
          if (c && !c.summary && c.onHidden) c.onHidden();
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
      window.addEventListener('resize', () => { const c = this.card; if (c && c.practice && !c.summary) c.guide(); });
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
  window.PuzzleReel = { App, Gen, Sound, seqInit, seqNext, seqRecord, eventsCSV, puzzlesCSV, codebookMarkdown };
})();
