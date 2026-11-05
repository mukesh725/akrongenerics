/* AIRO platform — journey state + light interactivity.
   State travels in the URL so the prototype works from file:// with no server. */

(function () {
  'use strict';

  var AIRO = window.AIRO = {};

  // ---------- URL state ----------
  AIRO.get = function (k, d) {
    var v = new URLSearchParams(location.search).get(k);
    return v === null ? (d === undefined ? null : d) : v;
  };
  AIRO.link = function (base, extra) {
    var p = new URLSearchParams(location.search);
    for (var k in extra) { if (extra[k] === null) p.delete(k); else p.set(k, extra[k]); }
    var q = p.toString();
    return base + (q ? '?' + q : '');
  };
  // Carry existing query params through any link marked data-carry
  function carry() {
    var q = location.search;
    if (!q) return;
    document.querySelectorAll('a[data-carry]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^https?:/.test(href)) return;
      var extra = {};
      try {
        a.dataset.set && a.dataset.set.split(',').forEach(function (pair) {
          var kv = pair.split(':'); extra[kv[0]] = kv[1];
        });
      } catch (e) {}
      var p = new URLSearchParams(location.search);
      for (var k in extra) p.set(k, extra[k]);
      var base = href.split('?')[0];
      a.setAttribute('href', base + '?' + p.toString());
    });
  }

  // ---------- questionnaire schemas (data, not code) ----------
  AIRO.SCHEMAS = {
    diabetes: {
      label: 'Type 2 Diabetes',
      colour: '#1E3A5F',
      ai: true,
      fields: [
        { id: 'age', label: 'Age', type: 'number', hint: 'Years', min: 18, max: 100, weight: 0.2 },
        { id: 'weight', label: 'Weight', type: 'number', hint: 'Kilograms', min: 30, max: 250, weight: 0.2 },
        { id: 'hba1c', label: 'Most recent HbA1c', type: 'number', hint: 'Percent — leave blank if unknown', min: 4, max: 15, step: 0.1, weight: 0.35 },
        { id: 'meds', label: 'Current medication', type: 'pills', options: ['None', 'Metformin', 'Sulfonylurea', 'Insulin', 'Other'], weight: 0.15 },
        { id: 'symptoms', label: 'Symptoms in the last 30 days', type: 'pills', multi: true,
          options: ['Excessive thirst', 'Frequent urination', 'Fatigue', 'Blurred vision', 'Slow healing', 'None'], weight: 0.1 }
      ]
    },
    hairloss: {
      label: 'Hair Loss',
      colour: '#4C2F3C',
      ai: false,
      fields: [
        { id: 'gender', label: 'Gender', type: 'pills', options: ['Male', 'Female', 'Other'] },
        { id: 'family', label: 'Family history of hair loss', type: 'pills', options: ['Yes', 'No', 'Unsure'] },
        { id: 'stress', label: 'Current stress level', type: 'pills', options: ['Low', 'Moderate', 'High'] },
        { id: 'meds2', label: 'Current medication', type: 'text', hint: 'List anything you take regularly' },
        { id: 'duration', label: 'How long has this been happening?', type: 'pills',
          options: ['Under 6 months', '6–12 months', '1–3 years', 'Over 3 years'] },
        { id: 'photos', label: 'Photographs', type: 'file', hint: 'Crown and hairline — required for dermatology review' }
      ]
    },
    weight: {
      label: 'Weight Management',
      colour: '#4B5230',
      ai: true,
      fields: [
        { id: 'age', label: 'Age', type: 'number', hint: 'Years', min: 18, max: 100, weight: 0.15 },
        { id: 'height', label: 'Height', type: 'number', hint: 'Centimetres', min: 120, max: 220, weight: 0.15 },
        { id: 'weight', label: 'Weight', type: 'number', hint: 'Kilograms', min: 30, max: 250, weight: 0.3 },
        { id: 'cond', label: 'Existing conditions', type: 'pills', multi: true,
          options: ['None', 'Hypertension', 'Diabetes', 'Thyroid', 'PCOS', 'Sleep apnoea'], weight: 0.25 },
        { id: 'goal', label: 'Primary goal', type: 'pills', options: ['Lose weight', 'Maintain', 'Metabolic health'], weight: 0.15 }
      ]
    },
    skin: {
      label: 'Skin & Acne',
      colour: '#1F5E4B',
      ai: false,
      fields: [
        { id: 'type', label: 'Skin type', type: 'pills', options: ['Oily', 'Dry', 'Combination', 'Sensitive'] },
        { id: 'sev', label: 'Severity', type: 'pills', options: ['Mild', 'Moderate', 'Severe'] },
        { id: 'tried', label: 'Treatments already tried', type: 'text', hint: 'Topicals, antibiotics, anything else' },
        { id: 'photos', label: 'Photographs', type: 'file', hint: 'Affected areas in natural light' }
      ]
    }
  };

  // ---------- render a questionnaire from its schema ----------
  AIRO.renderQuestionnaire = function (mount, key) {
    var s = AIRO.SCHEMAS[key];
    if (!s) { mount.innerHTML = '<p class="muted">Unknown condition.</p>'; return null; }
    var html = '';
    s.fields.forEach(function (f) {
      html += '<div class="field" data-id="' + f.id + '">';
      html += '<label for="' + f.id + '">' + f.label + '</label>';
      if (f.hint) html += '<div class="hint">' + f.hint + '</div>';
      if (f.type === 'number') {
        html += '<input type="number" id="' + f.id + '" min="' + (f.min || 0) + '" max="' + (f.max || 999) +
                '" step="' + (f.step || 1) + '" placeholder="—">';
      } else if (f.type === 'text') {
        html += '<input type="text" id="' + f.id + '" placeholder="—">';
      } else if (f.type === 'file') {
        html += '<input type="file" id="' + f.id + '" accept="image/*" multiple>';
      } else if (f.type === 'pills') {
        html += '<div class="pills">';
        f.options.forEach(function (o, i) {
          var t = f.multi ? 'checkbox' : 'radio';
          html += '<label><input type="' + t + '" name="' + f.id + '" value="' + o + '">' + o + '</label>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    mount.innerHTML = html;
    return s;
  };

  // ---------- risk score ----------
  AIRO.score = function (key) {
    var s = AIRO.SCHEMAS[key];
    if (!s || !s.ai) return null;
    var total = 0, filled = 0;
    s.fields.forEach(function (f) {
      if (!f.weight) return;
      var el = document.getElementById(f.id);
      var v = null;
      if (el && el.value) v = parseFloat(el.value);
      var checked = document.querySelectorAll('input[name="' + f.id + '"]:checked');
      if (checked.length) v = checked.length;
      if (v !== null && !isNaN(v)) {
        filled++;
        var norm = f.max ? Math.min(1, Math.max(0, (v - (f.min || 0)) / ((f.max || 100) - (f.min || 0)))) : Math.min(1, v / 5);
        total += norm * f.weight;
      }
    });
    var pct = Math.round(Math.min(0.95, Math.max(0.12, total)) * 100);
    return { value: pct, answered: filled, band: pct < 35 ? 'Low' : pct < 65 ? 'Moderate' : 'Elevated' };
  };

  // ---------- boot ----------
  document.addEventListener('DOMContentLoaded', function () {
    carry();

    // questionnaire page
    var mount = document.getElementById('q-mount');
    if (mount) {
      var key = AIRO.get('c', 'diabetes');
      var s = AIRO.renderQuestionnaire(mount, key);
      var title = document.getElementById('q-title');
      if (title && s) title.textContent = s.label;
      var badge = document.getElementById('q-ai');
      if (badge && s) badge.style.display = s.ai ? '' : 'none';
      var next = document.getElementById('q-next');
      if (next) next.setAttribute('href', 'assessment.html?c=' + key);
    }

    // assessment page
    var ring = document.getElementById('score-ring');
    if (ring) {
      var k = AIRO.get('c', 'diabetes');
      var sc = AIRO.SCHEMAS[k];
      // deterministic demo value per condition
      var demo = { diabetes: 62, weight: 48, hairloss: null, skin: null }[k];
      if (sc && sc.ai && demo) {
        ring.style.setProperty('--v', demo);
        document.getElementById('score-val').textContent = demo;
        document.getElementById('score-band').textContent = demo < 35 ? 'Low risk' : demo < 65 ? 'Moderate risk' : 'Elevated risk';
      } else {
        var box = document.getElementById('score-box');
        if (box) box.innerHTML = '<div class="note"><b>No automated score for this condition</b>' +
          'Dermatological assessments route straight to a clinician — photographs and history carry the signal, not a numeric model.</div>';
      }
      var lbl = document.getElementById('cond-label');
      if (lbl && sc) lbl.textContent = sc.label;
    }

    // condition select page
    document.querySelectorAll('[data-cond]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        document.querySelectorAll('[data-cond]').forEach(function (o) { o.classList.remove('sel'); });
        el.classList.add('sel');
        var go = document.getElementById('cond-next');
        if (go) { go.removeAttribute('disabled'); go.setAttribute('href', 'questionnaire.html?c=' + el.dataset.cond); }
      });
    });

    // generic condition label fill
    document.querySelectorAll('[data-fill-cond]').forEach(function (el) {
      var k = AIRO.get('c', 'diabetes');
      var sc = AIRO.SCHEMAS[k];
      if (sc) el.textContent = sc.label;
    });

    // Apple-style reveal & rolling number animations
    var revealSections = document.querySelectorAll('.why-akron-sec, .benefits-sec, .statement, .pharmacy-sec, #categories, .compliance-sec, .faq-sec, .closing');

    // FAQ Accordion Interactivity
    var faqItems = document.querySelectorAll('.faq-accordion-item');
    faqItems.forEach(function (item) {
      var trigger = item.querySelector('.faq-accordion-trigger');
      if (!trigger) return;
      trigger.addEventListener('click', function () {
        var isActive = item.classList.contains('active');
        faqItems.forEach(function (other) {
          other.classList.remove('active');
          var ot = other.querySelector('.faq-accordion-trigger');
          if (ot) ot.setAttribute('aria-expanded', 'false');
        });
        if (!isActive) {
          item.classList.add('active');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    });

    if ('IntersectionObserver' in window) {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            entry.target.querySelectorAll('.roll-num:not(.has-rolled)').forEach(function (el) {
              animateNumber(el);
            });
            revealObserver.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px'
      });
      revealSections.forEach(function (sec) { revealObserver.observe(sec); });
    } else {
      revealSections.forEach(function (sec) { sec.classList.add('is-revealed'); });
      document.querySelectorAll('.roll-num').forEach(function (el) {
        var target = el.getAttribute('data-target');
        var suffix = el.getAttribute('data-suffix') || '';
        if (target) el.textContent = parseInt(target, 10).toLocaleString('en-US') + suffix;
      });
    }

    function animateNumber(el) {
      el.classList.add('has-rolled');
      var target = parseInt(el.getAttribute('data-target'), 10);
      var suffix = el.getAttribute('data-suffix') || '';
      if (isNaN(target)) return;

      var duration = 1800;
      var startTimestamp = null;
      el.textContent = '0' + suffix;

      function step(timestamp) {
        if (!startTimestamp) startTimestamp = timestamp;
        var progress = Math.min((timestamp - startTimestamp) / duration, 1);
        var ease = 1 - Math.pow(1 - progress, 4);
        var current = Math.floor(ease * target);
        el.textContent = current.toLocaleString('en-US') + suffix;
        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          el.textContent = target.toLocaleString('en-US') + suffix;
        }
      }
      window.requestAnimationFrame(step);
    }
  });
})();
