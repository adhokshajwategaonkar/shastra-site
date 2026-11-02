/* ─────────────────────────────────────────────────────────────────────────────
   shastra — landing page motion.

   GSAP + ScrollTrigger, both from cdnjs at a pinned version. This file is a
   PROGRESSIVE ENHANCEMENT in the strict sense: if either script fails to load,
   nothing here runs, `html` never gets .has-gsap, and the CSS fallbacks in
   shastra.css (plus the IntersectionObserver in shastra.js) carry the page on
   their own. The content is readable with no JavaScript at all.

   ── what is animated, and what is deliberately not ──────────────────────────

   Motion here is entrance and attention, never decoration and never a claim.
   The headline rises line by line, sections arrive in a stagger as they are
   reached, the wheel drifts slightly slower than the page, and a hairline
   under the nav tracks reading position. That is the whole inventory.

   What is NOT animated: the sky. The rasi chakra is drawn once and then holds,
   because nothing up there moves fast enough to see and a slow spin would be a
   lie told by the one component whose job is to prove the numbers are real.
   See the note at the top of sky-wheel.js. The wheel's own entrance is driven
   from that file, not this one.

   Everything respects prefers-reduced-motion by not starting.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  function boot() {
    var gsap = window.gsap;
    if (!gsap || !window.ScrollTrigger) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(window.ScrollTrigger);

    // Switches off the CSS fallbacks in shastra.css so the two do not both
    // try to own opacity on the same element.
    document.documentElement.classList.add('has-gsap');

    // ── the headline, line by line ─────────────────────────────────────────
    // Each line sits in its own overflow-hidden box, so the type rises out of
    // the rule above it rather than fading in place.
    var lines = document.querySelectorAll('.hero-h1 .line > *');
    if (lines.length) {
      gsap.from(lines, {
        yPercent: 115, duration: 1.05, ease: 'power4.out', stagger: 0.085,
      });
    }

    // The standfirst and the button follow the headline, not the scroll.
    var intro = document.querySelectorAll('[data-intro]');
    if (intro.length) {
      gsap.from(intro, {
        opacity: 0, y: 14, duration: 0.8, ease: 'power3.out',
        stagger: 0.09, delay: 0.42,
      });
    }

    // ── sections arrive as they are reached ────────────────────────────────
    // Batched so that a row of three cards staggers as a row instead of each
    // card firing its own independent tween when it happens to cross the line.
    window.ScrollTrigger.batch('.reveal', {
      start: 'top 88%',
      once: true,
      onEnter: function (els) {
        gsap.from(els, {
          opacity: 0, y: 22, duration: 0.75, ease: 'power3.out', stagger: 0.07,
        });
      },
    });

    // ── table rows, which read better arriving in order ────────────────────
    document.querySelectorAll('table.data tbody').forEach(function (body) {
      var rows = body.querySelectorAll('tr');
      if (rows.length < 2) return;
      gsap.from(rows, {
        opacity: 0, y: 10, duration: 0.5, ease: 'power2.out', stagger: 0.05,
        scrollTrigger: { trigger: body, start: 'top 88%', once: true },
      });
    });

    // ── the wheel drifts slower than the page ──────────────────────────────
    // A page effect, not an astronomical one: it moves in the viewport, never
    // on its own axis.
    var art = document.querySelector('.hero-art');
    if (art && window.innerWidth > 960) {
      gsap.to(art, {
        y: 70, ease: 'none',
        scrollTrigger: { trigger: art, start: 'top 72%', end: 'bottom top', scrub: 0.6 },
      });
    }

    // ── reading position, as a hairline ────────────────────────────────────
    // The same language as every other rule on the page, and it is the only
    // thing here that is continuously in motion.
    var bar = document.getElementById('progress');
    if (bar) {
      gsap.to(bar, {
        scaleX: 1, ease: 'none', transformOrigin: 'left center',
        scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
