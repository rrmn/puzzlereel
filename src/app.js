(function () {
  'use strict';
  const E = window.Engines;
  const APP_VERSION = '2.34.0';
  const ORDER = E.order;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const FREE_COUNT = 1000000;
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const LABEL = { mixed: 'All games', outbound: 'Outbound', conduit: 'Conduit', tumbler: 'Tumbler', glimpse: 'Glimpse', stacks: 'Stacks', switchback: 'Switchback', keepsake: 'Keepsake' };

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
    hint: '<path class="df" d="M12 2.6a6.4 6.4 0 0 0-3.7 11.6c.6.5.9 1.1.9 1.9V17h5.6v-.9c0-.8.3-1.4.9-1.9A6.4 6.4 0 0 0 12 2.6z"/><path d="M9 18h6M10.2 21.5h3.6"/><path d="M12 2.6a6.4 6.4 0 0 0-3.7 11.6c.6.5.9 1.1.9 1.9V17h5.6v-.9c0-.8.3-1.4.9-1.9A6.4 6.4 0 0 0 12 2.6z"/>',
    skip: '<path class="df" d="M5.5 5.5 15 12l-9.5 6.5z"/><path d="M5.5 5.5 15 12l-9.5 6.5z"/><path d="M18.5 5.5v13"/>',
    next: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    swap: '<path d="M6 8.5h12M15 5.5l3 3-3 3"/><path d="M18 15.5H6M9 12.5l-3 3 3 3"/>',
    clock: '<circle class="df" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    tapped: '<path d="M9.5 11.5V5.2a1.7 1.7 0 0 1 3.4 0v5.6"/><path d="M12.9 10.2V9a1.7 1.7 0 0 1 3.4 0v2.2"/><path d="M16.3 10.8a1.7 1.7 0 0 1 3.2.8v3.2a6.7 6.7 0 0 1-6.7 6.7h-.6a6.6 6.6 0 0 1-5.2-2.5l-3-3.8a1.7 1.7 0 0 1 2.6-2.2l2.4 2.4"/>',
    sound: '<path class="df" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    help: '<circle class="df" cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8"/><path d="M12 17.2v.1"/>',
    flask: '<path class="df" d="M7.5 14.5h9l2.7 3.6A2 2 0 0 1 17.5 21h-11a2 2 0 0 1-1.7-2.9z"/><path d="M9 3h6M10 3v6.2L4.8 18.1A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.9L14 9.2V3"/><path d="M7.5 14.5h9"/>',
    chart: '<path d="M5 20V11M11 20V5M17 20v-7"/><path d="M3 20h18"/>',
    save: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
    key: '<circle class="df" cx="8" cy="15" r="4.2"/><circle cx="8" cy="15" r="4.2"/><path d="m11 12 8.5-8.5M16.2 6.8l2.2 2.2M13.6 9.4l2 2"/>',
    erase: '<path d="M21 5H9l-6 7 6 7h12z"/><path d="m12.5 9.5 5 5M17.5 9.5l-5 5"/>',
    play: '<path class="df" d="M7.5 5.5 18.5 12l-11 6.5z"/><path d="M7.5 5.5 18.5 12l-11 6.5z"/>',
    pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
    car: '<path class="df" d="M4 16.5V13l2-5.2A2 2 0 0 1 7.9 6.5h8.2a2 2 0 0 1 1.9 1.3L20 13v3.5z"/><path d="M4 16.5V13l2-5.2A2 2 0 0 1 7.9 6.5h8.2a2 2 0 0 1 1.9 1.3L20 13v3.5z"/><path d="M4 13h16"/><circle cx="7.6" cy="16.6" r="1.7"/><circle cx="16.4" cy="16.6" r="1.7"/>',
    drop: '<path class="df" d="M12 3.2s6.2 6.6 6.2 11.2a6.2 6.2 0 0 1-12.4 0C5.8 9.8 12 3.2 12 3.2z"/><path d="M12 3.2s6.2 6.6 6.2 11.2a6.2 6.2 0 0 1-12.4 0C5.8 9.8 12 3.2 12 3.2z"/>',
    sprout: '<path class="df" d="M12 13c0-4.2 3-6.8 7.4-6.8 0 4.2-3 6.8-7.4 6.8zM12 15.2c0-3.6-2.6-5.7-6.2-5.7 0 3.6 2.6 5.7 6.2 5.7z"/><path d="M12 21v-8"/><path d="M12 13c0-4.2 3-6.8 7.4-6.8 0 4.2-3 6.8-7.4 6.8zM12 15.2c0-3.6-2.6-5.7-6.2-5.7 0 3.6 2.6 5.7 6.2 5.7z"/>',
    lock: '<rect class="df" x="5" y="10.5" width="14" height="10.5" rx="2.6"/><rect x="5" y="10.5" width="14" height="10.5" rx="2.6"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/><path d="M12 14.5v2.5"/>',
    star: '<path fill="currentColor" stroke="none" d="M12 2.4l2.95 6 6.6.95-4.78 4.66 1.13 6.57L12 17.48l-5.9 3.1 1.13-6.57L2.45 9.35l6.6-.95z"/>',
    flame: '<path fill="currentColor" stroke="none" d="M12.6 2.4c.7 3.3 5 5.5 5 10.4a5.6 5.6 0 0 1-11.2 0c0-2.8 1.5-4.4 2.8-5.6.2 1.8 1 3 2.3 3.7-.6-3.3.3-6.1 1.1-8.5z"/>',
    eye: '<path class="df" d="M2.4 12s3.6-6.6 9.6-6.6 9.6 6.6 9.6 6.6-3.6 6.6-9.6 6.6S2.4 12 2.4 12z"/><path d="M2.4 12s3.6-6.6 9.6-6.6 9.6 6.6 9.6 6.6-3.6 6.6-9.6 6.6S2.4 12 2.4 12z"/><circle cx="12" cy="12" r="3.1"/>',
    bolt: '<path fill="currentColor" stroke="none" d="M13.6 2.2 4.8 13.4h6.1l-1.4 8.4 8.8-11.2h-6.1z"/>',
    camera: '<path class="df" d="M3.5 9a2 2 0 0 1 2-2h2.4l1.7-2.4h4.8L16.1 7h2.4a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 9a2 2 0 0 1 2-2h2.4l1.7-2.4h4.8L16.1 7h2.4a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><circle cx="12" cy="13.2" r="3.4"/>',
    stack: '<path class="df" d="M6 15h12a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2zM8 9.5h8a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2zM10 4h4a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><rect x="4" y="15" width="16" height="5" rx="2"/><rect x="6" y="9.5" width="12" height="5" rx="2"/><rect x="8" y="4" width="8" height="5" rx="2"/>',
    person: '<circle class="df" cx="12" cy="8.2" r="3.7"/><path class="df" d="M4.8 20.5a7.2 7.2 0 0 1 14.4 0z"/><circle cx="12" cy="8.2" r="3.7"/><path d="M4.8 20.5a7.2 7.2 0 0 1 14.4 0"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    wheel: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12.4" r="2.2"/><path d="M3.6 11.2q8.4-1.8 16.8 0M12 14.6v6"/>',
    gauge: '<path class="df" d="M4.2 17a8.2 8.2 0 1 1 15.6 0z"/><path d="M4.2 17a8.2 8.2 0 1 1 15.6 0"/><path d="m12 14.6 3.6-4.4"/><circle cx="12" cy="15" r="1.3"/>',
    sign: '<path class="df" d="M12 3.6 21 19.4H3z"/><path d="M12 3.6 21 19.4H3z"/><path d="M12 9.6v4.2"/><path d="M12 16.6v.1"/>',
    road: '<path d="M8.4 3.5 4.8 20.5M15.6 3.5l3.6 17"/><path d="M12 4.5v2.6M12 10.6v2.8M12 17v3"/>',
    fork: '<path d="M12 20.5v-6.2L6.8 8.4M12 14.3l5.2-5.9"/><path d="M5.8 13V7.4h5.4M18.2 13V7.4h-5.4"/>',
    basket: '<path class="df" d="M3.6 10.4h16.8l-1.7 8.6a2.2 2.2 0 0 1-2.2 1.8H7.5a2.2 2.2 0 0 1-2.2-1.8z"/><path d="M3.6 10.4h16.8l-1.7 8.6a2.2 2.2 0 0 1-2.2 1.8H7.5a2.2 2.2 0 0 1-2.2-1.8z"/><path d="M7.6 10.4 11 4.6M16.4 10.4 13 4.6"/><path d="M9.4 14v3.4M14.6 14v3.4"/>',
    day: '<path class="df" d="M7 5.2h10a3.2 3.2 0 0 1 3.2 3.2V10H3.8V8.4A3.2 3.2 0 0 1 7 5.2z"/><rect x="3.8" y="5.2" width="16.4" height="15.4" rx="3.2"/><path d="M3.8 10h16.4M8.4 3.2v4M15.6 3.2v4"/><path d="M8 14.2h.1M12 14.2h.1M16 14.2h.1M8 17.4h.1M12 17.4h.1"/>',
    rise: '<path d="M3.5 17.5 9.5 11.5l4 4 7-7.5"/><path d="M15 8h5.5v5.5"/>',
    back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    move: '<path d="M4 12h16"/><path d="m8 7.5-4.5 4.5L8 16.5M16 7.5l4.5 4.5-4.5 4.5"/>',
    trophy: '<path class="df" d="M7 3.8h10v5.6a5 5 0 0 1-10 0z"/><path d="M7 3.8h10v5.6a5 5 0 0 1-10 0z"/><path d="M7 6H4.4v1.4A3.6 3.6 0 0 0 8 11M17 6h2.6v1.4A3.6 3.6 0 0 1 16 11"/><path d="M12 14.4v3.4M8.6 20.6h6.8M9.6 17.8h4.8"/>',
    more: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  };
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
  // ------------------------------------------------------------ game badges
  // Each game's own small picture on its color, like an app icon, for the menu, the
  // title row and the "only" chip. Drawn in a 48 box; ids are per drawing, since the
  // same badge can be on screen twice. Art is built on first use (it borrows the
  // Glimpse animals and the Tumbler pegs, defined further down).
  const BADGE_BG = {
    mixed: ['#56659A', '#2B3459'], outbound: ['#FFD978', '#FFB531'], conduit: ['#86DC8F', '#47B35A'],
    tumbler: ['#7563D2', '#45339A'], glimpse: ['#5596EE', '#2161CC'], stacks: ['#9DD9D5', '#58ACA9'],
    switchback: ['#F99B77', '#E35E45'], keepsake: ['#F599B7', '#DA5B85'],
  };
  let badgeArt = null, badgeSeq = 0;
  function makeBadgeArt() {
    const disc = (cy, w, c) => '<rect x="' + (24 - w / 2) + '" y="' + (cy - 3.4) + '" width="' + w + '" height="6.8" rx="3.4" fill="' + c + '"/>'
      + '<rect x="' + (24 - w / 2 + 2.6) + '" y="' + (cy - 2.3) + '" width="' + (w * 0.34).toFixed(1) + '" height="1.5" rx=".75" fill="#fff" opacity=".38"/>';
    const peg = (x, k) => '<circle cx="' + x + '" cy="30.4" r="4.7" fill="' + PEGS[k].fill + '"/>'
      + '<path d="' + PEGS[k].glyph + '" fill="' + PEGS[k].ink + '" transform="translate(' + (x - 3.44) + ' 26.96) scale(.43)"/>';
    return {
      mixed: [[8.5, 8.5, '#FFC94D'], [25.5, 8.5, '#6CCB78'], [8.5, 25.5, '#9A86F0'], [25.5, 25.5, '#F07C5C']].map(([x, y, c]) =>
        '<rect x="' + x + '" y="' + (y + 1.2) + '" width="14" height="14" rx="4.4" fill="#000" opacity=".16"/>'
        + '<rect x="' + x + '" y="' + y + '" width="14" height="14" rx="4.4" fill="' + c + '"/>'
        + '<rect x="' + (x + 2.6) + '" y="' + (y + 2.4) + '" width="5" height="2" rx="1" fill="#fff" opacity=".45"/>').join(''),
      outbound: '<ellipse cx="25" cy="40.8" rx="10.4" ry="2.4" fill="#A05E00" opacity=".2"/>'
        + '<rect x="12.8" y="16.6" width="2.8" height="3.6" rx="1.3" fill="#D63E35"/><rect x="32.4" y="16.6" width="2.8" height="3.6" rx="1.3" fill="#D63E35"/>'
        + '<rect x="14.6" y="5.8" width="18.8" height="34.4" rx="7.2" fill="#F2564D"/>'
        + '<path d="M28.6 6.2q4.8 1.2 4.8 6.6v20.6q0 5.6-4.8 6.6z" fill="#000" opacity=".1"/>'
        + '<path d="M17.3 15.2q6.7-3.3 13.4 0l-1.2 4.4H18.5z" fill="#26324A"/>'
        + '<path d="M18.5 32.4h11l1 3.3q-6.5 2.3-13 0z" fill="#26324A" opacity=".88"/>'
        + '<rect x="18.3" y="20.5" width="11.4" height="11.2" rx="2.6" fill="#fff" opacity=".13"/>'
        + '<path d="M20.4 28.6 24 24.8l3.6 3.8" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<rect x="16.4" y="7.1" width="4" height="2.2" rx="1.1" fill="#FFF4C2"/><rect x="27.6" y="7.1" width="4" height="2.2" rx="1.1" fill="#FFF4C2"/>',
      conduit: '<ellipse cx="24.5" cy="43.4" rx="10.5" ry="1.9" fill="#1E5A2A" opacity=".2"/>'
        + '<path d="M-1 10.5h13.5a7 7 0 0 1 7 7v2.6" fill="none" stroke="#2E9CF2" stroke-width="7"/>'
        + '<path d="M-1 8.2h13.5a9.3 9.3 0 0 1 9.3 9.3v2.6" fill="none" stroke="#8ED0FF" stroke-width="1.5"/>'
        + '<rect x="14.6" y="19.4" width="9.8" height="3.6" rx="1.3" fill="#1C78C4"/>'
        + '<path d="M19.5 25.6c-1.5 2-2.3 3.4-2.3 4.4a2.3 2.3 0 0 0 4.6 0c0-1-.8-2.4-2.3-4.4z" fill="#9AD6FF"/>'
        + '<path d="M28.6 31.2v-7.4" stroke="#2C8A3C" stroke-width="2.1" stroke-linecap="round"/>'
        + '<path d="M28.6 25.4c.2-4.6 3.2-7.4 7.8-7.2-.1 4.5-3.2 7.4-7.8 7.2z" fill="#3AA94B"/>'
        + '<path d="M28.4 27.2c-.4-3.4-2.7-5.2-6-5 .3 3.3 2.6 5.2 6 5z" fill="#5CC56A"/>'
        + '<path d="M13.4 34.4h21.2l-2.3 8.2q-.4 1.4-1.8 1.4H17.5q-1.4 0-1.8-1.4z" fill="#D9734A"/>'
        + '<rect x="11.8" y="30.4" width="24.4" height="5" rx="2" fill="#EC8A5E"/>'
        + '<rect x="14" y="31.6" width="7" height="1.4" rx=".7" fill="#fff" opacity=".3"/>',
      tumbler: '<path d="M16.4 21v-4.8a7.6 7.6 0 0 1 15.2 0V21" fill="none" stroke="#DCD4FA" stroke-width="4.4" stroke-linecap="round"/>'
        + '<rect x="8.4" y="19.2" width="31.2" height="23" rx="6.6" fill="#1E1650" opacity=".25" transform="translate(0 1.4)"/>'
        + '<rect x="8.4" y="19.2" width="31.2" height="23" rx="6.6" fill="#FFFFFF"/>'
        + '<path d="M8.4 34.6h31.2v1q0 6.6-6.6 6.6H15q-6.6 0-6.6-6.6z" fill="#5B47AE" opacity=".1"/>'
        + peg(15.9, 0) + peg(24, 1) + peg(32.1, 2),
      glimpse: '<path d="M10.4 5.6l1.2 3.7 3.7 1.2-3.7 1.2-1.2 3.7-1.2-3.7-3.7-1.2 3.7-1.2z" fill="#fff" opacity=".92"/>'
        + '<circle cx="25" cy="26" r="17.2" fill="#0E2E6E" opacity=".22" transform="translate(0 1.2)"/>'
        + '<circle cx="25" cy="26" r="17.2" fill="#F7FBF2"/>'
        + '<circle cx="25" cy="26" r="11.2" fill="none" stroke="#18291F" stroke-opacity=".1" stroke-width=".8"/>'
        + '<g transform="translate(16.9 17.6) scale(.162)"><path d="' + GL_PATHS.rabbit + '" fill="#18291F"/></g>'
        + '<g transform="translate(29.6 12.4) scale(.07)"><path d="' + GL_PATHS.bird + '" fill="#2F72DC"/></g>',
      stacks: '<path d="M-1 37.8c9-2.2 17-.4 26-1.4s15-1.6 24 0V49H-1z" fill="#EEDDB9"/>'
        + '<ellipse cx="24" cy="38.6" rx="13" ry="1.9" fill="#8A6A3B" opacity=".22"/>'
        + '<rect x="22.7" y="7" width="2.6" height="31.6" rx="1.3" fill="#8A5C3B"/>'
        + disc(33.8, 25, '#6F90C2') + disc(26.6, 19.4, '#D06A50') + disc(19.4, 13.8, '#72A862'),
      switchback: '<path d="M-1 29.6c9-3.6 19-1 29-2.8s15-2.2 21-.6V49H-1z" fill="#A3D886"/>'
        + '<path d="M-1 33.4c11-2.6 20-.8 30-2.4s14-1.6 20-.8V49H-1z" fill="#8BCB6F"/>'
        + '<path d="M26.6 27.4h3.1c.6 2.6-3.6 4.8-2.4 8.2 1.2 3.6 8.4 6.6 9.6 13.4H14.6c1.4-7 7.4-10.2 7.2-13.6-.2-3.2 4.6-5.2 4.8-8z" fill="#6D7383"/>'
        + '<path d="M28.1 29.2c-.6 1.6-2.6 2.8-2.1 5.4M26.6 38.4c1.4 2.4 3.6 4.6 3.6 9" fill="none" stroke="#F8F3E6" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="2.4 2.6"/>'
        + '<rect x="35.2" y="17" width="1.6" height="14" rx=".8" fill="#7F8794"/>'
        + '<path d="M36 6.4 43.4 19.2H28.6z" fill="#fff" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/>'
        + '<path d="M36 7.8 42.2 18.4H29.8z" fill="#E23B36" stroke="#E23B36" stroke-width="1" stroke-linejoin="round"/>'
        + '<path d="M36 11 39.6 17.2H32.4z" fill="#fff" stroke="#fff" stroke-width=".6" stroke-linejoin="round"/>'
        + '<g transform="translate(32.9 13.5) scale(.29)" fill="#26324A"><path d="M4 5.2C4 3.8 5 3 6.4 3H17c1.6 0 2.6 1 2.6 2.6V9.8c0 1-.8 1.8-1.8 1.8H6c-1.2 0-2-.8-2-2z"/><path d="M.4 4.2C.4 2.8 1.4 2 2.6 2h2.8v6.2H2.6C1.2 8.2.4 7.2.4 6z"/><path d="M5.4 10.6h2v4.6h-2zM8.6 10.6h2v4.6h-2zM14 10.6h2v4.6h-2zM17.2 10.6h2v4.6h-2z"/><path d="M1 2.4.2.4l1.8 1.4M4.8 2.4 5.6.4 3.8 1.8z"/></g>',
      keepsake: '<path d="M14.6 25c0-13.6 18.8-13.6 18.8 0" fill="none" stroke="#B9773D" stroke-width="3" stroke-linecap="round"/>'
        + '<path d="M19.4 18.4c1.8-1.3 4.6-.4 5.2 2.2.8 3.4-1.4 6.8-4.2 6.8-.4 0-.7-.1-1-.2-.3.1-.6.2-1 .2-2.8 0-5-3.4-4.2-6.8.6-2.6 3.4-3.5 5.2-2.2z" fill="#E8463D"/>'
        + '<path d="M19.4 18.6c0-1.4.5-2.4 1.5-3" stroke="#6B4423" stroke-width="1.1" stroke-linecap="round" fill="none"/>'
        + '<path d="M20.6 16.6c1.4-1.5 3.4-1.6 4.6-.6-1.3 1.4-3.2 1.6-4.6.6z" fill="#4CAF50"/>'
        + '<ellipse cx="16.8" cy="21.2" rx="1" ry="1.6" fill="#fff" opacity=".45"/>'
        + '<path d="M30.6 15.6c1.8 0 2.4 2 3.4 3.6 1 1.6 2.4 2.8 2.4 4.8 0 2.6-2.6 4-5.8 4s-5.8-1.4-5.8-4c0-2 1.4-3.2 2.4-4.8s1.6-3.6 3.4-3.6z" fill="#F2C94C"/>'
        + '<path d="M30.6 15.8v-2" stroke="#6B4423" stroke-width="1.1" stroke-linecap="round"/>'
        + '<path d="M9.4 27.6h29.2l-2.8 12.6q-.4 1.8-2.2 1.8H14.4q-1.8 0-2.2-1.8z" fill="#CF8C4E"/>'
        + '<path d="M11 32.4h26M12.1 37.2h23.8M18.2 28v13.6M24 28v13.6M29.8 28v13.6" stroke="#A86B33" stroke-width="1.2" opacity=".75"/>'
        + '<rect x="7.8" y="24.6" width="32.4" height="5" rx="2.5" fill="#E2A766"/>'
        + '<rect x="10.4" y="25.6" width="9" height="1.4" rx=".7" fill="#fff" opacity=".35"/>',
    };
  }
  // the level's medal on a game's badge: bronze for Advanced, silver for Pro, gold for Expert,
  // gold with a crown for Master. Seen in the menu, the title row and the profile
  const MEDAL = { 2: ['#F6C08A', '#B9692C', '#6E3A12'], 3: ['#FFFFFF', '#B4BDCA', '#566173'], 4: ['#FFEA94', '#EBA51C', '#7A4E00'], 5: ['#FFEA94', '#EBA51C', '#7A4E00'] };
  const STAR_D = 'M12 2.4l2.95 6 6.6.95-4.78 4.66 1.13 6.57L12 17.48l-5.9 3.1 1.13-6.57L2.45 9.35l6.6-.95z';
  function medalSvg(lv, id) {
    const c = MEDAL[lv];
    if (!c) return '';
    const glyph = lv === 5 ? '<path d="M34.3 42.6h9.4l1.1-6.6-3.2 2.6L39 34.2l-2.6 4.4-3.2-2.6z" fill="' + c[2] + '"/>'
      : '<path d="' + STAR_D + '" fill="' + c[2] + '" transform="translate(34.68 34.6) scale(.36)"/>';
    return '<g class="medal"><defs><linearGradient id="' + id + 'm" x1="0" y1="0" x2=".45" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient></defs>'
      + '<circle cx="39" cy="39.8" r="8.8" fill="#000" opacity=".22"/>'
      + '<circle cx="39" cy="39" r="8.8" fill="url(#' + id + 'm)" stroke="#fff" stroke-width="1.8"/>' + glyph + '</g>';
  }
  function badge(g, cls, level) {
    if (!badgeArt) badgeArt = makeBadgeArt();
    const id = 'bdg' + (++badgeSeq), c = BADGE_BG[g] || BADGE_BG.mixed;
    const el = document.createElementNS(SVGNS, 'svg');
    el.setAttribute('viewBox', '0 0 48 48');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('class', 'badge' + (cls ? ' ' + cls : ''));
    el.innerHTML = '<defs><linearGradient id="' + id + 'g" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient>'
      + '<clipPath id="' + id + 'c"><rect width="48" height="48" rx="13"/></clipPath></defs>'
      + '<rect width="48" height="48" rx="13" fill="url(#' + id + 'g)"/>'
      + '<g clip-path="url(#' + id + 'c)">' + (badgeArt[g] || '') + '</g>'
      + '<rect x=".7" y=".7" width="46.6" height="46.6" rx="12.4" fill="none" stroke="#fff" stroke-opacity=".24" stroke-width="1.4"/>'
      + (level > 1 ? medalSvg(level, id) : '');
    return el;
  }
  const gameLevel = (g) => Math.max(1, Math.min(5, store.get('pr1.levels', {})[g] || 1));

  // ---------------------------------------------------------------- records
  // Your best at each level of each game in free play, in the game's own measure: the fastest
  // solve, the fewest tries, the shortest flash reached, the best average speed, the shortest look
  // with everything right. One number to beat on every card, beside what is possible at all.
  const tsec = (ms) => (ms < 59950 ? (Math.round(ms / 100) / 10).toFixed(1) + ' s' : clock(ms));
  const RECORD = {
    outbound: { lower: true, fmt: tsec, what: 'fastest solve' },
    conduit: { lower: true, fmt: tsec, what: 'fastest solve' },
    stacks: { lower: true, fmt: tsec, what: 'fastest solve' },
    tumbler: { lower: true, fmt: (v) => v + (v === 1 ? ' try' : ' tries'), what: 'fewest tries' },
    glimpse: { lower: true, fmt: (v) => secs(v) + ' s', what: 'fastest photo' },
    switchback: { lower: false, fmt: (v) => v + ' km/h', what: 'best average speed' },
    keepsake: { lower: true, fmt: (v) => secs(v) + ' s', what: 'shortest look, all right' },
  };
  let skFresh = false;
  const Records = {
    all() {
      let r = store.get('pr1.records', null);
      if (!r) {
        // the first time: Glimpse's shortest flashes, kept per level before records existed
        r = {};
        const gl = store.get('pr1.glreach', null);
        if (gl) r.glimpse = Object.assign({}, gl);
        store.set('pr1.records', r);
      }
      // Stacks levels 4 and 5 are other puzzles now (the cake, the ice cream): their old records go, once;
      // and from app 2.29 the puzzle levels that got harder start their records afresh, once
      if (!skFresh) {
        skFresh = true;
        if (!store.get('pr1.skfresh', false)) {
          if (r.stacks) { delete r.stacks[4]; delete r.stacks[5]; store.set('pr1.records', r); }
          store.set('pr1.skfresh', true);
        }
        if (!store.get('pr1.harder229', false)) {
          for (const [g, lvs] of [['outbound', [2, 3, 4, 5]], ['stacks', [2, 3, 4, 5]], ['conduit', [3, 4, 5]]]) if (r[g]) for (const lv of lvs) delete r[g][lv];
          store.set('pr1.records', r);
          store.set('pr1.harder229', true);
        }
      }
      return r;
    },
    get(g, lv) { const r = this.all(); return r[g] && r[g][lv] != null ? r[g][lv] : null; },
    // the card in the game's measure, or null when it cannot be a record
    value(g, sm) {
      if (g === 'outbound' || g === 'conduit' || g === 'stacks') return sm.outcome === 'solved' ? Math.max(0, Math.round(sm.duration_ms - (sm.hidden_ms || 0))) : null;
      if (g === 'tumbler') return sm.outcome === 'solved' ? sm.moves : null;
      if (sm.outcome !== 'complete') return null;
      if (g === 'glimpse') return sm.gl && sm.gl.reach_ms != null ? Math.round(sm.gl.reach_ms) : null;
      if (g === 'switchback') return sm.sb && sm.sb.speed_mean_kmh != null ? Math.round(sm.sb.speed_mean_kmh) : null;
      if (g === 'keepsake') return sm.ks && sm.ks.n && sm.ks.correct === sm.ks.n && sm.ks.study_ms != null ? Math.round(sm.ks.study_ms) : null;
      return null;
    },
    // keep a card's value; a new record must also look better as shown, not only by a hair
    note(g, lv, sm) {
      const v = this.value(g, sm);
      if (v == null || !RECORD[g]) return null;
      const r = this.all(), prev = r[g] && r[g][lv] != null ? r[g][lv] : null, R = RECORD[g];
      const isNew = prev != null && (R.lower ? v < prev : v > prev) && R.fmt(v) !== R.fmt(prev);
      if (prev == null || isNew) { (r[g] = r[g] || {})[lv] = v; store.set('pr1.records', r); }
      return { v, prev, isNew, first: prev == null };
    },
  };

  // ---------------------------------------------------------------- level looks
  // Every level of a game has a look of its own, so a new level is also a new place (practice
  // keeps the first look). The colors, the board's materials and the scene around it change;
  // in Outbound, Conduit and Tumbler the board and its pieces too (from app 2.31), and in Stacks
  // the pieces and rules.
  const LOOK_NAMES = {
    outbound: ['the town lot', 'the beach', 'the city at night', 'the ski lodge', 'the ferry at sunset'],
    conduit: ['the herb garden', 'the farmyard', 'the Japanese garden', 'the desert oasis', 'the palace garden at night'],
    tumbler: ['the bike lock', 'the school locker', 'the front door', 'the safe', 'the vault'],
    keepsake: ['the park in spring', 'the park in summer', 'the park in autumn', 'the park in winter', 'the park at night'],
    glimpse: ['the meadow', 'the pond', 'the forest', 'the jungle', 'the night walk'],
    stacks: ['the river stones', 'the station', 'the harbor', 'the bakery', 'the ice cream parlor'],
  };
  const lookName = (g, lv) => (LOOK_NAMES[g] ? LOOK_NAMES[g][lv - 1] || '' : '');
  // a seeded scatter: n points in a box, the same every time
  function scatter(n, seed, x0, y0, x1, y1) {
    const out = [];
    let r = seed >>> 0;
    const rnd = () => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; };
    for (let i = 0; i < n; i++) out.push([x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), rnd()]);
    return out;
  }
  const starsSvg = (n, seed, y1, op) => scatter(n, seed, 0, 0, 400, y1).map(([x, y, k]) =>
    '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (0.8 + k * 1.6).toFixed(2) + '" fill="#FFFFFF" opacity="' + (op * (0.45 + k * 0.55)).toFixed(2) + '"/>').join('');
  const flakesSvg = (n, seed, op) => scatter(n, seed, 0, 0, 400, 800).map(([x, y, k]) =>
    '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (1.4 + k * 2.8).toFixed(2) + '" fill="#FFFFFF" opacity="' + (op * (0.5 + k * 0.5)).toFixed(2) + '"/>').join('');
  const moonSvg = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + r * 2.2 + '" fill="#FFF6D6" opacity=".12"/><circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#FFF3D0"/>'
    + '<circle cx="' + (x - r * 0.3) + '" cy="' + (y - r * 0.15) + '" r="' + r * 0.22 + '" fill="#EADDB6" opacity=".7"/><circle cx="' + (x + r * 0.32) + '" cy="' + (y + r * 0.3) + '" r="' + r * 0.15 + '" fill="#EADDB6" opacity=".7"/>';
  const sunSvg = (x, y, r, c) => '<circle cx="' + x + '" cy="' + y + '" r="' + r * 1.9 + '" fill="' + c + '" opacity=".22"/><circle cx="' + x + '" cy="' + y + '" r="' + r * 1.4 + '" fill="' + c + '" opacity=".3"/><circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + c + '"/>';
  const pineSvg = (x, y, k, c) => '<path d="M' + x + ' ' + (y - 70 * k) + 'L' + (x + 26 * k) + ' ' + (y - 22 * k) + 'H' + (x + 12 * k) + 'L' + (x + 32 * k) + ' ' + y + 'H' + (x - 32 * k) + 'L' + (x - 12 * k) + ' ' + (y - 22 * k) + 'H' + (x - 26 * k) + 'Z" fill="' + c + '"/>'
    + '<path d="M' + x + ' ' + (y - 70 * k) + 'L' + (x + 12 * k) + ' ' + (y - 48 * k) + 'Q' + x + ' ' + (y - 52 * k) + ' ' + (x - 12 * k) + ' ' + (y - 48 * k) + 'Z" fill="#FFFFFF"/>';
  // Outbound's places are seen from straight above, like the lot itself: tree tops, roofs,
  // umbrellas, rooftops at night, pines in the snow, the ferry's bow and stern on the sea.
  const topTree = (x, y, r, c1, c2) => '<ellipse cx="' + (x + r * 0.18) + '" cy="' + (y + r * 0.22) + '" rx="' + r + '" ry="' + r * 0.96 + '" fill="#000" opacity=".14"/>'
    + '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + c1 + '"/>'
    + [[-0.35, -0.3, 0.55], [0.32, -0.12, 0.5], [-0.05, 0.36, 0.5]].map(([dx, dy, k]) => '<circle cx="' + (x + dx * r).toFixed(1) + '" cy="' + (y + dy * r).toFixed(1) + '" r="' + (k * r).toFixed(1) + '" fill="' + c2 + '"/>').join('')
    + '<circle cx="' + (x - r * 0.42) + '" cy="' + (y - r * 0.4) + '" r="' + r * 0.22 + '" fill="#FFFFFF" opacity=".22"/>';
  // a gabled roof from above: two slopes and the ridge, a chimney
  const topRoof = (x, y, w, h, c1, c2) => '<rect x="' + (x + 5) + '" y="' + (y + 6) + '" width="' + w + '" height="' + h + '" fill="#000" opacity=".12"/>'
    + '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h / 2 + '" fill="' + c1 + '"/><rect x="' + x + '" y="' + (y + h / 2) + '" width="' + w + '" height="' + h / 2 + '" fill="' + c2 + '"/>'
    + '<path d="M' + x + ' ' + (y + h / 2) + 'H' + (x + w) + '" stroke="#000" stroke-opacity=".18" stroke-width="2"/>'
    + Array.from({ length: Math.floor(w / 12) }, (_, k) => '<path d="M' + (x + 6 + k * 12) + ' ' + y + 'V' + (y + h) + '" stroke="#000" stroke-opacity=".06" stroke-width="1.5"/>').join('')
    + '<rect x="' + (x + w * 0.7) + '" y="' + (y + h * 0.16) + '" width="10" height="10" fill="#8A4A36"/><rect x="' + (x + w * 0.7 + 2) + '" y="' + (y + h * 0.16 + 2) + '" width="6" height="6" fill="#3A2218"/>';
  // a beach umbrella from above: wedges in two colors round a pole
  const topUmbrella = (x, y, r, c1, c2) => '<ellipse cx="' + (x + r * 0.35) + '" cy="' + (y + r * 0.4) + '" rx="' + r + '" ry="' + r * 0.92 + '" fill="#8A6A2E" opacity=".18"/>'
    + Array.from({ length: 8 }, (_, k) => { const a0 = (k * Math.PI) / 4, a1 = ((k + 1) * Math.PI) / 4; return '<path d="M' + x + ' ' + y + 'L' + (x + Math.cos(a0) * r).toFixed(1) + ' ' + (y + Math.sin(a0) * r).toFixed(1) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + Math.cos(a1) * r).toFixed(1) + ' ' + (y + Math.sin(a1) * r).toFixed(1) + 'Z" fill="' + (k % 2 ? c2 : c1) + '"/>'; }).join('')
    + '<circle cx="' + x + '" cy="' + y + '" r="3" fill="#FFFFFF"/>';
  const topTowel = (x, y, w, h, a, c1, c2) => '<g transform="rotate(' + a + ' ' + x + ' ' + y + ')"><rect x="' + (x - w / 2) + '" y="' + (y - h / 2) + '" width="' + w + '" height="' + h + '" rx="3" fill="' + c1 + '"/>'
    + Array.from({ length: 3 }, (_, k) => '<rect x="' + (x - w / 2) + '" y="' + (y - h / 2 + (k + 0.6) * h / 3.6) + '" width="' + w + '" height="' + h / 9 + '" fill="' + c2 + '"/>').join('') + '</g>';
  // a palm from above: fronds round the crown
  const topPalm = (x, y, r) => '<ellipse cx="' + (x + 10) + '" cy="' + (y + 12) + '" rx="' + r + '" ry="' + r * 0.9 + '" fill="#000" opacity=".12"/>'
    + Array.from({ length: 7 }, (_, k) => { const a = (k * 360) / 7 + 10; return '<path d="M0 0C' + r * 0.3 + ' -' + r * 0.22 + ' ' + r * 0.75 + ' -' + r * 0.2 + ' ' + r + ' 0C' + r * 0.7 + ' ' + r * 0.12 + ' ' + r * 0.3 + ' ' + r * 0.14 + ' 0 0Z" fill="' + (k % 2 ? '#3E9E4C' : '#2F8A40') + '" transform="translate(' + x + ' ' + y + ') rotate(' + a + ')"/>'; }).join('')
    + '<circle cx="' + (x - 3) + '" cy="' + (y + 2) + '" r="4" fill="#7A4A22"/><circle cx="' + (x + 3) + '" cy="' + (y - 1) + '" r="4" fill="#8A5A2E"/>';
  // a pine from above: a round, scalloped crown, darker outside, with snow on its branches
  const topPine = (x, y, r) => {
    const scallop = (rr, n, c) => '<path d="' + Array.from({ length: n }, (_, k) => { const a0 = (k * Math.PI * 2) / n, a1 = ((k + 1) * Math.PI * 2) / n; return (k ? '' : 'M' + (x + Math.cos(a0) * rr).toFixed(1) + ' ' + (y + Math.sin(a0) * rr).toFixed(1)) + 'A' + (rr * 0.42).toFixed(1) + ' ' + (rr * 0.42).toFixed(1) + ' 0 0 1 ' + (x + Math.cos(a1) * rr).toFixed(1) + ' ' + (y + Math.sin(a1) * rr).toFixed(1); }).join('') + 'Z" fill="' + c + '"/>';
    return '<ellipse cx="' + (x + r * 0.25) + '" cy="' + (y + r * 0.3) + '" rx="' + r * 1.05 + '" ry="' + r + '" fill="#4A6A8A" opacity=".16"/>'
      + scallop(r * 0.88, 9, '#2E5A52') + scallop(r * 0.58, 7, '#3C7266') + '<circle cx="' + x + '" cy="' + y + '" r="' + r * 0.22 + '" fill="#4E8A78"/>'
      + [[-0.5, -0.3, 0.2], [0.42, -0.48, 0.17], [0.55, 0.28, 0.19], [-0.25, 0.55, 0.16], [0.05, -0.12, 0.12]].map(([dx, dy, k]) => '<ellipse cx="' + (x + dx * r).toFixed(1) + '" cy="' + (y + dy * r).toFixed(1) + '" rx="' + (r * k).toFixed(1) + '" ry="' + (r * k * 0.75).toFixed(1) + '" fill="#FFFFFF" opacity=".95"/>').join('');
  };
  // a gull seen from above, wings spread
  const topGull = (x, y, s) => '<path d="M' + (x - 9 * s) + ' ' + (y + 2 * s) + 'Q' + (x - 4 * s) + ' ' + (y - 3 * s) + ' ' + x + ' ' + y + 'Q' + (x + 4 * s) + ' ' + (y - 3 * s) + ' ' + (x + 9 * s) + ' ' + (y + 2 * s) + 'Q' + (x + 4 * s) + ' ' + (y - 0.5 * s) + ' ' + x + ' ' + (y + 2.5 * s) + 'Q' + (x - 4 * s) + ' ' + (y - 0.5 * s) + ' ' + (x - 9 * s) + ' ' + (y + 2 * s) + 'Z" fill="#FFFFFF"/>';
  const OB_DECOR = {
    // the town lot: roofs and tree tops round a paved square
    1: () => {
      let v = '<g stroke="#FFFFFF" stroke-opacity=".2" stroke-width="2">';
      for (let y = 132; y < 240; y += 22) v += '<path d="M0 ' + y + 'H400"/>';
      for (let y = 652; y < 800; y += 22) v += '<path d="M0 ' + y + 'H400"/>';
      v += '</g>';
      v += topRoof(-6, 132, 112, 78, '#E8784E', '#CE5C3C') + topRoof(298, 140, 104, 70, '#6C9BD8', '#5482C0')
        + topTree(162, 206, 26, '#4E9A4A', '#62B05A') + topTree(232, 186, 20, '#4E9A4A', '#62B05A')
        + topTree(30, 704, 34, '#4E9A4A', '#62B05A') + topTree(372, 722, 30, '#4E9A4A', '#62B05A')
        + '<g transform="rotate(-8 112 690)"><rect x="86" y="680" width="52" height="18" rx="3" fill="#8A5A36"/><path d="M90 686H134M90 692H134" stroke="#6E4428" stroke-width="2"/></g>'
        + '<circle cx="292" cy="688" r="20" fill="#7FBF5C"/>' + [[-8, -6, '#FF6FA7'], [6, -9, '#FFFFFF'], [9, 5, '#FFC93C'], [-5, 8, '#FF6FA7'], [0, 0, '#FFFFFF']].map(([dx, dy, c]) => '<circle cx="' + (292 + dx) + '" cy="' + (688 + dy) + '" r="4" fill="' + c + '"/>').join('');
      return v;
    },
    // the beach: umbrellas and towels on the sand, the sea along the bottom, a palm and a board
    2: () => {
      let v = topUmbrella(40, 196, 34, '#FF5D5D', '#FFFFFF') + topTowel(104, 200, 26, 48, 18, '#FF9EC0', '#FFFFFF')
        + topUmbrella(360, 178, 30, '#3D8BFD', '#FFD23F') + topTowel(296, 202, 24, 44, -14, '#22BFB0', '#FFFFFF')
        + '<circle cx="232" cy="214" r="9" fill="#FFFFFF"/><path d="M232 205A9 9 0 0 1 241 214H232Z" fill="#FF5D5D"/><path d="M232 223A9 9 0 0 1 223 214H232Z" fill="#3D8BFD"/>';
      // footprints across the sand
      for (let k = 0; k < 6; k++) v += '<ellipse cx="' + (140 + k * 9 + (k % 2) * 6) + '" cy="' + (676 - k * 2) + '" rx="2.6" ry="4.2" fill="#D9B97A" opacity=".7" transform="rotate(70 ' + (140 + k * 9 + (k % 2) * 6) + ' ' + (676 - k * 2) + ')"/>';
      v += '<g transform="rotate(-24 62 676)"><ellipse cx="62" cy="676" rx="12" ry="40" fill="#FFC93C"/><ellipse cx="62" cy="676" rx="2.5" ry="36" fill="#FFFFFF" opacity=".85"/></g>'
        + '<path d="M0 726Q60 708 120 720T240 716T400 708V800H0Z" fill="#33B6D8"/><path d="M0 726Q60 708 120 720T240 716T400 708" stroke="#FFFFFF" stroke-width="5" fill="none" opacity=".85"/>'
        + '<path d="M20 752q30-8 60 0M160 744q30-8 60 0M290 760q30-8 60 0M90 784q30-8 60 0M240 790q30-8 60 0" stroke="#FFFFFF" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/>'
        + topPalm(378, 676, 40);
      return v;
    },
    // the city at night: rooftops round the lot, the streets between them, light trails and lamps
    3: () => {
      const roof = (x, y, w, h) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="#2A2F4E"/><rect x="' + (x + 5) + '" y="' + (y + 5) + '" width="' + (w - 10) + '" height="' + (h - 10) + '" rx="2" fill="#323858"/>';
      const unit = (x, y) => '<rect x="' + x + '" y="' + y + '" width="22" height="16" rx="2" fill="#4A5274"/><circle cx="' + (x + 11) + '" cy="' + (y + 8) + '" r="5" fill="#2A2F4E"/><path d="M' + (x + 7) + ' ' + (y + 8) + 'H' + (x + 15) + 'M' + (x + 11) + ' ' + (y + 4) + 'V' + (y + 12) + '" stroke="#5E6890" stroke-width="1.5"/>';
      const lamp = (x, y) => '<circle cx="' + x + '" cy="' + y + '" r="14" fill="#FFD86A" opacity=".12"/><circle cx="' + x + '" cy="' + y + '" r="6" fill="#FFD86A" opacity=".3"/><circle cx="' + x + '" cy="' + y + '" r="2.5" fill="#FFF2B0"/>';
      let v = roof(-8, 118, 150, 110) + unit(20, 140) + unit(58, 172) + '<rect x="96" y="134" width="30" height="20" rx="2" fill="#FFD86A" opacity=".55"/>'
        + roof(256, 110, 152, 118) + '<circle cx="330" cy="168" r="34" fill="#3A4066"/><circle cx="330" cy="168" r="28" fill="none" stroke="#FFFFFF" stroke-width="3" opacity=".8"/>'
        + '<path d="M318 152V184M342 152V184M318 168H342" stroke="#FFFFFF" stroke-width="5" opacity=".85"/>'
        + roof(-8, 660, 168, 150) + '<rect x="18" y="684" width="76" height="40" rx="4" fill="#3FD0E8" opacity=".75"/><path d="M26 696q10-4 20 0t20 0 20 0" stroke="#FFFFFF" stroke-width="2" fill="none" opacity=".6"/>'
        + [[110, 690], [130, 690], [110, 710], [130, 710]].map(([x, y]) => '<rect x="' + x + '" y="' + y + '" width="16" height="16" rx="3" fill="#3E7A4A"/>').join('')
        + roof(240, 668, 168, 142) + unit(262, 690) + unit(300, 690) + '<circle cx="356" cy="720" r="20" fill="#4A5274"/><circle cx="356" cy="720" r="14" fill="#3A4066"/>';
      // the streets: light trails of cars going by, lamps along the kerbs
      v += '<path d="M160 150V240M168 150V240M232 150V240M240 150V240" stroke="#FF4D4D" stroke-width="2.5" opacity=".55" stroke-dasharray="40 26"/>'
        + '<path d="M190 150V240M206 150V240" stroke="#FFF4BE" stroke-width="2.5" opacity=".5" stroke-dasharray="30 40"/>'
        + '<path d="M186 660V800M196 660V800" stroke="#FFF4BE" stroke-width="2.5" opacity=".45" stroke-dasharray="26 34"/><path d="M212 660V800M222 660V800" stroke="#FF4D4D" stroke-width="2.5" opacity=".5" stroke-dasharray="34 30"/>'
        + lamp(150, 236) + lamp(250, 236) + lamp(176, 660) + lamp(232, 660);
      return v;
    },
    // the ski lodge: pines in the snow, ski tracks, a chalet roof and a snowman
    4: () => {
      const track = (d) => '<path d="' + d + '" stroke="#C3D3E6" stroke-width="2" fill="none" opacity=".9"/><path d="' + d + '" stroke="#C3D3E6" stroke-width="2" fill="none" opacity=".9" transform="translate(7 2)"/>';
      let v = flakesSvg(26, 5, 0.6)
        + track('M-10 230C60 200 110 220 160 170S260 130 330 150')
        + track('M60 800C90 760 150 740 190 700S300 660 410 690')
        + topRoof(272, 118, 108, 76, '#8A5A3A', '#74482C') + '<path d="M272 118H380V128H272ZM272 184H380V194H272Z" fill="#FFFFFF" opacity=".92"/>'
        + '<circle cx="372" cy="104" r="9" fill="#FFFFFF" opacity=".6"/><circle cx="384" cy="92" r="6" fill="#FFFFFF" opacity=".45"/>'
        + topPine(28, 168, 30) + topPine(84, 214, 20) + topPine(228, 216, 18)
        + topPine(30, 690, 32) + topPine(370, 742, 34) + topPine(330, 676, 18)
        + '<circle cx="118" cy="706" r="17" fill="#FFFFFF" stroke="#C9D6E6" stroke-width="2"/><circle cx="118" cy="706" r="11" fill="#FFFFFF" stroke="#C9D6E6" stroke-width="1.5"/>'
        + '<circle cx="118" cy="706" r="7" fill="#1F2128"/><circle cx="118" cy="706" r="4.5" fill="#33363F"/><path d="M118 712L114 724L122 712Z" fill="#FF8A1F"/>';
      return v;
    },
    // the ferry at sunset: its bow and its stern on the sea, the wake behind it, gulls and the sun on the water
    5: () => {
      let v = '';
      for (const [x, y, w] of [[30, 70, 26], [70, 110, 18], [330, 60, 30], [300, 120, 16], [350, 100, 20], [40, 770, 30], [340, 780, 26], [20, 740, 16], [380, 750, 14]]) v += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="3" rx="1.5" fill="#FFE2A8" opacity=".55"/>';
      // the car deck round the lot, and the hull along both sides of it
      v += '<rect x="-4" y="226" width="408" height="440" fill="#B9C2CC"/><rect x="-4" y="226" width="30" height="440" fill="#F4F0F2"/><rect x="374" y="226" width="30" height="440" fill="#F4F0F2"/>'
        + '<rect x="-4" y="226" width="8" height="440" fill="#D84A4A"/><rect x="396" y="226" width="8" height="440" fill="#D84A4A"/>';
      // the bow: the deck narrowing to a point, the winches, the bridge with its radar
      v += '<path d="M-4 238L-4 226C40 190 140 140 200 120C260 140 360 190 404 226L404 238Z" fill="#F4F0F2"/>'
        + '<path d="M-4 226C40 190 140 140 200 120C260 140 360 190 404 226" stroke="#D84A4A" stroke-width="7" fill="none"/>'
        + '<circle cx="168" cy="164" r="8" fill="#9AA3B0"/><circle cx="232" cy="164" r="8" fill="#9AA3B0"/><path d="M168 164Q200 150 232 164" stroke="#5E6676" stroke-width="2" fill="none"/>'
        + '<rect x="128" y="190" width="144" height="40" rx="6" fill="#FFFFFF"/><rect x="128" y="190" width="144" height="8" rx="3" fill="#2A3A55"/><circle cx="246" cy="212" r="9" fill="#C9D4E0"/><path d="M238 212H254" stroke="#5E6676" stroke-width="3"/>';
      // the stern: the deck with its lifebuoys and the car ramp, and the wake on the water
      v += '<rect x="-4" y="660" width="408" height="58" fill="#F4F0F2"/><path d="M-4 718H404" stroke="#D84A4A" stroke-width="7"/>'
        + [[40, 690], [360, 690]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="11" fill="none" stroke="#FF7A2E" stroke-width="6"/><path d="M' + (x - 11) + ' ' + y + 'h4M' + (x + 7) + ' ' + y + 'h4M' + x + ' ' + (y - 11) + 'v4M' + x + ' ' + (y + 7) + 'v4" stroke="#FFFFFF" stroke-width="6"/>').join('')
        + '<rect x="130" y="666" width="140" height="46" rx="3" fill="#6E7884"/>' + Array.from({ length: 7 }, (_, k) => '<path d="M' + (138 + k * 20) + ' 666l12 46" stroke="#FFC83A" stroke-width="5" opacity=".9"/>').join('')
        + '<path d="M130 722C110 760 60 790 0 800M270 722C290 760 340 790 400 800" stroke="#FFFFFF" stroke-width="6" fill="none" opacity=".8" stroke-linecap="round"/>'
        + '<path d="M160 724C150 760 130 790 110 800M240 724C250 760 270 790 290 800" stroke="#FFFFFF" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/>'
        + scatter(18, 31, 120, 726, 280, 800).map(([x, y, k]) => '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + (1.5 + k * 2.5).toFixed(1) + '" fill="#FFFFFF" opacity=".55"/>').join('')
        + topGull(60, 160, 1.6) + topGull(340, 150, 1.3) + topGull(96, 196, 1.1);
      return v;
    },
  };
  const DECOR = {
    outbound: OB_DECOR,
    conduit: {
      // the farmyard: a red barn and round hay bales behind the fence
      2: () => sunSvg(320, 110, 34, '#FFF1A8')
        + '<path d="M-14 720V636l40-34h44l40 34V720z" fill="#C8443A"/><path d="M-14 636l40-34h44l40 34" fill="none" stroke="#FFF4E6" stroke-width="5" stroke-linejoin="round"/>'
        + '<path d="M-20 640l46-42h44l46 42" fill="none" stroke="#7A2A24" stroke-width="7" stroke-linejoin="round"/><rect x="22" y="652" width="44" height="68" fill="#9E3029"/><path d="M22 652l44 68M66 652l-44 68" stroke="#FFF4E6" stroke-width="4"/><rect x="22" y="652" width="44" height="68" fill="none" stroke="#FFF4E6" stroke-width="4"/>'
        + [[318, 676, 30], [366, 690, 26]].map(([x, y, r]) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#E3B754"/><circle cx="' + x + '" cy="' + y + '" r="' + r * 0.62 + '" fill="none" stroke="#C99A3A" stroke-width="3"/><circle cx="' + x + '" cy="' + y + '" r="' + r * 0.28 + '" fill="none" stroke="#C99A3A" stroke-width="3"/>').join('')
        + '<path d="M0 742H400" stroke="#9A6A3A" stroke-width="7"/><path d="M0 704H400" stroke="#9A6A3A" stroke-width="7"/>'
        + Array.from({ length: 11 }, (_, i) => '<path d="M' + (i * 40 + 8) + ' 800V690l10-12 10 12V800z" fill="#C08A52"/><path d="M' + (i * 40 + 18) + ' 680V800" stroke="#A57240" stroke-width="2"/>').join('')
        + '<circle cx="54" cy="790" r="26" fill="#6DB33F"/><circle cx="54" cy="790" r="16" fill="#8FCF5A"/><circle cx="352" cy="794" r="24" fill="#6DB33F"/><circle cx="352" cy="794" r="14" fill="#8FCF5A"/>',
      // the Japanese garden: a cherry branch in blossom, bamboo, a red bridge over the stream
      3: () => {
        const blossom = (x, y, k) => Array.from({ length: 5 }, (_, j) => { const a = (j * Math.PI * 2) / 5 - Math.PI / 2; return '<circle cx="' + (x + Math.cos(a) * 4.6 * k).toFixed(1) + '" cy="' + (y + Math.sin(a) * 4.6 * k).toFixed(1) + '" r="' + (4.2 * k).toFixed(1) + '" fill="#FFC6D6"/>'; }).join('') + '<circle cx="' + x + '" cy="' + y + '" r="' + (2.4 * k).toFixed(1) + '" fill="#FF86AA"/>';
        let v = '<path d="M0 744q100-16 200 0t200 0V800H0z" fill="#86CBE0"/><path d="M0 766q60-8 120 0t140 0 140 0" stroke="#C4ECF6" stroke-width="3" fill="none" opacity=".75"/>';
        // the bridge: an arched deck, its rail and posts
        let posts = '';
        for (let k = 0; k <= 8; k++) { const t = k / 8, q = t * (1 - t); posts += '<path d="M' + (50 + 300 * t).toFixed(1) + ' ' + (792 - 368 * q).toFixed(1) + 'V' + (770 - 408 * q).toFixed(1) + '" stroke="#B42C25" stroke-width="5"/>'; }
        v += '<path d="M50 792Q200 608 350 792" stroke="#C8342C" stroke-width="15" fill="none"/>' + posts
          + '<path d="M50 770Q200 566 350 770" stroke="#E0483A" stroke-width="6" fill="none" stroke-linecap="round"/>';
        // bamboo on the right
        for (const x of [350, 374, 396]) {
          v += '<rect x="' + (x - 6) + '" y="-10" width="12" height="820" fill="' + (x === 374 ? '#5E9440' : '#6FA34A') + '"/>';
          for (let y = 40 + (x % 3) * 22; y < 800; y += 86) v += '<path d="M' + (x - 6) + ' ' + y + 'H' + (x + 6) + '" stroke="#3F6E28" stroke-width="3"/>';
        }
        v += ['M344 120q-34 -6 -52 14q30 2 52 -14z', 'M344 200q-30 8 -40 32q26 -10 40 -32z', 'M370 64q-30 -14 -54 0q30 8 54 0z'].map((d) => '<path d="' + d + '" fill="#5E9440"/>').join('');
        // the cherry branch over the top, in blossom, and a few petals in the air
        v += '<path d="M412 168C350 166 300 196 214 192M330 172C312 150 290 140 262 140M290 186C276 204 250 214 220 214" stroke="#5A3A2A" stroke-width="7" fill="none" stroke-linecap="round"/>';
        v += [[372, 160, 1.1], [336, 168, 0.9], [300, 186, 1], [262, 138, 0.95], [236, 190, 1.1], [286, 146, 0.8], [222, 214, 0.9], [252, 210, 0.8], [396, 176, 0.85]].map(([x, y, k]) => blossom(x, y, k)).join('');
        v += scatter(7, 21, 170, 196, 330, 236).map(([x, y, k]) => '<ellipse cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" rx="' + (3 + k * 2).toFixed(1) + '" ry="2" fill="#FFB8CC" opacity=".8" transform="rotate(' + Math.round(k * 120 - 40) + ' ' + x.toFixed(0) + ' ' + y.toFixed(0) + ')"/>').join('');
        return v;
      },
      4: () => sunSvg(300, 150, 52, '#FFE9A0')
        + '<path d="M-20 700q120-60 240-20t200-10V800H-20z" fill="#F2B66B"/><path d="M-20 750q140-40 260-6t180-14V800H-20z" fill="#E59A50"/>'
        + [[62, 708, 1], [330, 690, 0.8], [372, 734, 0.6]].map(([x, y, k]) => '<path d="M' + x + ' ' + y + 'v-' + 90 * k + 'a' + 11 * k + ' ' + 11 * k + ' 0 0 1 ' + 22 * k + ' 0v' + 90 * k + 'z" fill="#4E8A4A" transform="translate(' + -11 * k + ' 0)"/>'
          + '<path d="M' + (x - 11 * k) + ' ' + (y - 40 * k) + 'h-' + 14 * k + 'v-' + 26 * k + 'a' + 7 * k + ' ' + 7 * k + ' 0 0 1 ' + 14 * k + ' 0z" fill="#4E8A4A"/><circle cx="' + x + '" cy="' + (y - 100 * k) + '" r="' + 6 * k + '" fill="#FF6FA7"/>').join(''),
      5: () => starsSvg(40, 11, 320, 0.85) + moonSvg(352, 192, 15)
        + '<path d="M0 736q50-36 100 0t100 0 100 0 100 0V800H0z" fill="#12321F"/><path d="M0 772q60-24 120 0t140 0 140 0V800H0z" fill="#0B2416"/>'
        + [26, 374].map((x) => '<path d="M' + x + ' 800V700" stroke="#2A2A2A" stroke-width="4"/><circle cx="' + x + '" cy="692" r="34" fill="#FFD27A" opacity=".18"/><circle cx="' + x + '" cy="692" r="16" fill="#FFD27A" opacity=".35"/><rect x="' + (x - 8) + '" y="680" width="16" height="22" rx="4" fill="#FFE7A8"/><path d="M' + (x - 11) + ' 680h22l-11-10z" fill="#2A2A2A"/>').join('')
        + scatter(14, 13, 30, 560, 370, 700).map(([x, y, k]) => '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="' + (2 + k * 2).toFixed(1) + '" fill="#FFF0A0" opacity="' + (0.4 + k * 0.5).toFixed(2) + '"/>').join(''),
    },
    // Tumbler: each level is the thing being opened, drawn round the lock, bold enough to name
    tumbler: {
      // a U-lock's shackle rising out of the lock, a bicycle leaning below
      1: () => {
        const wheel = (cx) => '<circle cx="' + cx + '" cy="712" r="60" fill="none" stroke="#1C1342" stroke-width="11"/><circle cx="' + cx + '" cy="712" r="53" fill="none" stroke="#C9CDD8" stroke-width="3"/>'
          + Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return '<path d="M' + cx + ' 712L' + (cx + Math.cos(a) * 52).toFixed(1) + ' ' + (712 + Math.sin(a) * 52).toFixed(1) + '" stroke="#C9CDD8" stroke-width="1.6" opacity=".7"/>'; }).join('')
          + '<circle cx="' + cx + '" cy="712" r="7" fill="#C9CDD8"/>';
        return '<defs><linearGradient id="tbd1s" x1="0" x2="1"><stop offset="0" stop-color="#8E96AA"/><stop offset=".42" stop-color="#F4F6FA"/><stop offset="1" stop-color="#7E869C"/></linearGradient></defs>'
          + '<path d="M128 272V224a72 72 0 0 1 144 0V272" fill="none" stroke="#1C1342" stroke-width="44" stroke-linecap="round"/>'
          + '<path d="M128 272V224a72 72 0 0 1 144 0V272" fill="none" stroke="url(#tbd1s)" stroke-width="32"/>'
          + '<path d="M118 230a82 82 0 0 1 30-66" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".55"/>'
          + wheel(78) + wheel(322)
          + '<g fill="none" stroke="#FFC83A" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><path d="M78 712L188 712L156 616ZM188 712L284 622L156 616M284 622L322 712"/></g>'
          + '<path d="M138 606h40" stroke="#1C1342" stroke-width="10" stroke-linecap="round"/><path d="M272 600l16-12h22" stroke="#1C1342" stroke-width="8" stroke-linecap="round" fill="none"/>'
          + '<circle cx="188" cy="712" r="12" fill="#1C1342"/><circle cx="188" cy="712" r="5" fill="#C9CDD8"/>';
      },
      // a row of school lockers: vents and number plates over the lock, handles and feet under it
      2: () => Array.from({ length: 6 }, (_, i) => {
        const x = i * 80 - 40, c = i % 2 ? '#3F8F96' : '#46999F';
        let v = '<rect x="' + (x + 3) + '" y="-10" width="74" height="780" rx="5" fill="' + c + '" stroke="#1E4A50" stroke-width="3"/>'
          + '<rect x="' + (x + 9) + '" y="-4" width="8" height="770" rx="3" fill="#FFFFFF" opacity=".12"/>';
        for (let k = 0; k < 4; k++) v += '<rect x="' + (x + 18) + '" y="' + (176 + k * 11) + '" width="44" height="5" rx="2.5" fill="#1E4A50"/>';
        for (let k = 0; k < 3; k++) v += '<rect x="' + (x + 18) + '" y="' + (700 + k * 11) + '" width="44" height="5" rx="2.5" fill="#1E4A50"/>';
        v += '<rect x="' + (x + 25) + '" y="150" width="30" height="18" rx="3" fill="#E3F2F2"/><text x="' + (x + 40) + '" y="164" text-anchor="middle" font-family="Lexend, system-ui, sans-serif" font-size="13" font-weight="700" fill="#1E4A50">' + (31 + i) + '</text>';
        v += '<rect x="' + (x + 58) + '" y="604" width="9" height="46" rx="4.5" fill="#D5E4E6"/><rect x="' + (x + 58) + '" y="604" width="9" height="16" rx="4.5" fill="#FFFFFF" opacity=".5"/>';
        return v;
      }).join('') + '<rect x="0" y="766" width="400" height="40" fill="#163A3F"/><path d="M0 766H400" stroke="#0E2A2E" stroke-width="4"/>',
      // the front door: a fanlight with the house number, panels, the letterbox, the knob, the mat
      3: () => '<rect x="0" y="0" width="34" height="800" fill="#4A2814"/><rect x="366" y="0" width="34" height="800" fill="#4A2814"/>'
        + '<path d="M34 0V800M366 0V800" stroke="#2E170A" stroke-width="5"/>'
        + '<path d="M96 236a104 104 0 0 1 208 0Z" fill="#BFE3F2" stroke="#3A1E0E" stroke-width="10" stroke-linejoin="round"/>'
        + [-0.66, -0.33, 0, 0.33, 0.66].map((a) => '<path d="M200 236L' + (200 + Math.sin(a) * 100).toFixed(1) + ' ' + (236 - Math.cos(a) * 100).toFixed(1) + '" stroke="#3A1E0E" stroke-width="5"/>').join('')
        + '<path d="M128 196a76 76 0 0 1 40-38" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" fill="none" opacity=".7"/>'
        + '<circle cx="200" cy="204" r="19" fill="#E7B54A" stroke="#8A5A1C" stroke-width="3"/><text x="200" y="211" text-anchor="middle" font-family="Lexend, system-ui, sans-serif" font-size="18" font-weight="700" fill="#5A3410">12</text>'
        + [[60, 604, 130, 120], [210, 604, 130, 120]].map(([x, y, w, hh]) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hh + '" rx="6" fill="#8E5A36" stroke="#5A3218" stroke-width="5"/><rect x="' + (x + 12) + '" y="' + (y + 12) + '" width="' + (w - 24) + '" height="' + (hh - 24) + '" rx="4" fill="#9E6840"/>').join('')
        + '<rect x="146" y="594" width="108" height="22" rx="6" fill="#E7B54A" stroke="#8A5A1C" stroke-width="3"/><rect x="158" y="602" width="84" height="6" rx="3" fill="#5A3410"/>'
        + '<circle cx="340" cy="566" r="16" fill="#E7B54A" stroke="#8A5A1C" stroke-width="3"/><circle cx="335" cy="561" r="5" fill="#FFF2C8" opacity=".8"/>'
        + '<rect x="40" y="758" width="320" height="50" rx="8" fill="#7A3A2A"/><rect x="52" y="768" width="296" height="40" rx="5" fill="none" stroke="#B8664C" stroke-width="4" stroke-dasharray="10 7"/>',
      // the safe: a riveted steel door, its hinges, the dial over the lock and the handle under it
      4: () => {
        let v = '<rect x="14" y="14" width="372" height="772" rx="26" fill="none" stroke="#2C313B" stroke-width="12"/><rect x="26" y="26" width="348" height="748" rx="18" fill="none" stroke="#B4BCC8" stroke-width="2" opacity=".5"/>';
        for (let k = 0; k < 15; k++) { const y = 48 + k * 51; v += '<circle cx="14" cy="' + y + '" r="5" fill="#D9DEE6"/><circle cx="386" cy="' + y + '" r="5" fill="#D9DEE6"/>'; }
        v += [176, 640].map((y) => '<rect x="0" y="' + (y - 34) + '" width="22" height="68" rx="6" fill="#2C313B"/><rect x="4" y="' + (y - 28) + '" width="10" height="56" rx="4" fill="#5A616E"/>').join('');
        v += '<circle cx="200" cy="186" r="50" fill="#2C313B"/><circle cx="200" cy="186" r="44" fill="#C9CFD8"/><circle cx="200" cy="186" r="30" fill="#9AA3B2"/><circle cx="200" cy="186" r="9" fill="#2C313B"/>';
        for (let k = 0; k < 40; k++) { const a = (k * Math.PI) / 20; v += '<path d="M' + (200 + Math.cos(a) * 36).toFixed(1) + ' ' + (186 + Math.sin(a) * 36).toFixed(1) + 'L' + (200 + Math.cos(a) * (k % 5 ? 41 : 43)).toFixed(1) + ' ' + (186 + Math.sin(a) * (k % 5 ? 41 : 43)).toFixed(1) + '" stroke="#2C313B" stroke-width="' + (k % 5 ? 1.2 : 2.2) + '"/>'; }
        v += '<path d="M200 128l-7-10h14z" fill="#E5564D"/>';
        v += '<g transform="translate(200 668)">' + [0, 120, 240].map((d) => '<g transform="rotate(' + (d - 90) + ')"><rect x="0" y="-6" width="58" height="12" rx="6" fill="#C9CFD8" stroke="#2C313B" stroke-width="2.5"/><circle cx="60" cy="0" r="11" fill="#E7EBF0" stroke="#2C313B" stroke-width="2.5"/></g>').join('')
          + '<circle r="20" fill="#C9CFD8" stroke="#2C313B" stroke-width="3"/><circle r="7" fill="#2C313B"/></g>';
        return v;
      },
      // the bank vault: a round brass door with its ring of bolts, and the great wheel under the lock
      5: () => {
        let v = '<defs><radialGradient id="tbd5d" cx=".5" cy=".5" r=".5"><stop offset=".7" stop-color="#3A2C10"/><stop offset="1" stop-color="#1A1306"/></radialGradient></defs>'
          + '<circle cx="200" cy="420" r="350" fill="url(#tbd5d)"/>'
          + '<circle cx="200" cy="420" r="346" fill="none" stroke="#C9962E" stroke-width="22"/><circle cx="200" cy="420" r="326" fill="none" stroke="#7A5A1A" stroke-width="5"/>'
          + '<circle cx="200" cy="420" r="300" fill="none" stroke="#E7B54A" stroke-width="3" opacity=".55"/>';
        for (let k = 0; k < 20; k++) {
          const a = (k * Math.PI) / 10, x = 200 + Math.cos(a) * 312, y = 420 + Math.sin(a) * 312;
          v += '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + (k * 18) + ')"><rect x="-16" y="-9" width="32" height="18" rx="9" fill="#E7B54A" stroke="#7A5A1A" stroke-width="2.5"/><rect x="-12" y="-6" width="12" height="4" rx="2" fill="#FFF2C8" opacity=".7"/></g>';
        }
        v += '<g transform="translate(200 672)"><circle r="70" fill="none" stroke="#7A5A1A" stroke-width="14"/><circle r="70" fill="none" stroke="#E7B54A" stroke-width="9"/>'
          + [0, 60, 120, 180, 240, 300].map((d) => '<g transform="rotate(' + d + ')"><rect x="14" y="-5" width="70" height="10" rx="5" fill="#E7B54A" stroke="#7A5A1A" stroke-width="2"/><circle cx="88" cy="0" r="10" fill="#F2CF72" stroke="#7A5A1A" stroke-width="2.5"/></g>').join('')
          + '<circle r="22" fill="#E7B54A" stroke="#7A5A1A" stroke-width="3"/><circle r="9" fill="#7A5A1A"/></g>';
        return v;
      },
    },
    keepsake: {
      2: () => sunSvg(330, 70, 30, '#FFF3B0') + scatter(6, 31, 20, 120, 380, 760).map(([x, y]) => '<path d="M' + x + ' ' + y + 'c-6-8-14-6-12 2 2 6 8 4 12-2zm0 0c6-8 14-6 12 2-2 6-8 4-12-2z" fill="#FF8FB8" opacity=".7"/>').join(''),
      3: () => scatter(26, 41, 0, 0, 400, 800).map(([x, y, k], i) => '<path d="M0-9C6-5 7 3 0 9-7 3-6-5 0-9z" fill="' + ['#E8833A', '#D4553A', '#F2B13C'][i % 3] + '" opacity=".75" transform="translate(' + x.toFixed(0) + ' ' + y.toFixed(0) + ') rotate(' + Math.round(k * 360) + ') scale(' + (0.7 + k * 0.8).toFixed(2) + ')"/>').join(''),
      4: () => flakesSvg(60, 43, 0.9),
      5: () => starsSvg(60, 47, 800, 0.85) + moonSvg(348, 712, 15),
    },
    glimpse: {
      5: () => starsSvg(60, 53, 800, 0.85) + moonSvg(70, 690, 16),
    },
  };
  function decor(g, lv) {
    const art = DECOR[g] && DECOR[g][lv];
    if (!art) return null;
    const el = document.createElementNS(SVGNS, 'svg');
    el.setAttribute('class', 'decor');
    el.setAttribute('viewBox', '0 0 400 800');
    el.setAttribute('preserveAspectRatio', 'xMidYMax slice');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = art();
    return el;
  }
  // Keepsake: the same park through the seasons, so its landmarks can still be learned
  // [from, to] in order, the most particular first (house windows before the pond's blue)
  const KS_SEASON = {
    2: [['#B6E39A', '#A9DE73'], ['#93CD78', '#7CC352'], ['#6DAF5A', '#5EA43F'], ['#86CFF2', '#7BD3F7'], ['#5DB4E0', '#3FB0E6']],
    3: [['#B6E39A', '#E4CF86'], ['#93CD78', '#D2AE5E'], ['#6DAF5A', '#B58A44'], ['#3E9A55', '#E8833A'], ['#358C4D', '#D4553A'], ['#4BAE63', '#F2A33C'],
      ['#2F7F45', '#C9612F'], ['#2A7340', '#B5482C'], ['#3A8E50', '#E28A34'], ['#FF6FA7', '#E8833A']],
    4: [['fill="#8A5C3B"/><ellipse cx="87" cy="102.4" rx="10" ry="4.8" fill="#A06E46"', 'fill="#C9D6E2"/><ellipse cx="87" cy="102.4" rx="10" ry="4.8" fill="#F6FAFE"'],
      ['#B6E39A', '#F6FAFE'], ['#93CD78', '#DDE8F3'], ['#6DAF5A', '#C3D2E2'], ['#86CFF2', '#D9EDF9'], ['#5DB4E0', '#A9CBE3'], ['#F2E2B6', '#FFFFFF'], ['#DCC28C', '#D3DDE8'],
      ['#E6D19F', '#E3EAF2'], ['#3E9A55', '#5E8F7A'], ['#358C4D', '#4E7E6A'], ['#4BAE63', '#E9F2F8'], ['#2F7F45', '#4A7A66'], ['#2A7340', '#406E5C'], ['#3A8E50', '#E3EDF5']],
    5: [['#86CFF2" stroke="#FFFFFF"', '#FFD86A" stroke="#FFF1B8"'],
      ['#B6E39A', '#3F6E5C'], ['#93CD78', '#2A4F43'], ['#6DAF5A', '#2F5E4C'], ['#86CFF2', '#2D5C8A'], ['#5DB4E0', '#1E4470'], ['#F2E2B6', '#8E8A73'], ['#DCC28C', '#6E6A58'],
      ['#E6D19F', '#7E7A64'], ['#3E9A55', '#24553A'], ['#358C4D', '#1E4A33'], ['#4BAE63', '#2C6444'], ['#2F7F45', '#1C4430'], ['#2A7340', '#183C2A'], ['#3A8E50', '#25563C'], ['#FFF3DC', '#E8D9B6']],
  };
  const KS_EXTRA = {
    4: '<path d="M4.6 23.4L16 12.4L27.4 23.4Z" fill="#FFFFFF" opacity=".92"/><path d="M78.6 8.6L86 4.4L93.4 8.6Z" fill="#FFFFFF" opacity=".92"/>',
    5: '<circle cx="11" cy="27" r="6" fill="#FFD86A" opacity=".18"/><circle cx="22" cy="27" r="6" fill="#FFD86A" opacity=".18"/>'
      + [[40, 52], [60, 96], [70, 30]].map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="5" fill="#FFD86A" opacity=".16"/><path d="M' + x + ' ' + (y + 6) + 'v-7" stroke="#2A2A2A" stroke-width=".8"/><circle cx="' + x + '" cy="' + (y - 1.6) + '" r="1.5" fill="#FFE7A8"/>').join(''),
  };

  // ---------------------------------------------------------------- level up
  // Reaching a level for the first time is a moment of its own: the game's badge takes its new
  // medal, the ladder fills a step, what the level brings, a fanfare, a buzz and a burst of the
  // game's colors. Coming back to a level after stepping down gets the pill only.
  function burst(cv, colors) {
    if (reducedMotion()) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const cx = W / 2, cy = H * 0.36, parts = [];
    for (let i = 0; i < 140; i++) {
      const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9;
      parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        w: 6 + Math.random() * 7, h: 4 + Math.random() * 5, c: colors[i % colors.length], star: i % 9 === 0 });
    }
    const t0 = now();
    const frame = () => {
      const t = now() - t0;
      ctx.clearRect(0, 0, W, H);
      const fade = t > 1500 ? Math.max(0, 1 - (t - 1500) / 700) : 1;
      for (const p of parts) {
        p.vy += 0.24; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.star ? '#FFD23F' : p.c;
        if (p.star) { ctx.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? 3 : 7, aa = (k * Math.PI) / 5; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t < 2200) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    };
    requestAnimationFrame(frame);
  }
  function levelUpMoment(g, to, onPlay) {
    const layer = $('#layer');
    if (!layer) return;
    const cv = h('canvas', { class: 'lu-fx', 'aria-hidden': 'true' });
    const ladder = h('div', { class: 'lu-ladder', 'aria-hidden': 'true' });
    for (let i = 1; i <= 5; i++) ladder.append(h('i', { class: i < to ? 'on' : i === to ? 'new' : '' }));
    const adds = levelAdds(g, to);
    let gone = false;
    const close = () => {
      if (gone) return;
      gone = true;
      ov.classList.add('out');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => ov.remove(), 280);
    };
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); } };
    const go = h('button', { class: 'lu-go', type: 'button', onclick: () => { close(); if (onPlay) onPlay(); } }, icon('play'), 'Play ' + LEVEL_NAMES[to - 1]);
    const ov = h('div', { class: 'lu', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Level up: ' + LEVEL_NAMES[to - 1] + (adds ? ', ' + adds : ''), 'data-game': g },
      cv,
      h('div', { class: 'lu-card' },
        h('div', { class: 'lu-badge' }, h('i', { class: 'lu-glow' }), badge(g, 'lu-art', to)),
        h('p', { class: 'lu-k', text: 'Level up' }),
        h('h2', { class: 'lu-name', text: LEVEL_NAMES[to - 1] }),
        ladder,
        adds ? h('p', { class: 'lu-adds' }, h('b', { text: 'New ' }), adds) : null,
        go,
        h('button', { class: 'lu-later', type: 'button', onclick: close }, 'See my result')));
    layer.append(ov);
    document.addEventListener('keydown', onKey);
    Sound.play('levelup');
    buzz([30, 70, 30, 70, 30, 120, 90]);
    requestAnimationFrame(() => burst(cv, CONFETTI[g] || ['#FFD23F']));
    setTimeout(() => { try { go.focus({ preventScroll: true }); } catch (e) { /* optional */ } }, 60);
  }
  const HAND_SVG = '<svg viewBox="0 0 48 56" aria-hidden="true"><path d="M18 4c2.2 0 4 1.8 4 4v14.5l2.2-.6c1.9-.5 3.9.6 4.4 2.5l.1.4 1.9-.4c1.9-.4 3.8.7 4.3 2.6l.1.5 1.4-.3c2-.4 4 .9 4.4 2.9l.1.6V40c0 7.7-6.3 14-14 14h-2.5c-4.4 0-8.5-2.2-10.9-5.9L6.4 39.5c-1.2-1.9-.7-4.4 1.2-5.6 1.7-1.1 3.9-.8 5.2.7L14 36V8c0-2.2 1.8-4 4-4z" fill="#FFFFFF" stroke="#1F2230" stroke-width="2.6" stroke-linejoin="round"/><path d="M22 29v7M28.7 30v6M34.9 32v5" stroke="#1F2230" stroke-width="2" stroke-linecap="round" opacity="0.35"/></svg>';
  // half: the next level is half earned (one good card of the two it takes)
  function pips(level, label, half) {
    const el = h('span', { class: 'pips', 'aria-label': label || 'Level ' + level, role: 'img' });
    for (let i = 1; i <= 5; i++) el.append(h('i', { class: i <= level ? 'on' : half && i === level + 1 ? 'half' : '' }));
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
    // a soft engine hum for Switchback whose pitch follows the speed; 0 stops it
    engine(kmh) {
      const c = this.ctx;
      if (!kmh || !this.on || !c || c.state !== 'running') {
        if (this.eng) {
          const e = this.eng;
          this.eng = null;
          try { const t = c.currentTime; e.g.gain.cancelScheduledValues(t); e.g.gain.setTargetAtTime(0.0001, t, 0.1); e.o.stop(t + 0.7); e.o2.stop(t + 0.7); } catch (x) { /* optional */ }
        }
        return;
      }
      const t = c.currentTime;
      if (!this.eng) {
        try {
          const o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
          o.type = 'sawtooth'; o2.type = 'sine';
          f.type = 'lowpass'; f.Q.value = 0.8; f.frequency.value = 360;
          g.gain.value = 0.0001;
          o.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
          o.start(); o2.start();
          g.gain.setTargetAtTime(0.022, t, 0.4);
          this.eng = { o, o2, f, g };
        } catch (x) { return; }
      }
      const hz = 42 + kmh * 0.85;
      this.eng.o.frequency.setTargetAtTime(hz, t, 0.3);
      this.eng.o2.frequency.setTargetAtTime(hz * 2, t, 0.3);
      this.eng.f.frequency.setTargetAtTime(240 + kmh * 7, t, 0.3);
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
    record: (S) => { [784, 988, 1175, 1568].forEach((f, i) => S.tone(f, f * 1.005, 0.2, 'triangle', 0.16, i * 0.06)); S.tone(2093, 2093, 0.5, 'sine', 0.05, 0.26); },
    levelup: (S) => {
      [523, 659, 784, 1047, 1319].forEach((f, i) => S.tone(f, f, 0.22, 'triangle', 0.17, i * 0.08));
      [1047, 1319, 1568].forEach((f) => S.tone(f, f * 1.003, 0.9, 'sine', 0.07, 0.46));
      S.noise(0.6, 4000, 9000, 1, 0.025, 0.42);
    },
    fail: (S) => [392, 330, 247].forEach((f, i) => S.tone(f, f * 0.98, 0.24, 'triangle', 0.17, i * 0.14)),
    dead: (S) => S.tone(240, 105, 0.5, 'sawtooth', 0.06),
    hint: (S) => { S.tone(1320, 1320, 0.12, 'sine', 0.12); S.tone(1760, 1760, 0.18, 'sine', 0.1, 0.08); },
    lose: (S) => S.tone(700, 520, 0.12, 'sine', 0.08),
    look: (S) => { S.tone(380, 620, 0.1, 'sine', 0.12); S.noise(0.06, 2400, 1600, 2, 0.04); },
    shutter: (S) => { S.noise(0.035, 3200, 2400, 3, 0.09); S.noise(0.05, 1800, 900, 2, 0.07, 0.05); S.tone(1500, 900, 0.03, 'square', 0.025, 0.05); },
    pick: (S, k) => S.tone(600 + (k || 0) * 90, 660 + (k || 0) * 90, 0.07, 'triangle', 0.16),
    yes: (S) => { S.tone(880, 880, 0.09, 'sine', 0.16); S.tone(1320, 1320, 0.16, 'sine', 0.14, 0.07); S.tone(2600, 3400, 0.05, 'sine', 0.04, 0.12); },
    no: (S) => S.tone(320, 230, 0.2, 'triangle', 0.13),
    tick: (S) => S.tone(900, 900, 0.03, 'sine', 0.06),
    lift: (S) => S.tone(330, 560, 0.09, 'triangle', 0.13),
    set: (S, k) => { S.tone(260 + (k || 0) * 40, 170 + (k || 0) * 30, 0.09, 'sine', 0.3); S.noise(0.04, 1300, 600, 1, 0.07); },
    go: (S) => { S.noise(0.5, 220, 900, 1.3, 0.16); S.tone(110, 240, 0.45, 'sawtooth', 0.035); },
    rumble: (S) => S.noise(0.11, 160, 120, 1.6, 0.18),
    hop: (S) => [0.2, 0.53, 0.86].forEach((d, i) => S.tone(430 + i * 40, 760 + i * 50, 0.09, 'sine', 0.07, d)),
    toot: (S) => [0, 0.16].forEach((d) => { S.tone(466, 466, 0.11, 'triangle', 0.17, d); S.tone(587, 587, 0.11, 'triangle', 0.12, d); }),
    screech: (S) => { S.noise(0.5, 2800, 1900, 7, 0.08); S.tone(1350, 1050, 0.45, 'sine', 0.025); },
    ping: (S, k) => { const f = 1175 * Math.pow(1.122, k || 0); S.tone(f, f, 0.07, 'sine', 0.11); S.tone(f * 1.5, f * 1.5, 0.12, 'sine', 0.07, 0.05); },
    skip: (S) => { S.noise(0.26, 500, 2600, 1.1, 0.13); S.tone(520, 780, 0.07, 'triangle', 0.1); S.tone(700, 1040, 0.08, 'triangle', 0.09, 0.08); },
  };
  // Safari on iPhone has no vibrate: a switch toggled through its label gives one light tap
  // of the Taptic Engine (Safari 17.4+), so a pattern becomes one tap per pulse
  let hapticLabel = null;
  function iosTap() {
    try {
      if (!hapticLabel) {
        const sw = h('input', { type: 'checkbox', id: 'pr-haptic', tabindex: '-1', 'aria-hidden': 'true' });
        sw.setAttribute('switch', '');
        hapticLabel = h('label', { for: 'pr-haptic', 'aria-hidden': 'true' });
        document.body.append(h('div', { class: 'haptic', 'aria-hidden': 'true' }, sw, hapticLabel));
      }
      hapticLabel.click();
    } catch (e) { /* optional */ }
  }
  function buzz(pattern) {
    if (!Sound.on) return;
    try { if (navigator.vibrate) { navigator.vibrate(pattern); return; } } catch (e) { /* optional */ }
    if (!IOS) return;
    const p = Array.isArray(pattern) ? pattern : [pattern];
    let t = 0;
    for (let i = 0; i < p.length; i += 2) { if (t) setTimeout(iosTap, t); else iosTap(); t += (p[i] || 0) + (p[i + 1] || 0); }
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
  // tour: how many Switchback drives at Master so far (they go round every place in turn)
  function seqInit(blocks, seed, clue, tour) { return { seed, clue: clue || 'pin', blocks: clone(blocks), b: 0, k: 0, n: 0, adapt: {}, counts: {}, tour: tour || 0 }; }
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
    // Switchback at Master: the next place of the tour
    const tour = game === 'switchback' && E.games.switchback.levels[level] && E.games.switchback.levels[level].tour;
    let variant = game === 'tumbler' ? (S.clue || 'pin') : '', stop = null;
    if (tour) { stop = S.tour || 0; variant = tour[stop % tour.length]; S.tour = stop + 1; }
    const spec = {
      seq: S.n + 1, block: S.b + 1, inBlock: S.k + 1, game, level, adaptive: !!B.adaptive, j,
      seed: E.puzzleSeed(S.seed, S.b, game, level, j),
      variant,
    };
    if (stop != null) spec.tour = stop;
    spec.id = 'B' + spec.block + '-' + game + '-L' + level + '-' + (j + 1);
    S.k++;
    S.n++;
    return spec;
  }
  // 2-up / 1-down staircase per game within a block (upAfter makes it 1-up until
  // the first miss in that game). Glimpse steps down only after a round with
  // under half right (down): its display time already adapts on every look.
  function seqRecord(S, spec, success, upAfter, down) {
    if (!spec.adaptive) return null;
    const a = S.adapt[(spec.block - 1) + ':' + spec.game];
    if (!a) return null;
    const before = a.level;
    if (success) {
      a.streak++;
      if (a.streak >= (upAfter || 2)) { a.level = Math.min(5, a.level + 1); a.streak = 0; }
    } else {
      if (E.games[spec.game].levelDown !== false || down) a.level = Math.max(1, a.level - 1);
      a.streak = 0;
    }
    return { from: before, to: a.level, changed: a.level !== before };
  }
  function practiceSpec(game, variant) {
    return { seq: 0, block: 0, inBlock: 0, game, level: 0, adaptive: false, j: 0, seed: 0, variant: game === 'tumbler' ? (variant || 'pin') : '', id: 'P-' + game, practice: true };
  }

  // --------------------------------------------------------- defaults
  // free play and research sessions start with the same options (a research session can switch them in its setup)
  const OPTIONS = { feedback: true, hints: true, undo: true, skip: true, counter: true, par: 1.5, limit: 0, practice: true, sound: true, clue: 'pin' };
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
    const options = Object.assign({}, OPTIONS, setup.options || {});
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
      seq: seqInit(setup.blocks, setup.seed >>> 0, options.clue, kind === 'free' ? Number(store.get('pr1.sbtour', 0)) || 0 : 0),
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
    stacks: ['#5D7FB9', '#D46F4D', '#78A257', '#F2C14E', '#FFFFFF'],
    switchback: ['#E5564D', '#FFC93C', '#79B3F0', '#56B46A', '#FFFFFF'],
    keepsake: ['#E8463D', '#F2B632', '#3D8BFD', '#2DBF6C', '#FF6FA7', '#FFFFFF'],
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
    stacks: ['optimal', 'wasted', 'blocked', 'undo', 'restart', 'hint'],
    switchback: [],
    keepsake: [],
  };
  function blankCounts() {
    // moves: since the last restart (what stars, par and success count); before: the moves made before it
    return { moves: 0, before: 0, optimal: 0, wasted: 0, dead_end: 0, in_dead_end: 0, blocked: 0, undo: 0, restart: 0, hint: 0, suboptimal: 0, zero_info: 0, inconsistent: 0, neutral: 0, solved: 0, infoRatioSum: 0, infoRatioN: 0 };
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
      // each level's own look, in free play and research sessions alike; practice has the first
      this.lookLv = spec.practice ? 1 : spec.level;
      this.el = h('article', { class: 'scene', 'data-game': spec.game, 'data-lv': this.lookLv, 'aria-label': this.G.name + (this.practice ? ', practice' : ', level ' + spec.level) });
      this.build();
      this.buildBoard();
      this.refresh(false);
      this.updateStatus();
      if (this.summary) this.showResult(this.summary, true);
    }
    freshRun(p) { return this.G.newRun(p); }
    usesClock() { return true; }
    // records and the way to the next level show on counted cards where levels move, in free play and research sessions alike
    progressOn() { return !!(this.app.session && this.spec.adaptive && !this.practice && this.o.counter); }
    // while playing: does this card still count toward the next level?
    canCount() { return this.potentialStars() >= 2; }
    // the record chip: '' (to beat), 'gone' (out of reach this time) or 'live' (on its way to a new one)
    recordState(rec) {
      const g = this.spec.game;
      if (g === 'outbound' || g === 'conduit' || g === 'stacks') return this.elapsed() - this.hiddenMs > rec ? 'gone' : '';
      if (g === 'tumbler') return this.c.moves >= rec ? 'gone' : '';
      return '';
    }
    updateRecord() {
      const el = this.recEl;
      if (!el) return;
      const rec = this.progressOn() ? Records.get(this.spec.game, this.spec.level) : null;
      el.hidden = rec == null || !!this.summary;
      if (el.hidden) { clearInterval(this.recTick); return; }
      const R = RECORD[this.spec.game];
      if (el.dataset.v !== String(rec)) {
        el.dataset.v = String(rec);
        el.textContent = '';
        el.append(icon('trophy'), h('b', { text: R.fmt(rec) }));
        el.setAttribute('aria-label', 'Your record at this level, ' + R.what + ': ' + R.fmt(rec));
      }
      const st = this.recordState(rec);
      el.classList.toggle('gone', st === 'gone');
      if (st === 'live' && !el.classList.contains('live')) { el.classList.remove('live'); void el.offsetWidth; Sound.play('ping', 4); }
      el.classList.toggle('live', st === 'live');
    }
    // what the next level takes, under the head for a moment: the goal and the good cards so far
    showToward(asked) {
      if (!this.progressOn() || this.spec.level >= 5 || this.summary) return;
      const g = this.spec.game, goal = pfGoal(g, this.spec.level);
      const a = this.app.session.seq.adapt[(this.spec.block - 1) + ':' + g], need = this.app.upAfter(g);
      const P = { need, have: a && a.level === this.spec.level ? Math.max(0, Math.min(need - 1, a.streak)) : 0 };
      if (this.towardEl) this.towardEl.remove();
      const slots = h('span', { class: 'res-slots' });
      for (let i = 0; i < P.need; i++) slots.append(h('i', { class: i < P.have ? 'on' : '' }, i < P.have ? icon('check') : null));
      const chips = h('span', { class: 'res-chips' });
      if (goal.stars) chips.append(h('span', { class: 'res-chip stars' }, icon('star'), icon('star')));
      else goal.chips.forEach(([ico, t]) => chips.append(h('span', { class: 'res-chip' }, icon(ico), t)));
      const left = P.need - P.have;
      this.towardEl = h('div', { class: 'cue', role: 'status', 'aria-label': (left === 1 ? 'One more' : 'Two') + ' good ' + pfNoun(g, left) + ' for ' + LEVEL_NAMES[this.spec.level] + ': ' + goal.text },
        chips, slots, h('span', { class: 'cue-to', text: 'for ' + LEVEL_NAMES[this.spec.level] }));
      // just under the head, wherever its chips wrapped to
      this.towardEl.style.top = Math.round(this.head.offsetTop + this.head.offsetHeight + 10) + 'px';
      this.el.append(this.towardEl);
      const el = this.towardEl;
      clearTimeout(this.towardTimer);
      this.towardTimer = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, asked ? 3200 : 2600);
    }
    later(fn, ms) { const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms); this.timers.add(t); return t; }
    destroy() {
      clearInterval(this.tick);
      clearInterval(this.recTick);
      clearTimeout(this.towardTimer);
      for (const t of this.timers) clearTimeout(t);
      this.timers.clear();
    }
    elapsed() { return this.frozen != null ? this.frozen : now() - this.t0; }
    // one good card of the two already counts toward the next level
    halfway() {
      const S = this.app.session, sp = this.spec;
      if (!S || !sp.adaptive || sp.level >= 5) return false;
      const a = S.seq.adapt[(sp.block - 1) + ':' + sp.game];
      return !!(a && a.level === sp.level && a.streak > 0);
    }
    build() {
      const sp = this.spec;
      const lp = this.practice ? null : pips(sp.level, null, this.halfway());
      // the next level's pip: tap the level for what it takes; it glows while this card can count
      this.nextPip = lp && this.progressOn() && sp.level < 5 ? lp.children[sp.level] : null;
      if (lp && this.progressOn()) {
        lp.classList.add('tap');
        lp.setAttribute('role', 'button');
        lp.setAttribute('tabindex', '0');
        lp.setAttribute('aria-label', 'Level ' + sp.level + ', ' + LEVEL_NAMES[sp.level - 1] + '. What the next level takes');
        lp.addEventListener('click', () => this.showToward(true));
        lp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.showToward(true); } });
      }
      const title = h('div', { class: 'title' },
        h('span', { class: 'game-ico' }, badge(sp.game, null, this.practice ? 1 : sp.level)),
        h('span', { class: 'game-name', text: this.G.name }),
        this.practice ? h('span', { class: 'tag', text: 'Practice' }) : lp);
      this.goalEl = h('span', { class: 'goal', role: 'status' });
      this.meterEl = h('span', { class: 'meter', role: 'img' });
      this.meterStars = [0, 1, 2].map(() => icon('star'));
      this.meterEl.append(this.meterStars[0], this.meterStars[1], this.meterStars[2]);
      this.clockEl = h('span', { class: 'clock', hidden: true });
      this.recEl = h('span', { class: 'rec', role: 'img', hidden: true });
      const status = h('div', { class: 'status' }, this.goalEl, this.meterEl, this.recEl, this.clockEl);
      this.head = h('div', { class: 'scene-head' }, title, status);
      this.area = h('div', { class: 'board-area' });
      this.toolsEl = h('div', { class: 'tools' });
      this.fx = h('div', { class: 'fx' });
      this.el.append(this.head, this.area, this.toolsEl, this.fx);
      const dec = decor(sp.game, this.lookLv);
      if (dec) this.el.prepend(dec);
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
      if (this.progressOn() && Records.get(this.spec.game, this.spec.level) != null && ['outbound', 'conduit', 'stacks'].indexOf(this.spec.game) >= 0) {
        clearInterval(this.recTick);
        this.recTick = setInterval(() => this.updateRecord(), 400);
      }
      if (this.progressOn()) this.later(() => this.showToward(false), 450);
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
    // every move on the card, also those before a restart (the move number in the log)
    moveNo() { return this.c.moves + (this.c.before || 0); }
    updateStatus() {
      this.goal();
      this.updateRecord();
      if (this.nextPip) this.nextPip.classList.toggle('live', !this.summary && this.canCount());
      const showStars = this.o.counter && !this.practice;
      this.meterEl.hidden = !showStars;
      if (showStars) {
        const n = this.summary ? (this.summary.stars || 0) : this.potentialStars();
        this.meterStars.forEach((st, i) => {
          const lost = i >= n;
          if (lost && !st.classList.contains('lost') && this.c.moves && !(this.summary && this.summary.outcome === 'skipped')) Sound.play('lose');
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
        move_no: this.moveNo(), target: rec.target,
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
    // a speech bubble over (or under) an element, gone after a moment
    say(el, text, kind, ms, below) {
      if (!el || !this.el.isConnected) return;
      const pt = relPos(this, el);
      const b = h('div', { class: 'tb-say ' + (kind || '') + (below ? ' below' : ''), role: 'status' }, text);
      b.style.top = Math.round(below ? pt.y + pt.h / 2 + 10 : pt.y - pt.h / 2 - 8) + 'px';
      this.fx.append(b);
      const bw = b.offsetWidth, W = this.el.clientWidth, x = Math.max(bw / 2 + 8, Math.min(W - bw / 2 - 8, pt.x));
      b.style.left = Math.round(x) + 'px';
      b.style.setProperty('--point', Math.round(bw / 2 + pt.x - x) + 'px');
      setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 300); }, ms || 1700);
      return b;
    }
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
      this.log('undo', { move_no: this.moveNo(), target: r.target, from: this.pos(r.from), to: this.pos(r.to), d_before: fin(r.dBefore), d_after: fin(r.dAfter) });
      this.call(this.undoBtn, false);
      this.call(this.restartBtn, false);
      this.afterUndo(r);
      this.updateStatus();
      this.later(() => this.guide(), 300);
      this.app.touch();
    }
    doRestart() {
      if (this.summary || this.busy) return;
      const key = this.spec.game === 'conduit' ? 'rot' : 'st';
      const dB = fin(this.G.dist(this.p, this.run[key]));
      this.G.restart(this.p, this.run);
      this.c.restart++;
      // a restart starts the count again: the stars come back, and moves count from here
      this.c.before = (this.c.before || 0) + this.c.moves;
      this.c.moves = 0;
      this.log('restart', { move_no: this.moveNo(), d_before: dB, d_after: fin(this.G.dist(this.p, this.run[key])) });
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
      this.log('hint', { move_no: this.moveNo(), target: hint.target != null ? hint.target : '', cands_before: hint.candsBefore != null ? hint.candsBefore : '', cands_after: hint.candsAfter != null ? hint.candsAfter : '', detail: JSON.stringify(hint) });
      Sound.play('hint');
      this.showHint(hint);
      this.app.touch();
    }
    // Skip goes on to the next card with no result panel: the board steps back,
    // a stamp pops in, and the card is tossed aside.
    doSkip() {
      if (this.summary || this.busy) return;
      this.resolve('skipped', true);
      Sound.play('skip');
      buzz(10);
      this.el.classList.add('skipping');
      this.area.append(h('div', { class: 'skip-stamp', role: 'status' }, icon('skip'), h('span', { text: 'Skipped' })));
      this.later(() => { this.el.dataset.exit = 'toss'; this.app.next(); }, reducedMotion() ? 300 : 560);
    }
    showStuck() {
      if (this.o.undo) {
        this.call(this.undoBtn, true);
        this.call(this.restartBtn, true);
      } else {
        this.later(() => this.resolve('failed'), 1300);
      }
    }
    // quiet: the card is left at once (skip), so no celebration or result panel
    resolve(outcome, quiet) {
      if (this.summary) return;
      clearInterval(this.tick);
      clearInterval(this.recTick);
      if (this.towardEl) { this.towardEl.remove(); this.towardEl = null; }
      if (this.beforeResolve) this.beforeResolve(outcome);
      if (this.hiddenAt != null) { this.hiddenMs += now() - this.hiddenAt; this.hiddenAt = null; }
      const dur = Math.round(this.elapsed());
      this.frozen = dur;
      const sm = this.makeSummary(outcome, dur);
      // a practice round is passed only when it was played right; otherwise it comes round again
      if (this.practice && outcome !== 'abandoned' && outcome !== 'skipped') { sm.passed = !!this.practicePassed(sm); sm.success = sm.passed; }
      this.summary = sm;
      this.hideHand();
      this.call(this.undoBtn, false);
      this.call(this.restartBtn, false);
      const res = this.app.onPuzzleEnd(this, sm);
      sm.level_next = res.level_next;
      sm.level_change = res.change && res.change.changed ? res.change : null;
      sm.toward = res.toward || null;
      sm.goal = res.goal || null;
      this.updateStatus();
      if (this.onResolved) this.onResolved(outcome);
      if (quiet) return;
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
        moves_total: this.moveNo(),
        reference: this.p.reference,
        par: this.par,
        efficiency: this.c.moves ? r4(this.p.reference / this.c.moves) : '',
      };
      sm.stars = starsFor(sm);
      return sm;
    }
    practicePassed(sm) { return sm.outcome === 'solved'; }
    // the trial games end with a fanfare for a round played well, confetti for a
    // great one or a passed practice, and only a soft note otherwise
    trialCelebrate(sm, colors) {
      if (sm.outcome !== 'complete') return 300;
      const good = this.practice ? sm.passed : sm.stars >= 2, great = this.practice ? sm.passed : sm.stars >= 3;
      Sound.play(good ? 'win' : 'lose');
      if (great) {
        buzz([18, 50, 18]);
        this.later(() => confetti(this, colors), 120);
        return 650;
      }
      return 480;
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
      // Tumbler's reference is a good guesser's tries, not a true fewest: luck can beat it
      const refWord = this.spec.game === 'tumbler' ? 'aim ' : 'fewest ';
      return h('div', { class: 'res-stats' },
        h('span', null, icon('tapped'), h('b', { text: String(sm.moves) }), ' ' + unit[sm.moves === 1 ? 0 : 1], h('span', { text: ' · ' + refWord + sm.reference })),
        h('span', null, icon('clock'), h('b', { text: tsec(Math.max(0, sm.duration_ms - (sm.hidden_ms || 0))) })));
    }
    resultTitle(sm) {
      if (this.practice && sm.passed === false) return 'Once more';
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
      } else if (this.practice && sm.passed === false) {
        panel.append(h('div', { class: 'res-icon again' }, icon('restart')));
      } else {
        const kind = solved ? '' : sm.outcome === 'skipped' || sm.outcome === 'abandoned' ? ' skip' : ' miss';
        panel.append(h('div', { class: 'res-icon' + kind }, icon(solved ? 'check' : sm.outcome === 'skipped' || sm.outcome === 'abandoned' ? 'skip' : 'x')));
      }
      panel.append(h('h3', { class: 'res-title', text: this.resultTitle(sm) }));
      if (this.o.counter && !this.practice && sm.outcome !== 'abandoned') {
        const stats = this.resultStats(sm);
        if (stats) panel.append(stats);
      }
      const rc = this.o.counter && !this.practice ? sm.record : null, RR = RECORD[this.spec.game];
      if (rc && rc.isNew) {
        // a new record: gold, with the old one beside it
        panel.append(h('div', { class: 'res-level record', role: 'status', 'aria-label': 'New record, ' + RR.what + ': ' + RR.fmt(rc.v) + ', was ' + RR.fmt(rc.prev) },
          icon('trophy'), h('span', { text: 'New record · ' + RR.fmt(rc.v) }), h('s', { text: RR.fmt(rc.prev) })));
        if (!instant) this.later(() => { Sound.play('record'); buzz([20, 50, 20, 50, 40]); }, 650);
      } else if (rc) {
        // the record to beat next time (the first card at a level sets it)
        panel.append(h('div', { class: 'res-level rec-was', 'aria-label': (rc.first ? 'Your first record here, ' : 'Your record, ') + RR.what + ': ' + RR.fmt(rc.first ? rc.v : rc.prev) },
          icon('trophy'), (rc.first ? 'Record set · ' : 'Record · ') + RR.fmt(rc.first ? rc.v : rc.prev)));
      }
      if (sm.beatAim && this.o.counter && !this.practice) {
        panel.append(h('div', { class: 'res-level beat', role: 'status' }, icon('key'), 'Fewer tries than the computer'));
        if (!instant) this.later(() => Sound.play('hint'), 500);
      }
      if (sm.level_change && this.o.counter) {
        const up = sm.level_change.to > sm.level_change.from;
        const pp = pips(sm.level_change.to);
        if (up) pp.children[sm.level_change.to - 1].classList.add('new');
        const adds = up ? levelAdds(this.spec.game, sm.level_change.to) : '';
        panel.append(h('div', { class: 'res-level' + (up ? ' up' : ' down') },
          h('span', { class: 'res-level-row' }, (up ? 'Level up · ' : 'Level · ') + LEVEL_NAMES[sm.level_change.to - 1], pp),
          adds ? h('small', { text: adds }) : null));
        if (up && !instant) {
          // the first time at a level: its own moment; back at a level after stepping down: the pill
          if (sm.level_change.first) this.later(() => levelUpMoment(this.spec.game, sm.level_change.to, () => this.app.next()), 1100);
          else this.later(() => Sound.play('level'), 900);
        }
      } else if (sm.toward && this.o.counter) {
        // halfway to the next level: the slot just earned fills in, the other waits
        const T = sm.toward, slots = h('span', { class: 'res-slots', 'aria-hidden': 'true' });
        for (let i = 0; i < T.need; i++) slots.append(h('i', { class: i < T.have ? 'on' : '' }, i < T.have ? icon('check') : null));
        panel.append(h('div', { class: 'res-level toward', role: 'status' }, slots, 'One more for ' + LEVEL_NAMES[T.to - 1]));
      } else if (sm.goal && this.o.counter) {
        // a round that did not count: the goal for the next level, as the profile shows it, a met part ticked
        const G2 = sm.goal, chips = h('span', { class: 'res-chips', 'aria-hidden': 'true' });
        G2.chips.forEach(([ico, t, met]) => chips.append(h('span', { class: 'res-chip' + (met ? ' met' : '') }, icon(ico), t, met ? icon('check', 'res-met') : null)));
        panel.append(h('div', { class: 'res-level goal', role: 'status', 'aria-label': LEVEL_NAMES[G2.to - 1] + ' needs ' + G2.text }, chips, 'for ' + LEVEL_NAMES[G2.to - 1]));
      }
      const last = this.app.isLast(this.spec);
      const again = this.practice && sm.passed === false && !this.app.practiceDone(this.spec.game);
      const next = h('button', { class: 'next', type: 'button', onclick: () => this.app.next() }, last ? 'Finish' : again ? 'Try again' : 'Next', icon(again ? 'restart' : 'next'));
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
  // Every level a place with its own kind of car (by the look's level): small cars in the town
  // lot, jeeps with surfboards and camper vans on the beach, taxis and buses in the city at
  // night, cars with skis on the roof and snowploughs at the ski lodge, cars and lorries on the
  // ferry's deck. The rules and the arrows stay the same.
  const OB_KITS = ['town', 'town', 'beach', 'city', 'ski', 'ferry'];
  const OB_TAXI = ['#FFC93C', '#FFC93C', '#1F2128', '#FFC93C', '#F4F5F7', '#2FA36B', '#FFC93C', '#FFC93C', '#1F2128', '#FFC93C'];
  const OB_BUS = ['#E2453C', '#2F6FD8', '#2FA36B', '#F28C28'];
  const OB_BOX = ['#E2453C', '#2F6FD8', '#2FA36B', '#F2B33D', '#7A5BD8'];
  const OB_BOARDS = ['#FF6FA7', '#22BFB0', '#FFC93C', '#3D8BFD', '#FF8A3D'];
  const OB_SKIS = [['#F2564D', '#FFFFFF'], ['#3D8BFD', '#FFC93C'], ['#22BFB0', '#1F2128'], ['#FFFFFF', '#9B6BFF']];
  const obLight = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 165; };
  const obR = (x, y, w, hh, rx, f, extra) => '<rect x="' + (+x).toFixed(2) + '" y="' + (+y).toFixed(2) + '" width="' + (+w).toFixed(2) + '" height="' + (+hh).toFixed(2) + '" rx="' + rx + '" fill="' + f + '"' + (extra || '') + '/>';
  // Each place has its own kinds of vehicle, every kind with an outline and one big thing of its
  // own, so neighbours never look alike: bikes take one space, cars two, the long ones three.
  // In each place they are taken in turn, so no two in a row are the same kind.
  const OB_SETS = {
    town: [['bicycle', 'scooter'], ['hatch', 'beetle', 'sports', 'convertible', 'mini'], ['mixer', 'delivery', 'fire']],
    beach: [['quad', 'bicycle'], ['jeep', 'buggy', 'convertible', 'pickup', 'beetle'], ['camper', 'icecream']],
    city: [['motorbike', 'pizza'], ['taxi', 'police', 'sedan', 'taxi', 'sports', 'mini'], ['bus', 'limo', 'delivery']],
    ski: [['snowmobile'], ['jeep', 'estate', 'pickup', 'beetle', 'hatch'], ['plough', 'snowcat']],
    ferry: [['motorbike', 'bicycle'], ['estate', 'jeep', 'pickup', 'sedan', 'mini', 'beetle'], ['lorry', 'motorhome', 'delivery']],
  };
  const OB_MODEL_NAMES = { bicycle: 'Bicycle', scooter: 'Scooter', quad: 'Quad bike', motorbike: 'Motorbike', pizza: 'Pizza scooter', snowmobile: 'Snowmobile', hatch: 'Car', beetle: 'Beetle', sports: 'Sports car', convertible: 'Convertible', mini: 'Mini', jeep: 'Jeep', buggy: 'Beach buggy', pickup: 'Pickup', taxi: 'Taxi', police: 'Police car', sedan: 'Car', estate: 'Estate car', mixer: 'Cement mixer', delivery: 'Van', fire: 'Fire engine', camper: 'Camper van', icecream: 'Ice cream van', bus: 'Bus', limo: 'Limousine', plough: 'Snowplough', snowcat: 'Snowcat', lorry: 'Lorry', motorhome: 'Motorhome' };
  // tall ones throw a longer shadow
  const OB_HEIGHT = { bicycle: 0.5, scooter: 0.6, quad: 0.7, motorbike: 0.6, pizza: 0.7, snowmobile: 0.7, sports: 0.7, convertible: 0.8, buggy: 0.8, beetle: 1.1, hatch: 1.1, mini: 1.0, sedan: 1.0, taxi: 1.0, police: 1.0, estate: 1.1, pickup: 1.3, jeep: 1.4, limo: 1.0, plough: 1.6, snowcat: 1.6, mixer: 1.8, delivery: 1.9, fire: 1.8, camper: 1.9, icecream: 2.0, bus: 2.1, lorry: 2.1, motorhome: 2.1 };
  const OB_HAIR = ['#3A2618', '#E8C26A', '#1F1B18', '#B5532E', '#8A5A36', '#D9D9D9'];
  const obSet = (kit, len) => OB_SETS[kit][len === 1 ? 0 : len === 3 ? 2 : 1];
  const obModel = (kit, c, i, seed) => { const set = obSet(kit, c.len); return set[(i + (seed >>> 0)) % set.length]; };
  // one vehicle, drawn facing up, its middle at 0 0: its look, the color under its arrow, where the
  // arrow goes, and how the arrow should be drawn (small on bikes, edged where the top is busy)
  function obVehicle(kit, c, uid, model) {
    const L = c.len * 10, top = -L / 2, bot = L / 2;
    let col = CAR_COLORS[c.color % CAR_COLORS.length].fill;
    if (model === 'taxi') col = OB_TAXI[c.color % OB_TAXI.length];
    if (model === 'bus') col = OB_BUS[c.color % OB_BUS.length];
    if (model === 'fire') col = '#E2372E';
    if (model === 'police') col = '#F4F5F7';
    if (model === 'limo') col = ['#1F2128', '#F4F5F7', '#6B2E3E', '#1F2128'][c.color % 4];
    if (model === 'plough' || model === 'snowcat') col = c.color % 2 ? '#FF8A1F' : '#FFC23A';
    if (kit === 'ski' && col === '#F4F5F7') col = '#56688F';
    const glass = '#24334A', tyre = '#1B1E26', R = obR, hair = OB_HAIR[c.color % OB_HAIR.length];
    const g = (id) => 'url(#' + uid + id + ')';
    const C = (x, y, r, f, extra) => '<circle cx="' + (+x).toFixed(2) + '" cy="' + (+y).toFixed(2) + '" r="' + r + '" fill="' + f + '"' + (extra || '') + '/>';
    const El = (x, y, rx, ry, f, extra) => '<ellipse cx="' + (+x).toFixed(2) + '" cy="' + (+y).toFixed(2) + '" rx="' + rx + '" ry="' + ry + '" fill="' + f + '"' + (extra || '') + '/>';
    const P = (d, f, extra) => '<path d="' + d + '" fill="' + f + '"' + (extra || '') + '/>';
    const line = (d, stroke, w, extra) => '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' + w + '" stroke-linecap="round"' + (extra || '') + '/>';
    const tyres = (x0, ww, hh, yF, yB) => R(-x0 - ww, yF, ww, hh, 0.7, tyre) + R(x0, yF, ww, hh, 0.7, tyre) + R(-x0 - ww, yB, ww, hh, 0.7, tyre) + R(x0, yB, ww, hh, 0.7, tyre);
    const wheels = (mid) => tyres(3.2, 1.6, 2.7, top + 2.1, bot - 4.8) + (mid ? R(-4.8, bot - 8.3, 1.6, 2.7, 0.7, tyre) + R(3.2, bot - 8.3, 1.6, 2.7, 0.7, tyre) : '');
    const shine = (x, y, w, hh, rx) => R(x, y, w, hh, rx, g('g'));
    const box = (x, y, w, hh, rx, f) => R(x, y, w, hh, rx, f) + shine(x, y, w, hh, rx);
    const lamps = (yF, xF) => R(-(xF || 3.6), yF == null ? top + 1.0 : yF, 1.6, 0.95, 0.47, '#FFF4BE') + R((xF || 3.6) - 1.6, yF == null ? top + 1.0 : yF, 1.6, 0.95, 0.47, '#FFF4BE')
      + R(-3.4, bot - 1.85, 1.4, 0.75, 0.37, '#FF4D4D') + R(2.0, bot - 1.85, 1.4, 0.75, 0.37, '#FF4D4D');
    const shield = (y0, y1, wTop, wBot) => P('M' + -wBot + ' ' + y1 + 'L' + -wTop + ' ' + y0 + 'L' + wTop + ' ' + y0 + 'L' + wBot + ' ' + y1 + 'Z', glass);
    const rearGlass = (y0, y1, wTop, wBot) => P('M' + -wTop + ' ' + y0 + 'L' + wTop + ' ' + y0 + 'L' + wBot + ' ' + y1 + 'L' + -wBot + ' ' + y1 + 'Z', glass, ' opacity=".85"');
    const roof = (y0, y1, f, rx, x0) => R(-(x0 || 3.2), y0, 2 * (x0 || 3.2), y1 - y0, rx == null ? 1.4 : rx, f || 'rgba(0,0,0,0.12)');
    // a person seen from above: hair, and the shoulders when asked
    const head = (x, y, hc, sh) => (sh ? El(x, y + 0.9, 1.75, 0.95, sh) : '') + C(x, y, 1.12, hc) + El(x - 0.3, y - 0.35, 0.45, 0.3, '#FFFFFF', ' opacity=".25"');
    const helmet = (x, y, hc, stripe) => C(x, y, 1.15, hc) + (stripe ? R(x - 0.28, y - 1.1, 0.56, 2.2, 0.28, stripe) : '') + P('M' + (x - 0.85) + ' ' + (y - 0.55) + 'Q' + x + ' ' + (y - 1.35) + ' ' + (x + 0.85) + ' ' + (y - 0.55) + 'Z', glass, ' opacity=".8"');
    const snow = (y) => El(-1, y, 2.3, 0.95, '#FFFFFF', ' opacity=".92"') + El(1.8, y - 0.3, 1.1, 0.6, '#FFFFFF', ' opacity=".85"');
    const board = (x, y, ry, f) => '<g transform="rotate(-4 ' + x + ' ' + y + ')">' + El(x, y, 1.15, ry, f) + El(x, y, 0.24, ry - 0.6, '#FFFFFF', ' opacity=".85"') + '</g>';
    const bag = (x, y, w, hh, f) => R(x, y, w, hh, 0.5, f) + R(x + w / 2 - 0.3, y - 0.3, 0.6, hh + 0.6, 0.2, '#2A2E38', ' opacity=".55"');
    let v = '', arrowY = 0.4, roofy = false, under = null, small = false;
    switch (model) {
      // ---------------------------------------------------------------- one space
      case 'bicycle': {
        // a bicycle and its rider: two thin wheels, the handlebar, shoulders and a head
        const shirt = col;
        v += R(-0.38, top + 0.6, 0.76, 3.4, 0.38, tyre) + R(-0.38, bot - 4.0, 0.76, 3.4, 0.38, tyre)
          + line('M0 ' + (top + 2.4) + 'V' + (bot - 2.3), '#8E96A3', 0.5) + line('M-1.9 ' + (top + 3.1) + 'H1.9', '#2A2E38', 0.45)
          + line('M-1.5 ' + (top + 5.8) + 'L-1.8 ' + (top + 3.2) + 'M1.5 ' + (top + 5.8) + 'L1.8 ' + (top + 3.2), shirt, 0.75)
          + El(0, top + 6.0, 1.9, 1.05, shirt) + head(0, top + 5.2, OB_HAIR[(c.color + 2) % OB_HAIR.length]);
        if (kit === 'ferry') v += R(-1.6, bot - 2.9, 3.2, 1.6, 0.4, '#3D8BFD');
        arrowY = bot - 2.0; small = true; roofy = true;
        break;
      }
      case 'scooter':
        // a scooter: a round body wider at the back, the rider on it
        v += R(-0.5, top + 0.7, 1.0, 2.4, 0.5, tyre) + R(-0.55, bot - 2.9, 1.1, 2.3, 0.55, tyre)
          + P('M0 ' + (top + 1.5) + 'C1.2 ' + (top + 1.5) + ' 1.4 ' + (top + 3.4) + ' 1.1 ' + (top + 4.6) + 'C1.9 ' + (top + 6) + ' 2.2 ' + (bot - 2.6) + ' 1.4 ' + (bot - 1.6) + 'H-1.4C-2.2 ' + (bot - 2.6) + ' -1.9 ' + (top + 6) + ' -1.1 ' + (top + 4.6) + 'C-1.4 ' + (top + 3.4) + ' -1.2 ' + (top + 1.5) + ' 0 ' + (top + 1.5) + 'Z', col)
          + line('M-1.9 ' + (top + 2.4) + 'H1.9', '#2A2E38', 0.45) + C(0, top + 1.7, 0.45, '#FFF4BE') + head(0, top + 5.4, OB_HAIR[(c.color + 1) % OB_HAIR.length], '#2A2E38');
        arrowY = bot - 2.4; small = true; roofy = true;
        break;
      case 'quad':
        // a quad bike: four fat wheels, the rider in the middle
        v += tyres(1.5, 1.4, 2.2, top + 0.8, bot - 3.0) + box(-1.6, top + 1.0, 3.2, L - 2.2, 1.2, col)
          + line('M-2.3 ' + (top + 3.0) + 'H2.3', '#2A2E38', 0.45) + head(0, top + 4.9, '#E2453C', '#2A2E38') + R(-0.25, top + 3.8, 0.5, 2.2, 0.25, '#FFFFFF', ' opacity=".7"');
        arrowY = bot - 2.2; small = true; roofy = true;
        break;
      case 'motorbike': case 'pizza':
        // a motorbike: wheels, the tank, a rider in a helmet; the pizza scooter has a box behind
        v += R(-0.55, top + 0.5, 1.1, 2.8, 0.55, tyre) + R(-0.6, bot - 3.3, 1.2, 2.8, 0.6, tyre)
          + El(0, top + 3.6, 1.15, 1.7, col) + line('M-2.1 ' + (top + 2.6) + 'H2.1', '#2A2E38', 0.45) + C(0, top + 0.9, 0.45, '#FFF4BE')
          + C(-2.1, top + 2.6, 0.4, '#C9D4E0') + C(2.1, top + 2.6, 0.4, '#C9D4E0')
          + (model === 'pizza' ? R(-1.9, bot - 3.6, 3.8, 3.2, 0.4, '#E2453C') + C(0, bot - 2.0, 1.0, '#FFD23F') + C(-0.3, bot - 2.2, 0.25, '#E2453C') + C(0.35, bot - 1.8, 0.25, '#E2453C') : '')
          + El(0, top + 5.7, 1.85, 1.0, '#2A2E38') + helmet(0, top + 5.0, model === 'pizza' ? '#FFFFFF' : col, model === 'pizza' ? '#E2453C' : '#FFFFFF');
        arrowY = model === 'pizza' ? top + 2.0 : bot - 2.2; small = true; roofy = true;
        break;
      case 'snowmobile':
        // a snowmobile: two skis in front, the body and windscreen, the track behind
        v += R(-2.2, top + 0.6, 0.7, 4.6, 0.35, '#2A2E38') + R(1.5, top + 0.6, 0.7, 4.6, 0.35, '#2A2E38')
          + R(-1.3, bot - 3.6, 2.6, 3.2, 0.4, '#2A2E38') + line('M-1.1 ' + (bot - 3.2) + 'H1.1M-1.1 ' + (bot - 2.4) + 'H1.1M-1.1 ' + (bot - 1.6) + 'H1.1', '#5E6676', 0.3)
          + P('M0 ' + (top + 1.4) + 'C1.6 ' + (top + 1.6) + ' 1.9 ' + (top + 4) + ' 1.7 ' + (bot - 2.4) + 'H-1.7C-1.9 ' + (top + 4) + ' -1.6 ' + (top + 1.6) + ' 0 ' + (top + 1.4) + 'Z', col)
          + P('M-1.3 ' + (top + 3.6) + 'Q0 ' + (top + 2.4) + ' 1.3 ' + (top + 3.6) + 'L1.1 ' + (top + 4.2) + 'Q0 ' + (top + 3.3) + ' -1.1 ' + (top + 4.2) + 'Z', '#9EDCF0', ' opacity=".9"')
          + head(0, top + 5.8, '#3D8BFD', '#2A2E38');
        arrowY = bot - 2.2; small = true; roofy = true;
        break;
      // ---------------------------------------------------------------- two spaces
      case 'hatch':
        v += wheels() + box(-4.0, top + 0.9, 8.0, L - 1.8, 3.2, col) + El(0, top + 3.0, 2.6, 1.2, '#FFFFFF', ' opacity=".16"')
          + shield(top + 4.4, top + 6.4, 2.6, 3.3) + roof(top + 6.4, bot - 4.8, null, 1.6, 3.3) + rearGlass(bot - 4.8, bot - 3.0, 3.1, 2.6) + lamps();
        if (kit === 'ski') { v += R(-2.4, top + 8.0, 4.8, 6.2, 1.6, '#3B4250') + shine(-2.4, top + 8.0, 4.8, 6.2, 1.6) + El(0, top + 8.8, 2.0, 0.7, '#FFFFFF', ' opacity=".92"') + snow(top + 2.6); under = '#3B4250'; }
        break;
      case 'beetle': {
        // round as an egg, four fenders bulging out, round lamps; a daisy on the bonnet
        v += tyres(2.9, 1.5, 2.6, top + 2.2, bot - 4.9)
          + C(-2.9, top + 4.6, 2.0, col) + C(2.9, top + 4.6, 2.0, col) + C(-2.8, bot - 4.6, 2.15, col) + C(2.8, bot - 4.6, 2.15, col)
          + P('M0 ' + (top + 0.6) + 'C3.5 ' + (top + 0.6) + ' 3.6 ' + (top + 5) + ' 3.5 0C3.4 ' + (bot - 4) + ' 3.6 ' + (bot - 0.6) + ' 0 ' + (bot - 0.6) + 'C-3.6 ' + (bot - 0.6) + ' -3.4 ' + (bot - 4) + ' -3.5 0C-3.6 ' + (top + 5) + ' -3.5 ' + (top + 0.6) + ' 0 ' + (top + 0.6) + 'Z', col)
          + El(0, top + 3.4, 2.4, 1.6, '#FFFFFF', ' opacity=".16"')
          + P('M-2.6 ' + (top + 7.0) + 'Q0 ' + (top + 5.4) + ' 2.6 ' + (top + 7.0) + 'L2.2 ' + (top + 8.2) + 'Q0 ' + (top + 7.1) + ' -2.2 ' + (top + 8.2) + 'Z', glass)
          + El(0, 1.4, 2.8, 4.4, 'rgba(0,0,0,0.13)') + P('M-1.8 ' + (bot - 3.6) + 'Q0 ' + (bot - 3.0) + ' 1.8 ' + (bot - 3.6), 'none', ' stroke="' + glass + '" stroke-width="0.9"')
          + C(-3.0, top + 2.8, 0.85, '#FFF4BE') + C(3.0, top + 2.8, 0.85, '#FFF4BE') + R(-3.6, bot - 2.2, 1.2, 0.8, 0.4, '#FF4D4D') + R(2.4, bot - 2.2, 1.2, 0.8, 0.4, '#FF4D4D');
        if (kit === 'ski') v += snow(top + 2.6);
        else for (let k = 0; k < 5; k++) { const a = (k * Math.PI * 2) / 5; v += C(Math.cos(a) * 0.75, top + 3.6 + Math.sin(a) * 0.75, 0.55, '#FFFFFF'); }
        if (kit !== 'ski') v += C(0, top + 3.6, 0.42, '#FFC93C');
        arrowY = 1.4;
        break;
      }
      case 'sports': {
        // a wedge: a pointed nose, wide hips, a bubble of glass far back, a big wing, a number
        const num = String(1 + (c.color * 3) % 9);
        v += tyres(3.2, 1.8, 3.0, top + 3.0, bot - 4.6)
          + P('M0 ' + (top + 0.4) + 'C2.0 ' + (top + 0.5) + ' 3.3 ' + (top + 2.6) + ' 3.5 ' + (top + 6) + 'L4.1 ' + (bot - 3.6) + 'Q4.1 ' + (bot - 0.9) + ' 2.8 ' + (bot - 0.9) + 'H-2.8Q-4.1 ' + (bot - 0.9) + ' -4.1 ' + (bot - 3.6) + 'L-3.5 ' + (top + 6) + 'C-3.3 ' + (top + 2.6) + ' -2.0 ' + (top + 0.5) + ' 0 ' + (top + 0.4) + 'Z', col)
          + R(-1.3, top + 0.9, 0.8, L - 2.2, 0.3, '#FFFFFF', ' opacity=".92"') + R(0.5, top + 0.9, 0.8, L - 2.2, 0.3, '#FFFFFF', ' opacity=".92"')
          + El(0, 1.8, 2.35, 3.6, glass) + El(-0.8, 0.4, 0.6, 1.4, '#FFFFFF', ' opacity=".22"')
          + C(0, top + 5.4, 1.75, '#FFFFFF') + '<text x="0" y="' + (top + 6.25).toFixed(2) + '" text-anchor="middle" font-family="Lexend, system-ui, sans-serif" font-size="2.4" font-weight="800" fill="#1F2128">' + num + '</text>'
          + R(-4.7, bot - 2.4, 9.4, 1.2, 0.5, '#1F2128') + R(-4.7, bot - 3.4, 0.9, 2.6, 0.4, '#1F2128') + R(3.8, bot - 3.4, 0.9, 2.6, 0.4, '#1F2128')
          + El(-3.3, 1.4, 0.35, 1.2, '#1F2128') + El(3.3, 1.4, 0.35, 1.2, '#1F2128');
        arrowY = top + 9.4; roofy = true;
        break;
      }
      case 'convertible':
        // open top: two people in front, a folded hood behind them; a board at the beach
        v += wheels() + box(-4.0, top + 0.9, 8.0, L - 1.8, 3.0, col) + R(-3.5, top + 5.6, 7.0, 0.8, 0.4, '#2A2E38')
          + R(-3.1, top + 6.4, 6.2, L - 10.6, 1.6, '#3A3532') + R(-2.8, top + 7.4, 2.4, 2.4, 0.7, '#D9B48A') + R(0.4, top + 7.4, 2.4, 2.4, 0.7, '#D9B48A') + R(-2.8, bot - 5.9, 5.6, 1.6, 0.6, '#D9B48A')
          + head(-1.6, top + 8.3, hair, '#FFFFFF') + head(1.6, top + 8.3, OB_HAIR[(c.color + 3) % OB_HAIR.length], '#FF9EC0')
          + R(-3.4, bot - 4.0, 6.8, 1.7, 0.85, '#2A2E38') + lamps()
          + (kit === 'beach' ? board(3.0, 2.6, 6.4, OB_BOARDS[c.color % OB_BOARDS.length]) : '');
        arrowY = 2.2; roofy = true;
        break;
      case 'mini': {
        // short bonnet, a big roof in another color with a chequered flag on it
        const rc = obLight(col) ? '#1F2128' : '#F4F5F7', sq = obLight(col) ? '#F4F5F7' : '#1F2128';
        let chk = '';
        for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) if ((r + k) % 2) chk += R(-2.1 + k * 1.4, -1.6 + r * 1.4, 1.4, 1.4, 0, sq);
        v += tyres(3.0, 1.6, 2.6, top + 2.2, bot - 4.8) + box(-3.8, top + 0.9, 7.6, L - 1.8, 3.6, col)
          + R(-1.6, top + 1.1, 0.7, 2.8, 0.3, rc) + R(0.9, top + 1.1, 0.7, 2.8, 0.3, rc)
          + shield(top + 3.8, top + 5.2, 2.6, 3.0) + R(-3.2, top + 5.2, 6.4, L - 8.8, 2.0, rc) + chk
          + El(-4.1, top + 5.0, 0.45, 0.65, col) + El(4.1, top + 5.0, 0.45, 0.65, col) + rearGlass(bot - 3.4, bot - 2.2, 2.8, 2.4)
          + C(-2.6, top + 1.9, 0.8, '#FFF4BE') + C(2.6, top + 1.9, 0.8, '#FFF4BE') + R(-3.3, bot - 1.8, 1.2, 0.7, 0.35, '#FF4D4D') + R(2.1, bot - 1.8, 1.2, 0.7, 0.35, '#FF4D4D');
        arrowY = 0.4; roofy = true;
        break;
      }
      case 'jeep': {
        // boxy and narrow, fat tyres out at the sides, a bull bar, the spare wheel on the back
        v += tyres(3.1, 1.9, 3.6, top + 1.6, bot - 5.2) + box(-3.4, top + 1.2, 6.8, L - 2.6, 1.0, col)
          + R(-3.9, top + 0.3, 7.8, 1.0, 0.45, '#2A2E38') + line('M-3 ' + (top + 0.8) + 'V' + (top + 2.0) + 'M3 ' + (top + 0.8) + 'V' + (top + 2.0), '#2A2E38', 0.5)
          + C(-2.4, top + 2.2, 0.75, '#FFF4BE') + C(2.4, top + 2.2, 0.75, '#FFF4BE') + R(-3.0, top + 4.4, 6.0, 0.8, 0.3, glass)
          + C(0, bot - 0.6, 1.75, tyre) + C(0, bot - 0.6, 0.65, '#8E96A3');
        if (kit === 'beach') v += R(-2.8, top + 5.6, 5.6, L - 8.8, 0.8, '#3A3532') + R(-2.5, top + 6.2, 2.2, 2.2, 0.6, '#D9B48A') + R(0.3, top + 6.2, 2.2, 2.2, 0.6, '#D9B48A') + head(-1.4, top + 7.0, hair, '#FFC93C') + line('M-3.5 ' + (top + 10.2) + 'H3.5', '#D9DCE3', 0.7) + board(2.7, 1.6, 6.0, OB_BOARDS[c.color % OB_BOARDS.length]);
        else if (kit === 'ski') v += roof(top + 5.4, bot - 3.0, 'rgba(255,255,255,0.12)', 0.8, 2.9) + El(0, 0, 2.4, 5.6, '#FFFFFF', ' opacity=".92"') + snow(top + 2.8);
        // elsewhere a canoe on the roof rack, longer than the jeep
        else v += roof(top + 5.4, bot - 3.0, 'rgba(255,255,255,0.12)', 0.8, 2.9) + line('M-3.2 ' + (top + 6.8) + 'H3.2M-3.2 ' + (bot - 4.4) + 'H3.2', '#2A2E38', 0.5)
          + P('M0 ' + (top - 0.4) + 'C1.9 ' + (top + 3) + ' 1.9 ' + (bot - 3) + ' 0 ' + (bot + 0.4) + 'C-1.9 ' + (bot - 3) + ' -1.9 ' + (top + 3) + ' 0 ' + (top - 0.4) + 'Z', ['#F2564D', '#FFC93C', '#22BFB0'][c.color % 3])
          + El(0, 0.6, 0.9, 3.2, '#2A2E38', ' opacity=".55"');
        arrowY = kit === 'beach' ? -0.6 : 0.6; roofy = true;
        break;
      }
      case 'buggy':
        // a dune buggy: a bonnet and side pods, the frame open, a roll cage, a driver in a helmet
        v += tyres(3.0, 2.0, 3.4, top + 1.2, bot - 4.6) + box(-3.0, top + 0.8, 6.0, 5.2, 2.4, col) + R(-3.6, top + 5.4, 1.1, L - 7.6, 0.5, col) + R(2.5, top + 5.4, 1.1, L - 7.6, 0.5, col)
          + R(-2.5, top + 5.8, 5.0, L - 8.4, 0.8, '#2E2B2A') + '<rect x="-2.9" y="' + (top + 5.6) + '" width="5.8" height="' + (L - 9.8) + '" rx="1" fill="none" stroke="#D9DCE3" stroke-width="0.6"/>'
          + helmet(0, top + 8.4, '#FFFFFF', col) + R(-2.0, bot - 3.6, 4.0, 2.4, 0.6, '#5E6676') + C(-0.9, bot - 2.4, 0.5, '#2A2E38') + C(0.9, bot - 2.4, 0.5, '#2A2E38')
          + C(-2.0, top + 1.7, 0.7, '#FFF4BE') + C(2.0, top + 1.7, 0.7, '#FFF4BE');
        arrowY = 2.2; roofy = true;
        break;
      case 'pickup': {
        // a cab in front and an open bed behind: boards at the beach, snow and a sled at the ski lodge, crates on the ferry
        v += tyres(3.2, 1.7, 2.8, top + 2.0, bot - 4.6) + box(-4.0, top + 0.9, 8.0, 8.6, 2.4, col) + shield(top + 3.2, top + 5.0, 2.6, 3.2) + roof(top + 5.0, top + 8.6, null, 1.0)
          + R(-4.0, top + 9.9, 8.0, L - 10.8, 0.6, col) + R(-3.3, top + 10.5, 6.6, L - 12.0, 0.4, 'rgba(0,0,0,0.32)') + lamps();
        if (kit === 'beach') v += El(-1.4, bot - 4.6, 0.95, 3.5, OB_BOARDS[(c.color + 1) % OB_BOARDS.length]) + El(1.3, bot - 4.6, 0.95, 3.5, OB_BOARDS[(c.color + 3) % OB_BOARDS.length]);
        else if (kit === 'ski') v += R(-3.1, top + 10.7, 6.2, L - 12.4, 0.8, '#FFFFFF', ' opacity=".95"') + R(-1.4, top + 11.4, 2.8, 4.6, 0.8, '#E2453C') + snow(top + 2.6);
        else v += R(-3.0, top + 11.0, 2.8, 2.8, 0.3, '#B98A55') + R(0.2, top + 11.0, 2.8, 2.8, 0.3, '#A57844') + R(-1.4, top + 14.2, 2.8, 2.6, 0.3, '#B98A55');
        arrowY = top + 6.8;
        break;
      }
      case 'taxi': case 'sedan': case 'police': {
        // a saloon: bonnet, cabin and boot; the taxi with a big lit sign, the police car with its light bar
        v += wheels() + box(-4.0, top + 0.9, 8.0, L - 1.8, 2.4, col);
        if (model === 'police') v += R(-4.0, top + 0.9, 8.0, 4.4, 2.4, '#1F2128') + R(-4.0, bot - 4.6, 8.0, 3.7, 2.4, '#1F2128');
        v += R(-3.4, top + 1.4, 6.8, 3.6, 1.4, 'rgba(255,255,255,0.14)') + shield(top + 5.0, top + 7.0, 2.5, 3.1) + roof(top + 7.0, bot - 6.4, 'rgba(0,0,0,0.14)', 1.0)
          + rearGlass(bot - 6.4, bot - 4.8, 3.0, 2.5) + lamps();
        if (model === 'taxi') {
          let chk = '';
          if (col === '#FFC93C') for (let k = 0; k < 6; k++) chk += R(-4.0, top + 7.2 + k, 0.7, 1.0, 0, k % 2 ? '#1F2128' : '#FFFFFF') + R(3.3, top + 7.2 + k, 0.7, 1.0, 0, k % 2 ? '#FFFFFF' : '#1F2128');
          v += chk + R(-3.0, top + 7.4, 6.0, 2.8, 0.7, '#FFF3A6', ' opacity=".35"') + R(-2.6, top + 7.7, 5.2, 2.2, 0.5, '#FFE27A')
            + '<text x="0" y="' + (top + 9.35).toFixed(2) + '" text-anchor="middle" font-family="Lexend, system-ui, sans-serif" font-size="1.7" font-weight="800" fill="#1F2128">TAXI</text>';
          arrowY = 2.4;
        } else if (model === 'police') {
          v += C(-1.6, top + 8.4, 2.3, '#FF3B3B', ' opacity=".3"') + C(1.6, top + 8.4, 2.3, '#2F7BFF', ' opacity=".3"') + R(-3.0, top + 7.7, 3.0, 1.4, 0.5, '#FF3B3B') + R(0, top + 7.7, 3.0, 1.4, 0.5, '#2F7BFF')
            + R(-4.0, -0.4, 0.7, 3.2, 0.2, '#2F6FD8') + R(3.3, -0.4, 0.7, 3.2, 0.2, '#2F6FD8');
          arrowY = 2.4; under = '#F4F5F7';
        } else {
          v += line('M-3.9 ' + (top + 5) + 'V' + (bot - 5) + 'M3.9 ' + (top + 5) + 'V' + (bot - 5), '#FFFFFF', 0.25, ' opacity=".6"');
          arrowY = 0.6;
        }
        break;
      }
      case 'estate':
        // a long roof to the back with rails: luggage on it on the ferry, skis at the ski lodge
        v += wheels() + box(-4.0, top + 0.9, 8.0, L - 1.8, 2.6, col) + shield(top + 3.2, top + 5.4, 2.6, 3.2) + roof(top + 5.4, bot - 2.2, null, 1.2)
          + line('M-2.7 ' + (top + 6.2) + 'V' + (bot - 3.0) + 'M2.7 ' + (top + 6.2) + 'V' + (bot - 3.0), '#2A2E38', 0.45) + R(-2.9, bot - 2.1, 5.8, 0.9, 0.4, glass, ' opacity=".85"') + lamps();
        if (kit === 'ski') v += R(-3.3, top + 5.8, 1.0, L - 9.0, 0.5, '#F2564D') + R(-2.1, top + 6.2, 1.0, L - 9.6, 0.5, '#FFFFFF') + R(1.2, top + 5.8, 1.0, L - 9.0, 0.5, '#3D8BFD') + R(2.4, top + 6.2, 1.0, L - 9.6, 0.5, '#FFC93C') + snow(top + 2.6);
        else v += bag(-2.4, top + 7.0, 2.2, 4.0, '#B5532E') + bag(0.3, top + 7.4, 2.2, 3.4, '#2F6FD8') + bag(-1.6, top + 11.8, 3.2, 2.4, '#7A5BD8');
        arrowY = kit === 'ski' ? 0.6 : 2.4; roofy = true;
        break;
      // ---------------------------------------------------------------- three spaces
      case 'mixer': {
        // a cement mixer: the cab, and a big drum with a spiral stripe
        // stripes round the drum, each as wide as the drum is where it crosses
        const dcy = top + 9.6 + (L - 11.4) / 2, dry = (L - 11.4) / 2;
        let st = '';
        for (let k = 0; k < 5; k++) { const ym = top + 11.6 + k * 3.2, hw = 3.5 * Math.sqrt(Math.max(0, 1 - ((ym - dcy) / dry) ** 2)) * 0.88; st += line('M' + (-hw).toFixed(2) + ' ' + (ym + 0.7).toFixed(2) + 'L' + hw.toFixed(2) + ' ' + (ym - 0.7).toFixed(2), '#E2453C', 0.9); }
        v += wheels(true) + box(-4.0, top + 0.9, 8.0, 7.6, 2.0, col) + shield(top + 2.6, top + 4.6, 2.6, 3.2) + roof(top + 4.6, top + 7.8, null, 1.0)
          + R(-3.6, top + 9.0, 7.2, L - 10.2, 1.0, '#5E6676') + El(0, top + 9.6 + (L - 11.4) / 2, 3.5, (L - 11.4) / 2, '#E9ECEF') + shine(-3.5, top + 9.6, 7.0, L - 11.4, 3.5) + st
          + lamps();
        arrowY = top + 9.6 + (L - 11.4) / 2; under = '#E9ECEF';
        break;
      }
      case 'delivery': {
        // a box van: a white box with a big sign on its roof, a parcel or a pizza
        v += wheels(true) + box(-4.0, top + 0.9, 8.0, 9.0, 2.4, col) + shield(top + 2.8, top + 5.0, 2.6, 3.2) + roof(top + 5.0, top + 8.4, null, 1.0)
          + box(-4.3, top + 9.2, 8.6, L - 10.0, 0.9, '#F4F5F7') + R(-4.3, top + 9.2, 0.9, L - 10.0, 0.3, col) + R(3.4, top + 9.2, 0.9, L - 10.0, 0.3, col) + lamps();
        if (kit === 'city') v += P('M0 ' + (top + 12.2) + 'L3.0 ' + (bot - 4.2) + 'Q0 ' + (bot - 2.8) + ' -3.0 ' + (bot - 4.2) + 'Z', '#FFC93C') + R(-3.2, bot - 4.7, 6.4, 1.1, 0.5, '#E2A33A') + C(-0.8, bot - 7.2, 0.6, '#E2453C') + C(0.9, bot - 8.8, 0.55, '#E2453C') + C(0.3, bot - 6.2, 0.5, '#E2453C');
        else v += R(-2.6, top + 13.0, 5.2, 5.2, 0.5, '#C9935A') + R(-0.35, top + 13.0, 0.7, 5.2, 0, '#E8C890') + R(-2.6, top + 15.25, 5.2, 0.7, 0, '#E8C890');
        arrowY = kit === 'city' ? top + 10.6 : bot - 4.0; under = '#F4F5F7';
        break;
      }
      case 'fire': {
        // a fire engine: red, a long ladder, the lights on the cab, a hose reel
        let rungs = '';
        for (let y = top + 10.5; y < bot - 2.2; y += 1.6) rungs += 'M-1.7 ' + y.toFixed(1) + 'H1.7';
        v += wheels(true) + box(-4.0, top + 0.9, 8.0, L - 1.8, 2.2, col) + shield(top + 2.6, top + 4.8, 2.6, 3.2) + R(-3.3, top + 4.8, 6.6, 3.4, 1.0, 'rgba(0,0,0,0.14)')
          + R(-2.6, top + 5.4, 2.2, 1.0, 0.4, '#3D8BFD') + R(0.4, top + 5.4, 2.2, 1.0, 0.4, '#FF4D4D') + C(-2.6, top + 12, 1.3, '#F4F5F7') + C(-2.6, top + 12, 0.6, '#2A2E38')
          + '<path d="M-1.7 ' + (top + 10) + 'V' + (bot - 2) + 'M1.7 ' + (top + 10) + 'V' + (bot - 2) + rungs + '" stroke="#E9ECEF" stroke-width="0.55" fill="none"/>'
          + R(-4.0, top + 9.0, 0.7, L - 10.4, 0.3, '#FFFFFF', ' opacity=".75"') + R(3.3, top + 9.0, 0.7, L - 10.4, 0.3, '#FFFFFF', ' opacity=".75"') + lamps();
        arrowY = 0.6; roofy = true;
        break;
      }
      case 'camper':
        // a camper van: cream over its color, a striped pop-up roof, a board
        v += wheels() + box(-4.2, top + 0.8, 8.4, L - 1.6, 3.4, col)
          + P('M-3.4 ' + (top + 4.4) + 'Q0 ' + (top + 1.2) + ' 3.4 ' + (top + 4.4) + 'L2.8 ' + (top + 2.0) + 'Q0 ' + (top + 0.9) + ' -2.8 ' + (top + 2.0) + 'Z', glass)
          + R(-3.5, top + 5.0, 7.0, L - 7.4, 2.4, '#FBF5E8');
        for (let k = 0; k < 5; k++) v += R(-3.0 + k * 1.2, top + 7.0, 1.2, 8.0, 0, k % 2 ? '#F2564D' : '#FFFFFF');
        v += R(-3.0, top + 7.0, 6.0, 8.0, 0.6, 'none', ' stroke="#9AA0AA" stroke-width="0.4"') + board(2.35, 6.2, 6.6, OB_BOARDS[c.color % OB_BOARDS.length]) + lamps();
        arrowY = 4.2; under = '#FBF5E8'; roofy = true;
        break;
      case 'icecream':
        // an ice cream van: white with pastel bands and a giant cone on the roof
        v += wheels() + box(-4.2, top + 0.8, 8.4, L - 1.6, 3.0, '#FBF7F2') + R(-4.2, top + 6, 0.9, L - 8, 0.3, '#FF9EC0') + R(3.3, top + 6, 0.9, L - 8, 0.3, '#9EDCF0')
          + shield(top + 2.6, top + 4.9, 2.6, 3.2) + R(-3.2, top + 5.6, 6.4, 1.0, 0.4, '#FF9EC0')
          + P('M-2.3 ' + (bot - 12.0) + 'L2.3 ' + (bot - 12.0) + 'L0 ' + (bot - 2.6) + 'Z', '#E8B66A') + line('M-1.5 ' + (bot - 9.8) + 'L1.2 ' + (bot - 7.2) + 'M1.5 ' + (bot - 9.8) + 'L-1.2 ' + (bot - 7.2), '#C9934A', 0.3)
          + C(0, bot - 13.0, 2.7, '#FF9EC0') + C(-1.1, bot - 14.4, 1.3, '#9EDCF0') + C(1.1, bot - 14.6, 1.2, '#FFF3A6') + C(0.5, bot - 15.6, 0.6, '#E2453C') + lamps();
        arrowY = top + 8.0; under = '#FBF7F2';
        break;
      case 'bus': {
        let win = '';
        for (let y = top + 5.2; y < bot - 3.2; y += 2.6) win += R(-4.25, y, 0.9, 1.9, 0.3, '#FFE58A') + R(3.35, y, 0.9, 1.9, 0.3, '#FFE58A');
        v += wheels(true) + box(-4.3, top + 0.8, 8.6, L - 1.6, 1.8, col) + win + R(-3.6, top + 1.2, 7.2, 1.8, 0.6, glass) + R(-2.3, top + 3.2, 4.6, 0.85, 0.3, '#FFB02E')
          + R(-2.6, top + 9.5, 5.2, 3.0, 0.6, 'rgba(255,255,255,0.3)') + R(-2.6, bot - 8.5, 5.2, 3.0, 0.6, 'rgba(255,255,255,0.3)')
          + R(-3.5, top + 1.0, 1.4, 0.7, 0.35, '#FFF4BE') + R(2.1, top + 1.0, 1.4, 0.7, 0.35, '#FFF4BE') + R(-3.6, bot - 1.6, 1.4, 0.7, 0.3, '#FF4D4D') + R(2.2, bot - 1.6, 1.4, 0.7, 0.3, '#FF4D4D');
        break;
      }
      case 'limo':
        // a long, narrow car: a long bonnet, a long roof with a sunroof, two little flags in front
        v += wheels(true) + box(-3.7, top + 0.9, 7.4, L - 1.8, 3.0, col) + shield(top + 6.4, top + 8.6, 2.3, 2.9) + roof(top + 8.6, bot - 6.6, 'rgba(0,0,0,0.16)', 1.2, 2.9)
          + R(-1.5, top + 11.0, 3.0, 3.6, 0.6, glass, ' opacity=".7"') + rearGlass(bot - 6.6, bot - 4.8, 2.8, 2.3) + line('M-3.6 ' + (top + 3) + 'V' + (bot - 3) + 'M3.6 ' + (top + 3) + 'V' + (bot - 3), '#E9ECEF', 0.3, ' opacity=".7"')
          + line('M-2.8 ' + (top + 1.6) + 'V' + (top - 0.6) + 'M2.8 ' + (top + 1.6) + 'V' + (top - 0.6), '#C9D4E0', 0.25) + R(-2.8, top - 0.6, 1.4, 0.9, 0.1, '#E2453C') + R(2.8, top - 0.6, 1.4, 0.9, 0.1, '#2F6FD8') + lamps();
        arrowY = 2.0;
        break;
      case 'plough':
        v += wheels(true) + box(-3.9, top + 3.2, 7.8, L - 4.0, 1.4, col)
          + P('M-4.9 ' + (top + 0.4) + 'L4.9 ' + (top + 1.6) + 'L4.9 ' + (top + 3.0) + 'L-4.9 ' + (top + 1.8) + 'Z', '#5E6676') + line('M-4.6 ' + (top + 1.0) + 'L4.6 ' + (top + 2.15), '#FFC23A', 0.45, ' stroke-dasharray="1.2 1"')
          + shield(top + 4.6, top + 7.0, 2.5, 3.0) + C(0, top + 8.3, 2, '#FFB02E', ' opacity=".3"') + C(0, top + 8.3, 0.85, '#FFB02E') + R(-3.6, top + 11.0, 7.2, L - 12.6, 0.9, '#7C746B')
          + scatter(14, (c.x * 7 + c.y * 13 + 3) >>> 0, -3.2, top + 11.6, 3.2, bot - 2.2).map(([x, y]) => C(x, y, 0.32, '#D9D3CA')).join('')
          + R(-3.6, bot - 1.5, 1.3, 0.6, 0.3, '#FF4D4D') + R(2.3, bot - 1.5, 1.3, 0.6, 0.3, '#FF4D4D');
        arrowY = top + 11 + (L - 12.6) / 2;
        break;
      case 'snowcat': {
        let tread = '';
        for (let y = top + 1.6; y < bot - 1; y += 1.4) tread += 'M-4.7 ' + y.toFixed(1) + 'h1.6M3.1 ' + y.toFixed(1) + 'h1.6';
        v += R(-4.9, top + 0.8, 1.9, L - 1.6, 0.8, '#2A2E38') + R(3.0, top + 0.8, 1.9, L - 1.6, 0.8, '#2A2E38') + '<path d="' + tread + '" stroke="#5E6676" stroke-width="0.45"/>'
          + box(-3.0, top + 2.0, 6.0, L - 3.6, 1.6, col) + shield(top + 3.2, top + 6.0, 2.1, 2.6) + roof(top + 6.0, top + 13.0, null, 1.0, 2.6)
          + R(-2.4, top + 14.0, 4.8, L - 16.4, 0.8, 'rgba(0,0,0,0.2)') + C(0, top + 9.5, 1.8, '#FFB02E', ' opacity=".3"') + C(0, top + 9.5, 0.8, '#FFB02E');
        arrowY = 2.6;
        break;
      }
      case 'lorry': {
        const bx = OB_BOX[c.color % OB_BOX.length];
        v += wheels(true) + box(-4.1, top + 0.9, 8.2, 7.4, 2.2, col) + shield(top + 2.4, top + 4.6, 2.6, 3.2) + R(-1.4, top + 8.1, 2.8, 1.2, 0.3, '#2A2E38')
          + box(-4.3, top + 9.0, 8.6, L - 10.2, 0.8, bx) + R(-4.3, top + 13.0, 8.6, 2.0, 0, '#FFFFFF', ' opacity=".85"') + R(-4.3, bot - 6.0, 8.6, 2.0, 0, '#FFFFFF', ' opacity=".85"')
          + R(-3.6, top + 1.0, 1.6, 0.9, 0.45, '#FFF4BE') + R(2.0, top + 1.0, 1.6, 0.9, 0.45, '#FFF4BE') + R(-3.8, bot - 1.6, 1.4, 0.7, 0.3, '#FF4D4D') + R(2.4, bot - 1.6, 1.4, 0.7, 0.3, '#FF4D4D');
        arrowY = top + 9 + (L - 10.2) / 2;
        break;
      }
      case 'motorhome':
        // a motorhome: cream with a band of its color, a solar panel, two bikes on the back
        v += wheels(true) + box(-4.2, top + 0.8, 8.4, L - 1.6, 2.6, '#F2EFE6') + R(-4.2, top + 4, 0.9, L - 6, 0.3, col) + R(3.3, top + 4, 0.9, L - 6, 0.3, col)
          + shield(top + 1.4, top + 3.4, 2.8, 3.3) + R(-3.4, top + 4.0, 6.8, 3.0, 1.4, 'rgba(0,0,0,0.08)') + R(-2.6, top + 9.2, 5.2, 4.4, 0.4, '#2B3A66')
          + '<path d="M-2.6 ' + (top + 11.4) + 'H2.6M0 ' + (top + 9.2) + 'V' + (top + 13.6) + '" stroke="#5B7AC2" stroke-width="0.3"/>'
          + line('M-1.6 ' + (bot - 4.6) + 'V' + (bot - 0.6), tyre, 0.7) + line('M1.6 ' + (bot - 4.6) + 'V' + (bot - 0.6), tyre, 0.7) + line('M-3 ' + (bot - 2.6) + 'H3', col, 0.5) + lamps();
        arrowY = 2.6; under = '#F2EFE6';
        break;
      default:
        v += wheels() + box(-4.0, top + 0.9, 8.0, L - 1.8, 3.2, col) + lamps();
    }
    // the night throws light ahead; the low sun warms the glass
    if (kit === 'city' && c.len > 1) v = '<path d="M-3 ' + (top + 1) + 'L-4.4 ' + (top - 4.2) + 'L-0.6 ' + (top - 4.2) + 'L-1.5 ' + (top + 1) + 'ZM3 ' + (top + 1) + 'L4.4 ' + (top - 4.2) + 'L0.6 ' + (top - 4.2) + 'L1.5 ' + (top + 1) + 'Z" fill="#FFF6C8" opacity=".24"/>' + v;
    if (kit === 'city' && c.len === 1) v = '<path d="M-0.6 ' + (top + 0.8) + 'L-2 ' + (top - 3.6) + 'L2 ' + (top - 3.6) + 'L0.6 ' + (top + 0.8) + 'Z" fill="#FFF6C8" opacity=".24"/>' + v;
    if (kit === 'ferry' && c.len === 2 && !/^(jeep|estate|pickup)$/.test(model)) v += R(-3.0, top + 5.6, 6.0, L - 11.2, 1.4, 'rgba(255,160,110,0.16)');
    return { v, col: under || col, arrowY, roofy, small, h: OB_HEIGHT[model] || 1 };
  }
  class OutboundCard extends Card {
    pos(v) { return v === E.EXIT ? 'exit' : v == null ? '' : v; }
    hasHistory() { return this.run.hist.length > 0; }
    buildBoard() {
      const p = this.p, U = 10, R = 4.4;
      const W = p.w * U, H = p.h * U;
      this.uid = 'ob' + Math.random().toString(36).slice(2, 8);
      this.kit = OB_KITS[this.lookLv] || 'town';
      const svgEl = s('svg', { class: 'board', 'data-kit': this.kit, viewBox: [-R - 0.6, -R - 0.6, W + 2 * R + 1.2, H + 2 * R + 1.2].join(' '), role: 'group', 'aria-label': 'Parking lot with ' + p.cars.length + ' cars' });
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
      // the ground of the place: shells in the sand, tyre tracks in the snow, the deck's tie-down rings
      const ground = s('g', { class: 'ground-deco' });
      if (this.kit === 'beach') ground.innerHTML = scatter(Math.round(p.w * p.h * 0.5), (p.seed >>> 0) % 997 + 3, 1, 1, W - 1, H - 1).map(([x, y, k]) => '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="' + (0.45 + k * 0.4).toFixed(2) + '" ry="0.32" fill="' + (k > 0.5 ? '#FFF6EA' : '#F5C3BA') + '"/>').join('');
      if (this.kit === 'ski') { let d = ''; for (let x = 0; x < p.w; x++) d += 'M' + (x * U + 3.1) + ' 0.8V' + (H - 0.8) + 'M' + (x * U + 6.9) + ' 0.8V' + (H - 0.8); ground.innerHTML = '<path d="' + d + '" stroke="#B9C9DD" stroke-width="0.55" stroke-dasharray="0.9 0.5" opacity=".7"/>'; }
      if (this.kit === 'ferry') { let d = ''; for (let x = 1; x < p.w; x++) for (let y = 1; y < p.h; y++) d += '<circle cx="' + x * U + '" cy="' + y * U + '" r="0.55" fill="none" stroke="#8FA3B0" stroke-width="0.3"/>'; ground.innerHTML = d; }
      svgEl.append(ground);
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
      const L = c.len * 10, top = -L / 2;
      const model = obModel(this.kit, c, i, this.p.seed), V = obVehicle(this.kit, c, this.uid, model), dark = obLight(V.col);
      const g = s('g', { class: 'car', tabindex: '0', role: 'button', 'aria-label': OB_MODEL_NAMES[model] + ' facing ' + DIRNAME[c.dir] });
      // the shadow falls the same way whichever way the vehicle faces, longer for tall ones
      const sw = c.len === 1 ? 3.6 : 8.2, sh = s('g', { transform: 'translate(' + (0.35 + V.h * 0.35).toFixed(2) + ' ' + (0.5 + V.h * 0.55).toFixed(2) + ')' });
      sh.append(s('g', { transform: 'rotate(' + ANGLE[c.dir] + ')' }, s('rect', { x: -sw / 2, y: top + 0.9, width: sw, height: L - 1.8, rx: c.len === 1 ? 1.6 : 3, fill: 'rgba(10,12,20,0.45)', filter: 'url(#' + this.uid + 'b)' })));
      g.append(sh);
      const rot = s('g', { transform: 'rotate(' + ANGLE[c.dir] + ')' });
      const anim = s('g', { class: 'anim' });
      anim.append(s('rect', { class: 'hit', x: -5, y: top, width: 10, height: L, fill: 'transparent' }));
      const art = s('g');
      art.innerHTML = V.v;
      anim.append(art);
      const cy = V.arrowY;
      const chevron = 'M-1.9 ' + (cy + 1.1) + ' L0 ' + (cy - 0.9) + ' L1.9 ' + (cy + 1.1);
      const arrow = s('g', V.small ? { transform: 'translate(0 ' + cy + ') scale(0.72) translate(0 ' + -cy + ')' } : null);
      // where the top is busy, the arrow gets a dark edge so it reads on anything
      if (V.roofy) arrow.append(s('path', { d: chevron, fill: 'none', stroke: 'rgba(20,22,30,0.6)', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      arrow.append(s('path', { d: chevron, fill: 'none', stroke: dark && !V.roofy ? 'rgba(30,30,30,0.72)' : 'rgba(255,255,255,0.95)', 'stroke-width': 1.05, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      anim.append(arrow);
      anim.append(s('rect', { class: 'halo', x: -5.4, y: top - 0.1, width: 10.8, height: L + 0.2, rx: c.len === 1 ? 3 : 3.8 }));
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
      const early = this.o.feedback && !this.practice && !this.lateDead();
      if (early && rec.kind !== 'blocked') this.flash(i, rec.cls);
      this.commit(rec);
      if (early && rec.cls === 'dead_end') { Sound.play('dead'); this.markStuck(); this.call(this.undoBtn, true); }
    }
    // Levels 1-3 flag each move and a dead end the moment it is made. Levels 4-5
    // say nothing until no car can move, so a wrong move costs a restart.
    lateDead() { return this.spec.level >= 4; }
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
      const show = this.o.feedback && !this.practice && this.G.dist(this.p, this.run.st) === Infinity &&
        (!this.lateDead() || this.G.movable(this.p, this.run).length === 0);
      const stuck = show ? new Set(this.G.stuckCars(this.p, this.run)) : new Set();
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
      if (this.o.feedback && !this.practice) {
        if (this.lateDead()) Sound.play('dead');
        this.markStuck();
      }
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
  // The garden is drawn in layers, so every pipe lies above every bed and every plant
  // stands above every pipe: beds, puddles, pipe shadows, pipes (these turn), the
  // spring and the plants, dripping water, and on top the cells you tap.
  // The flowers it grows: petals (how many, how big, how far out), their colour, a
  // deeper throat, and the centre with its seeds. The pink one was the first.
  // A pipe runs from the tile's middle to a collar just inside the tile's edge, so
  // every pipe end shows where it stops. Where two collars face each other across the
  // gap between tiles, a coupling joins them: connected pipes look joined, and an end
  // that meets nothing stays visibly open.
  const CD_ARM = 3.9, CD_COL_AT = 4.2, CD_COL_L = 1.0, CD_COL_W = 4.6, CD_BRIDGE = 2.0;
  const CD_FLOWERS = [
    { n: 5, r: 1.0, at: 1.15, petal: '#FF6FA7', deep: '#EE4F8C', eye: '#FFD23F', seed: '#EE9F00' },
    { n: 6, r: 0.86, at: 1.24, petal: '#FFC53D', deep: '#F59F1B', eye: '#A65A2B', seed: '#6E3414' },
    { n: 5, r: 1.0, at: 1.15, petal: '#A98BFF', deep: '#8A66F0', eye: '#FFD23F', seed: '#EE9F00' },
    { n: 9, r: 0.47, at: 1.28, petal: '#FFFFFF', deep: '#EDE6F5', eye: '#FFC93C', seed: '#E08E00', daisy: true },
    { n: 5, r: 1.0, at: 1.15, petal: '#FF815F', deep: '#EE5E42', eye: '#FFE27A', seed: '#EE9F00' },
    { n: 6, r: 0.98, at: 1.0, petal: '#E8344E', deep: '#B81E37', eye: '#8A1428', seed: '#5A0A18' },
  ];
  const CD_LEVEL_FLOWERS = { 1: [0, 1, 2, 3, 4], 2: [1, 3], 3: [2, 3, 0], 4: [4, 1], 5: [5, 3] };
  // now and then a small tuft of grass in a free corner of a bed
  function cdTuft(seed, cx, cy) {
    const r = Math.imul(seed + 101, 2654435761) >>> 0;
    if (r % 3) return null;
    const c = [[-1, -1], [1, -1], [-1, 1], [1, 1]][(r >>> 5) & 3];
    const x = cx + c[0] * 3.2, y = cy + c[1] * 3.05 + 0.65;
    const blade = (x0, qx, qy, ex, ey, cls) => s('path', { class: cls, d: 'M' + (x + x0) + ' ' + y + 'q' + qx + ' ' + qy + ' ' + ex + ' ' + ey });
    return s('g', { class: 'tuft' }, blade(-0.2, -0.1, -0.65, -0.8, -1.0, 'b2'), blade(0.2, 0.12, -0.6, 0.75, -0.9, 'b2'), blade(0, 0.08, -0.85, -0.08, -1.45, 'b1'));
  }
  // the source: a round pool with a white ring, a drop that bobs, and a slow ripple
  function cdWell(cx, cy) {
    const d = 'M' + cx + ' ' + (cy - 1.9) + 'C' + (cx + 1.5) + ' ' + (cy - 0.2) + ' ' + (cx + 1.4) + ' ' + (cy + 1.7) + ' ' + cx + ' ' + (cy + 1.7) + 'C' + (cx - 1.4) + ' ' + (cy + 1.7) + ' ' + (cx - 1.5) + ' ' + (cy - 0.2) + ' ' + cx + ' ' + (cy - 1.9) + 'Z';
    const bob = s('g', { class: 'well-bob' },
      s('path', { class: 'well-drop', d }),
      s('path', { class: 'well-curl', d: 'M' + (cx - 0.72) + ' ' + (cy + 0.15) + 'Q' + (cx - 0.78) + ' ' + (cy + 0.95) + ' ' + (cx - 0.05) + ' ' + (cy + 1.1) }));
    return s('g', { class: 'well', 'aria-hidden': 'true' },
      s('circle', { class: 'ground', cx, cy: cy + 0.55, r: 3.4 }),
      s('circle', { class: 'well-pool', cx, cy, r: 3.4 }),
      s('circle', { class: 'well-ripple', cx, cy, r: 2.5 }),
      s('circle', { class: 'well-rim', cx, cy, r: 2.5 }),
      bob);
  }

  // the butterfly that comes to a finished garden
  function cdButterfly() {
    const wing = (k) => s('g', { class: 'bw' },
      s('path', { class: 'bw-up', d: 'M0 -0.1C' + 0.6 * k + ' -1.7 ' + 2.35 * k + ' -2.2 ' + 2.45 * k + ' -1.05C' + 2.5 * k + ' -0.2 ' + 1.2 * k + ' 0.3 0 0.15Z' }),
      s('path', { class: 'bw-lo', d: 'M0 0.1C' + 1.15 * k + ' 0.3 ' + 1.95 * k + ' 0.95 ' + 1.55 * k + ' 1.65C' + 1.15 * k + ' 2.15 ' + 0.3 * k + ' 1.25 0 0.35Z' }),
      s('circle', { class: 'bw-dot', cx: 1.5 * k, cy: -1.1, r: 0.34 }),
      s('circle', { class: 'bw-dot', cx: 0.95 * k, cy: 1.05, r: 0.2 }));
    return s('g', { class: 'butterfly', 'aria-hidden': 'true' },
      wing(-1), wing(1),
      s('ellipse', { class: 'bf-torso', cx: 0, cy: 0.15, rx: 0.27, ry: 1.05 }),
      s('path', { class: 'bf-feel', d: 'M-0.1 -0.8Q-0.35 -1.65 -0.8 -1.95M0.1 -0.8Q0.35 -1.65 0.8 -1.95' }));
  }

  // Each level is a place of its own, and the board belongs to it (by the look's level): the herb
  // garden's pots, the farmyard's troughs where animals come to drink, the Japanese garden's koi
  // ponds fed by bamboo pipes, the oasis's palms by stone channels in the sand, the palace garden's
  // fountains at night. The pipes, the beds, the source and what the water reaches change; the
  // rules do not.
  const CD_KITS = ['garden', 'garden', 'farm', 'japan', 'oasis', 'palace'];
  const cdG = (cls, transform, inner) => { const g = s('g', { class: cls, transform }); g.innerHTML = inner; return g; };
  const cdRnd = (seed) => { let r = (Math.imul(seed + 7, 2654435761) >>> 0) || 1; return () => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; }; };
  // what lies on a bed besides the pipe: raked gravel, ripples in the sand, a gold edge
  function cdBedDecor(kit, x, y, i) {
    const X = x * 10, Y = y * 10;
    if (kit === 'japan') {
      // rake lines, across on one bed and down on the next, like a checkerboard
      let d = '';
      for (let k = 1; k <= 3; k++) d += (x + y) % 2 ? 'M' + (X + 1.4) + ' ' + (Y + k * 2.4 + 0.3) + 'H' + (X + 8.6) : 'M' + (X + k * 2.4 + 0.3) + ' ' + (Y + 1.4) + 'V' + (Y + 8.6);
      return s('path', { class: 'rake', d });
    }
    if (kit === 'oasis') {
      const r = cdRnd(i * 13 + 5), y1 = Y + 2.4 + r() * 1.4, y2 = y1 + 3.4 + r() * 1.2;
      return s('path', { class: 'ripple', d: 'M' + (X + 1.2) + ' ' + y1.toFixed(2) + 'q2.2 -0.9 4.2 0t3.4 -0.2M' + (X + 1.6) + ' ' + y2.toFixed(2) + 'q2.4 -0.9 4.4 0t2.6 -0.3' });
    }
    if (kit === 'palace') return s('rect', { class: 'trim', x: X + 1.25, y: Y + 1.25, width: 7.5, height: 7.5, rx: 1.4 });
    if (kit === 'farm') {
      const r = cdRnd(i * 17 + 3);
      let d = '';
      for (let k = 0; k < 4; k++) { const sx = X + 1.4 + r() * 7.2, sy = Y + 1.4 + r() * 7.2, a = r() * Math.PI; d += 'M' + sx.toFixed(2) + ' ' + sy.toFixed(2) + 'l' + (Math.cos(a) * 1.3).toFixed(2) + ' ' + (Math.sin(a) * 1.3).toFixed(2); }
      return s('path', { class: 'straw', d });
    }
    return null;
  }
  // now and then something small in a free corner of a bed: grass, straw, moss, pebbles, night flowers
  function cdTuftFor(kit, seed, cx, cy) {
    if (kit === 'garden') return cdTuft(seed, cx, cy);
    const r = Math.imul(seed + 101, 2654435761) >>> 0;
    if (r % 3) return null;
    const c = [[-1, -1], [1, -1], [-1, 1], [1, 1]][(r >>> 5) & 3];
    const x = cx + c[0] * 3.1, y = cy + c[1] * 3.0 + 0.5;
    if (kit === 'farm') return cdG('tuft', null, '<path class="b1" d="M' + (x - 0.7) + ' ' + y + 'l0.5 -1.3M' + (x - 0.1) + ' ' + y + 'l-0.1 -1.5M' + (x + 0.5) + ' ' + y + 'l-0.4 -1.2M' + (x + 0.9) + ' ' + y + 'l0.3 -1.0"/>');
    if (kit === 'japan') return cdG('moss', null, '<circle cx="' + (x - 0.5) + '" cy="' + (y - 0.4) + '" r="0.75"/><circle cx="' + (x + 0.35) + '" cy="' + (y - 0.6) + '" r="0.6"/><circle cx="' + (x + 0.1) + '" cy="' + (y - 0.05) + '" r="0.55"/>');
    if (kit === 'oasis') return cdG('pebbles', null, '<ellipse cx="' + (x - 0.4) + '" cy="' + (y - 0.3) + '" rx="0.7" ry="0.45"/><ellipse class="p2" cx="' + (x + 0.5) + '" cy="' + (y - 0.1) + '" rx="0.45" ry="0.32"/>');
    // the palace at night: a small pale flower
    let d = '';
    for (let k = 0; k < 5; k++) { const a = (k * Math.PI * 2) / 5; d += '<circle cx="' + (x + Math.cos(a) * 0.42).toFixed(2) + '" cy="' + (y - 0.5 + Math.sin(a) * 0.42).toFixed(2) + '" r="0.3"/>'; }
    return cdG('nightflower', null, d + '<circle class="eye" cx="' + x + '" cy="' + (y - 0.5) + '" r="0.2"/>');
  }
  // the source, always a round pool with the drop over it, in the place's own rim
  function cdSource(kit, cx, cy) {
    const w = cdWell(cx, cy);
    if (kit === 'garden') return w;
    let rim = '';
    if (kit === 'farm') {
      // a wooden barrel, seen from above, with an iron hoop
      rim = '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="#A36A36"/>';
      for (let k = 0; k < 14; k++) { const a = (k * Math.PI * 2) / 14; rim += '<path d="M' + (cx + Math.cos(a) * 2.9).toFixed(2) + ' ' + (cy + Math.sin(a) * 2.9).toFixed(2) + 'L' + (cx + Math.cos(a) * 4).toFixed(2) + ' ' + (cy + Math.sin(a) * 4).toFixed(2) + '" stroke="#7A4A22" stroke-width="0.16"/>'; }
      rim += '<circle cx="' + cx + '" cy="' + cy + '" r="3.75" fill="none" stroke="#4E545C" stroke-width="0.45"/>';
    } else if (kit === 'japan') {
      // a stone basin with a bamboo spout
      rim = '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="#8E918B"/><circle cx="' + (cx - 1.6) + '" cy="' + (cy + 2.4) + '" r="0.35" fill="#6F726C"/><circle cx="' + (cx + 2.6) + '" cy="' + (cy - 1.5) + '" r="0.3" fill="#6F726C"/>'
        + '<path d="M' + (cx - 4.4) + ' ' + (cy - 3.2) + 'L' + (cx - 1.8) + ' ' + (cy - 1.7) + '" stroke="#A9BC4E" stroke-width="1.1" stroke-linecap="round"/><path d="M' + (cx - 3.4) + ' ' + (cy - 3.1) + 'l0.45 -0.75" stroke="#6E8A2C" stroke-width="0.3"/>';
    } else if (kit === 'oasis') {
      // a spring in a ring of sandy rocks
      const r = cdRnd(cx * 7 + cy);
      for (let k = 0; k < 10; k++) { const a = (k * Math.PI * 2) / 10 + r() * 0.3; rim += '<ellipse cx="' + (cx + Math.cos(a) * 3.55).toFixed(2) + '" cy="' + (cy + Math.sin(a) * 3.55).toFixed(2) + '" rx="' + (1.0 + r() * 0.4).toFixed(2) + '" ry="0.85" fill="' + (k % 2 ? '#C9A06A' : '#B88E58') + '"/>'; }
    } else {
      // a marble basin with a gold rim
      rim = '<circle cx="' + cx + '" cy="' + cy + '" r="4.1" fill="#E9E6EF"/><circle cx="' + cx + '" cy="' + cy + '" r="3.9" fill="none" stroke="#E2B552" stroke-width="0.4"/>';
    }
    const back = s('g', { class: 'well-rim-' + kit });
    back.innerHTML = rim;
    w.insertBefore(back, w.firstChild.nextSibling);
    return w;
  }
  // the farmyard: a wooden trough; when it fills, an animal comes up behind it and drinks
  const CD_BEASTS = {
    cow: '<path d="M-1.35 -4.3q-0.95 -0.9 -0.45 -1.65q0.3 0.8 1.15 1.05z" fill="#EFE3C8"/><path d="M1.35 -4.3q0.95 -0.9 0.45 -1.65q-0.3 0.8 -1.15 1.05z" fill="#EFE3C8"/>'
      + '<ellipse cx="-2.25" cy="-3.3" rx="1.05" ry="0.5" transform="rotate(-18 -2.25 -3.3)" fill="#FFFFFF"/><ellipse cx="2.25" cy="-3.3" rx="1.05" ry="0.5" transform="rotate(18 2.25 -3.3)" fill="#FFFFFF"/>'
      + '<ellipse cx="-2.3" cy="-3.3" rx="0.6" ry="0.24" transform="rotate(-18 -2.3 -3.3)" fill="#F5B8BC"/><ellipse cx="2.3" cy="-3.3" rx="0.6" ry="0.24" transform="rotate(18 2.3 -3.3)" fill="#F5B8BC"/>'
      + '<rect x="-1.75" y="-4.6" width="3.5" height="4.4" rx="1.6" fill="#FFFFFF"/><path d="M-1.7 -2.9V-3.3a1.5 1.5 0 0 1 1.45 -1.3h0.55q-0.25 1.05 -0.85 1.45q-0.55 0.35 -1.15 0.25z" fill="#2E2A28"/><path d="M1.75 -2.4q-0.75 -0.1 -0.85 -0.7q0.4 -0.35 0.85 -0.2z" fill="#2E2A28"/>'
      + '<circle cx="-0.75" cy="-2.75" r="0.27" fill="#2E2A28"/><circle cx="0.75" cy="-2.75" r="0.27" fill="#2E2A28"/>'
      + '<ellipse cx="0" cy="-0.95" rx="1.55" ry="0.95" fill="#F6B3B7"/><ellipse cx="-0.55" cy="-1" rx="0.22" ry="0.3" fill="#C9787E"/><ellipse cx="0.55" cy="-1" rx="0.22" ry="0.3" fill="#C9787E"/>',
    pig: '<path d="M-1.85 -3.5L-2.7 -5.1L-0.75 -4.3Z" fill="#EE93AA"/><path d="M1.85 -3.5L2.7 -5.1L0.75 -4.3Z" fill="#EE93AA"/>'
      + '<circle cx="0" cy="-2.3" r="2.15" fill="#F7B2C2"/><circle cx="-0.8" cy="-2.85" r="0.26" fill="#3A2A2E"/><circle cx="0.8" cy="-2.85" r="0.26" fill="#3A2A2E"/>'
      + '<ellipse cx="0" cy="-1.15" rx="1.05" ry="0.72" fill="#F28FA8"/><ellipse cx="-0.38" cy="-1.15" rx="0.18" ry="0.28" fill="#B95A74"/><ellipse cx="0.38" cy="-1.15" rx="0.18" ry="0.28" fill="#B95A74"/>',
    sheep: '<ellipse cx="-2.15" cy="-2.9" rx="0.95" ry="0.42" transform="rotate(-15 -2.15 -2.9)" fill="#45434F"/><ellipse cx="2.15" cy="-2.9" rx="0.95" ry="0.42" transform="rotate(15 2.15 -2.9)" fill="#45434F"/>'
      + '<ellipse cx="0" cy="-2" rx="1.35" ry="2" fill="#45434F"/>'
      + '<g fill="#FFFFFF"><circle cx="-1.5" cy="-3.9" r="0.85"/><circle cx="-0.75" cy="-4.55" r="0.85"/><circle cx="0.1" cy="-4.75" r="0.9"/><circle cx="0.95" cy="-4.5" r="0.85"/><circle cx="1.6" cy="-3.85" r="0.8"/></g>'
      + '<circle cx="-0.55" cy="-2.35" r="0.32" fill="#FFFFFF"/><circle cx="-0.5" cy="-2.3" r="0.16" fill="#1E1C24"/><circle cx="0.55" cy="-2.35" r="0.32" fill="#FFFFFF"/><circle cx="0.6" cy="-2.3" r="0.16" fill="#1E1C24"/>'
      + '<path d="M-0.35 -0.75Q0 -0.5 0.35 -0.75" stroke="#2A2830" stroke-width="0.18" fill="none"/>',
    horse: '<path d="M-1.3 -4L-1 -5.4L-0.3 -4.4Z" fill="#8A5530"/><path d="M1.3 -4L1 -5.4L0.3 -4.4Z" fill="#8A5530"/>'
      + '<rect x="-1.35" y="-4.7" width="2.7" height="5" rx="1.3" fill="#9C6338"/><path d="M-0.95 -4.75q0.95 -0.75 1.9 0l-0.25 0.9h-1.4z" fill="#4A2A16"/>'
      + '<path d="M-0.25 -4.1h0.5l0.25 2.3h-1z" fill="#F4E6D2"/><ellipse cx="0" cy="-0.55" rx="1.3" ry="0.95" fill="#D7A07A"/>'
      + '<ellipse cx="-0.5" cy="-0.6" rx="0.17" ry="0.26" fill="#7A4A30"/><ellipse cx="0.5" cy="-0.6" rx="0.17" ry="0.26" fill="#7A4A30"/><circle cx="-0.95" cy="-3" r="0.25" fill="#2A1A10"/><circle cx="0.95" cy="-3" r="0.25" fill="#2A1A10"/>',
  };
  const CD_BEAST_ORDER = ['cow', 'pig', 'sheep', 'horse'];
  function cdTrough(cx, cy, i, kind) {
    const g = s('g', { class: 'plant farm', transform: 'translate(' + cx + ' ' + (cy + 0.9) + ') scale(0.82)' });
    g.style.setProperty('--hop', ((i % 6) * 70) + 'ms');
    g.style.setProperty('--sw', (-((i * 0.53) % 3.6)).toFixed(2) + 's');
    g.innerHTML = '<ellipse class="ground" cx="0.3" cy="3.2" rx="3.9" ry="0.6"/>'
      + '<rect x="-3.5" y="-0.45" width="7" height="1.1" rx="0.45" fill="#5B3518"/>'
      + '<rect class="trough-water" x="-3.2" y="-0.32" width="6.4" height="0.85" rx="0.38"/>'
      + '<g class="beast"><g class="sip">' + CD_BEASTS[kind] + '</g></g>'
      + '<g class="hopper"><rect x="-3.6" y="0.2" width="7.2" height="2.55" rx="0.45" fill="#A9703C"/>'
      + '<path d="M-3.6 1.05H3.6M-3.6 1.9H3.6" stroke="#8A5A2E" stroke-width="0.18"/>'
      + '<rect x="-3.6" y="0.2" width="7.2" height="0.45" rx="0.22" fill="#C48A50"/>'
      + '<circle cx="-2.9" cy="1.5" r="0.14" fill="#5B3518"/><circle cx="2.9" cy="1.5" r="0.14" fill="#5B3518"/>'
      + '<rect x="-3.2" y="2.7" width="0.75" height="0.7" fill="#7A4A24"/><rect x="2.45" y="2.7" width="0.75" height="0.7" fill="#7A4A24"/></g>';
    return g;
  }
  // the Japanese garden: a pond in a ring of stones; when it fills a koi swims and a lily opens
  function cdPond(cx, cy, i) {
    const g = s('g', { class: 'plant japan', transform: 'translate(' + cx + ' ' + (cy + 0.2) + ') scale(0.9)' });
    g.style.setProperty('--hop', ((i % 6) * 70) + 'ms');
    g.style.setProperty('--sw', (-((i * 1.37) % 7)).toFixed(2) + 's');
    const r = cdRnd(i * 11 + 1);
    let stones = '';
    for (let k = 0; k < 11; k++) { const a = (k * Math.PI * 2) / 11 + r() * 0.25; stones += '<ellipse cx="' + (Math.cos(a) * 3.75).toFixed(2) + '" cy="' + (0.2 + Math.sin(a) * 2.75).toFixed(2) + '" rx="' + (0.95 + r() * 0.35).toFixed(2) + '" ry="' + (0.7 + r() * 0.2).toFixed(2) + '" fill="' + ['#8E918B', '#A3A69F', '#7D807A'][k % 3] + '"/>'; }
    const koi = ['#FF7A2E', '#F04A3A', '#FFB02E'][i % 3];
    g.innerHTML = '<ellipse class="ground" cx="0.3" cy="0.75" rx="4.4" ry="3.3"/>'
      + '<ellipse cx="0" cy="0.2" rx="3.6" ry="2.6" fill="#B9AE92"/><ellipse cx="0.4" cy="0.5" rx="2.6" ry="1.6" fill="#A99E82"/>'
      + '<g class="pool"><ellipse class="pool-water" cx="0" cy="0.2" rx="3.6" ry="2.6"/><ellipse cx="-1.2" cy="-0.9" rx="1.2" ry="0.32" fill="#FFFFFF" opacity=".4"/></g>'
      + '<g class="koi-ring" transform="translate(0 0.2) scale(1 0.68)"><g class="swim"><g transform="translate(0 -1.9)">'
      + '<path d="M-1.35 0L-2.1 -0.55L-1.95 0L-2.1 0.55Z" fill="' + koi + '"/><ellipse cx="0" cy="0" rx="1.25" ry="0.5" fill="' + koi + '"/>'
      + '<ellipse cx="0.2" cy="-0.05" rx="0.5" ry="0.3" fill="#FFF4E8"/><circle cx="0.95" cy="-0.15" r="0.1" fill="#2A1A10"/></g></g></g>'
      + '<g class="lily"><path d="M1.7 1L2.18 0.43A0.95 0.66 0 1 1 1.54 0.35Z" fill="#4E9A4A"/><circle cx="1.45" cy="1.05" r="0.36" fill="#FF9EC0"/><circle cx="1.45" cy="1.05" r="0.14" fill="#FFE27A"/></g>'
      + '<g class="hopper">' + stones + '</g>';
    return g;
  }
  // the oasis: a palm on a little dune; dry, its fronds hang brown, and with water they lift green
  function cdPalm(cx, cy, i) {
    const g = s('g', { class: 'plant oasis', transform: 'translate(' + cx + ' ' + (cy + 1.4) + ') scale(0.82)' });
    g.style.setProperty('--hop', ((i % 6) * 70) + 'ms');
    g.style.setProperty('--sw', (-((i * 0.53) % 3.6)).toFixed(2) + 's');
    const lean = i % 2 ? 1 : -1;
    // the fronds arch out to both sides; on the left they are drawn mirrored so they hang down too
    let fronds = '';
    for (const a of [-178, -145, -112, -68, -35, -2]) {
      const left = a < -90;
      fronds += '<g class="frond" style="--a:' + a + 'deg;--dr:' + (left ? -34 : 34) + 'deg;--fy:' + (left ? -1 : 1) + '"><path d="M0 0C1.3 -0.75 2.7 -0.6 3.8 0.35C2.6 0 1.3 0.05 0 0Z"/><path class="mid" d="M0.2 -0.02C1.4 -0.4 2.6 -0.3 3.6 0.28"/></g>';
    }
    g.innerHTML = '<ellipse class="ground" cx="0.3" cy="2.75" rx="3.6" ry="0.65"/>'
      + '<ellipse cx="0" cy="2.4" rx="3.3" ry="1.05" fill="#E3BF7E"/>'
      + '<ellipse class="pool-water" cx="-0.2" cy="2.55" rx="2.5" ry="0.6"/>'
      + '<g class="hopper"><g class="sway">'
      + '<path d="M-0.4 2.4C-0.3 0.6 ' + (0.1 * lean) + ' -1.4 ' + (0.75 * lean) + ' -3.4L' + (1.35 * lean) + ' -3.25C' + (0.85 * lean) + ' -1.4 ' + (0.6 * lean) + ' 0.6 0.55 2.4Z" fill="#A8743F"/>'
      + '<path d="M-0.3 1.4h0.85M-0.15 0.3h0.85M' + (0.1 * lean - 0.1) + ' -0.8h0.8M' + (0.4 * lean - 0.1) + ' -1.9h0.75" stroke="#7E5228" stroke-width="0.2" stroke-linecap="round"/>'
      + '<g transform="translate(' + (1.05 * lean) + ' -3.45)">' + fronds
      + '<g class="nuts"><circle cx="-0.3" cy="0.45" r="0.42"/><circle cx="0.35" cy="0.5" r="0.42"/><circle cx="0.05" cy="0.85" r="0.4"/></g></g>'
      + '</g></g>';
    return g;
  }
  // the palace garden: a two-tier marble fountain with gold trim; with water it plays and lights up
  function cdFountain(cx, cy, i) {
    const g = s('g', { class: 'plant palace', transform: 'translate(' + cx + ' ' + (cy + 0.6) + ') scale(0.84)' });
    g.style.setProperty('--hop', ((i % 6) * 70) + 'ms');
    g.style.setProperty('--sw', (-((i * 0.37) % 1.4)).toFixed(2) + 's');
    g.innerHTML = '<circle class="glow" cx="0" cy="-0.6" r="4.7"/><circle class="glow g2" cx="0" cy="-0.4" r="3.2"/>'
      + '<ellipse class="ground" cx="0.3" cy="3.25" rx="3.8" ry="0.6"/>'
      + '<g class="hopper">'
      // the lower basin: its rim, the water in it and its front
      + '<ellipse cx="0" cy="1.7" rx="3.8" ry="1.15" fill="#ECE9F2"/>'
      + '<ellipse cx="0" cy="1.68" rx="3.2" ry="0.82" fill="#262A38"/><ellipse class="pool-water" cx="0" cy="1.68" rx="3.2" ry="0.82"/>'
      + '<path d="M-3.8 1.7a3.8 1.15 0 0 0 7.6 0v0.85a3.8 1.3 0 0 1 -7.6 0z" fill="#CFCADB"/>'
      + '<path d="M-3.8 2.15a3.8 1.2 0 0 0 7.6 0" fill="none" stroke="#E2B552" stroke-width="0.26"/>'
      // the column and the upper bowl, the finial on top
      + '<path d="M-0.5 1.7V-1.3h1V1.7z" fill="#D9D5E3"/><path d="M-0.5 -0.2h1" stroke="#E2B552" stroke-width="0.26"/>'
      + '<path d="M-1.9 -1.45Q0 0.35 1.9 -1.45Z" fill="#E4E0EC"/>'
      + '<ellipse cx="0" cy="-1.45" rx="1.9" ry="0.5" fill="#F2F0F6"/><ellipse cx="0" cy="-1.45" rx="1.5" ry="0.33" fill="#262A38"/><ellipse class="pool-water" cx="0" cy="-1.45" rx="1.5" ry="0.33"/>'
      + '<ellipse cx="0" cy="-1.45" rx="1.9" ry="0.5" fill="none" stroke="#E2B552" stroke-width="0.22"/>'
      + '<path d="M-0.22 -1.5V-2.2h0.44V-1.5z" fill="#E2B552"/><circle cx="0" cy="-2.45" r="0.36" fill="#E2B552"/>'
      // the water: a jet from the top, falling to the bowl, and curtains from the bowl to the basin
      + '<g class="jets"><path class="jet" d="M0 -2.6C0 -3.6 0 -4.3 0 -4.6"/><path class="jet" d="M0 -4.3C-0.7 -4.8 -1.4 -3.6 -1.55 -1.7"/><path class="jet" d="M0 -4.3C0.7 -4.8 1.4 -3.6 1.55 -1.7"/>'
      + '<path class="jet" d="M-1.8 -1.3C-2.2 -0.6 -2.5 0.4 -2.6 1.45"/><path class="jet" d="M1.8 -1.3C2.2 -0.6 2.5 0.4 2.6 1.45"/>'
      + '<circle class="drop" cx="-2.65" cy="1.4" r="0.2"/><circle class="drop" cx="2.65" cy="1.4" r="0.2"/></g>'
      + '</g>';
    return g;
  }
  class ConduitCard extends Card {
    hasHistory() { return this.run.hist.length > 0; }
    // flies in from the top right and settles on the highest flower
    flyButterfly() {
      // at night in the palace garden the fountains are the end of it
      if (this.bfly || reducedMotion() || this.kit === 'palace') return;
      const p = this.p;
      let best = null;
      for (const k in this.plants) {
        const i = +k, x = i % p.w, y = (i / p.w) | 0;
        if (!best || y < best[1] || (y === best[1] && x > best[0])) best = [x, y];
      }
      if (!best) return;
      // on the flower, the animal's head, the pond's stones or the palm's crown
      const lift = { garden: 3.65 * 0.78 + 0.7, farm: 4.6, japan: 2.4, oasis: 4.2 }[this.kit] || 3.5;
      const tx = best[0] * 10 + 5.3, ty = best[1] * 10 + 5.5 - lift;
      const sx = p.w * 10 + 7, sy = -9;
      const bf = cdButterfly();
      this.svg.append(bf);
      this.bfly = bf;
      const pts = [[sx, sy, -24], [sx + (tx - sx) * 0.3, sy + (ty - sy) * 0.42 - 2.4, -8], [sx + (tx - sx) * 0.62, sy + (ty - sy) * 0.62 + 1.6, -20], [tx + 2.4, ty - 3.4, 10], [tx, ty, 0]];
      const a = bf.animate(pts.map((q) => ({ transform: 'translate(' + q[0].toFixed(2) + 'px, ' + q[1].toFixed(2) + 'px) rotate(' + q[2] + 'deg) scale(0.7)' })), { duration: 1800, easing: 'cubic-bezier(.35,.1,.3,1)', fill: 'forwards' });
      a.onfinish = () => bf.classList.add('perched');
    }
    buildBoard() {
      const p = this.p, U = 10, pad = 1.4;
      // the place: its pipes, beds, source and what the water reaches
      this.kit = CD_KITS[this.lookLv] || 'garden';
      const kit = this.kit, endName = { garden: 'Plant', farm: 'Trough', japan: 'Pond', oasis: 'Palm', palace: 'Fountain' }[kit];
      const svgEl = s('svg', { class: 'board conduit', 'data-kit': kit, viewBox: [-pad, -pad, p.w * U + pad * 2, p.h * U + pad * 2].join(' '), role: 'group', 'aria-label': 'Garden, ' + p.w + ' by ' + p.h + ' tiles' });
      svgEl.append(s('rect', { class: 'soil', x: -pad, y: -pad, width: p.w * U + pad * 2, height: p.h * U + pad * 2, rx: 4.5 }));
      const layer = (cls) => { const g = s('g', { class: cls }); svgEl.append(g); return g; };
      const beds = layer('beds');
      this.puddles = layer('puddles');
      const shadows = layer('shadows');
      this.joints = layer('joints');
      const pipes = layer('pipes'), things = layer('things');
      this.bridges = new Map();
      this.leaks = layer('leaks');
      const hits = layer('hits');
      this.angle = this.run.rot.map((r) => r * 90);
      this.cells = []; this.tiles = []; this.shades = []; this.arms = []; this.hubs = []; this.plants = {};
      this.plantCount = 0;
      this.leakEls = new Map();
      let flower = (p.seed >>> 0) % CD_FLOWERS.length;
      for (let i = 0; i < p.w * p.h; i++) {
        const x = i % p.w, y = (i / p.w) | 0;
        const cx = x * U + U / 2, cy = y * U + U / 2;
        const m = p.sol[i];
        let deg = 0;
        for (const sd of [1, 2, 4, 8]) if (m & sd) deg++;
        const isPlant = deg === 1 && i !== p.src;
        beds.append(s('rect', { class: 'bed', x: x * U + 0.45, y: y * U + 0.45, width: U - 0.9, height: U - 0.9, rx: 2.2 }),
          s('rect', { class: 'bed-shade', x: x * U + 0.45, y: y * U + 8.3, width: U - 0.9, height: 1.25, rx: 0.6 }));
        const deco = cdBedDecor(kit, x, y, i);
        if (deco) beds.append(deco);
        if (!isPlant && i !== p.src) { const t = cdTuftFor(kit, i * 31 + (p.seed >>> 0), cx, cy); if (t) beds.append(t); }
        // a pipe: its shadow on the bed, the cream pipe, the water that fills it,
        // a light line down the middle, and glints that run with the water
        const shade = s('g', { class: 'tshade' }), tile = s('g', { class: 'tile' });
        shade.style.transformOrigin = tile.style.transformOrigin = cx + 'px ' + cy + 'px';
        const line = (cls, sd, b) => s('line', { class: cls, x1: cx, y1: cy, x2: cx + SIDEV[sd][0] * b, y2: cy + SIDEV[sd][1] * b });
        const collar = (cls, sd) => {
          const [vx, vy] = SIDEV[sd], w = vx ? CD_COL_L : CD_COL_W, hh = vx ? CD_COL_W : CD_COL_L;
          return s('rect', { class: cls, x: cx + vx * CD_COL_AT - w / 2, y: cy + vy * CD_COL_AT - hh / 2, width: w, height: hh, rx: 0.42 });
        };
        const arms = [];
        for (const sd of [1, 2, 4, 8]) {
          if (!(m & sd)) continue;
          shade.append(line(null, sd, CD_ARM), collar(null, sd));
          arms.push({ side: sd, pipe: line('case', sd, CD_ARM), water: line('water', sd, CD_ARM), core: line('core', sd, CD_ARM - 0.5), flow: line('flow', sd, CD_ARM), collar: collar('collar', sd) });
        }
        for (const k of ['pipe', 'water', 'core', 'flow', 'collar']) arms.forEach((a) => tile.append(a[k]));
        let hub = null;
        if (deg >= 2) {
          shade.append(s('circle', { cx, cy, r: 1.95 }));
          hub = s('circle', { class: 'whub', cx, cy, r: 1.95 });
          tile.append(s('circle', { class: 'hub', cx, cy, r: 1.95 }), hub);
        }
        shadows.append(shade);
        pipes.append(tile);
        if (i === p.src) things.append(cdSource(kit, cx, cy));
        if (isPlant) {
          const fl = CD_LEVEL_FLOWERS[this.lookLv] || CD_LEVEL_FLOWERS[1], k = flower++;
          const plant = kit === 'farm' ? cdTrough(cx, cy, i, CD_BEAST_ORDER[k % CD_BEAST_ORDER.length]) : kit === 'japan' ? cdPond(cx, cy, i)
            : kit === 'oasis' ? cdPalm(cx, cy, i) : kit === 'palace' ? cdFountain(cx, cy, i) : this.drawPlant(cx, cy, fl[k % fl.length], i);
          things.append(plant);
          this.plants[i] = plant;
          this.plantCount++;
        }
        const cell = s('g', { class: 'cell', tabindex: '0', role: 'button', 'aria-label': (i === p.src ? 'Water source' : isPlant ? endName : 'Pipe') + ', row ' + (y + 1) + ', column ' + (x + 1) });
        cell.append(s('rect', { class: 'hit', x: x * U, y: y * U, width: U, height: U }),
          s('rect', { class: 'ring', x: x * U + 0.45, y: y * U + 0.45, width: U - 0.9, height: U - 0.9, rx: 2.2 }));
        cell.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); this.press(i); });
        cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.press(i); } });
        hits.append(cell);
        this.cells.push(cell);
        this.tiles.push(tile);
        this.shades.push(shade);
        this.arms.push(arms);
        this.hubs.push(hub);
      }
      this.svg = svgEl;
      this.wetSet = new Set();
      this.area.append(svgEl);
    }
    // a terracotta pot with a little soil; two leaves that fold up while dry and open
    // when the water comes; then the flower pops out on its stem and sways a little
    drawPlant(cx, cy, kind, i) {
      const F = CD_FLOWERS[kind];
      const g = s('g', { class: 'plant', transform: 'translate(' + cx + ' ' + (cy + 0.5) + ') scale(0.78)' });
      g.style.setProperty('--sw', (-((i * 0.53) % 3.6)).toFixed(2) + 's');
      g.style.setProperty('--hop', ((i % 6) * 70) + 'ms');
      const leaf = (k) => s('g', { class: 'leaf ' + (k < 0 ? 'l' : 'r') },
        s('path', { class: 'blade', d: 'M' + 0.2 * k + ' -0.9C' + 3.2 * k + ' -1.3 ' + 3.8 * k + ' -3.4 ' + 3.6 * k + ' -4.3C' + 1.5 * k + ' -4.2 ' + 0.4 * k + ' -2.7 ' + 0.2 * k + ' -0.9Z' }),
        s('path', { class: 'rib', d: 'M' + 0.55 * k + ' -1.4Q' + 2.25 * k + ' -2.75 ' + 3.2 * k + ' -3.95' }),
        (i + (k < 0 ? 0 : 1)) % 2 ? s('circle', { class: 'dew', cx: 2.4 * k, cy: -2.45, r: 0.34 }) : s('circle', { class: 'dew', cx: 2.95 * k, cy: -3.75, r: 0.24 }));
      const by = -3.65;
      const bloom = s('g', { class: 'bloom' });
      const dir = (k) => { const a = (Math.PI * 2 * k) / F.n - Math.PI / 2; return [Math.cos(a), Math.sin(a), (360 * k) / F.n]; };
      if (!F.daisy) bloom.append(s('circle', { cx: 0, cy: by, r: F.at + 0.15, fill: F.deep }));
      for (let k = 0; k < F.n; k++) {
        const [dx, dy, deg] = dir(k);
        if (F.daisy) bloom.append(s('ellipse', { cx: 0, cy: by - F.at, rx: F.r, ry: 1.02, fill: k % 2 ? F.deep : F.petal, transform: 'rotate(' + deg + ' 0 ' + by + ')' }));
        else bloom.append(s('circle', { cx: dx * F.at, cy: by + dy * F.at, r: F.r, fill: F.petal }));
      }
      if (!F.daisy) bloom.append(s('circle', { cx: 0, cy: by, r: 0.98, fill: F.deep }));
      bloom.append(s('circle', { cx: 0, cy: by, r: F.daisy ? 0.82 : 0.74, fill: F.eye }),
        s('circle', { cx: -0.25, cy: by - 0.08, r: 0.12, fill: F.seed }),
        s('circle', { cx: 0.19, cy: by - 0.24, r: 0.12, fill: F.seed }),
        s('circle', { cx: 0.07, cy: by + 0.25, r: 0.12, fill: F.seed }));
      const sparks = s('g', { class: 'sparks' });
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI * 2 * k) / 6 + 0.35;
        const sp = s('circle', { class: 'spark', cx: 0, cy: by, r: 0.34, fill: k % 2 ? F.eye : F.daisy ? '#FFFFFF' : F.petal });
        sp.style.setProperty('--sx', (Math.cos(a) * 3.3).toFixed(2) + 'px');
        sp.style.setProperty('--sy', (Math.sin(a) * 3.3).toFixed(2) + 'px');
        sparks.append(sp);
      }
      g.append(s('ellipse', { class: 'ground', cx: 0.3, cy: 3.15, rx: 2.15, ry: 0.5 }),
        s('g', { class: 'hopper' },
          leaf(-1), leaf(1),
          s('g', { class: 'sway' }, s('path', { class: 'stem', d: 'M0 -0.9V' + (by + 0.9) }), bloom),
          s('path', { class: 'pot', d: 'M-2.3 -0.3h4.6l-0.65 3.4h-3.3z' }),
          (i * 5 + kind) % 3 === 1 ? s('path', { class: 'pot-paint', d: 'M-2.02 1.15H2.02L1.95 1.52H-1.95Z' }) : null,
          s('path', { class: 'pot-side', d: 'M1.05 -0.3H2.3L1.65 3.1H0.62Z' }),
          s('path', { class: 'pot-band', d: 'M-2.3 0.1H2.3L2.22 0.52H-2.22Z' }),
          s('rect', { class: 'rim', x: -2.65, y: -0.95, width: 5.3, height: 1.05, rx: 0.45 }),
          s('rect', { class: 'rim-top', x: -2.5, y: -0.95, width: 5.0, height: 0.32, rx: 0.16 }),
          s('ellipse', { class: 'soil-top', cx: 0, cy: -0.93, rx: 2.0, ry: 0.27 }),
          sparks));
      return g;
    }
    setAngle(i, instant) {
      const t = this.tiles[i], sh = this.shades[i];
      if (instant) t.style.transition = sh.style.transition = 'none';
      t.style.transform = 'rotate(' + this.angle[i] + 'deg)';
      sh.style.transform = 'translate(0px, 0.55px) rotate(' + this.angle[i] + 'deg)';
      if (instant) { void t.getBoundingClientRect(); t.style.transition = sh.style.transition = ''; }
    }
    // water: runs from the source tile by tile, in through the arm it comes from and
    // out of the others, opens the plants it reaches, and drips from open ends
    update(instant) {
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
      let minNew = Infinity, maxNew = -1;
      for (let i = 0; i < n; i++) if (depth[i] >= 0 && !this.wetSet.has(i)) { minNew = Math.min(minNew, depth[i]); maxNew = Math.max(maxNew, depth[i]); }
      const still = !!instant || reducedMotion();
      // T: the water's time through half a tile (a long run goes a little faster);
      // it sets off once the turned pipe has nearly settled
      const T = still || maxNew < 0 ? 0 : Math.max(26, Math.min(62, Math.round(760 / (maxNew - minNew + 1) / 2)));
      const lead = T ? 170 : 0;
      const reach = new Float64Array(n);
      let newlyWet = 0, last = 0, wateredCount = 0;
      const watered = [];
      for (let i = 0; i < n; i++) {
        const wet = depth[i] >= 0, fresh = wet && !this.wetSet.has(i);
        const at = fresh ? lead + (depth[i] - minNew) * 2 * T : 0;
        reach[i] = at + 2 * T * (fresh ? 1 : 0);
        const tile = this.tiles[i];
        tile.style.setProperty('--d', (fresh ? at + 2 * T : 0) + 'ms');
        tile.classList.toggle('wet', wet);
        const r = this.run.rot[i];
        for (const arm of this.arms[i]) {
          const isIn = wet && i !== p.src && E.internals.rotCW(arm.side, r) === parent[i];
          arm.flow.classList.toggle('in', isIn);
          if (fresh && T) {
            arm.water.getAnimations().forEach((a) => a.cancel());
            arm.water.animate([{ strokeDashoffset: (isIn ? -4.4 : 4.4) + 'px' }, { strokeDashoffset: '0px' }], { duration: T, delay: at + (isIn ? 0 : T), easing: 'linear', fill: 'backwards' });
          }
        }
        const hub = this.hubs[i];
        if (hub && fresh && T) {
          hub.getAnimations().forEach((a) => a.cancel());
          hub.animate([{ transform: 'scale(0.4)' }, { transform: 'scale(1)' }], { duration: Math.round(T * 0.6), delay: Math.round(at + T * 0.75), easing: 'ease-out', fill: 'backwards' });
          hub.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1, delay: Math.round(at + T * 0.75), fill: 'backwards' });
        }
        const plant = this.plants[i];
        if (plant) {
          plant.style.setProperty('--d', (fresh ? at + T : 0) + 'ms');
          plant.classList.toggle('wet', wet);
          if (wet) wateredCount++;
          if (fresh) {
            watered.push(at + T);
            if (!still) {
              plant.classList.remove('burst');
              void plant.getBBox();
              plant.classList.add('burst');
              this.later(() => plant.classList.remove('burst'), at + T + 1200);
            }
          }
        }
        if (fresh) { newlyWet++; last = Math.max(last, at + 2 * T); }
        if (wet) this.wetSet.add(i); else this.wetSet.delete(i);
      }
      this.flowEnd = now() + last;
      // couplings: where two pipe ends meet across the gap between tiles. A new one snaps
      // in as the turned tile settles; one that no longer meets goes at once
      const live = new Set();
      for (let i = 0; i < n; i++) {
        const m = mask(i), x = i % p.w, y = (i / p.w) | 0;
        for (const sd of [2, 4]) {
          const nx = x + SIDEV[sd][0], ny = y + SIDEV[sd][1];
          if (!(m & sd) || nx >= p.w || ny >= p.h) continue;
          const j = ny * p.w + nx;
          if (!(mask(j) & OPP[sd])) continue;
          const key = i * 4 + (sd === 2 ? 0 : 1);
          live.add(key);
          let b = this.bridges.get(key);
          if (!b) {
            const vx = SIDEV[sd][0], ex = x * 10 + 5 + vx * 5, ey = y * 10 + 5 + SIDEV[sd][1] * 5;
            const w = vx ? CD_BRIDGE : 3.5, hh = vx ? 3.5 : CD_BRIDGE;
            b = s('rect', { class: 'bridge' + (still ? '' : ' snap'), x: ex - w / 2, y: ey - hh / 2, width: w, height: hh });
            this.joints.append(b);
            this.bridges.set(key, b);
          }
          const wet = depth[i] >= 0 && depth[j] >= 0;
          b.style.setProperty('--d', (wet && !b.classList.contains('wet') ? Math.max(0, Math.min(reach[i], reach[j]) - T) : 0) + 'ms');
          b.classList.toggle('wet', wet);
        }
      }
      for (const [key, b] of this.bridges) if (!live.has(key)) { b.remove(); this.bridges.delete(key); }
      // leaks: a wet pipe end that opens onto nothing drips, and a puddle spreads
      const keep = new Set();
      for (let i = 0; i < n; i++) {
        if (depth[i] < 0) continue;
        const m = mask(i), x = i % p.w, y = (i / p.w) | 0;
        for (const sd of [1, 2, 4, 8]) {
          if (!(m & sd)) continue;
          const nx = x + SIDEV[sd][0], ny = y + SIDEV[sd][1];
          if (!(nx < 0 || ny < 0 || nx >= p.w || ny >= p.h || !(mask(ny * p.w + nx) & OPP[sd]))) continue;
          const key = i * 16 + sd;
          keep.add(key);
          if (this.leakEls.has(key)) continue;
          const vx = SIDEV[sd][0], vy = SIDEV[sd][1];
          const ex = x * 10 + 5 + vx * 4.6, ey = y * 10 + 5 + vy * 4.6;
          const px = Math.max(-0.6, Math.min(p.w * 10 + 0.6, ex + vx * 2.6)), py = Math.max(-0.4, Math.min(p.h * 10 + 0.2, ey + vy * 2.6 + 1.7));
          const ld = (still ? 0 : reach[i]) + 'ms';
          const pud = s('g', { class: 'puddle' }, s('ellipse', { cx: px, cy: py, rx: 1.5, ry: 0.6 }), s('ellipse', { class: 'glint', cx: px - 0.45, cy: py - 0.2, rx: 0.48, ry: 0.13 }));
          const drops = s('g', { class: 'drops' });
          pud.style.setProperty('--ld', ld);
          drops.style.setProperty('--ld', ld);
          for (let k = 0; k < 3; k++) {
            const dot = s('circle', { class: 'drip', cx: ex, cy: ey, r: 0.62 });
            dot.style.setProperty('--dx', (vx * 2.4 + (k - 1) * 0.8) + 'px');
            dot.style.setProperty('--dy', (vy * 2.4 + 1.5 + k * 0.35) + 'px');
            drops.append(dot);
          }
          this.puddles.append(pud);
          this.leaks.append(drops);
          this.leakEls.set(key, [pud, drops]);
        }
      }
      for (const [key, els] of this.leakEls) if (!keep.has(key)) { els.forEach((e) => e.remove()); this.leakEls.delete(key); }
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
      this.update(!animated);
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
      ch.watered.forEach((at, idx) => this.later(() => Sound.play('bloom', idx), at + 150));
      if ((this.watered || 0) !== before) { this.goalEl.classList.remove('bump'); void this.goalEl.offsetWidth; this.goalEl.classList.add('bump'); }
      if (this.o.feedback && !this.practice) this.flash(i, rec.cls);
      this.commit(rec);
    }
    // the garden celebrates once the water has reached the last flower
    celebrate(sm) {
      const wait = sm.outcome === 'solved' ? Math.max(0, Math.round((this.flowEnd || 0) - now()) + 120) : 0;
      if (wait < 160) return super.celebrate(sm);
      this.later(() => super.celebrate(sm), wait);
      return wait + 650;
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
    onResolved(outcome) {
      if (outcome !== 'solved') return;
      const wait = Math.max(0, Math.round((this.flowEnd || 0) - now()));
      this.later(() => { this.svg.classList.add('solved'); this.flyButterfly(); }, wait);
    }
  }

  // ------------------------------------------------------------- Tumbler
  // Each lock is the board, with pieces of its own (by the look's level): the rings of a bike
  // lock, magnets on a locker door, the keys of a front door's keypad, the lamps of a safe, the
  // gems of a vault. Every color keeps its shape at every level: printed on a ring, a key or a
  // lamp, and the magnet and the gem are the shape itself.
  const TB_KITS = ['ring', 'ring', 'magnet', 'key', 'lamp', 'jewel'];
  const tbStar = (cx, cy, R, r) => { let d = ''; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, q = k % 2 ? r : R; d += (k ? 'L' : 'M') + (cx + Math.cos(a) * q).toFixed(2) + ' ' + (cy + Math.sin(a) * q).toFixed(2); } return d + 'Z'; };
  // the shapes, big, in a 40 x 40 box, as corner points (the circle is drawn as a circle)
  const TB_POLY = [
    null,
    [[6, 6], [34, 6], [34, 34], [6, 34]],
    [[20, 4], [36.5, 33.5], [3.5, 33.5]],
    [[20, 2.5], [37.5, 20], [20, 37.5], [2.5, 20]],
    [[14.5, 3.5], [25.5, 3.5], [25.5, 14.5], [36.5, 14.5], [36.5, 25.5], [25.5, 25.5], [25.5, 36.5], [14.5, 36.5], [14.5, 25.5], [3.5, 25.5], [3.5, 14.5], [14.5, 14.5]],
    tbStar(20, 21.2, 18, 7.8).slice(1, -1).split('L').map((p) => p.split(' ').map(Number)),
    [[3, 13], [37, 13], [37, 27], [3, 27]],
  ];
  const tbPath = (pts) => 'M' + pts.map((p) => p[0] + ' ' + p[1]).join('L') + 'Z';
  const tbShape = (c) => (c === 0 ? 'M20 4.5a15.5 15.5 0 1 1 0 31a15.5 15.5 0 1 1 0-31z' : tbPath(TB_POLY[c]));
  // the color's mark printed on a piece, centred at (x, y)
  const tbGlyph = (c, x, y, k, fill, op) => '<path d="' + PEGS[c].glyph + '" transform="translate(' + x + ' ' + y + ') scale(' + k + ') translate(-8 -8)" fill="' + fill + '"' + (op ? ' opacity="' + op + '"' : '') + '/>';
  const tbAsk = (x, y, fill) => '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-family="Lexend, system-ui, sans-serif" font-size="17" font-weight="700" fill="' + fill + '">?</text>';
  // gradients for one card's pieces, kept in the card so two cards on screen never share ids
  function tbDefs(u) {
    const el = s('svg', { class: 'tb-defs', width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false' });
    el.innerHTML = '<defs>'
      + '<linearGradient id="' + u + 'cyl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".2" stop-color="#000" stop-opacity=".08"/><stop offset=".42" stop-color="#fff" stop-opacity=".42"/><stop offset=".56" stop-color="#fff" stop-opacity=".1"/><stop offset=".82" stop-color="#000" stop-opacity=".14"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>'
      + '<linearGradient id="' + u + 'mag" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>'
      + '<linearGradient id="' + u + 'brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF0B8"/><stop offset=".35" stop-color="#E2B552"/><stop offset=".7" stop-color="#B78424"/><stop offset="1" stop-color="#8C5E14"/></linearGradient>'
      + '<linearGradient id="' + u + 'glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".38" stop-color="#fff" stop-opacity=".06"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>'
      + '<linearGradient id="' + u + 'steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".3" stop-color="#C3C9D3"/><stop offset=".55" stop-color="#7D8594"/><stop offset=".8" stop-color="#B9C0CB"/><stop offset="1" stop-color="#5E6676"/></linearGradient>'
      + '<radialGradient id="' + u + 'lens" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".28" stop-color="#fff" stop-opacity=".25"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>'
      + '<linearGradient id="' + u + 'gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient>'
      + '<linearGradient id="' + u + 'gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF3C2"/><stop offset=".4" stop-color="#E9BE55"/><stop offset=".75" stop-color="#B8862A"/><stop offset="1" stop-color="#8A6014"/></linearGradient>'
      + '</defs>';
    return el;
  }
  // one piece (c a color) or an empty place (c null; ask: show a question mark), as an svg
  function tbPiece(kit, c, u, ask) {
    const g = (id) => 'url(#' + u + id + ')';
    let v = '', box = '0 0 40 40';
    const col = c != null ? PEGS[c].fill : null, ink = c != null ? PEGS[c].ink : null;
    if (kit === 'ring') {
      // a ring of a bike lock: a short drum, its edge ridged, the mark printed on it
      box = '0 0 28 40';
      let ridges = '';
      for (let y = 5; y < 36; y += 3.5) ridges += 'M1 ' + y + 'h2.6M24.4 ' + y + 'h2.6';
      v = '<rect class="edge" x="1" y="1" width="26" height="38" rx="5" fill="' + (col || '#AEB4C2') + '"/>'
        + '<rect x="1" y="1" width="26" height="38" rx="5" fill="' + g('cyl') + '"/>'
        + '<path d="' + ridges + '" stroke="#000" stroke-opacity=".32" stroke-width="1.1"/>'
        + (c != null ? tbGlyph(c, 14, 20, 1.12, ink) : ask ? tbAsk(14, 26, 'rgba(28,32,42,.6)') : '');
    } else if (kit === 'magnet') {
      // a magnet on the locker door: the shape itself, a little thick, with its shadow
      if (c == null) v = '<circle class="edge" cx="20" cy="20" r="14.5" fill="#fff" fill-opacity=".1" stroke="#fff" stroke-opacity=".6" stroke-width="1.6" stroke-dasharray="3.2 3"/>' + (ask ? tbAsk(20, 26, 'rgba(255,255,255,.7)') : '');
      else {
        const d = tbShape(c);
        v = '<path d="' + d + '" transform="translate(1.4 2.4)" fill="#000" fill-opacity=".3" stroke="#000" stroke-opacity=".3" stroke-width="3" stroke-linejoin="round"/>'
          + '<path class="edge" d="' + d + '" fill="' + col + '" stroke="' + col + '" stroke-width="3" stroke-linejoin="round"/>'
          + '<path d="' + d + '" fill="' + g('mag') + '"/>';
      }
    } else if (kit === 'key') {
      // a key of the door's keypad: colored glass in a brass rim, the mark lit in it
      v = '<rect class="edge" x="2" y="2" width="36" height="36" rx="9" fill="' + g('brass') + '"/>'
        + '<rect x="2.5" y="2.5" width="35" height="35" rx="8.5" fill="none" stroke="#5A3A0A" stroke-opacity=".45"/>'
        + '<rect x="6" y="6" width="28" height="28" rx="6" fill="' + (col || '#2A1D12') + '"/>'
        + '<rect x="6" y="6" width="28" height="28" rx="6" fill="' + g('glass') + '"/>'
        + (c != null ? tbGlyph(c, 20, 20, 1.25, ink) : ask ? tbAsk(20, 26, 'rgba(255,226,170,.55)') : '');
    } else if (kit === 'lamp') {
      // a lamp of the safe: a steel bezel round a lit glass dome
      v = '<circle class="edge" cx="20" cy="20" r="18.5" fill="' + g('steel') + '"/>'
        + '<circle cx="20" cy="20" r="18" fill="none" stroke="#000" stroke-opacity=".3"/>'
        + '<circle cx="20" cy="20" r="13.5" fill="' + (col || '#262B33') + '"/>'
        + '<circle cx="20" cy="20" r="13.5" fill="' + g('lens') + '"' + (c == null ? ' opacity=".45"' : '') + '/>'
        + (c != null ? tbGlyph(c, 20, 20.5, 1.02, ink, 0.9) : ask ? tbAsk(20, 26, 'rgba(255,255,255,.45)') : '');
    } else {
      // a gem of the vault, cut to the color's shape; an empty place is a gold setting
      if (c == null) {
        let prongs = '';
        for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; prongs += '<circle cx="' + (20 + Math.cos(a) * 13.5).toFixed(2) + '" cy="' + (20 + Math.sin(a) * 13.5).toFixed(2) + '" r="2.7" fill="' + g('gold') + '"/>'; }
        v = '<circle cx="20" cy="20" r="13.5" fill="#000" fill-opacity=".45"/><circle class="edge" cx="20" cy="20" r="13.5" fill="none" stroke="' + g('gold') + '" stroke-width="3"/>' + prongs + (ask ? tbAsk(20, 26, 'rgba(255,226,150,.65)') : '');
      } else {
        const d = tbShape(c);
        // the table (the flat top) and the lines from it to the outline
        let pts = TB_POLY[c];
        if (!pts) pts = Array.from({ length: 8 }, (_, k) => { const a = (k * Math.PI) / 4 - Math.PI / 8; return [20 + Math.cos(a) * 15.5, 20 + Math.sin(a) * 15.5]; });
        const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        const inner = pts.map((p) => [cx + (p[0] - cx) * 0.52, cy + (p[1] - cy) * 0.52]);
        v = '<path class="edge" d="' + d + '" fill="' + col + '"/>'
          + '<path d="' + d + '" fill="' + g('gem') + '"/>'
          + '<path d="' + pts.map((p, k) => 'M' + p[0].toFixed(2) + ' ' + p[1].toFixed(2) + 'L' + inner[k][0].toFixed(2) + ' ' + inner[k][1].toFixed(2)).join('') + '" stroke="#fff" stroke-opacity=".45" stroke-width=".8"/>'
          + '<path d="' + tbPath(inner.map((p) => [p[0].toFixed(2), p[1].toFixed(2)])) + '" fill="#fff" fill-opacity=".2" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>'
          + '<path d="M13 6.8L14 10.5L17.7 11.5L14 12.5L13 16.2L12 12.5L8.3 11.5L12 10.5Z" fill="#fff" opacity=".9"/>';
      }
    }
    const el = s('svg', { viewBox: box, 'aria-hidden': 'true', focusable: 'false' });
    el.innerHTML = v;
    return el;
  }
  class TumblerCard extends Card {
    buildBoard() {
      const p = this.p;
      this.signals = (this.extra && this.extra.signals) || [];
      this.draft = this.extra && Array.isArray(this.extra.draft) ? this.extra.draft.slice() : this.freshDraft();
      this.flipRow = -1;
      // the lock is the board: its own pieces and its own material
      this.kit = TB_KITS[this.lookLv] || 'ring';
      this.uid = 'tb' + Math.random().toString(36).slice(2, 8);
      const vault = h('div', { class: 'vault', 'data-kit': this.kit });
      vault.append(tbDefs(this.uid));
      this.lightsEl = h('div', { class: 'lights', role: 'img' });
      this.rowsEl = h('div', { class: 'rows', role: 'list', 'aria-label': 'Tries' });
      this.palEl = h('div', { class: 'palette', role: 'group', 'aria-label': 'Colors' });
      for (let c = 0; c < p.C; c++) {
        const b = this.gem(c, 'button', { type: 'button', 'aria-label': 'Add ' + PEGS[c].name + ' (key ' + (c + 1) + ')' });
        b.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); this.put(c); });
        b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.put(c); } });
        this.palEl.append(b);
      }
      this.clearBtn = h('button', { class: 'vbtn ghost', type: 'button', 'aria-label': 'Clear the row', onclick: () => this.clearDraft() }, icon('erase'));
      this.tryBtn = h('button', { class: 'vbtn go', type: 'button', onclick: () => this.submit() }, icon('key'), 'Check');
      // the lock: what is hidden, one socket per pin, filled in as each pin is found
      this.lockEl = h('div', { class: 'tb-lock', role: 'img' });
      this.lockKnown = null;
      vault.append(this.lightsEl, this.lockEl, this.rowsEl, this.palEl, h('div', { class: 'vault-actions' }, this.clearBtn, this.tryBtn));
      this.vault = vault;
      this.area.append(vault);
    }
    // a piece of this lock (c a color), or an empty place (ask: with a question mark)
    gem(c, tag, attrs, ask) {
      const el = h(tag || 'span', Object.assign({ class: 'gem', 'data-kit': this.kit }, attrs || {}));
      if (c == null) el.classList.add('empty');
      else el.style.setProperty('--c', PEGS[c].fill);
      el.append(tbPiece(this.kit, c, this.uid, ask));
      return el;
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
    // with feedback on (free play, practice) the board remembers for the player and says it plainly
    helps() { return !!this.o.feedback && this.p.clue === 'pin'; }
    // words on the board (what a try's colors mean, why a color does not go there) are for
    // learning: practice and the first level only; from level 2 the board helps without them
    wordy() { return this.practice || (this.spec.level || 0) <= 1; }
    // what the tries so far say: per color 2 (found), 1 (in the code, place not known) or 0 (not in it);
    // per place the color found there and the colors known not to be there
    knowledge() {
      const P = this.p.P, color = {}, at = new Array(P).fill(null), notAt = Array.from({ length: P }, () => new Set());
      for (const t of this.run.tries) {
        if (!t.marks) continue;
        t.digits.forEach((d, k) => {
          const m = t.marks[k];
          color[d] = Math.max(color[d] == null ? -1 : color[d], m);
          if (m === 2) at[k] = d; else notAt[k].add(d);
        });
      }
      this.run.revealed.forEach((c, k) => { if (c != null) { at[k] = c; color[c] = 2; } });
      // as many colors known to be hidden as there are places: every other color is out, tried or not
      if (Object.keys(color).filter((c) => color[c] >= 1).length >= P) for (let c = 0; c < this.p.C; c++) if (!(color[c] >= 1)) color[c] = 0;
      return { color, at, notAt };
    }
    // a word over something on the board, for a moment
    nope(el, text) {
      Sound.play('lose');
      buzz([20, 40, 20]);
      if (el) { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); }
      if (text && this.wordy()) this.say(el, text, 'no');
    }
    put(c) {
      if (this.summary || this.busy) return;
      Sound.unlock();
      if (this.goalSay) { this.goalSay.remove(); this.goalSay = null; }
      const empty = [];
      this.draft.forEach((d, j) => { if (d == null) empty.push(j); });
      if (!empty.length) return;
      let k = empty[0];
      if (this.helps() && this.run.tries.length) {
        const K = this.knowledge();
        if (K.color[c] === 0) { this.nope(this.palEl.children[c], 'Wrong color'); return; }
        const fits = (j) => (K.at[j] == null || K.at[j] === c) && !K.notAt[j].has(c);
        if (!fits(k)) {
          const ok = empty.find(fits);
          const slot = this.rowsEl.querySelector('.row.active') && this.rowsEl.querySelector('.row.active').children[k];
          if (ok == null) { this.nope(slot, 'Not here'); return; }
          // the color cannot go in the next place: it goes on to one where it can, and says so
          if (this.wordy()) this.say(slot, 'Not here', 'no', 1100);
          k = ok;
        }
      }
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
            const g = this.gem(d);
            if (marks) {
              // the place behind each pin turns green (right place), gold (in the code, another
              // place: it wiggles to say move me) or stays dark (not in the code), with a big mark
              const cell = h('span', { class: 'clue' }, g);
              const show = () => {
                g.classList.add('m' + marks[k]);
                cell.classList.add('c' + marks[k]);
                if (marks[k] === 1 && r === tries.length - 1 && !this.summary) g.classList.add('wiggle');
              };
              if (r === this.flipRow) {
                g.style.animationDelay = k * 150 + 'ms';
                g.classList.add('flip');
                this.later(() => { show(); Sound.play('flip', marks[k]); }, k * 150 + 160);
              } else show();
              row.append(cell);
            } else row.append(g);
          });
          if (p.clue === 'count') {
            const cnt = h('div', { class: 'counts', 'aria-hidden': 'true' });
            for (let k = 0; k < p.P; k++) cnt.append(h('i', { class: k < t.exact ? 'x' : k < t.exact + t.partial ? 'p' : '' }));
            if (r === this.flipRow) { cnt.style.opacity = '0'; this.later(() => { cnt.style.opacity = '1'; Sound.play('flip', t.exact ? 2 : t.partial ? 1 : 0); }, 260); }
            row.append(cnt);
          }
          row.setAttribute('aria-label', 'Try ' + (r + 1) + ': ' + t.digits.map((d) => PEGS[d].name).join(', ') + '. ' + t.exact + ' right spot, ' + t.partial + ' right color elsewhere.');
          if (r === tries.length - 1) focusRow = row;
        } else if (r === tries.length && !this.summary) {
          row.classList.add('active');
          const firstEmpty = this.draft.indexOf(null);
          this.draft.forEach((d, k) => {
            const locked = this.run.revealed[k] != null;
            const b = this.gem(d, 'button', { type: 'button', 'aria-label': d == null ? 'Empty slot ' + (k + 1) : (locked ? 'Revealed ' : 'Remove ') + PEGS[d].name + ' in slot ' + (k + 1) });
            if (d == null && k === firstEmpty) b.classList.add('up-next');
            if (locked) b.classList.add('locked');
            if (k === this.popAt && d != null) b.classList.add('pop');
            b.addEventListener('click', () => this.clearSlot(k));
            row.append(b);
          });
          focusRow = row;
        } else {
          row.classList.add('later');
          row.setAttribute('aria-label', 'A try still to come');
        }
        this.rowsEl.append(row);
      }
      this.popAt = -1;
      if (this.summary && this.summary.outcome !== 'solved') {
        const row = h('div', { class: 'row code', 'aria-label': 'The hidden colors' });
        p.secretDigits.forEach((d) => row.append(this.gem(d)));
        this.rowsEl.append(row);
        focusRow = row;
      }
      // the lock: found pins in their sockets, the rest a question mark
      const K = this.knowledge(), was = this.lockKnown || [];
      this.lockEl.textContent = '';
      for (let k = 0; k < p.P; k++) {
        const c = this.summary && this.summary.outcome === 'solved' ? p.secretDigits[k] : K.at[k];
        const sock = h('span', { class: 'sock' + (c != null ? ' found' : '') });
        if (c != null) {
          const g = this.gem(c);
          if (was[k] == null && this.lockKnown) { g.classList.add('landed'); }
          sock.append(g);
        } else sock.append(this.gem(null, 'span', null, true));
        this.lockEl.append(sock);
      }
      const nowFound = K.at.filter((c) => c != null).length, before = was.filter((c) => c != null).length;
      if (this.lockKnown && nowFound > before && !this.summary) Sound.play('bloom', nowFound);
      this.lockKnown = K.at.slice();
      this.lockEl.setAttribute('aria-label', nowFound + ' of ' + p.P + ' hidden colors found');
      // the palette remembers: found, in the code, or not in it
      if (this.helps()) {
        [...this.palEl.children].forEach((b, c) => {
          b.classList.toggle('k2', K.color[c] === 2);
          b.classList.toggle('k1', K.color[c] === 1);
          b.classList.toggle('k0', K.color[c] === 0);
        });
      }
      const full = this.draft.every((d) => d != null);
      this.tryBtn.classList.toggle('ready', full && !this.summary && !this.busy);
      this.tryBtn.disabled = !full || !!this.summary || this.busy;
      this.clearBtn.disabled = !!this.summary || this.draft.every((d, k) => d == null || this.run.revealed[k] != null);
      this.palEl.querySelectorAll('button').forEach((b) => { b.disabled = !!this.summary || full; });
      if (focusRow) this.later(() => { try { focusRow.scrollIntoView({ block: 'nearest' }); } catch (e) { /* optional */ } }, 0);
    }
    submit() {
      if (this.summary || this.busy) return;
      if (this.draft.some((d) => d == null)) return;
      Sound.unlock();
      const same = this.o.feedback ? this.run.tries.findIndex((t) => t.digits.every((d, k) => d === this.draft[k])) : -1;
      if (same >= 0) {
        const rows = this.rowsEl.children, was = rows[same], now = rows[this.run.tries.length];
        Sound.play('lose');
        buzz([20, 40, 20]);
        if (now) { now.classList.remove('nope'); void now.offsetWidth; now.classList.add('nope'); }
        if (was) {
          was.classList.remove('again'); void was.offsetWidth; was.classList.add('again');
          try { was.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* optional */ }
          this.later(() => was.classList.remove('again'), 1600);
        }
        this.log('repeat_blocked', { detail: JSON.stringify({ same_as_try: same + 1, digits: this.draft }) });
        return;
      }
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
        if (rec.solved) {
          this.vault.classList.add('open');
          if (!this.practice) store.set('pr1.tbsolved', (store.get('pr1.tbsolved', 0) || 0) + 1);
        } else if (rec.failed) { this.vault.classList.remove('shake'); void this.vault.offsetWidth; this.vault.classList.add('shake'); }
        this.commit(rec);
        if (!this.summary) { this.refresh(); this.explain(); this.later(() => this.guide(), 1400); }
      }, settle);
    }
    start() {
      super.start();
      if (this.helps() && this.wordy() && (this.practice || !(store.get('pr1.tbsolved', 0) || 0))) this.later(() => { if (!this.draft.some((d, k) => d != null && this.run.revealed[k] == null)) this.goalSay = this.say(this.lockEl, 'Find the ' + this.p.P + ' hidden colors', '', 3200, true); }, 700);
    }
    // what the colors of the last try mean, in words, while the player is new to it
    explain() {
      if (!this.helps() || !this.wordy() || !(this.practice || (store.get('pr1.tbsolved', 0) || 0) < 6)) return;
      const t = this.run.tries[this.run.tries.length - 1], row = this.rowsEl.children[this.run.tries.length - 1];
      if (!t || !t.marks || !row) return;
      const WORDS = { 2: ['Right color, right place', 'yes'], 1: ['Right color, wrong place', 'move'], 0: ['Wrong color', 'no'] };
      // one at a time: each word takes the place of the one before
      let delay = 0, last = null;
      for (const m of [2, 1, 0]) {
        const k = t.marks.indexOf(m);
        if (k < 0) continue;
        const cell = row.children[k];
        this.later(() => { if (last) last.remove(); last = this.say(cell, WORDS[m][0], WORDS[m][1], 1900, true); }, delay);
        delay += 1700;
      }
    }
    moveFields(rec) {
      return {
        move_no: this.moveNo(), target: rec.target, cls: rec.cls,
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
      if (this.run.tries.length) {
        if (!this.practice || !this.helps()) return null;
        if (this.draft.every((d) => d != null)) return this.tryBtn;
        const K = this.knowledge();
        for (let c = 0; c < this.p.C; c++) if (K.color[c] >= 1 && this.draft.indexOf(c) < 0) return this.palEl.children[c];
        return null;
      }
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
  // A photo trip. All shapes share one 100 x 100 box, so the photo, the closed
  // shutter's pattern and the answer buttons draw exactly the same animals.
  // Everything shown during a look is drawn on one canvas inside
  // requestAnimationFrame callbacks, so the photo and the closed shutter
  // change on whole screen frames.
  const GL_PATHS = {
    rabbit: 'M35.18 8.33A8.5 22 -10 1 1 42.82 51.67A8.5 22 -10 1 1 35.18 8.33Z M64.82 8.33A8.5 22 10 1 1 57.18 51.67A8.5 22 10 1 1 64.82 8.33Z M50 39A25 25 0 1 1 50 89A25 25 0 1 1 50 39Z',
    cat: 'M50 33A31 27 0 1 1 50 87A31 27 0 1 1 50 33Z M21 50L25 13L48 35Z M79 50L52 35L75 13Z',
    hedgehog: 'M11.1 76.5L13.9 70.2L8.3 62.6L17.1 58.8L15.1 49.8L24.8 49.5L26.7 40.5L35.7 43.8L41.2 36.2L48.1 42.6L56.3 37.6L60.0 46.1L69.6 44.6L69.5 53.8L79.0 55.9L75.1 64.3L82.9 69.8L78.9 76.5L84 62Q92 64 97 70Q92 75 84 76L80 78L9 78Z M22 76L32 76L32 86Q27 89 22 86Z M56 76L66 76L66 86Q61 89 56 86Z',
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
  };  // the trips' animals in color: layer 0 is the whole silhouette, the layers after it details on top
  const GL_ART = {
    rabbit: [['#B79C82', 'M30.63 31.48A8.5 22 -10 1 1 47.37 28.52A8.5 22 -10 1 1 30.63 31.48ZM52.63 28.52A8.5 22 10 1 1 69.37 31.48A8.5 22 10 1 1 52.63 28.52ZM25 64A25 25 0 1 1 75 64A25 25 0 1 1 25 64Z'], ['#F2B6BF', 'M34.86 30.73A4.2 15 -10 1 1 43.14 29.27A4.2 15 -10 1 1 34.86 30.73ZM56.86 29.27A4.2 15 10 1 1 65.14 30.73A4.2 15 10 1 1 56.86 29.27Z'], ['#EFE4D6', 'M37 74A13 10 0 1 1 63 74A13 10 0 1 1 37 74Z'], ['#2A1E16', 'M37.6 59A3.4 3.4 0 1 1 44.4 59A3.4 3.4 0 1 1 37.6 59ZM55.6 59A3.4 3.4 0 1 1 62.4 59A3.4 3.4 0 1 1 55.6 59Z'], ['#E58A9A', 'M46.5 68L53.5 68L50 72.5Z']],
    hedgehog: [['#8A6242', 'M11.1 76.5L13.9 70.2L8.3 62.6L17.1 58.8L15.1 49.8L24.8 49.5L26.7 40.5L35.7 43.8L41.2 36.2L48.1 42.6L56.3 37.6L60 46.1L69.6 44.6L69.5 53.8L79 55.9L75.1 64.3L82.9 69.8L78.9 76.5L84 62Q92 64 97 70Q92 75 84 76L80 78L9 78Z M22 76L32 76L32 86Q27 89 22 86Z M56 76L66 76L66 86Q61 89 56 86Z'], ['#E6C79E', 'M70 60Q80 57 88 63Q94 67 97 70Q92 75 84 76L72 77Q66 70 70 60Z'], ['#6E4A30', 'M24 58L28 64L20 64ZM38 50L42 57L34 56ZM52 46L56 53L48 52ZM44 64L48 70L40 70ZM58 60L62 66L54 66Z'], ['#2A1E16', 'M79.7 65A2.3 2.3 0 1 1 84.3 65A2.3 2.3 0 1 1 79.7 65ZM93.8 70A2.4 2.4 0 1 1 98.6 70A2.4 2.4 0 1 1 93.8 70Z']],
    bird: [['#3D8BFD', 'M44 36A30 22 0 1 1 44 80A30 22 0 1 1 44 36Z M70 25A15 15 0 1 1 70 55A15 15 0 1 1 70 25Z M84 35L97 41L84 47Z M22 50L8 59L2 33Z'], ['#A9D0FF', 'M33 66A19 10 0 1 1 71 66A19 10 0 1 1 33 66Z'], ['#2563C8', 'M21.37 58.53A17 9 -12 1 1 54.63 51.47A17 9 -12 1 1 21.37 58.53Z'], ['#FFB81F', 'M84 35L97 41L84 47Z'], ['#FFFFFF', 'M69 37A4 4 0 1 1 77 37A4 4 0 1 1 69 37Z'], ['#14213D', 'M71.8 37A2.2 2.2 0 1 1 76.2 37A2.2 2.2 0 1 1 71.8 37Z']],
    frog: [['#5DB84A', 'M16 66A34 23 0 1 1 84 66A34 23 0 1 1 16 66ZM18.5 38A12.5 12.5 0 1 1 43.5 38A12.5 12.5 0 1 1 18.5 38ZM56.5 38A12.5 12.5 0 1 1 81.5 38A12.5 12.5 0 1 1 56.5 38ZM16 88A11 5.5 0 1 1 38 88A11 5.5 0 1 1 16 88ZM62 88A11 5.5 0 1 1 84 88A11 5.5 0 1 1 62 88Z'], ['#B9E28C', 'M30 75A20 13 0 1 1 70 75A20 13 0 1 1 30 75Z'], ['#FFFFFF', 'M23 38A8 8 0 1 1 39 38A8 8 0 1 1 23 38ZM61 38A8 8 0 1 1 77 38A8 8 0 1 1 61 38Z'], ['#1B2A16', 'M26.4 39A4.6 4.6 0 1 1 35.6 39A4.6 4.6 0 1 1 26.4 39ZM64.4 39A4.6 4.6 0 1 1 73.6 39A4.6 4.6 0 1 1 64.4 39Z'], ['#2F7426', 'M33 58Q50 70 67 58Q50 65 33 58Z']],
    duck: [['#F7F3E8', 'M10 64A34 19 0 1 1 78 64A34 19 0 1 1 10 64ZM58 34A14 14 0 1 1 86 34A14 14 0 1 1 58 34ZM61 40L80 42L76 60L58 58ZM10 58L2 44L18 54Z'], ['#E3DCCB', 'M22.18 64.51A18 9 -8 1 1 57.82 59.49A18 9 -8 1 1 22.18 64.51Z'], ['#F29A2E', 'M83 32L98 36L98 41L84 43Z'], ['#1B2433', 'M72.4 31A2.6 2.6 0 1 1 77.6 31A2.6 2.6 0 1 1 72.4 31Z']],
    dragonfly: [['#CBEAF4', 'M7.22 34.2A23 7 -8 1 1 52.78 27.8A23 7 -8 1 1 7.22 34.2ZM47.22 27.8A23 7 8 1 1 92.78 34.2A23 7 8 1 1 47.22 27.8ZM10.32 40.35A21 6.5 10 1 1 51.68 47.65A21 6.5 10 1 1 10.32 40.35ZM48.32 47.65A21 6.5 -10 1 1 89.68 40.35A21 6.5 -10 1 1 48.32 47.65ZM43 15A7 7 0 1 1 57 15A7 7 0 1 1 43 15ZM44 31A6 9 0 1 1 56 31A6 9 0 1 1 44 31ZM46.2 64A3.8 30 0 1 1 53.8 64A3.8 30 0 1 1 46.2 64Z'], ['#9ED3E6', 'M13.14 32.95A14 2.4 -8 1 1 40.86 29.05A14 2.4 -8 1 1 13.14 32.95ZM59.14 29.05A14 2.4 8 1 1 86.86 32.95A14 2.4 8 1 1 59.14 29.05ZM16.18 41.92A12 2.2 10 1 1 39.82 46.08A12 2.2 10 1 1 16.18 41.92ZM60.18 46.08A12 2.2 -10 1 1 83.82 41.92A12 2.2 -10 1 1 60.18 46.08Z'], ['#1C8FA6', 'M44 31A6 9 0 1 1 56 31A6 9 0 1 1 44 31ZM46.2 64A3.8 30 0 1 1 53.8 64A3.8 30 0 1 1 46.2 64Z'], ['#0F6B7E', 'M43 15A7 7 0 1 1 57 15A7 7 0 1 1 43 15Z'], ['#BDF3FF', 'M43.9 13.5A2.6 2.6 0 1 1 49.1 13.5A2.6 2.6 0 1 1 43.9 13.5ZM50.9 13.5A2.6 2.6 0 1 1 56.1 13.5A2.6 2.6 0 1 1 50.9 13.5Z']],
    deer: [['#B8773E', 'M19 54A27 14 0 1 1 73 54A27 14 0 1 1 19 54ZM62 50L70 24L82 22L76 52ZM69.54 19.6A11 7 18 1 1 90.46 26.4A11 7 18 1 1 69.54 19.6ZM24 58L29 58L30 93L25 93ZM34 60L39 60L38 93L33 93ZM56 60L61 60L62 93L57 93ZM64 58L69 58L71 93L66 93ZM16 48L22 44L24 52ZM74 18L70 6L73 5L77 16ZM79 16L80 4L83 4L82 16Z'], ['#F3E2CB', 'M27 63A17 4.5 0 1 1 61 63A17 4.5 0 1 1 27 63ZM16 49A3 3 0 1 1 22 49A3 3 0 1 1 16 49Z'], ['#7A4A24', 'M70 6L66 2L68 1L72 5ZM80 4L84 0L86 1L82 5Z'], ['#2A1A10', 'M82.2 21A1.8 1.8 0 1 1 85.8 21A1.8 1.8 0 1 1 82.2 21ZM88.7 25.5A1.8 1.8 0 1 1 92.3 25.5A1.8 1.8 0 1 1 88.7 25.5Z']],
    fox: [['#E8743A', 'M50 30L58 30L80 7Q85 23 83 40Q91 50 89 58Q79 71 64 77Q56 88 50 93Q44 88 36 77Q21 71 11 58Q9 50 17 40Q15 23 20 7L42 30Z'], ['#FFF3E4', 'M50 93Q44 88 36 77Q21 71 11 58Q24 61 35 64Q44 69 50 77Q56 69 65 64Q76 61 89 58Q79 71 64 77Q56 88 50 93Z'], ['#7A3418', 'M22 12L36 30L25 36ZM78 12L75 36L64 30Z'], ['#22160F', 'M34 50A3 4.2 0 1 1 40 50A3 4.2 0 1 1 34 50ZM60 50A3 4.2 0 1 1 66 50A3 4.2 0 1 1 60 50ZM46 86A4 3 0 1 1 54 86A4 3 0 1 1 46 86Z']],
    owl: [['#8B6446', 'M20 58A30 36 0 1 1 80 58A30 36 0 1 1 20 58ZM22 28L28 8L40 24ZM60 24L72 8L78 28Z'], ['#C7A27A', 'M32 76A18 16 0 1 1 68 76A18 16 0 1 1 32 76Z'], ['#EAD3AE', 'M25 43A13 13 0 1 1 51 43A13 13 0 1 1 25 43ZM49 43A13 13 0 1 1 75 43A13 13 0 1 1 49 43Z'], ['#F5C344', 'M30 43A8 8 0 1 1 46 43A8 8 0 1 1 30 43ZM54 43A8 8 0 1 1 70 43A8 8 0 1 1 54 43Z'], ['#1A140F', 'M33.8 43A4.2 4.2 0 1 1 42.2 43A4.2 4.2 0 1 1 33.8 43ZM57.8 43A4.2 4.2 0 1 1 66.2 43A4.2 4.2 0 1 1 57.8 43Z'], ['#E0952E', 'M45 52L55 52L50 62Z']],
    monkey: [['#7B5434', 'M22 50A28 28 0 1 1 78 50A28 28 0 1 1 22 50ZM6 50A12 12 0 1 1 30 50A12 12 0 1 1 6 50ZM70 50A12 12 0 1 1 94 50A12 12 0 1 1 70 50Z'], ['#E8C79A', 'M30.5 45A10.5 10.5 0 1 1 51.5 45A10.5 10.5 0 1 1 30.5 45ZM48.5 45A10.5 10.5 0 1 1 69.5 45A10.5 10.5 0 1 1 48.5 45ZM34 64A16 12 0 1 1 66 64A16 12 0 1 1 34 64ZM11.5 50A6.5 6.5 0 1 1 24.5 50A6.5 6.5 0 1 1 11.5 50ZM75.5 50A6.5 6.5 0 1 1 88.5 50A6.5 6.5 0 1 1 75.5 50Z'], ['#1E140C', 'M38.6 46A3.4 3.4 0 1 1 45.4 46A3.4 3.4 0 1 1 38.6 46ZM54.6 46A3.4 3.4 0 1 1 61.4 46A3.4 3.4 0 1 1 54.6 46ZM44.4 61A1.6 1.2 0 1 1 47.6 61A1.6 1.2 0 1 1 44.4 61ZM52.4 61A1.6 1.2 0 1 1 55.6 61A1.6 1.2 0 1 1 52.4 61Z'], ['#8E5A3A', 'M42 68Q50 74 58 68Q50 71 42 68Z']],
    tiger: [['#F08C2A', 'M15 56A35 31 0 1 1 85 56A35 31 0 1 1 15 56ZM12.5 28A10.5 10.5 0 1 1 33.5 28A10.5 10.5 0 1 1 12.5 28ZM66.5 28A10.5 10.5 0 1 1 87.5 28A10.5 10.5 0 1 1 66.5 28Z'], ['#FFF4E4', 'M17.5 28A5.5 5.5 0 1 1 28.5 28A5.5 5.5 0 1 1 17.5 28ZM71.5 28A5.5 5.5 0 1 1 82.5 28A5.5 5.5 0 1 1 71.5 28ZM26 70A13 11 0 1 1 52 70A13 11 0 1 1 26 70ZM48 70A13 11 0 1 1 74 70A13 11 0 1 1 48 70Z'], ['#1E1712', 'M46 26L50 25L54 26L52 38L48 38ZM36 30L40 29L43 38L39 39ZM60 29L64 30L61 39L57 38ZM15 52L28 54L27 57L16 57ZM15 62L27 61L26 64L17 66ZM85 52L84 57L73 57L72 54ZM85 62L83 66L74 64L73 61ZM36 50A3 4 0 1 1 42 50A3 4 0 1 1 36 50ZM58 50A3 4 0 1 1 64 50A3 4 0 1 1 58 50Z'], ['#D9617A', 'M45 62L55 62L50 68Z']],
    parrot: [['#E23B36', 'M29.83 52.75A17 28 18 1 1 62.17 63.25A17 28 18 1 1 29.83 52.75ZM44 27A14 14 0 1 1 72 27A14 14 0 1 1 44 27ZM48 82L33 99L24 99L40 78ZM66 18Q82 17 81 33Q78 40 72 36Q74 28 66 26Z'], ['#2E7CD6', 'M30.49 54.91A10 21 18 1 1 49.51 61.09A10 21 18 1 1 30.49 54.91ZM42 76L33 92L27 92L34 72Z'], ['#F5C83A', 'M37.29 44.15A6 9 18 1 1 48.71 47.85A6 9 18 1 1 37.29 44.15Z'], ['#F3E6CC', 'M66 18Q82 17 81 33Q78 40 72 36Q74 28 66 26Z'], ['#FFFFFF', 'M56.4 24A4.6 4.6 0 1 1 65.6 24A4.6 4.6 0 1 1 56.4 24Z'], ['#14110F', 'M59.7 24A2.3 2.3 0 1 1 64.3 24A2.3 2.3 0 1 1 59.7 24Z']],
    leaf: [['#4F9A4C', 'M50 5C81 22 83 68 50 94C17 68 19 22 50 5Z M48 88L52 88L52 99L48 99Z'], ['#7CC07A', 'M49.3 16L50.7 16L50.7 86L49.3 86Z']],
    badger: [['#8E8E8E', 'M20 54A30 33 0 1 1 80 54A30 33 0 1 1 20 54ZM18 27A8 8 0 1 1 34 27A8 8 0 1 1 18 27ZM66 27A8 8 0 1 1 82 27A8 8 0 1 1 66 27Z'], ['#F4F1EA', 'M38 56A12 32 0 1 1 62 56A12 32 0 1 1 38 56ZM20 66A9 12 0 1 1 38 66A9 12 0 1 1 20 66ZM62 66A9 12 0 1 1 80 66A9 12 0 1 1 62 66Z'], ['#242424', 'M30.66 53.56A7.5 25 -12 1 1 45.34 50.44A7.5 25 -12 1 1 30.66 53.56ZM54.66 50.44A7.5 25 12 1 1 69.34 53.56A7.5 25 12 1 1 54.66 50.44ZM45.4 85A4.6 4.6 0 1 1 54.6 85A4.6 4.6 0 1 1 45.4 85Z'], ['#FFFFFF', 'M35.1 52A2.4 2.4 0 1 1 39.9 52A2.4 2.4 0 1 1 35.1 52ZM60.1 52A2.4 2.4 0 1 1 64.9 52A2.4 2.4 0 1 1 60.1 52Z']],
    bat: [['#4B3E5E', 'M46 44Q30 30 6 33Q12 44 10 55Q18 50 24 58Q30 52 36 62Q40 54 46 58ZM54 44Q70 30 94 33Q88 44 90 55Q82 50 76 58Q70 52 64 62Q60 54 54 58ZM40 53A10 16 0 1 1 60 53A10 16 0 1 1 40 53ZM41 35A9 9 0 1 1 59 35A9 9 0 1 1 41 35ZM42 31L43 17L48 28ZM52 28L57 17L58 31Z'], ['#6A5B80', 'M44 56A6 10 0 1 1 56 56A6 10 0 1 1 44 56Z'], ['#FFE9A8', 'M44.7 35A1.8 1.8 0 1 1 48.3 35A1.8 1.8 0 1 1 44.7 35ZM51.7 35A1.8 1.8 0 1 1 55.3 35A1.8 1.8 0 1 1 51.7 35Z']],
    moth: [['#E3D5B2', 'M10.6 49.24A22 13 -22 1 1 51.4 32.76A22 13 -22 1 1 10.6 49.24ZM48.6 32.76A22 13 22 1 1 89.4 49.24A22 13 22 1 1 48.6 32.76ZM23.02 56.76A14 10 22 1 1 48.98 67.24A14 10 22 1 1 23.02 56.76ZM51.02 67.24A14 10 -22 1 1 76.98 56.76A14 10 -22 1 1 51.02 67.24ZM45 51A5 19 0 1 1 55 51A5 19 0 1 1 45 51ZM48 34Q42 22 34 17L35 15.5Q44 20 50.5 33ZM52 34Q58 22 66 17L65 15.5Q56 20 49.5 33Z'], ['#C9B48A', 'M23 42A5 5 0 1 1 33 42A5 5 0 1 1 23 42ZM67 42A5 5 0 1 1 77 42A5 5 0 1 1 67 42ZM34.5 63A3.5 3.5 0 1 1 41.5 63A3.5 3.5 0 1 1 34.5 63ZM58.5 63A3.5 3.5 0 1 1 65.5 63A3.5 3.5 0 1 1 58.5 63Z'], ['#8C6F45', 'M45 51A5 19 0 1 1 55 51A5 19 0 1 1 45 51ZM48 34Q42 22 34 17L35 15.5Q44 20 50.5 33ZM52 34Q58 22 66 17L65 15.5Q56 20 49.5 33Z']],
  };
  const glShape = (name) => (GL_ART[name] ? GL_ART[name][0][1] : GL_PATHS[name]);
  // each trip: the card's colors around the photo
  const GL_TRIP = {
    meadow: { bg1: '#5AB0F5', bg2: '#2364C8' },
    pond: { bg1: '#3CC2B9', bg2: '#0F6476' },
    forest: { bg1: '#5DAE6C', bg2: '#1C5236' },
    jungle: { bg1: '#8CC84B', bg2: '#2A6A2C' },
    night: { bg1: '#4152A6', bg2: '#0C1236' },
  };
  const GL_DIRS = ['up', 'up right', 'right', 'down right', 'down', 'down left', 'left', 'up left'];
  const GL_NUMPAD = { 8: 0, 9: 1, 6: 2, 3: 3, 2: 4, 1: 5, 4: 6, 7: 7 };
  const GL_P2D = {}, GL_A2D = {};
  function glPath(name) {
    if (!(name in GL_P2D)) { try { GL_P2D[name] = new Path2D(glShape(name)); } catch (e) { GL_P2D[name] = null; } }
    return GL_P2D[name];
  }
  function glArt(name) {
    if (!(name in GL_A2D)) { try { GL_A2D[name] = (GL_ART[name] || [['#2A2E37', GL_PATHS[name]]]).map(([c, d]) => [c, new Path2D(d)]); } catch (e) { GL_A2D[name] = null; } }
    return GL_A2D[name];
  }
  // one silhouette in the current fill (Switchback's signs)
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
  // an animal in color, with a thin light rim so it stands out on any ground
  function glDrawArt(ctx, name, x, y, size, rot, flip, rim) {
    const L = glArt(name);
    if (!L) return;
    const k = size / 100;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(flip ? -k : k, k);
    ctx.translate(-50, -50);
    if (rim) { ctx.strokeStyle = rim; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.stroke(L[0][1]); }
    for (const [c, p] of L) { ctx.fillStyle = c; ctx.fill(p); }
    ctx.restore();
  }
  function glSvg(name) {
    return s('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' }, s('path', { d: glShape(name) }));
  }
  function glArtSvg(name) {
    return s('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' }, (GL_ART[name] || [['currentColor', GL_PATHS[name]]]).map(([c, d]) => s('path', { d, fill: c })));
  }
  function glXY(G, R, slot) {
    const sl = G.slots[slot], a = (sl.a * Math.PI) / 180;
    return [R + Math.sin(a) * sl.r * R, R - Math.cos(a) * sl.r * R];
  }
  // the ground each trip's photos are taken on: soft and plain where the animals can be, with
  // the details out at the rim
  function glScene(ctx, R, trip) {
    const D = 2 * R;
    ctx.save();
    const lin = (y0, y1, stops) => { const g = ctx.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
    const blob = (x, y, rx, ry, c, a, rot) => { ctx.globalAlpha = a == null ? 1 : a; ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x * R, y * R, rx * R, ry * R, rot || 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; };
    // a ground line across the photo from y0 at the left to y1 at the right, gently waved
    const ground = (y0, y1, wave, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(0, y0 * R);
      for (let i = 1; i <= 8; i++) { const x = (i / 8) * D, y = (y0 + (y1 - y0) * (i / 8)) * R + Math.sin(i * 1.7) * wave * R; ctx.quadraticCurveTo(x - D / 16, y - wave * R, x, y); }
      ctx.lineTo(D, D);
      ctx.lineTo(0, D);
      ctx.closePath();
      ctx.fill();
    };
    const cloud = (x, y, k, a) => { blob(x, y, 0.13 * k, 0.06 * k, '#FFFFFF', a); blob(x - 0.07 * k, y + 0.015 * k, 0.07 * k, 0.045 * k, '#FFFFFF', a); blob(x + 0.04 * k, y - 0.03 * k, 0.07 * k, 0.05 * k, '#FFFFFF', a); };
    if (trip === 'pond') {
      ctx.fillStyle = lin(0, D, [[0, '#A9DEDD'], [1, '#5FB4BF']]);
      ctx.fillRect(0, 0, D, D);
      ground(0.3, 0.26, 0.012, '#9ED08A');
      ctx.fillStyle = lin(0.3 * R, D, [[0, '#9FD8DA'], [1, '#5CB0BD']]);
      ctx.beginPath(); ctx.rect(0, 0.36 * R, D, D); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.lineWidth = Math.max(1, 0.008 * R);
      for (const [y, rx] of [[1.2, 0.36], [1.27, 0.55], [1.36, 0.74]]) { ctx.beginPath(); ctx.ellipse(R, y * R, rx * R, rx * 0.16 * R, 0, 0, Math.PI * 2); ctx.stroke(); }
      for (const [x, y, k] of [[0.18, 1.62, 1], [1.84, 1.38, 0.8], [1.5, 1.9, 0.9], [0.5, 1.92, 0.7]]) { blob(x, y, 0.13 * k, 0.05 * k, '#5E9F57'); blob(x, y - 0.006, 0.11 * k, 0.04 * k, '#73B66A'); }
      ctx.strokeStyle = '#5E8F4C';
      ctx.lineWidth = Math.max(1, 0.01 * R);
      for (const x of [0.12, 0.17, 0.22, 1.78, 1.84, 1.9]) { ctx.beginPath(); ctx.moveTo(x * R, 0.4 * R); ctx.quadraticCurveTo((x + 0.02) * R, 0.24 * R, (x - 0.01) * R, 0.12 * R); ctx.stroke(); }
    } else if (trip === 'forest') {
      ctx.fillStyle = lin(0, D, [[0, '#E7F2DC'], [1, '#D3E6C3']]);
      ctx.fillRect(0, 0, D, D);
      for (const [x, w] of [[0.06, 0.14], [0.3, 0.07], [1.64, 0.09], [1.9, 0.15]]) { ctx.fillStyle = 'rgba(176,150,112,.55)'; ctx.fillRect((x - w / 2) * R, 0, w * R, D); }
      for (const [x, y, k] of [[0.1, 0.1, 1.3], [0.4, 0.04, 0.9], [1.6, 0.06, 1], [1.95, 0.14, 1.3]]) blob(x, y, 0.22 * k, 0.12 * k, '#B9D99F', 0.9);
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.beginPath(); ctx.moveTo(0.9 * R, 0); ctx.lineTo(1.1 * R, 0); ctx.lineTo(0.75 * R, D); ctx.lineTo(0.5 * R, D); ctx.closePath(); ctx.fill();
      ground(1.14, 1.1, 0.02, lin(1.1 * R, D, [[0, '#BAD79B'], [1, '#9AC47D']]));
    } else if (trip === 'jungle') {
      ctx.fillStyle = lin(0, D, [[0, '#D6EFBE'], [1, '#B2DD95']]);
      ctx.fillRect(0, 0, D, D);
      ctx.strokeStyle = 'rgba(70,130,60,.35)';
      ctx.lineWidth = Math.max(1.5, 0.014 * R);
      for (const x of [0.32, 0.62, 1.42, 1.7]) { ctx.beginPath(); ctx.moveTo(x * R, 0); ctx.quadraticCurveTo((x + 0.08) * R, 0.2 * R, (x - 0.02) * R, 0.36 * R); ctx.stroke(); }
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + 0.2;
        blob(1 + Math.cos(a) * 1.05, 1 + Math.sin(a) * 1.05, 0.2, 0.08, i % 2 ? '#7DBF6A' : '#6AAE5B', 0.75, a + Math.PI / 2);
      }
      ground(1.18, 1.14, 0.02, lin(1.1 * R, D, [[0, '#A2D483'], [1, '#86C26C']]));
    } else if (trip === 'night') {
      ctx.fillStyle = lin(0, D, [[0, '#2E3D78'], [1, '#4A5FA3']]);
      ctx.fillRect(0, 0, D, D);
      scatter(22, 71, 0.1, 0.1, 1.9, 0.95).forEach(([x, y, k]) => blob(x, y, 0.006 + k * 0.006, 0.006 + k * 0.006, '#FFFFFF', 0.4 + k * 0.5));
      blob(0.36, 0.3, 0.16, 0.16, '#FFF3C8', 0.18);
      blob(0.36, 0.3, 0.085, 0.085, '#FFF3C8');
      ground(1.1, 1.06, 0.02, lin(1.05 * R, D, [[0, '#4B7F69'], [1, '#356154']]));
      // what the flash lights up
      const g = ctx.createRadialGradient(R, R, 0.1 * R, R, R, R);
      g.addColorStop(0, 'rgba(255,255,240,.18)');
      g.addColorStop(1, 'rgba(255,255,240,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, D, D);
    } else {
      ctx.fillStyle = lin(0, R, [[0, '#BDE3FF'], [1, '#EAF6FF']]);
      ctx.fillRect(0, 0, D, D);
      cloud(0.45, 0.3, 1, 0.9);
      cloud(1.5, 0.2, 0.8, 0.85);
      ground(0.82, 0.78, 0.03, '#C3E3AE');
      ground(0.94, 0.9, 0.02, lin(0.9 * R, D, [[0, '#AEDC90'], [1, '#88C66E']]));
      for (const [x, y, c] of [[0.3, 1.82, '#FFFFFF'], [0.42, 1.9, '#FFD54A'], [1.56, 1.86, '#FFFFFF'], [1.7, 1.76, '#FF9EC0'], [1.12, 1.95, '#FFD54A']]) blob(x, y, 0.016, 0.016, c);
    }
    ctx.restore();
  }
  // the middle animal at 0.34 R, the thing to find and what is in its way at 0.2 R
  const GL_CENTER = 0.34, GL_ITEM = 0.2, GL_RIM = 'rgba(255,255,255,.92)';
  function glStim(ctx, R, p, t, G) {
    glScene(ctx, R, p.theme);
    glDrawArt(ctx, p.pair[t.c], R, R, GL_CENTER * R, 0, false, GL_RIM);
    if (!p.periph) return;
    const size = GL_ITEM * R;
    for (const d of t.d) { const q = glXY(G, R, d[0]); glDrawArt(ctx, p.distractor || 'leaf', q[0], q[1], size, d[1], false, GL_RIM); }
    const b = glXY(G, R, G.slotOf(t.ring, t.dir));
    glDrawArt(ctx, t.tg || p.target || 'bird', b[0], b[1], size, 0, !!t.flip, GL_RIM);
  }
  // pattern mask: outlines of the trip's own shapes on every position an item can take
  // (the 48 ring spots and the middle), then a scatter of outlines and short strokes,
  // drawn in light lines over the closed shutter
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
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const jit = () => (rng() - 0.5) * 0.08 * R;
    for (let k = 0; k < G.slots.length; k++) { const q = glXY(G, R, k); outline(q[0] + jit(), q[1] + jit(), (0.18 + rng() * 0.1) * R); }
    for (let k = 0; k < 3; k++) outline(R + jit(), R + jit(), (0.26 + rng() * 0.14) * R);
    for (let i = 0; i < 26; i++) { const q = pt(1.3 * R); outline(q[0], q[1], (0.14 + rng() * 0.18) * R); }
    for (let i = 0; i < 150; i++) {
      const q = pt(1.35 * R);
      const len = (0.035 + rng() * 0.1) * R, a = rng() * Math.PI * 2;
      ctx.lineWidth = (0.008 + rng() * 0.014) * R;
      ctx.beginPath();
      if (rng() < 0.55) { ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + Math.cos(a) * len, q[1] + Math.sin(a) * len); }
      else ctx.arc(q[0], q[1], len * 0.6, a, a + 1 + rng() * 3);
      ctx.stroke();
    }
    ctx.restore();
  }
  // the closed shutter: the camera's dark screen, with the faint grid a camera shows
  function glIris(ctx, R) {
    const D = 2 * R;
    const g = ctx.createRadialGradient(R, 0.8 * R, 0.1 * R, R, R, 1.45 * R);
    g.addColorStop(0, '#3A3F4A');
    g.addColorStop(1, '#1B1E24');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, D, D);
    ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.lineWidth = Math.max(1, 0.006 * R);
    ctx.beginPath();
    for (const k of [1, 2]) { ctx.moveTo((k * D) / 3, 0); ctx.lineTo((k * D) / 3, D); ctx.moveTo(0, (k * D) / 3); ctx.lineTo(D, (k * D) / 3); }
    ctx.stroke();
  }
  // focusing: a yellow square, as a phone camera shows, settles round the middle over the first
  // GL_RING_MS; every look gets GL_LEAD_MS more, with the square settling slowly over it
  const GL_RING_MS = 260, GL_LEAD_MS = 800;
  function glFocus(ctx, R, k) {
    const e = k == null ? 1 : 1 - Math.pow(1 - Math.min(1, k), 3);
    const half = (0.15 + 0.13 * (1 - e)) * R, r = 0.035 * R;
    ctx.strokeStyle = '#FFD23F';
    ctx.lineWidth = Math.max(2, 0.012 * R);
    ctx.globalAlpha = 0.45 + 0.55 * e;
    ctx.beginPath();
    ctx.moveTo(R - half + r, R - half);
    ctx.arcTo(R + half, R - half, R + half, R + half, r);
    ctx.arcTo(R + half, R + half, R - half, R + half, r);
    ctx.arcTo(R - half, R + half, R - half, R - half, r);
    ctx.arcTo(R - half, R - half, R + half, R - half, r);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const raf = (fn) => (window.requestAnimationFrame ? window.requestAnimationFrame(fn) : setTimeout(() => fn(now()), 16));
  const caf = (id) => { if (id == null) return; if (window.cancelAnimationFrame) window.cancelAnimationFrame(id); else clearTimeout(id); };
  // Keepsake's things move through their transform attribute, frame by frame: a CSS
  // transform animation on an SVG element can be drawn from a low-resolution snapshot
  // (Safari), which leaves it blurry, while an attribute is always drawn sharp.
  function tween(ms, step, done) {
    if (!(ms > 0) || reducedMotion()) { step(1); if (done) done(); return { stop() {} }; }
    let id = null;
    const t0 = now();
    const tick = () => {
      const f = Math.min(1, (now() - t0) / ms);
      step(f);
      if (f < 1) id = raf(tick); else { id = null; if (done) done(); }
    };
    id = raf(tick);
    return { stop() { caf(id); id = null; } };
  }
  const backOut = (t, k) => { const u = t - 1; return 1 + (k + 1) * u * u * u + k * u * u; };
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
      const trip = GL_TRIP[p.theme] || GL_TRIP.meadow;
      this.tg = p.target || (p.targetSet && p.targetSet[0]) || 'bird';
      this.maskShapes = p.pair.concat([this.tg], [p.distractor || 'leaf']);
      this.el.dataset.theme = p.theme || 'meadow';
      this.el.style.setProperty('--bg1', trip.bg1);
      this.el.style.setProperty('--bg2', trip.bg2);
      this.album = [];
      this.lens = h('div', { class: 'gl-lens' });
      this.canvas = h('canvas', { class: 'gl-canvas', 'aria-hidden': 'true' });
      this.stimC = document.createElement('canvas');
      this.maskC = document.createElement('canvas');
      this.irisC = document.createElement('canvas');
      // the line over the photo: what to find, then each question in words
      this.qEl = h('p', { class: 'gl-q', 'aria-live': 'polite' });
      this.goBtn = h('button', { class: 'gl-go', type: 'button', 'aria-label': 'Take a photo' }, icon('camera'));
      this.goBtn.addEventListener('click', () => this.begin());
      this.choiceEl = h('div', { class: 'gl-choices', role: 'group', 'aria-label': 'Who was in the middle', hidden: true });
      this.choiceBtns = p.pair.map((name, k) => {
        const b = h('button', { class: 'gl-choice', type: 'button', 'aria-label': name }, glArtSvg(name));
        b.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); e.stopPropagation(); this.pick(k); });
        b.addEventListener('click', () => this.pick(k));
        this.choiceEl.append(b);
        return b;
      });
      this.spotsEl = h('div', { class: 'gl-spots', role: 'group', 'aria-label': 'Where the ' + this.tg + ' was', hidden: true });
      this.spotBtns = GL_DIRS.map((name, d) => {
        const b = h('button', { class: 'gl-spot', type: 'button', 'aria-label': name });
        b.addEventListener('click', () => this.where(d));
        this.spotsEl.append(b);
        return b;
      });
      this.lens.addEventListener('pointerdown', (e) => this.lensDown(e));
      // the album: one frame a photo, filled in as the trip goes
      this.dotsEl = h('div', { class: 'gl-album', 'aria-hidden': 'true' });
      // "?" where the animal was
      this.askEl = h('div', { class: 'gl-ask', 'aria-hidden': 'true', hidden: true });
      this.lens.append(this.canvas, this.askEl, this.spotsEl, this.choiceEl, this.goBtn);
      this.area.classList.add('gl-area');
      this.area.append(h('div', { class: 'gl-wrap' }, this.qEl, this.lens, this.dotsEl));
      this.line('find');
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
      caf(this.fadeId);
      this.st = null;
      if (this.ro) this.ro.disconnect();
      if (this.onWinResize) window.removeEventListener('resize', this.onWinResize);
      this.app.steady(false);
    }
    // the words over the photo
    line(kind) {
      const q = this.qEl, tg = this.tg;
      q.textContent = '';
      q.className = 'gl-q ' + kind;
      if (kind === 'find') q.append(h('span', { class: 'gl-q-art' }, glArtSvg(tg)), 'Find the ' + tg);
      else if (kind === 'what') q.append('Who was in the middle?');
      else if (kind === 'where') q.append('Where was the ' + tg + '?');
      else if (kind === 'ok') q.append('Got it!');
      else if (kind === 'center') q.append('It was the ' + this.p.pair[this.p.trials[Math.max(0, this.run.i - 1)].c]);
      else if (kind === 'spot') q.append('The ' + tg + ' was here');
    }
    // ---- layout
    onResize() {
      const changed = this.layout();
      if (changed) this.abort('resize');
    }
    layout() {
      const aw = this.area.clientWidth - 28, ah = this.area.clientHeight - 24 - 26 - 64;
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
      [this.canvas, this.stimC, this.maskC, this.irisC].forEach((c) => { c.width = px; c.height = px; });
      this.ctx = this.canvas.getContext('2d');
      const ic = this.irisC.getContext('2d');
      ic.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      glIris(ic, this.R);
      this.placeSpots();
      this.clearReveal();
      if (this.phase === 'ready' || this.phase === 'done') this.paint(null, 1, true);
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
    // ---- drawing: the closed shutter with something over it (the focus marks, the pattern), or the photo
    paint(src, alpha, shut) {
      const c = this.ctx;
      if (!c) return;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, this.canvas.width, this.canvas.height);
      if (shut) c.drawImage(this.irisC, 0, 0);
      if (src) { c.globalAlpha = alpha == null ? 1 : alpha; c.drawImage(src, 0, 0); c.globalAlpha = 1; }
    }
    // after the shutter closes, its pattern fades but stays faintly behind the questions
    fadeMask() {
      caf(this.fadeId);
      const t0 = now(), ms = 280, floor = 0.18;
      const step = () => {
        if (this.phase !== 'what' && this.phase !== 'where') return;
        const k = Math.min(1, (now() - t0) / ms);
        this.paint(this.maskC, 1 - (1 - floor) * k, true);
        if (k < 1) this.fadeId = raf(step);
      };
      this.fadeId = raf(step);
    }
    drawFix(k) {
      this.paint(null, 1, true);
      if (!this.ctx) return;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      glFocus(this.ctx, this.R, k);
    }
    prepare() {
      const t = this.p.trials[this.run.i], W = this.canvas.width, k = this.dpr;
      const sc = this.stimC.getContext('2d');
      sc.setTransform(1, 0, 0, 1, 0, 0);
      sc.clearRect(0, 0, W, W);
      sc.setTransform(k, 0, 0, k, 0, 0);
      glStim(sc, this.R, this.p, t, this.G);
      const mc = this.maskC.getContext('2d');
      mc.setTransform(1, 0, 0, 1, 0, 0);
      mc.clearRect(0, 0, W, W);
      mc.setTransform(k, 0, 0, k, 0, 0);
      glMask(mc, this.R, t.mask, this.maskShapes, 'rgba(214,222,236,.62)', this.G);
    }
    // ---- one photo: focusing, the photo, the shutter closing, then the two answers
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
      this.line('find');
      this.goBtn.classList.add('away');
      this.goBtn.disabled = true;
      this.app.steady(true);
      this.phase = 'fix';
      this.runLook();
    }
    runLook() {
      const p = this.p, t = p.trials[this.run.i];
      const lead = GL_LEAD_MS;
      const fix = t.fix + lead, ring = GL_RING_MS + lead;
      const st = { deltas: [], start: null, last: null, onset: null, offset: null, end: null, gap: 0, plan: null, T: null, lead };
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
          else if (ts - st.start < ring) this.drawFix((ts - st.start) / ring);
          else if (!st.ringDone) { st.ringDone = true; this.drawFix(1); }
          if (st.start !== ts && ts - st.start >= fix) {
            st.T = frameEstimate(st.deltas, this.app.frameMs);
            this.app.frameMs = st.T;
            st.plan = this.G.plan(p, this.run, st.T);
            this.paint(this.stimC);
            st.onset = ts;
            this.phase = 'stim';
            if (this.practice && this.run.i === 0) this.showMarks(t);
          }
        } else if (this.phase === 'stim') {
          if (ts - st.onset >= (st.plan.frames - 0.5) * st.T) {
            if (this.practice) this.hideMarks();
            this.paint(this.maskC, 1, true);
            st.offset = ts;
            this.phase = 'mask';
            Sound.play('shutter');
          }
        } else if (this.phase === 'mask') {
          if (ts - st.offset >= p.maskMs - st.T / 2) {
            st.end = ts;
            this.app.steady(false);
            this.askWhat();
            this.fadeMask();
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
      this.paint(null, 1, true);
      this.app.steady(false);
      this.hideMarks();
      this.log('interrupted', { move_no: this.run.i + 1, detail: ph + ', ' + reason });
      this.phase = 'ready';
      this.goBtn.disabled = false;
      this.goBtn.classList.remove('away');
    }
    onHidden() { this.abort('page hidden'); }
    askWhat() {
      this.phase = 'what';
      this.ans = {};
      this.line('what');
      this.askEl.textContent = '';
      this.askEl.className = 'gl-ask what';
      this.askEl.append(h('b', { text: '?' }));
      this.askEl.hidden = false;
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
      // with feedback on (free play, practice) a wrong animal ends the look at once: the second
      // question could no longer save it. Without feedback both answers are kept.
      const t = this.p.trials[this.run.i];
      if (this.p.periph && !(k !== t.c && (this.o.feedback || this.practice))) this.askWhere(); else this.finishLook();
    }
    // during the first practice photo, soft rings round the two things to remember
    // (a hand would say "tap", and this is the moment to look)
    showMarks(t) {
      this.hideMarks();
      const at = [[this.R, this.R, 0.52]];
      if (this.p.periph) { const q = glXY(this.G, this.R, this.G.slotOf(t.ring, t.dir)); at.push([q[0], q[1], 0.36]); }
      this.marks = at.map(([x, y, d]) => {
        const m = h('i', { class: 'gl-mark', 'aria-hidden': 'true' });
        const size = Math.round(d * this.R);
        m.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + size + 'px;height:' + size + 'px;margin:' + -size / 2 + 'px 0 0 ' + -size / 2 + 'px';
        this.lens.append(m);
        return m;
      });
    }
    hideMarks() { (this.marks || []).forEach((m) => m.remove()); this.marks = null; }
    askWhere() {
      this.phase = 'where';
      this.choiceEl.classList.add('gone');
      this.askEl.hidden = true;
      this.line('where');
      this.placeSpots();
      this.spotBtns.forEach((b) => { b.className = 'gl-spot'; b.disabled = false; b.textContent = ''; b.append(glSvg(this.tg)); });
      this.spotsEl.classList.add('asking');
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
      this.askEl.hidden = true;
      this.spotsEl.classList.remove('asking');
      const p = this.p, t = p.trials[this.run.i], st = this.st, a = this.ans;
      const asked = p.periph && a.d != null;
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
        cls: correct ? 'correct' : !cOk && asked && !dOk ? 'both_wrong' : !cOk ? 'center_wrong' : 'where_wrong',
        refresh_ms: r4(st.T), frames: st.plan.frames, flash_ms: r4(planned), flash_measured_ms: r4(measured), frame_drop: drop ? 1 : 0,
        fix_ms: Math.round(st.onset - st.start), mask_ms: Math.round(st.end - st.offset),
        target: p.periph ? t.tg || this.tg : '', shown: p.pair[t.c], chosen: p.pair[a.c],
        ring: p.periph ? t.ring : '', dir: p.periph ? t.dir : '', dir_chosen: asked ? a.d : '', n_distract: p.periph ? t.d.length : '',
        rt_center_ms: a.rtC, rt_where_ms: asked ? a.rtW : '',
        stair_next_ms: rec.next == null ? '' : rec.next, reversal: p.fixedMs ? '' : rec.rev,
        field_px: Math.round(this.R),
      });
      const show = this.o.feedback || this.practice;
      this.feedback(correct, cOk, dOk, t, a, show);
      this.renderDots();
      this.updateStatus();
      this.app.touch();
      this.later(() => this.nextLook(), show ? 1500 : 300);
    }
    // the shutter opens on the photo: green rings round what was right, red where a tap went wrong;
    // then the photo goes into the album
    feedback(correct, cOk, dOk, t, a, show) {
      if (!show) { Sound.play('tick'); this.choiceEl.hidden = true; this.spotsEl.hidden = true; this.paint(null, 1, true); return; }
      this.choiceEl.hidden = true;
      this.spotsEl.hidden = true;
      this.paint(this.stimC);
      this.rings = [];
      const ring = (x, y, d, cls) => {
        const m = h('i', { class: 'gl-ring ' + cls, 'aria-hidden': 'true' });
        const size = Math.round(d * this.R);
        m.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + size + 'px;height:' + size + 'px;margin:' + -size / 2 + 'px 0 0 ' + -size / 2 + 'px';
        this.lens.append(m);
        this.rings.push(m);
      };
      ring(this.R, this.R, 0.48, cOk ? 'ok' : 'show');
      let spark = null;
      if (this.p.periph) {
        const q = glXY(this.G, this.R, this.G.slotOf(t.ring, t.dir));
        ring(q[0], q[1], 0.32, a.d == null ? 'show' : dOk ? 'ok' : 'show');
        if (a.d != null && !dOk) {
          const rr = this.G.ringR[t.ring - 1] * this.R, an = (a.d * Math.PI) / 4;
          ring(this.R + Math.sin(an) * rr, this.R - Math.cos(an) * rr, 0.24, 'bad');
        }
        spark = q;
      }
      this.line(correct ? 'ok' : !cOk ? 'center' : 'spot');
      Sound.play(correct ? 'yes' : 'no');
      buzz(correct ? 12 : [24, 40, 24]);
      if (correct) {
        const L = relPos(this, this.lens);
        const q = spark || [this.R, this.R];
        sparks(this, L.x - this.R + q[0], L.y - this.R + q[1], ['#FFC83A', '#FFFFFF', '#7CE3B0'], 12);
      }
      // a small copy of the photo for the album
      try {
        const th = document.createElement('canvas');
        th.width = th.height = 96;
        th.getContext('2d').drawImage(this.stimC, 0, 0, this.stimC.width, this.stimC.height, 0, 0, 96, 96);
        this.album[this.run.i - 1] = { url: th.toDataURL('image/png'), ok: correct };
      } catch (e) { /* the album is only a picture */ }
    }
    clearReveal() {
      (this.rings || []).forEach((m) => m.remove());
      this.rings = null;
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
    // ---- status: the speed of the camera
    nextMs() {
      if (this.p.fixedMs) return this.p.fixedMs[Math.min(this.run.i, this.p.n - 1)];
      return this.run.ms;
    }
    goal() {
      const ms = this.nextMs();
      const txt = secs(ms) + ' s';
      if (this.goalTxt !== txt) {
        const faster = this.goalMs != null && ms < this.goalMs;
        this.goalTxt = txt;
        this.goalMs = ms;
        this.goalEl.textContent = '';
        this.goalEl.append(icon('camera'), h('span', { text: txt }));
        if (faster) { this.goalEl.classList.remove('bump'); void this.goalEl.offsetWidth; this.goalEl.classList.add('bump'); }
      }
      this.goalEl.classList.add('speed');
      this.goalEl.hidden = !(this.o.counter || this.practice);
      this.goalEl.setAttribute('aria-label', 'Next photo shows for ' + txt);
    }
    updateStatus() {
      super.updateStatus();
      this.meterEl.hidden = true;
    }
    // the album: a frame for every photo of the round, the photo in it once taken
    renderDots() {
      const n = this.p.n, res = this.run.res, show = this.o.feedback || this.practice;
      this.dotsEl.textContent = '';
      for (let i = 0; i < n; i++) {
        const r = res[i], ph = this.album[i];
        const fr = h('i', { class: r ? (show ? (r.ok ? 'ok' : 'bad') : 'done') : i === res.length && !this.summary ? 'now' : '' });
        if (ph && show) fr.append(h('img', { src: ph.url, alt: '' }));
        this.dotsEl.append(fr);
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
      this.paint(null, 1, true);
      this.app.steady(false);
      this.phase = 'done';
      this.goBtn.hidden = true;
      this.choiceEl.hidden = true;
      this.spotsEl.hidden = true;
      this.askEl.hidden = true;
      this.hideMarks();
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
        success: complete && !this.practice && this.G.success(this.p, g),
        duration_ms: dur, first_move_ms: null, hidden_ms: Math.round(this.hiddenMs),
        moves: g.n, reference: null, par: null, efficiency: '',
        stars, gl: g,
      };
    }
    // passed: at most one look wrong of the three
    practicePassed(sm) { return sm.outcome === 'complete' && !!sm.gl && sm.gl.correct >= sm.gl.n - 1; }
    recordState(rec) {
      const reached = this.run.res.filter((x) => x.ok && x.next != null).map((x) => x.next);
      if (!reached.length) return '';
      const best = Math.min.apply(null, reached);
      return best < rec && secs(best) !== secs(rec) ? 'live' : '';
    }
    celebrate(sm) {
      this.renderDots();
      return this.trialCelebrate(sm, CONFETTI.glimpse);
    }
    resultTitle(sm) {
      if (sm.outcome !== 'complete') return super.resultTitle(sm);
      if (this.practice) return sm.passed ? 'Got it!' : 'Once more';
      if (!this.o.counter) return 'Done!';
      if (sm.gl.correct === sm.gl.n) return 'Perfect!';
      return sm.stars === 3 ? 'Great!' : sm.stars === 2 ? 'Nice!' : 'Done!';
    }
    // the round's photos as an album page, and the fastest the camera got
    resultStats(sm) {
      const g = sm.gl;
      if (!g || !g.n) return null;
      const fr = document.createDocumentFragment();
      const shots = this.album.filter(Boolean);
      if (shots.length && (this.o.feedback || this.practice)) {
        fr.append(h('div', { class: 'res-album', 'aria-hidden': 'true' }, shots.map((ph) => h('i', { class: ph.ok ? 'ok' : 'bad' }, h('img', { src: ph.url, alt: '' })))));
      }
      fr.append(h('div', { class: 'res-stats' },
        h('span', { 'aria-label': 'Fastest photo' }, icon('camera'), h('b', { text: g.reach_ms != null ? secs(g.reach_ms) + ' s' : '–' })),
        h('span', { 'aria-label': 'Photos right' }, icon('check'), h('b', { text: g.correct + '/' + g.n }))));
      return fr;
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

  // -------------------------------------------------------------- Stacks
  // One illustrated scene per place on a 100 x 136 board: the goal at the
  // top, three posts below. Pieces are drawn in three-quarter view around
  // their middle and stack SK_STEP apart; each stack is redrawn bottom to top
  // so the upper piece always covers the lower.
  const SK_X = [20, 50, 80], SK_BASE = 122, SK_STEP = 10.4, SK_HOVER = 66, SK_MINI = 0.46;
  const skSlotY = (k) => SK_BASE - SK_STEP / 2 - k * SK_STEP;
  const skPostTop = (cap) => SK_BASE - cap * SK_STEP - 4;
  const SK_GLYPH = [
    'M0 -2.3a2.3 2.3 0 1 1 0 4.6a2.3 2.3 0 1 1 0-4.6z',
    'M0 -2.7L2.7 2.1H-2.7z',
    'M-2.1 -2.1h4.2v4.2h-4.2z',
    'M0 -2.9L2.9 0L0 2.9L-2.9 0z',
  ];
  // the cake's layers, biggest first: the width tells them apart
  const SK_CAKE_W = [26, 21, 16, 11];
  const SK_LOOKS = {
    stones: { names: ['blue stone', 'red stone', 'green stone'], fill: ['#6F90C2', '#C9654C', '#6E9F5D'], rod: '#8A5C3B', puff: ['#E9D3A6', '#D5C091', '#FFFFFF'], post: 'post' },
    station: { names: ['blue suitcase', 'red suitcase', 'yellow suitcase'], fill: ['#4C78BE', '#D9493E', '#EDB43A'], rod: '#8E9AAA', puff: ['#FFFFFF', '#D9DEE5', '#F2C14E'], post: 'trolley' },
    harbor: { names: ['red container', 'blue container', 'yellow container', 'green container'], fill: ['#D24B3E', '#2F6DB0', '#E7B12F', '#3E9A55'], ink: ['#FFFFFF', '#FFFFFF', '#3A2A00', '#FFFFFF'], rod: '#38506A', puff: ['#FFFFFF', '#C9D2DB', '#F0B23A'], post: 'post' },
    icecream: { names: ['chocolate scoop', 'strawberry scoop', 'vanilla scoop with the cherry', 'mint scoop'], fill: ['#7B4A2D', '#F39AB5', '#F8EAC8', '#9FDCC3'], rod: '#E0A35E', puff: ['#FF6FA7', '#FFD23F', '#7AD3F7', '#FFFFFF'], post: 'cone', cherry: 2 },
    bakery: { names: ['strawberry layer', 'chocolate layer', 'lemon layer'], fill: ['#EE8AA3', '#8A5537', '#F0CF63'], ink: ['#FFFFFF', '#FFE6C2', '#7A5A00'], rod: '#D9B98C', puff: ['#FF6FA7', '#FFD23F', '#7AD3F7', '#FFFFFF'], post: 'stand' },
    cake: { names: ['biggest layer', 'big layer', 'small layer', 'smallest layer'], fill: ['#A7D3B4', '#F4A9BF', '#F6D67C', '#BCA8E8'], rod: '#D9B98C', puff: ['#FF6FA7', '#FFD23F', '#7AD3F7', '#FFFFFF'], post: 'stand' },
  };
  // half a piece's width, for its halo and its shadow
  const skHalf = (look, id) => (look === 'cake' ? SK_CAKE_W[id] / 2 : look === 'icecream' ? 8.8 : 12.2);
  function skMix(hex, t) {
    const n = parseInt(hex.slice(1), 16), to = t > 0 ? 255 : 0, k = Math.abs(t);
    const f = (c) => Math.round(c + (to - c) * k).toString(16).padStart(2, '0');
    return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
  }
  const skLin = (id, stops, x2, y2) => s('linearGradient', { id, x1: 0, y1: 0, x2: x2 == null ? 1 : x2, y2: y2 || 0 }, stops.map(([o, c, a]) => s('stop', { offset: o, 'stop-color': c, 'stop-opacity': a == null ? 1 : a })));
  // gradients for one card: per piece a side and a top, plus wood, steel and the rest
  function skDefs(uid, look) {
    const L = SK_LOOKS[look], d = s('defs');
    L.fill.forEach((c, i) => {
      if (look === 'harbor' || look === 'station') {
        d.append(skLin(uid + 'p' + i, [[0, skMix(c, 0.14)], [0.55, c], [1, skMix(c, -0.24)]], 0, 1));
      } else if (look === 'stones' || look === 'icecream') {
        const ice = look === 'icecream';
        d.append(s('radialGradient', { id: uid + 'p' + i, cx: 0.36, cy: ice ? 0.26 : 0.18, r: 0.86 }, s('stop', { offset: 0, 'stop-color': skMix(c, ice ? 0.36 : 0.42) }), s('stop', { offset: 0.45, 'stop-color': skMix(c, 0.06) }), s('stop', { offset: 0.8, 'stop-color': skMix(c, ice ? -0.1 : -0.16) }), s('stop', { offset: 1, 'stop-color': skMix(c, ice ? -0.26 : -0.36) })));
      } else {
        d.append(skLin(uid + 'p' + i, [[0, skMix(c, -0.28)], [0.22, skMix(c, 0.1)], [0.5, c], [0.86, skMix(c, -0.18)], [1, skMix(c, -0.36)]]));
        d.append(s('radialGradient', { id: uid + 't' + i, cx: 0.38, cy: 0.3, r: 0.75 }, s('stop', { offset: 0, 'stop-color': skMix(c, 0.38) }), s('stop', { offset: 1, 'stop-color': skMix(c, 0.06) })));
      }
    });
    d.append(skLin(uid + 'wood', [[0, '#6A4225'], [0.35, '#A26E45'], [0.7, '#8A5C3B'], [1, '#5B381E']]));
    d.append(skLin(uid + 'steel', [[0, '#4E6984'], [0.5, '#6E8AA6'], [1, '#34495E']]));
    d.append(skLin(uid + 'dowel', [[0, '#C7A06C'], [0.45, '#F1DDB8'], [1, '#B98F5C']]));
    d.append(skLin(uid + 'chrome', [[0, '#76818D'], [0.4, '#E4E9EE'], [0.72, '#B4BEC8'], [1, '#6E7985']]));
    d.append(skLin(uid + 'cone', [[0, '#C98A45'], [0.4, '#EDBB78'], [1, '#B9773A']]));
    d.append(s('pattern', { id: uid + 'waf', width: 2.4, height: 2.4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      s('path', { d: 'M1.2 0V2.4M0 1.2H2.4', stroke: 'rgba(125,72,24,.5)', 'stroke-width': 0.42 })));
    d.append(s('filter', { id: uid + 'blur', x: '-50%', y: '-50%', width: '200%', height: '200%' }, s('feGaussianBlur', { stdDeviation: '0.9' })));
    d.append(s('clipPath', { id: uid + 'clip' }, s('rect', { x: 0, y: 0, width: 100, height: 136, rx: 7 })));
    return d;
  }
  // one piece around its middle; mini (the goal card) leaves out the stub of the post
  function skPiece(uid, look, id, mini) {
    const L = SK_LOOKS[look], c = L.fill[id];
    const g = s('g', null);
    if (look === 'harbor') {
      g.append(
        s('path', { d: 'M-12 -4.2L-10.4 -6.9H10.4L12 -4.2Z', fill: skMix(c, 0.26) }),
        s('rect', { x: -12, y: -4.2, width: 24, height: 9.4, rx: 0.5, fill: 'url(#' + uid + 'p' + id + ')' }));
      let corr = '', lite = '';
      for (let x = -10.2; x <= 10.3; x += 1.7) { corr += 'M' + x.toFixed(1) + ' -3V4'; lite += 'M' + (x + 0.55).toFixed(2) + ' -3V4'; }
      g.append(
        s('path', { d: corr, stroke: 'rgba(0,0,0,.2)', 'stroke-width': 0.42 }),
        s('path', { d: lite, stroke: 'rgba(255,255,255,.16)', 'stroke-width': 0.3 }),
        s('rect', { x: -12, y: -4.2, width: 24, height: 1, fill: 'rgba(255,255,255,.18)' }),
        s('rect', { x: -12, y: 4, width: 24, height: 1.2, fill: skMix(c, -0.4) }));
      for (const [x, y] of [[-12, -4.2], [10.5, -4.2], [-12, 3.7], [10.5, 3.7]]) g.append(s('rect', { x, y, width: 1.5, height: 1.5, rx: 0.2, fill: '#262B33', opacity: 0.85 }));
      g.append(s('rect', { x: -4, y: -2.6, width: 8, height: 6.4, rx: 0.8, fill: 'rgba(0,0,0,.14)' }),
        s('path', { d: SK_GLYPH[id], fill: L.ink[id], transform: 'translate(0 0.6)' }));
    } else if (look === 'station') {
      // a suitcase lying flat: its long side faces us, with the handle in the middle
      const dk = skMix(c, -0.45);
      g.append(
        s('rect', { x: -12, y: -4.7, width: 24, height: 9.4, rx: 2.2, fill: 'url(#' + uid + 'p' + id + ')' }),
        s('rect', { x: -10.4, y: -4.15, width: 20.8, height: 0.9, rx: 0.45, fill: '#FFFFFF', opacity: 0.26 }),
        s('path', { d: 'M-11.2 3.4H11.2', stroke: dk, 'stroke-width': 0.5, opacity: 0.4 }));
      if (id === 0) {
        // the old leather one: two straps with buckles
        for (const x of [-7.6, 6]) g.append(s('rect', { x, y: -4.7, width: 1.6, height: 9.4, fill: '#9C6439' }), s('rect', { x: x - 0.35, y: 0.6, width: 2.3, height: 1.9, rx: 0.3, fill: 'none', stroke: '#E8CB86', 'stroke-width': 0.42 }));
      } else if (id === 1) {
        // the hard case: a seam round the middle and ribs along it
        g.append(s('path', { d: 'M-11.6 -0.2H11.6', stroke: dk, 'stroke-width': 0.6, opacity: 0.55 }),
          s('path', { d: 'M-10.4 1.8H10.4M-10.4 -2.2H10.4', stroke: '#FFFFFF', 'stroke-width': 0.42, opacity: 0.3 }));
      } else {
        // stitched all round
        g.append(s('rect', { x: -10.7, y: -3.4, width: 21.4, height: 6.8, rx: 1.4, fill: 'none', stroke: skMix(c, -0.32), 'stroke-width': 0.4, 'stroke-dasharray': '0.9 0.7' }));
      }
      // leather corners
      const cap = 'M-12 -1.7V-2.5A2.2 2.2 0 0 1 -9.8 -4.7H-9V-3.6H-9.6Q-10.9 -3.6 -10.9 -2.3V-1.7Z';
      for (const t of ['', 'scale(-1 1)', 'scale(1 -1)', 'scale(-1 -1)']) g.append(s('path', { d: cap, fill: '#5A3A24', opacity: 0.8, transform: t }));
      // the handle on top, on two brass mounts, and the latches
      g.append(
        s('path', { d: 'M-3.4 -4.6V-5.9Q-3.4 -7.4 -1.9 -7.4H1.9Q3.4 -7.4 3.4 -5.9V-4.6', stroke: '#3B2A22', 'stroke-width': 1.25, fill: 'none' }),
        s('rect', { x: -4.4, y: -5.3, width: 2, height: 1.2, rx: 0.4, fill: '#D9B76A' }),
        s('rect', { x: 2.4, y: -5.3, width: 2, height: 1.2, rx: 0.4, fill: '#D9B76A' }));
      if (id) for (const x of [-6.6, 4.8]) g.append(s('rect', { x, y: -4.4, width: 1.8, height: 2.2, rx: 0.4, fill: '#D9B76A' }), s('rect', { x: x + 0.5, y: -3.4, width: 0.8, height: 0.6, fill: '#8A6A2A' }));
    } else if (look === 'icecream') {
      // a round scoop with a frilly edge where it sits; the vanilla one carries the cherry
      let d = 'M-8.6 2.6C-9.8 -3.6 -5.2 -8.8 0 -8.8C5.2 -8.8 9.8 -3.6 8.6 2.6';
      for (let i = 0; i < 5; i++) { const x0 = 8.6 - i * 3.44, x1 = x0 - 3.44; d += 'Q' + ((x0 + x1) / 2).toFixed(2) + ' 6.4 ' + x1.toFixed(2) + ' 2.6'; }
      g.append(s('path', { d: d + 'Z', fill: 'url(#' + uid + 'p' + id + ')' }),
        s('path', { d: 'M-7.8 2.2C-4.6 3.8 4.6 3.8 7.8 2.2', stroke: skMix(c, -0.3), 'stroke-width': 0.8, fill: 'none', opacity: 0.45 }),
        s('ellipse', { cx: -3.3, cy: -5.2, rx: 2.9, ry: 1.3, fill: '#FFFFFF', opacity: 0.42, transform: 'rotate(-24 -3.3 -5.2)' }));
      const dots = id === 1 ? [[-4.8, -1.4, 0.5], [2.4, -4.6, 0.45], [5.2, -0.8, 0.5], [-1.2, 0.6, 0.45], [3.2, 1.6, 0.4], [-5.8, 1.4, 0.4]]
        : id === 2 ? [[-4.2, -0.8, 0.26], [1.8, -3.6, 0.24], [4.8, 0.4, 0.26], [-1.4, 1.4, 0.22], [3.4, -6, 0.22]]
          : id === 3 ? [[-5, -2, 0.6], [1.6, -5.2, 0.55], [5.4, -1.6, 0.6], [-1.8, 0.8, 0.55], [3.6, 1.4, 0.5], [-4.6, -5.4, 0.45]] : [];
      dots.forEach(([x, y, r]) => g.append(s('circle', { cx: x, cy: y, r, fill: id === 1 ? '#D9476E' : id === 3 ? '#4A2E1C' : '#6B4A2A', opacity: id === 1 ? 0.75 : id === 3 ? 0.8 : 0.55 })));
      if (id === L.cherry) {
        g.append(
          s('path', { d: 'M0.9 -11.4Q1.4 -14.8 4.6 -16', stroke: '#6E7B2E', 'stroke-width': 0.65, fill: 'none', 'stroke-linecap': 'round' }),
          s('circle', { cx: 0.5, cy: -9.9, r: 2.7, fill: '#D61F3A' }),
          s('path', { d: 'M-1.9 -8.6A2.7 2.7 0 0 0 3.1 -9.2A3.4 3.4 0 0 1 -1.9 -8.6Z', fill: '#9E1028', opacity: 0.6 }),
          s('circle', { cx: -0.5, cy: -10.9, r: 0.8, fill: '#FFFFFF', opacity: 0.8 }));
      }
    } else if (look === 'cake') {
      // a round layer: icing on the side, piped swags under the top, pearls along the bottom
      const rx = SK_CAKE_W[id] / 2, ry = rx * 0.2;
      const front = (x, y0) => y0 + ry * Math.sqrt(Math.max(0, 1 - (x / rx) * (x / rx)));
      g.append(
        s('path', { d: 'M' + -rx + ' -5.2V5.2A' + rx + ' ' + ry + ' 0 0 0 ' + rx + ' 5.2V-5.2Z', fill: 'url(#' + uid + 'p' + id + ')' }),
        s('ellipse', { cx: 0, cy: -5.2, rx, ry, fill: 'url(#' + uid + 't' + id + ')' }));
      const nS = Math.max(2, Math.round(rx / 3)), sw = (2 * rx - 1.6) / nS;
      let sd = '';
      for (let i = 0; i < nS; i++) {
        const xa = -rx + 0.8 + i * sw, xb = xa + sw, ya = front(xa, -5.2) + 0.5, yb = front(xb, -5.2) + 0.5;
        sd += 'M' + xa.toFixed(2) + ' ' + ya.toFixed(2) + 'Q' + ((xa + xb) / 2).toFixed(2) + ' ' + (Math.max(ya, yb) + 2.8).toFixed(2) + ' ' + xb.toFixed(2) + ' ' + yb.toFixed(2);
      }
      g.append(s('path', { d: sd, stroke: '#FFFFFF', 'stroke-width': 0.6, fill: 'none', opacity: 0.9, 'stroke-linecap': 'round' }));
      const m = Math.max(4, Math.round(rx / 1.15));
      for (let i = 0; i <= m; i++) {
        const x = -rx + 0.7 + (i * (2 * rx - 1.4)) / m;
        g.append(s('circle', { cx: x.toFixed(2), cy: (front(x, 5.2) - 0.45).toFixed(2), r: 0.62, fill: '#FFFDF8' }));
      }
      // the smallest layer is always on top, so it gets the sugar flowers
      if (id === SK_CAKE_W.length - 1) {
        g.append(s('path', { d: 'M1.6 -6.4q2 -1.2 3 .2q-1.8 .9 -3 -.2z', fill: '#7DB46C' }), s('path', { d: 'M-1.8 -6.2q-2 -1.1 -3 .3q1.9 .8 3 -.3z', fill: '#7DB46C' }));
        for (const [x, y, f] of [[-1.7, -6.4, '#FFFFFF'], [1.6, -6.7, '#F7A8C0'], [0, -7.9, '#FFFFFF']]) g.append(s('circle', { cx: x, cy: y, r: 1.2, fill: f }), s('circle', { cx: x, cy: y, r: 0.42, fill: '#F2C14E' }));
      }
    } else if (look === 'bakery') {
      g.append(
        s('path', { d: 'M-12 -5.2V5.2A12 2.8 0 0 0 12 5.2V-5.2Z', fill: 'url(#' + uid + 'p' + id + ')' }),
        s('path', { d: 'M-12 2.2A12 2.8 0 0 0 12 2.2', stroke: skMix(c, 0.5), 'stroke-width': 1.2, fill: 'none' }),
        s('ellipse', { cx: 0, cy: -5.2, rx: 12, ry: 2.8, fill: '#FFF7EE' }),
        s('path', { d: 'M-12 -5.2A12 2.8 0 0 0 12 -5.2', stroke: '#FFF7EE', 'stroke-width': 1.6, fill: 'none' }));
      for (const [x, len] of [[-9.2, 2.4], [-4.4, 3.6], [1.2, 2], [6.4, 3.2]]) {
        const ya = -5.2 + 2.8 * Math.sqrt(1 - (x / 12) * (x / 12));
        g.append(s('rect', { x: x - 1.1, y: ya - 1, width: 2.2, height: len + 1, rx: 1.1, fill: '#FFF7EE' }));
      }
      if (!mini) {
        const sp = ['#FF6FA7', '#FFD23F', '#58C4F0', '#6FD38C'];
        [[-6, -5.6, 20], [-2.4, -6.6, -35], [2.6, -5.2, 60], [6.8, -6.2, -10], [-8.6, -4.9, 75], [0.4, -4.4, -60], [4.6, -7, 30]].forEach(([x, y, a], i) => g.append(s('rect', { x: x - 0.6, y: y - 0.18, width: 1.2, height: 0.36, rx: 0.18, fill: sp[i % 4], transform: 'rotate(' + a + ' ' + x + ' ' + y + ')' })));
      }
      g.append(s('path', { d: SK_GLYPH[id], fill: 'rgba(0,0,0,.18)', transform: 'translate(0.3 2.4)' }),
        s('path', { d: SK_GLYPH[id], fill: L.ink[id], transform: 'translate(0 2)' }));
      if (!mini) g.append(s('g', { class: 'sk-stub' }, s('ellipse', { cx: 0, cy: -5.2, rx: 1.1, ry: 0.45, fill: '#7A5A3C', opacity: 0.6 }), s('rect', { x: -0.75, y: -9.2, width: 1.5, height: 4, fill: 'url(#' + uid + 'dowel)' })));
    } else {
      // a smooth river stone: a domed lens, lit from the upper left, with a hole for the stake
      g.append(
        s('path', { d: 'M-12.4 0.2C-12.6 -3.7 -7.6 -6 0 -6C7.8 -6 12.8 -3.5 12.4 0.4C12.1 3.8 7 5.7 -0.4 5.7C-7.6 5.7 -12.2 3.7 -12.4 0.2Z', fill: 'url(#' + uid + 'p' + id + ')' }),
        s('path', { d: 'M-10.6 2.4C-6 5.2 6.4 5.4 10.8 2.2', stroke: 'rgba(0,0,0,.16)', 'stroke-width': 1.1, 'stroke-linecap': 'round', fill: 'none' }),
        s('ellipse', { cx: -4.6, cy: -3.3, rx: 3.4, ry: 0.95, fill: '#FFFFFF', opacity: 0.32, transform: 'rotate(-6 -4.6 -3.3)' }));
      const dots = [[-8.4, -1.6], [-6.4, 2.2], [-2.8, -0.2], [4.4, 2.6], [7.6, -1.4], [9.2, 1.2], [-9.6, 0.8], [5.4, -3.2], [1.6, 3.6]];
      dots.forEach(([x, y], i) => g.append(s('circle', { cx: x + id * 0.6 - 0.6, cy: y, r: i % 3 === 0 ? 0.42 : 0.28, fill: i % 2 ? skMix(c, -0.35) : skMix(c, 0.45), opacity: 0.7 })));
      g.append(s('path', { d: SK_GLYPH[id], fill: 'rgba(255,255,255,.34)', transform: 'translate(0 1.25)' }),
        s('path', { d: SK_GLYPH[id], fill: skMix(c, -0.42), transform: 'translate(0 0.85)' }));
      if (!mini) g.append(s('g', { class: 'sk-stub' }, s('ellipse', { cx: 0, cy: -5.1, rx: 1.9, ry: 0.7, fill: '#2E2013', opacity: 0.65 }), s('rect', { x: -1.55, y: -9.6, width: 3.1, height: 4.5, fill: 'url(#' + uid + 'wood)' })));
    }
    return g;
  }
  function skPost(uid, look, k, cap) {
    const x = SK_X[k], top = skPostTop(cap);
    const g = s('g', { class: 'sk-post' });
    if (look === 'harbor') {
      g.append(
        s('rect', { x: x - 15.5, y: SK_BASE - 0.4, width: 31, height: 2.4, rx: 0.6, fill: '#566270' }),
        s('path', { d: 'M' + (x - 15.5) + ' ' + (SK_BASE + 0.4) + 'h31', stroke: '#F2C14E', 'stroke-width': 0.9, 'stroke-dasharray': '1.6 1.6' }));
      for (const gx of [x - 14.4, x + 12.8]) {
        g.append(s('rect', { x: gx, y: top, width: 1.6, height: SK_BASE - top, rx: 0.4, fill: 'url(#' + uid + 'steel)' }));
      }
      g.append(s('rect', { x: x - 14.4, y: top - 0.8, width: 28.8, height: 1.6, rx: 0.5, fill: 'url(#' + uid + 'steel)' }),
        s('path', { d: 'M' + (x - 14.4) + ' ' + (top + 3.4) + 'l1.6 -1.6M' + (x + 12.8) + ' ' + (top + 1.8) + 'l1.6 1.6', stroke: '#F2C14E', 'stroke-width': 0.9 }));
    } else if (look === 'station') {
      // a luggage trolley: a low deck on two wheels, its handle frame as high as it can carry
      g.append(
        s('ellipse', { cx: x, cy: SK_BASE + 7.4, rx: 14.5, ry: 1.3, fill: 'rgba(40,30,20,.16)' }),
        s('rect', { x: x - 13.5, y: top + 0.6, width: 1.5, height: SK_BASE - top, rx: 0.6, fill: 'url(#' + uid + 'chrome)' }),
        s('rect', { x: x + 12, y: top + 0.6, width: 1.5, height: SK_BASE - top, rx: 0.6, fill: 'url(#' + uid + 'chrome)' }),
        s('rect', { x: x - 14.2, y: top - 0.9, width: 28.4, height: 2.6, rx: 1.3, fill: '#2F3A48' }),
        s('rect', { x: x - 13.4, y: top - 0.5, width: 26.8, height: 0.7, rx: 0.35, fill: '#5C6A7C' }),
        s('path', { d: 'M' + (x - 10) + ' ' + (SK_BASE + 1.2) + 'v2.8M' + (x + 10) + ' ' + (SK_BASE + 1.2) + 'v2.8', stroke: '#6E7884', 'stroke-width': 1.3 }));
      for (const wx of [x - 10, x + 10]) g.append(s('circle', { cx: wx, cy: SK_BASE + 4.6, r: 2.5, fill: '#23272E' }), s('circle', { cx: wx, cy: SK_BASE + 4.6, r: 0.9, fill: '#C3CBD4' }));
      g.append(
        s('rect', { x: x - 14, y: SK_BASE - 0.8, width: 28, height: 2.4, rx: 0.8, fill: '#566270' }),
        s('rect', { x: x - 14, y: SK_BASE - 0.8, width: 28, height: 0.7, rx: 0.35, fill: '#8D99A6' }));
    } else if (look === 'icecream') {
      // a waffle cone standing in a little cup
      const cone = 'M' + (x - 6.4) + ' 120.6L' + x + ' 133.2L' + (x + 6.4) + ' 120.6Z';
      g.append(
        s('ellipse', { cx: x, cy: 134.7, rx: 6.4, ry: 1, fill: 'rgba(120,60,80,.16)' }),
        s('ellipse', { cx: x, cy: 127.6, rx: 4.7, ry: 1, fill: '#E6BFCC' }),
        s('path', { d: cone, fill: 'url(#' + uid + 'cone)' }), s('path', { d: cone, fill: 'url(#' + uid + 'waf)' }),
        s('rect', { x: x - 7, y: 118.9, width: 14, height: 2.9, rx: 1.4, fill: '#E9B36D' }),
        s('rect', { x: x - 7, y: 118.9, width: 14, height: 2.9, rx: 1.4, fill: 'url(#' + uid + 'waf)' }),
        s('path', { d: 'M' + (x - 4.7) + ' 127.6A4.7 1 0 0 0 ' + (x + 4.7) + ' 127.6Q' + (x + 4.2) + ' 133.6 ' + (x + 1.9) + ' 134H' + (x - 1.9) + 'Q' + (x - 4.2) + ' 133.6 ' + (x - 4.7) + ' 127.6Z', fill: '#FFFFFF' }),
        s('path', { d: 'M' + (x - 3.4) + ' 129.4Q' + (x - 3.1) + ' 132.4 ' + (x - 1.6) + ' 132.9', stroke: '#F4D9E2', 'stroke-width': 0.6, fill: 'none', 'stroke-linecap': 'round' }));
    } else if (look === 'bakery' || look === 'cake') {
      // a white cake stand on a short foot; the bakery's has a dowel as high as it can carry
      g.append(
        s('ellipse', { cx: x, cy: SK_BASE + 8.6, rx: 7.5, ry: 1.6, fill: 'rgba(80,50,40,.14)' }),
        s('path', { d: 'M' + (x - 2.4) + ' ' + (SK_BASE + 2) + 'L' + (x - 1.6) + ' ' + (SK_BASE + 7) + 'H' + (x + 1.6) + 'L' + (x + 2.4) + ' ' + (SK_BASE + 2) + 'Z', fill: '#E9E2DA' }),
        s('ellipse', { cx: x, cy: SK_BASE + 7.6, rx: 6, ry: 1.4, fill: '#F6F1EB' }),
        s('ellipse', { cx: x, cy: SK_BASE + 1.4, rx: 14.6, ry: 2.8, fill: '#E4DCD3' }),
        s('ellipse', { cx: x, cy: SK_BASE + 0.8, rx: 14.6, ry: 2.6, fill: '#FFFFFF' }),
        s('ellipse', { cx: x, cy: SK_BASE + 0.8, rx: 11.5, ry: 1.8, fill: 'none', stroke: '#EFE7DE', 'stroke-width': 0.4 }));
      if (look === 'cake') g.append(s('path', { d: 'M' + (x - 14.6) + ' ' + (SK_BASE + 0.8) + 'A14.6 2.6 0 0 0 ' + (x + 14.6) + ' ' + (SK_BASE + 0.8), stroke: '#E2BC6A', 'stroke-width': 0.5, fill: 'none' }));
      else g.append(
        s('rect', { x: x - 0.75, y: top + 1, width: 1.5, height: SK_BASE - top - 1, fill: 'url(#' + uid + 'dowel)' }),
        s('circle', { cx: x, cy: top + 1, r: 1.6, fill: '#E9A23B' }),
        s('circle', { cx: x - 0.5, cy: top + 0.5, r: 0.5, fill: '#FFE3A8' }));
    } else {
      g.append(
        s('ellipse', { cx: x, cy: SK_BASE + 2, rx: 9.5, ry: 2.4, fill: '#D3BC8B' }),
        s('ellipse', { cx: x, cy: SK_BASE + 1.6, rx: 6, ry: 1.3, fill: 'rgba(90,64,30,.25)' }),
        s('rect', { x: x - 1.55, y: top, width: 3.1, height: SK_BASE - top + 1.6, rx: 1.2, fill: 'url(#' + uid + 'wood)' }),
        s('path', { d: 'M' + (x - 0.4) + ' ' + (top + 3) + 'v' + (SK_BASE - top - 6) + 'M' + (x + 0.7) + ' ' + (top + 6) + 'v' + (SK_BASE - top - 12), stroke: 'rgba(40,20,5,.22)', 'stroke-width': 0.3 }),
        s('ellipse', { cx: x, cy: top + 0.3, rx: 1.55, ry: 0.65, fill: '#B98A5C' }));
    }
    return g;
  }
  // the scene behind the posts
  function skScene(uid, look) {
    const g = s('g', { 'aria-hidden': 'true' });
    if (look === 'harbor') {
      g.append(s('rect', { x: 0, y: 0, width: 100, height: 64, fill: '#D6E8F7' }),
        s('rect', { x: 0, y: 0, width: 100, height: 30, fill: '#C3DDF3' }));
      const city = [[8, 9], [13, 14], [19, 7], [25, 18], [31, 11], [60, 13], [66, 20], [72, 9], [78, 15], [84, 10], [90, 16]];
      city.forEach(([x, hh]) => g.append(s('rect', { x, y: 63 - hh, width: 5.2, height: hh, fill: '#AFC6DC' })));
      g.append(s('path', { d: 'M40 63V44M40 46H52M50 46V52M44 46L40 50M36 63L40 52L44 63', stroke: '#9BB5CF', 'stroke-width': 0.7, fill: 'none' }),
        s('rect', { x: 0, y: 62, width: 100, height: 52, fill: '#3F7FB7' }),
        s('rect', { x: 0, y: 62, width: 100, height: 16, fill: '#4A8AC0' }));
      let w = '';
      for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) { const x = 4 + c * 26 + (r % 2) * 12, y = 70 + r * 7; w += 'M' + x + ' ' + y + 'q2.2 -1.2 4.4 0t4.4 0'; }
      g.append(s('path', { d: w, stroke: 'rgba(255,255,255,.3)', 'stroke-width': 0.6, fill: 'none', 'stroke-linecap': 'round' }),
        s('rect', { x: 0, y: 112, width: 100, height: 24, fill: '#BFC6CF' }),
        s('rect', { x: 0, y: 112, width: 100, height: 1.6, fill: '#F2C14E' }),
        s('path', { d: 'M33 114V136M67 114V136', stroke: '#A7AFB9', 'stroke-width': 0.4 }));
      // the gantry crane: legs, braces and the beam the trolley runs on
      g.append(
        s('rect', { x: 1.8, y: 47, width: 4.4, height: 80, fill: '#F0B23A' }), s('rect', { x: 5, y: 47, width: 1.2, height: 80, fill: '#C98A1E' }),
        s('rect', { x: 93.8, y: 47, width: 4.4, height: 80, fill: '#F0B23A' }), s('rect', { x: 97, y: 47, width: 1.2, height: 80, fill: '#C98A1E' }),
        s('path', { d: 'M6 60L14 53M94 60L86 53', stroke: '#E2A22E', 'stroke-width': 1.4 }),
        s('rect', { x: 0, y: 46.6, width: 100, height: 6.4, fill: '#F0B23A' }),
        s('rect', { x: 0, y: 51.8, width: 100, height: 1.2, fill: '#C98A1E' }));
      let z = 'M0 51.8';
      for (let x = 0; x < 100; x += 5) z += 'L' + (x + 2.5) + ' 47.6L' + (x + 5) + ' 51.8';
      g.append(s('path', { d: z, stroke: '#D49624', 'stroke-width': 0.7, fill: 'none' }));
    } else if (look === 'station') {
      // a platform under its canopy, a train waiting behind
      g.append(s('rect', { x: 0, y: 0, width: 100, height: 52, fill: '#DCE5EC' }));
      for (const y of [11, 23, 35]) g.append(s('rect', { x: 0, y, width: 100, height: 1, fill: '#C4D1DB' }));
      // the train: green coach, a cream band of windows, a door
      g.append(
        s('rect', { x: 0, y: 49, width: 100, height: 51, fill: '#2F6A58' }),
        s('rect', { x: 0, y: 49, width: 100, height: 2.6, fill: '#8E9CA6' }),
        s('rect', { x: 0, y: 56.6, width: 100, height: 15.4, fill: '#EFE3C6' }),
        s('rect', { x: 0, y: 72, width: 100, height: 0.9, fill: '#D9B45E' }),
        s('rect', { x: 0, y: 90.5, width: 100, height: 0.9, fill: '#D9B45E' }));
      for (const x of [2, 15.6, 29.2, 42.8, 56.4, 70]) {
        g.append(s('rect', { x, y: 58.8, width: 9.6, height: 11, rx: 1.8, fill: '#2C3B45' }),
          s('path', { d: 'M' + (x + 1.6) + ' 68.4L' + (x + 6.4) + ' 60.4H' + (x + 8.4) + 'L' + (x + 3.6) + ' 68.4Z', fill: '#FFFFFF', opacity: 0.12 }));
      }
      g.append(s('rect', { x: 84, y: 55.6, width: 11, height: 43, rx: 1, fill: '#285D4D' }),
        s('rect', { x: 86.4, y: 59, width: 6.2, height: 10.6, rx: 1.4, fill: '#2C3B45' }),
        s('rect', { x: 92.2, y: 76, width: 1, height: 6, rx: 0.5, fill: '#D9B45E' }));
      // the platform: edge stones, the yellow line, paving
      g.append(
        s('rect', { x: 0, y: 98, width: 100, height: 38, fill: '#D5CEC1' }),
        s('rect', { x: 0, y: 98, width: 100, height: 3.2, fill: '#ECE6DA' }),
        s('rect', { x: 0, y: 101.2, width: 100, height: 0.6, fill: '#BDB5A7' }),
        s('rect', { x: 0, y: 104.4, width: 100, height: 1.8, fill: '#F2C14E' }),
        s('path', { d: 'M0 113.5H100M0 126H100M12 106.2V113.5M37 106.2V113.5M62 106.2V113.5M87 106.2V113.5M24 113.5V126M49 113.5V126M74 113.5V126M8 126V136M33 126V136M58 126V136M83 126V136', stroke: '#C4BCAE', 'stroke-width': 0.4 }));
      // the canopy's wooden edge with its saw-tooth trim, on two iron columns
      g.append(s('rect', { x: 1.6, y: 44, width: 3.2, height: 64, fill: '#2B4F45' }), s('rect', { x: 95.2, y: 44, width: 3.2, height: 64, fill: '#2B4F45' }),
        s('rect', { x: 0.6, y: 104.6, width: 5.2, height: 3.4, rx: 0.6, fill: '#24443B' }), s('rect', { x: 94.2, y: 104.6, width: 5.2, height: 3.4, rx: 0.6, fill: '#24443B' }),
        s('path', { d: 'M4.8 50Q4.8 46.6 9 46.4M95.2 50Q95.2 46.6 91 46.4', stroke: '#2B4F45', 'stroke-width': 1.1, fill: 'none' }));
      let saw = 'M0 47.4';
      for (let x = 0; x < 100; x += 3.125) saw += 'L' + (x + 1.5625).toFixed(3) + ' 50.6L' + (x + 3.125).toFixed(3) + ' 47.4';
      g.append(s('rect', { x: 0, y: 43.4, width: 100, height: 4.2, fill: '#F1E7D0' }), s('path', { d: saw + 'V47Z', fill: '#F1E7D0' }),
        s('rect', { x: 0, y: 43.4, width: 100, height: 0.9, fill: '#D8C8A6' }));
      // a hanging lamp and the station clock
      g.append(s('rect', { x: 10.5, y: 0, width: 1, height: 17, fill: '#5B6672' }),
        s('circle', { cx: 11, cy: 20.4, r: 6, fill: '#FFE7A6', opacity: 0.28 }),
        s('path', { d: 'M6.8 20L9.2 16.4H12.8L15.2 20Z', fill: '#2B4F45' }),
        s('circle', { cx: 11, cy: 20.8, r: 1.6, fill: '#FFF2C8' }));
      let ticks = '';
      for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6, r0 = i % 3 ? 4.6 : 3.9; ticks += 'M' + (89 + Math.cos(a) * r0).toFixed(2) + ' ' + (20 + Math.sin(a) * r0).toFixed(2) + 'L' + (89 + Math.cos(a) * 5.3).toFixed(2) + ' ' + (20 + Math.sin(a) * 5.3).toFixed(2); }
      g.append(s('rect', { x: 88.5, y: 0, width: 1, height: 13.4, fill: '#5B6672' }),
        s('circle', { cx: 89, cy: 20, r: 6.8, fill: '#26323D' }),
        s('circle', { cx: 89, cy: 20, r: 5.9, fill: '#FFFFFF' }),
        s('path', { d: ticks, stroke: '#26323D', 'stroke-width': 0.45 }),
        s('path', { d: 'M89 20L86.6 18.4M89 20L91.6 16.2', stroke: '#1C252E', 'stroke-width': 0.75, 'stroke-linecap': 'round' }),
        s('circle', { cx: 89, cy: 20, r: 0.6, fill: '#D6403A' }));
    } else if (look === 'icecream') {
      // mint walls with white stripes, a striped awning, pink lamps and a pink counter
      g.append(s('rect', { x: 0, y: 0, width: 100, height: 113, fill: '#D2F0E4' }));
      for (let x = 2.5; x < 100; x += 9) g.append(s('rect', { x, y: 0, width: 4.5, height: 113, fill: '#FFFFFF', opacity: 0.42 }));
      g.append(s('rect', { x: 0, y: 112, width: 100, height: 24, fill: '#FCEEF2' }),
        s('rect', { x: 0, y: 112, width: 100, height: 1.6, fill: '#F2C3D1' }),
        s('path', { d: 'M6 121C18 117 24 127 38 122S62 118 72 125M56 131C68 127 80 133 96 128M10 132C16 129 22 131 30 129', stroke: '#F1D4DD', 'stroke-width': 0.45, fill: 'none' }));
      [[9, 116.4, 30, '#FF6FA7'], [31, 128.6, -40, '#FFD23F'], [44, 116, 70, '#58C4F0'], [67, 117.6, -15, '#6FD38C'], [92, 124, 50, '#FF6FA7'], [58, 133.4, 15, '#58C4F0']].forEach(([x, y, a, f]) => g.append(s('rect', { x: x - 1, y: y - 0.3, width: 2, height: 0.6, rx: 0.3, fill: f, transform: 'rotate(' + a + ' ' + x + ' ' + y + ')' })));
      let sc = '';
      for (let x = 100; x > 0.1; x -= 6.25) sc += 'A3.125 3.125 0 0 1 ' + (x - 6.25).toFixed(3) + ' 7.6';
      g.append(s('path', { d: 'M0 1.2H100V8.8' + sc.replace(/ 7\.6/g, ' 8.8') + 'Z', fill: 'rgba(60,90,80,.12)' }),
        s('path', { d: 'M0 0H100V7.6' + sc + 'Z', fill: '#FFF6F9' }));
      for (let i = 0; i < 16; i += 2) { const x = i * 6.25; g.append(s('path', { d: 'M' + x + ' 0H' + (x + 6.25) + 'V7.6A3.125 3.125 0 0 1 ' + x + ' 7.6Z', fill: '#F48FB1' })); }
      for (const x of [10.5, 89.5]) {
        g.append(s('rect', { x: x - 0.4, y: 7, width: 0.8, height: 11.4, fill: '#B07A8C' }),
          s('circle', { cx: x, cy: 22.4, r: 6, fill: '#FFF3C4', opacity: 0.32 }),
          s('path', { d: 'M' + (x - 4.4) + ' 22.2L' + (x - 1.7) + ' 17.6H' + (x + 1.7) + 'L' + (x + 4.4) + ' 22.2Z', fill: '#F48FB1' }),
          s('circle', { cx: x, cy: 22.8, r: 1.5, fill: '#FFF6D8' }));
      }
    } else if (look === 'bakery' || look === 'cake') {
      g.append(s('rect', { x: 0, y: 0, width: 100, height: 113, fill: '#FBE6EB' }));
      for (let x = 2; x < 100; x += 8) g.append(s('rect', { x, y: 0, width: 3, height: 113, fill: '#F5D5DD', opacity: 0.55 }));
      g.append(s('rect', { x: 0, y: 70, width: 100, height: 43, fill: '#F6D9DF', opacity: 0.6 }),
        s('rect', { x: 4, y: 63.4, width: 92, height: 2.6, rx: 0.8, fill: '#C99366' }),
        s('path', { d: 'M12 66v4l3 -4M88 66v4l-3 -4', stroke: '#B07D52', 'stroke-width': 0.9, fill: 'none' }));
      // jars and a cake dome on the shelf
      for (const [x, w, hh, fill, lid] of [[8, 7, 9, '#F3E5CC', '#D9A86C'], [16.5, 6, 7, '#E7F1E4', '#9CC79A'], [24, 6.5, 10, '#FCE7C8', '#E59A6A']]) {
        g.append(s('rect', { x, y: 63.4 - hh, width: w, height: hh, rx: 1.3, fill, opacity: 0.9 }), s('rect', { x: x - 0.4, y: 63.4 - hh - 1.4, width: w + 0.8, height: 1.8, rx: 0.6, fill: lid }));
      }
      g.append(s('path', { d: 'M74 63.4A9 8.5 0 0 1 92 63.4Z', fill: '#FFFFFF', opacity: 0.75 }), s('circle', { cx: 83, cy: 54.4, r: 1, fill: '#E9A23B' }),
        s('rect', { x: 77, y: 59.4, width: 12, height: 4, rx: 1.4, fill: '#F0879F', opacity: 0.8 }));
      // the ticket rail
      g.append(s('rect', { x: 16, y: 3.4, width: 68, height: 1.6, rx: 0.8, fill: '#B9C1CA' }), s('circle', { cx: 16.8, cy: 4.2, r: 1.3, fill: '#9EA7B1' }), s('circle', { cx: 83.2, cy: 4.2, r: 1.3, fill: '#9EA7B1' }));
      // marble counter
      g.append(s('rect', { x: 0, y: 112, width: 100, height: 24, fill: '#F3EFEB' }),
        s('path', { d: 'M4 120C18 116 26 128 40 122S66 118 74 126M58 131C70 127 82 133 98 128M10 132C16 129 22 131 30 129', stroke: '#D9D1C9', 'stroke-width': 0.4, fill: 'none' }),
        s('rect', { x: 0, y: 112, width: 100, height: 1.4, fill: '#DCD3CA' }));
    } else {
      g.append(s('rect', { x: 0, y: 0, width: 100, height: 70, fill: '#E3F3F2' }),
        s('rect', { x: 0, y: 0, width: 100, height: 34, fill: '#D3ECF0' }),
        s('path', { d: 'M0 56C12 48 24 50 34 55S58 46 72 52S92 48 100 52V70H0Z', fill: '#B9DBCB' }),
        s('path', { d: 'M0 62C14 57 30 60 44 58S72 56 84 59S96 58 100 59V70H0Z', fill: '#A6CFBA' }));
      for (const [x, r] of [[6, 3.4], [11, 4.4], [17, 3], [62, 3.6], [68, 4.6], [74, 3.2], [90, 4], [95, 3]]) g.append(s('circle', { cx: x, cy: 61 - r * 0.4, r, fill: '#8FC3A9' }));
      g.append(s('rect', { x: 0, y: 64, width: 100, height: 4, fill: '#DCD2AB' }),
        s('rect', { x: 0, y: 67.5, width: 100, height: 46, fill: '#7FC4D3' }),
        s('rect', { x: 0, y: 67.5, width: 100, height: 14, fill: '#93CFDB' }));
      for (const [x, y, rx] of [[14, 74, 7], [44, 79, 5], [70, 72, 8], [26, 88, 6], [60, 92, 7], [84, 85, 5], [36, 99, 6], [8, 97, 4]]) g.append(s('ellipse', { cx: x, cy: y, rx, ry: 0.55, fill: '#FFFFFF', opacity: 0.45 }));
      g.append(s('path', { d: 'M0 108C18 103 36 111 58 106S88 102 100 105V136H0Z', fill: '#EBD8AF' }),
        s('path', { d: 'M0 108C18 103 36 111 58 106S88 102 100 105', stroke: '#F6EBCF', 'stroke-width': 1, fill: 'none' }));
      for (const [x, y, r, c] of [[8, 126, 1.8, '#CDBF9F'], [31, 131, 1.3, '#BDB09A'], [64, 128, 1.5, '#D2C4A4'], [93, 130, 2, '#C4B596'], [47, 112.5, 1.1, '#CDBF9F'], [88, 113, 1.2, '#BDB09A']]) {
        g.append(s('ellipse', { cx: x, cy: y, rx: r * 1.5, ry: r, fill: c }), s('ellipse', { cx: x - r * 0.4, cy: y - r * 0.35, rx: r * 0.6, ry: r * 0.3, fill: '#FFFFFF', opacity: 0.35 }));
      }
      const reeds = (x0, dir) => { let d = ''; [[0, 16], [2.2, 21], [4, 14], [5.8, 18]].forEach(([dx, hh]) => { const x = x0 + dx * dir; d += 'M' + x + ' 116Q' + (x + 1.4 * dir) + ' ' + (116 - hh / 2) + ' ' + (x + 0.6 * dir) + ' ' + (116 - hh); }); return s('path', { d, stroke: '#6E9E5A', 'stroke-width': 0.9, fill: 'none', 'stroke-linecap': 'round' }); };
      g.append(reeds(2.5, 1), reeds(97.5, -1));
    }
    return g;
  }
  // the goal: on a sign, a clipboard, the departure board, the menu board or a ticket
  function skCard(uid, look, goal, caps) {
    const L = SK_LOOKS[look];
    const g = s('g', { class: 'sk-card' });
    if (look === 'harbor') {
      g.append(s('rect', { x: 24, y: 5, width: 52, height: 38.5, rx: 2.4, fill: '#7A5634' }), s('rect', { x: 24, y: 5, width: 52, height: 1.4, rx: 0.7, fill: '#946A44' }),
        s('rect', { x: 26.6, y: 8.4, width: 46.8, height: 32.6, rx: 0.8, fill: '#FFFFFF' }),
        s('rect', { x: 30, y: 11.4, width: 20, height: 1.3, rx: 0.6, fill: '#C9D3DD' }), s('rect', { x: 30, y: 14, width: 12, height: 1, rx: 0.5, fill: '#DCE3EA' }),
        s('rect', { x: 43, y: 2.8, width: 14, height: 5.2, rx: 1.2, fill: '#AEB8C2' }), s('rect', { x: 46.5, y: 4.4, width: 7, height: 1.6, rx: 0.8, fill: '#7F8A96' }));
    } else if (look === 'bakery' || look === 'cake') {
      let zig = 'M25 7.5Q25 6 26.5 6H73.5Q75 6 75 7.5V40';
      for (let x = 75; x > 25.1; x -= 3.125) zig += 'L' + (x - 1.5625).toFixed(3) + ' 42.4L' + (x - 3.125).toFixed(3) + ' 40';
      g.append(s('path', { d: zig + 'Z', fill: '#FFFFFF' }), s('rect', { x: 25, y: 6, width: 50, height: 3.6, rx: 1.4, fill: '#F0879F' }),
        s('rect', { x: 46.5, y: 2.4, width: 7, height: 5.4, rx: 1, fill: '#9EA7B1' }),
        s('rect', { x: 30, y: 12.4, width: 16, height: 1.1, rx: 0.55, fill: '#F2C9D3' }));
    } else if (look === 'station') {
      g.append(s('path', { d: 'M32 0V6M68 0V6', stroke: '#5B6672', 'stroke-width': 1 }),
        s('rect', { x: 23, y: 5, width: 54, height: 38.5, rx: 2.2, fill: '#1E2732' }),
        s('rect', { x: 25.2, y: 7.2, width: 49.6, height: 34.1, rx: 1.2, fill: '#29343F' }),
        s('rect', { x: 29, y: 10.6, width: 18, height: 1.3, rx: 0.65, fill: '#F2B33D', opacity: 0.9 }),
        s('rect', { x: 29, y: 13.2, width: 11, height: 1, rx: 0.5, fill: '#F2B33D', opacity: 0.45 }));
    } else if (look === 'icecream') {
      g.append(s('path', { d: 'M32 7V12M68 7V12', stroke: '#B98A5C', 'stroke-width': 0.8 }),
        s('rect', { x: 23.2, y: 10.4, width: 53.6, height: 34.6, rx: 2, fill: '#C8955C' }),
        s('rect', { x: 23.2, y: 10.4, width: 53.6, height: 1.2, rx: 0.6, fill: '#DDAE78' }),
        s('rect', { x: 25.2, y: 12.4, width: 49.6, height: 30.6, rx: 1, fill: '#2F3B39' }),
        s('rect', { x: 29, y: 15.2, width: 15, height: 1.1, rx: 0.55, fill: '#FFFFFF', opacity: 0.5 }),
        s('rect', { x: 29, y: 17.6, width: 9, height: 0.9, rx: 0.45, fill: '#FFFFFF', opacity: 0.28 }));
    } else {
      g.append(s('path', { d: 'M31 42V58M69 42V58', stroke: '#7E5332', 'stroke-width': 2.2 }),
        s('rect', { x: 23.5, y: 5, width: 53, height: 38, rx: 2.6, fill: '#97643C' }),
        s('rect', { x: 23.5, y: 5, width: 53, height: 1.4, rx: 0.7, fill: '#B07D52' }),
        s('rect', { x: 26.4, y: 8, width: 47.2, height: 32, rx: 1.6, fill: '#F7ECD5' }));
      for (const [x, y] of [[25.3, 6.8], [74.7, 6.8], [25.3, 41.2], [74.7, 41.2]]) g.append(s('circle', { cx: x, cy: y, r: 0.65, fill: '#5B3B22' }));
    }
    const base = look === 'icecream' ? 36.4 : 37.2;
    for (let k = 0; k < 3; k++) {
      const mx = 50 + (SK_X[k] - 50) * SK_MINI;
      if (look === 'icecream') {
        g.append(s('path', { d: 'M' + (mx - 2.9) + ' ' + (base - 0.4) + 'L' + mx + ' ' + (base + 5.4) + 'L' + (mx + 2.9) + ' ' + (base - 0.4) + 'Z', fill: '#DDA25C' }),
          s('rect', { x: mx - 3.2, y: base - 1.3, width: 6.4, height: 1.4, rx: 0.65, fill: '#ECB772' }));
      } else if (look === 'cake') {
        g.append(s('path', { d: 'M' + (mx - 1.1) + ' ' + (base + 0.9) + 'L' + (mx - 0.7) + ' ' + (base + 3.1) + 'H' + (mx + 0.7) + 'L' + (mx + 1.1) + ' ' + (base + 0.9) + 'Z', fill: '#E4DCD3' }),
          s('ellipse', { cx: mx, cy: base + 0.45, rx: 6.6, ry: 1.25, fill: '#FFFFFF', stroke: '#E6D9CC', 'stroke-width': 0.3 }));
      } else {
        const ph = (caps[k] * SK_STEP + 4) * SK_MINI;
        g.append(s('rect', { x: mx - 0.6, y: base - ph, width: 1.2, height: ph, rx: 0.5, fill: L.rod }));
      }
      goal[k].forEach((id, i) => g.append(s('g', { transform: 'translate(' + mx + ' ' + (base - (SK_STEP / 2 + i * SK_STEP) * SK_MINI).toFixed(2) + ') scale(' + SK_MINI + ')' }, skPiece(uid, look, id, true))));
    }
    if (look !== 'icecream' && look !== 'cake') g.append(s('rect', { x: 29, y: base, width: 42, height: 0.9, rx: 0.45, fill: L.rod, opacity: 0.55 }));
    return g;
  }
  class StacksCard extends Card {
    hasHistory() { return this.run.hist.length > 0; }
    buildBoard() {
      const p = this.p, look = SK_LOOKS[p.theme] ? p.theme : 'stones', L = SK_LOOKS[look];
      const n = p.n || 3, caps = this.caps = p.caps || E.games.stacks.caps;
      this.look = look;
      this.el.dataset.look = look;
      this.held = null;
      this.gest = null;
      const uid = this.uid = 'sk' + Math.random().toString(36).slice(2, 8);
      const holds = caps.some((c) => c < n) ? ' that hold ' + caps.slice(0, -1).join(', ') + ' and ' + caps[caps.length - 1] : '';
      const svgEl = s('svg', { class: 'board stacks', viewBox: '0 0 100 136', role: 'group', 'aria-label': n + ' ' + L.names[0].split(' ').pop() + 's on three ' + L.post + 's' + holds });
      svgEl.append(skDefs(uid, look));
      const world = s('g', { 'clip-path': 'url(#' + uid + 'clip)' });
      world.append(skScene(uid, look));
      const cardEl = skCard(uid, look, p.goal, caps);
      cardEl.setAttribute('role', 'img');
      cardEl.setAttribute('aria-label', 'Goal: ' + p.goal.map((a, k) => 'post ' + (k + 1) + (a.length ? ' ' + a.map((id) => L.names[id]).join(', ') : ' empty')).join('; '));
      world.append(cardEl);
      if (look === 'harbor') {
        // the crane's trolley rides the beam above the lifted container; its cable scales to reach it
        this.cable = s('g', { class: 'sk-cable-line' }, s('path', { d: 'M-1.4 0V1M1.4 0V1', stroke: '#20262E', 'stroke-width': 0.55, 'vector-effect': 'non-scaling-stroke' }));
        this.trolley = s('g', { class: 'sk-trolley' }, s('rect', { x: -6, y: 53, width: 12, height: 4.4, rx: 0.9, fill: '#2E3A46' }), s('rect', { x: -6, y: 53, width: 12, height: 1.2, rx: 0.6, fill: '#46586B' }), s('circle', { cx: -3.8, cy: 53.1, r: 1, fill: '#151B22' }), s('circle', { cx: 3.8, cy: 53.1, r: 1, fill: '#151B22' }));
        world.append(this.cable, this.trolley);
      }
      this.shadow = s('ellipse', { class: 'sk-shadow', cx: 0, cy: 0, rx: 10.5, ry: 2, fill: 'rgba(30,25,20,.3)', filter: 'url(#' + uid + 'blur)' });
      this.posts = [0, 1, 2].map((k) => { const g = skPost(uid, look, k, caps[k]); world.append(g); return g; });
      world.append(this.shadow);
      this.layer = s('g', null);
      world.append(this.layer);
      this.pieces = Array.from({ length: n }, (_, id) => {
        const el = s('g', { class: 'sk-piece', 'aria-hidden': 'true' });
        const inner = s('g', { class: 'sk-inner' });
        if (look === 'harbor') inner.append(s('g', { class: 'sk-cable' }, s('rect', { x: -9, y: -9.6, width: 18, height: 1.5, rx: 0.5, fill: '#2B333D' }), s('path', { d: 'M-8.2 -8.1L-10.8 -6.9M8.2 -8.1L10.8 -6.9', stroke: '#2B333D', 'stroke-width': 0.6 })));
        const hw = skHalf(look, id) + 1.6, y0 = look === 'icecream' ? (id === L.cherry ? -14 : -10.4) : -9, y1 = look === 'icecream' ? 6.4 : look === 'cake' ? 7.4 : 8.6;
        inner.append(skPiece(uid, look, id, false), s('rect', { class: 'halo', x: -hw, y: y0, width: 2 * hw, height: y1 - y0, rx: 3.6 }));
        el.append(inner);
        this.layer.append(el);
        return el;
      });
      this.cols = [0, 1, 2].map((k) => {
        const col = s('rect', { class: 'sk-col', x: SK_X[k] - 15, y: 58, width: 30, height: 76, rx: 4, tabindex: '0', role: 'button' });
        col.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.tap(k); } });
        world.append(col);
        return col;
      });
      svgEl.append(world, s('rect', { x: 0.25, y: 0.25, width: 99.5, height: 135.5, rx: 6.8, fill: 'none', stroke: 'rgba(0,0,0,.12)', 'stroke-width': 0.5 }));
      svgEl.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        const k = this.postAt(e);
        if (k == null) return;
        e.preventDefault();
        try { svgEl.setPointerCapture(e.pointerId); } catch (x) { /* optional */ }
        this.down(k, e);
      });
      svgEl.addEventListener('pointermove', (e) => this.drag(e));
      svgEl.addEventListener('pointerup', (e) => this.up(e));
      svgEl.addEventListener('pointercancel', () => { if (this.gest && this.gest.moved) this.putBack(); this.gest = null; });
      this.svg = svgEl;
      this.area.append(svgEl);
      this.crane(SK_X[2], null, true);
    }
    toSvg(e) {
      const m = this.svg.getScreenCTM();
      if (!m) return null;
      const pt = this.svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(m.inverse());
    }
    postAt(e) {
      const q = this.toSvg(e);
      if (!q || q.y < 50 || q.y > 140 || q.x < -4 || q.x > 104) return null;
      return q.x < 35 ? 0 : q.x < 65 ? 1 : 2;
    }
    top(k) { const a = this.run.st[k]; return a.length ? a[a.length - 1] : null; }
    // draw order: every stack bottom to top, the lifted piece last
    restack() {
      this.run.st.forEach((a) => a.forEach((id) => this.layer.append(this.pieces[id])));
      if (this.held != null) this.layer.append(this.pieces[this.top(this.held)]);
      void this.layer.getBoundingClientRect();
    }
    setPos(id, x, y, instant) {
      const el = this.pieces[id];
      el.style.transition = instant ? 'none' : '';
      if (!instant) void el.getBoundingClientRect();
      el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      if (instant) { void el.getBoundingClientRect(); el.style.transition = ''; }
      if (id === this.moving || (this.held != null && this.top(this.held) === id)) { this.crane(x, y, instant); this.shade(x, y, instant); }
    }
    // the trolley over x; the cable reaches down to a container hanging at y (or hangs short)
    crane(x, y, instant) {
      if (!this.trolley) return;
      const len = y == null ? 3 : Math.max(1, y - 9.6 - 57.4);
      [this.trolley, this.cable].forEach((el) => { el.style.transition = instant ? 'none' : ''; });
      this.trolley.style.transform = 'translate(' + x + 'px,0)';
      this.cable.style.transform = 'translate(' + x + 'px,57.4px) scaleY(' + len + ')';
    }
    // the lifted piece's shadow falls on the stack below it
    shade(x, y, instant) {
      if (y == null) { this.shadow.style.opacity = '0'; return; }
      const k = x < 35 ? 0 : x < 65 ? 1 : 2;
      const n = this.run.st[k].length - (this.held === k ? 1 : 0);
      const gy = SK_BASE - n * SK_STEP;
      const sc = Math.max(0.55, 1 - (gy - y) / 120);
      this.shadow.style.transition = instant ? 'none' : '';
      this.shadow.style.opacity = '1';
      this.shadow.style.transform = 'translate(' + SK_X[k] + 'px,' + gy + 'px) scale(' + sc.toFixed(3) + ')';
    }
    refresh(animated) {
      this.held = null;
      this.gest = null;
      this.restack();
      this.run.st.forEach((a, k) => a.forEach((id, i) => { this.pieces[id].classList.remove('held'); this.setPos(id, SK_X[k], skSlotY(i), !animated); }));
      this.shade(0, null);
      if (this.trolley) this.crane(this.parkX || SK_X[2], null, !animated);
      this.label();
      this.goal();
    }
    label() {
      const L = SK_LOOKS[this.look], n = this.pieces.length, P = L.post[0].toUpperCase() + L.post.slice(1);
      this.cols.forEach((col, k) => {
        const a = this.run.st[k];
        col.setAttribute('aria-label', P + ' ' + (k + 1) + (this.caps[k] < n ? ', holds ' + this.caps[k] : '') + ': ' + (a.length ? a.map((id) => L.names[id]).join(', ') + ', top ' + L.names[a[a.length - 1]] : 'empty'));
      });
    }
    goal() {
      if (!this.goalEl) return;
      this.goalEl.textContent = '';
      this.goalEl.append(icon('stack'), h('span', { text: this.c.moves + '/' + this.p.reference }));
      this.goalEl.setAttribute('aria-label', this.c.moves + ' moves made; the fewest possible is ' + this.p.reference);
    }
    down(k, e) {
      if (this.summary || this.busy) return;
      Sound.unlock();
      this.hideHand();
      if (this.held == null) {
        if (this.top(k) == null) { this.nudge(k); return; }
        this.lift(k);
        this.gest = { from: k, lifted: true, moved: false, x: e.clientX, y: e.clientY, id: e.pointerId };
      } else if (k !== this.held) {
        this.drop(this.held, k);
        this.gest = null;
      } else {
        this.gest = { from: k, lifted: false, moved: false, x: e.clientX, y: e.clientY, id: e.pointerId };
      }
    }
    drag(e) {
      const g = this.gest;
      if (!g || e.pointerId !== g.id || this.held !== g.from) return;
      if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 9) return;
      g.moved = true;
      const q = this.toSvg(e);
      if (!q) return;
      this.setPos(this.top(g.from), Math.max(10, Math.min(90, q.x)), Math.max(64, Math.min(112, q.y)), true);
    }
    up(e) {
      const g = this.gest;
      if (!g || e.pointerId !== g.id) return;
      this.gest = null;
      if (this.held !== g.from) return;
      const k = this.postAt(e);
      if (k != null && k !== g.from) this.drop(g.from, k);
      else if (g.moved || !g.lifted) this.putBack();
    }
    // keyboard and screen readers: the same as a tap
    tap(k) {
      if (this.summary || this.busy) return;
      Sound.unlock();
      this.hideHand();
      if (this.held == null) { if (this.top(k) == null) this.nudge(k); else this.lift(k); }
      else if (k !== this.held) this.drop(this.held, k);
      else this.putBack();
    }
    lift(k) {
      const id = this.top(k);
      if (this.ruleSay) { this.ruleSay.remove(); this.ruleSay = null; }
      this.shadow.setAttribute('rx', (skHalf(this.look, id) * 0.86).toFixed(1));
      this.held = k;
      this.layer.append(this.pieces[id]);
      this.pieces[id].classList.add('held');
      this.setPos(id, SK_X[k], SK_HOVER, false);
      Sound.play('lift');
      buzz(6);
      this.later(() => this.guide(), 260);
    }
    putBack() {
      const k = this.held;
      if (k == null) return;
      const id = this.top(k);
      this.setPos(id, SK_X[k], skSlotY(this.run.st[k].length - 1), false);
      this.held = null;
      this.pieces[id].classList.remove('held');
      this.shade(0, null);
      this.parkX = SK_X[k];
      this.crane(SK_X[k], null, false);
      Sound.play('set', 0);
      this.later(() => this.guide(), 300);
    }
    nudge(k) {
      const g = this.posts[k];
      g.classList.remove('nudge');
      void g.getBoundingClientRect();
      g.classList.add('nudge');
      this.later(() => g.classList.remove('nudge'), 400);
    }
    drop(a, b) {
      const rec = this.G.move(this.p, this.run, a, b);
      if (!rec) return;
      if (rec.kind === 'blocked') {
        // the piece stays up. A full post shakes; on the cherry or a smaller layer, that piece shakes and says the rule
        this.setPos(this.top(a), SK_X[a], SK_HOVER, false);
        Sound.play('no');
        buzz(12);
        if (rec.why === 'cherry' || rec.why === 'size') {
          const t = this.pieces[this.top(b)];
          t.classList.remove('nope');
          void t.getBoundingClientRect();
          t.classList.add('nope');
          this.later(() => t.classList.remove('nope'), 420);
          if (this.ruleSay) this.ruleSay.remove();
          this.ruleSay = this.say(t, this.rule(), 'no');
          rec.detail = rec.why === 'cherry' ? 'nothing goes on the cherry' : 'a layer only goes on a bigger one';
        } else {
          this.nudge(b);
          rec.detail = 'post ' + (b + 1) + ' is full';
        }
        this.commit(rec);
        return;
      }
      const id = rec.piece, el = this.pieces[id];
      const y = skSlotY(this.run.st[b].length - 1);
      // across at hover height, then down onto the post
      this.held = null;
      this.moving = id;
      this.setPos(id, SK_X[b], SK_HOVER, false);
      this.later(() => { this.setPos(id, SK_X[b], y, false); }, 170);
      this.later(() => {
        if (this.moving === id) this.moving = null;
        el.classList.remove('held');
        if (this.held == null) {
          this.shade(0, null);
          this.parkX = SK_X[b];
          this.crane(SK_X[b], null, false);
        }
        el.classList.remove('land');
        void el.getBoundingClientRect();
        el.classList.add('land');
        this.later(() => el.classList.remove('land'), 360);
        Sound.play('set', this.run.st[b].length);
        buzz(8);
        if (!reducedMotion()) {
          const r = el.getBoundingClientRect(), fr = this.el.getBoundingClientRect();
          sparks(this, r.left + r.width / 2 - fr.left, r.bottom - fr.top - 3, SK_LOOKS[this.look].puff, 7);
        }
      }, 340);
      this.label();
      if (this.o.feedback && !this.practice) this.flash(id, rec.cls);
      this.commit(rec);
    }
    // the level's own rule, in words, if it has one
    rule() { return this.p.cherry != null ? 'The cherry stays on top' : this.p.size ? 'Small goes on big' : ''; }
    start() {
      super.start();
      const rule = this.rule();
      if (!rule) return;
      const at = this.p.cherry != null ? this.pieces[this.p.cherry] : this.pieces[this.pieces.length - 1];
      this.later(() => { if (this.held == null && !this.run.hist.length && !this.summary) this.ruleSay = this.say(at, rule, '', 3600); }, 800);
    }
    flash(id, cls) {
      const el = this.pieces[id], k = 'q-' + cls;
      el.classList.add(k);
      this.later(() => el.classList.remove(k), 900);
    }
    afterUndo() { this.refresh(true); }
    showHint(hint) {
      if (hint.kind !== 'target') return;
      if (this.held != null) this.putBack();
      const id = this.top(hint.a);
      const el = this.pieces[id];
      el.classList.add('hinted');
      this.later(() => el.classList.remove('hinted'), 2800);
      this.cols[hint.b].classList.add('hinted');
      this.later(() => this.cols[hint.b].classList.remove('hinted'), 2800);
      this.pointAt(el, 2600);
    }
    guideTarget() {
      const hnt = this.G.hint(this.p, this.run);
      if (hnt.kind !== 'target') return null;
      if (this.held == null) return this.pieces[this.top(hnt.a)];
      return this.held === hnt.a ? this.posts[hnt.b] : this.posts[this.held];
    }
    onKey(e) {
      if (this.summary) return false;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 3) { this.tap(n - 1); return true; }
      if (e.key === 'Escape' && this.held != null) { this.putBack(); return true; }
      return false;
    }
    onResolved(outcome) { if (outcome === 'solved') this.svg.classList.add('solved'); }
  }

  // ---------------------------------------------------------- Switchback
  // One canvas, redrawn every frame: a country road late in the day. The
  // camera rides 1 unit above the road and 2 units behind the car; with the
  // focal length equal to the canvas height, the horizon sits at 38% and the
  // car's wheels at 88% of the height. The road is drawn far to near in
  // segments, each one shifted sideways by the bends before it.
  const SB_HORIZON = 0.38, SB_CAR_Z = 2, SB_DRAW = 150;
  const SB_CURV = 0.0022;   // sideways bend per segment squared for a bend of 1 (world units)
  const SB_STEER = 0.45;    // sideways speed at full lock and 50 km/h (world units a second), in proportion to speed
  const SB_DRIFT = 0.18;    // outward drift in a bend of 1 at 50 km/h (world units a second), with the square of speed
  const SB_CAR = 0.17;      // half the car's width (world units)
  const SB_SIGN_Z = 9;      // a sign stands this far ahead, just off the right edge
  const SB_GRACE = 150;     // ms after a sign goes in which a tap still counts for it
  const SB_STOP = 4.2;      // the car brakes for an animal still on the road this far ahead
  const SB_IN = 0.9;        // s an animal takes to walk out to the middle of the road
  const SB_RUN = 1.7;       // how fast it runs off (world units a second)
  const SB_EASE = 0.45;     // the car eases off to this share of its speed while an animal is on the road
  const SB_FAR = 60;        // the landmark stays this far off, on the skyline, until the end of the drive comes near
  const SB_TO_LINE = 8;     // the finish line stands this far before the landmark
  const SB_PAST = 4.5;      // the car rolls to a stop this far past the line
  // a fork (level 3 on): the road widens to two lanes over SB_WIDE, splits at the nose,
  // the lane to the landmark comes back to the middle over SB_SPLIT while the other one
  // bends away, out of sight by SB_AWAY; the arrow board stands just past the nose
  const SB_WIDE = 7, SB_SPLIT = 14, SB_AWAY = 16, SB_BEND = 9, SB_LEAD = 1.0;
  const SB_DARK = 380;      // ms a sign takes at night to come out of the dark and light up
  const SB_COL = {
    sky: ['#79B3F0', '#BCDDF7', '#FFE4C4'], far: '#A9BFDB', hill: ['#8CC57C', '#7BB86E'],
    grass: ['#95D17F', '#8AC774'], rumble: ['#E5564D', '#F8F3EA'], road: ['#737886', '#6E7381'], lane: '#F8F3E6',
    trunk: '#7A5537', leaf: ['#45A15E', '#56B46A', '#358F52'],
    red: '#E23B36', blue: '#2D6BDA', ink: '#1F2230', post: '#8E96A3',
  };
  // sign symbols in a 100 x 100 box; animals come from the Glimpse silhouettes
  const SB_FILL = {
    arrow: 'M41 90V46H24L50 12L76 46H59V90Z',
    turn: 'M33 90V54Q33 29 58 29H62V13L90 40L62 67V51H58Q55 51 55 54V90Z',
    car: 'M10 68V57Q12 48 22 46L33 32Q37 28 45 28H62Q70 28 74 34L84 46Q92 48 92 57V68Z M28 80A9 9 0 1 1 28 62A9 9 0 1 1 28 80Z M74 80A9 9 0 1 1 74 62A9 9 0 1 1 74 80Z',
    bang: 'M41 12H59L55 63H45Z M50 70A9.5 9.5 0 1 1 50 89A9.5 9.5 0 1 1 50 70Z',
  };
  const SB_LINE = {
    curve: 'M40 92C40 66 62 62 62 42C62 28 52 20 52 8',
    bumps: 'M7 70H20Q30 40 40 70H60Q70 40 80 70H93',
  };
  const SB_P2D = {};
  function sbPath(d) {
    if (!(d in SB_P2D)) { try { SB_P2D[d] = new Path2D(d); } catch (e) { SB_P2D[d] = null; } }
    return SB_P2D[d];
  }
  function sbRR(ctx, x, y, w, hgt, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + hgt, r);
    ctx.arcTo(x + w, y + hgt, x, y + hgt, r);
    ctx.arcTo(x, y + hgt, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function sbGlyph(ctx, glyph, x, y, size, color) {
    if (SB_ANIM[glyph]) { sbAnimGlyph(ctx, glyph, x, y, size, color); return; }
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    if (GL_PATHS[glyph]) { glDraw(ctx, glyph, x, y, size); return; }
    if (glyph === 'P' || glyph === '50') {
      ctx.font = '700 ' + Math.round(size * (glyph === 'P' ? 1.08 : 0.74)) + 'px Fredoka, Lexend, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, x, y + size * 0.05);
      return;
    }
    const k = size / 100, path = sbPath(SB_LINE[glyph] || SB_FILL[glyph]);
    if (!path) return;
    ctx.save();
    ctx.translate(x - 50 * k, y - 50 * k);
    ctx.scale(k, k);
    if (SB_LINE[glyph]) { ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(path); } else ctx.fill(path);
    ctx.restore();
  }
  // a road sign about P wide, centred on (cx, cy)
  function sbPlate(ctx, shape, glyph, cx, cy, P) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = 'rgba(20, 24, 40, 0.28)';
    ctx.shadowBlur = P * 0.08;
    ctx.shadowOffsetY = P * 0.03;
    ctx.lineJoin = 'round';
    if (shape === 'tri') {
      const cy0 = 0.1233 * P;
      const tri = (k, fill, lw) => {
        const v = [[0, -0.45 * P], [-0.5 * P, 0.41 * P], [0.5 * P, 0.41 * P]].map(([x, y]) => [x * k, cy0 + (y - cy0) * k]);
        ctx.beginPath();
        ctx.moveTo(v[0][0], v[0][1]); ctx.lineTo(v[1][0], v[1][1]); ctx.lineTo(v[2][0], v[2][1]); ctx.closePath();
        ctx.fillStyle = fill; ctx.strokeStyle = fill; ctx.lineWidth = lw;
        ctx.fill(); ctx.stroke();
      };
      tri(1, '#FFFFFF', 0.12 * P);
      ctx.shadowColor = 'transparent';
      tri(0.93, SB_COL.red, 0.08 * P);
      tri(0.64, '#FFFFFF', 0.05 * P);
      sbGlyph(ctx, glyph, 0, cy0 + 0.02 * P, 0.38 * P, SB_COL.ink);
    } else if (shape === 'square_blue') {
      ctx.fillStyle = '#FFFFFF';
      sbRR(ctx, -0.47 * P, -0.47 * P, 0.94 * P, 0.94 * P, 0.15 * P); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = SB_COL.blue;
      sbRR(ctx, -0.41 * P, -0.41 * P, 0.82 * P, 0.82 * P, 0.1 * P); ctx.fill();
      sbGlyph(ctx, glyph, 0, 0, 0.52 * P, '#FFFFFF');
    } else {
      const red = shape === 'round_red';
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(0, 0, 0.5 * P, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = red ? SB_COL.red : SB_COL.blue;
      ctx.beginPath(); ctx.arc(0, 0, 0.45 * P, 0, Math.PI * 2); ctx.fill();
      if (red) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(0, 0, 0.33 * P, 0, Math.PI * 2); ctx.fill(); }
      sbGlyph(ctx, glyph, 0, 0, (red ? 0.42 : 0.5) * P, red ? SB_COL.ink : '#FFFFFF');
    }
    ctx.restore();
  }
  // rolling hills across the canvas, continuous for any offset
  function sbHills(ctx, W, base, amp, off, k1, k2, ph, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, base + 2);
    for (let x = 0; x <= W + 8; x += 8) {
      const u = (x + off) / W;
      ctx.lineTo(x, base - amp * (0.55 + 0.3 * Math.sin(u * Math.PI * 2 * k1 + ph) + 0.15 * Math.sin(u * Math.PI * 2 * k2 + ph * 2.3)));
    }
    ctx.lineTo(W + 8, base + 2);
    ctx.closePath();
    ctx.fill();
  }
  function sbHash(i) {
    let x = Math.imul(i | 0, 374761393) ^ 0x5bd1e995;
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    return (x ^ (x >>> 16)) >>> 0;
  }
  // a tree or a bush standing on (x, y); s is pixels per world unit at its distance
  function sbTree(ctx, x, y, s, kind, leaves) {
    const L = leaves || SB_COL.leaf;
    const disc = (cx, cy, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
    if (kind === 3) {
      disc(x - 0.09 * s, y - 0.07 * s, 0.1 * s, L[2]);
      disc(x + 0.09 * s, y - 0.06 * s, 0.09 * s, L[0]);
      disc(x, y - 0.11 * s, 0.11 * s, L[1]);
      return;
    }
    ctx.fillStyle = 'rgba(30, 80, 40, 0.16)';
    ctx.beginPath(); ctx.ellipse(x, y, 0.2 * s, 0.035 * s, 0, 0, Math.PI * 2); ctx.fill();
    const tall = kind === 4, th = (tall ? 0.3 : 0.24) * s;
    ctx.fillStyle = SB_COL.trunk;
    ctx.fillRect(x - 0.025 * s, y - th, 0.05 * s, th);
    if (tall) {
      ctx.fillStyle = L[2];
      ctx.beginPath(); ctx.ellipse(x, y - th - 0.26 * s, 0.13 * s, 0.36 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = L[1];
      ctx.beginPath(); ctx.ellipse(x - 0.035 * s, y - th - 0.32 * s, 0.07 * s, 0.22 * s, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const r = 0.21 * s;
    disc(x - 0.12 * s, y - th - 0.06 * s, r * 0.78, L[2]);
    disc(x + 0.12 * s, y - th - 0.05 * s, r * 0.78, L[0]);
    disc(x, y - th - 0.19 * s, r, L[1]);
    disc(x - 0.07 * s, y - th - 0.26 * s, r * 0.42, 'rgba(255, 255, 255, 0.13)');
  }
  // the car from behind, w pixels wide, wheels on y = cy
  function sbCar(ctx, cx, cy, w, tilt, bob, brake) {
    const u = w / 100;
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.rotate(tilt);
    ctx.fillStyle = 'rgba(20, 24, 40, 0.26)';
    ctx.beginPath(); ctx.ellipse(0, -1 * u, 58 * u, 7 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#24262E';
    sbRR(ctx, -47 * u, -19 * u, 19 * u, 19 * u, 5 * u); ctx.fill();
    sbRR(ctx, 28 * u, -19 * u, 19 * u, 19 * u, 5 * u); ctx.fill();
    // cabin and rear window
    ctx.fillStyle = '#C8423A';
    ctx.beginPath();
    ctx.moveTo(-41 * u, -46 * u);
    ctx.lineTo(-31 * u, -71 * u); ctx.quadraticCurveTo(-29 * u, -76 * u, -23 * u, -76 * u);
    ctx.lineTo(23 * u, -76 * u); ctx.quadraticCurveTo(29 * u, -76 * u, 31 * u, -71 * u);
    ctx.lineTo(41 * u, -46 * u); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2B3956';
    ctx.beginPath();
    ctx.moveTo(-32 * u, -50 * u); ctx.lineTo(-24 * u, -70 * u); ctx.lineTo(24 * u, -70 * u); ctx.lineTo(32 * u, -50 * u); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.moveTo(-20 * u, -70 * u); ctx.lineTo(-8 * u, -70 * u); ctx.lineTo(-18 * u, -50 * u); ctx.lineTo(-30 * u, -50 * u); ctx.closePath(); ctx.fill();
    // body
    const g = ctx.createLinearGradient(0, -52 * u, 0, -12 * u);
    g.addColorStop(0, '#F36C61'); g.addColorStop(1, '#D8463D');
    ctx.fillStyle = g;
    sbRR(ctx, -51 * u, -52 * u, 102 * u, 40 * u, 12 * u); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    sbRR(ctx, -46 * u, -50 * u, 92 * u, 5 * u, 2.5 * u); ctx.fill();
    // lights, plate, bumper
    if (brake) { ctx.fillStyle = 'rgba(255, 60, 50, 0.35)'; ctx.beginPath(); ctx.arc(-36 * u, -38 * u, 16 * u, 0, Math.PI * 2); ctx.arc(36 * u, -38 * u, 16 * u, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = brake ? '#FF4A3D' : '#FFD98A';
    sbRR(ctx, -45 * u, -43 * u, 17 * u, 9 * u, 3.5 * u); ctx.fill();
    sbRR(ctx, 28 * u, -43 * u, 17 * u, 9 * u, 3.5 * u); ctx.fill();
    ctx.fillStyle = '#FBF7EC';
    sbRR(ctx, -13 * u, -33 * u, 26 * u, 9 * u, 2 * u); ctx.fill();
    ctx.fillStyle = '#3B3F4B';
    sbRR(ctx, -48 * u, -18 * u, 96 * u, 6 * u, 3 * u); ctx.fill();
    ctx.restore();
  }
  // ---- the places
  // Two for each level: the day goes from morning to dusk, and every drive heads for
  // a landmark on the skyline, which comes into reach at the end of the drive.
  // The road, its lines and the signs look the same in every place. item: the thing
  // to collect along that road.
  const SB_PLACES = {
    farm: { // a farm in the morning: rolling pasture with hedgerows, sheep and cows, a red barn
      sky: ['#8CC3F0', '#D3E9F8', '#FFEBCB'], sun: [0.22, 0.26, 0.036, '#FFF6DE', '255, 236, 196'],
      far: 'rolling', land: 'pasture', hedge: '#4E9849',
      ground: '#8DC977', verge: '#C3DD96', road: '#777C88', haze: '240, 244, 236', clouds: 'puff', cloud: '#FFFFFF', birds: '#4A5868', dust: '190, 172, 128',
      things: ['tree', 'sheep', 'flowers', 'cow', 'sheep', 'tree', 'flowers', 'bush', 'sheep', 'cow'], small: 'flowers', fence: 0.7, posts: 'white', dest: 'barn', flag: '#E5564D', item: 'apple' },
    fields: { // fields at noon: wheat, lavender and green crops in rows, a flat horizon, a windmill
      sky: ['#3F95EA', '#9ACCF6', '#E9F5FB'], sun: [0.8, 0.08, 0.03, '#FFFFF4', '255, 255, 232'],
      far: 'flat', land: 'crops',
      crops: [['#E7C45E', 'rgba(150, 98, 20, 0.26)'], ['#E7C45E', 'rgba(150, 98, 20, 0.26)'], ['#EDD27A', 'rgba(150, 98, 20, 0.22)'], ['#B5CE62', 'rgba(70, 110, 30, 0.26)'], ['#AE97DA', 'rgba(80, 52, 130, 0.3)']],
      ground: '#E3C462', verge: '#A3C46B', road: '#777C88', haze: '236, 244, 250', clouds: 'cumulus', cloud: '#FFFFFF', birds: '#4A5868', dust: '206, 180, 112',
      things: ['hay', 'sunflower', 'hay', 'tall', 'sunflower', 'hay', 'poppy'], small: 'poppy', fence: 0, posts: 'white', dest: 'windmill', flag: '#3D8BFD', item: 'carrot' },
    forest: { // a forest in the afternoon: snowy peaks, tall pines close on both sides, shafts of light, a cabin
      sky: ['#6DA6E2', '#BCD9F1', '#FCE0B0'], sun: [0.68, 0.2, 0.034, '#FFF2D2', '255, 222, 170'],
      far: 'peaks', land: 'forest', ground: '#4A874D', verge: '#87AA65', road: '#727784', haze: '246, 232, 206', clouds: 'puff', cloud: '#FFFFFF', birds: null, dust: '130, 110, 84',
      walls: ['wallpine', 'wallpine', 'wallpine', 'wallpine', 'wallpine', 'wallpine', 'birch'],
      things: ['fern', 'rock', 'mushroom', 'log', 'fern', 'mushroom'], small: 'fern', fence: 0, posts: 'wood', shafts: true, dest: 'cabin', destLat: 0, flag: '#2FB36E', item: 'acorn' },
    coast: { // the coast at sunset: the sea beside the road, a beach, dunes, a lighthouse on the headland
      sky: ['#535EAE', '#E08AA4', '#FFC184'], sun: [0.24, 0.338, 0.058, '#FFE4AA', '255, 184, 116'],
      far: 'sea', land: 'coast', sand: '#EFDBA6', water: '#7F86C8', ground: '#D6CB91', verge: '#EFDDAA', road: '#7A7C88', haze: '255, 210, 180', clouds: 'streak', cloud: '#FFD3C6', birds: '#FFFFFF', dust: '226, 206, 160',
      things: ['grass', 'dune', 'grass', 'rock', 'dune', 'grass'], small: 'grass', fence: 0.4, wood: '#B89B74', posts: 'white', dest: 'lighthouse', flag: '#FF7A59', item: 'starfish' },
    village: { // hills at dusk: a village street with houses, gardens, fences and lamps, under the moon
      sky: ['#202C62', '#6E559A', '#EE9C78'], moon: [0.76, 0.12, 0.03],
      far: 'dusk', land: 'street', ground: '#4C7C50', verge: '#A49EB2', road: '#62677A', haze: '140, 112, 156', clouds: null, cloud: null, birds: null, stars: 40, dust: '140, 128, 116',
      trees: ['#2C6446', '#367353', '#24573C'], things: ['bush', 'tree', 'bush'], small: 'tuft', fence: 0, posts: null, dest: 'village', flag: '#FFC83A', item: 'cherry' },
    savanna: { // the savanna in the morning: golden grass, acacias, a snowy mountain far off, a balloon, a baobab
      sky: ['#78B2E6', '#CFE2EC', '#FFE0AE'], sun: [0.18, 0.28, 0.04, '#FFF2D0', '255, 210, 140'],
      far: 'savanna', land: null, ground: '#D2B464', verge: '#E2C984', road: '#7A7D86', haze: '255, 232, 190', clouds: 'puff', cloud: '#FFF6E8', birds: '#5A4A3A', dust: '205, 160, 100',
      trees: ['#7E9A4A', '#93AE58', '#6A8A3E'], things: ['acacia', 'gold', 'termite', 'bush', 'gold', 'acacia', 'gold'], small: 'gold', fence: 0, posts: null, balloon: true,
      dest: 'baobab', flag: '#F28C28', item: 'melon' },
    desert: { // the desert at noon: dunes with sharp crests, a caravan far off, palms, an oasis
      sky: ['#3D8FE0', '#9CCBF0', '#F6E8CC'], sun: [0.74, 0.07, 0.03, '#FFFFF4', '255, 250, 225'],
      far: 'dunes', land: 'sand', ground: '#E6BF78', verge: '#F0D397', road: '#7D7F88', haze: '252, 238, 210', clouds: null, cloud: null, birds: null, dust: '228, 196, 132',
      trees: ['#8E9C5E', '#A0AE6A', '#7C8A50'], things: ['palm', 'dune', 'sandrock', 'bush', 'dune', 'palm', 'sandrock'], small: 'grass', fence: 0, posts: 'white', shimmer: true,
      dest: 'oasis', flag: '#2FB3C8', item: 'drop' },
    jungle: { // the jungle in the afternoon: walls of green, red earth, mist, parrots, a waterfall
      sky: ['#5FA8BE', '#B6DCCF', '#F4E6B6'], sun: [0.62, 0.17, 0.034, '#FFF6DA', '255, 236, 190'],
      far: 'canopy', land: null, ground: '#3B7F45', verge: '#B9754A', road: '#71757F', haze: '238, 246, 236', clouds: 'puff', cloud: '#FFFFFF', birds: null, dust: '150, 110, 80',
      trees: ['#2E7A44', '#3F9452', '#246B3A'], walls: ['jtree', 'jtree', 'palm', 'jtree', 'banana'], things: ['heliconia', 'fern', 'banana', 'mossrock', 'heliconia', 'fern'], small: 'fern', fence: 0, posts: null, shafts: true, mist: true, parrots: true,
      dest: 'waterfall', destLat: 0, flag: '#FF5D8F', item: 'banana' },
    outback: { // the outback at sunset: red earth, spinifex, gum trees, the great red rock
      sky: ['#3B3F7E', '#D9735E', '#FFBE78'], sun: [0.72, 0.335, 0.06, '#FFE3A6', '255, 168, 96'],
      far: 'outback', land: null, ground: '#C0613B', verge: '#D88A56', road: '#6D6970', haze: '255, 186, 140', clouds: 'streak', cloud: '#FFC9A8', birds: '#5A3448', dust: '196, 100, 60',
      things: ['spinifex', 'gum', 'spinifex', 'termite', 'redrock', 'spinifex', 'gum'], small: 'spinifex', fence: 0.3, wood: '#8A6A50', posts: 'white',
      dest: 'monolith', destLat: 2.1, flag: '#FFC83A', item: 'opal' },
    north: { // the north at night: snow, spruces, the northern lights, snow poles, a red cottage
      sky: ['#0A1736', '#103653', '#2C6C7A'], moon: [0.22, 0.12, 0.026],
      far: 'north', land: 'snow', ground: '#D3E0EE', verge: '#EBF2F9', road: '#454B5B', haze: '110, 160, 190', clouds: null, cloud: null, birds: null, stars: 70, dust: '230, 238, 248',
      things: ['spruce', 'spruce', 'snowrock', 'spruce', 'snowman', 'spruce', 'snowrock', 'spruce'], small: null, fence: 0, posts: 'snow', aurora: true, snow: true, lights: true,
      dest: 'cottage', flag: '#7CE3B0', item: 'flake' },
  };
  // a soft round glow, made once per colour and drawn scaled
  const SB_GLOWS = {};
  function sbGlow(rgb) {
    if (SB_GLOWS[rgb]) return SB_GLOWS[rgb];
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(' + rgb + ', 0.9)'); gr.addColorStop(0.4, 'rgba(' + rgb + ', 0.32)'); gr.addColorStop(1, 'rgba(' + rgb + ', 0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
    return (SB_GLOWS[rgb] = c);
  }
  // a sign's plate before the headlights catch it: its shape, dark; cut once per sign and size
  const SB_DARKS = {};
  function sbPlateDark(shape, glyph, P) {
    const key = shape + '|' + glyph + '|' + Math.round(P);
    if (SB_DARKS[key]) return SB_DARKS[key];
    const S = Math.ceil(P * 1.4), c = document.createElement('canvas');
    c.width = c.height = S * 2;
    const g = c.getContext('2d');
    if (g) {
      g.setTransform(2, 0, 0, 2, 0, 0);
      sbPlate(g, shape, glyph, S / 2, S / 2, P);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = '#1C2440';
      g.fillRect(0, 0, S, S);
    }
    return (SB_DARKS[key] = { c, S });
  }
  // the moon at dusk: a crescent, cut once
  let SB_MOON = null;
  function sbMoon() {
    if (SB_MOON) return SB_MOON;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      g.fillStyle = '#FFF4D6';
      g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(44, 24, 25, 0, Math.PI * 2); g.fill();
    }
    return (SB_MOON = c);
  }
  // one stripe of the northern lights: green at the foot fading up through rose
  let SB_AURORA = null;
  function sbAurora() {
    if (SB_AURORA) return SB_AURORA;
    const c = document.createElement('canvas');
    c.width = 4; c.height = 128;
    const g = c.getContext('2d');
    if (g) {
      const gr = g.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, 'rgba(255, 120, 210, 0)'); gr.addColorStop(0.3, 'rgba(200, 120, 255, 0.35)'); gr.addColorStop(0.7, 'rgba(70, 255, 170, 0.75)');
      gr.addColorStop(0.93, 'rgba(170, 255, 210, 1)'); gr.addColorStop(1, 'rgba(120, 255, 190, 0)');
      g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    }
    return (SB_AURORA = c);
  }
  // a flat-bottomed cloud w pixels wide, its base on y
  function sbCloud(ctx, x, y, w, tall) {
    ctx.beginPath();
    const c = (cx, cy, r) => { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); };
    c(x - w * 0.27, y - w * 0.02, w * 0.15);
    c(x - w * 0.07, y - w * 0.1, w * 0.21);
    c(x + w * 0.16, y - w * 0.06, w * 0.17);
    c(x + w * 0.33, y + w * 0.0, w * 0.11);
    if (tall) { c(x + w * 0.03, y - w * 0.24, w * 0.17); c(x - w * 0.15, y - w * 0.17, w * 0.13); c(x + w * 0.2, y - w * 0.15, w * 0.12); }
    ctx.rect(x - w * 0.27, y - w * 0.04, w * 0.6, w * 0.15);
    ctx.fill();
  }
  // the height of sbHills at x
  function sbHillY(W, base, amp, off, k1, k2, ph, x) {
    const u = (x + off) / W;
    return base - amp * (0.55 + 0.3 * Math.sin(u * Math.PI * 2 * k1 + ph) + 0.15 * Math.sin(u * Math.PI * 2 * k2 + ph * 2.3));
  }
  // a range of mountains with snow on the peaks, continuous for any offset
  function sbPeaks(ctx, W, base, amp, off, rock, shade, snow) {
    const step = W * 0.19, k0 = Math.floor(off / step) - 1, k1 = Math.ceil((off + W) / step) + 1;
    const pk = [];
    for (let k = k0; k <= k1; k++) {
      const q = sbHash(k * 977 + 5);
      pk.push([k * step - off + ((q % 100) / 100 - 0.5) * step * 0.4, base - amp * (0.5 + ((q >>> 8) % 100) / 200), base - amp * (0.08 + ((q >>> 16) % 100) / 600)]);
    }
    ctx.fillStyle = rock;
    ctx.beginPath(); ctx.moveTo(pk[0][0] - step, base + 2);
    for (let k = 0; k < pk.length; k++) {
      const nx = k + 1 < pk.length ? (pk[k][0] + pk[k + 1][0]) / 2 : pk[k][0] + step / 2;
      ctx.lineTo(pk[k][0], pk[k][1]); ctx.lineTo(nx, pk[k][2]);
    }
    ctx.lineTo(W + step, base + 2); ctx.closePath(); ctx.fill();
    for (let k = 0; k < pk.length; k++) {
      const [px, py] = pk[k], lx = k > 0 ? (pk[k - 1][0] + px) / 2 : px - step / 2, rx = k + 1 < pk.length ? (px + pk[k + 1][0]) / 2 : px + step / 2;
      const ly = k > 0 ? pk[k - 1][2] : base, ry = pk[k][2];
      // the shaded side of the peak, and its snow
      ctx.fillStyle = shade;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(rx, ry); ctx.lineTo(px + (rx - px) * 0.18, ry); ctx.closePath(); ctx.fill();
      const f = 0.3, ax = px + (lx - px) * f, ay = py + (ly - py) * f, bx = px + (rx - px) * f, by = py + (ry - py) * f;
      ctx.fillStyle = snow;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.lineTo(px + (bx - px) * 0.55, by - (by - py) * 0.12); ctx.lineTo(px + (bx - px) * 0.2, by + (by - py) * 0.1);
      ctx.lineTo(px + (ax - px) * 0.35, ay - (ay - py) * 0.05); ctx.lineTo(ax, ay); ctx.closePath(); ctx.fill();
    }
  }
  // the tips of a pine forest along the horizon
  function sbTreeline(ctx, W, base, amp, off, color) {
    const step = Math.max(6, W * 0.024), k0 = Math.floor(off / step) - 1;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-10, base + 2);
    for (let k = k0; k < k0 + W / step + 3; k++) {
      const q = sbHash(k * 131 + 9), x = k * step - off, hgt = amp * (0.5 + (q % 100) / 200);
      ctx.lineTo(x, base - hgt * 0.32); ctx.lineTo(x + step * 0.5, base - hgt); ctx.lineTo(x + step, base - hgt * 0.32);
    }
    ctx.lineTo(W + 10, base + 2); ctx.closePath(); ctx.fill();
  }
  // round crowns of jungle along the horizon, a tall tree above the rest now and then
  function sbCanopy(ctx, W, base, amp, off, color) {
    const step = Math.max(8, W * 0.036), k0 = Math.floor(off / step) - 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let k = k0; k < k0 + W / step + 3; k++) {
      const q = sbHash(k * 173 + 3), x = k * step - off, r = step * (0.62 + (q % 100) / 170), y = base - amp * (0.45 + ((q >>> 8) % 100) / 180);
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
      if (q % 9 === 0) { ctx.moveTo(x + r * 0.9, y - amp * 0.85); ctx.arc(x, y - amp * 0.85, r * 0.9, 0, Math.PI * 2); }
    }
    ctx.rect(-10, base - amp * 0.45, W + 20, amp * 0.45 + 2);
    ctx.fill();
  }
  // the sky's clouds for each place: small puffs, tall summer clouds, or streaks at sunset
  function sbClouds(ctx, PL, W, H, bgX, t) {
    if (!PL.clouds) return;
    if (PL.clouds === 'streak') {
      for (let c = 0; c < 5; c++) {
        const q = sbHash(c * 71 + 3), cw = W * (0.28 + ((q % 100) / 100) * 0.4), cy = H * (0.07 + (((q >>> 8) % 100) / 100) * 0.2), th = H * (0.007 + ((q >>> 16) % 8) / 1000);
        const lane = W + cw * 1.2, x0 = (((q >>> 4) % 1000) / 1000) * lane - bgX * 0.04 - t * 2;
        ctx.fillStyle = c % 2 ? '#FFD3C2' : '#F6B2B8';
        sbRR(ctx, ((x0 % lane) + lane) % lane - cw * 0.6, cy, cw, th, th / 2); ctx.fill();
      }
      return;
    }
    const big = PL.clouds === 'cumulus', n = big ? 3 : 3;
    for (let c = 0; c < n; c++) {
      const q = sbHash(c * 131 + 7), cw = W * (big ? 0.36 + ((q % 100) / 100) * 0.2 : 0.2 + ((q % 100) / 100) * 0.14);
      const cy = H * (big ? 0.12 + (((q >>> 8) % 100) / 100) * 0.12 : 0.07 + (((q >>> 8) % 100) / 100) * 0.15);
      const lane = W + cw * 1.4, x0 = (((q >>> 16) % 1000) / 1000) * lane - bgX * 0.05 - t * 3;
      const cx = ((x0 % lane) + lane) % lane - cw * 0.7;
      if (big) {
        ctx.fillStyle = '#D9E6F4'; sbCloud(ctx, cx + cw * 0.02, cy + cw * 0.03, cw, true);
        ctx.fillStyle = '#FFFFFF'; sbCloud(ctx, cx, cy, cw * 0.97, true);
      } else {
        ctx.fillStyle = PL.cloud; ctx.globalAlpha = 0.92; sbCloud(ctx, cx, cy, cw); ctx.globalAlpha = 1;
      }
    }
  }
  // far away, behind everything on the ground; vx is where the road meets the horizon
  function sbFar(ctx, PL, W, H, hy, bgX, t, sx, vx, seaGrad) {
    if (PL.far === 'rolling') {
      // soft green hills with hedges, trees and a white farmhouse on them
      sbHills(ctx, W, hy, H * 0.07, bgX * 0.22 + 40, 1.2, 2.6, 0.7, '#B9D3A6');
      const off = bgX * 0.45 + 300;
      sbHills(ctx, W, hy, H * 0.042, off, 1.8, 3.6, 2.1, '#9ACA84');
      const step = W * 0.085;
      for (let k = Math.floor(off / step); k * step - off < W + step; k++) {
        const q = sbHash(k * 53 + 1), x = k * step - off + ((q % 100) / 100) * step * 0.6;
        const y = sbHillY(W, hy, H * 0.042, off, 1.8, 3.6, 2.1, x);
        if (q % 5 === 0) {
          ctx.fillStyle = '#F4EFE6'; ctx.fillRect(x - 3.5, y - 4.5, 7, 4.5);
          ctx.fillStyle = '#C8574A'; ctx.beginPath(); ctx.moveTo(x - 4.5, y - 4.4); ctx.lineTo(x, y - 8); ctx.lineTo(x + 4.5, y - 4.4); ctx.closePath(); ctx.fill();
        } else if (q % 5 < 3) {
          const r0 = 2.4 + (q % 3) * 0.5;
          ctx.fillStyle = '#6FA866';
          ctx.beginPath(); ctx.arc(x - r0 * 0.7, y + 0.6, r0 * 0.75, 0, Math.PI * 2); ctx.arc(x + r0 * 0.6, y + 0.8, r0 * 0.7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#5E9A57';
          ctx.beginPath(); ctx.arc(x, y - r0 * 0.25, r0, 0, Math.PI * 2); ctx.fill();
        }
      }
      return;
    }
    if (PL.far === 'flat') {
      // fields to a low line of trees, with a spire and a farm far off
      const off = bgX * 0.35 + 90;
      sbHills(ctx, W, hy, H * 0.016, off, 7, 19, 1.3, '#9DB781');
      const span = W * 1.9;
      for (const [b, kind] of [[0.16, 0], [0.7, 1], [1.25, 0]]) {
        const x = ((W * b - bgX * 0.35) % span + span) % span - W * 0.35, y = hy - H * 0.008;
        ctx.fillStyle = '#8FA4B8';
        if (kind === 0) {
          ctx.fillRect(x - 2, y - 10, 4, 10);
          ctx.beginPath(); ctx.moveTo(x - 2.6, y - 10); ctx.lineTo(x, y - 17); ctx.lineTo(x + 2.6, y - 10); ctx.closePath(); ctx.fill();
          ctx.fillRect(x - 7, y - 5, 5, 5);
        } else {
          ctx.fillRect(x - 6, y - 5, 12, 5);
          ctx.beginPath(); ctx.moveTo(x - 7, y - 5); ctx.lineTo(x - 2, y - 9); ctx.lineTo(x + 7, y - 9); ctx.lineTo(x + 7, y - 5); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 12, y - 4, 4.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      return;
    }
    if (PL.far === 'peaks') {
      sbPeaks(ctx, W, hy, H * 0.2, bgX * 0.18 + 120, '#7D96BE', '#6C84AD', '#F3F6FB');
      sbTreeline(ctx, W, hy, H * 0.06, bgX * 0.5, '#2D5A41');
      return;
    }
    if (PL.far === 'sea') {
      const top = hy - H * 0.03;
      ctx.fillStyle = seaGrad;
      ctx.fillRect(0, top, W, hy - top + 2);
      ctx.fillStyle = 'rgba(255, 228, 176, 0.8)';
      for (let q = 0; q < 6; q++) {
        const yy = top + 2 + (q * (hy - top - 3)) / 6, ww = (6 + q * 5) * (0.55 + 0.45 * Math.sin(t * 2.2 + q * 1.7));
        ctx.fillRect(sx - ww / 2, yy, ww, 1.4);
      }
      // a white sail far out
      const bx = ((W * 0.12 - bgX * 0.2 + t * 2) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2, by = top + (hy - top) * 0.55;
      ctx.fillStyle = '#FFF6EE';
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - 9); ctx.lineTo(bx + 6, by); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5A5F8E'; ctx.fillRect(bx - 4, by, 11, 1.8);
      // the land runs out to a headland on the right of the road
      const x0 = Math.max(-20, Math.min(W * 0.8, vx - 6));
      ctx.fillStyle = '#C9A587';
      ctx.beginPath(); ctx.moveTo(x0, hy + 1); ctx.lineTo(x0 + 10, hy - H * 0.008);
      ctx.lineTo(x0 + W * 0.22, hy - H * 0.014); ctx.lineTo(x0 + W * 0.3, hy - H * 0.04); ctx.lineTo(x0 + W * 0.42, hy - H * 0.05);
      ctx.lineTo(x0 + W * 0.52, hy - H * 0.034); ctx.lineTo(W + 10, hy - H * 0.03); ctx.lineTo(W + 10, hy + 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#A8807A';
      ctx.beginPath(); ctx.moveTo(x0 + W * 0.3, hy - H * 0.04); ctx.lineTo(x0 + W * 0.42, hy - H * 0.05); ctx.lineTo(x0 + W * 0.36, hy + 1); ctx.lineTo(x0 + W * 0.27, hy + 1); ctx.closePath(); ctx.fill();
      return;
    }
    if (PL.far === 'savanna') {
      // the plain runs to a far mountain with snow on its flat top; flat-topped
      // acacias and a few giraffes stand on the skyline
      const span = W * 2.2, mx = ((W * 0.92 - bgX * 0.07) % span + span) % span - W * 0.5, mw = W * 0.62, mh = H * 0.085;
      ctx.fillStyle = '#B7B0CC';
      ctx.beginPath(); ctx.moveTo(mx - mw, hy + 1);
      ctx.bezierCurveTo(mx - mw * 0.55, hy - mh * 0.2, mx - mw * 0.32, hy - mh * 0.9, mx - mw * 0.14, hy - mh);
      ctx.lineTo(mx + mw * 0.12, hy - mh * 1.02);
      ctx.bezierCurveTo(mx + mw * 0.3, hy - mh * 0.92, mx + mw * 0.55, hy - mh * 0.2, mx + mw, hy + 1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#A59EBF';
      ctx.beginPath(); ctx.moveTo(mx + mw * 0.12, hy - mh * 1.02); ctx.bezierCurveTo(mx + mw * 0.3, hy - mh * 0.92, mx + mw * 0.55, hy - mh * 0.2, mx + mw, hy + 1);
      ctx.lineTo(mx + mw * 0.22, hy + 1); ctx.bezierCurveTo(mx + mw * 0.26, hy - mh * 0.45, mx + mw * 0.14, hy - mh * 0.8, mx + mw * 0.12, hy - mh * 1.02); ctx.fill();
      ctx.fillStyle = '#F6F3FB';
      ctx.beginPath(); ctx.moveTo(mx - mw * 0.21, hy - mh * 0.93); ctx.lineTo(mx - mw * 0.14, hy - mh); ctx.lineTo(mx + mw * 0.12, hy - mh * 1.02); ctx.lineTo(mx + mw * 0.2, hy - mh * 0.93);
      ctx.lineTo(mx + mw * 0.14, hy - mh * 0.84); ctx.lineTo(mx + mw * 0.09, hy - mh * 0.9); ctx.lineTo(mx + mw * 0.03, hy - mh * 0.79); ctx.lineTo(mx - mw * 0.03, hy - mh * 0.88);
      ctx.lineTo(mx - mw * 0.1, hy - mh * 0.81); ctx.lineTo(mx - mw * 0.15, hy - mh * 0.88); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255, 248, 236, 0.75)';
      sbRR(ctx, mx - mw * 0.42, hy - mh * 0.56, mw * 0.52, H * 0.012, H * 0.006); ctx.fill();
      sbRR(ctx, mx - mw * 0.08, hy - mh * 0.47, mw * 0.4, H * 0.009, H * 0.0045); ctx.fill();
      const off = bgX * 0.4 + 70;
      sbHills(ctx, W, hy, H * 0.012, off, 5, 13, 1.7, '#C9AA60');
      const step = W * 0.1;
      for (let k = Math.floor(off / step); k * step - off < W + step; k++) {
        const q = sbHash(k * 89 + 5), x = k * step - off + ((q % 100) / 100) * step * 0.7;
        const y = sbHillY(W, hy, H * 0.012, off, 5, 13, 1.7, x) + 1;
        if (q % 7 === 0) {
          // a giraffe, far away
          ctx.fillStyle = '#8F7048';
          ctx.beginPath(); ctx.ellipse(x, y - 6.2, 3.3, 1.7, -0.2, 0, Math.PI * 2); ctx.fill();
          for (const lx of [-2.6, -1.6, 1.5, 2.5]) ctx.fillRect(x + lx - 0.35, y - 5.5, 0.7, 5.5);
          ctx.strokeStyle = '#8F7048'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x + 2.2, y - 7); ctx.lineTo(x + 4.2, y - 12.5); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(x + 5, y - 12.8, 1.5, 0.75, 0.3, 0, Math.PI * 2); ctx.fill();
        } else if (q % 3 === 0) {
          // a flat-topped acacia
          const tw = 6 + (q % 5);
          ctx.fillStyle = '#7C7646';
          ctx.fillRect(x - 0.6, y - 6, 1.2, 6);
          ctx.beginPath(); ctx.ellipse(x, y - 7, tw, 1.9, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      return;
    }
    if (PL.far === 'dunes') {
      // soft dunes far off, then dunes with a sunlit slope and a sharp shaded face;
      // a caravan walks along a far crest
      const off0 = bgX * 0.16 + 20;
      sbHills(ctx, W, hy, H * 0.05, off0, 1.3, 2.9, 1.2, '#EFCF96');
      const span = W * 1.7, cxv = ((W * 0.15 - bgX * 0.16 + t * 5) % span + span) % span - W * 0.35;
      for (let c = 0; c < 4; c++) {
        const x = cxv - c * 16;
        sbAnimal(ctx, 'camel', x, sbHillY(W, hy, H * 0.05, off0, 1.3, 2.9, 1.2, x) + 1.5, 14, 0, { mono: '#A9784A' });
      }
      const off = bgX * 0.42 + 160, step = W * 0.5;
      for (let k = Math.floor(off / step) - 1; k * step - off < W + step; k++) {
        const q = sbHash(k * 61 + 9), cx = k * step - off + ((q % 100) / 100) * step * 0.4;
        const ch = H * (0.024 + (((q >>> 8) % 100) / 100) * 0.03), cw = step * (0.6 + ((q >>> 16) % 100) / 250);
        ctx.fillStyle = '#F3D69E';
        ctx.beginPath(); ctx.moveTo(cx - cw, hy + 1); ctx.quadraticCurveTo(cx - cw * 0.35, hy - ch * 0.95, cx, hy - ch); ctx.quadraticCurveTo(cx + cw * 0.3, hy - ch * 0.6, cx + cw * 0.75, hy + 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#DFAF6A';
        ctx.beginPath(); ctx.moveTo(cx, hy - ch); ctx.quadraticCurveTo(cx + cw * 0.3, hy - ch * 0.6, cx + cw * 0.75, hy + 1); ctx.lineTo(cx + cw * 0.14, hy + 1); ctx.quadraticCurveTo(cx + cw * 0.06, hy - ch * 0.5, cx, hy - ch); ctx.fill();
      }
      return;
    }
    if (PL.far === 'canopy') {
      // ridges under jungle to the horizon, mist lying between them
      sbHills(ctx, W, hy, H * 0.17, bgX * 0.1 + 80, 1.2, 2.6, 0.4, '#93BFAE');
      ctx.fillStyle = 'rgba(244, 250, 244, 0.55)';
      ctx.fillRect(0, hy - H * 0.07, W, H * 0.035);
      sbHills(ctx, W, hy, H * 0.1, bgX * 0.22 + 10, 1.9, 4.1, 1.6, '#72A88E');
      ctx.fillStyle = 'rgba(244, 250, 244, 0.4)';
      ctx.fillRect(0, hy - H * 0.03, W, H * 0.02);
      sbCanopy(ctx, W, hy, H * 0.04, bgX * 0.45, '#4F8E66');
      return;
    }
    if (PL.far === 'outback') {
      // the flat red plain runs out to low ranges with flat tops, purple in the evening
      const off = bgX * 0.15 + 200, step = W * 0.7;
      for (let k = Math.floor(off / step) - 1; k * step - off < W + step; k++) {
        const q = sbHash(k * 37 + 11), x0 = k * step - off + ((q % 100) / 100) * step * 0.3;
        const w = step * (0.45 + ((q >>> 8) % 100) / 300), h0 = H * (0.018 + ((q >>> 16) % 100) / 100 * 0.026);
        ctx.fillStyle = '#8C5878';
        ctx.beginPath(); ctx.moveTo(x0, hy + 1); ctx.lineTo(x0 + w * 0.09, hy - h0); ctx.lineTo(x0 + w * 0.55, hy - h0 * 1.06); ctx.lineTo(x0 + w * 0.88, hy - h0 * 0.9); ctx.lineTo(x0 + w, hy + 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7A4A6C';
        ctx.beginPath(); ctx.moveTo(x0 + w * 0.88, hy - h0 * 0.9); ctx.lineTo(x0 + w, hy + 1); ctx.lineTo(x0 + w * 0.8, hy + 1); ctx.closePath(); ctx.fill();
      }
      sbHills(ctx, W, hy, H * 0.008, bgX * 0.4, 6, 15, 0.9, '#A8563E');
      return;
    }
    if (PL.far === 'north') {
      // dark mountains with snow under the night sky, and the spruce forest below them
      sbPeaks(ctx, W, hy, H * 0.17, bgX * 0.16 + 300, '#3E5580', '#32466C', '#D8E4F2');
      sbTreeline(ctx, W, hy, H * 0.06, bgX * 0.5, '#122637');
      return;
    }
    if (PL.far === 'dusk') {
      sbHills(ctx, W, hy, H * 0.09, bgX * 0.22 + 40, 1.4, 3, 0.7, '#3E4A78');
      const off = bgX * 0.45 + 200;
      sbHills(ctx, W, hy, H * 0.05, off, 2, 4.4, 2.1, '#3F5D4C');
      // the lit windows of farms on the hills
      const step = W * 0.06;
      ctx.fillStyle = '#FFD777';
      for (let k = Math.floor(off / step); k * step - off < W + step; k++) {
        const q = sbHash(k * 211 + 3);
        if (q % 3) continue;
        const x = k * step - off + ((q >>> 3) % 100) / 100 * step, y = sbHillY(W, hy, H * 0.05, off, 2, 4.4, 2.1, x) + 3 + ((q >>> 9) % 6);
        ctx.fillRect(x, y, 2, 2);
        if (q % 2) ctx.fillRect(x + 3.5, y, 2, 2);
      }
    }
  }
  // the land beside the road, one segment at a time: fields in rows, the sea and its
  // shore, hedgerows across the pasture
  // ex: near a fork, how far the road's edges have moved out [left, right at the near end, left, right at the far end]
  function sbLand(ctx, PL, i, zB, xA, yA, xB, yB, yT, sA, sB, half, t, salt, W, ex) {
    const e0 = half * 1.16;
    const quad = (ax, ay, bx, by, cx, cy, ex, ey) => { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(ex, ey); ctx.closePath(); };
    if (PL.land === 'crops') {
      if (zB > 54) return;
      const blk = Math.floor(i / 26);
      for (const sd of [-1, 1]) {
        const f = PL.crops[sbHash(((blk * 2 + (sd > 0 ? 1 : 0)) * 7919) ^ salt) % PL.crops.length];
        const L0 = e0 + 0.03, ia = xA + sd * L0 * sA, ib = xB + sd * L0 * sB, edge = sd > 0 ? W + 30 : -30;
        if ((sd > 0 && ib > edge) || (sd < 0 && ib < edge)) continue;
        ctx.fillStyle = f[0];
        ctx.beginPath(); quad(ia, yA, sd > 0 ? Math.max(edge, ia) : Math.min(edge, ia), yA, sd > 0 ? Math.max(edge, ib) : Math.min(edge, ib), yT, ib, yT); ctx.fill();
        // the rows fade out with distance, where they would only be a blur
        if (zB < 18) {
          ctx.strokeStyle = f[1]; ctx.lineWidth = Math.max(0.7, 0.03 * sB);
          ctx.globalAlpha = Math.min(1, (18 - zB) / 8);
          ctx.beginPath();
          for (let L = L0 + 0.16; L < 3.4; L += 0.28) {
            const a = xA + sd * L * sA;
            if ((sd < 0 && a < -40) || (sd > 0 && a > W + 40)) break;
            ctx.moveTo(a, yA); ctx.lineTo(xB + sd * L * sB, yB);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      return;
    }
    if (PL.land === 'coast') {
      const shore = e0 + 0.62;
      ctx.fillStyle = PL.sand;
      ctx.beginPath(); quad(xA - e0 * sA, yA, xA - shore * sA, yA, xB - shore * sB, yT, xB - e0 * sB, yT); ctx.fill();
      const wa = xA - shore * sA, wb = xB - shore * sB;
      if (wb > -30) { ctx.fillStyle = PL.water; ctx.beginPath(); quad(wa, yA, Math.min(-30, wa), yA, Math.min(-30, wb), yT, wb, yT); ctx.fill(); }
      if (zB < 38) {
        const fo = 0.5 + 0.5 * Math.sin(t * 2.2 - i * 0.55);
        ctx.fillStyle = 'rgba(255, 250, 242, ' + (0.4 + 0.45 * fo).toFixed(2) + ')';
        const w0 = shore + 0.03 + 0.05 * fo;
        ctx.beginPath(); quad(xA - shore * sA, yA, xA - w0 * sA, yA, xB - w0 * sB, yB, xB - shore * sB, yB); ctx.fill();
        const r = sbHash(i * 13 + 5);
        if (r % 3 === 0) {
          const L = shore + 0.4 + (((r >>> 4) % 100) / 100) * 4, gl = 0.5 + 0.5 * Math.sin(t * 3 + (r % 17));
          ctx.fillStyle = 'rgba(255, 222, 176, ' + (0.6 * gl).toFixed(2) + ')';
          ctx.fillRect(xB - L * sB - 0.12 * sB, yB, 0.24 * sB, Math.max(1, 0.012 * sB));
        }
      }
      return;
    }
    if (PL.land === 'sand') {
      // ripples in the sand on both sides
      if (i % 3 !== 0 || zB > 24) return;
      ctx.fillStyle = 'rgba(190, 140, 70, 0.2)';
      for (const sd of [-1, 1]) {
        const a = xB + sd * (e0 + 0.12 + (sbHash(i * 7 + (sd > 0 ? 1 : 0)) % 40) / 100) * sB, b = Math.max(-10, Math.min(W + 10, xB + sd * 7 * sB));
        if ((sd < 0 && a < -10) || (sd > 0 && a > W + 10)) continue;
        ctx.fillRect(Math.min(a, b), yB, Math.abs(b - a), Math.max(1, 0.01 * sB));
      }
      return;
    }
    if (PL.land === 'snow') {
      // ploughed snow banked up along both edges: a shaded face toward the road, a white top
      if (zB > 40) return;
      for (const sd of [-1, 1]) {
        // near a fork the banks move out with the road's edge, and stop beside the lane that bends away
        const ea = ex ? ex[sd < 0 ? 0 : 1] : 0, eb = ex ? ex[sd < 0 ? 2 : 3] : 0;
        if (ea > 1.2 || eb > 1.2) continue;
        const a = e0 + 0.03, a2 = e0 + 0.09, b = e0 + 0.36, hA = 0.06 * sA, hB = 0.06 * sB;
        const XA = (L) => xA + sd * (L + ea) * sA, XB = (L) => xB + sd * (L + eb) * sB;
        ctx.fillStyle = '#B9CADF';
        ctx.beginPath(); quad(XA(a), yA, XB(a), yB, XB(a2), yT - hB, XA(a2), yA - hA); ctx.fill();
        ctx.fillStyle = '#F2F7FC';
        ctx.beginPath(); quad(XA(a2), yA - hA, XB(a2), yT - hB, XB(b), yT, XA(b), yA); ctx.fill();
      }
      return;
    }
    if (PL.land === 'pasture') {
      if (i % 28 !== 0 || zB > 44 || sB < 3) return;
      const L0 = e0 + 0.55, d = 0.13 * sB, rr = 0.09 * sB;
      ctx.fillStyle = PL.hedge;
      ctx.beginPath();
      for (const sd of [-1, 1]) {
        const xa = xB + sd * L0 * sB;
        let xb = xB + sd * 9 * sB;
        xb = Math.max(-rr, Math.min(W + rr, xb));
        if ((sd < 0 && xa < -rr) || (sd > 0 && xa > W + rr)) continue;
        ctx.rect(Math.min(xa, xb), yB - d, Math.abs(xb - xa), d);
        for (let L = L0; L < 9; L += 0.2) {
          const bx = xB + sd * L * sB;
          if (bx < -rr || bx > W + rr) break;
          ctx.moveTo(bx + rr, yB - d); ctx.arc(bx, yB - d, rr * (0.85 + (sbHash(i + L * 100) % 30) / 100), 0, Math.PI * 2);
        }
      }
      ctx.fill();
    }
  }
  // roadside things standing on (x, y); s is pixels per world unit at their distance
  function sbThing(ctx, kind, x, y, s, r, t, PL) {
    const disc = (cx, cy, rr, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill(); };
    const shadow = (w) => { ctx.fillStyle = 'rgba(30, 60, 30, 0.16)'; ctx.beginPath(); ctx.ellipse(x, y, w * s, 0.03 * s, 0, 0, Math.PI * 2); ctx.fill(); };
    switch (kind) {
      case 'tree': sbTree(ctx, x, y, s, (r >>> 12) % 3, PL.trees); return;
      case 'bush': sbTree(ctx, x, y, s, 3, PL.trees); return;
      case 'tall': sbTree(ctx, x, y, s, 4, PL.trees); return;
      case 'flowers': {
        if (s < 18) return;
        const cols = ['#FFFFFF', '#FFD23F', '#FF7FB0', '#B98CFF'], pts = [];
        ctx.fillStyle = '#5E9E4E';
        for (let k = 0; k < 6; k++) {
          const q = sbHash(r + k * 17), fx = x + ((q % 100) / 100 - 0.5) * 0.4 * s, fy = y - (((q >>> 8) % 100) / 100) * 0.07 * s - 0.05 * s;
          ctx.fillRect(fx - 0.004 * s, fy, Math.max(1, 0.008 * s), 0.05 * s);
          pts.push([fx, fy, (q >>> 16) % cols.length]);
        }
        const rr = Math.max(1.1, 0.02 * s);
        for (let c = 0; c < cols.length; c++) {
          ctx.fillStyle = cols[c];
          ctx.beginPath();
          for (const [fx, fy, cc] of pts) if (cc === c) { ctx.moveTo(fx + rr, fy); ctx.arc(fx, fy, rr, 0, Math.PI * 2); }
          ctx.fill();
        }
        return;
      }
      case 'tuft': case 'fern': case 'grass': {
        if (s < 16) return;
        ctx.strokeStyle = kind === 'grass' ? '#B5B068' : kind === 'fern' ? '#4C9147' : 'rgba(60, 110, 50, 0.55)';
        ctx.lineWidth = Math.max(1, 0.009 * s);
        ctx.lineCap = 'round';
        ctx.beginPath();
        const n = kind === 'grass' ? 3 : 2, ht = kind === 'grass' ? 0.13 : kind === 'fern' ? 0.09 : 0.06;
        for (let k = -n; k <= n; k++) {
          ctx.moveTo(x + k * 0.012 * s, y);
          ctx.quadraticCurveTo(x + k * 0.022 * s, y - ht * 0.6 * s, x + k * 0.045 * s, y - (ht - Math.abs(k) * 0.012) * s);
        }
        ctx.stroke();
        return;
      }
      case 'poppy': {
        if (s < 18) return;
        ctx.fillStyle = '#5E8F3E';
        const pts = [];
        for (let k = 0; k < 5; k++) {
          const q = sbHash(r + k * 29), fx = x + ((q % 100) / 100 - 0.5) * 0.36 * s, fy = y - (((q >>> 8) % 100) / 100) * 0.06 * s - 0.06 * s;
          ctx.fillRect(fx - 0.004 * s, fy, Math.max(1, 0.008 * s), 0.06 * s);
          pts.push([fx, fy]);
        }
        for (const [fx, fy] of pts) disc(fx, fy, Math.max(1.2, 0.024 * s), '#E8412F');
        for (const [fx, fy] of pts) disc(fx, fy, Math.max(0.5, 0.008 * s), '#2B2320');
        return;
      }
      case 'cow': {
        if (s < 10) return;
        shadow(0.18);
        const hd = r & 1 ? 1 : -1, bw = 0.27 * s, bh = 0.11 * s, by = y - 0.06 * s - bh;
        ctx.fillStyle = '#2E2A28';
        for (const lx of [-0.1, -0.06, 0.06, 0.1]) ctx.fillRect(x + lx * s - 0.01 * s, y - 0.068 * s, Math.max(1, 0.02 * s), 0.068 * s);
        ctx.fillStyle = '#F6F3EC';
        sbRR(ctx, x - bw / 2, by, bw, bh, bh * 0.45); ctx.fill();
        ctx.fillStyle = '#2E2A28';
        ctx.beginPath(); ctx.ellipse(x - 0.045 * s, by + bh * 0.42, 0.04 * s, 0.03 * s, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + 0.07 * s, by + bh * 0.58, 0.03 * s, 0.025 * s, -0.3, 0, Math.PI * 2); ctx.fill();
        const hx = x + hd * (bw / 2 + 0.03 * s), hy2 = by + bh * 0.25;
        ctx.beginPath(); ctx.ellipse(hx, hy2, 0.036 * s, 0.046 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#F2C7BC';
        ctx.beginPath(); ctx.ellipse(hx + hd * 0.006 * s, hy2 + 0.03 * s, 0.026 * s, 0.017 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#EDE6D6'; ctx.lineWidth = Math.max(0.8, 0.008 * s);
        ctx.beginPath(); ctx.moveTo(hx - 0.02 * s, hy2 - 0.036 * s); ctx.lineTo(hx - 0.036 * s, hy2 - 0.056 * s); ctx.moveTo(hx + 0.02 * s, hy2 - 0.036 * s); ctx.lineTo(hx + 0.036 * s, hy2 - 0.056 * s); ctx.stroke();
        return;
      }
      case 'log': {
        if (s < 8) return;
        shadow(0.15);
        const w = 0.3 * s, hh = 0.075 * s;
        ctx.fillStyle = '#7A5134'; sbRR(ctx, x - w / 2, y - hh, w, hh, hh / 2); ctx.fill();
        ctx.fillStyle = '#6FA05A'; ctx.beginPath(); ctx.ellipse(x - w * 0.12, y - hh * 0.92, w * 0.18, hh * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#D2A676'; ctx.beginPath(); ctx.ellipse(x + w / 2 - hh * 0.25, y - hh / 2, hh * 0.3, hh * 0.48, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#A97F55'; ctx.lineWidth = Math.max(0.6, 0.006 * s);
        ctx.beginPath(); ctx.ellipse(x + w / 2 - hh * 0.25, y - hh / 2, hh * 0.14, hh * 0.24, 0, 0, Math.PI * 2); ctx.stroke();
        return;
      }
      case 'mushroom': {
        if (s < 14) return;
        for (const [dx, sc] of [[0, 1], [0.065, 0.7]]) {
          const mx = x + dx * s, k = s * sc;
          ctx.fillStyle = '#F4EEE2'; ctx.fillRect(mx - 0.012 * k, y - 0.055 * k, 0.024 * k, 0.055 * k);
          ctx.fillStyle = '#E2493C'; ctx.beginPath(); ctx.ellipse(mx, y - 0.055 * k, 0.048 * k, 0.036 * k, 0, Math.PI, Math.PI * 2); ctx.fill();
          disc(mx - 0.018 * k, y - 0.072 * k, Math.max(0.7, 0.008 * k), '#FFFFFF');
          disc(mx + 0.014 * k, y - 0.08 * k, Math.max(0.7, 0.007 * k), '#FFFFFF');
        }
        return;
      }
      case 'sheep': {
        if (s < 12) return;
        shadow(0.13);
        const hd = r & 1 ? 1 : -1;
        ctx.fillStyle = '#3A3533';
        ctx.fillRect(x - 0.07 * s, y - 0.055 * s, Math.max(1, 0.018 * s), 0.055 * s);
        ctx.fillRect(x + 0.05 * s, y - 0.055 * s, Math.max(1, 0.018 * s), 0.055 * s);
        ctx.fillStyle = '#F7F4EE';
        ctx.beginPath();
        for (const [dx, dy, rr] of [[-0.075, -0.095, 0.045], [-0.025, -0.118, 0.05], [0.035, -0.11, 0.048], [0.08, -0.088, 0.04], [0, -0.08, 0.06]]) {
          ctx.moveTo(x + (dx + rr) * s, y + dy * s);
          ctx.arc(x + dx * s, y + dy * s, rr * s, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.fillStyle = '#3A3533';
        ctx.beginPath(); ctx.ellipse(x + hd * 0.115 * s, y - 0.1 * s, 0.032 * s, 0.042 * s, hd * 0.5, 0, Math.PI * 2); ctx.fill();
        return;
      }
      case 'hay': {
        if (s < 6) return;
        shadow(0.15);
        const rr = 0.11 * s;
        disc(x, y - rr, rr, '#E3B65E');
        ctx.strokeStyle = '#C8953F';
        ctx.lineWidth = Math.max(1, 0.012 * s);
        ctx.beginPath(); ctx.arc(x, y - rr, rr * 0.62, 0.2, Math.PI * 1.7); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y - rr, rr * 0.28, Math.PI, Math.PI * 2.5); ctx.stroke();
        return;
      }
      case 'sunflower': {
        if (s < 10) return;
        const hgt = 0.34 * s;
        ctx.fillStyle = '#4E8F3E';
        ctx.fillRect(x - Math.max(0.5, 0.008 * s), y - hgt, Math.max(1, 0.016 * s), hgt);
        ctx.beginPath(); ctx.ellipse(x + 0.032 * s, y - hgt * 0.45, 0.036 * s, 0.014 * s, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x - 0.032 * s, y - hgt * 0.64, 0.036 * s, 0.014 * s, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFC531';
        ctx.beginPath();
        for (let k = 0; k < 10; k++) { const a = (Math.PI * 2 * k) / 10; ctx.moveTo(x + Math.cos(a) * 0.08 * s, y - hgt + Math.sin(a) * 0.08 * s); ctx.arc(x + Math.cos(a) * 0.045 * s, y - hgt + Math.sin(a) * 0.045 * s, 0.032 * s, 0, Math.PI * 2); }
        ctx.fill();
        disc(x, y - hgt, 0.034 * s, '#7A4A22');
        return;
      }
      case 'pine': case 'wallpine': {
        if (s < 13) {
          ctx.fillStyle = '#2E6B47';
          ctx.beginPath(); ctx.moveTo(x - 0.2 * s, y - 0.05 * s); ctx.lineTo(x + 0.2 * s, y - 0.05 * s); ctx.lineTo(x, y - 0.68 * s); ctx.closePath(); ctx.fill();
          return;
        }
        if (kind === 'pine') shadow(0.14);
        const th = 0.08 * s;
        ctx.fillStyle = SB_COL.trunk;
        ctx.fillRect(x - 0.02 * s, y - th, 0.04 * s, th);
        for (let k = 0; k < 3; k++) {
          const yb = y - th - k * 0.15 * s, hw = (0.2 - k * 0.05) * s;
          ctx.fillStyle = k % 2 ? '#3A7D55' : '#2E6B47';
          ctx.beginPath(); ctx.moveTo(x - hw, yb); ctx.lineTo(x + hw, yb); ctx.lineTo(x, yb - 0.3 * s); ctx.closePath(); ctx.fill();
        }
        if (kind === 'wallpine') return;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath(); ctx.moveTo(x, y - th - 0.6 * s); ctx.lineTo(x - 0.2 * s, y - th); ctx.lineTo(x - 0.06 * s, y - th); ctx.closePath(); ctx.fill();
        return;
      }
      case 'birch': {
        shadow(0.12);
        const th = 0.42 * s;
        ctx.fillStyle = '#F2EFE8';
        ctx.fillRect(x - 0.02 * s, y - th, 0.04 * s, th);
        ctx.fillStyle = '#3F3B38';
        for (let k = 0; k < 4; k++) ctx.fillRect(x - 0.02 * s + (k % 2) * 0.02 * s, y - th * (0.2 + k * 0.2), 0.02 * s, Math.max(1, 0.009 * s));
        disc(x - 0.07 * s, y - th - 0.02 * s, 0.11 * s, '#7AB65B');
        disc(x + 0.07 * s, y - th + 0.01 * s, 0.1 * s, '#8CC56A');
        disc(x, y - th - 0.1 * s, 0.12 * s, '#9ED27A');
        return;
      }
      case 'rock': {
        if (s < 6) return;
        const w = 0.12 * s;
        ctx.fillStyle = '#9A968D';
        ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.62, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#B9B5AB';
        ctx.beginPath(); ctx.ellipse(x - w * 0.22, y - w * 0.38, w * 0.46, w * 0.2, -0.15, 0, Math.PI * 2); ctx.fill();
        return;
      }
      case 'dune': {
        if (s < 6) return;
        const w = 0.3 * s;
        ctx.fillStyle = '#E6CF98';
        ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.32, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
        if (s > 14) sbThing(ctx, 'grass', x - w * 0.15, y - w * 0.25, s, r, t, PL);
        return;
      }
      case 'lamp': {
        if (s < 6) return;
        const hgt = 0.62 * s, side = r & 2 ? 1 : -1;
        ctx.fillStyle = '#2F3340';
        ctx.fillRect(x - Math.max(0.5, 0.012 * s), y - hgt, Math.max(1, 0.024 * s), hgt);
        ctx.fillRect(Math.min(x, x - side * 0.08 * s), y - hgt, 0.08 * s, Math.max(1, 0.018 * s));
        const gx = x - side * 0.075 * s, gy = y - hgt + 0.035 * s, R = 0.26 * s;
        ctx.drawImage(sbGlow('255, 214, 140'), gx - R, gy - R, R * 2, R * 2);
        disc(gx, gy, 0.026 * s, '#FFE6A6');
        return;
      }
      case 'acacia': {
        // a flat-topped acacia: a forked trunk under a wide, flat crown
        if (s < 4) return;
        shadow(0.42);
        const th = 0.6 * s, lw = Math.max(1, 0.034 * s);
        ctx.strokeStyle = '#6B5038'; ctx.lineCap = 'round'; ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x - 0.02 * s, y - th * 0.5);
        ctx.lineTo(x - 0.24 * s, y - th * 0.97); ctx.moveTo(x - 0.02 * s, y - th * 0.5); ctx.lineTo(x + 0.2 * s, y - th);
        ctx.moveTo(x - 0.1 * s, y - th * 0.72); ctx.lineTo(x + 0.02 * s, y - th * 1.02);
        ctx.stroke();
        ctx.fillStyle = '#5E7A38';
        ctx.beginPath(); ctx.ellipse(x - 0.02 * s, y - th, 0.5 * s, 0.075 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7E9A48';
        ctx.beginPath();
        for (let k = -2; k <= 2; k++) { const cx = x + k * 0.19 * s, cy = y - th - 0.045 * s - (2 - Math.abs(k)) * 0.012 * s; ctx.moveTo(cx + 0.17 * s, cy); ctx.ellipse(cx, cy, 0.17 * s, 0.062 * s, 0, 0, Math.PI * 2); }
        ctx.fill();
        if (s > 14) {
          ctx.fillStyle = '#9BB658';
          ctx.beginPath();
          for (let k = -1; k <= 1; k++) { const cx = x + k * 0.21 * s - 0.03 * s, cy = y - th - 0.08 * s; ctx.moveTo(cx + 0.09 * s, cy); ctx.ellipse(cx, cy, 0.09 * s, 0.03 * s, 0, 0, Math.PI * 2); }
          ctx.fill();
        }
        return;
      }
      case 'gold': {
        // a clump of tall golden grass, stirring
        if (s < 14) return;
        const sw = Math.sin(t * 1.6 + x * 0.02) * 0.012 * s;
        ctx.strokeStyle = '#D2AE52'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, 0.009 * s);
        ctx.beginPath();
        for (let k = -3; k <= 3; k++) {
          ctx.moveTo(x + k * 0.01 * s, y);
          ctx.quadraticCurveTo(x + k * 0.03 * s, y - 0.1 * s, x + k * 0.05 * s + sw, y - (0.21 - Math.abs(k) * 0.022) * s);
        }
        ctx.stroke();
        ctx.fillStyle = '#EED48A';
        for (let k = -2; k <= 2; k += 2) { ctx.beginPath(); ctx.ellipse(x + k * 0.05 * s + sw, y - (0.22 - Math.abs(k) * 0.022) * s, 0.008 * s, 0.024 * s, k * 0.2, 0, Math.PI * 2); ctx.fill(); }
        return;
      }
      case 'termite': {
        // a termite mound: a tall chimney of red earth
        if (s < 6) return;
        shadow(0.13);
        const c = PL.far === 'outback' ? ['#B6532E', '#9A4426', '#D06B40'] : ['#B5764A', '#99613C', '#CC8C5C'];
        ctx.fillStyle = c[0];
        ctx.beginPath(); ctx.moveTo(x - 0.15 * s, y);
        ctx.quadraticCurveTo(x - 0.13 * s, y - 0.24 * s, x - 0.06 * s, y - 0.4 * s); ctx.quadraticCurveTo(x - 0.03 * s, y - 0.55 * s, x + 0.01 * s, y - 0.52 * s);
        ctx.quadraticCurveTo(x + 0.04 * s, y - 0.4 * s, x + 0.08 * s, y - 0.33 * s); ctx.quadraticCurveTo(x + 0.11 * s, y - 0.36 * s, x + 0.12 * s, y - 0.28 * s);
        ctx.quadraticCurveTo(x + 0.16 * s, y - 0.12 * s, x + 0.16 * s, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c[1];
        ctx.beginPath(); ctx.moveTo(x + 0.03 * s, y); ctx.quadraticCurveTo(x + 0.05 * s, y - 0.25 * s, x + 0.01 * s, y - 0.5 * s); ctx.quadraticCurveTo(x + 0.06 * s, y - 0.36 * s, x + 0.12 * s, y - 0.28 * s); ctx.quadraticCurveTo(x + 0.16 * s, y - 0.12 * s, x + 0.16 * s, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c[2];
        ctx.beginPath(); ctx.ellipse(x - 0.07 * s, y - 0.22 * s, 0.025 * s, 0.1 * s, 0.15, 0, Math.PI * 2); ctx.fill();
        return;
      }
      case 'palm': {
        // a palm: a leaning, ringed trunk and a crown of arching fronds, with dates or coconuts
        if (s < 5) return;
        shadow(0.16);
        const hgt = 1.05 * s, lean = (r & 1 ? 1 : -1) * (0.08 + ((r >>> 3) % 10) / 100) * s, jungle = PL.far === 'canopy';
        const cx = x + lean, cy = y - hgt;
        ctx.strokeStyle = jungle ? '#8E7A62' : '#A07E58'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.5, 0.05 * s);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 0.15, y - hgt * 0.6, cx, cy); ctx.stroke();
        if (s > 20) {
          ctx.strokeStyle = 'rgba(70, 50, 30, 0.35)'; ctx.lineWidth = Math.max(1, 0.008 * s);
          ctx.beginPath();
          for (let k = 1; k < 9; k++) { const f = k / 9, px = x + lean * (f * f), py = y - hgt * f; ctx.moveTo(px - 0.022 * s, py); ctx.lineTo(px + 0.022 * s, py - 0.006 * s); }
          ctx.stroke();
        }
        // fronds in pairs of one green, the darkest drawn first
        for (const [c, as] of [['#3E8E48', [-2.9, -0.25]], ['#4FA457', [-2.4, -0.75]], ['#5CB463', [-1.95, -1.2]], ['#6AC06E', [-1.58]]]) {
          ctx.fillStyle = c;
          ctx.beginPath();
          for (const a of as) {
            const L = 0.46 * s, tx = cx + Math.cos(a) * L, ty = cy + Math.sin(a) * L * 0.55 + 0.2 * s * Math.abs(Math.cos(a));
            const mx = cx + Math.cos(a) * L * 0.55, my = cy + Math.sin(a) * L * 0.75 - 0.05 * s;
            ctx.moveTo(cx, cy); ctx.quadraticCurveTo(mx, my - 0.05 * s, tx, ty); ctx.quadraticCurveTo(mx, my + 0.05 * s, cx, cy);
          }
          ctx.fill();
        }
        if (s > 10) {
          const rr = (jungle ? 0.035 : 0.022) * s;
          ctx.fillStyle = jungle ? '#7A5A3A' : '#C8792E';
          ctx.beginPath();
          for (const [dx, dy] of [[-0.04, 0.05], [0.03, 0.06], [0, 0.03]]) { ctx.moveTo(cx + dx * s + rr, cy + dy * s); ctx.arc(cx + dx * s, cy + dy * s, rr, 0, Math.PI * 2); }
          ctx.fill();
        }
        return;
      }
      case 'sandrock': {
        // a sandstone boulder in layers
        if (s < 6) return;
        shadow(0.18);
        const w = 0.2 * s, hh = 0.17 * s;
        ctx.fillStyle = '#D48E55';
        ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 1.05, y - hh * 0.9, x - w * 0.4, y - hh); ctx.quadraticCurveTo(x + w * 0.5, y - hh * 1.12, x + w, y - hh * 0.5); ctx.lineTo(x + w * 1.02, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#BF7845';
        ctx.beginPath(); ctx.moveTo(x + w * 0.3, y); ctx.quadraticCurveTo(x + w * 0.5, y - hh * 0.8, x + w, y - hh * 0.5); ctx.lineTo(x + w * 1.02, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255, 230, 190, 0.45)';
        ctx.beginPath(); ctx.ellipse(x - w * 0.25, y - hh * 0.92, w * 0.5, hh * 0.1, -0.05, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(150, 80, 40, 0.3)';
        ctx.fillRect(x - w * 0.95, y - hh * 0.45, w * 1.9, Math.max(1, hh * 0.06)); ctx.fillRect(x - w * 0.98, y - hh * 0.22, w * 1.96, Math.max(1, hh * 0.05));
        return;
      }
      case 'jtree': {
        // a jungle tree: buttress roots, a dome of big leaves, hanging vines
        const L = PL.trees;
        if (s < 13) {
          ctx.fillStyle = L[2];
          ctx.beginPath(); ctx.arc(x, y - 0.75 * s, 0.38 * s, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(x - 0.03 * s, y - 0.5 * s, 0.06 * s, 0.5 * s);
          return;
        }
        const th = 0.52 * s;
        ctx.fillStyle = '#6E6250';
        ctx.beginPath(); ctx.moveTo(x - 0.16 * s, y); ctx.quadraticCurveTo(x - 0.05 * s, y - 0.06 * s, x - 0.045 * s, y - th);
        ctx.lineTo(x + 0.045 * s, y - th); ctx.quadraticCurveTo(x + 0.05 * s, y - 0.06 * s, x + 0.16 * s, y); ctx.closePath(); ctx.fill();
        // the crown: a dark mass, a lighter top, then leaves catching the light
        const blob = (pts, c) => { ctx.fillStyle = c; ctx.beginPath(); for (const [dx, dy, rr] of pts) { ctx.moveTo(x + (dx + rr) * s, y - th + dy * s); ctx.arc(x + dx * s, y - th + dy * s, rr * s, 0, Math.PI * 2); } ctx.fill(); };
        blob([[-0.24, -0.08, 0.25], [0.24, -0.06, 0.24]], L[2]);
        blob([[-0.06, -0.3, 0.3], [0.14, -0.24, 0.2]], L[1]);
        if (s < 24) return;
        blob([[-0.16, -0.46, 0.09], [0.02, -0.52, 0.08], [-0.32, -0.22, 0.07], [0.22, -0.3, 0.08], [0.36, -0.12, 0.06]], 'rgba(190, 240, 150, 0.22)');
        ctx.strokeStyle = '#2F6E3C'; ctx.lineWidth = Math.max(1, 0.012 * s); ctx.lineCap = 'round';
        ctx.beginPath();
        for (const [dx, len] of [[-0.3, 0.3], [-0.12, 0.22], [0.2, 0.34], [0.34, 0.2]]) { ctx.moveTo(x + dx * s, y - th - 0.02 * s); ctx.quadraticCurveTo(x + (dx + 0.03) * s, y - th + len * 0.5 * s, x + dx * s, y - th + len * s); }
        ctx.stroke();
        return;
      }
      case 'banana': {
        // a banana plant: big paddle leaves with a pale rib
        if (s < 8) return;
        const top = y - 0.38 * s;
        ctx.fillStyle = '#6E9A4A'; ctx.fillRect(x - 0.022 * s, top, 0.044 * s, 0.38 * s);
        for (const [c, as] of [['#4A9A3E', [-2.7, -0.45]], ['#5CB44C', [-2.2, -0.95]], ['#6CC25A', [-1.6]]]) {
          ctx.fillStyle = c;
          ctx.beginPath();
          for (const a of as) { const cx = x + Math.cos(a) * 0.22 * s, cy = top + Math.sin(a) * 0.2 * s; ctx.moveTo(cx + Math.cos(a) * 0.25 * s, cy + Math.sin(a) * 0.25 * s); ctx.ellipse(cx, cy, 0.25 * s, 0.075 * s, a, 0, Math.PI * 2); }
          ctx.fill();
        }
        if (s > 24) {
          ctx.strokeStyle = 'rgba(220, 240, 180, 0.6)'; ctx.lineWidth = Math.max(1, 0.008 * s);
          ctx.beginPath();
          for (const a of [-2.7, -0.45, -2.2, -0.95, -1.6]) { ctx.moveTo(x, top); ctx.lineTo(x + Math.cos(a) * 0.46 * s, top + Math.sin(a) * 0.44 * s); }
          ctx.stroke();
        }
        return;
      }
      case 'heliconia': {
        // heliconias: upright leaves and a zigzag of red and gold bracts
        if (s < 12) return;
        ctx.fillStyle = '#3E9A4A';
        for (const [dx, a] of [[-0.06, -0.25], [0.06, 0.2], [0, 0]]) { ctx.beginPath(); ctx.ellipse(x + dx * s, y - 0.17 * s, 0.035 * s, 0.17 * s, a, 0, Math.PI * 2); ctx.fill(); }
        const bx = x + 0.03 * s;
        ctx.fillStyle = '#4E7A30'; ctx.fillRect(bx - 0.005 * s, y - 0.34 * s, Math.max(1, 0.01 * s), 0.34 * s);
        for (let k = 0; k < 5; k++) {
          const yy = y - 0.32 * s + k * 0.055 * s, sd = k % 2 ? 1 : -1;
          ctx.fillStyle = '#E8343A';
          ctx.beginPath(); ctx.moveTo(bx, yy); ctx.lineTo(bx + sd * 0.07 * s, yy - 0.012 * s); ctx.lineTo(bx, yy + 0.035 * s); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#FFC93C';
          ctx.beginPath(); ctx.arc(bx + sd * 0.065 * s, yy - 0.01 * s, Math.max(0.8, 0.008 * s), 0, Math.PI * 2); ctx.fill();
        }
        return;
      }
      case 'mossrock': {
        if (s < 6) return;
        sbThing(ctx, 'rock', x, y, s * 1.2, r, t, PL);
        ctx.fillStyle = '#5FA352';
        ctx.beginPath(); ctx.ellipse(x - 0.03 * s, y - 0.085 * s, 0.1 * s, 0.03 * s, -0.1, 0, Math.PI * 2); ctx.fill();
        return;
      }
      case 'gum': {
        // a gum tree: a pale trunk that forks, sparse grey-green leaves
        if (s < 5) return;
        shadow(0.22);
        const th = 0.55 * s, lw = Math.max(1, 0.04 * s);
        ctx.strokeStyle = '#E8E1D4'; ctx.lineCap = 'round'; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 0.02 * s, y - th * 0.5, x - 0.12 * s, y - th);
        ctx.moveTo(x + 0.01 * s, y - th * 0.45); ctx.quadraticCurveTo(x + 0.1 * s, y - th * 0.7, x + 0.16 * s, y - th * 0.95); ctx.stroke();
        if (s > 16) { ctx.strokeStyle = 'rgba(160, 130, 110, 0.5)'; ctx.lineWidth = Math.max(1, lw * 0.35); ctx.beginPath(); ctx.moveTo(x + lw * 0.2, y - th * 0.1); ctx.lineTo(x + lw * 0.3, y - th * 0.3); ctx.stroke(); }
        for (const [dx, dy, rr, c] of [[-0.14, -1.05, 0.16, '#7E9078'], [0.16, -1.0, 0.15, '#8FA08A'], [0.0, -1.18, 0.17, '#9DAE96'], [-0.26, -0.9, 0.1, '#8FA08A'], [0.28, -0.86, 0.1, '#7E9078']]) {
          ctx.fillStyle = c;
          ctx.beginPath(); ctx.ellipse(x + dx * s, y + dy * th, rr * s, rr * 0.6 * s, 0, 0, Math.PI * 2); ctx.fill();
        }
        return;
      }
      case 'spinifex': {
        // a spinifex tussock: a round, spiky dome
        if (s < 6) return;
        const w = 0.15 * s;
        ctx.fillStyle = '#9EA35E';
        ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.62, 0, Math.PI, Math.PI * 2); ctx.fill();
        if (s > 12) {
          ctx.strokeStyle = '#C4C27E'; ctx.lineWidth = 1; ctx.lineCap = 'round';
          ctx.beginPath();
          for (let k = 0; k < 9; k++) { const a = Math.PI + (k + 0.5) * (Math.PI / 9); ctx.moveTo(x + Math.cos(a) * w * 0.5, y + Math.sin(a) * w * 0.3); ctx.lineTo(x + Math.cos(a) * w * 1.18, y + Math.sin(a) * w * 0.75); }
          ctx.stroke();
        }
        return;
      }
      case 'redrock': {
        if (s < 6) return;
        shadow(0.14);
        const w = 0.14 * s;
        ctx.fillStyle = '#A84A30';
        ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.7, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#D06A42';
        ctx.beginPath(); ctx.ellipse(x - w * 0.25, y - w * 0.45, w * 0.5, w * 0.2, -0.15, 0, Math.PI * 2); ctx.fill();
        return;
      }
      case 'spruce': {
        // a spruce in snow: dark tiers, each with snow along its top
        if (s < 5) return;
        if (s > 12) shadow(0.16);
        const th = 0.08 * s;
        ctx.fillStyle = '#4A3A30'; ctx.fillRect(x - 0.02 * s, y - th, 0.04 * s, th);
        for (let k = 0; k < 4; k++) {
          const yb = y - th - k * 0.17 * s, hw = (0.24 - k * 0.05) * s, ht = 0.3 * s;
          ctx.fillStyle = k % 2 ? '#24483E' : '#1C3B33';
          ctx.beginPath(); ctx.moveTo(x - hw, yb); ctx.lineTo(x + hw, yb); ctx.lineTo(x, yb - ht); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#EAF2FA';
          ctx.beginPath(); ctx.moveTo(x - hw * 0.62, yb - ht * 0.38); ctx.lineTo(x, yb - ht); ctx.lineTo(x + hw * 0.62, yb - ht * 0.38);
          ctx.quadraticCurveTo(x + hw * 0.3, yb - ht * 0.48, x + hw * 0.15, yb - ht * 0.36); ctx.quadraticCurveTo(x, yb - ht * 0.5, x - hw * 0.2, yb - ht * 0.37); ctx.quadraticCurveTo(x - hw * 0.4, yb - ht * 0.48, x - hw * 0.62, yb - ht * 0.38); ctx.fill();
        }
        return;
      }
      case 'snowrock': {
        if (s < 6) return;
        const w = 0.13 * s;
        ctx.fillStyle = '#6F7C92';
        ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.62, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#F0F6FC';
        ctx.beginPath(); ctx.ellipse(x - w * 0.05, y - w * 0.5, w * 0.8, w * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        return;
      }
      case 'snowman': {
        // a snowman with a red scarf, coal eyes and a carrot nose
        if (s < 10) return;
        shadow(0.1);
        disc(x, y - 0.09 * s, 0.1 * s, '#F4F8FC');
        disc(x, y - 0.24 * s, 0.075 * s, '#F4F8FC');
        disc(x, y - 0.36 * s, 0.055 * s, '#F4F8FC');
        ctx.fillStyle = '#D33A3A'; ctx.fillRect(x - 0.06 * s, y - 0.31 * s, 0.12 * s, 0.025 * s); ctx.fillRect(x + 0.02 * s, y - 0.31 * s, 0.025 * s, 0.07 * s);
        if (s > 18) {
          disc(x - 0.02 * s, y - 0.375 * s, Math.max(0.8, 0.008 * s), '#1F2230'); disc(x + 0.02 * s, y - 0.375 * s, Math.max(0.8, 0.008 * s), '#1F2230');
          ctx.fillStyle = '#FF8A2B'; ctx.beginPath(); ctx.moveTo(x, y - 0.36 * s); ctx.lineTo(x + 0.06 * s, y - 0.352 * s); ctx.lineTo(x, y - 0.345 * s); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#6B4423'; ctx.lineWidth = Math.max(1, 0.008 * s);
          ctx.beginPath(); ctx.moveTo(x - 0.07 * s, y - 0.25 * s); ctx.lineTo(x - 0.15 * s, y - 0.31 * s); ctx.moveTo(x + 0.07 * s, y - 0.25 * s); ctx.lineTo(x + 0.15 * s, y - 0.3 * s); ctx.stroke();
        }
        return;
      }
      case 'house': {
        if (s < 6) return;
        shadow(0.2);
        const w = 0.32 * s, hh = 0.2 * s;
        ctx.fillStyle = ['#E3D3BA', '#DEC8A2', '#D3BDC2'][r % 3];
        ctx.fillRect(x - w / 2, y - hh, w, hh);
        ctx.fillStyle = '#8B4A3D';
        ctx.beginPath(); ctx.moveTo(x - w * 0.6, y - hh); ctx.lineTo(x, y - hh - 0.16 * s); ctx.lineTo(x + w * 0.6, y - hh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#FFD877';
        ctx.fillRect(x - w * 0.34, y - hh * 0.72, w * 0.18, hh * 0.3);
        ctx.fillRect(x + w * 0.16, y - hh * 0.72, w * 0.18, hh * 0.3);
        ctx.fillStyle = '#6B4A36';
        ctx.fillRect(x - w * 0.07, y - hh * 0.55, w * 0.14, hh * 0.55);
        return;
      }
    }
  }
  // the landmark a drive heads for, standing on (x, y); s is pixels per world unit
  function sbDest(ctx, kind, x, y, s, t) {
    const disc = (cx, cy, rr, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill(); };
    const poly = (pts, c) => { ctx.fillStyle = c; ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fill(); };
    ctx.fillStyle = 'rgba(30, 50, 30, 0.18)';
    ctx.beginPath(); ctx.ellipse(x, y, 0.75 * s, 0.06 * s, 0, 0, Math.PI * 2); ctx.fill();
    if (kind === 'barn') {
      const sx = x + 0.52 * s;
      ctx.fillStyle = '#C8D2DC'; ctx.fillRect(sx - 0.13 * s, y - 0.86 * s, 0.26 * s, 0.86 * s);
      ctx.fillStyle = '#AFBAC6'; ctx.fillRect(sx + 0.03 * s, y - 0.86 * s, 0.1 * s, 0.86 * s);
      ctx.fillStyle = '#8E9AA9'; ctx.beginPath(); ctx.ellipse(sx, y - 0.86 * s, 0.13 * s, 0.1 * s, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(120, 132, 146, 0.6)'; ctx.lineWidth = Math.max(0.6, 0.01 * s);
      ctx.beginPath(); for (let q = 1; q < 5; q++) { ctx.moveTo(sx - 0.13 * s, y - q * 0.17 * s); ctx.lineTo(sx + 0.13 * s, y - q * 0.17 * s); } ctx.stroke();
      const bw = 0.92 * s, bh = 0.5 * s, bl = x - 0.66 * s;
      ctx.fillStyle = '#CC463C'; ctx.fillRect(bl, y - bh, bw, bh);
      ctx.fillStyle = 'rgba(80, 10, 10, 0.14)'; ctx.fillRect(bl + bw * 0.62, y - bh, bw * 0.38, bh);
      poly([[bl - 0.05 * s, y - bh], [bl + 0.07 * s, y - bh - 0.24 * s], [bl + bw / 2, y - bh - 0.38 * s], [bl + bw - 0.07 * s, y - bh - 0.24 * s], [bl + bw + 0.05 * s, y - bh]], '#7C2F29');
      const dx0 = bl + bw / 2 - 0.15 * s, dw = 0.3 * s, dh = 0.34 * s;
      ctx.fillStyle = '#A8352E'; ctx.fillRect(dx0, y - dh, dw, dh);
      ctx.strokeStyle = '#FFF6EA'; ctx.lineWidth = Math.max(1, 0.024 * s);
      ctx.strokeRect(dx0, y - dh, dw, dh);
      ctx.beginPath(); ctx.moveTo(dx0, y - dh); ctx.lineTo(dx0 + dw, y); ctx.moveTo(dx0 + dw, y - dh); ctx.lineTo(dx0, y); ctx.stroke();
      ctx.fillStyle = '#FFF6EA'; ctx.fillRect(bl + bw / 2 - 0.07 * s, y - bh - 0.22 * s, 0.14 * s, 0.11 * s);
      ctx.fillStyle = '#7C2F29'; ctx.fillRect(bl + bw / 2 - 0.045 * s, y - bh - 0.2 * s, 0.09 * s, 0.07 * s);
      return;
    }
    if (kind === 'windmill') {
      const hgt = 1.15 * s, wb = 0.27 * s, wt = 0.15 * s, top = y - hgt;
      poly([[x - wb, y], [x - wt, top], [x + wt, top], [x + wb, y]], '#F4EFE4');
      poly([[x + wb * 0.3, y], [x + wt * 0.3, top], [x + wt, top], [x + wb, y]], '#DFD6C5');
      ctx.fillStyle = '#7A4E36';
      ctx.fillRect(x - 0.055 * s, y - 0.2 * s, 0.11 * s, 0.2 * s);
      ctx.fillRect(x - 0.035 * s, y - 0.66 * s, 0.07 * s, 0.09 * s);
      poly([[x - wt * 1.3, top + 0.03 * s], [x - wt * 0.7, top - 0.14 * s], [x + wt * 0.7, top - 0.14 * s], [x + wt * 1.3, top + 0.03 * s]], '#7A4E36');
      const hx = x, hy = top - 0.04 * s, L = 0.74 * s, a0 = t * 0.85;
      for (let k = 0; k < 4; k++) {
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(a0 + (k * Math.PI) / 2);
        ctx.fillStyle = '#8B6A4E'; ctx.fillRect(-0.012 * s, 0, 0.024 * s, L);
        ctx.fillStyle = '#FBF8F1'; ctx.fillRect(0.016 * s, 0.13 * s, 0.13 * s, L - 0.13 * s);
        ctx.strokeStyle = '#CDBB9F'; ctx.lineWidth = Math.max(0.6, 0.008 * s);
        ctx.beginPath();
        for (let q = 1; q < 5; q++) { const yy = 0.13 * s + (q * (L - 0.13 * s)) / 5; ctx.moveTo(0.016 * s, yy); ctx.lineTo(0.146 * s, yy); }
        ctx.stroke();
        ctx.restore();
      }
      disc(hx, hy, 0.04 * s, '#5B3B28');
      return;
    }
    if (kind === 'cabin') {
      sbThing(ctx, 'pine', x - 0.6 * s, y - 0.03 * s, s * 1.35, 1, t, {});
      sbThing(ctx, 'pine', x + 0.66 * s, y - 0.02 * s, s * 1.15, 2, t, {});
      const w = 0.8 * s, hh = 0.38 * s, l = x - w / 2;
      for (let q = 0; q < 4; q++) {
        const u = (t * 0.32 + q / 4) % 1;
        ctx.fillStyle = 'rgba(244, 244, 248, ' + (0.6 * (1 - u)).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(x + 0.23 * s + u * 0.2 * s, y - hh - 0.38 * s - u * 0.55 * s, (0.04 + u * 0.09) * s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#8B8279'; ctx.fillRect(x + 0.18 * s, y - hh - 0.36 * s, 0.1 * s, 0.26 * s);
      ctx.fillStyle = '#9C6A44'; ctx.fillRect(l, y - hh, w, hh);
      ctx.strokeStyle = '#7F5334'; ctx.lineWidth = Math.max(0.8, 0.013 * s);
      ctx.beginPath(); for (let q = 1; q < 5; q++) { const yy = y - (hh * q) / 5; ctx.moveTo(l, yy); ctx.lineTo(l + w, yy); } ctx.stroke();
      poly([[l - 0.09 * s, y - hh + 0.01 * s], [x, y - hh - 0.33 * s], [l + w + 0.09 * s, y - hh + 0.01 * s]], '#5A3A2A');
      ctx.drawImage(sbGlow('255, 214, 140'), l + 0.06 * s, y - hh * 0.9, 0.26 * s, 0.26 * s);
      ctx.fillStyle = '#FFD877'; ctx.fillRect(l + 0.11 * s, y - hh * 0.74, 0.16 * s, 0.13 * s);
      ctx.fillStyle = '#6B4128'; ctx.fillRect(x + 0.06 * s, y - 0.27 * s, 0.14 * s, 0.27 * s);
      return;
    }
    if (kind === 'lighthouse') {
      const hgt = 1.6 * s, wb = 0.2 * s, wt = 0.13 * s, top = y - hgt;
      const wAt = (yy) => wb + ((wt - wb) * (y - yy)) / hgt;
      ctx.fillStyle = '#8F8D95'; ctx.beginPath(); ctx.ellipse(x, y, 0.46 * s, 0.17 * s, 0, Math.PI, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 5; k++) {
        const y0 = y - (hgt * k) / 5, y1 = y - (hgt * (k + 1)) / 5;
        poly([[x - wAt(y0), y0], [x - wAt(y1), y1], [x + wAt(y1), y1], [x + wAt(y0), y0]], k % 2 ? '#FBF6EE' : '#E0483E');
      }
      poly([[x + wb * 0.35, y], [x + wt * 0.35, top], [x + wt, top], [x + wb, y]], 'rgba(60, 30, 50, 0.13)');
      ctx.fillStyle = '#3A3F4B'; ctx.fillRect(x - wt * 1.55, top - 0.035 * s, wt * 3.1, 0.045 * s);
      const ly = top - 0.12 * s;
      ctx.drawImage(sbGlow('255, 230, 160'), x - 0.5 * s, ly - 0.5 * s, s, s);
      ctx.fillStyle = '#FFE9A6'; ctx.fillRect(x - wt * 0.8, top - 0.21 * s, wt * 1.6, 0.18 * s);
      poly([[x - wt * 1.1, top - 0.21 * s], [x, top - 0.36 * s], [x + wt * 1.1, top - 0.21 * s]], '#3A3F4B');
      const sw = Math.sin(t * 1.2), bl = 2.4 * s * sw, spread = 0.05 * s + 0.16 * s * Math.abs(sw);
      ctx.fillStyle = 'rgba(255, 238, 176, 0.26)';
      ctx.beginPath(); ctx.moveTo(x, ly); ctx.lineTo(x + bl, ly - spread); ctx.lineTo(x + bl, ly + spread); ctx.closePath(); ctx.fill();
      return;
    }
    if (kind === 'baobab') {
      // a great baobab, its trunk like a bottle and its branches like roots in the air,
      // and a round thatched hut at its foot
      const tw = 0.4 * s, th = 1.25 * s;
      ctx.fillStyle = '#A38A72';
      ctx.beginPath(); ctx.moveTo(x - tw * 1.05, y);
      ctx.bezierCurveTo(x - tw * 1.2, y - th * 0.4, x - tw * 0.55, y - th * 0.7, x - tw * 0.6, y - th);
      ctx.lineTo(x + tw * 0.55, y - th); ctx.bezierCurveTo(x + tw * 0.5, y - th * 0.7, x + tw * 1.2, y - th * 0.4, x + tw * 1.05, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8E7660';
      ctx.beginPath(); ctx.moveTo(x + tw * 0.15, y); ctx.bezierCurveTo(x + tw * 0.4, y - th * 0.4, x + tw * 0.2, y - th * 0.7, x + tw * 0.3, y - th);
      ctx.lineTo(x + tw * 0.55, y - th); ctx.bezierCurveTo(x + tw * 0.5, y - th * 0.7, x + tw * 1.2, y - th * 0.4, x + tw * 1.05, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255, 240, 220, 0.18)'; ctx.lineWidth = Math.max(1, 0.012 * s);
      ctx.beginPath(); for (const dx of [-0.7, -0.4, -0.1]) { ctx.moveTo(x + dx * tw, y - th * 0.05); ctx.quadraticCurveTo(x + (dx - 0.1) * tw, y - th * 0.5, x + dx * tw * 0.7, y - th * 0.92); } ctx.stroke();
      ctx.strokeStyle = '#A38A72'; ctx.lineCap = 'round';
      const br = [[-0.5, -1.0, -1.0, -1.32, 0.07], [-0.2, -1.0, -0.42, -1.48, 0.06], [0.15, -1.0, 0.2, -1.52, 0.06], [0.45, -1.0, 0.95, -1.36, 0.07], [-0.85, -1.26, -1.18, -1.3, 0.035], [0.8, -1.3, 1.12, -1.44, 0.035]];
      for (const [a, b, c, d, w] of br) { ctx.lineWidth = w * s; ctx.beginPath(); ctx.moveTo(x + a * tw, y + b * th); ctx.lineTo(x + c * tw, y + d * th); ctx.stroke(); }
      for (const [dx, dy, rr] of [[-1.0, -1.34, 0.13], [-0.42, -1.5, 0.12], [0.2, -1.54, 0.12], [0.95, -1.38, 0.13], [-1.18, -1.3, 0.08], [1.12, -1.46, 0.08], [0.6, -1.5, 0.1]]) {
        disc(x + dx * tw, y + dy * th, rr * s, '#6E8E48');
        disc(x + dx * tw - 0.03 * s, y + dy * th - 0.03 * s, rr * 0.55 * s, '#86A656');
      }
      const hx = x + 0.95 * s, hw = 0.26 * s, hh = 0.2 * s;
      ctx.fillStyle = '#E9D6AE'; ctx.fillRect(hx - hw, y - hh, hw * 2, hh);
      ctx.fillStyle = '#6B4A30'; ctx.fillRect(hx - 0.05 * s, y - hh * 0.8, 0.1 * s, hh * 0.8);
      ctx.fillStyle = '#C79A4C';
      ctx.beginPath(); ctx.moveTo(hx - hw * 1.25, y - hh + 0.01 * s); ctx.quadraticCurveTo(hx - hw * 0.4, y - hh - 0.12 * s, hx, y - hh - 0.26 * s); ctx.quadraticCurveTo(hx + hw * 0.4, y - hh - 0.12 * s, hx + hw * 1.25, y - hh + 0.01 * s); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(120, 80, 30, 0.45)'; ctx.lineWidth = Math.max(1, 0.01 * s);
      ctx.beginPath(); for (const f of [0.35, 0.65]) { ctx.moveTo(hx - hw * (1.25 - f * 0.6), y - hh - 0.26 * s * f * 0.9); ctx.lineTo(hx + hw * (1.25 - f * 0.6), y - hh - 0.26 * s * f * 0.9); } ctx.stroke();
      return;
    }
    if (kind === 'oasis') {
      // palms round a pool, and a house of mud brick with a tower
      ctx.fillStyle = '#3FA6C8'; ctx.beginPath(); ctx.ellipse(x - 0.3 * s, y - 0.01 * s, 0.75 * s, 0.11 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7FD2E8'; ctx.beginPath(); ctx.ellipse(x - 0.42 * s, y - 0.035 * s, 0.4 * s, 0.04 * s, 0, 0, Math.PI * 2); ctx.fill();
      const bx = x + 0.15 * s, bw = 0.7 * s, bh = 0.36 * s;
      ctx.fillStyle = '#D8A065'; ctx.fillRect(bx, y - bh, bw, bh);
      ctx.fillStyle = '#C48A52'; ctx.fillRect(bx + bw * 0.62, y - bh, bw * 0.38, bh);
      for (let k = 0; k < 5; k++) { ctx.fillStyle = '#D8A065'; ctx.fillRect(bx + k * bw * 0.21, y - bh - 0.05 * s, bw * 0.12, 0.05 * s); }
      const tx = bx + bw * 0.3, tw = 0.24 * s, tht = 0.82 * s;
      ctx.fillStyle = '#E2AE72'; ctx.fillRect(tx, y - tht, tw, tht);
      ctx.fillStyle = '#CB935A'; ctx.fillRect(tx + tw * 0.6, y - tht, tw * 0.4, tht);
      for (let k = 0; k < 3; k++) { ctx.fillStyle = '#E2AE72'; ctx.fillRect(tx - 0.015 * s + k * tw * 0.42, y - tht - 0.05 * s, tw * 0.22, 0.05 * s); }
      ctx.fillStyle = '#5A3A26';
      ctx.fillRect(tx + tw * 0.32, y - tht * 0.8, tw * 0.36, 0.08 * s); ctx.fillRect(tx + tw * 0.32, y - tht * 0.55, tw * 0.36, 0.08 * s);
      ctx.beginPath(); ctx.moveTo(bx + bw * 0.12, y); ctx.lineTo(bx + bw * 0.12, y - 0.16 * s); ctx.quadraticCurveTo(bx + bw * 0.2, y - 0.24 * s, bx + bw * 0.28, y - 0.16 * s); ctx.lineTo(bx + bw * 0.28, y); ctx.fill();
      ctx.fillRect(bx + bw * 0.72, y - bh * 0.62, 0.07 * s, 0.07 * s);
      sbThing(ctx, 'palm', x - 0.85 * s, y, s * 1.3, 3, t, {});
      sbThing(ctx, 'palm', x - 0.35 * s, y + 0.01 * s, s * 1.05, 4, t, {});
      sbThing(ctx, 'palm', x + 1.0 * s, y, s * 1.2, 1, t, {});
      return;
    }
    if (kind === 'waterfall') {
      // a cliff hung with green; the fall drops into a pool, throws up spray and a rainbow
      const cw = 1.5 * s, ch = 1.9 * s;
      ctx.fillStyle = '#6F7C74';
      ctx.beginPath(); ctx.moveTo(x - cw, y); ctx.lineTo(x - cw * 0.95, y - ch * 0.7); ctx.quadraticCurveTo(x - cw * 0.8, y - ch * 1.02, x - cw * 0.3, y - ch);
      ctx.lineTo(x + cw * 0.35, y - ch * 1.03); ctx.quadraticCurveTo(x + cw * 0.85, y - ch * 0.98, x + cw * 0.96, y - ch * 0.6); ctx.lineTo(x + cw, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5E6A64';
      ctx.beginPath(); ctx.moveTo(x + cw * 0.3, y); ctx.lineTo(x + cw * 0.35, y - ch * 1.03); ctx.quadraticCurveTo(x + cw * 0.85, y - ch * 0.98, x + cw * 0.96, y - ch * 0.6); ctx.lineTo(x + cw, y); ctx.closePath(); ctx.fill();
      for (const [dx, dy, rr, c] of [[-0.8, -0.98, 0.3, '#3F8F52'], [-0.45, -1.02, 0.26, '#4FA05E'], [0.55, -1.0, 0.3, '#3F8F52'], [0.85, -0.9, 0.24, '#4FA05E'], [-0.92, -0.62, 0.16, '#4FA05E'], [0.9, -0.5, 0.16, '#3F8F52'], [-0.7, -0.3, 0.14, '#3F8F52'], [0.75, -0.22, 0.13, '#4FA05E']]) disc(x + dx * cw, y + dy * ch, rr * s, c);
      const fw = 0.3 * s, top = y - ch * 0.98;
      ctx.fillStyle = '#BFE9F2'; ctx.fillRect(x - fw, top, fw * 2, ch * 0.98);
      ctx.fillStyle = '#FFFFFF';
      for (let k = 0; k < 5; k++) {
        const lx = x - fw + (k + 0.3) * fw * 0.4, sp = ch * 0.98;
        for (let m = 0; m < 3; m++) { const yy = top + (((t * 0.9 + k * 0.23 + m / 3) % 1) * sp); ctx.fillRect(lx, yy, Math.max(1, fw * 0.12), Math.min(sp * 0.2, y - yy)); }
      }
      ctx.fillStyle = '#4FB0C4'; ctx.beginPath(); ctx.ellipse(x, y, 0.8 * s, 0.1 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(sbGlow('255, 255, 255'), x - 0.7 * s, y - 0.5 * s, 1.4 * s, 0.7 * s);
      ctx.lineWidth = Math.max(1, 0.035 * s);
      for (const [c, rr] of [['rgba(255, 90, 90, 0.22)', 0.62], ['rgba(255, 210, 80, 0.22)', 0.58], ['rgba(110, 220, 120, 0.22)', 0.54], ['rgba(90, 150, 255, 0.22)', 0.5]]) {
        ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(x + 0.25 * s, y + 0.05 * s, rr * s, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      }
      return;
    }
    if (kind === 'monolith') {
      // the great red rock, glowing in the last of the sun, its face ribbed with gullies
      const w = 1.7 * s, hh = 0.78 * s;
      ctx.fillStyle = '#D65A32';
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.bezierCurveTo(x - w * 1.02, y - hh * 0.7, x - w * 0.85, y - hh, x - w * 0.5, y - hh);
      ctx.bezierCurveTo(x - w * 0.1, y - hh * 1.06, x + w * 0.4, y - hh * 1.02, x + w * 0.7, y - hh * 0.92); ctx.bezierCurveTo(x + w * 0.95, y - hh * 0.8, x + w * 1.02, y - hh * 0.4, x + w, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#F28A50';
      ctx.beginPath(); ctx.moveTo(x - w * 0.95, y - hh * 0.5); ctx.bezierCurveTo(x - w * 0.9, y - hh * 0.9, x - w * 0.6, y - hh * 0.98, x - w * 0.3, y - hh * 0.99);
      ctx.bezierCurveTo(x - w * 0.5, y - hh * 0.85, x - w * 0.7, y - hh * 0.6, x - w * 0.95, y - hh * 0.5); ctx.fill();
      ctx.strokeStyle = 'rgba(110, 30, 25, 0.4)'; ctx.lineWidth = Math.max(1, 0.025 * s); ctx.lineCap = 'round';
      ctx.beginPath();
      for (const f of [-0.62, -0.4, -0.15, 0.1, 0.32, 0.55, 0.78]) { const gx = x + f * w; ctx.moveTo(gx, y - hh * (0.95 - Math.abs(f) * 0.25)); ctx.quadraticCurveTo(gx + 0.04 * s, y - hh * 0.5, gx - 0.02 * s, y - hh * 0.06); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(80, 20, 40, 0.25)';
      ctx.beginPath(); ctx.moveTo(x + w * 0.45, y); ctx.bezierCurveTo(x + w * 0.6, y - hh * 0.5, x + w * 0.62, y - hh * 0.9, x + w * 0.7, y - hh * 0.92); ctx.bezierCurveTo(x + w * 0.95, y - hh * 0.8, x + w * 1.02, y - hh * 0.4, x + w, y); ctx.closePath(); ctx.fill();
      return;
    }
    if (kind === 'cottage') {
      // a red cottage with white corners, snow on the roof, lit windows and smoke
      sbThing(ctx, 'spruce', x - 0.78 * s, y, s * 1.5, 2, t, {});
      const w = 0.86 * s, hh = 0.42 * s, l = x - w / 2;
      for (let q = 0; q < 4; q++) {
        const u = (t * 0.3 + q / 4) % 1;
        ctx.fillStyle = 'rgba(214, 224, 240, ' + (0.55 * (1 - u)).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(x + 0.24 * s + u * 0.22 * s, y - hh - 0.42 * s - u * 0.55 * s, (0.04 + u * 0.09) * s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#5A4E52'; ctx.fillRect(x + 0.18 * s, y - hh - 0.4 * s, 0.1 * s, 0.26 * s);
      ctx.fillStyle = '#B5302C'; ctx.fillRect(l, y - hh, w, hh);
      ctx.fillStyle = 'rgba(60, 10, 20, 0.18)'; ctx.fillRect(l + w * 0.6, y - hh, w * 0.4, hh);
      ctx.fillStyle = '#F4F1EA'; ctx.fillRect(l, y - hh, 0.04 * s, hh); ctx.fillRect(l + w - 0.04 * s, y - hh, 0.04 * s, hh);
      ctx.fillStyle = '#3A2E30';
      ctx.beginPath(); ctx.moveTo(l - 0.1 * s, y - hh + 0.02 * s); ctx.lineTo(x, y - hh - 0.34 * s); ctx.lineTo(l + w + 0.1 * s, y - hh + 0.02 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#F2F7FC';
      ctx.beginPath(); ctx.moveTo(l - 0.13 * s, y - hh - 0.01 * s); ctx.lineTo(x, y - hh - 0.38 * s); ctx.lineTo(l + w + 0.13 * s, y - hh - 0.01 * s);
      ctx.quadraticCurveTo(l + w * 0.75, y - hh + 0.03 * s, l + w * 0.5, y - hh - 0.02 * s); ctx.quadraticCurveTo(l + w * 0.25, y - hh + 0.04 * s, l - 0.13 * s, y - hh - 0.01 * s); ctx.fill();
      for (const wx of [l + 0.12 * s, l + w - 0.3 * s]) {
        ctx.drawImage(sbGlow('255, 214, 140'), wx - 0.12 * s, y - hh * 0.82 - 0.06 * s, 0.42 * s, 0.32 * s);
        ctx.fillStyle = '#FFD877'; ctx.fillRect(wx, y - hh * 0.72, 0.17 * s, 0.14 * s);
        ctx.strokeStyle = '#F4F1EA'; ctx.lineWidth = Math.max(1, 0.018 * s); ctx.strokeRect(wx, y - hh * 0.72, 0.17 * s, 0.14 * s);
        ctx.beginPath(); ctx.moveTo(wx + 0.085 * s, y - hh * 0.72); ctx.lineTo(wx + 0.085 * s, y - hh * 0.72 + 0.14 * s); ctx.stroke();
      }
      ctx.fillStyle = '#5A3428'; ctx.fillRect(x - 0.06 * s, y - 0.25 * s, 0.13 * s, 0.25 * s);
      ctx.fillStyle = '#F2F7FC'; ctx.beginPath(); ctx.ellipse(x, y, 0.62 * s, 0.05 * s, 0, Math.PI, Math.PI * 2); ctx.fill();
      return;
    }
    if (kind === 'village') {
      const cx = x + 0.12 * s;
      ctx.fillStyle = '#DDD6CA'; ctx.fillRect(cx - 0.2 * s, y - 0.4 * s, 0.34 * s, 0.4 * s);
      poly([[cx - 0.24 * s, y - 0.4 * s], [cx - 0.03 * s, y - 0.6 * s], [cx + 0.18 * s, y - 0.4 * s]], '#7E4337');
      ctx.fillStyle = '#E8E1D5'; ctx.fillRect(cx + 0.12 * s, y - 0.9 * s, 0.16 * s, 0.9 * s);
      poly([[cx + 0.1 * s, y - 0.9 * s], [cx + 0.2 * s, y - 1.25 * s], [cx + 0.3 * s, y - 0.9 * s]], '#4E405E');
      disc(cx + 0.2 * s, y - 0.77 * s, 0.04 * s, '#FFF1C4');
      ctx.fillStyle = '#FFD877';
      ctx.fillRect(cx - 0.12 * s, y - 0.3 * s, 0.05 * s, 0.1 * s);
      ctx.fillRect(cx - 0.02 * s, y - 0.3 * s, 0.05 * s, 0.1 * s);
      ctx.fillRect(cx + 0.175 * s, y - 0.55 * s, 0.05 * s, 0.09 * s);
      for (const [dx, w, hh, c, rf] of [[-0.62, 0.36, 0.26, '#E6D6BD', '#8B4A3D'], [-0.3, 0.26, 0.2, '#E0C9A0', '#7E4337'], [0.62, 0.32, 0.24, '#D6C0C6', '#8B4A3D']]) {
        const hx = x + dx * s;
        ctx.fillStyle = c; ctx.fillRect(hx - (w / 2) * s, y - hh * s, w * s, hh * s);
        poly([[hx - w * 0.62 * s, y - hh * s], [hx, y - (hh + 0.17) * s], [hx + w * 0.62 * s, y - hh * s]], rf);
        ctx.fillStyle = '#FFD877';
        ctx.fillRect(hx - w * 0.32 * s, y - hh * 0.7 * s, w * 0.2 * s, hh * 0.3 * s);
        ctx.fillRect(hx + w * 0.12 * s, y - hh * 0.7 * s, w * 0.2 * s, hh * 0.3 * s);
      }
      return;
    }
  }
  // ---- the animals that cross the roads
  // Each animal is one list of parts, side on and facing right, feet on y = 0, about
  // 100 units long or tall. The same list draws the animal in colour (crossing the
  // road, hopping off a caught sign, standing in the fields) and as the black
  // silhouette on its sign. Parts: e ellipse, c circle, p SVG path, l line, q curve
  // (all filled or stroked in their colour), g leg (hip, length, width, pair, foot),
  // qg bent leg (hip, knee, foot, width, pair); clip/end clip what is between them to
  // a shape. The last two entries of a part are its colour and flags: d is a detail
  // left off the silhouette; k and r move back and forward in a hop.
  const SB_ANIM = (() => {
    const A = {};
    A.cow = { len: 0.8, gait: 'walk', stride: 7, lift: 4, rate: 1.4, parts: [
      ['g', -22, -38, 38, 7.5, 1, 'hoof', '#D8D1C4', ''], ['g', 20, -38, 38, 7.5, 0, 'hoof', '#D8D1C4', ''],
      ['q', -38, -52, -46, -46, -44, -26, 2.8, '#F7F4EE', ''], ['e', -44, -23, 3.2, 5.2, 0, '#2F2B29', ''],
      ['e', -4, -50, 37, 17, 0, '#F7F4EE', ''],
      ['clip', 'e', -4, -50, 37, 17, 0], ['e', -18, -59, 12, 9, 0.4, '#2F2B29', 'd'], ['e', 11, -39, 9, 6, -0.2, '#2F2B29', 'd'], ['e', -40, -46, 7, 9, 0, '#2F2B29', 'd'], ['end'],
      ['e', -12, -33.5, 6, 4, 0, '#F2B6AE', 'd'],
      ['g', -28, -38, 38, 8, 0, 'hoof', '#EFEAE0', ''], ['g', 14, -38, 38, 8, 1, 'hoof', '#EFEAE0', ''],
      ['e', 25, -54, 12, 11.5, -0.6, '#F7F4EE', ''],
      ['q', 33, -67, 32, -75, 37, -78, 3.2, '#EADFC4', ''],
      ['e', 25, -64, 8.5, 3.2, 0.2, '#F7F4EE', ''], ['e', 25.5, -64, 5.4, 1.6, 0.2, '#F2B8B0', 'd'],
      ['p', 'M29 -67Q39 -71 44 -62L52 -48Q54 -40 46 -38.5Q39 -39 35 -46Q29 -56 29 -67Z', '#F7F4EE', ''],
      ['p', 'M31 -67Q39 -70 42.5 -62Q41 -56 35.5 -56Q31 -60 31 -67Z', '#2F2B29', 'd'],
      ['e', 47.5, -43.5, 7.5, 5.6, -0.55, '#F2C2B6', ''], ['c', 50.5, -43.5, 1.3, '#A86A60', 'd'],
      ['c', 39.5, -60.5, 2.2, '#2B2320', 'd'], ['c', 40.2, -61.2, 0.8, '#FFFFFF', 'd'],
    ] };
    A.duck = { len: 0.5, gait: 'waddle', stride: 5, lift: 4, rate: 2.6, parts: [
      ['g', -4, -15, 15, 3.4, 0, 'web', '#FF9A1F', ''], ['g', 7, -15, 15, 3.4, 1, 'web', '#FF9A1F', ''],
      ['p', 'M-28 -36 L-45 -48 L-38 -28 Z', '#FFFFFF', ''],
      ['e', -4, -31, 30, 18, -0.08, '#FFFFFF', ''],
      ['e', -10, -34, 19, 10, 0.12, '#EDE9E0', 'd'], ['q', -24, -33, -14, -28, -2, -30, 1.2, '#DAD4C8', 'd'],
      ['e', 14, -47, 8.5, 14, 0.15, '#FFFFFF', ''],
      ['c', 19, -61, 12, '#FFFFFF', ''],
      ['p', 'M27 -64 Q42 -66 45 -59 Q41 -54.5 27 -56.5 Z', '#FFA51F', ''],
      ['c', 22.5, -65, 2.3, '#2B2320', 'd'], ['c', 23.2, -65.8, 0.8, '#FFFFFF', 'd'], ['c', 21, -57, 3, 'rgba(255, 140, 140, 0.32)', 'd'],
    ] };
    A.rabbit = { len: 0.5, gait: 'hop', hop: 20, rate: 2.6, parts: [
      ['e', -20, -12, 17, 8.5, 0, '#9C7C62', 'k'],
      ['e', -4, -27, 29, 18.5, 0, '#B8977B', ''],
      ['c', -35, -33, 7.5, '#FFFFFF', ''],
      ['e', 17, -6, 7, 4, 0, '#A88A70', 'r'],
      ['e', 16, -66, 5.5, 16.5, -0.42, '#B8977B', ''], ['e', 23, -68, 5, 16, -0.2, '#AE8D72', ''], ['e', 23, -68, 2.2, 10.5, -0.2, '#F1B5AE', 'd'],
      ['e', 27, -44, 14.5, 12.5, 0, '#B8977B', ''],
      ['c', 33, -47, 2.4, '#2B2320', 'd'], ['c', 33.8, -47.8, 0.8, '#FFFFFF', 'd'], ['e', 41, -41, 2.2, 1.8, 0, '#E68F94', 'd'],
    ] };
    A.deer = { len: 0.85, gait: 'walk', stride: 7, lift: 6, rate: 1.6, parts: [
      ['g', -22, -48, 48, 4.4, 1, 'hoof', '#8E5E36', ''], ['g', 14, -48, 48, 4.4, 0, 'hoof', '#8E5E36', ''],
      ['e', -31, -59, 4.2, 5.5, 0.3, '#B5794A', ''],
      ['e', -6, -56, 26, 12.5, -0.05, '#B5794A', ''],
      ['e', -6, -47.5, 19, 5, 0, '#E3C29A', 'd'], ['e', -28, -55, 5, 7.5, 0, '#F4E9D8', 'd'],
      ['p', 'M10 -64Q16 -82 25 -89L33 -85Q26 -71 20 -50Z', '#B5794A', ''],
      ['g', -27, -48, 48, 4.8, 0, 'hoof', '#A56C40', ''], ['g', 10, -48, 48, 4.8, 1, 'hoof', '#A56C40', ''],
      ['q', 27, -92, 21, -100, 22, -110, 2.6, '#7A5A3A', ''], ['l', 22, -103, 14, -109, 2.2, '#7A5A3A', ''], ['l', 21.5, -108, 26, -116, 2, '#7A5A3A', ''], ['l', 24, -97, 31, -102, 2.2, '#7A5A3A', ''],
      ['e', 23, -92, 7, 2.8, -0.5, '#B5794A', ''],
      ['e', 30, -86, 8.5, 6, 0.35, '#B5794A', ''], ['e', 37, -81, 5.5, 4, 0.5, '#9C6438', ''],
      ['c', 40.5, -79.5, 1.6, '#2B2320', 'd'], ['c', 30, -88.5, 1.8, '#2B2320', 'd'],
    ] };
    A.crab = { len: 0.55, gait: 'scuttle', stride: 3, lift: 5, rate: 3.4, parts: [
      ['qg', -18, -16, -32, -30, -40, 0, 3.4, 0, '#C8402F', ''], ['qg', -16, -12, -26, -24, -30, 0, 3.4, 1, '#C8402F', ''], ['qg', -12, -10, -18, -20, -20, 0, 3.4, 0, '#C8402F', ''],
      ['qg', 18, -16, 32, -30, 40, 0, 3.4, 1, '#C8402F', ''], ['qg', 16, -12, 26, -24, 30, 0, 3.4, 0, '#C8402F', ''], ['qg', 12, -10, 18, -20, 20, 0, 3.4, 1, '#C8402F', ''],
      ['q', -18, -26, -30, -30, -32, -40, 5, '#E5523F', ''], ['q', 18, -26, 30, -30, 32, -40, 5, '#E5523F', ''],
      ['e', -34, -47, 9, 7.5, -0.5, '#E5523F', ''], ['e', -25, -55, 6.5, 3.4, -1.0, '#E5523F', ''],
      ['e', 34, -47, 9, 7.5, 0.5, '#E5523F', ''], ['e', 25, -55, 6.5, 3.4, 1.0, '#E5523F', ''],
      ['l', -6, -34, -7, -45, 2.6, '#E5523F', ''], ['l', 6, -34, 7, -45, 2.6, '#E5523F', ''],
      ['e', 0, -22, 27, 15, 0, '#E5523F', ''],
      ['e', -4, -28, 16, 6, -0.1, '#F07E66', 'd'],
      ['c', -7, -47, 3.8, '#FFFFFF', ''], ['c', 7, -47, 3.8, '#FFFFFF', ''], ['c', -7, -47, 1.9, '#1F2230', 'd'], ['c', 7, -47, 1.9, '#1F2230', 'd'],
      ['q', -5, -18, 0, -15, 5, -18, 1.3, '#9A2E22', 'd'],
    ] };
    A.elephant = { len: 1.2, gait: 'walk', stride: 6, lift: 4, rate: 1.1, bob: 1.2, parts: [
      ['g', -26, -36, 36, 12, 1, 'toe', '#7F8996', ''], ['g', 16, -36, 36, 12, 0, 'toe', '#7F8996', ''],
      ['q', -40, -56, -47, -46, -45, -30, 2.2, '#8D97A3', ''], ['e', -45, -28, 2.2, 3.6, 0, '#5E6672', ''],
      ['e', -8, -53, 34, 26, 0, '#98A2AE', ''],
      ['e', -14, -66, 20, 9, -0.15, 'rgba(255, 255, 255, 0.1)', 'd'],
      ['g', -32, -36, 36, 12.5, 0, 'toe', '#909AA6', ''], ['g', 10, -36, 36, 12.5, 1, 'toe', '#909AA6', ''],
      ['c', 28, -62, 17, '#98A2AE', ''],
      ['q', 40, -56, 52, -40, 48, -18, 9, '#98A2AE', ''], ['q', 48, -18, 46.5, -9, 52.5, -9.5, 6.4, '#98A2AE', ''],
      ['q', 37, -47, 45, -43, 48, -49, 3.4, '#FFF8E8', 'd'],
      ['p', 'M22 -77Q7 -79 5 -58Q7 -40 22 -40Q29 -50 27 -62Z', '#8A94A2', ''], ['p', 'M19 -70Q12 -70 11.5 -58Q12.5 -48 19 -47Q22 -52 21.5 -62Z', '#A99BA8', 'd'],
      ['c', 33, -66, 2.1, '#2B2320', 'd'],
    ] };
    A.camel = { len: 0.95, gait: 'pace', stride: 7, lift: 5, rate: 1.3, parts: [
      ['g', -22, -46, 46, 5, 0, 'pad', '#C4914F', ''], ['g', 16, -46, 46, 5, 0, 'pad', '#C4914F', ''],
      ['q', -32, -56, -38, -48, -36, -36, 2.2, '#D6A062', ''],
      ['p', 'M-34 -52Q-36 -66 -20 -68Q-9 -90 7 -71Q22 -66 26 -56Q22 -44 0 -44Q-30 -42 -34 -52Z', '#DDA968', ''],
      ['p', 'M16 -64Q27 -52 36 -58Q41 -64 44 -76L52 -76Q51 -64 45 -54Q37 -43 21 -47Z', '#DDA968', ''],
      ['e', -6, -76, 9, 4, -0.4, 'rgba(255, 255, 255, 0.14)', 'd'],
      ['g', -26, -46, 46, 5.4, 1, 'pad', '#D9A562', ''], ['g', 12, -46, 46, 5.4, 1, 'pad', '#D9A562', ''],
      ['e', 45, -84.5, 2, 3.6, -0.3, '#C88E52', ''],
      ['e', 50, -78.5, 8, 5.5, 0.12, '#DDA968', ''], ['e', 56, -75.5, 4.6, 4.2, 0, '#CF9A5C', ''],
      ['c', 50, -81.5, 1.6, '#2B2320', 'd'], ['q', 54.5, -72.5, 57.5, -72, 59.5, -73.5, 1, '#8A5E36', 'd'],
    ] };
    A.monkey = { len: 0.6, gait: 'walk', stride: 6, lift: 5, rate: 2.4, bob: 2.2, parts: [
      ['g', -16, -28, 28, 5, 1, 'paw', '#6E4A30', ''], ['g', 14, -30, 30, 5, 0, 'paw', '#6E4A30', ''],
      ['q', -24, -38, -48, -50, -38, -66, 3.6, '#8A5A3A', ''], ['q', -38, -66, -30, -73, -32, -62, 3, '#8A5A3A', ''],
      ['e', -4, -38, 22, 11, -0.15, '#8A5A3A', ''],
      ['g', -20, -28, 28, 5.4, 0, 'paw', '#8A5A3A', ''], ['g', 10, -30, 30, 5.4, 1, 'paw', '#8A5A3A', ''],
      ['c', 22, -50, 11, '#8A5A3A', ''],
      ['c', 14.5, -52, 4.6, '#8A5A3A', ''], ['c', 14.5, -52, 2.6, '#E8C29E', 'd'],
      ['e', 27, -48, 8, 7.6, 0, '#F2D2B0', 'd'],
      ['c', 28.5, -51, 1.9, '#2B2320', 'd'], ['c', 32, -51, 1.9, '#2B2320', 'd'], ['q', 27, -45, 30, -43.5, 33, -45, 1.1, '#7A4E34', 'd'],
    ] };
    A.kangaroo = { len: 0.8, gait: 'hop', hop: 26, rate: 1.7, parts: [
      ['p', 'M-12 -24Q-36 -16 -54 -2Q-48 2 -40 -2Q-24 -9 -8 -14Z', '#B9784A', 'k'],
      ['e', -9, -22, 14, 15.5, -0.35, '#C98A55', 'k'],
      ['e', -2, -3.5, 14, 3.6, 0, '#B9784A', 'k'],
      ['e', 0, -46, 12.5, 22.5, 0.2, '#C98A55', ''],
      ['e', 5, -44, 6.5, 15, 0.2, '#EBC8A0', 'd'],
      ['q', 9, -55, 17, -48, 16, -39, 3.8, '#B9784A', 'r'],
      ['e', 4.5, -86, 3, 8, -0.3, '#C98A55', ''], ['e', 9.5, -87, 2.8, 7.5, 0, '#B9784A', ''],
      ['e', 11, -75, 9, 7, 0.25, '#C98A55', ''], ['e', 18.5, -71.5, 6, 4.6, 0.3, '#C98A55', ''],
      ['c', 23.5, -72, 1.6, '#2B2320', 'd'], ['c', 12, -77, 1.8, '#2B2320', 'd'],
    ] };
    A.moose = { len: 1.05, gait: 'walk', stride: 7, lift: 5, rate: 1.2, parts: [
      ['g', -24, -52, 52, 6, 1, 'hoof', '#6E6054', ''], ['g', 16, -54, 54, 6, 0, 'hoof', '#6E6054', ''],
      ['e', -36, -64, 3, 4, 0.3, '#4A3324', ''],
      ['e', -6, -62, 30, 15, 0, '#5C3F2C', ''], ['e', 12, -70, 14, 10, 0, '#5C3F2C', ''],
      ['g', -30, -52, 52, 6.4, 0, 'hoof', '#8B7A6A', ''], ['g', 12, -54, 54, 6.4, 1, 'hoof', '#8B7A6A', ''],
      ['p', 'M14 -76Q26 -83 32 -77L36 -62Q28 -56 18 -58Z', '#5C3F2C', ''],
      ['e', 34, -54, 3, 6, 0.2, '#5C3F2C', ''],
      ['e', 23, -83, 6.5, 2.6, -0.25, '#5C3F2C', ''],
      ['p', 'M28 -86Q15 -90 7 -103L11.5 -105L14 -100L17.5 -108L21 -101L25 -109L27.5 -101L31.5 -106L32 -96Q31.5 -90 30 -86Z', '#D9C49A', ''],
      ['p', 'M32 -88Q38 -97 46 -106L48.5 -100L52.5 -104L52.5 -97L57.5 -98L54 -92L58.5 -89.5L50 -87Q42 -84.5 34 -84.5Z', '#CDB68A', ''],
      ['p', 'M27 -84Q36 -87 44 -77L52.5 -64Q55.5 -57 50.5 -55Q46.5 -54 44.5 -58Q38 -60 32 -68Q27 -74 27 -84Z', '#6A4A34', ''],
      ['p', 'M36 -59Q33.5 -51 37 -47Q40.5 -51 39.5 -59Z', '#5C3F2C', ''],
      ['c', 36, -76, 1.9, '#1F1612', 'd'], ['e', 51, -59, 1.7, 1.1, 0.6, '#2B2320', 'd'],
    ] };
    A.reindeer = { len: 0.95, gait: 'walk', stride: 7, lift: 5, rate: 1.5, parts: [
      ['g', -22, -46, 46, 5, 1, 'hoof', '#6E5D50', ''], ['g', 14, -46, 46, 5, 0, 'hoof', '#6E5D50', ''],
      ['e', -32, -56, 4, 4.5, 0, '#F2ECE2', ''],
      ['e', -6, -54, 27, 13.5, 0, '#8C7462', ''],
      ['e', -6, -45, 20, 5, 0, '#B9A694', 'd'],
      ['p', 'M12 -62Q20 -78 28 -84L36 -78Q30 -66 26 -46Q18 -44 14 -50Z', '#EDE6DA', ''],
      ['g', -27, -46, 46, 5.4, 0, 'hoof', '#7E6A5A', ''], ['g', 10, -46, 46, 5.4, 1, 'hoof', '#7E6A5A', ''],
      ['q', 28, -88, 18, -104, 22, -119, 2.6, '#CDB48E', ''], ['q', 31, -88, 35, -104, 30, -120, 2.6, '#BFA47C', ''],
      ['l', 20.5, -100, 12, -106, 2.2, '#CDB48E', ''], ['l', 21, -110, 14, -116, 2, '#CDB48E', ''], ['l', 33.5, -101, 41, -106, 2.2, '#BFA47C', ''], ['l', 32.5, -111, 38.5, -118, 2, '#BFA47C', ''], ['l', 29.5, -93, 36, -96, 2.4, '#CDB48E', ''],
      ['e', 25, -86, 6, 2.6, -0.5, '#8C7462', ''],
      ['e', 33, -80, 9, 6.5, 0.35, '#8C7462', ''], ['e', 40, -75, 5.5, 4.5, 0.4, '#7A6454', ''],
      ['c', 43, -73.5, 1.7, '#2B2320', 'd'], ['c', 32, -82.5, 1.8, '#2B2320', 'd'],
    ] };
    A.bear = { len: 0.95, gait: 'walk', stride: 6, lift: 4, rate: 1.3, bob: 1.4, parts: [
      ['g', -24, -26, 26, 10, 1, 'paw', '#5E3E28', ''], ['g', 18, -26, 26, 10, 0, 'paw', '#5E3E28', ''],
      ['c', -38, -42, 4, '#6A4630', ''],
      ['e', -4, -38, 34, 20, 0, '#7A5236', ''], ['e', 10, -50, 16, 10, 0, '#7A5236', ''],
      ['e', -10, -50, 18, 6, -0.1, 'rgba(255, 230, 200, 0.1)', 'd'],
      ['g', -30, -26, 26, 10.5, 0, 'paw', '#6E4A30', ''], ['g', 14, -26, 26, 10.5, 1, 'paw', '#6E4A30', ''],
      ['c', 24, -53, 4.6, '#7A5236', ''], ['c', 24, -53, 2.4, '#B98A60', 'd'],
      ['c', 30, -42, 12, '#7A5236', ''],
      ['e', 41, -37, 7, 5.5, 0, '#B98A60', ''], ['c', 47, -39.5, 2.6, '#2B2320', ''],
      ['c', 33, -46, 1.9, '#2B2320', 'd'], ['c', 33.6, -46.6, 0.7, '#FFFFFF', 'd'],
    ] };
    A.duckling = { len: 0.5, gait: 'waddle', stride: 3, lift: 3, rate: 4, parts: [
      ['g', -2, -8, 8, 2.6, 0, 'web', '#FF9A1F', ''], ['g', 5, -8, 8, 2.6, 1, 'web', '#FF9A1F', ''],
      ['p', 'M-14 -21L-21 -27L-15 -13Z', '#FFD84A', ''],
      ['e', -2, -17, 15, 10.5, 0, '#FFD84A', ''],
      ['e', -5, -18, 8, 5, 0.25, '#F2C230', 'd'],
      ['c', 9, -29, 8.5, '#FFD84A', ''],
      ['p', 'M15.5 -31L23.5 -28.5L15.5 -26Z', '#FF9A1F', ''],
      ['c', 11.5, -31.5, 1.6, '#2B2320', 'd'], ['c', 12, -32, 0.55, '#FFFFFF', 'd'],
    ] };
    A.goose = { len: 0.4, gait: 'waddle', stride: 5, lift: 4, rate: 2.2, parts: [
      ['g', -4, -16, 16, 3.6, 0, 'web', '#3A3530', ''], ['g', 8, -16, 16, 3.6, 1, 'web', '#3A3530', ''],
      ['p', 'M-32 -34L-47 -42L-40 -27Z', '#3A3530', ''],
      ['e', -6, -32, 32, 17, -0.08, '#9C8A76', ''],
      ['e', -2, -22, 24, 7, 0, '#E9E2D6', 'd'], ['e', -12, -35, 20, 10, 0.12, '#7E6C5A', 'd'],
      ['q', 17, -40, 22, -60, 24, -77, 8, '#2B2826', ''],
      ['e', 28, -80, 9, 6.5, 0.1, '#2B2826', ''], ['e', 25, -77, 4.5, 3, 0.3, '#FFFFFF', 'd'],
      ['p', 'M35 -82.5L46 -79L35 -76Z', '#2B2826', ''],
      ['c', 29, -82.5, 1.5, '#FFFFFF', 'd'],
    ] };
    A.swan = { len: 0.45, gait: 'waddle', stride: 5, lift: 4, rate: 2, parts: [
      ['g', -4, -14, 14, 3.6, 0, 'web', '#2E2A28', ''], ['g', 8, -14, 14, 3.6, 1, 'web', '#2E2A28', ''],
      ['p', 'M-30 -32L-45 -40L-38 -25Z', '#FFFFFF', ''],
      ['e', -6, -30, 32, 17, -0.1, '#FFFFFF', ''],
      ['p', 'M-31 -32Q-20 -56 7 -47Q-4 -36 -24 -27Z', '#F1EFEA', ''],
      ['q', 16, -38, 31, -54, 19, -68, 7, '#FFFFFF', ''], ['q', 19, -68, 12, -80, 23, -84, 6.4, '#FFFFFF', ''],
      ['e', 26, -84.5, 7, 5, 0.2, '#FFFFFF', ''],
      ['p', 'M31 -87L43 -80.5L30.5 -81Z', '#F08A2B', ''], ['c', 31, -85, 2, '#1F1F24', 'd'],
      ['c', 26, -86.5, 1.5, '#1F1F24', 'd'],
    ] };
    // the outback's bird: long legs, a shaggy body with drooping feathers, a long neck with blue skin
    A.emu = { len: 0.62, gait: 'walk', stride: 9, lift: 7, rate: 1.7, bob: 2.6, parts: [
      ['g', -1, -50, 50, 4.4, 1, 'claw', '#7E6E5E', ''],
      ['e', -4, -58, 25, 18, -0.12, '#5B4A3A', ''],
      ['p', 'M-24 -66Q-40 -60 -35 -42Q-31 -49 -28 -43Q-26 -51 -21 -45Q-19 -53 -13 -47Z', '#4B3C2F', ''],
      ['e', -7, -63, 15, 8, -0.12, '#6E5B48', 'd'], ['e', -16, -54, 8, 4, 0.5, '#4B3C2F', 'd'], ['e', 2, -50, 9, 4, -0.3, '#4B3C2F', 'd'],
      ['g', 8, -50, 50, 4.6, 0, 'claw', '#8A7A6A', ''],
      ['q', 15, -66, 23, -84, 19, -100, 5.5, '#6A5C50', ''],
      ['q', 18.5, -84, 21, -91, 19.5, -97, 3, '#7C9CBC', 'd'],
      ['e', 21, -101, 6.5, 5, 0.1, '#4E443C', ''],
      ['p', 'M26 -102.5L35 -100L26 -97.5Z', '#2E2A26', ''],
      ['c', 22.5, -102.5, 1.8, '#F4E7C8', 'd'], ['c', 23, -102.5, 0.9, '#1F1A17', 'd'],
    ] };
    A.ostrich = { len: 0.66, gait: 'walk', stride: 9, lift: 7, rate: 1.7, bob: 2.6, parts: A.emu.parts.map((q) => {
      const r = q.slice(), c = { '#7E6E5E': '#D49A8C', '#8A7A6A': '#E0A99A', '#5B4A3A': '#2B2725', '#4B3C2F': '#F5F2EA', '#6E5B48': '#3A3431', '#6A5C50': '#D9AFA4', '#7C9CBC': '#E7BFB4', '#4E443C': '#C99086' }[r[r.length - 2]];
      if (c) r[r.length - 2] = c;
      return r;
    }) };
    A.hen = { len: 0.32, gait: 'walk', stride: 5, lift: 5, rate: 2.6, bob: 2.4, parts: [
      ['g', -2, -16, 16, 3.2, 0, 'claw', '#E8A53A', ''], ['g', 8, -16, 16, 3.2, 1, 'claw', '#E8A53A', ''],
      ['p', 'M-22 -38Q-40 -60 -31 -68Q-26 -52 -16 -42Z', '#7E4424', ''],
      ['e', -2, -32, 24, 17, -0.1, '#B5683A', ''],
      ['e', -6, -33, 14, 9, 0.2, '#9A5530', 'd'],
      ['c', 18, -52, 9.5, '#B5683A', ''],
      ['p', 'M11 -59Q13 -69 18 -63Q20 -71 24 -63Q28 -66 26.5 -57Z', '#E5523F', ''],
      ['p', 'M26.5 -54.5L34 -51L26.5 -48Z', '#F2B33A', ''],
      ['e', 25.5, -45, 2.6, 4.2, 0, '#E5523F', ''],
      ['c', 21, -54, 1.7, '#2B2320', 'd'],
    ] };
    return A;
  })();
  const SB_P2DA = {};
  function sbAPath(d) {
    if (!(d in SB_P2DA)) { try { SB_P2DA[d] = new Path2D(d); } catch (e) { SB_P2DA[d] = null; } }
    return SB_P2DA[d];
  }
  // draws an animal with its feet on (x, y), L pixels per 100 units; ph runs 0 to 1
  // through one stride or hop. o: { mono: silhouette colour, flip: facing left, still: standing }
  function sbAnimal(ctx, kind, x, y, L, ph, o) {
    const A = SB_ANIM[kind];
    if (!A) return false;
    o = o || {};
    const mono = o.mono || null, TAU = Math.PI * 2;
    const still = !!(o.still || mono), cyc = still ? 0.25 : ((ph || 0) % 1 + 1) % 1, g = A.gait;
    let by = 0, rot = 0, air = 0, sway = 0;
    if (!still) {
      if (g === 'hop') { air = Math.sin(cyc * Math.PI); by = -air * (A.hop || 18); rot = -0.16 * Math.cos(cyc * Math.PI) * air; }
      else if (g === 'waddle') { rot = Math.sin(cyc * TAU) * 0.07; by = -Math.abs(Math.sin(cyc * TAU)) * 1.4; }
      else if (g === 'scuttle') { sway = Math.sin(cyc * TAU) * 1.6; by = -Math.abs(Math.sin(cyc * TAU * 2)) * 0.8; }
      else by = -Math.abs(Math.sin(cyc * TAU)) * (A.bob || 1.6);
    }
    const k = L / 100;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(o.flip ? -k : k, k);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // where a foot is: on the ground, swinging forward and lifting on the way
    const foot = (fx, grp) => {
      if (still) return [fx + (grp ? -1 : 1) * (A.stride || 6) * 0.55, 0];
      const a = TAU * (cyc + grp * 0.5);
      return [fx + Math.sin(a) * (A.stride || 6), -Math.max(0, Math.cos(a)) * (A.lift || 4)];
    };
    let clips = 0;
    for (const P of A.parts) {
      const t = P[0];
      if (t === 'clip') {
        ctx.save(); clips++;
        ctx.beginPath();
        if (P[1] === 'e') ctx.ellipse(P[2] + sway, P[3] + by, P[4], P[5], P[6], 0, TAU);
        else { ctx.translate(sway, by); const pa = sbAPath(P[2]); if (pa) ctx.clip(pa); ctx.translate(-sway, -by); continue; }
        ctx.clip();
        continue;
      }
      if (t === 'end') { if (clips) { ctx.restore(); clips--; } continue; }
      const c = P[P.length - 2], fl = P[P.length - 1];
      if (mono && fl.indexOf('d') >= 0) continue;
      ctx.fillStyle = mono || c;
      ctx.strokeStyle = ctx.fillStyle;
      // a hop kicks the hind legs back and reaches the front ones forward
      let dx = sway, dy = by;
      if (air && fl.indexOf('k') >= 0) { dx -= 7 * air; dy += 3 * air; }
      if (air && fl.indexOf('r') >= 0) { dx += 5 * air; dy -= 2 * air; }
      if (t === 'g') {
        const [, hx, hy, len, w, grp, ft] = P;
        const [fx, fy] = foot(hx, grp);
        const x0 = hx + sway, y0 = hy + by;
        // the leg's bottom end, so a round cap stands on the ground
        const yb = fy - w / 2;
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(fx, yb); ctx.stroke();
        if (ft === 'hoof' && !mono) {
          const f = Math.min(1, (w * 1.2) / len);
          ctx.strokeStyle = '#3A3431';
          ctx.beginPath(); ctx.moveTo(fx + (x0 - fx) * f, yb + (y0 - yb) * f); ctx.lineTo(fx, yb); ctx.stroke();
        } else if (ft === 'web') {
          ctx.beginPath(); ctx.moveTo(fx - 1.5, fy); ctx.lineTo(fx + 7, fy); ctx.lineTo(fx + 1, fy - 3.5); ctx.closePath(); ctx.fill();
        } else if (ft === 'paw') {
          ctx.beginPath(); ctx.ellipse(fx + w * 0.25, fy - w * 0.32, w * 0.62, w * 0.36, 0, 0, TAU); ctx.fill();
        } else if (ft === 'pad') {
          ctx.beginPath(); ctx.ellipse(fx + 1, fy - 1.6, w * 0.8, 1.8, 0, 0, TAU); ctx.fill();
        } else if (ft === 'claw') {
          ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.moveTo(fx, yb); ctx.lineTo(fx + 6, fy); ctx.moveTo(fx, yb); ctx.lineTo(fx - 3.5, fy); ctx.moveTo(fx, yb); ctx.lineTo(fx + 3, fy); ctx.stroke();
        } else if (ft === 'toe' && !mono) {
          ctx.fillStyle = 'rgba(255, 248, 232, 0.7)';
          for (const q of [-0.28, 0.02, 0.32]) { ctx.beginPath(); ctx.ellipse(fx + q * w, fy - 1.5, w * 0.11, 1.3, 0, 0, TAU); ctx.fill(); }
        }
        continue;
      }
      if (t === 'qg') {
        const [, hx, hy, kx, ky, fx0, fy0, w, grp] = P;
        const [fx, fy] = foot(fx0, grp);
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(hx + sway, hy + by); ctx.quadraticCurveTo(kx + sway + (fx - fx0) * 0.5, ky + by + fy * 0.5, fx, fy - w / 2); ctx.stroke();
        continue;
      }
      if (t === 'e') {
        let r = P[5];
        if (air && fl.indexOf('k') >= 0) r += 0.4 * air;
        ctx.beginPath(); ctx.ellipse(P[1] + dx, P[2] + dy, P[3], P[4], r + rot, 0, TAU); ctx.fill();
      } else if (t === 'c') {
        ctx.beginPath(); ctx.arc(P[1] + dx, P[2] + dy, P[3], 0, TAU); ctx.fill();
      } else if (t === 'p') {
        const pa = sbAPath(P[1]);
        if (pa) { ctx.save(); ctx.translate(dx, dy); if (rot) ctx.rotate(rot); ctx.fill(pa); ctx.restore(); }
      } else if (t === 'l') {
        ctx.lineWidth = P[5];
        ctx.beginPath(); ctx.moveTo(P[1] + dx, P[2] + dy); ctx.lineTo(P[3] + dx, P[4] + dy); ctx.stroke();
      } else if (t === 'q') {
        ctx.lineWidth = P[7];
        ctx.beginPath(); ctx.moveTo(P[1] + dx, P[2] + dy); ctx.quadraticCurveTo(P[3] + dx, P[4] + dy, P[5] + dx, P[6] + dy); ctx.stroke();
      }
    }
    while (clips--) ctx.restore();
    ctx.restore();
    return true;
  }
  // the box around an animal's silhouette, in its units; measured once from a drawing
  const SB_ABOX = {};
  function sbAnimBox(kind) {
    if (SB_ABOX[kind]) return SB_ABOX[kind];
    let box = [-50, -100, 50, 0];
    try {
      const c = document.createElement('canvas');
      c.width = 280; c.height = 220;
      const g = c.getContext('2d');
      sbAnimal(g, kind, 140, 170, 100, 0, { mono: '#000000' });
      const d = g.getImageData(0, 0, 280, 220).data;
      let x0 = 280, y0 = 220, x1 = -1, y1 = -1;
      for (let yy = 0; yy < 220; yy++) for (let xx = 0; xx < 280; xx++) {
        if (d[(yy * 280 + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
      }
      if (x1 > x0) box = [x0 - 140, y0 - 170, x1 + 1 - 140, y1 + 1 - 170];
    } catch (e) { /* keep the default */ }
    return (SB_ABOX[kind] = box);
  }
  // an animal's silhouette fitted into a size x size box centred on (x, y)
  function sbAnimGlyph(ctx, kind, x, y, size, color) {
    const b = sbAnimBox(kind), w = b[2] - b[0], hgt = b[3] - b[1];
    const L = (100 * size) / Math.max(w, hgt * 1.04);
    const k = L / 100;
    sbAnimal(ctx, kind, x - ((b[0] + b[2]) / 2) * k, y - ((b[1] + b[3]) / 2) * k, L, 0, { mono: color });
  }
  // ---- things to collect, one kind for each place, drawn once at 96 px and scaled
  const SB_ITEM_ART = {
    apple(g) {
      g.fillStyle = '#E8463D';
      g.beginPath(); g.moveTo(0, -24); g.bezierCurveTo(16, -36, 36, -24, 36, -2); g.bezierCurveTo(36, 22, 18, 38, 0, 33); g.bezierCurveTo(-18, 38, -36, 22, -36, -2); g.bezierCurveTo(-36, -24, -16, -36, 0, -24); g.fill();
      g.fillStyle = '#C8302A';
      g.beginPath(); g.moveTo(8, 30); g.bezierCurveTo(26, 26, 34, 10, 33, -6); g.bezierCurveTo(30, 14, 20, 26, 8, 30); g.fill();
      g.strokeStyle = 'rgba(255, 255, 255, 0.6)'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-22, -10); g.quadraticCurveTo(-20, -20, -10, -22); g.stroke();
      g.strokeStyle = '#6B4423'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(0, -24); g.quadraticCurveTo(2, -36, 8, -41); g.stroke();
      g.fillStyle = '#3FA34D';
      g.beginPath(); g.moveTo(6, -34); g.quadraticCurveTo(22, -46, 32, -34); g.quadraticCurveTo(18, -26, 6, -34); g.fill();
    },
    melon(g) {
      g.fillStyle = '#3E9A4E';
      g.beginPath(); g.moveTo(-38, -12); g.arc(0, -12, 38, 0, Math.PI, false); g.closePath(); g.fill();
      g.fillStyle = '#F4F1DC';
      g.beginPath(); g.moveTo(-33, -12); g.arc(0, -12, 33, 0, Math.PI, false); g.closePath(); g.fill();
      g.fillStyle = '#F2545B';
      g.beginPath(); g.moveTo(-30, -12); g.arc(0, -12, 30, 0, Math.PI, false); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255, 255, 255, 0.35)';
      g.beginPath(); g.ellipse(-12, -6, 9, 3.5, 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2B2320';
      for (const [x, y] of [[-16, 0], [0, 4], [16, 0], [-8, 10], [8, 10]]) { g.beginPath(); g.ellipse(x, y, 2.4, 3.6, x * 0.03, 0, Math.PI * 2); g.fill(); }
    },
    carrot(g) {
      g.save(); g.rotate(-0.55);
      g.fillStyle = '#FF8A2B';
      g.beginPath(); g.moveTo(-13, -22); g.quadraticCurveTo(0, -30, 13, -22); g.lineTo(3, 36); g.quadraticCurveTo(0, 40, -3, 36); g.closePath(); g.fill();
      g.fillStyle = '#E86F18';
      g.beginPath(); g.moveTo(6, -24); g.quadraticCurveTo(13, -22, 13, -22); g.lineTo(3, 36); g.quadraticCurveTo(6, 6, 6, -24); g.fill();
      g.strokeStyle = '#D9620E'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-9, -8); g.lineTo(-2, -8); g.moveTo(-6, 6); g.lineTo(1, 6); g.moveTo(-4, 20); g.lineTo(1, 20); g.stroke();
      g.fillStyle = '#3FA34D';
      g.beginPath(); g.moveTo(0, -24); g.quadraticCurveTo(-16, -44, -8, -50); g.quadraticCurveTo(-2, -38, 0, -24); g.fill();
      g.beginPath(); g.moveTo(0, -24); g.quadraticCurveTo(2, -50, 12, -48); g.quadraticCurveTo(8, -34, 0, -24); g.fill();
      g.fillStyle = '#2F8A3E';
      g.beginPath(); g.moveTo(0, -24); g.quadraticCurveTo(18, -40, 22, -32); g.quadraticCurveTo(10, -24, 0, -24); g.fill();
      g.restore();
    },
    drop(g) {
      const gr = g.createLinearGradient(-20, -30, 20, 34);
      gr.addColorStop(0, '#8FDBFF'); gr.addColorStop(1, '#2F8BEA');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, -40); g.bezierCurveTo(10, -22, 30, -2, 30, 14); g.bezierCurveTo(30, 32, 16, 40, 0, 40); g.bezierCurveTo(-16, 40, -30, 32, -30, 14); g.bezierCurveTo(-30, -2, -10, -22, 0, -40); g.fill();
      g.strokeStyle = 'rgba(255, 255, 255, 0.75)'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-17, 12); g.quadraticCurveTo(-17, 26, -6, 30); g.stroke();
      g.fillStyle = 'rgba(255, 255, 255, 0.9)';
      g.beginPath(); g.arc(-6, -6, 4, 0, Math.PI * 2); g.fill();
    },
    acorn(g) {
      g.fillStyle = '#C98A3E';
      g.beginPath(); g.ellipse(0, 10, 22, 28, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#E3A75A';
      g.beginPath(); g.ellipse(-8, 8, 7, 16, 0.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8A5A30';
      g.beginPath(); g.ellipse(0, 36, 3.5, 3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7A4E2A';
      g.beginPath(); g.moveTo(-28, -6); g.quadraticCurveTo(-30, -30, 0, -32); g.quadraticCurveTo(30, -30, 28, -6); g.quadraticCurveTo(0, 2, -28, -6); g.fill();
      g.strokeStyle = '#5E3A1E'; g.lineWidth = 2.4;
      g.beginPath();
      for (let k = -2; k <= 2; k++) { g.moveTo(k * 10 - 5, -26 + Math.abs(k) * 3); g.lineTo(k * 10 + 5, -8 + Math.abs(k)); }
      g.stroke();
      g.strokeStyle = '#5E3A1E'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, -32); g.quadraticCurveTo(2, -42, 8, -44); g.stroke();
    },
    banana(g) {
      g.fillStyle = '#FFD23F';
      g.beginPath(); g.moveTo(-34, -20); g.quadraticCurveTo(-30, 30, 30, 22); g.quadraticCurveTo(38, 20, 36, 14); g.quadraticCurveTo(-12, 18, -22, -24); g.closePath(); g.fill();
      g.fillStyle = '#F2B91F';
      g.beginPath(); g.moveTo(-28, -10); g.quadraticCurveTo(-22, 22, 30, 22); g.quadraticCurveTo(-14, 30, -32, -14); g.closePath(); g.fill();
      g.fillStyle = '#6B4423';
      g.beginPath(); g.moveTo(-36, -22); g.lineTo(-32, -32); g.lineTo(-22, -28); g.lineTo(-24, -20); g.closePath(); g.fill();
      g.beginPath(); g.arc(36, 18, 3.4, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255, 255, 255, 0.55)'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-20, -8); g.quadraticCurveTo(-14, 12, 4, 14); g.stroke();
    },
    starfish(g) {
      g.fillStyle = '#FF8A4C';
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 15 : 40;
        const x = Math.cos(a) * r, y = Math.sin(a) * r + 4;
        if (k) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.closePath(); g.lineJoin = 'round'; g.strokeStyle = '#FF8A4C'; g.lineWidth = 9; g.stroke(); g.fill();
      g.fillStyle = '#FFC48C';
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
        for (const r of [12, 22]) { g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r + 4, 3, 0, Math.PI * 2); g.fill(); }
      }
      g.beginPath(); g.arc(0, 4, 4, 0, Math.PI * 2); g.fill();
    },
    opal(g) {
      g.save();
      g.beginPath(); g.ellipse(0, 0, 30, 38, 0, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#3FA7D6'; g.fillRect(-40, -40, 80, 80);
      for (const [x, y, r, c] of [[-14, -18, 20, '#A56BFF'], [16, -10, 18, '#FF6FB4'], [-8, 16, 20, '#3FD98E'], [16, 22, 16, '#FFD23F'], [2, -30, 14, '#6FB8FF'], [-18, 2, 12, '#FF8A4C']]) {
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, c); gr.addColorStop(0.55, c); gr.addColorStop(1, 'rgba(63, 167, 214, 0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      g.restore();
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 3.5;
      g.beginPath(); g.ellipse(0, 0, 30, 38, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255, 255, 255, 0.85)';
      g.beginPath(); g.ellipse(-11, -17, 6, 10, 0.5, 0, Math.PI * 2); g.fill();
    },
    cherry(g) {
      g.strokeStyle = '#5E7F2A'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-14, 8); g.quadraticCurveTo(-8, -20, 6, -36); g.moveTo(16, 12); g.quadraticCurveTo(12, -14, 6, -36); g.stroke();
      g.fillStyle = '#4FA83E';
      g.beginPath(); g.moveTo(6, -36); g.quadraticCurveTo(22, -46, 32, -36); g.quadraticCurveTo(18, -28, 6, -36); g.fill();
      for (const [x, y] of [[-15, 18], [16, 22]]) {
        g.fillStyle = '#D92B3A'; g.beginPath(); g.arc(x, y, 17, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#B01E2C'; g.beginPath(); g.arc(x + 4, y + 4, 12, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#D92B3A'; g.beginPath(); g.arc(x - 1, y - 1, 12, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255, 255, 255, 0.7)'; g.beginPath(); g.ellipse(x - 7, y - 7, 4, 2.6, -0.6, 0, Math.PI * 2); g.fill();
      }
    },
    flake(g) {
      g.strokeStyle = '#FFFFFF'; g.lineCap = 'round';
      for (const [w, c] of [[11, 'rgba(150, 200, 255, 0.55)'], [6, '#FFFFFF']]) {
        g.strokeStyle = c; g.lineWidth = w;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3, ca = Math.cos(a), sa = Math.sin(a);
          g.moveTo(0, 0); g.lineTo(ca * 36, sa * 36);
          for (const [d, b] of [[18, 11], [28, 8]]) {
            const bx = ca * d, by = sa * d;
            g.moveTo(bx, by); g.lineTo(bx + Math.cos(a + 0.8) * b, by + Math.sin(a + 0.8) * b);
            g.moveTo(bx, by); g.lineTo(bx + Math.cos(a - 0.8) * b, by + Math.sin(a - 0.8) * b);
          }
        }
        g.stroke();
      }
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill();
    },
  };
  const SB_ITEMS = {};
  // a thing to collect, 96 px square, on a soft light so it reads on the road
  function sbItem(kind) {
    if (SB_ITEMS[kind]) return SB_ITEMS[kind];
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    if (g && SB_ITEM_ART[kind]) {
      const gr = g.createRadialGradient(48, 48, 10, 48, 48, 48), lt = kind === 'flake' ? '140, 190, 255' : '255, 255, 240';
      gr.addColorStop(0, 'rgba(' + lt + ', 0.75)'); gr.addColorStop(0.62, 'rgba(' + lt + ', 0.4)'); gr.addColorStop(1, 'rgba(' + lt + ', 0)');
      g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
      g.translate(48, 48); g.scale(0.82, 0.82);
      SB_ITEM_ART[kind](g);
    }
    return (SB_ITEMS[kind] = c);
  }
  function sbWheelSvg() {
    return s('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' },
      s('circle', { cx: 50, cy: 50, r: 41, fill: 'rgba(255,255,255,.16)', stroke: '#2B2F3A', 'stroke-width': 11 }),
      s('path', { d: 'M11 47Q50 39 89 47', stroke: '#2B2F3A', 'stroke-width': 10, fill: 'none', 'stroke-linecap': 'round' }),
      s('path', { d: 'M50 56V89', stroke: '#2B2F3A', 'stroke-width': 10, 'stroke-linecap': 'round' }),
      s('circle', { cx: 50, cy: 51, r: 13, fill: '#3A3F4C' }),
      s('circle', { cx: 50, cy: 51, r: 5, fill: '#E5564D' }),
      s('rect', { x: 45.5, y: 5, width: 9, height: 10, rx: 2.5, fill: '#FFC93C' }));
  }

  class SwitchbackCard extends Card {
    freshRun(p) { return this.G.newRun(p, this.app.switchbackStart(this.spec)); }
    usesClock() { return false; }
    potentialStars() { return 3; }
    refresh() {}
    buildBoard() {
      const p = this.p, ex = this.extra || {};
      this.tt = ex.tt || 0;          // seconds of driving
      this.endW = ex.endW != null ? ex.endW : null;   // where the landmark stands, once the end is in reach
      this.pos = ex.pos || 0;        // distance along the road (world units)
      this.phase = this.summary ? 'done' : this.tt > 0 ? 'paused' : 'ready';
      this.kmh = 0; this.carX = 0; this.tilt = 0; this.steer = 0; this.keySteer = 0; this.ptr = null; this.ptrSteer = 0;
      this.bgX = 0; this.sign = null; this.spdT = 0; this.spdOn = 0; this.wasOn = true; this.W = 0; this.H = 0;
      this.salt = Math.imul((p.seed | 0) + 7, 2654435761) | 0;
      this.place = SB_PLACES[p.place] || SB_PLACES.farm;
      this.puffs = []; this.critter = null;
      // the animal on the road, braking for it, the things collected on their way to the counter
      this.beast = null; this.brakeTo = 0; this.braked = false; this.itemK = this.run.items.length; this.flyers = []; this.streak = 0; this.streakAt = 0;
      this.got = this.run.items.filter((x) => x).length; this.gotAt = -1e9;
      // a fork in the road (level 3 on), the new animal from halfway (level 4 on), the first
      // time something new comes up (demo), the car waiting for the player during one (hold)
      this.fork = null; this.turned = !!(p.turn && this.tt >= p.turn.t); this.demo = null; this.hold = false;
      this.wrap = h('div', { class: 'sb-wrap' });
      this.canvas = h('canvas', { class: 'sb-canvas', 'aria-hidden': 'true' });
      this.goBtn = h('button', { class: 'sb-go', type: 'button', 'aria-label': this.phase === 'paused' ? 'Drive on' : 'Drive' }, icon('play'));
      this.goBtn.addEventListener('click', () => this.begin());
      this.wheelEl = h('div', { class: 'sb-wheel', 'aria-hidden': 'true' }, sbWheelSvg());
      this.btnCanvas = h('canvas', { 'aria-hidden': 'true' });
      this.signBtn = h('button', { class: 'sb-btn cue', type: 'button', 'aria-label': 'Tap when this sign shows: ' + this.target() + ' crossing' }, this.btnCanvas);
      this.signBtn.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); e.stopPropagation(); this.respond(e, 'button'); });
      this.signBtn.addEventListener('click', (e) => { if (e.detail === 0) this.respond(e, 'key'); });
      // what counts, on screen for the whole drive: this place's sign and one dot per
      // target sign, green when caught and red when missed (speed alone said "drive fast")
      this.tallyCanvas = h('canvas', { 'aria-hidden': 'true' });
      this.tallyDots = h('span', { class: 'sb-tally-dots' });
      this.tallyEl = h('span', { class: 'sb-tally', role: 'img' }, this.tallyCanvas, this.tallyDots);
      this.goalEl.after(this.tallyEl);
      // where the guiding hand points on the road: the sign, or the animal
      this.anchor = h('i', { class: 'sb-anchor', 'aria-hidden': 'true' });
      this.wrap.append(this.canvas, this.anchor, this.wheelEl, this.signBtn, this.goBtn);
      this.wrap.addEventListener('pointerdown', (e) => this.steerDown(e));
      this.wrap.addEventListener('pointermove', (e) => this.steerMove(e));
      const up = (e) => { if (e.pointerId === this.ptr) { this.ptr = null; this.ptrSteer = 0; } };
      this.wrap.addEventListener('pointerup', up);
      this.wrap.addEventListener('pointercancel', up);
      this.onKeyUp = (e) => {
        if ((e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') && this.keySteer < 0) this.keySteer = 0;
        if ((e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') && this.keySteer > 0) this.keySteer = 0;
      };
      document.addEventListener('keyup', this.onKeyUp);
      if (this.phase === 'done') { this.goBtn.hidden = true; this.signBtn.classList.remove('cue'); }
      this.area.classList.add('sb-area');
      this.area.append(this.wrap);
      if (typeof ResizeObserver !== 'undefined') {
        this.ro = new ResizeObserver(() => this.layout());
        this.ro.observe(this.wrap);
      } else {
        this.onWinResize = () => this.layout();
        window.addEventListener('resize', this.onWinResize);
      }
      this.later(() => this.layout(), 0);
    }
    destroy() {
      super.destroy();
      caf(this.rafId);
      this.rafId = null;
      if (this.phase === 'drive' || this.phase === 'finish') Sound.engine(0);
      if (this.ro) this.ro.disconnect();
      if (this.onWinResize) window.removeEventListener('resize', this.onWinResize);
      document.removeEventListener('keyup', this.onKeyUp);
    }
    layout() {
      const r = this.wrap.getBoundingClientRect();
      const W = Math.round(r.width), H = Math.round(r.height);
      if (W < 60 || H < 60 || (W === this.W && H === this.H)) return;
      this.W = W; this.H = H;
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(W * this.dpr);
      this.canvas.height = Math.round(H * this.dpr);
      this.ctx = this.canvas.getContext('2d');
      const hy = Math.round(H * SB_HORIZON), PL = this.place, cx = this.ctx;
      const g = cx.createLinearGradient(0, 0, 0, hy);
      g.addColorStop(0, PL.sky[0]); g.addColorStop(0.6, PL.sky[1]); g.addColorStop(1, PL.sky[2]);
      this.skyGrad = g;
      const hz = cx.createLinearGradient(0, hy - H * 0.05, 0, hy + H * 0.17);
      hz.addColorStop(0, 'rgba(' + PL.haze + ', 0)'); hz.addColorStop(0.24, 'rgba(' + PL.haze + ', 0.42)'); hz.addColorStop(1, 'rgba(' + PL.haze + ', 0)');
      this.hazeGrad = hz;
      if (PL.far === 'sea') {
        const sg = cx.createLinearGradient(0, hy - H * 0.03, 0, hy);
        sg.addColorStop(0, '#7F82C0'); sg.addColorStop(1, '#D59DB0');
        this.seaGrad = sg;
      }
      this.stars = PL.stars ? Array.from({ length: PL.stars }, (_, i) => {
        const q = sbHash(i * 97 + 13);
        return [((q % 1000) / 1000) * W, (((q >>> 10) % 1000) / 1000) * hy * 0.62, 1 + ((q >>> 20) % 2), 0.8 + ((q >>> 22) % 100) / 50, (q % 628) / 100];
      }) : null;
      this.steerRange = Math.max(56, Math.min(110, W * 0.2));
      this.plateP = Math.max(60, Math.min(92, W * 0.2));
      this.paintPlates();
      this.draw(now());
    }
    // the animal whose sign counts: from halfway on levels 4 and 5, the new one
    target() { return this.turned ? this.p.turn.to : this.p.target; }
    // that animal's sign on the button and on the tally
    paintPlates() {
      const b = this.signBtn.clientWidth || 84, k = this.dpr || 1, tg = this.target();
      this.btnCanvas.width = Math.round(b * 0.72 * k);
      this.btnCanvas.height = Math.round(b * 0.72 * k);
      const bc = this.btnCanvas.getContext('2d');
      if (bc) {
        bc.setTransform(k, 0, 0, k, 0, 0);
        bc.clearRect(0, 0, b, b);
        sbPlate(bc, 'tri', tg, b * 0.36, b * 0.37, b * 0.62);
      }
      const ts = 26, tc = this.tallyCanvas.getContext('2d');
      this.tallyCanvas.width = Math.round(ts * k);
      this.tallyCanvas.height = Math.round(ts * k);
      if (tc) { tc.setTransform(k, 0, 0, k, 0, 0); tc.clearRect(0, 0, ts, ts); sbPlate(tc, 'tri', tg, ts / 2, ts * 0.53, ts * 0.9); }
      this.signBtn.setAttribute('aria-label', 'Tap when this sign shows: ' + tg + ' crossing');
    }
    // the first time a player meets something new on the road, it comes with a short demo
    isNew(kind) { return !this.practice && !(store.get('pr1.sbnew', {}) || {})[kind]; }
    learned(kind) {
      const s = store.get('pr1.sbnew', {}) || {};
      if (!s[kind]) { s[kind] = 1; store.set('pr1.sbnew', s); }
    }
    // halfway on levels 4 and 5: a card shows the new animal's sign, and the button changes to it
    turnNow(ts) {
      const p = this.p, from = p.target, to = p.turn.to;
      this.turned = true;
      this.paintPlates();
      this.tally();
      this.log('turn', { move_no: this.run.i, target: to, detail: 'from ' + from });
      Sound.play('hint');
      buzz([12, 60, 12]);
      this.signBtn.classList.remove('press', 'ok', 'bad');
      void this.signBtn.offsetWidth;
      this.signBtn.classList.add('swap');
      this.later(() => this.signBtn.classList.remove('swap'), 1400);
      const big = h('canvas', { 'aria-hidden': 'true' }), small = h('canvas', { 'aria-hidden': 'true' });
      const k = this.dpr || 1;
      for (const [c, sz, g] of [[big, 58, to], [small, 26, from]]) {
        c.width = c.height = Math.round(sz * k);
        c.style.width = c.style.height = sz + 'px';
        const x = c.getContext('2d');
        if (x) { x.setTransform(k, 0, 0, k, 0, 0); sbPlate(x, 'tri', g, sz / 2, sz * 0.53, sz * 0.9); }
      }
      if (this.newCard) this.newCard.remove();
      const card = this.newCard = h('div', { class: 'sb-new', role: 'status' },
        big, h('div', { class: 'sb-new-txt' },
          h('b', { text: 'Now tap the ' + to }),
          h('span', { class: 'sb-new-old' }, h('span', { class: 'sb-new-x' }, small, icon('x')), h('span', { text: 'not the ' + from }))));
      this.wrap.append(card);
      this.later(() => { card.classList.add('out'); this.later(() => card.remove(), 320); }, reducedMotion() ? 3200 : 2900);
    }
    // ---- input
    steerDown(e) {
      if (e.button > 0 || this.summary) return;
      if (e.target.closest && e.target.closest('button')) return;
      e.preventDefault();
      Sound.unlock();
      // a tap on the sign answers it, a tap on the animal sends it off; either way the
      // finger can go on to steer
      if (this.phase === 'drive') {
        const r = this.wrap.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        const S = this.sign, xy = this.signXY, B = this.beast, bb = this.beastBox;
        if (S && !S.res && xy && Math.hypot(x - xy[0], y - xy[1]) <= Math.max(44, this.plateP * 0.66)) this.respond(e, 'sign');
        else if (B && !B.res && bb && x >= bb[0] - 16 && x <= bb[2] + 16 && y >= bb[1] - 16 && y <= bb[3] + 16) this.shoo(e, 'tap');
      }
      if (this.ptr != null) return;
      this.ptr = e.pointerId;
      this.ptrX = e.clientX;
      this.ptrSteer = 0;
      try { this.wrap.setPointerCapture(e.pointerId); } catch (x) { /* optional */ }
    }
    steerMove(e) {
      if (e.pointerId !== this.ptr) return;
      this.ptrSteer = Math.max(-1, Math.min(1, (e.clientX - this.ptrX) / this.steerRange));
      if (!this.steered && Math.abs(this.ptrSteer) > 0.2 && this.phase === 'drive') { this.steered = true; this.guide(); }
    }
    // source: button, sign (a tap on the sign itself) or key
    respond(e, source) {
      if (this.summary || this.phase !== 'drive') return;
      Sound.unlock();
      const t = now(), ts = e && e.timeStamp > 0 && e.timeStamp <= t + 1 && e.timeStamp > t - 1000 ? e.timeStamp : t;
      if (source !== 'sign') {
        this.signBtn.classList.remove('press');
        void this.signBtn.offsetWidth;
        this.signBtn.classList.add('press');
        this.later(() => this.signBtn.classList.remove('press'), 140);
      }
      const S = this.sign;
      if (S && !S.res && ts >= S.on - 1 && ts - S.on <= S.ms + SB_GRACE) { this.score(S, true, Math.max(0, ts - S.on), t, source); return; }
      this.run.stray++;
      this.log('stray', { move_no: this.run.i, source, detail: S && S.res ? 'after ' + S.res : '' });
      if (this.o.feedback || this.practice) { Sound.play('no'); this.btnFlash('bad'); }
      this.app.touch();
    }
    btnFlash(k) {
      this.signBtn.classList.remove('ok', 'bad');
      void this.signBtn.offsetWidth;
      this.signBtn.classList.add(k);
      clearTimeout(this.btnTimer);
      this.btnTimer = this.later(() => this.signBtn.classList.remove('ok', 'bad'), 420);
    }
    // a tap on the animal (or H): a toot, and it hurries off the road
    shoo(e, source) {
      const B = this.beast;
      if (this.summary || this.phase !== 'drive' || !B || B.res) return;
      const t = now(), ts = e && e.timeStamp > 0 && e.timeStamp <= t + 1 && e.timeStamp > t - 1000 ? e.timeStamp : t;
      B.res = 'shooed';
      B.state = 'off';
      B.off = t;
      const demo = this.demo === 'animals';
      const rec = this.G.beast(this.p, this.run, { shooed: true, rt: Math.max(0, ts - B.t0) });
      this.log('beast', { move_no: this.run.i, target: B.kind, cls: rec.cls, rt_ms: rec.rt, speed_kmh: Math.round(this.kmh), source, detail: (B.side < 0 ? 'from left' : 'from right') + (demo ? ', first time: the car stopped for it' : '') });
      Sound.play('toot');
      buzz(8);
      if (demo) { this.endDemo(); this.learned('animals'); }
      if (this.practice) this.later(() => this.guide(), 250);
      this.app.touch();
    }
    // the first animal on the road ever: the car has stopped short of it, and a hand and
    // a word show what to do; the drive waits for the tap
    waitFor() {
      const B = this.beast;
      this.hold = true;
      if (!B || !this.beastXY || !this.beastBox) return;
      this.demoSay = this.say(this.mark([this.beastXY[0], this.beastBox[1] - 6]), 'Tap the ' + B.kind + ' to shoo it', '', 60000);
      this.pointAt(this.mark(this.beastXY), 60000);
    }
    endDemo() {
      this.demo = null;
      this.hold = false;
      if (this.demoSay) { this.demoSay.remove(); this.demoSay = null; }
      clearTimeout(this.handTimer);
      this.hideHand();
    }
    // ---- driving
    begin() {
      if (this.summary || (this.phase !== 'ready' && this.phase !== 'paused')) return;
      Sound.unlock();
      Sound.play('go');
      if (this.firstMove == null) this.firstMove = Math.round(this.elapsed());
      this.log('drive', { detail: this.phase === 'paused' ? 'resume' : 'start' });
      this.phase = 'drive';
      this.app.session.hasMoves = true;
      this.goBtn.classList.add('away');
      this.goBtn.disabled = true;
      this.signBtn.classList.remove('cue');
      this.hideHand();
      this.lastTs = null;
      caf(this.rafId);
      this.rafId = raf((ts) => this.loop(ts));
      this.later(() => this.guide(), 700);
    }
    pause(reason) {
      if (this.phase !== 'drive') return;
      caf(this.rafId);
      this.rafId = null;
      const S = this.sign;
      if (S && !S.res) {
        // the sign on screen does not count
        this.log('interrupted', { move_no: S.k + 1, detail: 'sign, ' + reason });
        this.run.i = S.k + 1;
        this.run.voided = (this.run.voided || 0) + 1;
      }
      this.sign = null;
      const B = this.beast;
      if (B && !B.res) {
        // nor does the animal on the road
        this.log('interrupted', { move_no: this.run.i, detail: 'animal, ' + reason });
        this.run.bi = B.k + 1;
      }
      this.beast = null; this.brakeTo = 0;
      if (this.demo === 'animals') this.endDemo();
      this.ptr = null; this.ptrSteer = 0; this.keySteer = 0;
      this.kmh = 0;
      this.phase = 'paused';
      Sound.engine(0);
      this.goBtn.disabled = false;
      this.goBtn.classList.remove('away');
      this.goBtn.setAttribute('aria-label', 'Drive on');
      this.draw(now());
      this.app.touch();
    }
    onHidden() { this.pause('page hidden'); }
    abort(reason) { this.pause(reason); }
    loop(ts) {
      this.rafId = null;
      if (this.phase !== 'drive' && this.phase !== 'finish') return;
      if (this.lastTs == null) this.lastTs = ts;
      const dt = Math.min(0.05, Math.max(0, (ts - this.lastTs) / 1000));
      this.lastTs = ts;
      this.step(dt, ts);
      if (this.phase === 'done') return;
      if (ts - (this.engAt || 0) > 140) { this.engAt = ts; Sound.engine(this.kmh > 2 ? this.kmh : 0); }
      this.draw(ts);
      if (this.practice && ts - (this.guideAt || 0) > 180) { this.guideAt = ts; this.guide(); }
      if (this.phase === 'drive' || this.phase === 'finish') this.rafId = raf((t) => this.loop(t));
    }
    step(dt, ts) {
      const p = this.p, run = this.run, G = this.G, D = run.drive;
      const driving = this.phase === 'drive';
      // while the car waits for the player in a demo, the drive's clock stands still
      if (!this.hold) this.tt += dt;
      // where the car is: on the road, in one of a fork's lanes, or on the grass
      const ln = this.fork ? this.lanes(this.pos + SB_CAR_Z) : null, h0 = p.half;
      const inLane = (c, hw, m) => Math.abs(this.carX - c) + m <= hw;
      const onGrass = !ln ? Math.abs(this.carX) > h0 : ln.one ? !inLane(0, ln.R, 0) : !inLane(ln.m, h0, 0) && !inLane(ln.b, h0, 0);
      // an animal on the road: the car eases off until it is gone, and brakes if it gets close;
      // the first time ever it stops short of it and waits for a tap
      const hard = ts < this.brakeTo, held = !!(this.beast && !this.beast.res);
      const wait = held && this.demo === 'animals' && this.beast.w - this.pos <= SB_STOP + 1.3;
      // the first fork ever: slower, so there is time to follow the arrow
      const slow = this.fork && this.fork.demo && !this.fork.res ? 0.62 : 1;
      const want = driving ? (wait ? 0 : hard ? 4 : run.kmh * (onGrass ? 0.8 : 1) * (held ? SB_EASE : 1) * slow) : 0;
      const before = this.kmh;
      this.kmh += (want - this.kmh) * Math.min(1, dt * (hard || wait ? 7 : held ? 3 : driving ? (this.kmh < want ? 1.3 : 2.2) : 2.6));
      if ((!driving || wait) && this.kmh < 1.5) this.kmh = 0;
      if (wait && this.kmh === 0 && !this.hold) this.waitFor(ts);
      this.braking = this.kmh < before - 0.4 * dt * 60;
      // the speed measure leaves out the time from an animal stepping out until the car is nearly back to speed
      if (this.braked && !hard && !held && this.kmh >= run.kmh * 0.9) this.braked = false;
      // over the finish line at speed, then braking evenly to a stop a few lengths past it
      if (this.phase === 'finish') {
        const r = this.stopW - this.pos - SB_CAR_Z;
        this.kmh = r > 0.02 ? this.brakeKmh * Math.sqrt(r / this.brakeD) : 0;
        this.braking = this.kmh > 0;
      }
      const v = this.kmh * G.kmhToUnits;
      this.pos += v * dt;
      // steering: the wheel sets how fast the car moves sideways; a bend pushes it
      // outward, more the faster it goes, so holding a bend takes steady steering
      const tgt = this.ptr != null ? this.ptrSteer : this.keySteer * 0.6;
      this.steer += (tgt - this.steer) * Math.min(1, dt * 16);
      const c = p.road[Math.floor((this.pos + SB_CAR_Z) / G.seg)] || 0, vr = v / 6;
      let side = this.steer * SB_STEER * vr - c * SB_DRIFT * vr * vr;
      const lo = (ln ? ln.L : -h0) - 0.55, hi = (ln ? ln.R : h0) + 0.55;
      const back = this.fork && this.fork.back && this.fork.back.x0 != null ? this.fork.back : null;
      if (back) {
        // after the wrong lane, the car is put back into the right one
        const f = Math.max(0, Math.min(1, (ts - back.t0) / back.ms)), e = f * f * (3 - 2 * f);
        const to = this.lanes(this.pos + SB_CAR_Z), x1 = to && !to.one ? to.m : 0, nx = back.x0 + (x1 - back.x0) * e;
        side = (nx - this.carX) / Math.max(dt, 0.001);
        this.carX = nx;
        if (f >= 1) { this.fork.back = null; this.backing = false; }
      } else this.carX = Math.max(lo, Math.min(hi, this.carX + side * dt));
      const lean = Math.max(-0.09, Math.min(0.09, side * 0.22));
      this.tilt += (lean - this.tilt) * Math.min(1, dt * 10);
      this.bgX += c * v * dt * 26;
      // the road and the speed count once the car is going
      const on = !ln ? inLane(0, h0, SB_CAR / 2) : ln.one ? inLane(0, ln.R, SB_CAR / 2) : inLane(ln.m, h0, SB_CAR / 2) || inLane(ln.b, h0, SB_CAR / 2);
      if (driving && !this.hold && this.tt > G.warm) {
        D.t += dt;
        if (this.braked) D.brake += dt;
        else { D.vt += this.kmh * dt; D.vs += dt; }
        if (on) D.on += dt;
        if (!on && this.wasOn) { D.off++; this.log('off_road', { move_no: run.i, speed_kmh: Math.round(this.kmh), detail: this.carX < 0 ? 'left' : 'right' }); }
        this.spdT += dt;
        if (on) this.spdOn += dt;
        if (this.spdT >= G.speedEvery) {
          const r = G.speedStep(p, run, this.spdOn / this.spdT);
          this.spdT = 0; this.spdOn = 0;
          if (r && r.to !== r.from) { this.log('speed', { speed_kmh: r.to, on_road: r.on, detail: r.from + '>' + r.to }); this.goal(); }
        }
      }
      this.wasOn = on;
      this.offEdge = !on;
      if (!on && this.kmh > 6 && ts - (this.rumbleAt || 0) > 190) { this.rumbleAt = ts; Sound.play('rumble'); }
      this.signs(ts);
      this.animal(ts, dt);
      this.forkStep(ts);
      if (p.turn && !this.turned && driving && this.tt >= p.turn.t) this.turnNow(ts);
      // things to collect: each one counts as the car goes past it
      while (this.itemK < p.items.length && p.items[this.itemK].w - this.pos <= SB_CAR_Z) {
        const it = p.items[this.itemK], got = Math.abs(this.carX - this.itemX(it)) <= SB_CAR + 0.08;
        G.item(p, run, this.itemK, got);
        if (got) this.grab(it, ts);
        this.itemK++;
      }
      // near the end the landmark comes into reach as a real place SB_FAR ahead, timed so
      // the car meets the finish line in front of it about when the drive is over
      if (driving && this.endW == null && this.tt >= p.duration - (SB_FAR - SB_TO_LINE - SB_CAR_Z) / Math.max(1, run.kmh * G.kmhToUnits)) this.endW = this.pos + SB_FAR;
      const line = this.endW == null ? Infinity : this.endW - SB_TO_LINE;
      if (driving && this.pos + SB_CAR_Z >= line && run.i >= p.signs.length && !this.sign && !(this.beast && !this.beast.res) && !this.fork) {
        this.phase = 'finish';
        this.stopW = Math.max(line + SB_PAST, this.pos + SB_CAR_Z + 2.5);
        this.brakeD = this.stopW - this.pos - SB_CAR_Z;
        this.brakeKmh = Math.max(this.kmh, 8);
      }
      if (this.phase === 'finish' && this.kmh === 0) this.resolve('complete');
    }
    signs(ts) {
      const p = this.p, run = this.run, S = this.sign;
      if (S && !S.res && ts - S.on >= S.ms + SB_GRACE) this.score(S, false, null, ts);
      if (S && S.res && ts - S.done > 480) this.sign = null;
      if (this.phase !== 'drive') return;
      const k = run.i;
      const FK = this.fork, zb = FK && FK.shown ? FK.w0 + 2.6 - this.pos : -1;
      if (k < p.signs.length && this.tt >= p.signs[k].t && (!this.sign || this.sign.res) && !this.backing && !(zb > 0.5 && zb < SB_SIGN_Z + 3)) {
        // at night a sign comes out of the dark and lights up in the headlights as it appears
        // (fade: how long that takes); the first time, with a word about it
        const first = p.night && this.isNew('night');
        this.sign = { k, at: ts, on: ts, fade: p.night ? SB_DARK : 0, ms: this.G.windowMs(p, run, k), res: null, done: null, kmh: Math.round(this.kmh), d0: { t: run.drive.t, on: run.drive.on } };
        if (first) {
          this.learned('night');
          this.later(() => { if (this.sign && this.sign.k === k && this.signXY) this.say(this.mark([this.signXY[0], this.signXY[1] - this.plateP * 0.62]), 'At night, signs light up in your headlights', '', 2600); }, 120);
        }
        if (this.practice) this.guide();
      }
    }
    // the place's animal steps onto the road ahead, walks to the middle and stands
    // there until a tap sends it off; the car eases off meanwhile, and if it gets
    // close, it brakes and the animal hurries off by itself
    animal(ts, dt) {
      const p = this.p, run = this.run;
      let B = this.beast;
      if (!B && this.phase === 'drive' && run.bi < p.beasts.length && this.tt >= p.beasts[run.bi].t) {
        const sp = p.beasts[run.bi], v = Math.max(this.kmh, run.kmh * 0.9) * this.G.kmhToUnits;
        const z0 = Math.max(12, Math.min(18, SB_STOP + v * 1.6));
        this.braked = true;
        // the animal of the sign that counts (from halfway on levels 4 and 5, the new one)
        B = this.beast = { k: run.bi, kind: this.target(), w: this.pos + z0, side: sp.side, dir: -sp.side, t0: ts, off: 0, x0: sp.side * (p.half + 0.7), x: sp.side * (p.half + 0.7), x1: -sp.side * 0.04, state: 'in', res: null };
        if (this.isNew('animals')) this.demo = 'animals';
        if (this.practice) this.guide();
      }
      if (!B) return;
      if (B.state === 'in') {
        const f = Math.min(1, (ts - B.t0) / 1000 / SB_IN);
        B.x = B.x0 + (B.x1 - B.x0) * (1 - (1 - f) * (1 - f));
        if (f >= 1) B.state = 'stand';
      } else if (B.state === 'off') B.x += B.dir * SB_RUN * dt;
      if (!B.res && this.phase === 'drive' && B.w - this.pos <= SB_STOP && this.demo !== 'animals') {
        B.res = 'braked';
        B.state = 'off';
        B.off = ts;
        this.brakeTo = ts + 900;
        this.braked = true;
        const rec = this.G.beast(p, run, { shooed: false });
        this.log('beast', { move_no: run.i, target: B.kind, cls: rec.cls, speed_kmh: Math.round(this.kmh), detail: B.side < 0 ? 'from left' : 'from right' });
        Sound.play('screech');
        buzz([30, 30, 30]);
      }
      if (Math.abs(B.x) > p.half + 1.4 || B.w - this.pos < 0.5) { this.beast = null; this.beastBox = null; }
    }
    // ---- forks
    // The road at distance w where a fork is near, across it from its middle (null where the
    // road is plain): before the nose one wide road (L to R); past it two lanes, the one to the
    // landmark (m: its middle, back to 0 over SB_SPLIT) and the other one (b) bending away.
    // path: where to drive; q: how far the drive line has moved over (0 to 1).
    lanes(w) {
      const F = this.fork;
      if (!F) return null;
      const d = w - F.w0, h = this.p.half, s = F.side, ap = F.ap;
      if (d < -SB_WIDE || d > 40) return null;
      const sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
      if (d < 0) {
        const e = sm((d + SB_WIDE) / SB_WIDE) * ap, hw = h * (1 + e);
        return { one: true, L: -hw, R: hw, path: s * h * e, q: e };
      }
      const r = 1 - sm(d / SB_SPLIT), m = s * h * r * ap, b = -s * (h + SB_BEND * (d / SB_AWAY) ** 2) * ap;
      return { one: false, m, b, path: m, q: r * ap, L: Math.min(m, b) - h, R: Math.max(m, b) + h };
    }
    // things to collect near a fork lie in the lane to the landmark
    itemX(it) {
      const ln = this.fork ? this.lanes(it.w) : null;
      return ln ? ln.path + it.x * (1 - 0.5 * ln.q) : it.x;
    }
    // the fork comes into sight a little before its arrow board; as the car's nose passes the
    // split, the lane it is in counts; the wrong one: it brakes and is put back in the right one
    forkStep(ts) {
      const p = this.p, run = this.run, fk = p.forks || [];
      let F = this.fork;
      if (!F && this.phase === 'drive' && run.fi < fk.length && this.tt >= fk[run.fi].t - SB_LEAD) {
        const f = fk[run.fi], demo = this.isNew('forks'), v = Math.max(this.kmh, run.kmh * 0.9) * this.G.kmhToUnits * (demo ? 0.75 : 1);
        F = this.fork = { k: run.fi, side: f.side, t: f.t, w0: this.pos + SB_CAR_Z + Math.max(15, v * (3.2 + Math.max(0, f.t - this.tt))), t0: ts, ap: 0, shown: 0, res: null, back: null, demo };
      }
      if (!F) return;
      F.ap = Math.min(1, (ts - F.t0) / 600);
      if (!F.shown && this.tt >= F.t && this.phase === 'drive') {
        F.shown = ts;
        this.log('fork_sign', { move_no: run.i, detail: F.side < 0 ? 'arrow left' : 'arrow right' });
        if (F.demo) {
          this.later(() => { if (this.fork === F && !F.res && this.boardXY) this.say(this.mark([this.boardXY[0], this.boardXY[1] - this.boardXY[2] * 0.6]), F.side < 0 ? 'Follow the arrow: keep left' : 'Follow the arrow: keep right', '', 2600); }, 250);
        }
      }
      const d = this.pos + SB_CAR_Z - F.w0;
      if (!F.res && d >= 1 && this.phase === 'drive') {
        const ln = this.lanes(this.pos + SB_CAR_Z), mid = ln && !ln.one ? (ln.m + ln.b) / 2 : 0;
        const right = F.side * (this.carX - mid) > 0;
        const rec = this.G.fork(p, run, { right });
        F.res = rec.cls;
        this.log('fork', { move_no: run.i, cls: rec.cls, speed_kmh: Math.round(this.kmh), detail: (F.side < 0 ? 'arrow left' : 'arrow right') + ', took ' + ((this.carX - mid < 0) ? 'left' : 'right') + (F.demo ? ', first time: slower' : '') });
        const show = this.o.feedback || this.practice || F.demo;
        if (right) {
          if (show) { Sound.play('yes'); buzz(10); }
          if (F.demo) this.later(() => this.say(this.mark([this.W / 2, this.H * 0.62]), 'That\'s the way!', 'yes', 1500), 100);
        } else {
          // brake, then steer back over into the right lane
          this.brakeTo = ts + 1100;
          this.braked = true;
          this.backing = true;
          F.back = { t0: ts + 380, ms: 720, x0: null };
          if (show) { Sound.play('no'); buzz([20, 40, 20]); this.say(this.mark([this.W / 2, this.H * 0.62]), 'Wrong way!', 'no', 1500); }
        }
        if (F.demo) this.learned('forks');
      }
      if (F.back && F.back.x0 == null && ts >= F.back.t0) F.back.x0 = this.carX;
      if (d > 26 && !F.back) this.fork = null;
    }
    // a thing collected: a ping that climbs with a run of them, and it flies to the counter
    grab(it, ts) {
      this.streak = ts - this.streakAt < 1500 ? Math.min(this.streak + 1, 8) : 0;
      this.streakAt = ts;
      Sound.play('ping', this.streak);
      this.got = (this.got || 0) + 1;
      this.gotAt = ts;
      if (this.W) this.flyers.push({ t0: ts, x: this.W / 2 + (it.x - this.carX) * (this.H / SB_CAR_Z), y: this.H * SB_HORIZON + this.H / SB_CAR_Z - this.H * 0.08 });
    }
    score(S, responded, rt, ts, source) {
      const p = this.p, run = this.run, sg = p.signs[S.k], D = run.drive;
      const span = D.t - S.d0.t, onShare = span > 0.05 ? (D.on - S.d0.on) / span : null;
      const rec = this.G.record(p, run, { responded, rt, planned: S.ms, kmh: S.kmh });
      S.res = rec.cls;
      S.done = ts;
      this.c.moves++;
      this.log('sign', {
        move_no: rec.i, target: sg.glyph, shown: sg.shape, cls: rec.cls,
        rt_ms: rec.rt == null ? '' : rec.rt, window_ms: S.ms, stair_next_ms: rec.next == null ? '' : rec.next,
        reversal: p.fixedMs ? '' : rec.rev, speed_kmh: S.kmh, on_road: onShare == null ? '' : r4(onShare), source: responded ? source : '',
      });
      const show = this.o.feedback || this.practice;
      S.show = show;
      if (show) {
        if (rec.cls === 'hit') {
          Sound.play('yes');
          buzz(10);
          this.btnFlash('ok');
          if (this.signXY) {
            const L = relPos(this, this.wrap);
            sparks(this, L.x - L.w / 2 + this.signXY[0], L.y - L.h / 2 + this.signXY[1], ['#FFC83A', '#FFFFFF', '#7CE3B0'], 12);
          }
          if (!reducedMotion()) { this.critter = { kind: sg.glyph, t0: ts + 120 }; Sound.play('hop'); }
        } else if (rec.cls === 'false_alarm') {
          Sound.play('no');
          buzz([20, 40, 20]);
          this.btnFlash('bad');
        } else if (rec.cls === 'miss') Sound.play('lose');
      } else if (responded) Sound.play('tick');
      if (this.practice) this.later(() => this.guide(), 300);
      this.updateStatus();
      this.app.touch();
    }
    // ---- drawing
    // the finish line: two white posts and a chequered band across the road at depth z
    drawLine(ctx, z, xr, camX, W, hy, F, half) {
      const s = F / z, xc = W / 2 + (xr - camX) * s, yG = hy + F / z;
      const xL = xc - half * 1.2 * s, xR = xc + half * 1.2 * s, top = yG - 0.95 * s, bh = 0.16 * s;
      ctx.fillStyle = '#F8F3EA';
      ctx.fillRect(xL - 0.03 * s, top, 0.06 * s, yG - top);
      ctx.fillRect(xR - 0.03 * s, top, 0.06 * s, yG - top);
      const cols = 12, cw = (xR - xL) / cols;
      for (let a = 0; a < cols; a++) for (let b = 0; b < 2; b++) {
        ctx.fillStyle = (a + b) % 2 ? '#1F2230' : '#FFFFFF';
        ctx.fillRect(xL + a * cw, top + (b * bh) / 2, cw + 0.6, bh / 2 + 0.6);
      }
    }
    draw(ts) {
      const ctx = this.ctx;
      if (!ctx || !this.W) return;
      const W = this.W, H = this.H, p = this.p, G = this.G, k = this.dpr, PL = this.place;
      const hy = Math.round(H * SB_HORIZON), F = H, half = p.half, t = ts / 1000;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      // the road's course, near to far
      const seg = G.seg, road = p.road, sc = this.pos;
      const i0 = Math.floor(sc / seg), frac = sc / seg - i0, N = SB_DRAW;
      if (!this.xs) { this.xs = new Float64Array(N + 2); this.zs = new Float64Array(N + 2); }
      const xs = this.xs, zs = this.zs;
      let x = 0, dx = -(road[i0] || 0) * SB_CURV * frac;
      for (let n = 0; n <= N; n++) {
        zs[n] = (i0 + n) * seg - sc;
        xs[n] = x;
        x += dx;
        dx += (road[i0 + n] || 0) * SB_CURV;
      }
      const at = (z) => { const f = (z + sc) / seg - i0, n = Math.max(0, Math.min(N - 1, Math.floor(f))); return xs[n] + (xs[n + 1] - xs[n]) * (f - n); };
      const camX = at(SB_CAR_Z) + this.carX;
      const vx = W / 2 + ((xs[N] - camX) * F) / zs[N];
      // sky: stars at dusk, the sun or the moon drifting with the bends, clouds, birds
      ctx.fillStyle = this.skyGrad;
      ctx.fillRect(0, 0, W, hy + 2);
      if (this.stars) {
        ctx.fillStyle = '#FFF6E2';
        for (const st of this.stars) { ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * st[3] + st[4]); ctx.fillRect(st[0], st[1], st[2], st[2]); }
        ctx.globalAlpha = 1;
      }
      // the northern lights: green curtains that ripple and fold, rose at their tops
      if (PL.aurora) {
        const sp = sbAurora();
        for (let a = 0; a < 2; a++) {
          const base = H * (0.19 + a * 0.07), amp = H * 0.032, top = H * (0.05 + a * 0.04);
          for (let x = -3; x < W + 3; x += 3) {
            const u = (x + this.bgX * 0.05) / W;
            const yb = base + Math.sin(u * 6 + t * 0.32 + a * 2.1) * amp + Math.sin(u * 15 - t * 0.55 + a) * amp * 0.35;
            const len = (yb - top) * (0.5 + 0.5 * Math.sin(u * 21 + t * 0.8 + a * 4) ** 2);
            ctx.globalAlpha = (0.18 + 0.14 * Math.sin(u * 37 + t * 1.5 + a)) * (a ? 0.75 : 1);
            ctx.drawImage(sp, x, yb - len, 3.2, len);
          }
        }
        ctx.globalAlpha = 1;
      }
      const body = PL.sun || PL.moon, span = W * 1.6;
      const sx = ((W * (body[0] + 0.3) - this.bgX * 0.12) % span + span) % span - W * 0.3, sy = H * body[1], sr = H * body[2];
      if (PL.sun) {
        const R = sr * 4.8;
        ctx.drawImage(sbGlow(PL.sun[4]), sx - R, sy - R, R * 2, R * 2);
        ctx.fillStyle = PL.sun[3];
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      } else {
        const R = sr * 4;
        ctx.drawImage(sbGlow('255, 240, 210'), sx - R, sy - R, R * 2, R * 2);
        ctx.drawImage(sbMoon(), sx - sr * 1.15, sy - sr * 1.15, sr * 2.3, sr * 2.3);
      }
      sbClouds(ctx, PL, W, H, this.bgX, t);
      // a balloon drifting over the savanna
      if (PL.balloon) {
        const span = W * 1.6, bx = ((W * 0.82 - this.bgX * 0.1 + t * 3) % span + span) % span - W * 0.3, by = H * 0.13 + Math.sin(t * 0.5) * H * 0.006, rb = H * 0.026;
        ctx.save();
        ctx.beginPath(); ctx.moveTo(bx - rb * 0.32, by + rb * 1.2); ctx.bezierCurveTo(bx - rb * 1.25, by + rb * 0.3, bx - rb * 1.15, by - rb * 1.05, bx, by - rb * 1.05);
        ctx.bezierCurveTo(bx + rb * 1.15, by - rb * 1.05, bx + rb * 1.25, by + rb * 0.3, bx + rb * 0.32, by + rb * 1.2); ctx.closePath();
        ctx.fillStyle = '#F2C94C'; ctx.fill(); ctx.clip();
        ctx.fillStyle = '#E8513F';
        for (const f of [-0.75, 0, 0.75]) { ctx.beginPath(); ctx.ellipse(bx + f * rb, by, rb * 0.22, rb * 1.3, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'; ctx.beginPath(); ctx.ellipse(bx - rb * 0.45, by - rb * 0.45, rb * 0.25, rb * 0.4, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = '#6B4A30'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(bx - rb * 0.3, by + rb * 1.2); ctx.lineTo(bx - rb * 0.22, by + rb * 1.58); ctx.moveTo(bx + rb * 0.3, by + rb * 1.2); ctx.lineTo(bx + rb * 0.22, by + rb * 1.58); ctx.stroke();
        ctx.fillStyle = '#8A5A34'; ctx.fillRect(bx - rb * 0.24, by + rb * 1.56, rb * 0.48, rb * 0.36);
      }
      // a pair of macaws crossing the jungle sky now and then
      if (PL.parrots) {
        const cyc = (t % 14) / 14, px0 = -60 + cyc * (W + 160);
        if (cyc < 0.8) for (let b = 0; b < 2; b++) {
          const px = px0 - b * 34, py = H * 0.15 + b * 12 + Math.sin(t * 2 + b) * 5, fl = Math.sin(t * 13 + b * 2);
          ctx.fillStyle = '#E8343A';
          ctx.beginPath(); ctx.ellipse(px, py, 8, 3.4, 0.08, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(px - 6, py); ctx.lineTo(px - 22, py + 4); ctx.lineTo(px - 6, py + 2.5); ctx.fill();
          ctx.beginPath(); ctx.arc(px + 8, py - 1.5, 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#FFE08A'; ctx.beginPath(); ctx.moveTo(px + 10.5, py - 2); ctx.lineTo(px + 13.5, py - 0.5); ctx.lineTo(px + 10.5, py + 0.5); ctx.fill();
          ctx.fillStyle = '#2F6FD6';
          ctx.beginPath(); ctx.moveTo(px - 2, py - 1); ctx.lineTo(px - 9, py - 1 - 11 * fl); ctx.lineTo(px + 4, py - 1); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#FFC93C';
          ctx.beginPath(); ctx.moveTo(px - 1, py - 0.5); ctx.lineTo(px - 5, py - 0.5 - 6 * fl); ctx.lineTo(px + 2.5, py - 0.5); ctx.closePath(); ctx.fill();
        }
      }
      if (PL.birds) {
        ctx.strokeStyle = PL.birds; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.globalAlpha = 0.75;
        ctx.beginPath();
        for (let b = 0; b < 3; b++) {
          const bx = ((t * 16 + b * 21 + 40) % (W + 140)) - 60, byy = H * 0.12 + b * 7 + Math.sin(t * 0.9 + b) * 3, wy = Math.sin(t * 9 + b * 2) * 2.4;
          ctx.moveTo(bx - 5, byy + wy); ctx.quadraticCurveTo(bx - 2.5, byy - 1, bx, byy); ctx.quadraticCurveTo(bx + 2.5, byy - 1, bx + 5, byy + wy);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // far away: each place has its own skyline
      sbFar(ctx, PL, W, H, hy, this.bgX, t, sx, vx, this.seaGrad);
      ctx.fillStyle = PL.ground;
      ctx.fillRect(0, hy, W, H - hy);
      if (PL.land === 'coast') { ctx.fillStyle = PL.water; ctx.fillRect(0, hy, Math.max(0, vx - 4), H * 0.08); }
      // the road, far to near
      const quad = (ax, ay, bx, by, cx, cy, ex, ey) => { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(ex, ey); ctx.closePath(); };
      // the landmark: a place on the skyline where the road runs out (everything nearer is
      // drawn over it), until the end of the drive is in reach and it stands at its depth
      const latD = PL.destLat != null ? PL.destLat : half * 1.16 + 0.8, wood = PL.wood || '#A97D52';
      const zD = this.endW == null ? SB_FAR : this.endW - sc, zL = this.endW == null ? 0 : this.endW - SB_TO_LINE - sc;
      const dest = (z) => sbDest(ctx, PL.dest, W / 2 + (at(z) + latD - camX) * (F / z), hy + F / z, F / z, t);
      let destDrawn = zD <= 0.5, lineDrawn = zL <= SB_CAR_Z, fprev = null, pkL = null, pkR = null;
      if (!destDrawn && zD >= zs[N]) { dest(zD); destDrawn = true; }
      const e0 = half * 1.16, coast = PL.land === 'coast';
      // the things to collect in sight, and the animal on the road: drawn at their depth
      const items = p.items, iq = [], spr = sbItem(PL.item);
      for (let k = this.itemK; k < items.length; k++) {
        const z = items[k].w - sc;
        if (z > N * seg) break;
        if (z > 0.4) iq.push(k);
      }
      let qi = iq.length - 1;
      const B = this.beast, zBe = B ? B.w - sc : 0;
      let beastDrawn = !B || zBe <= 0.4;
      this.beastBox = null;
      // a fork: its lanes, and its arrow board in the split
      const FK = this.fork, zN = FK ? FK.w0 + 2.6 - sc : 0;
      let boardDrawn = !FK || !FK.shown || zN <= 0.6;
      this.boardXY = null;
      for (let n = N - 1; n >= 0; n--) {
        const zB = zs[n + 1];
        if (zB <= 0.4) break;
        const zA = Math.max(0.4, zs[n]);
        const yA = hy + F / zA + 0.8, yB = hy + F / zB;
        const xA = W / 2 + ((xs[n] - camX) * F) / zA, xB = W / 2 + ((xs[n + 1] - camX) * F) / zB;
        const wA = (half * F) / zA, wB = (half * F) / zB;
        const i = i0 + n, stripe = Math.floor(i / 3) & 1, s = F / zB;
        const yT = yB - 0.7;
        // near a fork the road is wider or in two lanes, and what stands beside it moves out
        const fa = FK ? this.lanes(zA + sc) : null, fb = FK ? this.lanes(zB + sc) : null;
        const exL = fb ? -fb.L - half : 0, exR = fb ? fb.R - half : 0, ex = (sd) => (sd < 0 ? exL : exR);
        // beside the lane that bends away, fences stop (their rails would run across the view)
        const away = (sd) => ex(sd) > 1.2;
        // the land beside the road: fields, the sea, hedgerows
        if (PL.land) sbLand(ctx, PL, i, zB, xA, yA, xB, yB, yT, F / zA, s, half, t, this.salt, W, fa || fb ? [fa ? -fa.L - half : 0, fa ? fa.R - half : 0, exL, exR] : null);
        // the verge, the road, its edge lines and the dashes down the middle
        if (fa || fb) this.drawLanes(ctx, fa, fb, xA, yA, xB, yB, yT, F / zA, s, zB, stripe, W);
        else {
          ctx.fillStyle = PL.verge;
          ctx.beginPath(); quad(xA - wA * 1.16, yA, xA + wA * 1.16, yA, xB + wB * 1.16, yB, xB - wB * 1.16, yB); ctx.fill();
          ctx.fillStyle = PL.road;
          ctx.beginPath(); quad(xA - wA, yA, xA + wA, yA, xB + wB, yT, xB - wB, yT); ctx.fill();
          if (zB < 42) {
            ctx.fillStyle = '#F6F2E8';
            ctx.beginPath();
            quad(xA - wA * 0.965, yA, xA - wA * 0.91, yA, xB - wB * 0.91, yB, xB - wB * 0.965, yB);
            quad(xA + wA * 0.91, yA, xA + wA * 0.965, yA, xB + wB * 0.965, yB, xB + wB * 0.91, yB);
            if (!stripe) { const lA = wA * 0.028, lB = wB * 0.028; quad(xA - lA, yA, xA + lA, yA, xB + lB, yB, xB - lB, yB); }
            ctx.fill();
          }
        }
        // a fence along one side now and then
        if (PL.fence && i % 2 === 0) {
          const b = Math.floor(i / 24), fr = sbHash((b * 7919) ^ this.salt), sd = coast || fr & 16 ? 1 : -1;
          if ((fr % 100) < PL.fence * 100 && i % 24 > 1 && s > 2.2 && !away(sd)) {
            const fx = W / 2 + (xs[n + 1] + sd * (half * 1.16 + 0.34 + ex(sd)) - camX) * s, fh = 0.13 * s;
            ctx.strokeStyle = wood; ctx.fillStyle = wood;
            if (fprev && fprev.b === b) {
              ctx.lineWidth = Math.max(1, 0.016 * s);
              ctx.beginPath();
              ctx.moveTo(fprev.x, fprev.y - fprev.h * 0.42); ctx.lineTo(fx, yB - fh * 0.42);
              ctx.moveTo(fprev.x, fprev.y - fprev.h * 0.84); ctx.lineTo(fx, yB - fh * 0.84);
              ctx.stroke();
            }
            const fw = Math.max(1.5, 0.024 * s);
            ctx.fillRect(fx - fw / 2, yB - fh, fw, fh);
            fprev = { b, x: fx, y: yB, h: fh };
          } else fprev = null;
        }
        // tall orange snow poles mark the edges in the north
        if (PL.posts === 'snow' && i % 6 === 0 && s > 3) {
          const pw = Math.max(1, 0.016 * s), ph = 0.44 * s, lat = e0 + 0.08;
          for (const sd of [-1, 1]) {
            const px = W / 2 + (xs[n + 1] + sd * (lat + ex(sd)) - camX) * s;
            if (px < -pw || px > W + pw) continue;
            ctx.fillStyle = '#F06A2E'; ctx.fillRect(px - pw / 2, yB - ph, pw, ph);
            ctx.fillStyle = '#FFE9D8'; ctx.fillRect(px - pw / 2, yB - ph * 0.92, pw, ph * 0.07);
          }
        }
        // posts with a reflector beside the road: white, or wood in the forest
        else if (PL.posts && i % 5 === 0 && s > 6) {
          const pw = Math.max(1, 0.02 * s), ph = 0.14 * s, lat = e0 + 0.07, wood = PL.posts === 'wood';
          for (const sd of [-1, 1]) {
            const px = W / 2 + (xs[n + 1] + sd * (lat + ex(sd)) - camX) * s;
            if (px < -pw || px > W + pw) continue;
            ctx.fillStyle = wood ? '#86654A' : '#F7F4EC'; ctx.fillRect(px - pw / 2, yB - ph, pw, ph);
            if (!wood) { ctx.fillStyle = '#2E313B'; ctx.fillRect(px - pw / 2, yB - ph, pw, ph * 0.24); }
            ctx.fillStyle = wood ? '#F4F1E8' : '#F0663F'; ctx.fillRect(px - pw * 0.32, yB - ph * 0.7, pw * 0.64, ph * 0.13);
          }
        }
        // things to collect float over the road, bobbing
        while (qi >= 0 && items[iq[qi]].w - sc > zA) {
          const k = iq[qi--], it = items[k], z = it.w - sc, sI = F / z, sz = 0.22 * sI;
          if (z > zB || sz < 2.5) continue;
          const ix = W / 2 + (at(z) + this.itemX(it) - camX) * sI, iy = hy + sI;
          ctx.globalAlpha = Math.min(1, (N * seg - z) / 10);
          ctx.fillStyle = 'rgba(20, 24, 40, 0.16)';
          ctx.beginPath(); ctx.ellipse(ix, iy, sz * 0.28, sz * 0.07, 0, 0, Math.PI * 2); ctx.fill();
          ctx.drawImage(spr, ix - sz / 2, iy - 0.16 * sI - sz / 2 + Math.sin(t * 4 + k * 1.3) * 0.025 * sI, sz, sz);
          ctx.globalAlpha = 1;
        }
        if (!beastDrawn && zBe <= zB && zBe > zA) { this.drawBeast(ctx, B, zBe, at(zBe), camX, W, hy, F, ts); beastDrawn = true; }
        if (!boardDrawn && zN <= zB && zN > zA) { this.drawBoard(ctx, zN, at(zN), camX, W, hy, F, ts); boardDrawn = true; }
        // the forest and the jungle stand close on both sides
        if (PL.walls && zB < 46 && zB > 0.9 && s > 2.4 && i % ((zB < 14 ? 1 : zB < 28 ? 2 : 3) * (PL.far === 'canopy' ? 2 : 1)) === 0) {
          for (const sd of [-1, 1]) {
            const q = sbHash((i * 2 + (sd > 0 ? 1 : 0)) ^ this.salt);
            if (q % 5 === 4) continue;
            const tx = W / 2 + (xs[n + 1] + sd * (e0 + 0.24 + (((q >>> 6) % 100) / 100) * 0.75 + ex(sd)) - camX) * s;
            if (tx < -0.5 * s || tx > W + 0.5 * s) continue;
            sbThing(ctx, PL.walls[(q >>> 12) % PL.walls.length], tx, yB, s * (1.25 + ((q >>> 16) % 45) / 100), q, t, PL);
          }
        }
        // the village street: picket fences in front of the gardens, houses, lamps
        if (PL.land === 'street' && zB > 0.9) {
          if (s > 3 && (zB < 16 || i % 2 === 0)) {
            ctx.strokeStyle = '#DAD4E4'; ctx.fillStyle = '#DAD4E4'; ctx.lineWidth = Math.max(1, 0.01 * s);
            for (const sd of [-1, 1]) {
              if (away(sd)) { if (sd < 0) pkL = null; else pkR = null; continue; }
              const fx = W / 2 + (xs[n + 1] + sd * (e0 + 0.17 + ex(sd)) - camX) * s, fh = 0.07 * s, pv = sd < 0 ? pkL : pkR;
              if (pv) { ctx.beginPath(); ctx.moveTo(pv[0], pv[1] - pv[2] * 0.4); ctx.lineTo(fx, yB - fh * 0.4); ctx.moveTo(pv[0], pv[1] - pv[2] * 0.8); ctx.lineTo(fx, yB - fh * 0.8); ctx.stroke(); }
              const pw = Math.max(1, 0.014 * s);
              ctx.fillRect(fx - pw / 2, yB - fh, pw, fh);
              if (sd < 0) pkL = [fx, yB, fh]; else pkR = [fx, yB, fh];
            }
          }
          if (i % 5 === 0 && s > 2.2) {
            const sd = (i / 5) % 2 ? 1 : -1, q = sbHash(i * 7 + 3);
            const hx = W / 2 + (xs[n + 1] + sd * (e0 + 0.52 + (q % 10) / 50 + ex(sd)) - camX) * s;
            if (hx > -0.6 * s && hx < W + 0.6 * s) sbThing(ctx, 'house', hx, yB, s * 1.7, q, t, PL);
          }
          if (i % 6 === 3 && s > 4) {
            for (const sd of [-1, 1]) {
              const lx = W / 2 + (xs[n + 1] + sd * (e0 + 0.06 + ex(sd)) - camX) * s;
              if (lx > -0.3 * s && lx < W + 0.3 * s) sbThing(ctx, 'lamp', lx, yB, s, sd > 0 ? 2 : 0, t, PL);
            }
          }
        }
        // trees and the rest of the place
        const r = sbHash((i + 1) ^ this.salt);
        if (r % 3 === 0 && zB > 1.2 && s > 3) {
          const side = coast || r & 8 ? 1 : -1, kind = PL.things[(r >>> 9) % PL.things.length];
          const small = kind === 'flowers' || kind === 'fern' || kind === 'grass';
          const lat = half * 1.16 + (small ? 0.1 + (((r >>> 5) % 97) / 97) * 0.35 : 0.3 + (((r >>> 5) % 97) / 97) * 1.4);
          const tx = W / 2 + (xs[n + 1] + side * (lat + ex(side)) - camX) * s;
          if (tx > -0.7 * s && tx < W + 0.7 * s) sbThing(ctx, kind, tx, yB, s * (0.85 + ((r >>> 16) % 30) / 100), r, t, PL);
        }
        if (r % 5 === 2 && s > 16) {
          const side = r & 64 ? 1 : -1, lat = half * 1.16 + 0.05 + (((r >>> 7) % 89) / 89) * 0.5;
          const tx = W / 2 + (xs[n + 1] + side * (lat + ex(side)) - camX) * s;
          if (tx > -20 && tx < W + 20) sbThing(ctx, PL.small, tx, yB, s, r, t, PL);
        }
        // the landmark and the finish line, at their depth
        if (!destDrawn && zD <= zB && zD > zA) { dest(zD); destDrawn = true; }
        if (!lineDrawn && zL <= zB && zL > zA) { this.drawLine(ctx, zL, at(zL), camX, W, hy, F, half); lineDrawn = true; }
      }
      // shafts of afternoon light between the trees
      if (PL.shafts) {
        ctx.fillStyle = 'rgba(255, 238, 196, 0.075)';
        for (let q = 0; q < 4; q++) {
          const x0 = W * (0.4 + q * 0.16) + Math.sin(t * 0.25 + q * 1.7) * W * 0.02, w0 = W * (0.035 + (q % 2) * 0.025);
          ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + w0, 0); ctx.lineTo(x0 + w0 - W * 0.38, H); ctx.lineTo(x0 - W * 0.46, H); ctx.closePath(); ctx.fill();
        }
      }
      // haze toward the horizon
      ctx.fillStyle = this.hazeGrad;
      ctx.fillRect(0, hy - H * 0.05, W, H * 0.22);
      // mist drifting low through the jungle
      if (PL.mist) {
        const gl = sbGlow('255, 255, 255'), span = W * 1.8;
        ctx.globalAlpha = 0.13;
        for (let q = 0; q < 5; q++) {
          const R = W * (0.3 + (q % 3) * 0.07), mx = ((q * W * 0.45 + t * (6 + q) - this.bgX * 0.25) % span + span) % span - W * 0.4;
          ctx.drawImage(gl, mx - R, hy + H * (0.03 + (q % 2) * 0.04) - R * 0.16, R * 2, R * 0.32);
        }
        ctx.globalAlpha = 1;
      }
      // the air shimmers over the hot sand
      if (PL.shimmer) {
        ctx.fillStyle = 'rgba(255, 250, 236, 0.55)';
        for (let q = 0; q < 6; q++) {
          const yy = hy - 1.5 + q * 1.7, ph = t * 2.6 + q * 1.3;
          for (let x = ((q * 37) % 70) - 70; x < W; x += 70) ctx.fillRect(x + Math.sin(ph + x * 0.05) * 7, yy, 16 + 10 * Math.sin(ph * 0.7 + x), 1);
        }
      }
      // headlights on the road ahead at night (and on the drive at dusk at level 5)
      if ((PL.lights || p.night) && this.phase !== 'done') {
        const zN = 2.3, zF = 10, sN = F / zN, sF = F / zF, yN = hy + sN, yF = hy + sF;
        const xN = W / 2, xF = W / 2 + (at(zF) + this.carX - camX) * sF;
        const lg = ctx.createLinearGradient(0, yN, 0, yF);
        lg.addColorStop(0, 'rgba(255, 244, 214, 0.3)'); lg.addColorStop(1, 'rgba(255, 244, 214, 0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.moveTo(xN - 0.16 * sN, yN); ctx.lineTo(xN + 0.16 * sN, yN); ctx.lineTo(xF + 0.5 * sF, yF); ctx.lineTo(xF - 0.5 * sF, yF); ctx.closePath(); ctx.fill();
      }
      // the sign, just off the right edge
      const S = this.sign;
      this.signXY = null;
      if (S) {
        const z = SB_SIGN_Z, s = F / z;
        const gx = W / 2 + (at(z) + this.edgeR(z) + 0.16 - camX) * s, gy = hy + F / z;
        const P = this.plateP, age = ts - S.on, age0 = ts - (S.at || S.on), cy = gy - H * 0.13 - P * 0.25;
        let scale = age0 < 160 ? 1.1 * (1 - Math.pow(1 - Math.max(0, age0) / 160, 3)) : 1;
        let dxs = 0, ring = null;
        if (S.res) {
          const tt = Math.max(0, ts - S.done);
          if (S.show && S.res === 'hit') { scale *= 1 + 0.18 * Math.min(1, tt / 140); ring = '#1FB36E'; if (tt > 160) scale *= Math.max(0, 1 - (tt - 160) / 160); }
          else if (S.show && S.res === 'false_alarm') { dxs = Math.sin(tt / 22) * 7 * Math.max(0, 1 - tt / 320); ring = '#EF4F4A'; if (tt > 300) scale *= Math.max(0, 1 - (tt - 300) / 150); }
          else if (S.show && S.res === 'miss') { ring = '#EF4F4A'; scale *= Math.max(0, 1 - tt / 300); }
          else scale *= Math.max(0, 1 - tt / 140);
        } else if (age > S.ms) scale *= Math.max(0, 1 - (age - S.ms) / 140);
        if (scale > 0.02) {
          ctx.fillStyle = SB_COL.post;
          ctx.fillRect(gx - 2, cy, 4, gy - cy);
          if (ring) {
            ctx.strokeStyle = ring; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(gx + dxs, cy, P * 0.62 * scale, 0, Math.PI * 2); ctx.stroke();
          }
          // at night: it comes out of the dark, brightening as the headlights reach it, with a
          // warm shine that swells as it lights up and then fades
          const sg = p.signs[S.k], f = S.fade ? Math.min(1, age0 / S.fade) : 1;
          if (S.fade && age0 < S.fade + 320) {
            const g = age0 < S.fade ? f : 1 - (age0 - S.fade) / 320, R = P * (0.9 + 0.35 * f);
            ctx.globalAlpha = 0.55 * g;
            ctx.drawImage(sbGlow('255, 244, 210'), gx - R, cy - R, R * 2, R * 2);
            ctx.globalAlpha = 1;
          }
          ctx.save();
          ctx.translate(gx + dxs, cy);
          ctx.scale(scale, scale);
          sbPlate(ctx, sg.shape, sg.glyph, 0, 0, P);
          if (f < 1) {
            const dk = sbPlateDark(sg.shape, sg.glyph, P);
            ctx.globalAlpha = Math.pow(1 - f, 1.4);
            ctx.drawImage(dk.c, -dk.S / 2, -dk.S / 2, dk.S, dk.S);
            ctx.globalAlpha = 1;
          }
          ctx.restore();
          this.signXY = [gx, cy];
        }
      }
      // a caught sign's animal comes to life and runs or hops off into the field
      const C = this.critter;
      if (C) {
        const age = ts - C.t0, dur = 1000;
        if (age > dur) this.critter = null;
        else if (age >= 0) {
          const z = SB_SIGN_Z, s = F / z, gy = hy + F / z, f = age / dur, L = 0.62 * s, A = SB_ANIM[C.kind];
          const cx0 = W / 2 + (at(z) + this.edgeR(z) + 0.16 - camX) * s + (0.12 + f * 1.25) * s;
          ctx.globalAlpha = Math.max(0, Math.min(1, (1 - f) * 4));
          ctx.fillStyle = 'rgba(30, 50, 30, 0.2)';
          ctx.beginPath(); ctx.ellipse(cx0, gy, L * 0.32, L * 0.05, 0, 0, Math.PI * 2); ctx.fill();
          sbAnimal(ctx, C.kind, cx0, gy, L, (age / 1000) * (A ? A.rate : 2) * 1.8, {});
          ctx.globalAlpha = 1;
        }
      }
      // the car, with a puff from the exhaust now and then and dust off the road
      const carY = hy + F / SB_CAR_Z, carW = (SB_CAR * 2 * F) / SB_CAR_Z, u = carW / 100;
      const bob = this.offEdge && this.kmh > 4 ? Math.sin(this.tt * 70) * 1.6 : 0;
      sbCar(ctx, W / 2, carY, carW, this.tilt, bob, this.braking || this.phase === 'finish');
      if (PL.moon || p.night) for (const sd of [-1, 1]) ctx.drawImage(sbGlow('255, 90, 70'), W / 2 + sd * 36.5 * u - 22 * u, carY - 38.5 * u + bob - 22 * u, 44 * u, 44 * u);
      // the finish line once the car is through it and the camera not yet
      if (zL > 0.6 && zL <= SB_CAR_Z) this.drawLine(ctx, zL, at(zL), camX, W, hy, F, half);
      if (this.phase === 'drive' || this.phase === 'finish') {
        if (this.kmh > 4 && ts - (this.exAt || 0) > 230) { this.exAt = ts; this.puffs.push({ t0: ts, x: -20, y: -4, vx: -16, vy: 10, r0: 3, r1: 15, life: 700, c: '240, 240, 244', a: 0.22 }); }
        if (ts < this.brakeTo && this.kmh > 3 && ts - (this.skAt || 0) > 60) {
          this.skAt = ts;
          for (const sd of [-1, 1]) this.puffs.push({ t0: ts, x: sd * 38, y: -3, vx: sd * (6 + Math.random() * 10), vy: -12 - Math.random() * 8, r0: 4, r1: 15, life: 520, c: '236, 236, 240', a: 0.34 });
        }
        if (this.offEdge && this.kmh > 6 && ts - (this.duAt || 0) > 70) {
          this.duAt = ts;
          const sd = this.carX > 0 ? 1 : -1;
          this.puffs.push({ t0: ts, x: sd * (38 + Math.random() * 8), y: -3, vx: sd * (18 + Math.random() * 22), vy: -16 - Math.random() * 12, r0: 5, r1: 17, life: 560, c: PL.dust, a: 0.5 });
        }
      }
      if (this.puffs.length) {
        this.puffs = this.puffs.filter((q) => ts - q.t0 < q.life);
        for (const q of this.puffs) {
          const f = (ts - q.t0) / q.life, sec = (ts - q.t0) / 1000;
          ctx.fillStyle = 'rgba(' + q.c + ', ' + (q.a * (1 - f)).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(W / 2 + (q.x + q.vx * sec) * u, carY + (q.y + q.vy * sec) * u, (q.r0 + (q.r1 - q.r0) * f) * u, 0, Math.PI * 2); ctx.fill();
        }
      }
      // snow falling in the north
      if (PL.snow) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        for (let q = 0; q < 48; q++) {
          const h0 = sbHash(q * 41 + 7), fall = 16 + (h0 % 26), r = 1 + ((h0 >>> 8) % 3) * 0.55;
          const yy = (((h0 >>> 4) % 1000) / 1000 * (H + 12) + t * fall) % (H + 12) - 6;
          const xx = ((((h0 >>> 14) % 1000) / 1000 * W + Math.sin(t * 0.7 + q) * 10 - this.bgX * 0.06 * (r / 2)) % W + W) % W;
          ctx.fillRect(xx - r / 2, yy - r / 2, r, r);
        }
      }
      // how far along the drive, with the landmark's flag at the end
      const pr = Math.max(0, Math.min(1, this.tt / p.duration)), bx = 18, bw = W - 50, by = 16;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      sbRR(ctx, bx, by - 3, bw, 6, 3); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      sbRR(ctx, bx, by - 3, Math.max(6, bw * pr), 6, 3); ctx.fill();
      ctx.fillRect(bx + bw + 6, by - 12, 2, 16);
      ctx.fillStyle = PL.flag;
      ctx.beginPath(); ctx.moveTo(bx + bw + 8, by - 12); ctx.lineTo(bx + bw + 19, by - 8); ctx.lineTo(bx + bw + 8, by - 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#E5564D';
      ctx.beginPath(); ctx.arc(bx + bw * pr, by, 5.5, 0, Math.PI * 2); ctx.fill();
      // things collected: a count under the route bar, and the newest flying up to it
      const cX = 30, cY = 42;
      if (this.flyers.length) {
        this.flyers = this.flyers.filter((q) => ts - q.t0 < 480);
        for (const q of this.flyers) {
          const f = (ts - q.t0) / 480, e = f * f * (3 - 2 * f), sz = 40 - 14 * e;
          ctx.drawImage(spr, q.x + (cX - q.x) * e - sz / 2, q.y + (cY - q.y) * e - Math.sin(f * Math.PI) * H * 0.06 - sz / 2, sz, sz);
        }
      }
      if (this.got && (this.o.counter || this.practice)) {
        const since = ts - this.gotAt, bump = since > 420 && since < 640 ? Math.sin(((since - 420) / 220) * Math.PI) : 0, sz = 28 * (1 + 0.25 * bump);
        ctx.drawImage(spr, cX - sz / 2, cY - sz / 2, sz, sz);
        ctx.font = '700 17px Fredoka, Lexend, system-ui, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30, 30, 40, 0.45)'; ctx.lineJoin = 'round';
        ctx.strokeText(String(this.got), cX + 16, cY + 1);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(String(this.got), cX + 16, cY + 1);
      }
      // the wheel follows the steering
      this.wheelEl.style.transform = 'rotate(' + Math.round(this.steer * 110) + 'deg)';
    }
    // the right edge of the road the car is on, z ahead of the camera (where the signs stand)
    edgeR(z) {
      const ln = this.fork ? this.lanes(this.pos + z) : null, h = this.p.half;
      return !ln ? h : ln.one ? ln.R : ln.m + h;
    }
    // one segment of the road near a fork, from its near end (a) to its far end (b): one wide
    // road with the dashes running on to the nose, or two lanes, the other one bending away
    drawLanes(ctx, fa, fb, xA, yA, xB, yB, yT, sA, sB, zB, stripe, W) {
      const PL = this.place, h = this.p.half, sd0 = this.fork.side, v = 0.16 * h, L1 = 0.035 * h, L2 = 0.09 * h;
      const quad = (ax, ay, bx, by, cx, cy, ex, ey) => { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(ex, ey); ctx.closePath(); };
      const plain = { one: true, L: -h, R: h };
      const A = fa || plain, B = fb || (fa && !fa.one ? { one: false, m: 0, b: fa.b } : plain);
      const strip = (a0, a1, b0, b1, dash) => {
        ctx.fillStyle = PL.verge;
        ctx.beginPath(); quad(xA + (a0 - v) * sA, yA, xA + (a1 + v) * sA, yA, xB + (b1 + v) * sB, yB, xB + (b0 - v) * sB, yB); ctx.fill();
        ctx.fillStyle = PL.road;
        ctx.beginPath(); quad(xA + a0 * sA, yA, xA + a1 * sA, yA, xB + b1 * sB, yT, xB + b0 * sB, yT); ctx.fill();
        if (zB < 42) {
          ctx.fillStyle = '#F6F2E8';
          ctx.beginPath();
          quad(xA + (a0 + L1) * sA, yA, xA + (a0 + L2) * sA, yA, xB + (b0 + L2) * sB, yB, xB + (b0 + L1) * sB, yB);
          quad(xA + (a1 - L2) * sA, yA, xA + (a1 - L1) * sA, yA, xB + (b1 - L1) * sB, yB, xB + (b1 - L2) * sB, yB);
          if (dash) { const lA = 0.028 * h * sA, lB = 0.028 * h * sB; quad(xA - lA, yA, xA + lA, yA, xB + lB, yB, xB - lB, yB); }
          ctx.fill();
        }
      };
      if (A.one && B.one) { strip(A.L, A.R, B.L, B.R, !stripe); return; }
      // [from, to] across: before the nose each lane is half of the wide road
      const lane = (ln, main) => {
        const sd = main ? sd0 : -sd0;
        if (ln.one) return sd > 0 ? [0, ln.R] : [ln.L, 0];
        const c = main ? ln.m : ln.b;
        return [c - h, c + h];
      };
      const bA = lane(A, false), bB = lane(B, false), mA = lane(A, true), mB = lane(B, true);
      const gone = Math.min(xA + bA[0] * sA, xB + bB[0] * sB) > W + 20 || Math.max(xA + bA[1] * sA, xB + bB[1] * sB) < -20;
      if (!gone) strip(bA[0], bA[1], bB[0], bB[1], false);
      strip(mA[0], mA[1], mB[0], mB[1], !stripe && !A.one && Math.abs(A.m) < 0.03 && Math.abs(B.m) < 0.03);
    }
    // the fork's arrow board: green, high on a post in the split (it passes over the car's
    // view), a big white arrow toward the lane for the landmark, with its flag; far off it is
    // drawn larger, so it reads in time
    drawBoard(ctx, z, xr, camX, W, hy, F, ts) {
      const FK = this.fork, a = Math.min(1, (ts - FK.shown) / 300) * Math.max(0, Math.min(1, (z - 2.5) / 0.7));
      if (a <= 0) return;
      const ln = this.lanes(FK.w0 + 2.6), gx = ln && !ln.one ? (ln.m + ln.b) / 2 : 0, sd = FK.side;
      const s0 = F / z, s = Math.max(s0, (W * 0.26) / 1.05), x = W / 2 + (xr + gx - camX) * s0, y = hy + s0;
      const pw = 1.05 * s, ph = 0.7 * s, top = y - 1.58 * s, r = 0.08 * s;
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(20, 24, 40, 0.2)';
      ctx.beginPath(); ctx.ellipse(x, y, 0.1 * s0, 0.025 * s0, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9AA0AE';
      ctx.fillRect(x - 0.025 * s, top + ph - 1, 0.05 * s, y - top - ph + 1);
      // the panel: green with a white rim
      ctx.fillStyle = '#FFFFFF';
      sbRR(ctx, x - pw / 2, top, pw, ph, r); ctx.fill();
      ctx.fillStyle = '#1C8A4E';
      sbRR(ctx, x - pw / 2 + 0.035 * s, top + 0.035 * s, pw - 0.07 * s, ph - 0.07 * s, r * 0.7); ctx.fill();
      // the arrow: up from the bottom, then over to the side, with a big head
      const u = s, bx = x - sd * 0.2 * u, by = top + ph - 0.09 * u, kx = bx, ky = top + 0.4 * u, tx = x + sd * 0.07 * u, ty = top + 0.16 * u;
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 0.1 * u; ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
      const ang = Math.atan2(ty - ky, tx - kx), hl = 0.15 * u, hw = 0.13 * u;
      const ex = tx - Math.cos(ang) * hl * 0.85, ey = ty - Math.sin(ang) * hl * 0.85;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(kx, ky); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - Math.cos(ang) * hl + Math.sin(ang) * hw, ty - Math.sin(ang) * hl - Math.cos(ang) * hw);
      ctx.lineTo(tx - Math.cos(ang) * hl - Math.sin(ang) * hw, ty - Math.sin(ang) * hl + Math.cos(ang) * hw);
      ctx.closePath(); ctx.fill();
      // the landmark's flag, as at the end of the route bar, on a white tile beside the arrow's head
      const tw = 0.3 * u, tl = x + sd * 0.33 * u - tw / 2, tt = top + 0.1 * u;
      ctx.fillStyle = '#FFFFFF';
      sbRR(ctx, tl, tt, tw, tw, 0.05 * u); ctx.fill();
      const fx = tl + tw * 0.32, fy = tt + tw * 0.86;
      ctx.fillStyle = '#5A6070';
      ctx.fillRect(fx - 0.012 * u, fy - 0.22 * u, 0.024 * u, 0.22 * u);
      ctx.fillStyle = this.place.flag;
      ctx.beginPath(); ctx.moveTo(fx + 0.012 * u, fy - 0.22 * u); ctx.lineTo(fx + 0.012 * u + 0.15 * u, fy - 0.165 * u); ctx.lineTo(fx + 0.012 * u, fy - 0.11 * u); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      this.boardXY = [x, top + ph / 2, pw];
    }
    // the animal standing on the road at depth z (xr: the road's middle there), with
    // the village duck's ducklings behind her; keeps the box a tap can hit
    drawBeast(ctx, B, z, xr, camX, W, hy, F, ts) {
      const kind = B.kind, A = SB_ANIM[kind], s = F / z, L = A.len * s, y = hy + s, flip = B.dir < 0;
      const moving = B.state !== 'stand', ph = moving ? ((ts - B.t0) / 1000) * A.rate * (B.state === 'off' ? 1.7 : 1) : 0;
      const kids = kind === 'duck' ? 3 : 0, b = sbAnimBox(kind), k = L / 100;
      let x0 = Infinity, x1 = -Infinity;
      for (let i = kids; i >= 0; i--) {
        const x = W / 2 + (xr + B.x - B.dir * (i ? 0.1 + i * 0.13 : 0) - camX) * s, kd = i ? 'duckling' : kind, bb = i ? sbAnimBox('duckling') : b;
        ctx.fillStyle = 'rgba(20, 24, 40, 0.2)';
        ctx.beginPath(); ctx.ellipse(x, y, ((bb[2] - bb[0]) / 2) * k * 0.85, Math.max(1.5, 0.03 * s), 0, 0, Math.PI * 2); ctx.fill();
        sbAnimal(ctx, kd, x, y, L, ph + i * 0.3, { flip, still: !moving });
        x0 = Math.min(x0, flip ? x - bb[2] * k : x + bb[0] * k);
        x1 = Math.max(x1, flip ? x - bb[0] * k : x + bb[2] * k);
      }
      this.beastBox = [x0, y + b[1] * k, x1, y + 2];
      const xm = W / 2 + (xr + B.x - camX) * s;
      this.beastXY = [xm, y + ((b[1] + b[3]) / 2) * k];
    }
    mark(xy) {
      this.anchor.style.left = Math.round(xy[0]) + 'px';
      this.anchor.style.top = Math.round(xy[1]) + 'px';
      return this.anchor;
    }
    // ---- status
    goal() {
      const kmh = Math.round(this.run.kmh), txt = kmh + ' km/h';
      if (this.goalTxt !== txt) {
        const faster = this.goalKmh != null && kmh > this.goalKmh;
        this.goalTxt = txt;
        this.goalKmh = kmh;
        this.goalEl.textContent = '';
        this.goalEl.append(icon('gauge'), h('span', { text: txt }));
        if (faster) { this.goalEl.classList.remove('bump'); void this.goalEl.offsetWidth; this.goalEl.classList.add('bump'); }
      }
      this.goalEl.classList.add('speed');
      this.goalEl.hidden = !(this.o.counter || this.practice);
      this.goalEl.setAttribute('aria-label', 'Speed ' + txt);
    }
    updateStatus() {
      super.updateStatus();
      this.meterEl.hidden = true;
      this.tally();
    }
    tally() {
      if (!this.tallyEl) return;
      const p = this.p, res = this.run.res, show = this.o.feedback || this.practice;
      let n = 0, caught = 0;
      this.tallyDots.textContent = '';
      p.signs.forEach((sg, k) => {
        if (!sg.go) return;
        n++;
        const r = res[k];
        if (r && r.cls === 'hit') caught++;
        this.tallyDots.append(h('i', { class: r ? (show ? (r.cls === 'hit' ? 'ok' : 'bad') : 'done') : '' }));
      });
      this.tallyEl.setAttribute('aria-label', caught + ' of ' + n + ' target signs caught');
    }
    guide() {
      if (this.hold) return;   // a demo's hand stays on the animal until it is tapped
      super.guide();
      if (this.hand) this.hand.el.classList.toggle('drag', !this.summary && this.guideTarget() === this.wheelEl);
    }
    guideTarget() {
      if (this.summary) return null;
      if (this.phase === 'ready' || this.phase === 'paused') return this.goBtn;
      if (this.phase !== 'drive') return null;
      const S = this.sign, B = this.beast;
      if (S && !S.res && this.p.signs[S.k].go && this.signXY) return this.mark(this.signXY);
      if (B && !B.res && this.beastBox) return this.mark(this.beastXY);
      if (!this.steered && this.tt < 10) return this.wheelEl;
      return null;
    }
    // ---- end of the drive
    beforeResolve() {
      caf(this.rafId);
      this.rafId = null;
      Sound.engine(0);
      this.phase = 'done';
      this.goBtn.hidden = true;
      this.signBtn.classList.remove('cue');
      this.sign = null;
      this.beast = null;
      this.draw(now());
    }
    makeSummary(outcome, dur) {
      const d = this.G.summary(this.p, this.run);
      const complete = outcome === 'complete';
      const acc = d.accuracy || 0, road = d.on_road || 0;
      const stars = complete && !this.practice ? (acc >= 0.9 && road >= 0.9 ? 3 : acc >= 0.75 && road >= 0.75 ? 2 : 1) : 0;
      return {
        outcome,
        success: complete && !this.practice && this.G.success(this.p, d),
        duration_ms: dur, first_move_ms: this.firstMove, hidden_ms: Math.round(this.hiddenMs),
        moves: d.n, reference: null, par: null, efficiency: '',
        stars, sb: d,
      };
    }
    // passed: every target caught and no other sign tapped
    practicePassed(sm) { return sm.outcome === 'complete' && !!sm.sb && sm.sb.misses === 0 && sm.sb.false_alarms === 0; }
    celebrate(sm) { return this.trialCelebrate(sm, CONFETTI.switchback); }
    resultTitle(sm) {
      if (sm.outcome !== 'complete') return super.resultTitle(sm);
      if (this.practice) return sm.passed ? 'Got it!' : 'Once more';
      if (!this.o.counter) return 'Done!';
      if (sm.sb.correct === sm.sb.n && sm.sb.stray === 0 && sm.sb.on_road >= 0.95) return 'Perfect!';
      return sm.stars === 3 ? 'Great!' : sm.stars === 2 ? 'Nice!' : 'Done!';
    }
    resultStats(sm) {
      const d = sm.sb;
      if (!d || !d.n) return null;
      const c = h('canvas', { class: 'res-item', width: 44, height: 44, 'aria-hidden': 'true' }), g = c.getContext('2d');
      if (g) g.drawImage(sbItem(this.place.item), 0, 0, 44, 44);
      // what counts first: the target signs caught, as the tally counted them (taps on other
      // signs beside them), and the road; the things collected are a bonus, below
      // the sign that counted (both, when a new animal came halfway)
      const plate = (g) => {
        const c = h('canvas', { class: 'res-sign', width: 48, height: 48, 'aria-hidden': 'true' }), x = c.getContext('2d');
        if (x) { x.setTransform(2, 0, 0, 2, 0, 0); sbPlate(x, 'tri', g, 12, 12.7, 21.6); }
        return c;
      };
      const targets = d.hits + d.misses, tn = this.p.turn;
      return h('div', { class: 'res-stack' },
        h('div', { class: 'res-stats' },
          h('span', { 'aria-label': d.hits + ' of ' + targets + ' target signs caught' + (d.false_alarms ? ', ' + d.false_alarms + ' taps on other signs' : '') },
            plate(this.p.target), tn ? plate(tn.to) : null, h('b', { text: d.hits + '/' + targets }), d.false_alarms ? h('small', { class: 'res-wrong' }, icon('x'), String(d.false_alarms)) : null),
          h('span', { 'aria-label': 'On the road' }, icon('road'), h('b', { text: Math.round((d.on_road || 0) * 100) + '%' })),
          d.forks ? h('span', { 'aria-label': d.right_lanes + ' of ' + d.forks + ' forks in the right lane' }, icon('fork'), h('b', { text: d.right_lanes + '/' + d.forks })) : null,
          d.speed_mean_kmh != null ? h('span', { 'aria-label': 'Average speed' }, icon('gauge'), h('b', { text: Math.round(d.speed_mean_kmh) + ' km/h' })) : null),
        d.items ? h('div', { class: 'res-bonus', 'aria-label': 'Collected ' + d.collected + ' of ' + d.items }, c, h('b', { text: d.collected + '/' + d.items })) : null);
    }
    extraSnapshot() { return { tt: this.tt, pos: this.pos, endW: this.endW }; }
    onKey(e) {
      if (this.summary) return false;
      const k = e.key;
      if ((this.phase === 'ready' || this.phase === 'paused') && (k === ' ' || k === 'Enter')) { this.begin(); return true; }
      if (this.phase !== 'drive' && this.phase !== 'finish') return false;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { this.keySteer = -1; if (!this.steered) { this.steered = true; this.guide(); } return true; }
      if (k === 'ArrowRight' || k === 'd' || k === 'D') { this.keySteer = 1; if (!this.steered) { this.steered = true; this.guide(); } return true; }
      if (k === ' ' || k === 'Enter' || k === 'ArrowUp') { if (!e.repeat) this.respond(e, 'key'); return true; }
      if (k === 'h' || k === 'H' || k === 'ArrowDown') { if (!e.repeat) this.shoo(e, 'key'); return true; }
      return false;
    }
  }

  // ------------------------------------------------------------ Keepsake
  // One park, drawn by hand on a 100 x 120 board with the basket below it
  // (to y 150). The stones sit beside the path and by the landmarks (house,
  // pond, big tree, well, flower bed, bench). Things ride on round white
  // tokens so they read on grass, sand and water alike.
  const KS_TRAY_Y = 134, KS_LIFT = 2.4;   // the basket row; how far a thing rides above its stone's middle
  const KS_ART = {
    apple: '<path d="M0 -5.2C3.6 -7.8 8 -5.2 8 -0.3C8 5 4.2 8.4 0 7.4C-4.2 8.4 -8 5 -8 -0.3C-8 -5.2 -3.6 -7.8 0 -5.2Z" fill="#E8463D"/><path d="M-4.8 -2.2C-4.4 -4.2 -2.8 -5 -1.6 -4.8" stroke="#FFFFFF" stroke-opacity=".5" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M0 -5.2Q0.4 -8 1.8 -9.2" stroke="#6B4423" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M1.6 -7.6Q5.4 -9.8 7.2 -7.2Q4 -5.6 1.6 -7.6Z" fill="#3FA34D"/>',
    key: '<circle cx="-4.4" cy="0" r="4.4" fill="#F2B632"/><circle cx="-4.4" cy="0" r="1.8" fill="#FFFFFF"/><rect x="-1.2" y="-1.4" width="10.2" height="2.8" rx="1.4" fill="#F2B632"/><rect x="5.8" y="0.4" width="2" height="3.8" rx=".7" fill="#F2B632"/><rect x="2.6" y="0.4" width="2" height="2.8" rx=".7" fill="#F2B632"/><path d="M-7 -1.6Q-6.4 -3.2 -4.6 -3.4" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="1.1" fill="none" stroke-linecap="round"/>',
    mug: '<path d="M4.2 -2.4h1.6a3.2 3.2 0 0 1 0 6.4H4.2" stroke="#3D8BFD" stroke-width="2.1" fill="none"/><rect x="-6.8" y="-4.8" width="11.2" height="11.6" rx="2.4" fill="#3D8BFD"/><rect x="-6.8" y="-4.8" width="11.2" height="2.8" rx="1.3" fill="#2A6FD6"/><path d="M-3.8 -6.8q1.1 -1.5 0 -3M-0.6 -6.8q1.1 -1.5 0 -3" stroke="#A6AEBB" stroke-width="1.2" fill="none" stroke-linecap="round"/>',
    ball: '<circle r="8.2" fill="#FFFFFF" stroke="#DDD8CC" stroke-width=".7"/><path d="M0 0L0 -8.2A8.2 8.2 0 0 1 7.8 -2.5Z" fill="#FF5D5D"/><path d="M0 0L6.3 5.2A8.2 8.2 0 0 1 -1.6 8Z" fill="#FFC93C"/><path d="M0 0L-8 1.8A8.2 8.2 0 0 1 -4.9 -6.6Z" fill="#3D8BFD"/><circle r="1.9" fill="#FFFFFF"/>',
    hat: '<ellipse cx="0" cy="3.8" rx="9.2" ry="2.9" fill="#E2AE3B"/><path d="M-5.4 3.8C-5.8 -5.4 5.8 -5.4 5.4 3.8Z" fill="#F2C94C"/><path d="M-5.5 1H5.5V3.3H-5.5Z" fill="#E8463D"/><path d="M-3.6 -1.6Q-3 -3.4 -1.2 -3.6" stroke="#FFFFFF" stroke-opacity=".5" stroke-width="1.1" fill="none" stroke-linecap="round"/>',
    book: '<rect x="-7" y="-6.6" width="14" height="13.2" rx="1.7" fill="#2DBF6C"/><rect x="-7" y="-6.6" width="2.8" height="13.2" rx="1.2" fill="#1F9A55"/><rect x="-2.8" y="-3.6" width="7.6" height="2.4" rx="1.1" fill="#FFFFFF" fill-opacity=".9"/><rect x="-6.2" y="4.6" width="12.6" height="2" fill="#F7F3E8"/>',
    bell: '<circle cx="0" cy="-7.8" r="1.6" fill="#C98A0B"/><path d="M0 -6.8C4.3 -6.8 5.3 -2.7 5.3 1.2C5.3 3.9 7.4 5.1 7.4 5.1H-7.4C-7.4 5.1 -5.3 3.9 -5.3 1.2C-5.3 -2.7 -4.3 -6.8 0 -6.8Z" fill="#FFC93C"/><circle cx="0" cy="6.8" r="1.9" fill="#C98A0B"/><path d="M-2.7 -3.4Q-2.3 -5.1 -0.8 -5.3" stroke="#FFFFFF" stroke-opacity=".65" stroke-width="1.2" fill="none" stroke-linecap="round"/>',
    umbrella: '<path d="M0 0.6V6.8a1.9 1.9 0 0 1 -3.8 0" stroke="#5B4636" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M-8.6 1.1A8.6 8 0 0 1 8.6 1.1Q6.45 -0.8 4.3 1.1Q2.15 -0.8 0 1.1Q-2.15 -0.8 -4.3 1.1Q-6.45 -0.8 -8.6 1.1Z" fill="#FF6FA7"/><path d="M0 -6.9Q-3.5 -3 -4.3 1.1M0 -6.9Q3.5 -3 4.3 1.1" stroke="#E04F8A" stroke-width=".9" fill="none"/>',
    carrot: '<path d="M-3.6 -3.6Q0 -5.8 3.6 -3.6L0.8 8.4Q0 9.6 -0.8 8.4Z" fill="#FF8A2B"/><path d="M-1.8 -1.2H0.4M-1.2 1.8H1M-0.6 4.8H0.5" stroke="#E06F18" stroke-width="1" stroke-linecap="round"/><path d="M0 -4.3Q-3.2 -8.8 -1.5 -9.8Q0 -7.8 0 -4.3ZM0 -4.3Q0.6 -9.8 2.7 -9.4Q2.1 -6.5 0 -4.3ZM0 -4.3Q3.7 -7.1 4.8 -5.7Q2.7 -4.1 0 -4.3Z" fill="#3FA34D"/>',
    fish: '<path d="M3.4 0L9.2 -4.8V4.8Z" fill="#F27D1E"/><ellipse cx="-1.4" cy="0" rx="6.9" ry="4.6" fill="#FF9F1C"/><path d="M-1.4 -4.4Q1 -7.4 3.2 -4.1" fill="#F27D1E"/><circle cx="-4.8" cy="-1" r="1.2" fill="#1F2230"/><path d="M0.6 -2.7Q2.1 0 0.6 2.7" stroke="#F27D1E" stroke-width="1.1" fill="none"/>',
    sock: '<path d="M-2.4 -8.6H4.4V2Q4.4 7 -0.4 7.8H-6Q-8.8 7.8 -8.8 5.1Q-8.8 2.8 -6.2 2.6H-2.4Z" fill="#9B6BFF"/><path d="M-2.4 -5.4H4.4M-2.4 -2.2H4.4" stroke="#FFFFFF" stroke-width="1.6"/><path d="M-2.4 -8.6H4.4V-7.1H-2.4Z" fill="#7C4FE0"/>',
    teapot: '<path d="M5.4 -1.4Q9.6 -1.8 8.8 2.4Q8.2 5.2 5 4.6" stroke="#22BFB0" stroke-width="1.7" fill="none"/><path d="M-5.2 0.6L-9.2 -3.4L-8.1 -4.5L-4.4 -1.7Z" fill="#22BFB0"/><ellipse cx="0" cy="1.6" rx="6.6" ry="5.6" fill="#22BFB0"/><ellipse cx="0" cy="-3.8" rx="3.5" ry="1.4" fill="#159E91"/><circle cx="0" cy="-5.6" r="1.3" fill="#159E91"/><path d="M-3.8 0Q-3.2 -2.3 -1 -2.7" stroke="#FFFFFF" stroke-opacity=".5" stroke-width="1.2" fill="none" stroke-linecap="round"/>',
  };
  const KS_PATH = 'M50 126C49.3 123 47 113.3 46 108C45 102.7 42.2 99 44 94C45.8 89 56.5 83.7 57 78C57.5 72.3 46.3 66.2 47 60C47.7 53.8 61.5 47.3 61 41C60.5 34.7 45.8 27.8 44 22C42.2 16.2 48 10.7 50 6C52 1.3 55 -4 56 -6';
  function ksTree(x, y, r, dark) {
    return '<ellipse cx="' + x + '" cy="' + (y + r * 0.95) + '" rx="' + r * 1.05 + '" ry="' + r * 0.32 + '" fill="#2E6B3A" fill-opacity=".22"/>' +
      '<circle cx="' + (x - r * 0.45) + '" cy="' + (y + r * 0.1) + '" r="' + r * 0.72 + '" fill="' + (dark ? '#2F7F45' : '#3E9A55') + '"/>' +
      '<circle cx="' + (x + r * 0.45) + '" cy="' + (y + r * 0.15) + '" r="' + r * 0.7 + '" fill="' + (dark ? '#2A7340' : '#358C4D') + '"/>' +
      '<circle cx="' + x + '" cy="' + (y - r * 0.25) + '" r="' + r * 0.85 + '" fill="' + (dark ? '#3A8E50' : '#4BAE63') + '"/>' +
      '<circle cx="' + (x - r * 0.28) + '" cy="' + (y - r * 0.52) + '" r="' + r * 0.32 + '" fill="#FFFFFF" fill-opacity=".14"/>';
  }
  function ksMap(uid, lv) {
    const g = s('g', { class: 'ks-map', 'aria-hidden': 'true' });
    const tufts = [[8, 14], [30, 37], [72, 18], [93, 40], [36, 79], [70, 92], [93, 110], [26, 115], [6, 60], [74, 70], [28, 56], [66, 8]]
      .map(([x, y]) => '<path d="M' + x + ' ' + y + 'l1 -2.2l1 2.2l1 -1.6l0.8 1.6" stroke="#6DAF5A" stroke-width=".6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>').join('');
    const blooms = [[80, 99, '#FF6FA7'], [86, 104, '#FFD23F'], [92, 99, '#FFFFFF'], [83, 107, '#FF8A3D'], [90, 106, '#FF6FA7'], [95, 103, '#FFD23F'], [78, 105, '#FFFFFF']]
      .map(([x, y, c]) => '<circle cx="' + x + '" cy="' + y + '" r="1.25" fill="' + c + '"/><circle cx="' + x + '" cy="' + y + '" r=".45" fill="#B8641F"/>').join('');
    let html =
      '<defs><linearGradient id="' + uid + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B6E39A"/><stop offset="1" stop-color="#93CD78"/></linearGradient>' +
      '<clipPath id="' + uid + 'c"><rect x="0" y="0" width="100" height="120" rx="7"/></clipPath></defs>' +
      '<g clip-path="url(#' + uid + 'c)">' +
      '<rect width="100" height="120" fill="url(#' + uid + 'g)"/>' + tufts +
      // the pond, with a lily pad and reeds
      '<ellipse cx="17" cy="88.5" rx="13.5" ry="8" fill="#5DB4E0"/><ellipse cx="17" cy="88" rx="12" ry="6.6" fill="#86CFF2"/>' +
      '<path d="M9 86q3 -1.2 6 0M17 91q3 -1.2 6 0" stroke="#FFFFFF" stroke-opacity=".7" stroke-width=".7" fill="none" stroke-linecap="round"/>' +
      '<path d="M24.6 85.6a2.6 2 0 1 1 -1 -1.4l-1.6 1.4z" fill="#3E9A55"/>' +
      '<path d="M4.6 84.5q-0.6 -4 0.4 -6.4M6.4 84q0.2 -3.4 1.6 -5.4M3.2 85.4q-1.4 -3 -1 -5.2" stroke="#3E7F43" stroke-width=".8" fill="none" stroke-linecap="round"/>' +
      // the path
      '<path d="' + KS_PATH + '" stroke="#DCC28C" stroke-width="11.6" fill="none" stroke-linecap="round"/>' +
      '<path d="' + KS_PATH + '" stroke="#F2E2B6" stroke-width="10" fill="none" stroke-linecap="round"/>' +
      '<path d="' + KS_PATH + '" stroke="#E6D19F" stroke-width=".7" stroke-dasharray="1.2 5" fill="none"/>' +
      // the house
      '<ellipse cx="16" cy="36.5" rx="12" ry="2" fill="#2E6B3A" fill-opacity=".2"/>' +
      '<rect x="7" y="22" width="18" height="14" rx="1" fill="#FFF3DC"/><path d="M4.6 23.4L16 12.4L27.4 23.4Z" fill="#E06A4E" stroke="#C24F35" stroke-width=".8" stroke-linejoin="round"/>' +
      '<rect x="13.4" y="28" width="5.2" height="8" rx="2.4" fill="#8A5C3B"/><circle cx="17.2" cy="32.4" r=".5" fill="#FFD23F"/>' +
      '<rect x="8.8" y="25.2" width="3.4" height="3.4" rx=".5" fill="#86CFF2" stroke="#FFFFFF" stroke-width=".6"/><rect x="19.8" y="25.2" width="3.4" height="3.4" rx=".5" fill="#86CFF2" stroke="#FFFFFF" stroke-width=".6"/>' +
      '<rect x="20.4" y="13.4" width="2.4" height="5" fill="#B4553D"/>' +
      // the well
      '<ellipse cx="86" cy="22.5" rx="7" ry="1.6" fill="#2E6B3A" fill-opacity=".2"/>' +
      '<rect x="80" y="15" width="12" height="7" rx="1.4" fill="#B9B2A3"/><path d="M80 17.4h12M84 15v2.4M88 15v2.4M82 17.4v2.4M86 17.4v2.4M90 17.4v2.4M80 19.8h12" stroke="#968E7E" stroke-width=".5"/>' +
      '<path d="M81 15V7.6M91 15V7.6" stroke="#8A5C3B" stroke-width="1.2"/><path d="M78.6 8.6L86 4.4L93.4 8.6Z" fill="#E06A4E" stroke="#C24F35" stroke-width=".7" stroke-linejoin="round"/>' +
      '<ellipse cx="86" cy="15.2" rx="5.4" ry="1.4" fill="#2A5C7A"/>' +
      // the big tree, the other trees
      ksTree(88, 47, 9.5, false) + ksTree(33, 7, 6, true) + ksTree(7, 112, 6.5, true) + ksTree(70, 60, 4.4, false) + ksTree(95, 82, 4, true) +
      // the flower bed
      '<ellipse cx="87" cy="103" rx="11" ry="5.6" fill="#8A5C3B"/><ellipse cx="87" cy="102.4" rx="10" ry="4.8" fill="#A06E46"/>' + blooms +
      // the bench
      '<ellipse cx="79" cy="116.6" rx="7" ry="1.2" fill="#2E6B3A" fill-opacity=".22"/><rect x="72" y="110.4" width="14" height="2.4" rx=".8" fill="#B07444"/><rect x="72" y="113.4" width="14" height="1.8" rx=".7" fill="#9A6236"/>' +
      '<path d="M73.6 115.2v1.8M84.4 115.2v1.8" stroke="#5B4636" stroke-width="1"/>' +
      '</g>' +
      '<rect x=".3" y=".3" width="99.4" height="119.4" rx="6.8" fill="none" stroke="rgba(0,0,0,.14)" stroke-width=".6"/>';
    // the season: the same drawing in other colors, before it is parsed, and what only it has
    if (KS_SEASON[lv]) {
      for (const [a, b] of KS_SEASON[lv]) html = html.split(a).join(b);
      html = html.replace('</g><rect x=".3"', (KS_EXTRA[lv] || '') + '</g><rect x=".3"');
    }
    g.innerHTML = html;
    return g;
  }
  function ksStone(x, y) {
    const g = s('g', { class: 'ks-stone', transform: 'translate(' + x + ' ' + y + ')' });
    g.innerHTML = '<ellipse class="ks-glow" cx="0" cy="0.5" rx="9.6" ry="6.6"/>' +
      '<ellipse cx="0" cy="1.2" rx="7.6" ry="4.8" fill="#A79F8E"/><ellipse cx="0" cy="0" rx="7.6" ry="4.6" fill="#EEE9DE"/>' +
      '<ellipse cx="-2" cy="-1.3" rx="3.3" ry="1.4" fill="#FFFFFF" fill-opacity=".55"/>';
    return g;
  }
  function ksToken(name) {
    const g = s('g', { class: 'ks-token' });
    const body = s('g', { class: 'ks-body' });
    body.innerHTML = '<ellipse cx="0" cy="7" rx="6" ry="1.6" fill="#1F2230" fill-opacity=".22"/>' +
      '<circle class="ks-ring" r="8.3"/><circle r="7.4" fill="#FFFFFF"/><circle r="7.4" fill="none" stroke="#1F2230" stroke-opacity=".1" stroke-width=".5"/>' +
      '<g transform="scale(0.64)">' + (KS_ART[name] || '') + '</g>';
    g.append(body);
    return g;
  }
  function ksBasket() {
    const g = s('g', { class: 'ks-basket' });
    g.innerHTML = '<ellipse cx="50" cy="148.6" rx="44" ry="1.6" fill="#1F2230" fill-opacity=".18"/>' +
      '<path d="M6 128.4H94L90 146.4Q89.5 148.4 87.4 148.4H12.6Q10.5 148.4 10 146.4Z" fill="#D39A5C"/>' +
      '<path d="M7.6 133.4H92.4M8.8 138.4H91.2M10 143.4H90" stroke="#B87D43" stroke-width=".8"/>' +
      '<path d="M18 128.4V148M30 128.4V148M42 128.4V148M54 128.4V148M66 128.4V148M78 128.4V148" stroke="#C48A4E" stroke-width=".7"/>' +
      '<rect x="4.6" y="126.2" width="90.8" height="3.6" rx="1.8" fill="#B5763E"/>';
    return g;
  }
  function ksSlot(i, n) { return [50 + (i - (n - 1) / 2) * 14.8, KS_TRAY_Y]; }

  class KeepsakeCard extends Card {
    usesClock() { return false; }
    potentialStars() { return 3; }
    refresh() {}
    buildBoard() {
      const p = this.p, ST = this.G.stones;
      this.uid = 'ks' + Math.random().toString(36).slice(2, 7);
      const placed = this.run.order.length;
      this.phase = this.summary ? 'done' : this.run.studied != null ? 'recall' : 'ready';
      const svgEl = s('svg', { class: 'board keepsake', viewBox: '0 0 100 150', role: 'group', 'aria-label': 'A park with ' + p.out.length + ' stones and a basket' });
      svgEl.append(ksMap(this.uid, this.lookLv));
      this.stoneEls = {};
      for (const k of p.out) {
        const el = ksStone(ST[k][0], ST[k][1]);
        this.stoneEls[k] = el;
        svgEl.append(el);
      }
      svgEl.append(ksBasket());
      // the look's timer sits on the basket; tapping the basket ends the look early
      this.timerEl = s('g', { class: 'ks-timer', transform: 'translate(50 140)' });
      this.timerEl.innerHTML = '<circle r="5.6" fill="#FFFDF7"/><circle class="ks-pie" r="2.6" transform="rotate(-90)"/>';
      svgEl.append(this.timerEl);
      this.layer = s('g', { class: 'ks-tokens' });
      svgEl.append(this.layer);
      this.tokens = p.things.map((t, k) => {
        const el = ksToken(t.name);
        el.setAttribute('aria-label', t.name);
        el.bs = 1; el.bx = 0; el.cur = null;
        this.layer.append(el);
        return el;
      });
      svgEl.addEventListener('pointerdown', (e) => this.down(e));
      svgEl.addEventListener('pointermove', (e) => this.drag(e));
      svgEl.addEventListener('pointerup', (e) => this.up(e));
      svgEl.addEventListener('pointercancel', () => { if (this.gest && this.gest.moved) this.back(this.gest.k); this.gest = null; });
      this.svg = svgEl;
      this.goBtn = h('button', { class: 'gl-go ks-go', type: 'button', 'aria-label': 'Look' }, icon('eye'));
      this.goBtn.addEventListener('click', () => this.begin());
      this.wrap = h('div', { class: 'ks-wrap' }, svgEl, this.goBtn);
      this.area.append(this.wrap);
      this.picked = null;
      this.lay(true);
      if (this.phase !== 'ready') this.goBtn.hidden = true;
      if (placed === p.things.length && !this.summary) this.later(() => this.resolve('complete'), 0);
    }
    // where every token belongs in the current phase
    lay(instant, skip) {
      const p = this.p, ST = this.G.stones, run = this.run;
      const left = p.tray.filter((k) => run.placed[k] == null);
      p.things.forEach((t, k) => {
        if (k === skip) return;
        const el = this.tokens[k];
        el.classList.toggle('gone', this.phase === 'ready');
        let x, y;
        const at = run.at[k];
        if (this.phase === 'ready' || this.phase === 'study') { x = ST[t.stone][0]; y = ST[t.stone][1] - KS_LIFT; }
        else if (at != null) { x = ST[at][0]; y = ST[at][1] - KS_LIFT; }
        else { const q = ksSlot(left.indexOf(k), left.length); x = q[0]; y = q[1]; }
        this.setPos(k, x, y, instant);
      });
      this.timerEl.classList.toggle('on', this.phase === 'study');
    }
    // a thing's place, and its body's size and shake, all as SVG attributes
    drawTok(k) {
      const el = this.tokens[k], c = el.cur;
      if (!c) return;
      el.setAttribute('transform', 'translate(' + c[0].toFixed(2) + ' ' + c[1].toFixed(2) + ')');
      el.firstChild.setAttribute('transform', (el.bx ? 'translate(' + el.bx.toFixed(2) + ' 0) ' : '') + 'scale(' + el.bs.toFixed(3) + ')');
    }
    setPos(k, x, y, instant) {
      const el = this.tokens[k];
      el.pos = [x, y];
      if (el.mv) { el.mv.stop(); el.mv = null; }
      if (instant || !el.cur) { el.cur = [x, y]; this.drawTok(k); return; }
      const a = el.cur.slice();
      el.mv = tween(300, (f) => { const e = backOut(f, 1.2); el.cur = [a[0] + (x - a[0]) * e, a[1] + (y - a[1]) * e]; this.drawTok(k); });
    }
    scaleTo(k, sc, ms, ease) {
      const el = this.tokens[k], a = el.bs;
      if (el.sv) el.sv.stop();
      el.sv = tween(ms, (f) => { el.bs = a + (sc - a) * (ease ? ease(f) : f); this.drawTok(k); });
    }
    shake(k) {
      const el = this.tokens[k];
      if (el.sk) el.sk.stop();
      el.sk = tween(450, (f) => { el.bx = Math.sin(f * Math.PI * 6) * 1.8 * (1 - f); this.drawTok(k); }, () => { el.bx = 0; this.drawTok(k); });
    }
    // ---- the look
    begin() {
      if (this.summary || this.phase !== 'ready') return;
      Sound.unlock();
      Sound.play('look');
      this.hideHand();
      this.goBtn.classList.add('away');
      this.goBtn.disabled = true;
      this.phase = 'study';
      this.lay(true);
      this.tokens.forEach((el, k) => {
        el.classList.remove('gone');
        if (el.sv) el.sv.stop();
        el.bs = reducedMotion() ? 1 : 0;
        this.drawTok(k);
        this.later(() => this.scaleTo(k, 1, 420, (f) => backOut(f, 2.2)), k * 90);
      });
      this.studyAt = now();
      const ms = this.p.studyMs;
      const pie = this.timerEl.querySelector('.ks-pie');
      pie.style.animation = 'none';
      void pie.getBoundingClientRect();
      pie.style.animation = 'kspie ' + ms + 'ms linear forwards';
      this.studyTimer = this.later(() => this.endLook('timer'), ms + this.p.things.length * 90);
      this.log('look', { detail: 'start' });
      this.app.session.hasMoves = true;
      if (this.firstMove == null) this.firstMove = Math.round(this.elapsed());
    }
    endLook(how) {
      if (this.phase !== 'study') return;
      clearTimeout(this.studyTimer);
      this.timers.delete(this.studyTimer);
      const ms = Math.round(now() - this.studyAt);
      this.run.studied = ms;
      this.log('look', { detail: how, rt_ms: ms });
      this.phase = 'hide';
      this.timerEl.classList.remove('on');
      // into the basket, one after another, with a little hop
      const order = this.p.tray, n = order.length, ST = this.G.stones;
      order.forEach((k, i) => {
        const t = this.p.things[k], from = [ST[t.stone][0], ST[t.stone][1] - KS_LIFT], to = ksSlot(i, n);
        const el = this.tokens[k];
        const mid = [(from[0] + to[0]) / 2, Math.min(from[1], to[1]) - 14];
        this.later(() => {
          Sound.play('lift');
          if (el.mv) el.mv.stop();
          el.pos = to.slice();
          const lift = (from[1] + to[1]) / 2 - mid[1];
          el.mv = tween(520, (f) => {
            const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(2 - 2 * f, 2) / 2, arc = Math.sin(Math.PI * e);
            el.cur = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e - lift * arc];
            el.bs = 1 + 0.12 * arc;
            this.drawTok(k);
          });
        }, i * 120);
      });
      this.later(() => {
        if (this.summary) return;
        this.phase = 'recall';
        this.recallAt = now();
        this.lastPut = this.recallAt;
        this.lay(true);
        this.guide();
        this.app.touch();
      }, n * 120 + 560);
    }
    onHidden() {
      // a look cut short by leaving the page starts again from the button
      if (this.phase !== 'study') return;
      clearTimeout(this.studyTimer);
      this.timers.delete(this.studyTimer);
      this.log('interrupted', { detail: 'look, page hidden' });
      this.phase = 'ready';
      this.goBtn.hidden = false;
      this.goBtn.disabled = false;
      this.goBtn.classList.remove('away');
      this.lay(true);
    }
    abort(reason) { if (this.phase === 'study') { this.onHidden(); } }
    // ---- putting things back
    toSvg(e) {
      const m = this.svg.getScreenCTM();
      if (!m) return null;
      const pt = this.svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(m.inverse());
    }
    tokenAt(q) {
      let best = null, bd = 9.4;
      this.p.things.forEach((t, k) => {
        if (this.run.placed[k] != null) return;
        const pos = this.tokens[k].pos, d = Math.hypot(pos[0] - q.x, pos[1] - q.y);
        if (d < bd) { bd = d; best = k; }
      });
      return best;
    }
    stoneAt(q, reach) {
      let best = null, bd = reach || 10.5;
      for (const k of this.p.out) {
        const st = this.G.stones[k], d = Math.hypot(st[0] - q.x, st[1] - 1 - q.y);
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    }
    taken(s2) {
      for (const k in this.run.at) if (this.run.at[k] === s2) return true;
      return false;
    }
    down(e) {
      if (e.button > 0 || this.summary) return;
      const q = this.toSvg(e);
      if (!q) return;
      if (this.phase === 'study') {
        if (q.y > 124) { e.preventDefault(); this.endLook('early'); }
        return;
      }
      if (this.phase !== 'recall') return;
      const k = this.tokenAt(q);
      if (k != null) {
        e.preventDefault();
        Sound.unlock();
        try { this.svg.setPointerCapture(e.pointerId); } catch (x) { /* optional */ }
        this.gest = { k, id: e.pointerId, x: q.x, y: q.y, moved: false, was: this.picked };
        this.lift(k);
        return;
      }
      if (this.picked != null) {
        const s2 = this.stoneAt(q);
        if (s2 != null) { e.preventDefault(); this.put(this.picked, s2); }
      }
    }
    drag(e) {
      const g = this.gest;
      if (!g || e.pointerId !== g.id) return;
      const q = this.toSvg(e);
      if (!q) return;
      if (!g.moved && Math.hypot(q.x - g.x, q.y - g.y) < 2) return;
      g.moved = true;
      // carried just above the finger, so it stays in sight
      this.setPos(g.k, q.x, q.y - 7, true);
      const s2 = this.stoneAt({ x: q.x, y: q.y - 7 }, 11);
      for (const k of this.p.out) this.stoneEls[k].classList.toggle('over', k === s2 && !this.taken(k));
    }
    up(e) {
      const g = this.gest;
      if (!g || e.pointerId !== g.id) return;
      this.gest = null;
      for (const k of this.p.out) this.stoneEls[k].classList.remove('over');
      if (g.moved) {
        const pos = this.tokens[g.k].pos;
        const s2 = this.stoneAt({ x: pos[0], y: pos[1] }, 11);
        if (s2 != null && this.put(g.k, s2)) return;
        this.back(g.k);
        return;
      }
      // a tap: pick it up, or put it down again if it was already picked
      if (g.was === g.k) { this.back(g.k); return; }
      this.picked = g.k;
      this.guide();
    }
    lift(k) {
      if (this.picked != null && this.picked !== k) this.back(this.picked);
      this.layer.append(this.tokens[k]);
      this.tokens[k].classList.add('held');
      this.scaleTo(k, 1.18, 160);
      for (const s2 of this.p.out) this.stoneEls[s2].classList.toggle('free', !this.taken(s2));
      this.hideHand();
      Sound.play('lift');
    }
    back(k) {
      this.tokens[k].classList.remove('held');
      this.scaleTo(k, 1, 160);
      if (this.picked === k) this.picked = null;
      for (const s2 of this.p.out) this.stoneEls[s2].classList.remove('free', 'over');
      this.lay(false);
      this.later(() => this.guide(), 300);
    }
    put(k, s2) {
      if (this.taken(s2)) { this.nudge(s2); return false; }
      const show = this.o.feedback || this.practice;
      const rec = this.G.place(this.p, this.run, k, s2, show);
      if (!rec || rec.kind !== 'move') { this.nudge(s2); return false; }
      const t = now();
      this.picked = null;
      this.tokens[k].classList.remove('held');
      this.scaleTo(k, 1, 160);
      for (const x of this.p.out) this.stoneEls[x].classList.remove('free', 'over');
      const ST = this.G.stones;
      this.setPos(k, ST[s2][0], ST[s2][1] - KS_LIFT, false);
      this.c.moves++;
      if (this.firstPut == null) this.firstPut = Math.round(t - this.recallAt);
      this.log('place', {
        move_no: rec.n, target: rec.name, from: 's' + (rec.truth + 1), to: 's' + (rec.stone + 1), cls: rec.cls,
        error_dist: rec.dist, rt_ms: Math.round(t - this.lastPut),
      });
      this.lastPut = t;
      const el = this.tokens[k];
      if (show) {
        if (rec.cls === 'correct') {
          Sound.play('pop', rec.n);
          buzz(8);
          el.classList.add('ok');
          const r = this.svg.getBoundingClientRect(), L = relPos(this, this.svg), sc = r.width / 100;
          sparks(this, L.x - r.width / 2 + ST[s2][0] * sc, L.y - r.height / 2 + (ST[s2][1] - KS_LIFT) * sc, ['#FFC83A', '#FFFFFF', '#7CE3B0'], 10);
        } else {
          Sound.play('no');
          buzz([20, 40, 20]);
          el.classList.add('bad');
          this.shake(k);
          // then it moves to where it was
          this.later(() => { this.setPos(k, ST[rec.truth][0], ST[rec.truth][1] - KS_LIFT, false); this.stoneEls[rec.truth].classList.add('truth'); }, 520);
        }
      } else {
        Sound.play('set', 1);
        el.classList.add('done');
      }
      this.lay(false, k);
      this.updateStatus();
      this.app.touch();
      if (rec.done) this.later(() => this.resolve('complete'), show ? (rec.cls === 'wrong' ? 1300 : 700) : 350);
      else this.later(() => this.guide(), 420);
      return true;
    }
    nudge(s2) {
      const el = this.stoneEls[s2];
      if (!el) return;
      el.classList.remove('nope');
      void el.getBoundingClientRect();
      el.classList.add('nope');
      Sound.play('honk');
    }
    // ---- status
    goal() {
      const n = this.p.things.length, done = this.run.order.length;
      this.goalEl.textContent = '';
      this.goalEl.append(icon('basket'), h('span', { text: this.phase === 'recall' || this.phase === 'done' ? done + '/' + n : String(n) }));
      this.goalEl.setAttribute('aria-label', this.phase === 'recall' ? done + ' of ' + n + ' put back' : n + ' things');
    }
    updateStatus() {
      super.updateStatus();
      this.meterEl.hidden = true;
      this.goal();
    }
    guideTarget() {
      if (this.summary) return null;
      if (this.phase === 'ready') return this.goBtn;
      if (this.phase !== 'recall' || !this.practice) return null;
      if (this.picked != null) return this.stoneEls[this.p.things[this.picked].stone];
      const k = this.p.tray.find((x) => this.run.placed[x] == null);
      return k == null ? null : this.tokens[k];
    }
    beforeResolve() {
      clearTimeout(this.studyTimer);
      this.phase = 'done';
      this.goBtn.hidden = true;
      this.timerEl.classList.remove('on');
    }
    makeSummary(outcome, dur) {
      const d = this.G.summary(this.p, this.run);
      const complete = outcome === 'complete';
      const miss = d.n - d.correct;
      const stars = complete && !this.practice ? (miss === 0 ? 3 : miss === 1 ? 2 : 1) : 0;
      return {
        outcome,
        success: complete && !this.practice && this.G.success(this.p, d),
        duration_ms: dur, first_move_ms: this.firstPut == null ? null : this.firstPut, hidden_ms: Math.round(this.hiddenMs),
        moves: d.placed, reference: d.n, par: null, efficiency: '',
        stars, ks: d,
      };
    }
    // passed: every thing back on its own stone
    practicePassed(sm) { return sm.outcome === 'complete' && !!sm.ks && sm.ks.correct === sm.ks.n; }
    celebrate(sm) { return this.trialCelebrate(sm, CONFETTI.keepsake); }
    resultTitle(sm) {
      if (sm.outcome !== 'complete') return super.resultTitle(sm);
      if (this.practice) return sm.passed ? 'Got it!' : 'Once more';
      if (!this.o.counter) return 'Done!';
      return sm.stars === 3 ? 'Perfect!' : sm.stars === 2 ? 'Great!' : 'Done!';
    }
    resultStats(sm) {
      const d = sm.ks;
      if (!d || !d.n) return null;
      return h('div', { class: 'res-stats' },
        h('span', { 'aria-label': 'Put back in the right place' }, icon('check'), h('b', { text: d.correct + '/' + d.n })),
        d.study_ms != null ? h('span', { 'aria-label': 'Looked for ' + secs(d.study_ms) + ' seconds' }, icon('eye'), h('b', { text: secs(d.study_ms) + ' s' })) : null);
    }
    extraSnapshot() { return null; }
    onKey(e) {
      if (this.summary) return false;
      if (this.phase === 'ready' && (e.key === ' ' || e.key === 'Enter')) { this.begin(); return true; }
      if (this.phase === 'study' && (e.key === ' ' || e.key === 'Enter')) { this.endLook('early'); return true; }
      return false;
    }
  }

  function makeCard(app, spec, puzzle, snap) {
    if (spec.game === 'keepsake') return new KeepsakeCard(app, spec, puzzle, snap);
    if (spec.game === 'switchback') return new SwitchbackCard(app, spec, puzzle, snap);
    if (spec.game === 'outbound') return new OutboundCard(app, spec, puzzle, snap);
    if (spec.game === 'conduit') return new ConduitCard(app, spec, puzzle, snap);
    if (spec.game === 'glimpse') return new GlimpseCard(app, spec, puzzle, snap);
    if (spec.game === 'stacks') return new StacksCard(app, spec, puzzle, snap);
    return new TumblerCard(app, spec, puzzle, snap);
  }

  // ============================================================ export
  const EVENT_COLS = ['session_id', 'participant', 'condition', 'session_kind', 'session_seed', 'app_version', 'event_index', 'event', 'wall_time', 't_session_ms', 'seq', 'block', 'puzzle_id', 'puzzle_seed', 'game', 'level', 'adaptive', 'practice', 't_ms', 'move_no', 'target', 'from', 'to', 'd_before', 'd_after', 'cls', 'exact', 'partial', 'marks', 'cands_before', 'cands_after', 'consistent', 'info_expected', 'info_best', 'info_actual', 'best_try',
    'refresh_ms', 'frames', 'flash_ms', 'flash_measured_ms', 'frame_drop', 'fix_ms', 'mask_ms', 'shown', 'chosen', 'ring', 'dir', 'dir_chosen', 'n_distract', 'rt_center_ms', 'rt_where_ms', 'stair_next_ms', 'reversal', 'field_px', 'window_ms', 'rt_ms', 'speed_kmh', 'on_road', 'source', 'error_dist', 'detail'];
  const PUZZLE_COLS = ['session_id', 'participant', 'condition', 'session_kind', 'session_seed', 'app_version', 'seq', 'block', 'in_block', 'puzzle_id', 'puzzle_seed', 'game', 'level', 'adaptive', 'practice', 'params', 'outcome', 'success', 'stars', 'started_at', 'ended_at', 'duration_ms', 'first_move_ms', 'hidden_ms', 'moves', 'moves_total', 'reference', 'par', 'efficiency', 'n_optimal', 'n_wasted', 'n_dead_end', 'n_in_dead_end', 'n_blocked', 'n_undo', 'n_restart', 'n_hint', 'n_suboptimal', 'n_zero_info', 'n_inconsistent', 'mean_info_ratio',
    'n_correct', 'accuracy', 'threshold_ms', 'best_ms', 'reach_ms', 'start_ms', 'end_ms', 'n_reversals', 'refresh_ms', 'n_frame_drops', 'field_px',
    'n_hit', 'n_miss', 'n_false_alarm', 'n_stray', 'rt_mean_ms', 'on_road', 'n_off_road', 'speed_mean_kmh', 'speed_start_kmh', 'speed_end_kmh',
    'place', 'n_animals', 'n_shooed', 'animal_rt_mean_ms', 'brake_s', 'n_items', 'n_collected', 'study_ms', 'mean_error', 'level_next', 'features'];

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
      ['event', 'session_start, puzzle_start, move, blocked, undo, restart, hint, trial (one Glimpse look), interrupted (a Glimpse look or Switchback sign stopped before it was scored), drive (Switchback: the car starts or drives on after a pause), sign (one Switchback sign, scored when it is tapped or when its time runs out), stray (a tap on the Switchback sign button with no sign up), speed (Switchback speed change), off_road (the Switchback car left the road), beast (Switchback: the animal on the road, tapped away or braked for), fork_sign (Switchback: the arrow board of a fork comes up; detail has the arrow), fork (Switchback: the nose of the car passes the split; cls right_lane or wrong_lane, detail has the arrow and the lane taken), turn (Switchback L4 and L5: the sign of a new animal takes over halfway; target is the new animal), look (Keepsake: the look starts, then ends by timer or early with a tap on the basket), place (Keepsake: one thing put on a stone), repeat_blocked (Tumbler with feedback on: a try identical to an earlier one is not taken; detail has which; from app 2.22), hidden, visible, puzzle_end, level_change, resume, session_end'],
      ['wall_time / t_session_ms', 'clock time, and ms since the session started'],
      ['seq / block', 'puzzle number in the plan and its block; practice boards have block 0 and seq 0'],
      ['puzzle_id', 'B{block}-{game}-L{level}-{occurrence}, or P-{game} for a practice board'],
      ['practice', '1 for a practice board (fixed, the same for everyone)'],
      ['t_ms', 'ms since this puzzle appeared (Tumbler: when the try was submitted)'],
      ['move_no', 'state-changing moves so far in this puzzle, including moves later undone and moves before a restart; Glimpse: the look number in the round; Switchback: the sign number; Keepsake: things put back so far'],
      ['target', 'Outbound: car id (c1...). Conduit: tile r{row}c{col}. Tumbler: the try as letters, or pin{n}={letter} for a revealed pin. Glimpse: the thing out around the middle (bird, butterfly, star...). Stacks: p{from}>p{to}. Switchback: what was on the sign (rabbit, fox, cat, hedgehog, bird, snail, turtle, arrow, turn, P, 50, car, bang, curve, bumps). Keepsake: the thing put back'],
      ['from / to', 'Outbound: cells driven forward from the start position, or exit. Conduit: quarter turns clockwise away from the solved orientation. Stacks: posts 1 to 3 (holding 3, 2 and 1 pieces). Keepsake: the stone the thing sat on (from) and the stone it was put on (to), s1 to s12'],
      ['d_before / d_after', 'fewest moves (Outbound, Stacks) or turns (Conduit) still needed before and after; inf = can no longer be solved'],
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
      ['fix_ms / mask_ms', 'Glimpse: measured fixation time before the flash (planned 1200 to 1499: 400 to 699 seeded, plus an 800 ms lead-in) and mask time (planned 600; 300 until app 2.17). After the mask the crowd stays faintly behind the questions, which is not part of mask_ms'],
      ['shown / chosen', 'Glimpse: the item in the middle, and the one picked. Switchback (shown): the sign\'s shape: tri (red-bordered warning triangle, the target\'s shape), round_red, round_blue, square_blue'],
      ['ring / dir / dir_chosen', 'Glimpse: the bird\'s ring (1 inner to 3 outer) and direction (0 = up, clockwise in 45 degree steps), and the direction tapped'],
      ['n_distract', 'Glimpse: distractors around the target (leaves, shells or clouds, by scene)'],
      ['rt_center_ms / rt_where_ms', 'Glimpse: time to pick the animal from when the choices appeared, and to tap a place from when the spots appeared; answers are not speeded'],
      ['stair_next_ms / reversal', 'Glimpse: display time planned for the next look, and 1 if this look reversed the staircase direction. Switchback: sign time for the next sign, and reversals over targets and false alarms'],
      ['field_px', 'Glimpse: field radius in CSS pixels; degrees of visual angle depend on the screen and viewing distance'],
      ['window_ms', 'Switchback: how long the sign stayed up; a tap up to 150 ms after it went still counted'],
      ['rt_ms', 'Switchback: time from the animation frame that first drew the sign to the tap (the sign is on screen about one frame later); on a beast event, from the frame the animal stepped out to the tap. Keepsake: on a place event, time since the basket opened or since the last thing was put back; on the look event that ends a look, how long the look lasted'],
      ['speed_kmh', 'Switchback: speed when the sign came up (speed events: the new speed; beast events: the speed at the tap or the brake)'],
      ['on_road', 'Switchback: share of driving time with the car on the road while the sign was up (speed events: over the last 1.5 s)'],
      ['source', 'Switchback: what answered a sign: sign (a tap on the sign itself), button (the sign button) or key (Space, Enter, up arrow); blank when the sign was let pass. On beast events: tap (a tap on the animal) or key (H, down arrow). On stray events: what was tapped with no sign up'],
      ['error_dist', 'Keepsake: distance from the stone used to the right stone, in map units (the map is 100 wide; stones are at least 20 apart)'],
      ['detail', 'extra context: puzzle features at puzzle_start, the blocking car or the full post for blocked moves, which solution a Conduit board with more than one came out as (solution k of n, on the move that solves it), hidden time at visible, the phase of an interrupted look, the side a Switchback animal came from'],
    ],
    puzzles: [
      ['params', 'board description'],
      ['outcome', 'solved, failed, skipped, timeout, abandoned; Glimpse rounds end complete when every look is answered, Switchback drives when the car stops at the finish'],
      ['success', '1 if solved with moves <= par (drives adaptive levels); on practice rows, 1 if the practice was played right (see Practice); Glimpse: a complete round with reach_ms at or under the level\'s target. Switchback: a complete drive with reach_ms at or under the level\'s sign time and speed_mean_kmh at or over its speed (until app 2.20 both used threshold_ms, which a fresh round could miss with every answer right). Keepsake: at most one thing on the wrong stone'],
      ['stars', '3 = solved in the fewest moves, 2 = at or under par, 1 = solved, 0 = not solved. Glimpse: 3 = at most 1 miss in the round, 2 = two misses, 1 = more; every finished round earns at least 1. Switchback: 3 = at least 90% of signs right and 90% of the time on the road, 2 = 75% and 75%, 1 = finished. Keepsake: 3 = every thing on its stone, 2 = one wrong, 1 = more'],
      ['duration_ms / first_move_ms / hidden_ms', 'time on the puzzle, time to first move (Stacks: planning time before the first piece is set down), time the page was hidden'],
      ['moves', 'Outbound: car moves that changed the lot. Conduit: turns. Tumbler: tries. Stacks: pieces moved to another post (lifting a piece and putting it back is not a move). From app 2.32 Restart sets the count back to 0: moves are the ones made since the last restart, and stars, par, success and efficiency count only those (until then they counted every move on the card)'],
      ['moves_total', 'every move on the card, also those made before a restart (from app 2.32; the same as moves when there was no restart)'],
      ['reference', 'Outbound and Stacks: fewest moves. Conduit: fewest turns. Tumbler: tries used by the most-informative-try solver for this code'],
      ['par / efficiency', 'ceil(reference x multiplier); reference / moves (Tumbler can exceed 1 by luck)'],
      ['n_*', 'counts of each move label and of undo, restart, hint; blank when it does not apply to the game'],
      ['mean_info_ratio', 'Tumbler: mean of info_expected / info_best over tries'],
      ['n_correct / accuracy', 'Glimpse: looks with the animal and the place both right, and their share. Switchback: hits plus correct rejections, and their share of signs. Keepsake: things put on their own stone, and their share'],
      ['threshold_ms', 'Glimpse: geometric mean display time over the round, leaving out a fresh staircase\'s descent before its first miss; the staircase settles at about 86% correct, never below 50 ms. Switchback: the same over target signs, for how long a sign stays up'],
      ['best_ms', 'Glimpse: shortest display time answered correctly'],
      ['reach_ms', 'Glimpse: the shortest display time a correct answer brought the staircase to (the next flash, as the counter shows it). Switchback: the same for how long a sign stays up, after a caught target. At or under the level\'s target, the round is a success (from app 2.20)'],
      ['start_ms / end_ms', 'Glimpse and Switchback: staircase value at the start of the round, and the value carried to the next round'],
      ['n_reversals', 'Glimpse: staircase reversals in the round'],
      ['refresh_ms / n_frame_drops / field_px', 'Glimpse: median frame period over the round, looks flagged frame_drop, field radius in CSS pixels'],
      ['n_hit / n_miss / n_false_alarm / n_stray', 'Switchback: targets tapped in time, targets let pass, other signs tapped, taps with no sign up'],
      ['rt_mean_ms', 'Switchback: mean rt_ms over hits'],
      ['on_road / n_off_road', 'Switchback: share of driving time with the car on the road (at most a quarter of its width over the edge; the first 2 s of each drive are left out), and times it left the road'],
      ['speed_mean_kmh / speed_start_kmh / speed_end_kmh', 'Switchback: mean speed over driving time, leaving out brake_s, and the speed staircase at the start and end of the drive'],
      ['place', 'Switchback: where the drive goes; its animal is on the target sign and steps onto the road (farm: cow, savanna: elephant, fields: rabbit, desert: camel, forest: deer, jungle: monkey, coast: crab, outback: kangaroo, village: duck, north: moose)'],
      ['n_animals / n_shooed / animal_rt_mean_ms', 'Switchback: times the animal stepped onto the road, times it was tapped away before the car had to brake, and the mean rt_ms of those taps'],
      ['brake_s', 'Switchback: seconds from each animal stepping out until the car was back to 90% of its speed (the car eases off while it is there and brakes if it gets close); left out of speed_mean_kmh'],
      ['n_items / n_collected', 'Switchback: things to collect the car went past, and the ones it picked up by driving through them (not tapped; no task measure uses them)'],
      ['study_ms / mean_error', 'Keepsake: how long the look lasted, and the mean error_dist over the things put back'],
      ['level_next', 'adaptive blocks: this game\'s level for its next puzzle'],
      ['features', 'solver-derived puzzle features (JSON), such as p_random_solve, dead_end_states, search_nodes, solver_path'],
    ],
    classes: {
      outbound: 'optimal (one step closer), wasted (no closer, still solvable), dead_end (the lot can no longer be cleared), in_dead_end (a move made while already in a dead end), blocked (the car could not move; its own event)',
      conduit: 'optimal (the tile needed that turn), wasted (the tile was already right); on a board with more than one solution, turns count toward the one the tiles are nearest at that moment',
      tumbler: 'optimal (as informative as the best possible try), suboptimal (less informative), zero_info (could not narrow the codes), solved (the winning try); consistency is its own column',
      glimpse: 'correct (animal and place right; only the animal at level 1), center_wrong, where_wrong, both_wrong. With feedback on (free play), a wrong animal ends the look at once: it is logged as center_wrong with dir_chosen and rt_where_ms empty (from app 2.16)',
      stacks: 'optimal (one move closer to the goal), wasted (no closer), blocked (the post was full, or in free play the piece was not allowed there; its own event, not a move)',
      switchback: 'sign events: hit (the target, tapped in time), miss (the target, not tapped), false_alarm (another sign, tapped), correct_rejection (another sign, let pass); beast events: shooed (the animal tapped away before the car got close), braked (the car braked for it)',
      keepsake: 'place events: correct (its own stone), wrong (another stone)',
    },
    colors: 'Tumbler letters: A red (circle), B blue (square), C yellow (triangle), D green (diamond), E purple (plus), F orange (star), G teal (bar). Keys 1 to 7 enter them in order.',
  };
  function codebookMarkdown() {
    const lv = (g) => Object.keys(E.games[g].levels).map((k) => {
      const L = E.games[g].levels[k];
      if (g === 'tumbler') return '- L' + k + ': per-pin clues ' + L.pin.P + ' pins x ' + L.pin.C + ' colors, ' + L.pin.max + ' tries; count clues ' + L.count.P + ' pins x ' + L.count.C + ' colors, ' + L.count.max + ' tries';
      if (g === 'glimpse') return '- L' + k + ': ' + E.games.glimpse.describe(L) + '; ' + L.looks + ' looks a round; success at threshold_ms <= ' + L.advanceMs;
      if (g === 'stacks') return '- L' + k + ': ' + L.moves + ' moves at best, ' + (L.n || 3) + ' pieces on posts of ' + (L.caps || [3, 2, 1]).join(', ') + (L.qMax != null ? '; a goal-directed player finishes within 1.5x at most ' + Math.round(L.qMax * 100) + '% of the time' : '');
      if (g === 'keepsake') return '- L' + k + ': ' + E.games.keepsake.describe(L);
      if (g === 'switchback') return '- L' + k + ': ' + E.games.switchback.describe(L) + ', road half-width ' + L.road.half + ', bends ' + L.road.curve.join(' to ') + (L.road.s ? ', ' + Math.round(L.road.s * 100) + '% as S-bends' : '') + '; success at threshold_ms <= ' + L.advanceMs + ' and speed_mean_kmh >= ' + L.advanceKmh;
      const desc = E.games[g].describe(Object.assign({}, L, { cars: { length: L.cars } }));
      if (g === 'outbound') return '- L' + k + ': ' + desc + ', ' + (L.loops || 0) + ' pinwheel' + (L.loops === 1 ? '' : 's') + (L.dense ? ', a full lot; a sensible player clears it ' + L.qBand.map((x) => Math.round(x * 100) + '%').join(' to ') + ' of the time, in ' + L.maxOpt + ' taps at most' : '');
      return '- L' + k + ': ' + desc + (g === 'conduit' ? ', the hardest of ' + L.pick + ' board' + (L.pick === 1 ? '' : 's') + (L.multi ? '; ' + Math.round(L.multi * 100) + '% have more than one solution, local rules settling at most ' + Math.round(L.settleMax * 100) + '%' : '') : '');
    }).join('\n');
    const lines = [
      '# Puzzle Reel codebook (app ' + APP_VERSION + ', engines ' + E.version + ')', '',
      'Every puzzle comes from (session seed, block, game, level, occurrence). The same seed and plan give the same puzzles on any device. Practice boards are fixed.', '',
      '## Event columns', '',
    ].concat(CODEBOOK.events.map((r) => '- `' + r[0] + '`: ' + r[1]), ['', '## Puzzle columns', ''], CODEBOOK.puzzles.map((r) => '- `' + r[0] + '`: ' + r[1]), ['', '## Move labels (`cls`)', ''],
      Object.keys(CODEBOOK.classes).map((g) => '- ' + E.games[g].name + ': ' + CODEBOOK.classes[g]),
      ['', '## Tumbler', '', CODEBOOK.colors, 'Per-pin clues mark every pin (repeated colors are matched left to right, as in Wordle). Count clues only give the two totals. A hint reveals the leftmost pin the clues have not settled. With feedback on (free play and its practice, from app 2.22) the board helps: a color known not to be in the code cannot be picked, a color put where it is known not to be moves on to the next place where it can go, and a try identical to an earlier one is not taken, so free-play tries are assisted; with feedback off nothing changes. With per-pin clues, pins already in the right spot are filled into the next row; the player can change them. Words on the board (what the colors of a try mean, Wrong color, Not here) come in practice and at L1 only, until six codes are cracked (from app 2.29; until then at every level); from L2 the board helps without words.', '',
        '## Levels', '', 'Each level is a place with a look of its own, the same in free play and research sessions (practice keeps the first). From app 2.31 the board and its pieces belong to the place in Outbound (L1 bicycles, small cars, a cement mixer and fire engines in the town lot, L2 quad bikes, jeeps, buggies, camper vans and ice cream vans on the beach, L3 motorbikes, taxis, police cars, buses and limousines in the city at night, L4 snowmobiles, cars with skis, snowploughs and snowcats at the ski lodge, L5 bikes, cars, lorries and motorhomes on the ferry deck; from app 2.32 several kinds in each place, taken in turn so neighbours differ, and from app 2.33 each kind with an outline of its own; the kind is named in the vehicle\'s label), Conduit (L1 pots in the herb garden, L2 troughs and animals in the farmyard, L3 koi ponds and bamboo pipes in the Japanese garden, L4 palms and stone channels in the desert oasis, L5 fountains in the palace garden at night) and Tumbler (L1 rings of a bike lock, L2 magnets on a school locker, L3 the keypad of a front door, L4 the lamps of a safe, L5 gems in a vault; each color keeps its shape). Until then only the colors and the scene around the board changed in these games. From app 2.34 the scenes round the Outbound lot are seen from straight above, like the lot (roofs and tree tops, umbrellas on the sand, rooftops at night, pines in the snow, the ferry\'s bow and stern on the sea); until then they were side views. Rules, puzzles and every measure are unchanged; the look goes with the level, so it cannot be told apart from it.', '', '### Outbound', lv('outbound'), 'From engines 1.26 a vehicle is a bike taking one space (len 1, feature `bikes`) with chance `bike` (0.25) whenever it is not a truck, at every level; bikes drive like cars. L1 can be cleared by tapping only cars with a clear way out. From L2 there are pinwheels, four cars that each block the next, so one car must first slide part of the way (one at L2 and L3, two at L4 and L5). From L3 the lots are dense: the other cars stand anywhere, not only where their way out is clear, so cars hold each other up and a slide can end where it blocks for good, and each lot is chosen by how often a sensible player clears it (one who drives out any car that can leave, and only when none can, slides one at random, without undo; feature `p_sensible_solve`): 30 to 65% at L3, 15 to 42% at L4, at most 30% at L5, against 100% at L1 and L2 (from app 2.29; until then L3 to L5 were chosen by random tapping alone, `p_random_solve`, and a sensible player cleared L1 to L4 almost every time). With feedback on, L1 to L3 mark every move as it is made (optimal, wasted, dead end); L4 and L5 mark no moves and show a dead end only once no car can move, so a wrong move is found out late. `cls` is logged the same way at every level.', '', '### Conduit', lv('conduit'), 'Each level keeps, out of a number of one-solution boards (1, 3, 40, 100, 200), the one whose tiles local rules settle least (a pipe\'s turn read from the border and its neighbours; feature `forced_by_local_rules`), then the one that needs the most search: about all of the tiles at L1, 94% at L2, about half at L3, a third at L4 and L5 (from app 2.29; until then L4 and L5 compared 8 boards by search alone, and most boards at every level could be read tile by tile). Tiles start turned so that no pipe points off the board; every board needs between 0.42 and 0.5 turns per tile. At L1 and L2 a quarter of the tiles start in their solved turn and the others anywhere; from L3 the tiles that start turned wrong are almost all ones local rules do not settle, and those rules\' tiles start right, so the turns to make are the ones that need thinking. From L3 about one board in three (drawn from the seed) has more than one solution: two, now and then three or four (feature `solutions`; from app 2.30, until then every board had one). Such a board is the first one found that local rules settle at most 55%, 45% or 36% of (L3, L4, L5), about as much as the one-solution boards there, and it starts so that the solution that looks nearest is not the one with the fewest turns: one solution takes the fewest turns, at least two fewer than any other, while another looks nearer (fewer quarter turns from place counting either way, since a pipe one step past its place looks one off but takes three taps, and no more tiles out of place). Only the tiles where the solutions differ are set for this, with at most half of the board\'s turns; `decoy_extra_turns` is how many more turns the nearest-looking solution takes. On these boards `reference` is the fewest turns to any solution, `d_before` and `d_after` count turns to the nearest one at that moment, and the move that solves the board has `detail` solution k of n, where solution 1 is the one with the fewest turns from the start. If no such board turns up within its tries (rare), the card has one solution. L1 and L2 always have one: a 3x4 board practically never has two, and a 4x4 board has too few turns for the trick. Every pipe is needed: a board is rejected when all plants could get water without a leak while some pipe stays dry, so a garden in full bloom always means a solved board.', '', '### Tumbler', lv('tumbler'), '', '### Glimpse', lv('glimpse'),
        'Rings sit at 0.34, 0.62 and 0.88 of the field radius with 8, 16 and 24 positions (48 in all: the bird plus up to 47 leaves). The bird is always on one of the 8 directions. The animal is drawn 0.34 field radii wide, the bird and leaves 0.2. The level targets are game settings, not values from a study.', '',
        '## Glimpse trips', '',
        Object.keys(E.games.glimpse.themes).map((k) => { const t = E.games.glimpse.themes[k]; return '- ' + k + ': ' + t.pair.join(' or ') + ' in the middle, find the ' + t.target + ', in the way: ' + t.distractor + 's'; }).join('\n'),
        'Glimpse is a photo trip: the flash is a photo of the trip (a drawn scene with the animals in color, each with a thin light rim), the mask is the closed shutter of the lens with the pattern drawn over it, and with feedback on the photo comes back after the answers with rings round what was where and goes into an album of the round. One trip a level, the same in free play and research sessions: the meadow (L1), the pond (L2), the forest (L3), the jungle (L4), the night walk (L5); practice uses the meadow. The thing to find is the same for the whole trip and is shown before each round. Until app 2.27 the field was black shapes on a pale disc, with three scenes and things to find taking turns. The trip is in `params` and `features`; each look logs its target in `target`.', '',
        '## Glimpse timing', '',
        'A round is 4 looks at levels 1 and 2, 5 at level 3 and 6 at levels 4 and 5, so rounds grow with the level like the puzzles do. The first look starts when the player taps the camera; the rest follow on their own after the feedback. Each look: a fixation mark for 1200 to 1499 ms (400 to 699 ms, seeded, plus an 800 ms lead-in) with four focus marks closing in slowly over the first 1060 ms, so every flash is announced, then the flash, a 300 ms pattern mask, then the two answers (unspeeded). Everything shown during a look is drawn on one canvas in requestAnimationFrame callbacks, so the flash and the mask start on screen frames. The frame period is measured during each fixation.',
        'Display times come from a ladder that starts at 2000 ms and shrinks by x0.9 per step, rounded to whole frames (at 60 Hz: 120, 108, 97, 87, 79, 71, 64, 57, 52, 46, 42, 38, 34, 31, 27, 25, 22, 20, 18, 16, 15, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1 frames; until app 2.13 the ladder started at 800 ms, until app 2.6 at 500 ms). After a correct look the next is one step shorter, after a miss six steps longer (weighted up/down, settles at about 86% correct). Display times never go below 50 ms: a player who gets there moves up a level, where the task asks more, instead of chasing ever shorter flashes. A fresh staircase in a research block starts at 1500 ms, a slow and easy look for older players and non-gamers (app 2.20: 1200 ms; until app 2.13: 500 ms; until app 2.6: 300 ms), so a strong player needs about 25 correct looks to reach their own level; use carried values, or enough rounds that the first ones can be left out. In free play each level opens three steps slower than its target the first time it is played, and again after stepping back from it (1317 ms at levels 1 to 3 and 1617 ms at levels 4 and 5 at 60 Hz), so three right answers in a row reach the target (from app 2.21). A free-play round with fewer than half the looks right steps back a level (from app 2.21); research blocks never step down. Levels 4 and 5 put 8 and 16 things in the way (until app 2.21: 23, and 47 with the harder pair at level 5). A look is correct only when the animal and the place are both right. Every level asks for both, as practice does; level 1 has the thing on the inner ring, close to the middle (until app 2.20 level 1 was the middle only). A round is a success once a correct answer brings the flash to the level\'s target or under (`reach_ms`), so a good round counts even when a slip comes after (until app 2.20: `threshold_ms` at or under the target, which a fresh round could miss with every answer right).',
        'The staircase carries over between rounds of the same level for the same player: through the whole of a research session, and between visits in free play. A level without a value opens at its own starting point, three steps above its target (the free-play values are kept under a new key from app 2.21, so earlier ones start over; until app 2.25 research sessions started each block fresh and opened a new level three steps slower than the level below it ended). A carried-over round starts two steps slower than where the last one ended, so it opens with a likely hit. Practice is 3 looks at fixed times of 2000, 1200 and 700 ms; during the first flash, rings mark the animal and the bird, and a hand then shows both answers. Each question is drawn where it is asked: a "?" where the animal was, above the two choices, then the thing to find with a "?" in the middle while a light runs round the spots (from app 2.15). After an answer with feedback on, the next look follows 1.1 s later.',
        'Browsers report frame timestamps, not the moment light leaves the screen; `flash_measured_ms` checks the frame count, not photometric onset. Phones in power saving and some embedded views run at 30 frames per second, which shows up in `refresh_ms`.', '',
        '## Stacks', '', 'The tower-of-London task: pieces on three posts; a move takes the top piece of one post to another post where it is allowed. Each level asks for the arrangement on the card in a fixed fewest number of moves, which the card shows; start and goal are drawn from all arrangements with that distance. Every level is a place of its own, the same in free play and research sessions (practice: stones). L1 river stones (3 moves) and L2 suitcases at the station (5 moves): three pieces on posts that hold 3, 2 and 1 (36 arrangements). L3 containers at the harbor (6 moves): four on posts that hold 4, 3 and 2 (264 arrangements). L4 the bakery (7 moves): four layers of different sizes on three stands that hold 4, and a layer only goes on a bigger one (81 arrangements). L5 ice cream (8 moves): four scoops on three cones that hold 4 each, and nothing goes on the scoop with the cherry (181 arrangements). From L2 each board is chosen among those with that many moves by how often a goal-directed player finishes it within 1.5 times the fewest moves (one who puts pieces where they belong looking two moves ahead and never takes back its last move; 12 tries; feature `sensible_solve`): at most 75% at L2, 50% at L3, 25% at L4 and 12% at L5, so the way there needs moves that look wrong, such as taking a piece away from its place first (from app 2.29; until then 3, 4, 5, 7 and 7 moves of any board, three pieces except the cake). `features` gives the place (`theme`), `pieces`, `caps` and `twist` (`size`, `cherry` or empty); a refused move is `blocked` with `detail` saying why. Until app 2.24 research sessions kept the three-piece task at every level (6 moves at L4). `first_move_ms` is the planning time before the first move.',
        'Levels:', lv('stacks'), '',
        '## Switchback', '', 'The dual-task format of the Focus core (adaptive multitasking training, Anguera et al. 2013, ages 60 to 85). Steer a car along a winding road and tap the target sign whenever it comes up; let every other sign pass. A target can be answered on the sign itself, on the sign button (bottom right, which shows the target) or with Space; `source` says which. The car keeps moving sideways while the wheel is turned, and a bend pushes it outward, more the faster it goes (with the square of speed), so holding a bend takes steady steering. Steering: drag anywhere on the road (left or right of where the finger came down; about a fifth of the road view is full lock), or the arrow keys.',
        'Both tasks adapt as you drive. Signs: a sign stays up 1500 ms in a fresh round; each target caught makes the next one x0.9 shorter, a missed target makes it 4 steps longer and a tap on another sign 2 steps longer (settles near 80% of targets caught), never under 450 ms and always clear of the next sign or animal. Speed: every 1.5 s of driving, at least 97% of it on the road adds 3 km/h, under 85% takes 6 km/h off, within -10 to +40 km/h of the level\'s speed. Both carry over to the next drive at the same level (through a research session, between visits in free play; until app 2.25 each research block started fresh), starting two sign steps and 6 km/h easier. Signs come up just right of the road ahead, 2 to 2.8 s apart by level; the first is always a target and never more than three of a kind follow each other. Off-road time slows the car to 80%.',
        'Each level has two places at its time of day, and the seed picks one (L1 morning: farm or savanna; L2 noon: fields or desert; L3 afternoon: pine forest or jungle; L4 sunset: coast or outback; L5 dusk or night: village or the north). Each place has one animal, on its target sign and on its road (see `place`); on L4 and L5 another animal takes over halfway (see below). The drive heads for the place\'s landmark: small on the skyline where the road runs out, it comes into reach as a real place in the last seconds of the drive (placed 60 road units ahead when that is about how far the car has left to go); the car drives through the chequered finish line 8 units before it and brakes evenly to a stop 4.5 units past the line. `duration_ms` runs until the car stands still. The road, its lines, the sign shapes and the car are the same everywhere, so the animal and the scenery are a covariate within a level, logged as `place`. Practice is on the farm with the cow.',
        'Each level brings one new thing to learn, and keeps the ones before (from app 2.27; until then every level only added signs, speed and bends). L1: steer and tap the target sign. L2: the animal on the road (below). L3: the road splits. Twice a drive at L3 (once at L4 and L5) a green arrow board comes up in the split ahead with an arrow and the landmark\'s flag; about 3 s later the road has widened to two lanes and splits around a grass island, and the lane on the arrow\'s side runs on to the landmark while the other one bends away. The lane the car\'s middle is in 1 road unit past the split counts (fork event, right_lane or wrong_lane). In the wrong lane the car brakes and is steered back into the right one over about 1 s (no new sign comes up meanwhile, and that time is left out of the speed measures). No sign comes up while the board is close ahead. L4: halfway (after the middle sign) a card shows another animal\'s sign and the sign button changes to it: from then on that sign is the target and the first animal\'s sign no longer counts; 4 in 10 of the other signs after it show the first animal (turn event; coast: crab then swan; outback: kangaroo then emu (a camel until app 2.29); at L5 also farm: cow then hen; savanna: elephant then monkey; fields: rabbit then goose; desert: camel then rabbit; forest: deer then bear; jungle: monkey then elephant; village: duck then rabbit; north: moose then reindeer, where the reindeer is also one of the look-alikes before halfway; after halfway a look-alike that is now the animal to tap shows the first animal instead). The animal on the road is the one whose sign counts at the time. L5: Master. Its drives go round all ten places in turn (from app 2.28): first its own two, the village at dusk and the north at night, then the jungle, farm, coast, forest, desert, savanna, outback and fields, and round again, everything learned on the way switched on (`place` says where; the other signs are other animals of each place, look-alikes where it has them: farm deer, moose, hen; savanna cow, ostrich, monkey; fields cat, fox, hedgehog; desert deer, fox, turtle; forest reindeer, moose, fox; jungle cat, bear, bird; coast turtle, shell, fish; outback rabbit, fox, emu; village goose, swan, hen; north reindeer, deer, bear; until app 2.29 some places had camels and kangaroos where they do not belong). Where the tour stands is kept on the device in free play (`pr1.sbtour`) and per session in a research session, which starts with the village; the generator gets the place, so a Master drive is its seed and its place (the seed\'s own pick of village or north is still drawn and then set aside, so sign times, the road, the animals and the forks do not depend on the place). Until app 2.28 every Master drive was the village or the north, from the seed. In the village and the north (the drives at dusk and night, with the headlights on) each sign comes out of the dark and lights up over its first 0.38 s; its time up and the reaction time count from when it appears (until app 2.29 it stood dark for 0.38 s first, and the time counted from when it lit up). The first time a player meets something new (on this device), it comes with a short demo: the first animal on the road stops the car short of it and waits for a tap with a hand and a word (the beast event says so; the drive clock stands still meanwhile), the first fork is driven at three quarters of the speed with a word about the arrow and a word after it, and the first sign at night comes with a word. The halfway card is its own demo. Events between two signs never come before the third sign or after the last but one: the board at halfway has a slot of its own (the next sign 3.2 s after it), a fork 4.6 s, an animal 3 s.',
        'The animal on the road and the things to collect are additions to the published format. The animal steps onto the road ahead between two signs (twice a drive from L2; never at L1 or in practice), in a slot of its own: the next sign comes 3 s after it steps out, and the sign before it is always gone first. It walks to the middle of the road and stands there; the car eases off to 45% of its speed meanwhile. A tap on it (or H) sends it off with a toot (beast event, shooed, with rt_ms); if the car gets within about 4 road units first, the car brakes hard and the animal moves on by itself (beast event, braked). An animal on the road when a drive is paused does not count (interrupted event). Things to collect float over the road in rows of 3 to 5, one kind per place; steering through them picks them up. They are counted, never tapped, and no task measure uses them.',
        'With feedback on, a caught target\'s animal comes off the sign and runs or hops into the field for about 1 s after the tap; with feedback off a tap only gives a soft click. The horn toots when an animal is tapped away whatever the feedback setting, and things collected fly to a counter shown when counters are on.',
        'Levels:', lv('switchback'),
        '## Keepsake', '', 'Object-location memory (the Memory Path format of the concept paper). One park map, always the same, so its landmarks can be learned: a house, a pond, a big tree, a well, a flower bed and a bench along a winding path, with twelve stones placed by hand beside them (at least 20 map units apart on a 100 x 120 map). Each card brings some stones out and puts things on a few of them (the things: ' + E.games.keepsake.items.join(', ') + '). A tap on the eye starts the look; the things pop up on their stones and a timer runs on the basket below; a tap on the basket ends the look early (logged). Then the things hop into the basket, in tray order, which takes about a second, and the player puts each back: drag it onto a stone, or tap it and then a stone. Each thing gets one try and a stone holds one thing. With feedback on, a thing put on the right stone turns green; one put on a wrong stone turns red and then moves to its own stone, which frees the stone it was put on. With feedback off, every thing stays where it was put and nothing is shown. The card ends when every thing is back.',
        'Levels:', lv('keepsake'), '',
        'Other signs by level: L1 blue round and square signs (nothing in common with the target), L2 red-and-white round signs, L3 warning triangles with symbols (!, bend, bumps), L4 triangles with other animals (bird, snail, turtle), L5 triangles with look-alikes of the place\'s animal (village: goose, swan, hen; north: reindeer, deer, bear). Until app 2.10 the target was a rabbit, fox or cat drawn from the seed in every place; from 2.10 it is the place\'s animal.', '',
        '## Taps per card', '', 'Levels follow one ladder of effort across the games. The fewest taps that finish a card (Outbound: solver moves; Conduit: needed turns; Tumbler: taps along the most informative tries, with right-spot pins carried over; Glimpse: one tap to start and one per answer; Stacks: two per move, lift and set down; Switchback: one tap to start, one per target sign and one per animal on the road, steering and collecting not counted; Keepsake: one tap to look, then two per thing, pick up and put down) average about 5 to 7 at L1, 7 to 9 at L2, 9 to 11 at L3, 11 to 13 at L4 and 13 to 15 at L5 (Switchback runs about one higher from L2, with its animals: 6, 10, 12, 14, 16). Count clues take one or two taps more than per-pin clues at the same level. Thinking time is not in these numbers: compare `duration_ms` by game and level in pilot data.', '',
        '## Practice', '', 'Each game opens with a practice card (puzzle id P-{game}, fixed content, level 0). It has to be played right before the game goes on: a puzzle solved; Glimpse with at most one look wrong; Switchback with every target caught and no other sign tapped; Keepsake with every thing on its own stone. Otherwise the result says Once more and the same practice comes round again, up to three tries; after the third the game goes on regardless. Practice rows log `success` as that pass (1 or 0) and never change a level. A new player\'s first card after practice is level 1. Rounds of the trial games (Glimpse, Switchback, Keepsake) get confetti only at three stars or a passed practice; two stars get the win chime without confetti, and fewer a soft note.', '',
        '## Adaptive blocks', '', 'Per game within a block, the same in research sessions and free play: one level up per success until the first miss in that game (in the session; in free play, ever on the device), then two successes in a row move up one level; one miss moves down one level (levels 1 to 5). A success is a solve with `moves <= par`, where par = ceil(reference x par multiplier). Switchback never moves down a level, and Glimpse only after a round with fewer than half the looks right: their display time, sign time and speed already adapt as you play. Until app 2.25 research sessions always needed two in a row and Glimpse never moved down there. In free play the run of successes toward the next level carries over to the next visit, so the first card of a new free session can move a level up. A skipped card is never a miss: the level stays where it was, and in a research block the skipped card still uses up its place in the block. Skip goes straight to the next card with no result panel, on one tap. Research sessions start with the same options as free play (stars, hints, feedback, skip and sound on; until app 2.26 they were off) and show the same records, level-up screen and way to the next level in adaptive blocks; records and the levels reached are kept on the device, shared with free play.', '']);
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

  // ---------------------------------------------------------- profile
  // The concept paper's five areas, each with the games that belong to it.
  // Game stats stay game stats: nothing here scores an area.
  const AREAS = [
    { name: 'Reaction', games: ['glimpse'] },
    { name: 'Memory', games: ['keepsake'] },
    { name: 'Patterns', games: ['tumbler'] },
    { name: 'Problem solving', games: ['stacks', 'outbound', 'conduit'] },
    { name: 'Focus', games: ['switchback'] },
  ];
  const LEVEL_NAMES = ['Beginner', 'Advanced', 'Pro', 'Expert', 'Master'];
  // per-game stats from free play on this device, the last rounds of each game
  // in its own terms (for the curve in the profile), and the days played
  const HIST_N = 24;
  const localDay = (iso) => {
    const t = new Date(iso);
    if (isNaN(t.getTime())) return null;
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  };
  const Stats = {
    blank() { return { cards: 0, solved: 0, perfect: 0, stars: 0, ms: 0, top: 0, tries: 0, plan: 0, planN: 0 }; },
    add(all, r) {
      const t = all[r.game] || (all[r.game] = this.blank());
      t.cards++;
      if (r.outcome === 'solved' || r.outcome === 'complete') t.solved++;
      if (r.stars === 3) t.perfect++;
      t.stars += r.stars || 0;
      t.ms += r.duration_ms || 0;
      t.top = Math.max(t.top, r.level || 0, Number(r.level_next) || 0);
      if (r.game === 'tumbler' && r.outcome === 'solved') t.tries += r.moves || 0;
      if (r.game === 'stacks' && r.outcome === 'solved' && r.first_move_ms !== '' && r.first_move_ms != null) { t.plan += Number(r.first_move_ms); t.planN++; }
      if (r.game === 'switchback' && r.outcome === 'complete' && Number(r.speed_mean_kmh) > 0) t.kmh = Math.max(t.kmh || 0, Math.round(Number(r.speed_mean_kmh)));
    },
    // one round as the profile draws it: level, success, stars, and the game's own
    // figures (Glimpse flash; Switchback sign time and speed; Keepsake things right;
    // the puzzles' moves against the fewest). A skip says nothing, so it is left out.
    keep(hist, r) {
      if (r.outcome === 'skipped') return;
      const e = { lv: Number(r.level) || 1, ok: Number(r.success) ? 1 : 0, st: Number(r.stars) || 0 };
      if (r.game === 'glimpse' || r.game === 'switchback') {
        // how far the round got (from app 2.20; before that, its threshold)
        const v = r.reach_ms !== '' && r.reach_ms != null ? r.reach_ms : r.threshold_ms;
        if (v === '' || v == null) return;
        e.ms = Number(v);
        if (r.game === 'switchback') e.kmh = Number(r.speed_mean_kmh) || 0;
      } else if (r.game === 'keepsake') {
        e.n = Number(r.reference) || 0;
        e.c = Number(r.n_correct) || 0;
      } else {
        e.m = Number(r.moves) || 0;
        if (r.reference !== '' && r.reference != null) e.ref = Number(r.reference);
      }
      const list = hist[r.game] || (hist[r.game] = []);
      list.push(e);
      if (list.length > HIST_N) list.splice(0, list.length - HIST_N);
    },
    day(days, r) {
      const d = localDay(r.ended_at);
      if (d && days.indexOf(d) < 0) days.push(d);
    },
    // the first time, each part is built from the free play still logged on this device
    load(app) {
      let all = store.get('pr1.gstats', null), hist = store.get('pr1.ghist', null), days = store.get('pr1.days', null);
      const fresh = { all: !all, hist: !hist, days: !days };
      if (fresh.all || fresh.hist || fresh.days) {
        const a = {}, hs = {}, ds = [], cur = app.session;
        const list = Sessions.all().filter((S) => S.kind === 'free' && (!cur || S.id !== cur.id)).sort((x, y) => (x.startedAt < y.startedAt ? -1 : 1));
        if (cur && cur.kind === 'free') list.push(cur);
        for (const S of list) for (const r of S.puzzles) if (!Number(r.practice) && r.outcome !== 'abandoned') { this.add(a, r); this.keep(hs, r); this.day(ds, r); }
        if (fresh.all) store.set('pr1.gstats', (all = a));
        if (fresh.hist) store.set('pr1.ghist', (hist = hs));
        if (fresh.days) store.set('pr1.days', (days = ds));
      }
      return { all, hist, days, fresh };
    },
    record(app, r) {
      const st = this.load(app);
      if (!st.fresh.all) { this.add(st.all, r); store.set('pr1.gstats', st.all); }
      if (!st.fresh.hist) { this.keep(st.hist, r); store.set('pr1.ghist', st.hist); }
      if (!st.fresh.days) { this.day(st.days, r); store.set('pr1.days', st.days); }
    },
  };
  // a small picture of each game's world, 80 x 60
  // each drawing gets its own clip id: the same game can be on screen twice
  let mwSeq = 0;
  function miniWorld(g) {
    const svg = s('svg', { class: 'pf-art', viewBox: '0 0 80 60', 'aria-hidden': 'true' }), cid = 'mw' + (++mwSeq);
    const car = (x, y, a, c) => s('g', { transform: 'translate(' + x + ' ' + y + ') rotate(' + a + ')' },
      s('rect', { x: -5, y: -9, width: 10, height: 18, rx: 3.4, fill: c }),
      s('path', { d: 'M-3.6 -4.6L-3 -7H3L3.6 -4.6Z', fill: '#24334A' }),
      s('rect', { x: -3.6, y: -3.6, width: 7.2, height: 6.4, rx: 1.4, fill: 'rgba(0,0,0,.12)' }));
    if (g === 'outbound') {
      svg.append(s('rect', { x: 8, y: 6, width: 64, height: 48, rx: 7, fill: '#3E434E' }),
        s('path', { d: 'M29.3 9V51M50.6 9V51', stroke: 'rgba(255,255,255,.14)', 'stroke-width': 0.8 }),
        car(19, 20, 0, '#F2564D'), car(40, 33, 90, '#3D8BFD'), car(61, 37, 0, '#FFC93C'), car(19, 41, 180, '#22BFB0'));
    } else if (g === 'conduit') {
      svg.append(s('rect', { x: 10, y: 6, width: 60, height: 48, rx: 7, fill: '#6A4628' }));
      for (const [x, y] of [[13, 9], [40.5, 9], [13, 31.5], [40.5, 31.5]]) svg.append(s('rect', { x, y, width: 26.5, height: 20, rx: 4, fill: '#84603B' }));
      svg.append(s('path', { d: 'M26 41V19H54V41', stroke: '#2E9CF2', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        s('circle', { cx: 26, cy: 41, r: 5.4, fill: '#FFFFFF' }), s('circle', { cx: 26, cy: 41, r: 3.4, fill: '#2E9CF2' }));
      for (let k = 0; k < 5; k++) { const a = (Math.PI * 2 * k) / 5 - Math.PI / 2; svg.append(s('circle', { cx: 54 + Math.cos(a) * 3, cy: 38 + Math.sin(a) * 3, r: 2.4, fill: '#FF6FA7' })); }
      svg.append(s('circle', { cx: 54, cy: 38, r: 1.8, fill: '#FFD23F' }));
    } else if (g === 'tumbler') {
      svg.append(s('rect', { x: 10, y: 8, width: 60, height: 44, rx: 9, fill: '#2B2160' }),
        s('rect', { x: 15, y: 20, width: 50, height: 16, rx: 8, fill: 'rgba(255,255,255,.1)' }));
      [['#F04E5E', PEGS[0].glyph], ['#3A7BFF', PEGS[1].glyph], ['#FFCB2E', PEGS[2].glyph]].forEach(([c, gl], i) => {
        const x = 27 + i * 13;
        svg.append(s('circle', { cx: x, cy: 28, r: 5.6, fill: c }), s('path', { d: gl, fill: i === 2 ? '#3A2A00' : '#FFFFFF', transform: 'translate(' + (x - 4) + ' 24) scale(0.5)' }));
      });
      for (let i = 0; i < 6; i++) svg.append(s('circle', { cx: 25 + i * 6, cy: 44, r: 1.6, fill: i < 4 ? '#FFC83A' : 'rgba(255,255,255,.25)' }));
    } else if (g === 'glimpse') {
      svg.append(s('circle', { cx: 40, cy: 30, r: 25, fill: '#F7FBF2' }),
        s('circle', { cx: 40, cy: 30, r: 17, fill: 'none', stroke: 'rgba(24,41,31,.12)', 'stroke-width': 0.8 }),
        s('g', { transform: 'translate(31 21) scale(0.18)' }, s('path', { d: GL_PATHS.rabbit, fill: '#18291F' })),
        s('g', { transform: 'translate(51 8) scale(0.1)' }, s('path', { d: GL_PATHS.bird, fill: '#3D8BFD' })));
    } else if (g === 'stacks') {
      svg.append(s('clipPath', { id: cid }, s('rect', { x: 6, y: 3, width: 68, height: 54, rx: 9 })),
        s('g', { 'clip-path': 'url(#' + cid + ')' }, s('rect', { x: 0, y: 0, width: 80, height: 60, fill: '#8CCBD8' }), s('path', { d: 'M0 44C16 40 30 47 48 43S70 40 80 42V60H0Z', fill: '#EAD8B2' })),
        s('rect', { x: 38.5, y: 10, width: 3, height: 40, rx: 1.2, fill: '#8A5C3B' }));
      [['#6F90C2', 46], ['#C9654C', 37], ['#6E9F5D', 28]].forEach(([c, y]) => svg.append(
        s('path', { d: 'M27 ' + y + 'C26.8 ' + (y - 3.8) + ' 32 ' + (y - 6) + ' 40 ' + (y - 6) + 'C48 ' + (y - 6) + ' 53.2 ' + (y - 3.6) + ' 53 ' + y + 'C52.8 ' + (y + 3.6) + ' 47.6 ' + (y + 5.4) + ' 40 ' + (y + 5.4) + 'C32.4 ' + (y + 5.4) + ' 27.2 ' + (y + 3.6) + ' 27 ' + y + 'Z', fill: c }),
        s('ellipse', { cx: 35.5, cy: y - 3, rx: 3.6, ry: 1, fill: '#FFFFFF', opacity: 0.3 })));
      svg.append(s('rect', { x: 38.5, y: 10, width: 3, height: 9, rx: 1.2, fill: '#8A5C3B' }));
    } else if (g === 'keepsake') {
      svg.append(s('clipPath', { id: cid }, s('rect', { x: 6, y: 3, width: 68, height: 54, rx: 9 })),
        s('g', { 'clip-path': 'url(#' + cid + ')' },
          s('rect', { x: 0, y: 0, width: 80, height: 60, fill: '#A9DC8E' }),
          s('path', { d: 'M44 62C40 50 30 46 36 36S52 24 46 -2', stroke: '#F2E2B6', 'stroke-width': 9, fill: 'none' }),
          s('ellipse', { cx: 18, cy: 44, rx: 10, ry: 6, fill: '#86CFF2' }),
          s('rect', { x: 12, y: 13, width: 13, height: 10, rx: 1, fill: '#FFF3DC' }), s('path', { d: 'M10 14L18.5 6L27 14Z', fill: '#E06A4E' })),
        s('ellipse', { cx: 58, cy: 40.8, rx: 6.4, ry: 4, fill: '#A79F8E' }), s('ellipse', { cx: 58, cy: 40, rx: 6.4, ry: 3.8, fill: '#EEE9DE' }),
        s('circle', { cx: 58, cy: 36.6, r: 6.2, fill: '#FFFFFF' }),
        s('path', { d: 'M58 33.6C59.8 32.3 62 33.6 62 36.1C62 38.8 60.1 40.5 58 40C55.9 40.5 54 38.8 54 36.1C54 33.6 56.2 32.3 58 33.6Z', fill: '#E8463D' }),
        s('ellipse', { cx: 36, cy: 30.6, rx: 5.6, ry: 3.4, fill: '#A79F8E' }), s('ellipse', { cx: 36, cy: 30, rx: 5.6, ry: 3.2, fill: '#EEE9DE' }));
    } else if (g === 'switchback') {
      svg.append(s('clipPath', { id: cid }, s('rect', { x: 6, y: 3, width: 68, height: 54, rx: 9 })),
        s('g', { 'clip-path': 'url(#' + cid + ')' },
          s('rect', { x: 0, y: 0, width: 80, height: 60, fill: '#BCDDF7' }),
          s('path', { d: 'M0 25C12 19 24 23 38 20S64 17 80 22V60H0Z', fill: '#A9BFDB' }),
          s('path', { d: 'M0 27C18 24 30 27 46 25S68 24 80 26V60H0Z', fill: '#95D17F' }),
          s('path', { d: 'M37.5 26H42.5L70 60H10Z', fill: '#737886' }),
          s('path', { d: 'M40 29V32M40 36.5V41M40 46.5V53', stroke: '#F8F3E6', 'stroke-width': 1.4 })),
        s('rect', { x: 55.3, y: 19, width: 1.4, height: 8, fill: '#8E96A3' }),
        s('path', { d: 'M56 8.5L62.6 19.8H49.4Z', fill: '#FFFFFF', stroke: '#E23B36', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }),
        s('ellipse', { cx: 40, cy: 54.5, rx: 11, ry: 1.6, fill: 'rgba(20,24,40,.25)' }),
        s('path', { d: 'M33 46L35.2 40.6Q35.6 39.6 36.8 39.6H43.2Q44.4 39.6 44.8 40.6L47 46Z', fill: '#C8423A' }),
        s('rect', { x: 30, y: 45, width: 20, height: 8.2, rx: 2.6, fill: '#E5564D' }),
        s('rect', { x: 31.4, y: 47, width: 3.6, height: 1.9, rx: 0.9, fill: '#FFD98A' }),
        s('rect', { x: 45, y: 47, width: 3.6, height: 1.9, rx: 0.9, fill: '#FFD98A' }));
    }
    return svg;
  }

  // What each level brings, in the game's own terms: for the level-up moment and the profile.
  // Read from the games' settings, so it says what the game does.
  const SB_PLACE_NAME = { north: 'far north' };
  const SB_NEW = { animals: 'animals walk onto the road', forks: 'the road splits', turn: 'a new animal halfway', night: 'a drive at night' };
  function levelAdds(g, lv) {
    const G = E.games[g], L = G && G.levels && G.levels[lv];
    if (!L) return '';
    const at = (t) => t + ' · ' + lookName(g, lv);
    if (g === 'outbound') return at(L.cars + ' cars · ' + L.w + '×' + L.h + ' lot');
    if (g === 'conduit') return at(L.w + '×' + L.h + ' beds');
    if (g === 'tumbler') return at(L.pin.P + ' hidden colors out of ' + L.pin.C);
    if (g === 'stacks') {
      const noun = { harbor: 'containers', cake: 'layers', icecream: 'scoops' }[L.theme] || 'pieces';
      return at(L.moves + ' moves' + (L.n ? ' · ' + L.n + ' ' + noun : '') + (L.cherry != null ? ' · the cherry stays on top' : L.size ? ' · small goes on big' : ''));
    }
    if (g === 'keepsake') return at(L.items + ' things to remember');
    if (g === 'switchback') {
      const where = L.places.map((x) => SB_PLACE_NAME[x] || x).join(L.tour ? ' and ' : ' or ');
      return L.tour ? where + ' at night · then every place in turn' : where + ' · ' + (SB_NEW[L.new] || 'tap your animal\'s sign');
    }
    if (g === 'glimpse') return at(['', 'the bird, close by', 'the dragonfly, further out', 'the owl, near or far', 'the parrot among leaves', 'the bat among moths'][lv] || '');
    return '';
  }
  // Free play: how far a game is toward its next level. Two good cards in a row
  // move it up (one, until the first miss in that game); the run so far is kept
  // between visits.
  function levelProgress(g) {
    const lv = Math.max(1, Math.min(5, store.get('pr1.levels', {})[g] || 1));
    const need = store.get('pr1.settled', {})[g] ? 2 : 1;
    const have = lv >= 5 ? 0 : Math.max(0, Math.min(need - 1, Number(store.get('pr1.lvrun', {})[g]) || 0));
    return { lv, need, have };
  }
  const pfNoun = (g, n) => (g === 'glimpse' ? ['round', 'rounds'] : g === 'switchback' ? ['drive', 'drives'] : ['card', 'cards'])[n === 1 ? 0 : 1];
  const secs = (ms) => String(Math.round(ms / 10) / 100);
  const pct = (x) => (Math.max(0, Math.min(1, x)) * 100).toFixed(1) + '%';
  // what a good card is at this level, in the game's own terms (text: for screen readers)
  function pfGoal(g, lv) {
    if (g === 'glimpse') {
      const ms = E.games.glimpse.levels[lv].advanceMs;
      return { chips: [['camera', secs(ms) + ' s']], text: 'a photo of ' + secs(ms) + ' s or faster' };
    }
    if (g === 'switchback') {
      const L = E.games.switchback.levels[lv];
      return { chips: [['sign', secs(L.advanceMs) + ' s'], ['gauge', L.advanceKmh + ' km/h']], text: 'signs up ' + secs(L.advanceMs) + ' s or less, at ' + L.advanceKmh + ' km/h or more' };
    }
    return { stars: true, text: 'two or three stars' };
  }
  // five steps from Beginner to Master: the ones reached, the next one filling
  // up, and (for games that can step back) how high this player has been
  function pfLadder(P, best, cls) {
    const el = h('div', { class: 'pf-ladder' + (cls ? ' ' + cls : ''), role: 'img', 'aria-label': 'Level ' + P.lv + ' of 5, ' + LEVEL_NAMES[P.lv - 1] + (best > P.lv ? ', best ' + LEVEL_NAMES[best - 1] : '') });
    for (let i = 1; i <= 5; i++) {
      const seg = h('i', { class: i <= P.lv ? 'on' : i <= best ? 'been' : '' });
      if (i === P.lv + 1 && P.have) seg.append(h('b', { style: 'width:' + pct(P.have / P.need) }));
      el.append(seg);
    }
    return el;
  }
  // the next level: the good cards it takes as slots that fill, what a good
  // card is, and a way straight into the game
  function pfNext(g, P, play) {
    const go = h('button', { class: 'pf-play', type: 'button', onclick: play }, icon('play'), 'Play');
    if (P.lv >= 5) return h('div', { class: 'pf-next top' }, h('div', { class: 'pf-next-top' }, icon('star', 'pf-crown'), h('b', { text: 'Master' }), go));
    const goal = pfGoal(g, P.lv);
    const slots = h('span', { class: 'pf-slots', 'aria-hidden': 'true' });
    for (let i = 0; i < P.need; i++) slots.append(h('i', { class: i < P.have ? 'on' : '' }, i < P.have ? icon('check') : null));
    const chips = h('span', { class: 'pf-chips' });
    if (goal.stars) chips.append(h('span', { class: 'pf-chip stars', 'aria-hidden': 'true' }, icon('star'), icon('star')));
    else goal.chips.forEach(([ico, t]) => chips.append(h('span', { class: 'pf-chip' }, icon(ico), t)));
    const left = P.need - P.have;
    const say = (left === 1 ? (P.have ? 'One more ' : 'One ') + pfNoun(g, 1) : 'Two ' + pfNoun(g, 2) + ' in a row') + ' with ' + goal.text;
    return h('div', { class: 'pf-next' },
      h('div', { class: 'pf-next-top' }, h('span', { class: 'pf-next-k', text: 'Next' }), h('b', { text: LEVEL_NAMES[P.lv] }), go),
      h('p', { class: 'pf-next-adds', text: levelAdds(g, P.lv + 1) }),
      h('div', { class: 'pf-next-row', role: 'img', 'aria-label': say }, slots, chips));
  }
  // all five levels and what each brings: done, here, and what lies ahead
  function pfLevels(g, P, best) {
    const el = h('ol', { class: 'pf-levels', 'aria-label': 'Levels' });
    for (let k = 1; k <= 5; k++) {
      el.append(h('li', { class: k < P.lv ? 'done' : k === P.lv ? 'now' : k <= best ? 'been' : '' },
        h('i', { 'aria-hidden': 'true' }, k < P.lv ? icon('check') : null),
        h('b', { text: LEVEL_NAMES[k - 1] }), h('span', { text: levelAdds(g, k) })));
    }
    return el;
  }
  // first two against last two rounds at this level, shown only when it is a real gain
  function pfRise(H, lv, f, better, min) {
    const at = H.filter((e) => e.lv === lv);
    if (at.length < 4) return null;
    const a = (f(at[0]) + f(at[1])) / 2, b = (f(at[at.length - 2]) + f(at[at.length - 1])) / 2;
    const d = (b - a) * better;
    if (!(d >= min) || d / Math.abs(a || 1) < 0.06) return null;
    return { d, k: at.length };
  }
  // The player's own curve: the last twelve rounds of one game, newest on the
  // right. Glimpse and Switchback draw each round against the goal its level
  // had (bars that met it in the game's color); the puzzles show each card's
  // stars, Keepsake the things put back on the right stone. Tap a round to read it.
  const PF_COLS = 12;
  function pfCurve(g, all, lv) {
    const H = all.slice(-PF_COLS), pad = PF_COLS - H.length;
    const fig = h('figure', { class: 'pf-curve' }), cols = [], rows = [];
    const select = (i) => {
      cols.forEach((list, k) => list.forEach((c) => c.classList.toggle('sel', k === i)));
      rows.forEach((r) => { r.v.textContent = r.say(H[i]); });
    };
    const plot = (cls, build, style) => {
      const el = h('div', { class: 'pf-plot ' + cls, style: style || null });
      for (let k = 0; k < pad; k++) el.append(h('i', { class: 'pf-col empty' }));
      H.forEach((e, i) => {
        const c = h('i', { class: 'pf-col', style: '--d:' + (i * 35) + 'ms' });
        build(c, e);
        c.addEventListener('click', () => select(i));
        (cols[i] || (cols[i] = [])).push(c);
        el.append(c);
      });
      return el;
    };
    // a bar per round and a notch at the goal that round had
    const bars = (value, goal, good) => {
      const top = Math.max(...H.map((e) => Math.max(value(e), goal(e)))) * 1.12;
      return plot('bars', (c, e) => {
        if (good(e)) c.classList.add('ok');
        c.append(h('b', { class: 'pf-bar', style: 'height:' + pct(value(e) / top) }), h('u', { class: 'pf-tick', style: 'bottom:' + pct(goal(e) / top) }));
      });
    };
    // gain: how much better the last rounds are than the first ones at this level
    const row = (ico, title, el, say, label, gain) => {
      const v = h('b', { class: 'pf-val' });
      rows.push({ v, say });
      fig.append(h('div', { class: 'pf-cap' }, icon(ico), h('span', { text: title }),
        gain ? h('span', { class: 'pf-up', role: 'img', 'aria-label': gain[1] }, icon('rise'), gain[0]) : null, v), el);
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', label);
    };
    const list = (f) => H.map(f).join(', ');
    if (g === 'glimpse') {
      const goal = (e) => E.games.glimpse.levels[e.lv].advanceMs;
      const r = pfRise(all, lv, (e) => e.ms, -1, 8);
      row('bolt', 'Flash', bars((e) => e.ms, goal, (e) => e.ms <= goal(e) + 0.5), (e) => secs(e.ms) + ' s',
        'Flash in your last ' + H.length + ' rounds, in seconds: ' + list((e) => secs(e.ms)),
        r && [secs(r.d) + ' s', 'Flash ' + secs(r.d) + ' s shorter over your last ' + r.k + ' rounds']);
    } else if (g === 'switchback') {
      const L = (e) => E.games.switchback.levels[e.lv];
      const rs = pfRise(all, lv, (e) => e.ms, -1, 60), rk = pfRise(all, lv, (e) => e.kmh, 1, 3);
      row('sign', 'Sign time', bars((e) => e.ms, (e) => L(e).advanceMs, (e) => e.ms <= L(e).advanceMs), (e) => secs(e.ms) + ' s',
        'How long signs stayed up in your last ' + H.length + ' drives, in seconds: ' + list((e) => secs(e.ms)),
        rs && [secs(rs.d) + ' s', 'Signs ' + secs(rs.d) + ' s shorter over your last ' + rs.k + ' drives']);
      row('gauge', 'Speed', bars((e) => e.kmh, (e) => L(e).advanceKmh, (e) => e.kmh >= L(e).advanceKmh), (e) => Math.round(e.kmh) + ' km/h',
        'Speed in your last ' + H.length + ' drives, in km/h: ' + list((e) => Math.round(e.kmh)),
        rk && [Math.round(rk.d) + ' km/h', Math.round(rk.d) + ' km/h faster over your last ' + rk.k + ' drives']);
    } else if (g === 'keepsake') {
      const most = Math.max(...H.map((e) => e.n));
      row('basket', 'Put back right', plot('dots', (c, e) => {
        if (e.n - e.c <= 1) c.classList.add('ok');
        for (let k = 0; k < e.n; k++) c.append(h('b', { class: k < e.c ? 'on' : '' }));
      }, '--rows:' + most), (e) => e.c + ' of ' + e.n,
      'Things put back on the right stone in your last ' + H.length + ' cards: ' + list((e) => e.c + ' of ' + e.n));
    } else {
      const unit = g === 'tumbler' ? ['try', 'tries'] : g === 'conduit' ? ['turn', 'turns'] : ['move', 'moves'];
      const ref = g === 'tumbler' ? 'aim ' : 'fewest ';
      row('star', 'Stars', plot('stars', (c, e) => {
        if (e.st >= 2) c.classList.add('ok');
        for (let k = 0; k < 3; k++) c.append(icon('star', k < e.st ? 'on' : ''));
      }), (e) => (e.st ? e.m + ' ' + unit[e.m === 1 ? 0 : 1] + (e.ref != null ? ' · ' + ref + e.ref : '') : 'not solved'),
      'Stars in your last ' + H.length + ' cards: ' + list((e) => e.st));
    }
    select(H.length - 1);
    return fig;
  }
  // three numbers: how much, how long, and one figure of the game's own
  function pfNumbers(g, t, H, lv) {
    const min = Math.round(t.ms / 60000);
    const big = (ico, v, label) => h('div', { class: 'pf-num' }, icon(ico), h('b', { text: String(v) }), h('span', { text: label }));
    let fig = null;
    if (g === 'switchback') { const k = Math.max(t.kmh || 0, ...H.map((e) => Math.round(e.kmh || 0))); if (k) fig = big('gauge', k, 'best km/h'); }
    if (g === 'keepsake' && t.cards) fig = big('star', t.perfect + '/' + t.cards, 'all right');
    if ((g === 'outbound' || g === 'conduit') && t.solved) fig = big('bolt', t.perfect + '/' + t.solved, g === 'conduit' ? 'fewest turns' : 'fewest moves');
    if (g === 'stacks' && t.planN) fig = big('hint', Math.round(t.plan / t.planN / 100) / 10 + ' s', 'to plan');
    if (g === 'tumbler' && t.solved) fig = big('key', Math.round((t.tries / t.solved) * 10) / 10, 'tries each');
    // your record at this level, when there is one, says the most
    const rec = Records.get(g, lv);
    if (rec != null && RECORD[g]) fig = big('trophy', RECORD[g].fmt(rec), 'record, ' + LEVEL_NAMES[lv - 1]);
    return h('div', { class: 'pf-nums' }, big('tapped', t.cards, pfNoun(g, t.cards)), big('clock', min < 1 ? '<1' : min, 'min'), fig);
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
    // Glimpse staircases carry over per level for the same player: between visits in free play,
    // through the whole of a research session. A level without a value opens slow, at its own start.
    // free play keeps its book under a new key from app 2.21: the levels changed, so old values start over
    glimpseBook(spec) {
      const S = this.session;
      if (S.kind === 'free') return { book: store.get('pr1.glbook', {}), free: true };
      if (!S.glbook) S.glbook = {};
      return { book: S.glbook, free: false };
    },
    glimpseStart(spec) {
      if (spec.practice) return null;
      const { book } = this.glimpseBook(spec);
      if (book[spec.level] > 0) return { ms: book[spec.level] };
      // a level played for the first time (or again after stepping back) opens slow
      return { at: E.games.glimpse.levelStart(spec.level) };
    },
    glimpseKeep(spec, ms) {
      if (spec.practice || !(ms > 0)) return;
      const { book, free } = this.glimpseBook(spec);
      book[spec.level] = Math.round(ms * 100) / 100;
      if (free) store.set('pr1.glbook', book);
    },
    // a level stepped back from starts fresh next time, slow again
    glimpseForget(spec, level) {
      const { book, free } = this.glimpseBook(spec);
      delete book[level];
      if (free) store.set('pr1.glbook', book);
    },
    // Switchback carries its sign time and speed over the same way, per level.
    // A level without values takes the sign time from the level below and
    // starts at its own speed.
    switchbackBook(spec) {
      const S = this.session;
      if (S.kind === 'free') return { book: store.get('pr1.switchback', {}), free: true };
      if (!S.sbbook) S.sbbook = {};
      return { book: S.sbbook, free: false };
    },
    switchbackStart(spec) {
      if (spec.practice) return null;
      const { book } = this.switchbackBook(spec);
      if (book[spec.level]) return book[spec.level];
      for (let k = spec.level - 1; k >= 1; k--) if (book[k]) return { ms: book[k].ms, kmh: 0 };
      return null;
    },
    switchbackKeep(spec, ms, kmh) {
      if (spec.practice || !(ms > 0)) return;
      const { book, free } = this.switchbackBook(spec);
      book[spec.level] = { ms: Math.round(ms), kmh: Math.round(kmh) };
      if (free) store.set('pr1.switchback', book);
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
      const S = newSession('free', { seed: randomSeed(), participant: '', condition: '', options: OPTIONS, blocks: [{ game, count: FREE_COUNT, level: 1, adaptive: true }] });
      // the good cards toward each game's next level carry over from the last visit
      const runs = store.get('pr1.lvrun', {});
      ORDER.forEach((g) => { S.seq.adapt['0:' + g] = { level: Math.min(5, Math.max(1, levels[g] || 1)), streak: Math.max(0, Number(runs[g]) || 0) }; });
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
    practiceDone(game) { return !!(this.session && this.session.practiced[game]); },

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
      // free play: a Master drive that is left before it is driven comes round again next time
      if (S.kind === 'free' && spec.tour != null) store.set('pr1.sbtour', spec.tour);
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
          // (the first card is made at once, unless it takes a while: Outbound's denser lots are left to the worker)
          if (!p && first && !(spec.game === 'outbound' && spec.level >= 3)) { try { p = Gen.sync(spec.game, spec.level, spec.seed, spec.variant); } catch (e) { p = null; } }
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
        $('#app').dataset.lv = card.lookLv;
        this.swap(card.el, fromDy);
        if (snap) {
          this.logPuzzle(card, 'resume', { move_no: card.moveNo() });
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
    // Every game and session alike: one level up per success until the first miss in that
    // game, then two successes in a row per level. Free play remembers the first miss on the
    // device, a research session for its own player.
    upAfter(game) {
      const S = this.session;
      if (!S) return 2;
      return (S.kind === 'free' ? store.get('pr1.settled', {}) : S.settled || {})[game] ? 2 : 1;
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
      // leaving a puzzle by switching games or ending the session is not a miss,
      // and neither is a skip: the level stays where it was
      const neutral = sm.outcome === 'abandoned' || sm.outcome === 'skipped';
      // a Glimpse round with fewer than half the looks right steps back a level, since the flash
      // cannot get slower than its top and the level is too much for now
      const gl0 = sm.gl;
      const down = sp.game === 'glimpse' && sm.outcome === 'complete' && !sm.success && gl0 && gl0.n > 0 && gl0.correct < gl0.n / 2;
      const change = sp.practice || neutral ? null : seqRecord(S.seq, sp, sm.success, this.upAfter(sp.game), down);
      // free play: the Master tour moves on once a drive is driven or skipped
      if (S.kind === 'free' && sp.tour != null && sm.outcome !== 'abandoned') store.set('pr1.sbtour', sp.tour + 1);
      // the first miss in a game ends its quick start (free play keeps this on the device, below)
      if (S.kind !== 'free' && !sp.practice && !neutral && !sm.success) (S.settled = S.settled || {})[sp.game] = true;
      const level_next = sp.adaptive && change ? change.to : '';
      let toward = null, goal = null;
      this.logPuzzle(card, 'puzzle_end', { move_no: card.moveNo(), cls: sm.outcome, detail: JSON.stringify({ success: sm.success, stars: sm.stars, moves: sm.moves, par: sm.par, reference: sm.reference }) });
      if (change && change.changed) this.logPuzzle(card, 'level_change', { from: change.from, to: change.to });
      const c = card.c, applies = APPLIES[sp.game];
      const n = (k) => (applies.indexOf(k) >= 0 ? c[k] : '');
      const g = sm.gl || null, d = sm.sb || null, m = sm.ks || null;
      if (d && !sp.practice && d.n && sm.outcome === 'complete') this.switchbackKeep(sp, card.run.ms, card.run.kmh);
      if (g && !sp.practice && g.n) {
        this.glimpseKeep(sp, card.run.ms);
        if (change && change.changed && change.to < change.from) this.glimpseForget(sp, change.from);
      }
      if (sp.adaptive && !sp.practice && !neutral) {
        // your record at this level, in the game's own measure
        sm.record = Records.note(sp.game, sp.level, sm);
        // Tumbler: cracked in fewer tries than the computer's own way of guessing
        if (sp.game === 'tumbler' && sm.outcome === 'solved' && sm.reference != null && sm.moves < sm.reference) sm.beatAim = true;
        // the first time this game reaches a level
        if (change && change.changed && change.to > change.from) {
          const reached = store.get('pr1.reached', {});
          const top = reached[sp.game] || ((Stats.load(this).all[sp.game] || {}).top || 1);
          change.first = change.to > top;
          reached[sp.game] = Math.max(top, change.to);
          store.set('pr1.reached', reached);
        }
      }
      S.puzzles.push({
        seq: sp.seq, block: sp.block, in_block: sp.inBlock, puzzle_id: sp.id, puzzle_seed: card.p.seed,
        game: sp.game, level: sp.level, adaptive: sp.adaptive ? 1 : 0, practice: sp.practice ? 1 : 0, params: card.G.describe(card.p),
        outcome: sm.outcome, success: sm.success ? 1 : 0, stars: sm.stars, started_at: card.startedAt, ended_at: new Date().toISOString(),
        duration_ms: sm.duration_ms, first_move_ms: sm.first_move_ms == null ? '' : sm.first_move_ms, hidden_ms: sm.hidden_ms,
        moves: sm.moves, moves_total: sm.moves_total != null ? sm.moves_total : sm.moves, reference: sm.reference, par: sm.par, efficiency: sm.efficiency,
        n_optimal: n('optimal'), n_wasted: n('wasted'), n_dead_end: n('dead_end'), n_in_dead_end: n('in_dead_end'),
        n_blocked: n('blocked'), n_undo: n('undo'), n_restart: n('restart'), n_hint: n('hint'),
        n_suboptimal: n('suboptimal'), n_zero_info: n('zero_info'), n_inconsistent: n('inconsistent'),
        mean_info_ratio: sp.game === 'tumbler' && c.infoRatioN ? r4(c.infoRatioSum / c.infoRatioN) : '',
        n_correct: g ? g.correct : d ? d.correct : m ? m.correct : '', accuracy: g && g.n ? r4(g.accuracy) : d && d.n ? r4(d.accuracy) : m && m.n ? r4(m.accuracy) : '',
        threshold_ms: g && g.threshold_ms != null ? g.threshold_ms : d && d.threshold_ms != null ? d.threshold_ms : '', best_ms: g && g.best_ms != null ? g.best_ms : '',
        reach_ms: g && g.reach_ms != null ? g.reach_ms : d && d.reach_ms != null ? d.reach_ms : '',
        start_ms: g && g.start_ms != null ? g.start_ms : d && d.start_ms != null ? d.start_ms : '', end_ms: g && g.end_ms != null ? g.end_ms : d && d.end_ms != null ? d.end_ms : '',
        n_reversals: g ? g.reversals : d ? d.reversals : '', refresh_ms: g && g.refresh_ms != null ? r4(g.refresh_ms) : '',
        n_frame_drops: g ? g.drops : '', field_px: g && card.R ? Math.round(card.R) : '',
        n_hit: d ? d.hits : '', n_miss: d ? d.misses : '', n_false_alarm: d ? d.false_alarms : '', n_stray: d ? d.stray : '',
        rt_mean_ms: d && d.rt_mean_ms != null ? d.rt_mean_ms : '', on_road: d && d.on_road != null ? d.on_road : '', n_off_road: d ? d.off_road_episodes : '',
        speed_mean_kmh: d && d.speed_mean_kmh != null ? d.speed_mean_kmh : '', speed_start_kmh: d ? d.speed_start_kmh : '', speed_end_kmh: d ? d.speed_end_kmh : '',
        place: d ? card.p.place : '', n_animals: d ? d.animals : '', n_shooed: d ? d.shooed : '', animal_rt_mean_ms: d && d.animal_rt_mean_ms != null ? d.animal_rt_mean_ms : '',
        brake_s: d ? d.brake_s : '', n_items: d ? d.items : '', n_collected: d ? d.collected : '',
        study_ms: m && m.study_ms != null ? m.study_ms : '', mean_error: m && m.mean_error != null ? m.mean_error : '',
        level_next,
        features: JSON.stringify(card.p.features),
      });
      if (sp.practice) {
        // leaving the practice board for another game does not count as having played
        // it; a practice played wrong comes round again, up to three tries in all
        if (sm.outcome !== 'abandoned') {
          S.practiceTries = S.practiceTries || {};
          const tries = (S.practiceTries[sp.game] || 0) + 1;
          S.practiceTries[sp.game] = tries;
          if (sm.passed !== false || tries >= 3) {
            S.practiced[sp.game] = true;
            if (S.kind === 'free') store.set('pr1.practiced', S.practiced);
          }
        }
      } else if (S.kind === 'free') {
        if (!sm.success && !neutral) {
          const settled = store.get('pr1.settled', {});
          if (!settled[sp.game]) { settled[sp.game] = true; store.set('pr1.settled', settled); }
        }
        // free play keeps stars, a streak and per-game levels between visits
        if (sm.outcome !== 'abandoned') {
          const won = sm.outcome === 'solved' || (sm.outcome === 'complete' && sm.stars > 0);
          store.set('pr1.stars', store.get('pr1.stars', 0) + sm.stars);
          store.set('pr1.streak', won ? store.get('pr1.streak', 0) + 1 : 0);
        }
        if (change) {
          const lv = store.get('pr1.levels', {});
          lv[sp.game] = change.to;
          store.set('pr1.levels', lv);
          const a = S.seq.adapt['0:' + sp.game], runs = store.get('pr1.lvrun', {});
          runs[sp.game] = a ? a.streak : 0;
          store.set('pr1.lvrun', runs);
        }
        if (sm.outcome !== 'abandoned') Stats.record(this, S.puzzles[S.puzzles.length - 1]);
        this.hudBump = sm.stars > 0;
      }
      if (change && !sp.practice) {
        const a = S.seq.adapt[(sp.block - 1) + ':' + sp.game];
        // a good card that does not move the level yet: say how close the next one is
        if (sm.success && !change.changed && change.to < 5 && a && a.streak > 0) toward = { to: change.to + 1, have: a.streak, need: this.upAfter(sp.game) };
        // a timed round that did not count: what this level asks for the next, and the part it met
        if (!sm.success && sm.outcome === 'complete' && change.to < 5 && (g || d)) {
          const P = pfGoal(sp.game, change.to), L = card.p;
          const met = g ? [g.reach_ms != null && g.reach_ms <= L.advanceMs + 0.5]
            : [d.reach_ms != null && d.reach_ms <= L.advanceMs, d.speed_mean_kmh != null && d.speed_mean_kmh >= L.advanceKmh];
          goal = { to: change.to + 1, chips: P.chips.map((c, i) => c.concat([met[i]])), text: P.text };
        }
      }
      this.renderHud();
      this.touch(true);
      return { level_next, change, toward, goal };
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
        let a;
        if (old.dataset.exit === 'toss') {
          // a skipped card is tossed aside rather than swiped up
          const r = old.getBoundingClientRect();
          old.style.transformOrigin = '50% 100%';
          old.style.zIndex = '2';
          a = old.animate([{ transform: 'translate(0, 0) rotate(0)' }, { transform: 'translate(' + -(r.right + 40) + 'px, ' + Math.round(H * 0.08) + 'px) rotate(-14deg)' }], { duration: 440, easing: 'cubic-bezier(.5,0,.75,.35)' });
        } else {
          a = old.animate([{ transform: 'translateY(' + (fromDy || 0) + 'px)' }, { transform: 'translateY(' + -H + 'px)' }], { duration: 400, easing: 'cubic-bezier(.3,.6,.2,1)' });
        }
        a.onfinish = () => old.remove();
        setTimeout(() => old.remove(), 800);
      }
      // after a toss the next card is already underneath, like the next card of a deck
      const tossed = olds.some((o) => o.dataset.exit === 'toss');
      if (!quiet && tossed) el.animate([{ transform: 'scale(0.94)' }, { transform: 'scale(1)' }], { duration: 440, easing: 'cubic-bezier(.3,.6,.2,1)' });
      else if (!quiet) el.animate([{ transform: 'translateY(' + H + 'px)' }, { transform: 'translateY(0)' }], { duration: 400, easing: 'cubic-bezier(.3,.6,.2,1)' });
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
            badge(only), h('span', { text: LABEL[only] + ' only' }), h('span', { class: 'chip-x' }, icon('x'))));
        } else {
          M.append(h('div', { class: 'wordmark' }, h('span', { class: 'logo', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i'), h('i'), h('i')), 'Puzzle Reel'));
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
        this.logPuzzle(this.card, 'puzzle_end', { move_no: this.card.moveNo(), cls: 'abandoned', detail: 'replaying practice' });
      }
      this.show(practiceSpec(game, S.options.clue), null, true);
    },

    // ---------- profile
    // Two views in one sheet: every game at a glance (its level, how close the
    // next one is, its stars), and one game's own page, opened from its row.
    openProfile() {
      if (this.card && this.card.abort) this.card.abort('menu opened');
      const { all, hist, days } = Stats.load(this);
      const played = (g) => !!(all[g] && all[g].cards);
      const overview = h('div', { class: 'pf-over' }), page = h('div', { class: 'pf-page', hidden: true });
      // everything so far, in three big numbers; no streak to keep up
      if (ORDER.some(played)) {
        const min = Math.round(ORDER.reduce((a, g) => a + (all[g] ? all[g].ms : 0), 0) / 60000), stars = store.get('pr1.stars', 0);
        const big = (ico, v, label, cls) => h('div', { class: 'pf-big' + (cls ? ' ' + cls : '') }, h('span', null, icon(ico), h('b', { text: String(v) })), h('small', { text: label }));
        overview.append(h('div', { class: 'pf-head' },
          big('star', stars, stars === 1 ? 'star' : 'stars', 'gold'),
          big('day', days.length, days.length === 1 ? 'day played' : 'days played'),
          big('clock', min < 1 ? '<1' : min, min > 1 ? 'minutes' : 'minute')));
      }
      const rows = {};
      for (const A of AREAS) {
        const list = h('div', { class: 'pf-list' });
        for (const g of A.games) {
          const t = all[g], on = played(g), P = levelProgress(g), best = Math.max(t ? t.top : 0, P.lv);
          const say = LABEL[g] + ', ' + (on ? LEVEL_NAMES[P.lv - 1] + (P.have ? ', halfway to ' + LEVEL_NAMES[P.lv] : '') + ', ' + t.stars + ' stars' : 'not played yet');
          const row = h('button', { class: 'pf-row' + (on ? '' : ' fresh'), type: 'button', 'data-game': g, 'aria-label': say },
            h('span', { class: 'pf-ico', 'aria-hidden': 'true' }, badge(g, null, P.lv)),
            h('span', { class: 'pf-name' }, h('b', { text: LABEL[g] }),
              h('span', { class: 'pf-sub' }, pfLadder(P, best, 'pf-small'), h('small', { text: on ? LEVEL_NAMES[P.lv - 1] : 'New' }))),
            h('span', { class: 'pf-stars' }, on ? icon('star') : null, on ? String(t.stars) : null),
            icon('more', 'pf-more'));
          row.addEventListener('click', () => openGame(g));
          rows[g] = row;
          list.append(row);
        }
        overview.append(h('section', { class: 'pf-group' }, h('h3', { text: A.name }), list));
      }
      const sheet = openSheet('Profile', [overview, page]);
      sheet.classList.add('profile');
      const body = sheet.querySelector('.sheet-body'), title = sheet.querySelector('.sheet-head h2');
      const back = h('button', { class: 'back', type: 'button', 'aria-label': 'All games', hidden: true, onclick: () => closeGame() }, icon('back'));
      title.before(back);
      let keepY = 0, from = null;
      const openGame = (g) => {
        const t = all[g], P = levelProgress(g), H = hist[g] || [], best = Math.max(t ? t.top : 0, P.lv);
        const area = AREAS.find((A) => A.games.indexOf(g) >= 0);
        keepY = body.scrollTop;
        from = g;
        // the sheet keeps its height, so moving between the two views does not make it jump
        sheet.style.minHeight = Math.round(sheet.getBoundingClientRect().height) + 'px';
        page.textContent = '';
        page.dataset.game = g;
        page.append(
          h('div', { class: 'pf-hero' },
            h('div', { class: 'pf-hero-text' },
              h('small', { text: area ? area.name : '' }),
              h('b', { text: LABEL[g] }),
              h('span', { class: 'pf-hero-lv' }, h('span', { class: 'pf-lv', text: LEVEL_NAMES[P.lv - 1] }), best > P.lv ? h('span', { text: 'best ' + LEVEL_NAMES[best - 1] }) : null)),
            miniWorld(g),
            pfLadder(P, best)),
          pfNext(g, P, () => { closeSheet(); this.startFree(false, g); }));
        if (H.length) page.append(pfCurve(g, H, P.lv));
        if (played(g)) page.append(pfNumbers(g, t, H, P.lv));
        page.append(pfLevels(g, P, best));
        overview.hidden = true;
        page.hidden = false;
        back.hidden = false;
        body.scrollTop = 0;
        try { back.focus({ preventScroll: true }); } catch (e) { /* optional */ }
      };
      const closeGame = () => {
        page.hidden = true;
        page.textContent = '';
        overview.hidden = false;
        back.hidden = true;
        sheet.style.minHeight = '';
        body.scrollTop = keepY;
        if (from && rows[from]) try { rows[from].focus({ preventScroll: true }); } catch (e) { /* optional */ }
      };
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
        }, h('span', { class: 'gp-ico' }, badge(g, null, g === 'mixed' ? 1 : gameLevel(g))), h('span', { text: g === 'mixed' ? 'All' : LABEL[g] }))));
      openSheet('Puzzle Reel', [picker, h('div', { class: 'menu' },
        soundRow,
        item('person', 'Profile', 'Your levels and bests', () => { closeSheet(); this.openProfile(); }),
        item('help', 'How to play', 'Replay the practice board', () => { closeSheet(); this.replayPractice(); }),
        item('flask', 'Research session', 'Participant, seed, plan and options', () => { closeSheet(); this.openSetup(); }),
        item('chart', 'Data', 'Save logs as CSV or JSON', () => { closeSheet(); this.openData(); }))]);
    },

    // ---------- session setup
    openSetup(prefill) {
      const last = prefill || store.get('pr1.setup', null);
      const st = clone(last || { participant: '', condition: '', seed: randomSeed(), blocks: PRESETS[0].blocks, options: OPTIONS });
      st.options = Object.assign({}, OPTIONS, st.options || {});
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
            h('span', { class: 'help', text: 'All games rotates Outbound, Conduit, Tumbler, Glimpse, Stacks, Switchback and Keepsake. Adaptive blocks start at the chosen level and move as in free play: up after each success until the first miss in that game, then after two in a row, and down after a miss. A Glimpse round is 4 to 6 looks; its display time adapts on every look, and it goes down a level only after a round with fewer than half right. Every level plays as in free play.' }))),
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
  window.PuzzleReel = { App, Gen, Sound, seqInit, seqNext, seqRecord, eventsCSV, puzzlesCSV, codebookMarkdown, badge };
})();
