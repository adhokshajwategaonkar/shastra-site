/* ─────────────────────────────────────────────────────────────────────────────
   shastra — landing page motion.

   GSAP + ScrollTrigger, pinned, from cdnjs. Enhancement only: if either script
   fails to load, nothing here runs and the page is complete without it.

   ── the one rule ────────────────────────────────────────────────────────────

   MOTION NEVER HIDES CONTENT. Nothing here animates opacity on a block of
   text. Everything starts visible and moves; if a tween never starts, never
   finishes, or is throttled in a background tab, the reader still reads the
   page.

   This is not a style preference, it is a bug fix. The previous version faded
   blocks in from opacity 0 on scroll, and a fast scroll, a full-page
   screenshot or a backgrounded tab could all catch a section mid-tween and
   leave it blank. Whole sections appeared empty: a heading, then nothing.
   Reveal-on-scroll that owns opacity is a reliability problem dressed as
   polish.

   So the vocabulary here is: things slide a little, rules draw themselves,
   and the wheel drifts. Nothing disappears.

   Everything respects prefers-reduced-motion by not starting.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  function boot() {
    var gsap = window.gsap;
    if (!gsap || !window.ScrollTrigger) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var ST = window.ScrollTrigger;
    gsap.registerPlugin(ST);
    document.documentElement.classList.add('has-gsap');

    // ── the headline, line by line ─────────────────────────────────────────
    // The one place a mask is safe: it plays immediately on load, in view, and
    // the lines are legible 150ms in.
    var lines = document.querySelectorAll('.hero-h1 .line > *');
    if (lines.length) {
      gsap.from(lines, { yPercent: 115, duration: 1.05, ease: 'power4.out', stagger: 0.085 });
    }
    var intro = document.querySelectorAll('[data-intro]');
    if (intro.length) {
      gsap.from(intro, { y: 16, duration: 0.8, ease: 'power3.out', stagger: 0.08, delay: 0.4 });
    }

    // ── blocks arrive by moving, not by appearing ──────────────────────────
    ST.batch('.reveal', {
      start: 'top 92%',
      once: true,
      onEnter: function (els) {
        gsap.from(els, {
          y: 18, duration: 0.65, ease: 'power3.out', clearProps: 'transform',
        });
      },
    });

    // ── rules draw themselves ──────────────────────────────────────────────
    // A hairline growing from the left is the almanac's own gesture, and it
    // cannot hide anything because there is nothing behind it.
    gsap.utils.toArray('.grid, .faq, .readout, table.data, .kootas-glance, .pipeline')
      .forEach(function (el) {
        gsap.fromTo(el, { '--rule-scale': 0 }, {
          '--rule-scale': 1, duration: 0.9, ease: 'power2.inOut',
          scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        });
      });

    // ── table rows, in order ───────────────────────────────────────────────
    document.querySelectorAll('table.data tbody').forEach(function (body) {
      var rows = body.querySelectorAll('tr');
      if (rows.length < 2) return;
      gsap.from(rows, {
        y: 8, duration: 0.45, ease: 'power2.out', stagger: 0.04, clearProps: 'transform',
        scrollTrigger: { trigger: body, start: 'top 90%', once: true },
      });
    });

    /* ── the section drawings draw themselves ─────────────────────────────
       Stroke-dash on the lines only. The text inside each drawing is never
       touched, so nothing here can leave a label invisible. */
    gsap.utils.toArray('.section-art .draw-art').forEach(function (art) {
      var strokes = art.querySelectorAll('path, circle, rect');
      gsap.fromTo(strokes,
        { strokeDasharray: 600, strokeDashoffset: 600 },
        {
          strokeDashoffset: 0, duration: 1.2, ease: 'power2.out', stagger: 0.06,
          clearProps: 'strokeDasharray,strokeDashoffset',
          scrollTrigger: { trigger: art, start: 'top 88%', once: true },
        });
    });

    // ── the wheel drifts slower than the page ──────────────────────────────
    var art = document.querySelector('.hero-art');
    if (art && window.innerWidth > 960) {
      gsap.to(art, {
        y: 60, ease: 'none',
        scrollTrigger: { trigger: art, start: 'top 72%', end: 'bottom top', scrub: 0.6 },
      });
    }

    /* ── keep ScrollTrigger honest about where things are ─────────────────
       The page grows after this runs: three web fonts land, and the rasi
       chakra builds itself from a network response. Every start position
       cached before that is wrong, which is how a trigger ends up firing for
       a section the reader is nowhere near. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ST.refresh(); });
    }
    window.addEventListener('load', function () { ST.refresh(); });
    var wheel = document.getElementById('sky');
    if (wheel && window.ResizeObserver) {
      new ResizeObserver(function () { ST.refresh(); }).observe(wheel);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
