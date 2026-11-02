/* ─────────────────────────────────────────────────────────────────────────────
   shastra — public site behaviour.

   Everything here is progressive enhancement. The pages are readable, and the
   FAQ answers are extractable by a crawler, with this file blocked or broken.
   Only the calculators need it.

   Two things this file exists to handle, both consequences of the deployment
   shape (static pages on GitHub Pages, API on a free Render instance):

   1. PRE-WARM. A free Render service sleeps and takes ~50s to wake. Fetching
      /health the moment the page loads means the instance is usually awake by
      the time someone has finished typing their birth details. When it isn't,
      we say so instead of showing a spinner that looks like a bug.
   2. CROSS-ORIGIN. The site and the API are on different origins by design
      (Animus gotcha #8), so every call is CORS. The server allows this origin
      explicitly — see server/src/index.js.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  document.documentElement.classList.add('js');

  // ── config ────────────────────────────────────────────────────────────────
  // ⚑ ADHO: set this to the real Render URL once the service exists. It is the
  // only value in the whole site that has to change on deploy — and
  // ./retarget-site.sh rewrites it here and in the five "open shastra" buttons
  // in one pass, so change it with that rather than by hand.
  var API = 'https://shastra.onrender.com';

  // Served from a local http.server (npm run site:serve), talk to a local API
  // instead. Without this, checking the site locally can only ever verify the
  // layout — every calculator would call the production host, so the one thing
  // worth testing before a deploy is the one thing you could not test.
  // localhost:4173 is already in the server's CORS allowlist (config.SITE).
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    API = location.protocol + '//' + location.hostname + ':3000';
  }

  var APP = API; // one Express service serves both the API and the PWA.

  var S = (window.shastra = {
    api: API,
    app: APP,
    warm: 'cold', // cold → warming → warm | unreachable
  });

  // ── pre-warm ──────────────────────────────────────────────────────────────
  var warmWaiters = [];

  function setWarm(state) {
    S.warm = state;
    document.querySelectorAll('[data-warm]').forEach(function (el) {
      el.setAttribute('data-warm', state);
    });
    if (state === 'warm' || state === 'unreachable') {
      warmWaiters.splice(0).forEach(function (fn) { fn(state); });
    }
  }

  function prewarm() {
    setWarm('warming');
    var t0 = Date.now();
    fetch(API + '/health', { mode: 'cors', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('health ' + r.status)); })
      .then(function () {
        setWarm('warm');
        if (Date.now() - t0 > 4000) console.info('[shastra] api woke in ' + (Date.now() - t0) + 'ms');
      })
      .catch(function () { setWarm('unreachable'); });
  }

  /** Resolve once the API is awake, or after `ms`, whichever comes first. */
  S.whenWarm = function (ms) {
    if (S.warm === 'warm' || S.warm === 'unreachable') return Promise.resolve(S.warm);
    return new Promise(function (resolve) {
      var done = false;
      var finish = function (v) { if (!done) { done = true; resolve(v); } };
      warmWaiters.push(finish);
      setTimeout(function () { finish('timeout'); }, ms || 3000);
    });
  };

  // ── fetch helper ──────────────────────────────────────────────────────────
  /**
   * Every network failure a visitor can actually hit, translated into a
   * sentence in the product voice. "Failed to fetch" is not a sentence.
   */
  S.call = function (path, opts) {
    opts = opts || {};
    var ctrl = new AbortController();
    // 60s, not 10s: a cold Render instance legitimately needs ~50s on the very
    // first request. Aborting at 10s would fail exactly the visitors who
    // arrived first, which is the wrong half to lose.
    var timer = setTimeout(function () { ctrl.abort(); }, opts.timeout || 60000);

    return fetch(API + path, {
      method: opts.body ? 'POST' : 'GET',
      mode: 'cors',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    })
      .then(function (r) {
        clearTimeout(timer);
        return r.json().then(
          function (data) {
            if (!r.ok) {
              if (r.status === 429) throw new Error('too many charts too fast. give it a minute.');
              throw new Error(data && data.error ? data.error : 'that did not compute. try again.');
            }
            return data;
          },
          function () { throw new Error('the server answered with something we could not read.'); }
        );
      })
      .catch(function (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') throw new Error('the server is taking too long. it may be waking up, so try once more.');
        if (err instanceof TypeError) throw new Error('could not reach shastra. check your connection and try again.');
        throw err;
      });
  };

  // ── place autocomplete ────────────────────────────────────────────────────
  /**
   * Wires a text input to /api/places. Keeps the resolved lat/lon/tz on the
   * input's dataset so a chosen place survives the visitor editing the label,
   * and so a typed-but-unchosen place still resolves server-side by name.
   */
  S.placeField = function (input) {
    var box = document.createElement('div');
    box.className = 'suggestions';
    box.hidden = true;
    box.setAttribute('role', 'listbox');
    input.parentNode.appendChild(box);

    var timer = null;
    var items = [];
    var cursor = -1;

    function close() { box.hidden = true; box.innerHTML = ''; items = []; cursor = -1; input.setAttribute('aria-expanded', 'false'); }

    function choose(p) {
      input.value = p.label;
      input.dataset.lat = p.lat;
      input.dataset.lon = p.lon;
      input.dataset.tz = p.tz || '';
      close();
    }

    function render() {
      box.innerHTML = '';
      items.forEach(function (p, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = p.label;
        b.setAttribute('role', 'option');
        b.setAttribute('aria-selected', String(i === cursor));
        b.addEventListener('mousedown', function (e) { e.preventDefault(); choose(p); });
        box.appendChild(b);
      });
      box.hidden = items.length === 0;
      input.setAttribute('aria-expanded', String(items.length > 0));
    }

    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');

    input.addEventListener('input', function () {
      // A typed edit invalidates a previously chosen pin.
      delete input.dataset.lat;
      delete input.dataset.lon;
      delete input.dataset.tz;

      var q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 2) return close();
      timer = setTimeout(function () {
        S.call('/api/places?q=' + encodeURIComponent(q), { timeout: 12000 })
          .then(function (d) { items = (d && d.results) || []; cursor = -1; render(); })
          .catch(function () { close(); }); // silent: autocomplete is a nicety, typing the name still works
      }, 180);
    });

    input.addEventListener('keydown', function (e) {
      if (box.hidden || !items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        cursor = (cursor + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
        render();
      } else if (e.key === 'Enter' && cursor >= 0) {
        e.preventDefault();
        choose(items[cursor]);
      } else if (e.key === 'Escape') {
        close();
      }
    });

    input.addEventListener('blur', function () { setTimeout(close, 120); });
  };

  /** Read a birth-details fieldset into the payload shape /api/chart expects. */
  S.birthFrom = function (scope, prefix) {
    var q = function (n) { return scope.querySelector('[name="' + (prefix || '') + n + '"]'); };
    var place = q('place');
    var timeEl = q('time');
    var unknown = q('timeUnknown');
    var timeKnown = !(unknown && unknown.checked);

    var payload = {
      date: q('date').value,
      time: timeKnown ? timeEl.value : null,
      timeKnown: timeKnown && !!timeEl.value,
    };

    if (place.dataset.lat && place.dataset.lon) {
      payload.lat = Number(place.dataset.lat);
      payload.lon = Number(place.dataset.lon);
      payload.placeLabel = place.value;
      if (place.dataset.tz) payload.tz = place.dataset.tz;
    } else {
      payload.place = place.value.trim();
    }
    return payload;
  };

  // ── small helpers ─────────────────────────────────────────────────────────
  S.busy = function (btn, on, labelWhenBusy) {
    if (on) {
      btn.dataset.idle = btn.dataset.idle || btn.textContent;
      btn.textContent = labelWhenBusy || 'computing…';
      btn.setAttribute('aria-disabled', 'true');
    } else {
      if (btn.dataset.idle) btn.textContent = btn.dataset.idle;
      btn.removeAttribute('aria-disabled');
    }
  };

  S.fail = function (el, message) {
    el.textContent = message;
    el.hidden = false;
  };

  S.clearFail = function (el) { el.textContent = ''; el.hidden = true; };

  S.titleCase = function (s) {
    return String(s || '').replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
  };

  S.fmtDate = function (iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  /** Count a number up. Decoration only — the value is already correct in the DOM. */
  S.countUp = function (el, to, decimals) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = to.toFixed(decimals || 0);
      return;
    }
    var start = performance.now();
    var dur = 900;
    (function frame(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (to * eased).toFixed(decimals || 0);
      if (t < 1) requestAnimationFrame(frame);
    })(start);
  };

  // ── reveal on scroll ──────────────────────────────────────────────────────
  function reveals() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );
    els.forEach(function (el) { io.observe(el); });
  }

  // ── boot ──────────────────────────────────────────────────────────────────
  function boot() {
    prewarm();
    reveals();
    // Mark the current page in the nav without hand-editing seven files.
    var here = location.pathname.replace(/index\.html$/, '');
    document.querySelectorAll('.nav nav a').forEach(function (a) {
      var target = new URL(a.getAttribute('href'), location.href).pathname.replace(/index\.html$/, '');
      if (target === here) a.setAttribute('aria-current', 'page');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
