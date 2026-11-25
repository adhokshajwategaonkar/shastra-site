/* ─────────────────────────────────────────────────────────────────────────────
   shastra — sound.

   Every sound is synthesised at the moment it plays. Nothing is a file, so
   there is nothing to download and nothing to license. Ported from Adho's
   portfolio, which is the reference for how these should feel: a crisp click
   going down and a softer one coming up, like a real switch, and a heavier
   detent when something settles into place.

   THE SET IS SMALL ON PURPOSE. A sound marks something that changed state: a
   press, a selection, the dial crossing a sign, a result arriving. Hovering,
   scrolling and moving between pages are silent.

   Nothing plays before the visitor's first press or key, because browsers
   refuse to start audio until then, and because a page that makes a noise
   on its own is a page people close. The header carries an on/off switch,
   remembered in localStorage. With no script there is no sound and no switch.

   The API is window.shastraSound.sfx: tap, untap, tick(pitch), detent, ok,
   err. Every call is a no-op while sound is off or not yet unlocked, so
   callers never have to check.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var KEY = 'shastra.snd';
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function put(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  var S = { ctx: null, out: null, buf: null, on: get() !== 'off', armed: false };

  function ctx() {
    if (!S.on || !S.armed) return null;
    try {
      if (!S.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        S.ctx = new AC();
        S.out = S.ctx.createGain();
        S.out.gain.value = 0.34;
        var comp = S.ctx.createDynamicsCompressor();
        comp.threshold.value = -18; comp.ratio.value = 4;
        S.out.connect(comp); comp.connect(S.ctx.destination);
        var n = Math.floor(S.ctx.sampleRate * 0.6);
        S.buf = S.ctx.createBuffer(1, n, S.ctx.sampleRate);
        var d = S.buf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      if (S.ctx.state !== 'running') S.ctx.resume();
      return S.ctx;
    } catch (e) { return null; }
  }

  function noise(c, t, o) {
    var s = c.createBufferSource(); s.buffer = S.buf;
    var f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.f; f.Q.value = o.q || 1;
    var g = c.createGain(); g.gain.setValueAtTime(o.a ? 0.0006 : o.g, t);
    if (o.a) g.gain.exponentialRampToValueAtTime(o.g, t + o.a);
    g.gain.exponentialRampToValueAtTime(0.0006, t + (o.a || 0) + o.dur);
    s.connect(f); f.connect(g); g.connect(S.out);
    s.start(t, Math.random() * 0.4); s.stop(t + (o.a || 0) + o.dur + 0.03);
  }
  function tone(c, t, o) {
    var os = c.createOscillator(); os.type = o.type || 'triangle';
    os.frequency.setValueAtTime(o.f, t); os.frequency.exponentialRampToValueAtTime(o.f2 || o.f, t + o.dur);
    var g = c.createGain();
    if (o.a) { g.gain.setValueAtTime(0.0006, t); g.gain.exponentialRampToValueAtTime(o.g, t + o.a); }
    else g.gain.setValueAtTime(o.g, t);
    g.gain.exponentialRampToValueAtTime(0.0006, t + (o.a || 0) + o.dur);
    var node = g;
    if (o.lp) { var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); node = f; }
    os.connect(g); node.connect(S.out); os.start(t); os.stop(t + (o.a || 0) + o.dur + 0.03);
  }
  function jit() { return 0.93 + Math.random() * 0.14; }

  var sfx = {
    // a press going down: a crisp click with a little body under it
    tap: function () {
      var c = ctx(); if (!c) return; var t = c.currentTime, k = jit();
      noise(c, t, { f: 3100 * k, q: 2.4, g: 0.13, dur: 0.006 });
      tone(c, t + 0.001, { f: 330 * k, f2: 210 * k, g: 0.045, dur: 0.022, type: 'sine' });
    },
    // and coming back up: softer and lower
    untap: function () {
      var c = ctx(); if (!c) return; var t = c.currentTime, k = jit();
      noise(c, t, { f: 2100 * k, q: 2, g: 0.06, dur: 0.005 });
      tone(c, t + 0.001, { f: 190 * k, f2: 150 * k, g: 0.022, dur: 0.02, type: 'sine' });
    },
    // the lightest mark: a nakshatra passing under the Moon, a new day
    tick: function (h) {
      var c = ctx(); if (!c) return;
      noise(c, c.currentTime, { f: 4400 * (h || 1), q: 3.5, g: 0.07, dur: 0.007 });
    },
    // a selection settling into place: a sign change, a menu opening
    detent: function () {
      var c = ctx(); if (!c) return; var t = c.currentTime;
      noise(c, t, { f: 1800, q: 2, g: 0.16, dur: 0.011 });
      tone(c, t, { f: 400, f2: 300, g: 0.05, dur: 0.04, type: 'sine' });
    },
    // two soft notes: a chart, a match or a sade sati result has arrived
    ok: function () {
      var c = ctx(); if (!c) return; var t = c.currentTime;
      tone(c, t, { f: 880, f2: 880, g: 0.035, dur: 0.11, type: 'sine' });
      tone(c, t + 0.07, { f: 1318, f2: 1318, g: 0.03, dur: 0.15, type: 'sine' });
    },
    // a short low buzz: a form that could not be sent
    err: function () {
      var c = ctx(); if (!c) return; var t = c.currentTime;
      tone(c, t, { f: 180, f2: 170, g: 0.04, dur: 0.08, type: 'square', lp: 900 });
    }
  };

  // Unlock on the first real gesture. A silent one-sample buffer is what
  // iOS Safari needs before it will play anything else.
  function unlock() {
    S.armed = true; var c = ctx(); if (!c) return;
    try {
      var b = c.createBuffer(1, 1, 22050), src = c.createBufferSource();
      src.buffer = b; src.connect(c.destination); src.start(0);
    } catch (e) {}
  }
  ['pointerdown', 'keydown', 'touchend', 'click'].forEach(function (t) {
    addEventListener(t, unlock, { capture: true, passive: true });
  });

  // Every press on the page clicks, down and up, once, from here. The
  // listener is on the window in the capture phase so nothing on the page
  // can swallow it, and so the click lands before whatever the press does.
  var pressed = false;
  addEventListener('pointerdown', function (e) {
    if (e.button) return;
    pressed = true; sfx.tap();
  }, { capture: true, passive: true });
  function lift() { if (pressed) { pressed = false; sfx.untap(); } }
  addEventListener('pointerup', lift, { capture: true, passive: true });
  addEventListener('pointercancel', lift, { capture: true, passive: true });
  addEventListener('blur', lift);

  // A <details> opening or closing (the phone menu, the FAQ, "read more")
  // settles into place. `toggle` does not bubble, so it is caught on capture.
  document.addEventListener('toggle', function (e) {
    if (e.target && e.target.tagName === 'DETAILS') sfx.detent();
  }, true);

  function setSound(on) {
    S.on = on; put(on ? 'on' : 'off');
    if (on) { S.armed = true; sfx.detent(); }
    paint();
  }

  // The switch. Injected rather than written into every page's header, so
  // the generated policy pages pick it up with no template change beyond the
  // script tag, and a page with no script shows no switch that does nothing.
  var ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">'
    + '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor"/>'
    + '<path class="snd-w" d="M15.5 9.2a4 4 0 0 1 0 5.6M18 7a7 7 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.6"/>'
    + '<path class="snd-x" d="M15.5 9.5l5 5M20.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/>'
    + '</svg>';
  var btns = [];
  function paint() {
    btns.forEach(function (b) {
      b.setAttribute('aria-pressed', String(S.on));
      b.setAttribute('aria-label', S.on ? 'sound is on' : 'sound is off');
      b.title = S.on ? 'sound is on. press to turn it off.' : 'sound is off. press to turn it on.';
      var t = b.querySelector('.snd-t'); if (t) t.textContent = S.on ? 'sound on' : 'sound off';
    });
  }
  // Two copies: an icon in the header on wide screens, and a labelled row in
  // the phone menu, because at 320px the header has no 44px left to give.
  function make(cls, html) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.innerHTML = html;
    b.addEventListener('click', function () { setSound(!S.on); });
    btns.push(b); return b;
  }
  function mount() {
    var nav = document.querySelector('.nav nav');
    if (!nav || nav.querySelector('.snd')) return;
    var menu = nav.querySelector('.nav-menu');
    nav.insertBefore(make('snd', ICON), menu || null);
    var list = menu && menu.querySelector('.nav-menu-list');
    if (list) list.appendChild(make('snd snd-row', ICON + '<span class="snd-t"></span>'));
    paint();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  window.shastraSound = { sfx: sfx, setSound: setSound, get on() { return S.on; } };
})();
