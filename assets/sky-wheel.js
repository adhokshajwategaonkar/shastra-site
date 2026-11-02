/* ─────────────────────────────────────────────────────────────────────────────
   shastra — the live rasi chakra.

   The landing page hero. It draws the ACTUAL SKY RIGHT NOW: nine grahas at
   their real sidereal longitudes, the twelve rasi, the twenty-seven nakshatra
   divisions, the lagna rising over Ujjain, and the graha drishti between them.
   Positions come from GET /api/transits — the same engine that computes a paid
   report. Nothing here is decorative geometry.

   ── why it is drawn this way ────────────────────────────────────────────────

   The device is borrowed from a Western natal wheel (a zodiac band, glyphs on
   a ring, aspect chords across the middle) because it is the clearest way ever
   invented to show a sky at a glance. Everything inside it is Vedic, and the
   differences are the point:

     · SIDEREAL longitudes, Lahiri ayanamsa. A Western wheel would put the Sun
       roughly 24° further on.
     · The rasi are named in Sanskrit, because that is what they are called.
       The glyph beside each name is the one a reader already knows.
     · The chords are GRAHA DRISHTI, not Western aspects, and drishti is not
       symmetrical. Every graha aspects the 7th house from its own sign; Mars
       also the 4th and 8th, Jupiter the 5th and 9th, Saturn the 3rd and 10th.
       Saturn can aspect Mars without Mars aspecting Saturn.
     · Drishti is reckoned by SIGN, not by orb in degrees, so the chords change
       the moment a graha changes sign rather than gradually.

   ── it has to explain itself ────────────────────────────────────────────────

   A ring of bare numbers is a technical diagram, not a hero: a visitor who does
   not already read charts learns nothing from it. So every element is labelled
   — the rasi carry their glyph and name, the band is keyed by the legend in the
   page beside it, and hovering or focusing any graha prints its exact position
   and the houses it aspects into the readout under the wheel. The wheel is the
   product's first argument, and an argument nobody can follow is not one.

   ── honesty about motion ────────────────────────────────────────────────────

   Nothing in the sky moves fast enough to see. The Moon, the fastest body
   here, covers 13.2° a day — about half a degree an hour. So this does NOT
   fake rotation to look alive. What is animated is the DRAWING of it, once,
   and what is live is the data: it refetches every 60 seconds and the readout
   in the middle says exactly when it was computed.

   Before the first response lands the wheel is drawn from a baked snapshot at
   reduced contrast with the middle reading "computing" — the free Render
   instance can take ~50s to wake, and a hero that renders nothing for 50s is
   worse than one that renders a labelled approximation. If the live fetch
   never succeeds the middle says so rather than passing the snapshot off as
   the current sky.

   GSAP drives the entrance when it is on the page; the CSS keyframes in
   shastra.css are the fallback when it is not, so the wheel never depends on
   a CDN to become visible.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  // ── geometry (viewBox 600×600) ───────────────────────────────────────────
  var C         = 300;
  var R_BAND_O  = 292;   // outer edge of the ink rasi band
  var R_BAND_I  = 243;   // inner edge
  var R_RASI_G  = 279;   // zodiac glyph, upright, inside the band
  var R_RASI_N  = 257;   // the rasi name, CENTRED on this path (see drawPlate)
  var R_NAK_O   = 244;   // nakshatra ticks hang inward from the band
  var R_NAK_I   = 232;
  var R_TICK_O  = 244;   // a graha's exact-degree tick
  var R_TICK_I  = 222;
  var R_GLYPH   = 206;   // glyph centres
  var R_DEG     = 182;   // the degree label
  var R_CHORD   = 164;   // where drishti chords terminate
  var R_INNER   = 80;    // the readout disc

  /* Every glyph below carries U+FE0E, VARIATION SELECTOR-15, and it is not
     optional.

     The zodiac signs — and Mars and Venus — have EMOJI presentation by default
     on macOS, iOS and Android, so without it the band fills with purple
     colour-emoji squares instead of engraved glyphs, on exactly the platforms
     most of this audience is using. VS-15 asks for the text presentation,
     which is the monochrome glyph the face actually has. The legend swatch in
     index.html needs the same thing (&#xFE0E;). */
  var RASI = [
    { sa: 'mesha',      glyph: '♈︎' },
    { sa: 'vrishabha',  glyph: '♉︎' },
    { sa: 'mithuna',    glyph: '♊︎' },
    { sa: 'karka',      glyph: '♋︎' },
    { sa: 'simha',      glyph: '♌︎' },
    { sa: 'kanya',      glyph: '♍︎' },
    { sa: 'tula',       glyph: '♎︎' },
    { sa: 'vrishchika', glyph: '♏︎' },
    { sa: 'dhanu',      glyph: '♐︎' },
    { sa: 'makara',     glyph: '♑︎' },
    { sa: 'kumbha',     glyph: '♒︎' },
    { sa: 'meena',      glyph: '♓︎' },
  ];

  var ORDER = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];

  // Unicode has all nine. Rahu and Ketu are the lunar nodes, and ☊ / ☋ are
  // exactly that — the ascending and descending node, one axis, two ends.
  var GLYPH = {
    sun: '☉︎', moon: '☽︎', mars: '♂︎', mercury: '☿︎',
    jupiter: '♃︎', venus: '♀︎', saturn: '♄︎',
    rahu: '☊︎', ketu: '☋︎',
  };
  var SA = {
    sun: 'surya', moon: 'chandra', mars: 'mangala', mercury: 'budha',
    jupiter: 'guru', venus: 'shukra', saturn: 'shani', rahu: 'rahu', ketu: 'ketu',
  };

  /* Houses, counted from the aspecting graha's own sign, that it casts full
     drishti on. 1 is its own sign, so 7 is the opposition every graha casts.

     Rahu and Ketu are given the 7th only. Classical sources genuinely disagree
     about whether the nodes aspect the 5th and 9th as well — the same kind of
     dispute 01-PROJECT.md records for the vashya matrix — so the contested
     chords are left undrawn rather than asserted. */
  var DRISHTI = { mars: [4, 7, 8], jupiter: [5, 7, 9], saturn: [3, 7, 10] };
  var DEFAULT_DRISHTI = [7];

  var ORDINAL = { 3: '3rd', 4: '4th', 5: '5th', 7: '7th', 8: '8th', 9: '9th', 10: '10th' };

  // A baked sky, so the hero draws instantly and with no network. Regenerate
  // with: node site/tools/bake-sky.js
  var SNAPSHOT = window.SHASTRA_SKY_SNAPSHOT || null;

  // ── helpers ──────────────────────────────────────────────────────────────
  function el(name, attrs, text) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) {
      if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    if (text != null) n.textContent = text;
    return n;
  }

  /* Sidereal longitude → screen point.

     0° Mesha sits at the left (9 o'clock) and longitude increases
     anticlockwise, which is where a natal wheel puts the ascendant and which
     direction the signs run. y is negated because SVG's y axis points down. */
  function pt(r, lon) {
    var a = (180 + lon) * Math.PI / 180;
    return [C + r * Math.cos(a), C - r * Math.sin(a)];
  }
  function f(v) { return Math.round(v * 100) / 100; }

  function arc(r, lonA, lonB, sweep) {
    var a = pt(r, lonA), b = pt(r, lonB);
    return 'M' + f(a[0]) + ' ' + f(a[1]) +
           ' A' + r + ' ' + r + ' 0 0 ' + sweep + ' ' + f(b[0]) + ' ' + f(b[1]);
  }

  function houseFrom(fromSign, toSign) {
    return ((toSign - fromSign + 12) % 12) + 1;
  }

  /* Spread glyphs that would collide.

     Real skies cluster: on the day this was written the Moon, Mars, Jupiter
     and Ketu sat inside eight degrees of each other, which at this radius is
     four glyphs in the space of one. Every piece of chart software solves this
     the same way and so does this one — the TICK stays at the true longitude
     and only the GLYPH is nudged along the ring, with a leader line drawn
     between them whenever they have come apart. The degree printed under the
     glyph is the real one.

     Relaxation, not an exact solution: a few passes pushing adjacent pairs
     apart until they clear MIN_SEP. Nine grahas at 9° each need 81° of 360,
     so there is always room.

     Chords terminate at the spread position rather than the true one, because
     drishti is reckoned by SIGN — the chord is not a geometric statement about
     degrees, and connecting it to the glyph a reader can actually point at is
     worth more than connecting it to a degree they cannot see. */
  var MIN_SEP = 9;
  function spread(items) {
    var a = items.slice().sort(function (x, y) { return x.lon - y.lon; });
    a.forEach(function (it) { it.at = it.lon; });
    if (a.length < 2) return items;

    for (var pass = 0; pass < 60; pass += 1) {
      var moved = false;
      for (var i = 0; i < a.length; i += 1) {
        var cur = a[i], nxt = a[(i + 1) % a.length];
        var gap = nxt.at - cur.at;
        if (i === a.length - 1) gap += 360;      // across 0° Mesha
        if (gap >= MIN_SEP) continue;
        var push = (MIN_SEP - gap) / 2;
        cur.at -= push;
        nxt.at += push;
        moved = true;
      }
      if (!moved) break;
    }
    a.forEach(function (it) { it.at = ((it.at % 360) + 360) % 360; });
    return items;
  }

  // ── the static plate: band, rasi, nakshatra ticks ────────────────────────
  function drawPlate(svg) {
    var defs = el('defs', {});
    var plate = el('g', { class: 'sw-plate' });

    plate.appendChild(el('circle', {
      cx: C, cy: C, r: (R_BAND_O + R_BAND_I) / 2,
      fill: 'none', stroke: 'var(--sw-band)',
      'stroke-width': R_BAND_O - R_BAND_I, class: 'sw-band',
    }));

    // Rasi names, set along the band. The arc is drawn clockwise for sectors
    // in the top half and anticlockwise for the bottom half, which is what
    // keeps the type upright all the way round instead of inverting it below
    // the horizontal.
    var names = el('g', { class: 'sw-rasi' });
    var glyphs = el('g', { class: 'sw-rasi-glyph' });
    for (var i = 0; i < 12; i += 1) {
      var lon0 = i * 30, lon1 = lon0 + 30;
      var mid = pt(R_RASI_N, lon0 + 15);
      var top = mid[1] < C;
      var id = 'sw-arc-' + i;
      defs.appendChild(el('path', {
        id: id,
        d: top ? arc(R_RASI_N, lon1, lon0, 1) : arc(R_RASI_N, lon0, lon1, 0),
        fill: 'none',
      }));
      /* No dy. The baseline is centred on the path by `dominant-baseline:
         central` in the stylesheet, which is what stops the long names
         clipping.

         With a shifted baseline the glyphs grow in whichever direction the arc
         happens to run — outward in the top half, inward in the bottom — so a
         dy that kept `tula` inside the band pushed `vrishabha` and
         `vrishchika` straight out of it, and the parts that landed on paper
         were white on white and simply vanished. Centring makes the extent
         symmetrical and direction-independent, so one radius is correct for
         all twelve however long the name is. */
      var t = el('text', { 'text-anchor': 'middle' });
      var tp = el('textPath', { 'text-anchor': 'middle', startOffset: '50%' }, RASI[i].sa);
      tp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + id);
      tp.setAttribute('href', '#' + id);
      t.appendChild(tp);
      names.appendChild(t);

      // The glyph stays UPRIGHT rather than following the curve. A rotated
      // zodiac glyph reads as a mistake; twelve upright ones read as a dial.
      var gp = pt(R_RASI_G, lon0 + 15);
      var g = el('text', {
        x: f(gp[0]), y: f(gp[1]), 'text-anchor': 'middle', dy: '0.36em',
      }, RASI[i].glyph);
      g.style.setProperty('--i', String(i));
      glyphs.appendChild(g);
    }
    plate.appendChild(names);
    plate.appendChild(glyphs);

    // Rasi divisions, cut across the full band.
    var divs = el('g', { class: 'sw-div' });
    for (var s = 0; s < 12; s += 1) {
      var o = pt(R_BAND_O, s * 30), n = pt(R_BAND_I, s * 30);
      divs.appendChild(el('line', { x1: f(o[0]), y1: f(o[1]), x2: f(n[0]), y2: f(n[1]) }));
    }
    plate.appendChild(divs);

    // The 27 nakshatra, 13°20′ each, ticked inside the band.
    var naks = el('g', { class: 'sw-nak' });
    for (var k = 0; k < 27; k += 1) {
      var d = k * (360 / 27);
      var a1 = pt(R_NAK_O, d), a2 = pt(R_NAK_I, d);
      var ln = el('line', { x1: f(a1[0]), y1: f(a1[1]), x2: f(a2[0]), y2: f(a2[1]) });
      ln.style.setProperty('--i', String(k));
      naks.appendChild(ln);
    }
    plate.appendChild(naks);

    plate.appendChild(el('circle', { cx: C, cy: C, r: R_NAK_I, fill: 'none', class: 'sw-hair' }));
    plate.appendChild(el('circle', { cx: C, cy: C, r: R_CHORD, fill: 'none', class: 'sw-hair' }));

    svg.appendChild(defs);
    svg.appendChild(plate);
  }

  // ── the live layer ───────────────────────────────────────────────────────
  function drawSky(svg, data, state) {
    var old = svg.querySelector('.sw-sky');
    if (old) old.remove();

    var sky = el('g', { class: 'sw-sky' + (state === 'snapshot' ? ' is-snapshot' : '') });
    var grahas = data.grahas;

    // Where each glyph is allowed to sit, once collisions are resolved.
    var placed = {};
    spread(ORDER.filter(function (k) { return grahas[k]; }).map(function (k) {
      return { key: k, lon: grahas[k].lon };
    })).forEach(function (it) { placed[it.key] = it.at; });

    // — drishti chords. Drawn first so the glyphs sit over them.
    var chords = el('g', { class: 'sw-chords' });
    var n = 0;
    ORDER.forEach(function (from) {
      var a = grahas[from];
      if (!a) return;
      var houses = DRISHTI[from] || DEFAULT_DRISHTI;
      ORDER.forEach(function (to) {
        if (to === from) return;
        var b = grahas[to];
        if (!b) return;
        var h = houseFrom(a.signIndex, b.signIndex);
        if (houses.indexOf(h) === -1) return;
        // The 7th is mutual, so it would otherwise be drawn twice.
        if (h === 7 && ORDER.indexOf(to) < ORDER.indexOf(from)) return;

        var p = pt(R_CHORD, placed[from]), q = pt(R_CHORD, placed[to]);
        var line = el('line', {
          x1: f(p[0]), y1: f(p[1]), x2: f(q[0]), y2: f(q[1]),
          class: 'sw-chord sw-chord--' + (h === 7 ? 'opp' : from),
          'data-from': from, 'data-to': to, 'data-house': h,
        });
        line.style.setProperty('--i', String(n));
        n += 1;
        chords.appendChild(line);
      });
    });
    sky.appendChild(chords);

    // — the grahas
    var marks = el('g', { class: 'sw-grahas' });
    ORDER.forEach(function (key, i) {
      var g = grahas[key];
      if (!g) return;
      var at = placed[key];
      var grp = el('g', {
        class: 'sw-graha' + (key === 'moon' ? ' is-moon' : '') +
               (g.retrograde ? ' is-retro' : ''),
        'data-graha': key, tabindex: '0', role: 'img',
        'aria-label': key + ' in ' + g.sign + ', ' + (g.degInSignStr || '') +
                      ', nakshatra ' + g.nakshatra + (g.retrograde ? ', retrograde' : ''),
      });
      grp.style.setProperty('--i', String(i));

      // The tick is the truth: it sits at the real longitude, always.
      var t1 = pt(R_TICK_O, g.lon), t2 = pt(R_TICK_I, g.lon);
      grp.appendChild(el('line', {
        x1: f(t1[0]), y1: f(t1[1]), x2: f(t2[0]), y2: f(t2[1]), class: 'sw-graha-tick',
      }));

      // If the glyph had to move to stay legible, say so with a leader.
      var drift = Math.abs(((at - g.lon + 540) % 360) - 180);
      if (drift > 1.2) {
        var lp = pt(R_TICK_I, g.lon), lq = pt(R_GLYPH + 11, at);
        grp.appendChild(el('line', {
          x1: f(lp[0]), y1: f(lp[1]), x2: f(lq[0]), y2: f(lq[1]), class: 'sw-leader',
        }));
      }

      var gp = pt(R_GLYPH, at);
      // A transparent disc, so the whole glyph area is hoverable rather than
      // only the few pixels the glyph's own strokes cover.
      grp.appendChild(el('circle', { cx: f(gp[0]), cy: f(gp[1]), r: 16, class: 'sw-hit' }));
      grp.appendChild(el('circle', { cx: f(gp[0]), cy: f(gp[1]), r: 15, class: 'sw-ring' }));
      grp.appendChild(el('text', {
        x: f(gp[0]), y: f(gp[1]), 'text-anchor': 'middle', dy: '0.36em',
        class: 'sw-glyph',
      }, GLYPH[key]));

      var dp = pt(R_DEG, at);
      grp.appendChild(el('text', {
        x: f(dp[0]), y: f(dp[1]), 'text-anchor': 'middle', dy: '0.36em',
        class: 'sw-deg',
      }, Math.floor(g.degInSign) + '°'));

      if (g.retrograde) {
        grp.appendChild(el('text', {
          x: f(gp[0] + 11), y: f(gp[1] - 8), 'text-anchor': 'middle', class: 'sw-retro',
        }, 'R'));
      }
      marks.appendChild(grp);
    });
    sky.appendChild(marks);

    // — the lagna. One hand, in the second plate's colour, because it is the
    //   one value here that depends on where and when you are standing.
    if (data.lagna) {
      var l1 = pt(R_INNER + 8, data.lagna.lon), l2 = pt(R_NAK_I - 4, data.lagna.lon);
      var hand = el('g', { class: 'sw-lagna' });
      hand.appendChild(el('line', { x1: f(l1[0]), y1: f(l1[1]), x2: f(l2[0]), y2: f(l2[1]) }));
      var hp = pt(R_NAK_I - 4, data.lagna.lon);
      hand.appendChild(el('circle', { cx: f(hp[0]), cy: f(hp[1]), r: 3.5 }));
      sky.appendChild(hand);
    }

    svg.appendChild(sky);
    return placed;
  }

  // ── the readout in the middle ────────────────────────────────────────────
  function drawReadout(svg, data, state) {
    var old = svg.querySelector('.sw-readout');
    if (old) old.remove();

    var g = el('g', { class: 'sw-readout' });
    g.appendChild(el('circle', { cx: C, cy: C, r: R_INNER, class: 'sw-disc' }));

    var lines;
    if (state === 'live') {
      var at = new Date(data.at);
      lines = [
        { y: -34, t: 'the sky now', c: 'sw-r-label' },
        { y: -10, t: at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), c: 'sw-r-big' },
        { y: 12,  t: data.panchanga ? data.panchanga.nakshatra : '', c: 'sw-r-mid' },
        { y: 30,  t: data.panchanga ? data.panchanga.tithi.name + ' · ' + data.panchanga.tithi.paksha : '', c: 'sw-r-small' },
        { y: 48,  t: 'ayan ' + data.ayanamsa.toFixed(3) + '°', c: 'sw-r-small' },
      ];
    } else if (state === 'snapshot') {
      lines = [
        { y: -10, t: 'computing', c: 'sw-r-mid' },
        { y: 10,  t: 'the sky', c: 'sw-r-mid' },
        { y: 34,  t: 'waking the engine', c: 'sw-r-small' },
      ];
    } else {
      lines = [
        { y: -10, t: 'live sky', c: 'sw-r-mid' },
        { y: 10,  t: 'unavailable', c: 'sw-r-mid' },
        { y: 34,  t: 'positions are a snapshot', c: 'sw-r-small' },
      ];
    }

    lines.forEach(function (l) {
      if (!l.t) return;
      g.appendChild(el('text', { x: C, y: C + l.y, 'text-anchor': 'middle', class: l.c }, l.t));
    });

    if (state === 'live') {
      g.appendChild(el('rect', { x: C - 3, y: C + 58, width: 6, height: 6, class: 'sw-tick' }));
    }
    svg.appendChild(g);
  }

  // ── hover / focus: isolate one graha's drishti and name it ───────────────
  function wireHighlight(svg, root, data, out) {
    // returns `set`, so demo() can drive the same code path a pointer does
    var base = out ? out.textContent : '';

    function say(key, litCount) {
      if (!out) return;
      if (!key || !data.grahas[key]) { out.textContent = base; out.removeAttribute('data-lit'); return; }
      var g = data.grahas[key];
      var houses = DRISHTI[key] || DEFAULT_DRISHTI;
      out.setAttribute('data-lit', '');
      out.textContent =
        key + ' (' + SA[key] + ') · ' + g.sign + ' ' + (g.degInSignStr || '') +
        ' · ' + g.nakshatra + (g.pada ? ' pada ' + g.pada : '') +
        (g.retrograde ? ' · retrograde' : '') +
        ' · aspects the ' + houses.map(function (h) { return ORDINAL[h] || h; }).join(', ') +
        // Drishti falls on SIGNS, and a sign is often empty. Saturn can be
        // aspecting three houses with no graha standing in any of them — so
        // without this the wheel dims everything, draws no chord and looks
        // broken rather than correct.
        (litCount ? '' : ' — no graha in any of them right now');
    }

    function set(key) {
      root.classList.toggle('sw-focused', !!key);
      var lit = 0;
      svg.querySelectorAll('.sw-chord').forEach(function (c) {
        var on = !!key && (c.dataset.from === key || c.dataset.to === key);
        if (on) lit += 1;
        c.classList.toggle('is-lit', on);
      });
      svg.querySelectorAll('.sw-graha').forEach(function (gr) {
        gr.classList.toggle('is-lit', gr.dataset.graha === key);
      });
      say(key, lit);
    }

    return set;

    ['mouseover', 'focusin'].forEach(function (ev) {
      svg.addEventListener(ev, function (e) {
        var g = e.target.closest ? e.target.closest('.sw-graha') : null;
        if (g) set(g.dataset.graha);
      });
    });
    ['mouseout', 'focusout'].forEach(function (ev) {
      svg.addEventListener(ev, function (e) {
        var to = e.relatedTarget;
        if (!to || !to.closest || !to.closest('.sw-graha')) set(null);
      });
    });
  }

  /* Demonstrate the hover once, on the Moon, after the entrance settles.

     Telling someone in 8px type that they can hover a graha does not work;
     nobody reads the caption before they have a reason to. Lighting one up
     and releasing it shows the mechanic in a second and a half, and the
     dotted target rings mean the other eight still look clickable afterwards.

     Runs once per page load, is skipped entirely under reduced motion, and
     cancels the moment a real pointer or keyboard lands on the wheel so it
     can never fight the person using it. */
  function demo(svg, set) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Re-queried inside the timeout, never captured here: the live fetch
    // replaces the whole .sw-sky group a moment after the snapshot draws, so
    // a reference taken now is detached by the time the demo runs and the
    // ring silently lights a node nobody can see.
    function moonNow() { return svg.querySelector('.sw-graha[data-graha="moon"]'); }
    if (!moonNow()) return;

    var cancelled = false;
    function cancel() { cancelled = true; }
    ['pointerdown', 'pointermove', 'keydown', 'focusin'].forEach(function (ev) {
      svg.addEventListener(ev, cancel, { once: true, passive: true });
    });

    setTimeout(function () {
      if (cancelled) return;
      var moon = moonNow();
      if (moon) moon.classList.add('is-demo');
      set('moon');
      setTimeout(function () {
        var m = moonNow();
        if (m) m.classList.remove('is-demo');
        if (!cancelled) set(null);
      }, 1900);
    }, 2600);
  }

  // ── the entrance, when GSAP is on the page ───────────────────────────────
  function animate(svg, root) {
    var gsap = window.gsap;
    if (!gsap) return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

    root.classList.add('sw-gsap');   // neutralises the CSS keyframe fallback
    var q = function (sel) { return svg.querySelectorAll(sel); };

    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // Drawn in the order a person would draw it: the band, then what divides
    // it, then the bodies, then what connects them.
    tl.from(svg.querySelector('.sw-band'), {
      opacity: 0, scale: 0.94, duration: 1.1, svgOrigin: C + ' ' + C,
    })
      .from(q('.sw-div line'), { opacity: 0, duration: 0.5, stagger: 0.02 }, '-=0.7')
      .from(q('.sw-rasi text'), { opacity: 0, duration: 0.6, stagger: 0.035 }, '-=0.6')
      .from(q('.sw-rasi-glyph text'), { opacity: 0, scale: 0.6, duration: 0.5, stagger: 0.035,
        transformOrigin: '50% 50%' }, '-=0.75')
      .from(q('.sw-nak line'), { opacity: 0, duration: 0.3, stagger: 0.012 }, '-=0.5')
      .from(q('.sw-hair'), { opacity: 0, duration: 0.5 }, '-=0.3')
      .from(q('.sw-graha'), {
        opacity: 0, scale: 0.5, duration: 0.5, stagger: 0.06, ease: 'back.out(2)',
      }, '-=0.2')
      .from(q('.sw-chord'), { opacity: 0, duration: 0.45, stagger: 0.05 }, '-=0.25')
      .from(q('.sw-lagna'), { opacity: 0, duration: 0.5 }, '-=0.3')
      .from(q('.sw-readout'), { opacity: 0, duration: 0.5 }, '-=0.4');

    return true;
  }

  // ── boot ─────────────────────────────────────────────────────────────────
  window.renderSkyWheel = function (root, opts) {
    opts = opts || {};
    var api = opts.api || (window.shastra && window.shastra.api) || '';
    var out = opts.readout || null;

    var svg = el('svg', {
      viewBox: '0 0 600 600', class: 'sw', role: 'img',
      'aria-label': 'The current sky: the twelve rasi, the twenty-seven nakshatra ' +
                    'divisions, and the nine grahas at their sidereal longitudes, ' +
                    'with the graha drishti drawn between them.',
    });
    root.appendChild(svg);
    drawPlate(svg);

    var live = false;
    var animated = false;

    function paint(data, state) {
      drawSky(svg, data, state);
      drawReadout(svg, data, state);
      var set = wireHighlight(svg, root, data, out);
      if (!animated) {
        animated = animate(svg, root);
        demo(svg, set);
      }
    }

    if (SNAPSHOT) paint(SNAPSHOT, 'snapshot');

    function load() {
      fetch(api + '/api/transits', { mode: 'cors' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (j) {
          var d = j.transits;
          if (!d || !d.grahas) throw new Error('shape');
          live = true;
          root.classList.add('sw-live');
          paint(d, 'live');
          var tick = svg.querySelector('.sw-tick');
          if (tick) { tick.classList.remove('is-beat'); void tick.getBoundingClientRect(); tick.classList.add('is-beat'); }
        })
        .catch(function () {
          if (live || !SNAPSHOT) return;
          drawReadout(svg, SNAPSHOT, 'stale');
        });
    }

    load();
    // Once a minute. The ayanamsa and the readout move; the grahas barely do.
    // Paused while the tab is hidden — there is nobody to see it change.
    setInterval(function () { if (!document.hidden) load(); }, 60000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !live) load();
    });

    return svg;
  };
})();
