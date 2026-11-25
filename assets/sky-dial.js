/* ─────────────────────────────────────────────────────────────────────────────
   shastra — the sky dial.

   A strip of the twelve signs with the Sun and Moon on it. Press the band and
   the Moon comes to the pointer; drag, and time moves so the Moon stays under
   it. One pixel of band is the hours the Moon needs to cross it. Above the
   band: Sun sign, Moon sign, nakshatra and pada, tithi.

   APPROXIMATE, AND SAYS SO. Everything else on this site comes from Swiss
   Ephemeris on the server. This runs in the browser with a low-precision
   series (a handful of terms for the Moon, two for the Sun, Lahiri as a
   straight line), good to a fraction of a degree. That is enough to name a
   sign, a nakshatra and a tithi away from their edges, and not enough to
   stand beside the wheel's numbers unlabelled, so the copy calls it
   approximate. It needs no network, so it works while Render is asleep.

   Ported from the portfolio's dial (the source of the idea). Differences are
   this site's rules, not taste: no gradient, no shadow, radius zero, one hue;
   a plain script, because the site has no modules. Sound comes from
   sound.js, the same synthesis as the portfolio, and is silent if that file
   is not on the page. Reduced motion is handled by the global rule in shastra.css,
   plus the word roll below, which swaps in place.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var SIGNS = ['mesha', 'vrishabha', 'mithuna', 'karka', 'simha', 'kanya', 'tula', 'vrishchika', 'dhanu', 'makara', 'kumbha', 'meena'];
  var SHORT = ['mes', 'vrs', 'mit', 'kar', 'sim', 'kan', 'tul', 'vrc', 'dha', 'mak', 'kum', 'mee'];
  var NAK = ['ashwini', 'bharani', 'krittika', 'rohini', 'mrigashira', 'ardra', 'punarvasu', 'pushya', 'ashlesha', 'magha', 'purva phalguni', 'uttara phalguni', 'hasta', 'chitra', 'swati', 'vishakha', 'anuradha', 'jyeshtha', 'mula', 'purva ashadha', 'uttara ashadha', 'shravana', 'dhanishta', 'shatabhisha', 'purva bhadrapada', 'uttara bhadrapada', 'revati'];
  var TITHI = ['pratipada', 'dwitiya', 'tritiya', 'chaturthi', 'panchami', 'shashthi', 'saptami', 'ashtami', 'navami', 'dashami', 'ekadashi', 'dwadashi', 'trayodashi', 'chaturdashi'];
  // U+FE0E after every glyph, or phones draw purple emoji squares. See CLAUDE.md.
  var GLYPH = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'].map(function (g) { return g + '︎'; });

  var rad = Math.PI / 180;
  function norm(x) { var r = x % 360; return r < 0 ? r + 360 : r; }

  // Low-precision geocentric Sun and Moon, sidereal (Lahiri, linear).
  function sky(date) {
    var n = date.getTime() / 864e5 + 2440587.5 - 2451545;
    var T = n / 36525;
    var g = norm(357.529 + 0.98560028 * n), L = norm(280.459 + 0.98564736 * n);
    var sun = L + 1.915 * Math.sin(g * rad) + 0.020 * Math.sin(2 * g * rad);
    var Lm = norm(218.3165 + 13.17639648 * n), D = norm(297.8502 + 12.19074912 * n),
        Mm = norm(134.9634 + 13.06499295 * n), F = norm(93.2721 + 13.22935024 * n);
    var moon = Lm + 6.289 * Math.sin(Mm * rad) + 1.274 * Math.sin((2 * D - Mm) * rad)
      + 0.658 * Math.sin(2 * D * rad) + 0.214 * Math.sin(2 * Mm * rad)
      - 0.186 * Math.sin(g * rad) - 0.114 * Math.sin(2 * F * rad);
    var aya = 23.85306 + (T * 100) * 0.013972;
    return { sun: norm(sun - aya), moon: norm(moon - aya) };
  }

  function read(date) {
    var p = sky(date);
    var span = 360 / 27;
    var el = norm(p.moon - p.sun), t = Math.floor(el / 12), shukla = t < 15, i = t % 15;
    return {
      sun: p.sun, moon: p.moon,
      ss: Math.floor(p.sun / 30), ms: Math.floor(p.moon / 30),
      nk: Math.floor(p.moon / span),
      pada: Math.floor((p.moon % span) / (span / 4)) + 1,
      el: el,
      tithi: i === 14 ? (shukla ? 'purnima' : 'amavasya') : TITHI[i],
      paksha: shukla ? 'shukla' : 'krishna'
    };
  }

  function dm(x) {
    var w = x % 30, d = Math.floor(w), m = Math.floor((w - d) * 60);
    return (d < 10 ? '0' : '') + d + '°' + (m < 10 ? '0' : '') + m + '′';
  }

  // The Moon at its phase: elongation 0 is new, 180 is full.
  function moonSVG(el) {
    var r = 6, k = Math.cos(el * rad), lit = el < 180, rx = Math.abs(k) * r;
    var outer = lit ? 1 : 0, bulge = k > 0 ? (lit ? 0 : 1) : (lit ? 1 : 0);
    return '<svg viewBox="-7 -7 14 14" width="14" height="14" aria-hidden="true">'
      + '<circle r="' + r + '" fill="none" stroke="currentColor" stroke-width="1"/>'
      + '<path d="M0 ' + (-r) + 'A' + r + ' ' + r + ' 0 0 ' + outer + ' 0 ' + r
      + 'A' + rx + ' ' + r + ' 0 0 ' + bulge + ' 0 ' + (-r) + 'Z" fill="currentColor"/></svg>';
  }

  // One word rolls out as the next rolls in. While the band is dragged the
  // words change many times a second, so a change within 220ms of the last
  // swaps in place: one word in the row, never two overlapping.
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function roll(el, text) {
    if (el.getAttribute('data-v') === text) return;
    var first = !el.hasAttribute('data-v'), now = Date.now(), fast = now - (el._t || 0) < 220;
    el.setAttribute('data-v', text); el._t = now;
    clearTimeout(el._k);
    if (first || reduce || fast) {
      el.textContent = '';
      var s = document.createElement('span'); s.textContent = text; el.appendChild(s);
      return;
    }
    while (el.children.length > 1) el.removeChild(el.firstElementChild);
    var old = el.lastElementChild, nu = document.createElement('span');
    nu.textContent = text; nu.className = 'in';
    el.appendChild(nu);
    if (old) old.className = 'out';
    el._k = setTimeout(function () { if (old && old.parentNode === el) el.removeChild(old); }, 400);
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (el.lastElementChild === nu) nu.className = ''; }); });
  }

  function mount(root) {
    root.innerHTML =
      '<div class="sd-read">'
      + row('sun', '<i class="sd-key-mk sun" aria-hidden="true"></i>sun', 'sun', 'sund')
      + row('moon', '<i class="sd-key-mk moon" aria-hidden="true"></i>moon', 'moon', 'moond')
      + row('nak', 'nakshatra', 'nak', 'pada')
      + row('tithi', 'tithi', 'tithi', 'phase')
      + '</div>'
      + '<div class="sd-band" role="slider" tabindex="0" aria-label="drag to move through time"'
      + ' aria-valuemin="-87600" aria-valuemax="87600" aria-valuenow="0">'
      + '<div class="sd-signs" aria-hidden="true">'
      + SHORT.map(function (s, i) { return '<span><em>' + GLYPH[i] + '</em><b>' + s + '</b></span>'; }).join('')
      + '</div><div class="sd-ticks" aria-hidden="true"></div>'
      + '<div class="sd-mk sun" aria-hidden="true"></div><div class="sd-mk moon" aria-hidden="true"></div>'
      + '</div>'
      + '<div class="sd-ctl">'
      + '<button type="button" class="sd-step" data-d="-1" aria-label="one day earlier">&minus; 1 day</button>'
      + '<button type="button" class="sd-date" title="back to now"></button>'
      + '<button type="button" class="sd-step" data-d="1" aria-label="one day later">+ 1 day</button>'
      + '</div>';

    function row(id, k, v, d) {
      return '<div class="sd-row"><span class="k">' + k + '</span><span class="v" data-r="' + v
        + '"></span><span class="d" data-r="' + d + '"></span></div>';
    }

    var R = {};
    Array.prototype.forEach.call(root.querySelectorAll('[data-r]'), function (e) { R[e.getAttribute('data-r')] = e; });
    var band = root.querySelector('.sd-band'),
        mkS = root.querySelector('.sd-mk.sun'), mkM = root.querySelector('.sd-mk.moon'),
        signs = root.querySelectorAll('.sd-signs span'),
        date = root.querySelector('.sd-date'),
        hint = document.getElementById('dial-hint'),
        hintWas = hint ? hint.textContent : '';

    var base = new Date(), off = 0, drag = null;

    // A wrap from 359° to 0° would otherwise slide the marker the whole width.
    function place(el, v) {
      var nx = v / 3.6, prev = parseFloat(el.style.left);
      if (!isNaN(prev) && Math.abs(nx - prev) > 50) {
        el.style.transition = 'none'; el.style.left = nx + '%'; void el.offsetWidth; el.style.transition = '';
      } else el.style.left = nx + '%';
    }

    var lastMs = -1, lastSs = -1, lastNk = -1, lastDay = '';
    function snd() { return window.shastraSound ? window.shastraSound.sfx : null; }
    function paint(silent) {
      var d = new Date(base.getTime() + off * 36e5), r = read(d);
      roll(R.sun, SIGNS[r.ss]); R.sund.textContent = dm(r.sun);
      roll(R.moon, SIGNS[r.ms]); R.moond.textContent = dm(r.moon);
      roll(R.nak, NAK[r.nk]); R.pada.textContent = 'pada ' + r.pada;
      roll(R.tithi, r.tithi); R.phase.innerHTML = moonSVG(r.el) + '<span>' + r.paksha + '</span>';
      place(mkS, r.sun); place(mkM, r.moon);
      if (lastMs >= 0 && r.ms !== lastMs) pulse(mkM);
      if (lastSs >= 0 && r.ss !== lastSs) pulse(mkS);
      for (var i = 0; i < signs.length; i++) signs[i].classList.toggle('on', i === r.ss || i === r.ms);
      var day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).toLowerCase();
      var hm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
      var isNow = Math.abs(off) < 0.5;
      date.innerHTML = '<b>' + day + '</b>' + (isNow ? 'right now' : hm + ' ist · tap for now');
      root.classList.toggle('is-now', isNow);
      // A sign change lands with a detent, each nakshatra the Moon passes
      // clicks, and a new day ticks higher. The same scheme as the portfolio.
      var sx = !silent && lastMs >= 0 && snd();
      if (sx) {
        if (r.ms !== lastMs || r.ss !== lastSs) sx.detent();
        else if (r.nk !== lastNk) sx.tick(0.7);
        else if (day !== lastDay) sx.tick(1.3);
      }
      lastMs = r.ms; lastSs = r.ss; lastNk = r.nk; lastDay = day;
      band.setAttribute('aria-valuenow', String(Math.round(off)));
      band.setAttribute('aria-valuetext', day + ', moon in ' + SIGNS[r.ms] + ', ' + NAK[r.nk]);
    }
    function pulse(el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }

    function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
    // the Moon moves about 0.549° an hour
    function hPerPx() { return (360 / Math.max(200, band.clientWidth)) / 0.549; }

    band.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      var r = band.getBoundingClientRect(), want = clamp((e.clientX - r.left) / r.width, 0, 1) * 360;
      var at = read(new Date(base.getTime() + off * 36e5)).moon;
      var dd = want - at; if (dd > 180) dd -= 360; if (dd < -180) dd += 360;
      off += dd / 0.549; paint(true);
      drag = { x: e.clientX, o: off, moved: false };
      band.classList.add('held');
      try { band.setPointerCapture(e.pointerId); } catch (_) {}
      if (hint) hint.textContent = 'holding the moon. drag left or right.';
      if (snd()) snd().detent();
    });
    band.addEventListener('pointermove', function (e) {
      if (!drag) return;
      if (!drag.moved) { if (Math.abs(e.clientX - drag.x) < 2) return; drag.moved = true; band.classList.add('drag'); }
      off = drag.o + (e.clientX - drag.x) * hPerPx(); paint();
    });
    function end() {
      if (!drag) return; drag = null;
      band.classList.remove('drag', 'held');
      if (hint) hint.textContent = hintWas;
    }
    band.addEventListener('pointerup', end);
    band.addEventListener('pointercancel', end);
    band.addEventListener('keydown', function (e) {
      var k = e.key, used = true;
      if (k === 'ArrowRight') off += e.shiftKey ? 24 : 3;
      else if (k === 'ArrowLeft') off -= e.shiftKey ? 24 : 3;
      else if (k === 'Home') { off = 0; base = new Date(); }
      else used = false;
      if (used) { e.preventDefault(); paint(); }
    });
    Array.prototype.forEach.call(root.querySelectorAll('.sd-step'), function (b) {
      b.addEventListener('click', function () { off += 24 * Number(b.getAttribute('data-d')); paint(); });
    });
    date.addEventListener('click', function () {
      if (Math.abs(off) < 0.01) return;
      off = 0; base = new Date(); paint(true);
      if (snd()) snd().detent();
    });

    paint(true);
    setInterval(function () { if (Math.abs(off) < 0.01 && !drag) { base = new Date(); paint(true); } }, 60000);
  }

  function init() {
    var el = document.getElementById('dial');
    if (el) mount(el);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
