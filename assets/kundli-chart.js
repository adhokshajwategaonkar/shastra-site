/* ─────────────────────────────────────────────────────────────────────────────
   shastra — North Indian kundli renderer.

   Draws the diamond chart every Indian visitor recognises. Shared by /kundli
   and /kundli-matching, which is the only reason it is a separate file.

   House geometry, for the next person to touch this: in the North Indian
   style the HOUSES are fixed on the page and the SIGNS move. House 1 is always
   the top-centre diamond, and the numbering runs anticlockwise from there. The
   sign number written in each house is what tells you the lagna. Getting this
   backwards produces a chart that looks right and is wrong, which is the worst
   kind of wrong.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  // Mirrors the tokens in shastra.css. Read once, not per call: a chart is
  // re-rendered on every submit and these never change inside a page load.
  var css = getComputedStyle(document.documentElement);
  function token(name, fallback) {
    return (css.getPropertyValue(name) || '').trim() || fallback;
  }
  var INK   = token('--ink', '#22211C');
  var SOFT  = token('--ink-soft', '#55524A');
  var FAINT = token('--ink-faint', '#6F6B60');
  var MARK  = token('--mark', '#B4342A');
  var MONO  = token('--mono', 'ui-monospace, monospace');

  // Centroids for a 320×320 viewBox with a 10px margin. Order is house 1..12.
  var SEATS = [
    { x: 160, y: 82 },   // 1  top-centre diamond
    { x: 90,  y: 48 },   // 2  top-left triangle
    { x: 48,  y: 90 },   // 3  left-top triangle
    { x: 82,  y: 160 },  // 4  left-centre diamond
    { x: 48,  y: 230 },  // 5  left-bottom triangle
    { x: 90,  y: 272 },  // 6  bottom-left triangle
    { x: 160, y: 238 },  // 7  bottom-centre diamond
    { x: 230, y: 272 },  // 8  bottom-right triangle
    { x: 272, y: 230 },  // 9  right-bottom triangle
    { x: 238, y: 160 },  // 10 right-centre diamond
    { x: 272, y: 90 },   // 11 right-top triangle
    { x: 230, y: 48 },   // 12 top-right triangle
  ];

  var ABBR = {
    sun: 'Su', moon: 'Mo', mars: 'Ma', mercury: 'Me', jupiter: 'Ju',
    venus: 'Ve', saturn: 'Sa', rahu: 'Ra', ketu: 'Ke',
  };

  function el(name, attrs, text) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  /**
   * @param {SVGElement} svg    an empty <svg viewBox="0 0 320 320">
   * @param {object} chart      the /api/chart payload's `chart`
   * @param {object} [opts]     { navamsa: true } to draw the D9 instead
   */
  window.renderKundli = function (svg, chart, opts) {
    opts = opts || {};
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var lagnaSign = chart.lagna.signIndex;
    var placements = {}; // house number → [graha keys]

    if (opts.navamsa) {
      // The navamsa is a chart in its own right: the D9 lagna sits in house 1
      // and every graha is placed by its own navamsa sign.
      lagnaSign = chart.lagna.navamsaSignIndex;
      Object.keys(chart.grahas).forEach(function (k) {
        var g = chart.grahas[k];
        var h = ((g.navamsaSignIndex - lagnaSign) + 12) % 12 + 1;
        (placements[h] = placements[h] || []).push(k);
      });
    } else {
      Object.keys(chart.grahas).forEach(function (k) {
        var h = chart.grahas[k].house;
        (placements[h] = placements[h] || []).push(k);
      });
    }

    // frame — a hairline in ink, drawn the way it would be ruled on paper.
    // No radius: a kundli is not a rounded rectangle.
    var frame = el('g', { fill: 'none', stroke: INK, 'stroke-width': '0.9', opacity: '0.85' });
    frame.appendChild(el('rect', { x: 10, y: 10, width: 300, height: 300 }));
    frame.appendChild(el('path', { d: 'M10 10 L310 310 M310 10 L10 310' }));
    frame.appendChild(el('path', { d: 'M160 10 L310 160 L160 310 L10 160 Z' }));
    svg.appendChild(frame);

    for (var house = 1; house <= 12; house += 1) {
      var seat = SEATS[house - 1];
      var signIndex = (lagnaSign + house - 1) % 12;
      var g = el('g', {});

      // The sign number, small and dim — it is a reference, not the content.
      g.appendChild(el('text', {
        x: seat.x, y: seat.y - 13,
        'text-anchor': 'middle',
        fill: FAINT, 'font-family': MONO, 'font-size': '9.5',
      }, String(signIndex + 1)));

      var here = placements[house] || [];
      // Two per row keeps four grahas inside the narrow triangles.
      for (var i = 0; i < here.length; i += 1) {
        var key = here[i];
        var row = Math.floor(i / 2);
        var col = i % 2;
        var wide = here.length === 1;
        var t = el('text', {
          x: seat.x + (wide ? 0 : col === 0 ? -14 : 14),
          y: seat.y + 3 + row * 14,
          'text-anchor': 'middle',
          fill: opts.navamsa ? SOFT : INK,
          'font-family': MONO,
          'font-size': '12',
          'font-weight': '500',
        }, ABBR[key] || key);
        if (!opts.navamsa && chart.grahas[key].retrograde) {
          // Retrograde matters enough to mark, and the classical mark is a
          // trailing (R). Mean nodes are excluded upstream — they are always
          // retrograde, so flagging them alongside true retrogrades misleads.
          //
          // It is set as its own <tspan> in vermilion: on paper this is the
          // kind of thing the second plate exists for.
          t.appendChild(el('tspan', { fill: MARK, 'font-size': '9', dy: '-3' }, 'R'));
        }
        g.appendChild(t);
      }
      svg.appendChild(g);
    }

    // The lagna is the one value the whole chart hangs off, so it is the one
    // thing here that gets the second plate.
    svg.appendChild(el('text', {
      x: 160, y: 58, 'text-anchor': 'middle',
      fill: opts.navamsa ? FAINT : MARK,
      'font-family': MONO, 'font-size': '8.5', 'letter-spacing': '1.6',
    }, opts.navamsa ? 'D9' : 'ASC'));
  };
})();
