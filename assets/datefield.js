/* ─────────────────────────────────────────────────────────────────────────────
   shastra — the birth date field.

   ── why this is not a calendar ──────────────────────────────────────────────

   Every date picker worth considering is built for choosing a date near today:
   you open a month, you click a day. A BIRTH date is the opposite problem.
   Nobody browses to 1990. The native control makes you scroll a year list
   decades back through a dropdown, which is the exact thing that looked bad
   and felt worse, and a library would only restyle that same interaction.

   So this is three fields you type into. Day, month, year, in the order an
   Indian reader says them, with the separators drawn in. Typing is the fast
   path for a date you already know by heart, and there is nothing to browse.

   ── how it keeps the rest of the page working ───────────────────────────────

   The original <input name="date"> is NOT removed. It becomes hidden and stays
   the single source of truth in YYYY-MM-DD, because shastra.js reads
   `q('date').value` and the jsdom suite sets it directly. This file only ever
   writes to it. Nothing downstream knows the control changed.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'];
  var SHORT = MONTHS.map(function (m) { return m.slice(0, 3); });

  function pad(n, w) { return String(n).padStart(w, '0'); }
  function daysIn(y, m) { return new Date(y, m, 0).getDate(); }

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) {
      if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    if (text != null) n.textContent = text;
    return n;
  }

  function enhance(input) {
    if (input.dataset.dfReady) return;
    input.dataset.dfReady = '1';

    var min = input.getAttribute('min') || '1800-01-01';
    var max = input.getAttribute('max') || '2030-12-31';
    var minY = Number(min.slice(0, 4));
    var maxY = Number(max.slice(0, 4));

    // The original input stays, as the value everything else reads.
    input.type = 'hidden';

    var wrap = el('div', { class: 'datefield' });
    var d = el('input', {
      class: 'df-part df-d', type: 'text', inputmode: 'numeric', maxlength: '2',
      placeholder: 'dd', 'aria-label': 'day of birth', autocomplete: 'bday-day',
    });
    var m = el('input', {
      class: 'df-part df-m', type: 'text', inputmode: 'numeric', maxlength: '2',
      placeholder: 'mm', 'aria-label': 'month of birth', autocomplete: 'bday-month',
    });
    var y = el('input', {
      class: 'df-part df-y', type: 'text', inputmode: 'numeric', maxlength: '4',
      placeholder: 'yyyy', 'aria-label': 'year of birth', autocomplete: 'bday-year',
    });
    var echo = el('output', { class: 'df-echo', 'aria-live': 'polite' });

    wrap.appendChild(d);
    wrap.appendChild(el('span', { class: 'df-sep', 'aria-hidden': 'true' }, '/'));
    wrap.appendChild(m);
    wrap.appendChild(el('span', { class: 'df-sep', 'aria-hidden': 'true' }, '/'));
    wrap.appendChild(y);
    wrap.appendChild(echo);
    input.parentNode.insertBefore(wrap, input.nextSibling);

    var parts = [d, m, y];

    function commit() {
      var dd = Number(d.value), mm = Number(m.value), yy = Number(y.value);
      var ok = d.value && m.value && y.value.length === 4 &&
               mm >= 1 && mm <= 12 && yy >= minY && yy <= maxY &&
               dd >= 1 && dd <= daysIn(yy, mm);
      wrap.classList.toggle('is-bad', !!(y.value.length === 4 && !ok));
      if (!ok) {
        input.value = '';
        echo.textContent = '';
        return;
      }
      input.value = yy + '-' + pad(mm, 2) + '-' + pad(dd, 2);
      // Say the date back in words. A mistyped month is invisible as 05 and
      // obvious as "may".
      echo.textContent = dd + ' ' + MONTHS[mm - 1] + ' ' + yy;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function next(from) {
      var i = parts.indexOf(from);
      if (i > -1 && i < parts.length - 1) parts[i + 1].focus();
    }

    parts.forEach(function (p, i) {
      p.addEventListener('input', function () {
        // A month typed as "may" or "sep" is a month.
        if (p === m && /[a-z]/i.test(p.value)) {
          var k = SHORT.indexOf(p.value.slice(0, 3).toLowerCase());
          p.value = k > -1 ? pad(k + 1, 2) : '';
        } else {
          p.value = p.value.replace(/\D/g, '');
        }
        if (p.value.length >= Number(p.getAttribute('maxlength'))) next(p);
        commit();
      });

      p.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !p.value && i > 0) {
          e.preventDefault(); parts[i - 1].focus();
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          var step = e.key === 'ArrowUp' ? 1 : -1;
          var hi = p === d ? 31 : p === m ? 12 : maxY;
          var lo = p === y ? minY : 1;
          var v = Number(p.value || (p === y ? 1990 : 1)) + step;
          if (v > hi) v = lo;
          if (v < lo) v = hi;
          p.value = pad(v, p === y ? 4 : 2);
          commit();
        }
      });

      // Pasting "12/05/1990" anywhere in the group fills the whole thing.
      p.addEventListener('paste', function (e) {
        var t = (e.clipboardData || window.clipboardData).getData('text') || '';
        var bits = t.trim().split(/[^0-9a-z]+/i).filter(Boolean);
        if (bits.length < 3) return;
        e.preventDefault();
        var iso = /^\d{4}$/.test(bits[0]);          // 1990-05-12 vs 12/05/1990
        d.value = pad(Number(iso ? bits[2] : bits[0]), 2);
        var mv = iso ? bits[1] : bits[1];
        if (/[a-z]/i.test(mv)) {
          var k = SHORT.indexOf(String(mv).slice(0, 3).toLowerCase());
          mv = k > -1 ? k + 1 : 0;
        }
        m.value = pad(Number(mv), 2);
        y.value = String(iso ? bits[0] : bits[2]).slice(0, 4);
        commit();
        y.focus();
      });

      p.addEventListener('blur', function () {
        if (p !== y && p.value.length === 1) p.value = pad(p.value, 2);
        commit();
      });
    });

    // If something sets the hidden value directly (a test, a restored form),
    // show it.
    function adopt() {
      var v = input.value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
      y.value = v.slice(0, 4); m.value = v.slice(5, 7); d.value = v.slice(8, 10);
      commit();
    }
    adopt();
    input.addEventListener('shastra:set', adopt);

    wrap.addEventListener('focusin', function () { wrap.classList.add('is-focus'); });
    wrap.addEventListener('focusout', function () { wrap.classList.remove('is-focus'); });
  }

  function boot() {
    document.querySelectorAll('input[type="date"]').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
