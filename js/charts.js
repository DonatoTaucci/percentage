/* charts.js — grafici SVG inline, nessuna libreria esterna. */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function colorFor(pct) {
    if (pct >= 115) return 'var(--bad)';
    if (pct >= 100) return 'var(--ok)';
    if (pct >= 85) return 'var(--accent)';
    if (pct >= 60) return 'var(--warn)';
    return 'var(--bad)';
  }

  /** Anello percentuale. */
  function donut(pct, opts) {
    opts = opts || {};
    var size = opts.size || 132;
    var stroke = opts.stroke || 13;
    var r = (size - stroke) / 2;
    var c = 2 * Math.PI * r;
    var value = Math.max(0, Math.min(pct || 0, 200));
    var shown = Math.min(value, 100);
    var over = value > 100 ? Math.min(value - 100, 100) : 0;
    var col = opts.color || colorFor(value);
    var label = opts.label !== undefined ? opts.label : Calc.fmtPct(pct);

    return '' +
      '<svg class="donut" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + esc(label) + '">' +
        '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--bg-elev-2)" stroke-width="' + stroke + '"/>' +
        '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + stroke + '"' +
          ' stroke-dasharray="' + (c * shown / 100).toFixed(2) + ' ' + c.toFixed(2) + '"' +
          ' stroke-linecap="round" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
        (over > 0
          ? '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + (r - stroke - 3) + '" fill="none" stroke="var(--violet)" stroke-width="4"' +
            ' stroke-dasharray="' + (2 * Math.PI * (r - stroke - 3) * over / 100).toFixed(2) + ' 9999"' +
            ' stroke-linecap="round" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>'
          : '') +
        '<text x="50%" y="' + (size / 2 - 2) + '" text-anchor="middle" style="fill:var(--txt);font-size:' + (size / 5.2).toFixed(0) + 'px;font-weight:700">' + esc(label) + '</text>' +
        (opts.sub ? '<text x="50%" y="' + (size / 2 + 17) + '" text-anchor="middle" style="font-size:11px">' + esc(opts.sub) + '</text>' : '') +
      '</svg>';
  }

  /**
   * Istogramma verticale.
   * data: [{ label, value, target, highlight }]
   */
  function bars(data, opts) {
    opts = opts || {};
    var w = opts.width || 640;
    var h = opts.height || 190;
    var padB = 26, padT = 14, padL = 6, padR = 6;
    var innerH = h - padB - padT;
    var n = Math.max(data.length, 1);
    var slot = (w - padL - padR) / n;
    var bw = Math.max(6, Math.min(slot * 0.6, 34));

    var maxV = data.reduce(function (m, d) {
      return Math.max(m, d.value || 0, d.target || 0);
    }, 1);
    maxV = maxV * 1.12;

    var out = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="none" role="img">';

    // linee guida orizzontali
    [0, 0.5, 1].forEach(function (f) {
      var y = padT + innerH * (1 - f);
      out += '<line class="grid-line" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + y.toFixed(1) + '"/>';
    });

    data.forEach(function (d, i) {
      var x = padL + slot * i + (slot - bw) / 2;
      var v = Math.max(0, d.value || 0);
      var bh = Math.max(v > 0 ? 3 : 0, innerH * (v / maxV));
      var y = padT + innerH - bh;
      var col = d.color || (d.highlight ? 'var(--accent)' : 'var(--accent-soft)');
      out += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="4" fill="' + col + '"><title>' + esc(d.title || (d.label + ': ' + v)) + '</title></rect>';

      if (d.target > 0) {
        var ty = padT + innerH - innerH * (d.target / maxV);
        out += '<line x1="' + (x - 3).toFixed(1) + '" y1="' + ty.toFixed(1) + '" x2="' + (x + bw + 3).toFixed(1) + '" y2="' + ty.toFixed(1) + '" stroke="var(--txt-dim)" stroke-width="1.5" stroke-dasharray="3 3" opacity=".8"/>';
      }
      if (d.label) {
        out += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (h - 8) + '" text-anchor="middle">' + esc(d.label) + '</text>';
      }
    });

    out += '</svg>';
    return out;
  }

  /**
   * Spezzata con area, per gli andamenti percentuali.
   * data: [{ label, value }]
   */
  function line(data, opts) {
    opts = opts || {};
    var w = opts.width || 640;
    var h = opts.height || 170;
    var padB = 24, padT = 12, padL = 10, padR = 10;
    var innerH = h - padB - padT;
    var innerW = w - padL - padR;
    var n = data.length;
    if (n === 0) return '<div class="empty small">Nessun dato</div>';

    var maxV = Math.max(120, data.reduce(function (m, d) { return Math.max(m, d.value); }, 0) * 1.1);
    var stepX = n > 1 ? innerW / (n - 1) : 0;

    function px(i) { return padL + stepX * i; }
    function py(v) { return padT + innerH * (1 - Math.max(0, Math.min(v, maxV)) / maxV); }

    var pts = data.map(function (d, i) { return px(i).toFixed(1) + ',' + py(d.value).toFixed(1); });

    var out = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="none" role="img">';

    // riferimento 100%
    var y100 = py(100);
    out += '<line x1="' + padL + '" y1="' + y100.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + y100.toFixed(1) + '" stroke="var(--ok)" stroke-width="1.2" stroke-dasharray="4 4" opacity=".75"/>';
    out += '<text x="' + (w - padR) + '" y="' + (y100 - 5).toFixed(1) + '" text-anchor="end" style="fill:var(--ok)">100%</text>';

    if (n > 1) {
      out += '<polygon points="' + px(0).toFixed(1) + ',' + (padT + innerH) + ' ' + pts.join(' ') + ' ' + px(n - 1).toFixed(1) + ',' + (padT + innerH) + '" fill="var(--accent-soft)"/>';
      out += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
    }

    data.forEach(function (d, i) {
      out += '<circle cx="' + px(i).toFixed(1) + '" cy="' + py(d.value).toFixed(1) + '" r="3.6" fill="var(--accent)"><title>' + esc(d.label + ': ' + Calc.fmtPct(d.value)) + '</title></circle>';
      var every = Math.ceil(n / 8);
      if (i % every === 0 || i === n - 1) {
        out += '<text x="' + px(i).toFixed(1) + '" y="' + (h - 7) + '" text-anchor="middle">' + esc(d.label) + '</text>';
      }
    });

    out += '</svg>';
    return out;
  }

  /** Barra orizzontale semplice (0-100). */
  function meter(pct, color) {
    var v = Math.max(0, Math.min(pct, 100));
    return '<div class="bar"><span style="width:' + v.toFixed(1) + '%;background:' + (color || colorFor(pct)) + '"></span></div>';
  }

  global.Charts = { donut: donut, bars: bars, line: line, meter: meter, colorFor: colorFor };
})(window);
