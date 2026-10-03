/* Von der Geraden zur Attention — shared helpers for every chapter.
   Classic script (no module) so pages also work from file://. Exposes one global: S. */
(function () {
  'use strict';
  const S = (window.S = {});

  // ---------- theme tokens ----------
  const TOKENS = [
    'bg', 'surface', 'surface-2', 'fg', 'fg-2', 'muted', 'rule', 'grid', 'axis',
    'accent', 'accent-wash', 'data', 'model', 'error', 'grad', 'model-wash', 'error-wash',
    'col1', 'col2', 'probe',
    'font-display', 'font-body', 'font-mono', 'font-math',
  ];
  S.c = {};
  S.dark = true;

  function hexLum(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 0;
    const n = parseInt(m[1], 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  }
  function readTokens() {
    const cs = getComputedStyle(document.documentElement);
    for (const t of TOKENS) S.c[t] = cs.getPropertyValue('--' + t).trim();
    S.dark = hexLum(S.c.bg) < 0.5;
    buildRamps();
  }

  const themeSubs = new Set();
  S.onTheme = (fn) => themeSubs.add(fn);
  function themeChanged() {
    readTokens();
    themeSubs.forEach((f) => f());
  }
  const mq = matchMedia('(prefers-color-scheme: light)');
  if (mq.addEventListener) mq.addEventListener('change', themeChanged);
  new MutationObserver(themeChanged).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(themeChanged);

  S.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  S.font = (size, role = 'mono', style = '') =>
    `${style} ${size}px ${S.c['font-' + role] || 'sans-serif'}`.trim();

  // ---------- numbers (German formatting) ----------
  const nfCache = {};
  S.fmt = (v, d = 0) => {
    if (!isFinite(v)) return '–';
    if (Math.abs(v) < 0.5 * Math.pow(10, -d)) v = 0;
    const f = (nfCache[d] ||= new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }));
    return f.format(v).replace('-', '−');
  };
  S.signed = (v, d = 0) => (v > 0 ? '+' : '') + S.fmt(v, d);
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  /** Compact number: plain in a readable range, otherwise mantissa·10ⁿ. */
  S.sci = (v, sig = 2) => {
    if (!isFinite(v)) return '–';
    if (v === 0) return '0';
    const e = Math.floor(Math.log10(Math.abs(v)));
    if (e >= -2 && e <= 5) return S.fmt(v, Math.max(0, sig - 1 - e));
    const m = v / Math.pow(10, e);
    return S.fmt(m, sig - 1) + '·10' + String(e).split('').map((ch) => SUP[ch]).join('');
  };

  // ---------- scales & ticks ----------
  S.lin = (d0, d1, r0, r1) => {
    const k = (r1 - r0) / (d1 - d0);
    const f = (v) => r0 + (v - d0) * k;
    f.inv = (p) => d0 + (p - r0) / k;
    f.k = k;
    f.d = [d0, d1];
    f.r = [r0, r1];
    return f;
  };
  S.log = (d0, d1, r0, r1) => {
    const l0 = Math.log(d0), l1 = Math.log(d1), k = (r1 - r0) / (l1 - l0);
    const f = (v) => r0 + (Math.log(Math.max(v, 1e-300)) - l0) * k;
    f.inv = (p) => Math.exp(l0 + (p - r0) / k);
    f.d = [d0, d1];
    f.r = [r0, r1];
    return f;
  };
  S.ticks = (a, b, n = 5) => {
    const step0 = (b - a) / n;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const err = step0 / mag;
    const step = mag * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
    const out = [];
    for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + step * 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  };
  S.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  S.lerp = (a, b, t) => a + (b - a) * t;
  S.ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // ---------- color ----------
  /** OKLCH → sRGB [r,g,b] 0–255 (gamut-clipped). */
  S.oklch = (L, C, h) => {
    const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    const f = (x) => {
      x = Math.max(0, Math.min(1, x));
      return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055));
    };
    return [f(r), f(g), f(bb)];
  };
  S.rgb = (c, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);
  /** Parse a token color (#rrggbb or rgb/rgba) to [r,g,b,a]. */
  S.parse = (str) => {
    str = (str || '').trim();
    let m = /^#([0-9a-f]{6})$/i.exec(str);
    if (m) {
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
    }
    m = /rgba?\(([^)]+)\)/.exec(str);
    if (m) {
      const p = m[1].split(',').map((x) => parseFloat(x));
      return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]];
    }
    return [128, 128, 128, 1];
  };
  S.alpha = (token, a) => {
    const p = S.parse(S.c[token] || token);
    return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
  };

  /** Sequential "loss" ramp: one hue (orange, the error hue), low → high. 256-entry LUT per theme. */
  S.lossLUT = [];
  function buildRamps() {
    const lut = [];
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      lut.push(
        S.dark
          ? S.oklch(0.2 + 0.56 * Math.pow(t, 0.9), 0.018 + 0.125 * t, 48 + 8 * t)
          : S.oklch(0.975 - 0.43 * Math.pow(t, 0.9), 0.012 + 0.145 * t, 58 - 10 * t)
      );
    }
    S.lossLUT = lut;
    // ordinal blue ramp for colouring points along a sequence (e.g. along a curve)
    const seq = [];
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      seq.push(S.dark ? S.oklch(0.5 + 0.38 * t, 0.16 - 0.07 * t, 255 - 25 * t) : S.oklch(0.78 - 0.42 * t, 0.09 + 0.07 * t, 235 + 20 * t));
    }
    S.seqLUT = seq;
  }
  S.seqColor = (t) => S.seqLUT[Math.round(S.clamp(t, 0, 1) * 255)];
  S.lossColor = (t) => S.lossLUT[Math.round(S.clamp(t, 0, 1) * 255)];

  // ---------- small store ----------
  S.store = (init) => {
    let s = Object.assign({}, init);
    const subs = new Set();
    return {
      get: () => s,
      set(patch) {
        s = Object.assign({}, s, patch);
        subs.forEach((f) => f(s));
      },
      on(f) {
        subs.add(f);
      },
    };
  };

  // ---------- canvas panel ----------
  /** Binds a .plot container to a HiDPI canvas. draw(ctx, W, H, st) is called on every redraw. */
  S.canvas = (el, draw) => {
    let cv = el.querySelector('canvas');
    if (!cv) {
      cv = document.createElement('canvas');
      el.prepend(cv);
    }
    const ctx = cv.getContext('2d');
    const st = { el, cv, ctx, w: 0, h: 0, dpr: 1 };
    let queued = false;
    function paint() {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
      const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      if (cv.width !== cw || cv.height !== ch) {
        cv.width = cw;
        cv.height = ch;
      }
      st.w = W;
      st.h = H;
      st.dpr = dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      draw(ctx, W, H, st);
    }
    st.redraw = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        paint();
      });
    };
    st.paint = paint;
    new ResizeObserver(() => st.redraw()).observe(el);
    S.onTheme(st.redraw);
    return st;
  };

  /** Pointer interaction. pick(p, e) returns a drag handler {move(p), end()} or null.
   *  On touch, a gesture only captures when pick() hits something; otherwise the page scrolls. */
  S.pointer = (st, { pick, hover, leave, tap }) => {
    const cv = st.cv;
    let drag = null, downAt = null, moved = false;
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, touch: e.pointerType === 'touch' };
    };
    cv.addEventListener(
      'touchstart',
      (e) => {
        if (!pick || e.touches.length !== 1) return;
        const r = cv.getBoundingClientRect();
        const t = e.touches[0];
        const p = { x: t.clientX - r.left, y: t.clientY - r.top, touch: true, probe: true };
        if (pick(p, e)) e.preventDefault();
      },
      { passive: false }
    );
    cv.addEventListener('pointerdown', (e) => {
      const p = pos(e);
      downAt = p;
      moved = false;
      drag = pick ? pick(p, e) : null;
      if (drag) {
        cv.setPointerCapture(e.pointerId);
        st.el.classList.add('grabbing');
        if (hover) hover(null);
      }
    });
    cv.addEventListener('pointermove', (e) => {
      const p = pos(e);
      if (downAt && Math.hypot(p.x - downAt.x, p.y - downAt.y) > 3) moved = true;
      if (drag) drag.move(p, e);
      else if (hover && e.pointerType !== 'touch') hover(p);
    });
    const end = (e) => {
      if (drag) {
        if (drag.end) drag.end(pos(e));
        st.el.classList.remove('grabbing');
      } else if (tap && downAt && !moved && e.type === 'pointerup') tap(pos(e));
      drag = null;
      downAt = null;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => {
      if (!drag && leave) leave();
    });
  };

  // ---------- tooltip ----------
  S.tip = (plotEl) => {
    const d = document.createElement('div');
    d.className = 'tip';
    d.hidden = true;
    d.setAttribute('role', 'status');
    plotEl.appendChild(d);
    return {
      show(x, y, html) {
        d.innerHTML = html;
        d.hidden = false;
        const W = plotEl.clientWidth;
        const tw = d.offsetWidth, th = d.offsetHeight;
        let left = x + 14, top = y - th - 10;
        if (left + tw > W) left = x - tw - 14;
        if (left < 0) left = Math.max(0, Math.min(W - tw, x - tw / 2));
        if (top < -8) top = y + 16;
        d.style.left = left + 'px';
        d.style.top = top + 'px';
      },
      hide() {
        d.hidden = true;
      },
    };
  };
  S.tipRows = (title, rows) =>
    (title ? `<b>${title}</b>` : '') +
    rows.map(([k, v]) => `<div class="r"><span>${k}</span><span>${v}</span></div>`).join('');

  // ---------- 2D drawing ----------
  S.axes = (ctx, o) => {
    const { x, y, xt = [], yt = [], xfmt = String, yfmt = String, xlabel, ylabel, grid = true } = o;
    const [X0, X1] = x.r, [Y0, Y1] = y.r;
    ctx.save();
    ctx.lineWidth = 1;
    if (grid) {
      ctx.strokeStyle = S.c.grid;
      ctx.beginPath();
      for (const v of xt) {
        const px = Math.round(x(v)) + 0.5;
        ctx.moveTo(px, Y0);
        ctx.lineTo(px, Y1);
      }
      for (const v of yt) {
        const py = Math.round(y(v)) + 0.5;
        ctx.moveTo(X0, py);
        ctx.lineTo(X1, py);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = S.c.axis;
    ctx.beginPath();
    ctx.moveTo(X0, Math.round(Math.max(Y0, Y1)) + 0.5);
    ctx.lineTo(X1, Math.round(Math.max(Y0, Y1)) + 0.5);
    ctx.moveTo(Math.round(X0) + 0.5, Y0);
    ctx.lineTo(Math.round(X0) + 0.5, Y1);
    ctx.stroke();
    ctx.fillStyle = S.c.muted;
    ctx.font = S.font(10.5, 'mono');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const yb = Math.max(Y0, Y1);
    for (const v of xt) ctx.fillText(xfmt(v), x(v), yb + 5);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const v of yt) ctx.fillText(yfmt(v), X0 - 6, y(v));
    ctx.fillStyle = S.c['fg-2'];
    ctx.font = S.font(12, 'body');
    if (xlabel) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(xlabel, X1, yb + 34);
    }
    if (ylabel) {
      ctx.save();
      ctx.translate(12, Math.min(Y0, Y1));
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(ylabel, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  };

  S.arrow = (ctx, x0, y0, x1, y1, head = 8, width = 2) => {
    const a = Math.atan2(y1 - y0, x1 - x0);
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 0.5) return;
    const h = Math.min(head, len * 0.6);
    const bx = x1 - Math.cos(a) * h * 0.8, by = y1 - Math.sin(a) * h * 0.8;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - Math.cos(a - 0.42) * h, y1 - Math.sin(a - 0.42) * h);
    ctx.lineTo(x1 - Math.cos(a + 0.42) * h, y1 - Math.sin(a + 0.42) * h);
    ctx.closePath();
    ctx.fill();
  };

  S.dot = (ctx, x, y, r, fill, ring = S.c.surface, ringW = 2) => {
    ctx.beginPath();
    ctx.arc(x, y, r + ringW, 0, Math.PI * 2);
    ctx.fillStyle = ring;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  };

  /** Text with a halo in the surface color so labels stay legible over marks. */
  S.label = (ctx, text, x, y, color, font, align = 'left', base = 'middle') => {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = base;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = S.c.surface;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  // ---------- 3D orbit view ----------
  /** A tiny orbit camera over a z-up world. draw(ctx, W, H, cam) gets cam.P([x,y,z]) → [sx, sy, depth]. */
  S.orbit = (plotEl, opts) => {
    const cam = {
      yaw: opts.yaw ?? -0.75,
      pitch: opts.pitch ?? 0.5,
      dist: opts.dist ?? 5,
      zoom: opts.zoom ?? 0.36,
      cz: opts.cz ?? 0,
      auto: opts.auto !== false && !S.reduced,
    };
    let W = 1, H = 1;
    cam.P = (p) => {
      const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
      const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const x1 = p[0] * cy - p[1] * sy;
      const y1 = p[0] * sy + p[1] * cy;
      const z1 = p[2] - cam.cz;
      const z2 = z1 * cp + y1 * sp;
      const y2 = y1 * cp - z1 * sp;
      const s = cam.dist / (cam.dist + y2);
      const k = Math.min(W, H * 1.25) * cam.zoom;
      return [W / 2 + x1 * s * k, H / 2 - z2 * s * k, y2];
    };
    const st = S.canvas(plotEl, (ctx, w, h) => {
      W = w;
      H = h;
      opts.draw(ctx, w, h, cam);
    });
    cam.redraw = st.redraw;
    cam.st = st;
    plotEl.classList.add('grab');
    let last = null;
    S.pointer(st, {
      pick(p) {
        if (p.probe) return null; // touch: let the page scroll vertically; horizontal drags still rotate
        last = p;
        cam.auto = false;
        return {
          move(q) {
            cam.yaw -= (q.x - last.x) * 0.009;
            if (!q.touch) cam.pitch = S.clamp(cam.pitch + (q.y - last.y) * 0.007, 0.08, 1.45);
            last = q;
            st.redraw();
            if (opts.onRotate) opts.onRotate();
          },
        };
      },
      hover: opts.hover,
      leave: opts.leave,
    });
    // gentle auto-rotation while visible, until the reader grabs it
    let visible = false, prev = 0;
    new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
      if (visible) requestAnimationFrame(spin);
    }).observe(plotEl);
    function spin(t) {
      if (!visible || !cam.auto) return;
      const dt = prev ? Math.min(50, t - prev) : 16;
      prev = t;
      cam.yaw += dt * 0.00012;
      st.paint();
      requestAnimationFrame(spin);
    }
    return cam;
  };

  // ---------- 3D vector helpers (used with an orbit camera's P) ----------
  S.v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => {
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      return [a[0] / l, a[1] / l, a[2] / l];
    },
  };
  S.seg3 = (ctx, P, a, b) => {
    const s = P(a), t = P(b);
    ctx.beginPath();
    ctx.moveTo(s[0], s[1]);
    ctx.lineTo(t[0], t[1]);
    ctx.stroke();
  };
  S.arrow3 = (ctx, P, a, b, color, width = 2, head = 9) => {
    const s = P(a), t = P(b);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    S.arrow(ctx, s[0], s[1], t[0], t[1], head, width);
  };
  /** Axes through the origin with small ticks and end labels. */
  S.axes3 = (ctx, P, len, labels, hl = -1) => {
    for (let k = 0; k < 3; k++) {
      const e = [0, 0, 0];
      e[k] = len;
      const n = [0, 0, 0];
      n[k] = -len * 0.25;
      ctx.strokeStyle = k === hl ? S.c.accent : S.c.axis;
      ctx.lineWidth = k === hl ? 2 : 1;
      S.seg3(ctx, P, n, e);
      const tip = [0, 0, 0];
      tip[k] = len * 1.1;
      const q = P(tip);
      S.label(ctx, labels[k], q[0], q[1], k === hl ? S.c.accent : S.c.muted, S.font(12, 'body'), 'center');
    }
  };

  /** A spring (zigzag) from (x0,y0) to (x1,y1) in screen space. */
  S.spring = (ctx, x0, y0, x1, y1, coils = 7, amp = 4) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    if (len < 14) {
      ctx.lineTo(x1, y1);
    } else {
      const ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux;
      const lead = 5, body = len - 2 * lead, n = coils * 2;
      ctx.lineTo(x0 + ux * lead, y0 + uy * lead);
      for (let i = 1; i < n; i++) {
        const d = lead + (body * i) / n, s = i % 2 ? amp : -amp;
        ctx.lineTo(x0 + ux * d + nx * s, y0 + uy * d + ny * s);
      }
      ctx.lineTo(x1 - ux * lead, y1 - uy * lead);
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();
  };

  // ---------- misc ----------
  S.$ = (sel, root = document) => root.querySelector(sel);
  S.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  /** Animate from→to over ms with easing; onFrame(t in 0..1). Returns cancel(). */
  S.tween = (ms, onFrame, onDone) => {
    if (S.reduced) {
      onFrame(1);
      if (onDone) onDone();
      return () => {};
    }
    let raf, t0;
    const step = (t) => {
      t0 ??= t;
      const k = Math.min(1, (t - t0) / ms);
      onFrame(S.ease(k));
      if (k < 1) raf = requestAnimationFrame(step);
      else if (onDone) onDone();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  };


  // ---------- story: one sticky stage, scrolling steps; every step plays its own animation ----------
  /*  HTML contract (see series.css):
        <section class="story">
          <div class="stage">
            <div class="formula-box"><div class="formula"></div><div class="formula-x"></div></div>
            <div class="views"> <div class="view" data-view="name"><div class="vlabel"></div><div class="plot"></div></div> … </div>
            <div class="stage-bar"><p class="caption"></p><div class="stage-ctl"> buttons [data-act=prev|replay|pause|next], <span class="prog"></span></div></div>
          </div>
          <div class="steps"> <article class="step" data-step="id"><div class="card">…</div></article> … </div>
        </section>
      cfg = { views: {name: {redraw()}}, steps: {id: {views: [...], cols, formula, setup(), play: async (a) => {}}}, values() }  */
  class Cancel extends Error {}
  S.formulaTerm = (key, html, cls = '', explain = '') =>
    `<span class="t ${cls}" data-t="${key}" data-x="${explain.replace(/"/g, '&quot;')}">${html}</span>`;
  S.formulaValue = (key) => `<span class="v" data-v="${key}"></span>`;

  S.story = (root, cfg) => {
    const stage = root.querySelector('.stage');
    const q = (sel) => stage.querySelector(sel);
    const viewsEl = q('.views'), formulaEl = q('.formula'), explainEl = q('.formula-x'), captionEl = q('.caption'), progEl = q('.prog');
    const btn = (act) => q(`[data-act="${act}"]`);
    const allSteps = Array.from(root.querySelectorAll('.step'));
    let stepEls = allSteps;
    const viewEls = {};
    root.querySelectorAll('.view').forEach((el) => (viewEls[el.dataset.view] = el));
    let cur = -1, token = 0, paused = false, queued = false, started = false, pending = null;

    // reader options, kept per browser: fast run (core steps only) and "think along" (predictions, try-it controls)
    const store = {
      get(k, d) { try { const v = localStorage.getItem('rta-' + k); return v == null ? d : v === '1'; } catch { return d; } },
      set(k, v) { try { localStorage.setItem('rta-' + k, v ? '1' : '0'); } catch { /* storage blocked: option lasts for this page only */ } },
    };
    const opts = { fast: store.get('fast', false), think: store.get('think', true) };
    const hasCore = allSteps.some((el) => el.hasAttribute('data-core'));
    function applyFast() {
      const fast = opts.fast && hasCore;
      allSteps.forEach((el) => el.classList.toggle('skip', fast && !el.hasAttribute('data-core')));
      stepEls = fast ? allSteps.filter((el) => el.hasAttribute('data-core')) : allSteps;
    }
    applyFast();
    const bar = document.createElement('div');
    bar.className = 'col story-opts';
    bar.innerHTML = (hasCore ? '<label><input type="checkbox" data-o="fast"> Schnelldurchlauf: nur die Kernschritte</label>' : '') +
      '<label><input type="checkbox" data-o="think"> Mitdenken: vorher raten, selbst ausprobieren</label>';
    root.before(bar);
    bar.querySelectorAll('input').forEach((inp) => {
      inp.checked = opts[inp.dataset.o];
      inp.addEventListener('change', () => {
        opts[inp.dataset.o] = inp.checked; store.set(inp.dataset.o, inp.checked);
        if (inp.dataset.o === 'fast') { applyFast(); cur = -1; token++; pick(); }
        else if (cur >= 0) activate(cur, true);
      });
    });

    // the action strip between the views and the caption: prediction prompts and try-it controls
    const actEl = document.createElement('div');
    actEl.className = 'stage-act';
    stage.insertBefore(actEl, q('.stage-bar'));
    function setAct(...nodes) { actEl.replaceChildren(...nodes); stage.classList.toggle('has-act', nodes.length > 0); }
    function addAct(node) { actEl.append(node); stage.classList.add('has-act'); }
    const make = (tag, cls, html) => { const el = document.createElement(tag); if (cls) el.className = cls; if (html != null) el.innerHTML = html; return el; };
    /** controls: [{label, type: 'range' | 'choice' | 'text', get(), set(v), min, max, step, fmt, options: [{label, value}], go}] */
    function controlBox(list, title) {
      const box = make('div', 'try');
      box.append(make('div', 'try-t', title));
      const row = make('div', 'try-row');
      box.append(row);
      for (const c of list) {
        const get = c.get || (() => c.obj[c.key]), set = c.set || ((v) => (c.obj[c.key] = v)), fmt = c.fmt || ((v) => S.fmt(v, 2));
        const lab = make('label', 'tc');
        if (c.label) lab.append(make('span', '', c.label));
        if (c.type === 'choice') {
          const btns = c.options.map((o) => { const b = make('button', 'btn', o.label); b.type = 'button'; b.addEventListener('click', () => { set(o.value); mark(); redraw(); }); lab.append(b); return [b, o]; });
          const mark = () => btns.forEach(([b, o]) => b.classList.toggle('on', JSON.stringify(get()) === JSON.stringify(o.value)));
          mark();
        } else if (c.type === 'text') {
          const inp = make('input'); inp.type = 'text'; inp.value = get() ?? ''; inp.maxLength = c.max || 20; inp.spellcheck = false; inp.autocomplete = 'off';
          const go = make('button', 'btn', c.go || 'Los'); go.type = 'button';
          const fire = () => { set(inp.value); redraw(); };
          go.addEventListener('click', fire); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') fire(); });
          lab.append(inp, go);
        } else {
          const inp = make('input'), out = make('output');
          Object.assign(inp, { type: 'range', min: c.min, max: c.max, step: c.step ?? 'any' }); inp.value = get();
          out.textContent = fmt(get());
          inp.addEventListener('input', () => { set(+inp.value); out.textContent = fmt(+inp.value); redraw(); });
          lab.append(inp, out);
        }
        row.append(lab);
      }
      return box;
    }
    function reveal(my) {
      if (!pending || pending.my !== my) return;
      const { box, choice, correct } = pending;
      pending = null;
      const btns = box.querySelectorAll('.ask-o .btn');
      if (correct != null && btns[correct]) btns[correct].classList.add('right');
      if (choice >= 0 && choice !== correct && btns[choice]) btns[choice].classList.add('wrong');
      box.append(make('span', 'ask-r', choice === correct ? 'Gut vermutet.' : choice < 0 ? 'Die Antwort ist grün markiert.' : 'Überrascht? Genau darum geht es in diesem Schritt.'));
    }

    function redraw() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        for (const [name, v] of Object.entries(cfg.views)) if (viewEls[name] && !viewEls[name].hidden && v.redraw) v.redraw();
        values();
      });
    }
    function values() {
      if (!cfg.values) return;
      const vals = cfg.values();
      formulaEl.querySelectorAll('[data-v]').forEach((el) => {
        const v = vals[el.dataset.v];
        if (v != null && el.innerHTML !== String(v)) el.innerHTML = v;
      });
    }
    const frame = () => new Promise((res) => requestAnimationFrame(res));
    const mix = (a, b, e) => (Array.isArray(b) ? b.map((v, i) => mix(a[i], v, e)) : typeof b === 'number' ? a + (b - a) * e : e < 1 ? a : b);
    const clone = (v) => (Array.isArray(v) ? v.map(clone) : v);
    function highlight(keys) {
      formulaEl.querySelectorAll('[data-t]').forEach((el) => el.classList.toggle('on', keys.includes(el.dataset.t)));
      const first = keys.length ? formulaEl.querySelector(`[data-t="${keys[0]}"]`) : null;
      explainEl.innerHTML = first && first.dataset.x ? first.dataset.x : '&nbsp;';
    }
    function makeApi(my) {
      const alive = () => my === token;
      const check = () => { if (!alive()) throw new Cancel(); };
      async function tick(last) { const now = await frame(); check(); return [now, paused ? 0 : now - last]; }
      return {
        alive,
        async wait(ms) {
          if (S.reduced) ms = Math.min(ms, 400);
          let t = 0, last = performance.now();
          while (t < ms) { const [now, dt] = await tick(last); t += dt; last = now; }
        },
        async to(obj, props, dur = 800, opt = {}) {
          check();
          const ease = opt.ease || S.ease, from = {};
          for (const k in props) from[k] = clone(obj[k]);
          if (S.reduced) dur = 0;
          let t = 0, last = performance.now();
          for (;;) {
            const k = dur ? Math.min(1, t / dur) : 1, e = ease(k);
            for (const p in props) obj[p] = mix(from[p], props[p], e);
            if (opt.update) opt.update(e);
            redraw();
            if (k >= 1) break;
            const [now, dt] = await tick(last); t += dt; last = now;
          }
        },
        /** calls fn(i) `rate` times per second until it returns false */
        async loop(fn, rate = 30) {
          let acc = 1, last = performance.now(), i = 0;
          for (;;) {
            while (acc >= 1) { acc -= 1; if (fn(i++) === false) { redraw(); return; } }
            redraw();
            const [now, dt] = await tick(last);
            acc += (dt / 1000) * (typeof rate === 'function' ? rate(i) : rate);
            last = now;
          }
        },
        say(html) { check(); captionEl.innerHTML = html; },
        /** a prediction before the reveal: waits for a choice, the answer is marked when the step has played */
        async ask(question, options, correct) {
          check();
          if (!opts.think) return null;
          const box = make('div', 'ask', `<div class="ask-q"><b>Was glaubst du?</b> ${question}</div>`), row = make('div', 'ask-o');
          let choice = null;
          const btns = options.map((o, i) => { const b = make('button', 'btn', o); b.type = 'button'; b.addEventListener('click', () => { if (choice == null) choice = i; }); row.append(b); return b; });
          const skip = make('button', 'btn ghost', 'Überspringen'); skip.type = 'button'; skip.addEventListener('click', () => { if (choice == null) choice = -1; });
          row.append(skip); box.append(row); setAct(box);
          captionEl.innerHTML = 'Tippe deine Vermutung an, dann geht es weiter.';
          while (choice == null) { await frame(); check(); }
          btns.forEach((b, i) => { b.disabled = true; b.classList.toggle('picked', i === choice); });
          skip.remove();
          pending = { box, choice, correct, my };
          return choice;
        },
        /** try it yourself before the step goes on: shows controls and waits for "Weiter" */
        async tryit(list, prompt, done = 'Weiter') {
          check();
          if (!opts.think) return false;
          const box = controlBox(list, `Erst du: ${prompt}`), go = make('button', 'btn primary', done);
          let ok = false; go.type = 'button'; go.addEventListener('click', () => (ok = true));
          box.querySelector('.try-row').append(go); setAct(box);
          while (!ok) { await frame(); check(); }
          setAct();
          return true;
        },
        hl(...keys) { check(); highlight(keys); },
        set(obj, props) { check(); Object.assign(obj, props); redraw(); },
      };
    }
    function show(def) {
      const names = def.views || [];
      for (const [name, el] of Object.entries(viewEls)) el.hidden = !names.includes(name);
      viewsEl.style.setProperty('--cols', def.cols || `repeat(${Math.max(1, names.length)}, minmax(0, 1fr))`);
      viewsEl.dataset.n = names.length;
    }
    function prepare(i) {
      const def = cfg.steps[stepEls[i].dataset.step] || {};
      stepEls.forEach((el, k) => el.classList.toggle('on', k === i));
      show(def);
      formulaEl.innerHTML = typeof def.formula === 'function' ? def.formula() : def.formula || '';
      highlight([]);
      captionEl.innerHTML = '&nbsp;';
      pending = null; setAct();
      progEl.textContent = `${i + 1} / ${stepEls.length}`;
      if (def.setup) def.setup();
      redraw();
      return def;
    }
    const page = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    function activate(i, force) {
      if (i === cur && !force) return;
      cur = i;
      // reading progress for the overview page: started, and reached the last step
      if (page) { store.set('seen-' + page, true); if (i === stepEls.length - 1) store.set('done-' + page, true); }
      const my = ++token;
      const def = prepare(i);
      setPaused(false);
      stage.classList.add('playing');
      Promise.resolve()
        .then(() => def.play && def.play(makeApi(my)))
        .then(() => {
          if (my !== token) return;
          stage.classList.remove('playing');
          reveal(my);
          if (def.tryit && opts.think) addAct(controlBox(typeof def.tryit === 'function' ? def.tryit() : def.tryit, 'Jetzt du'));
        })
        .catch((e) => { if (!(e instanceof Cancel)) console.error(e); });
    }
    function setPaused(v) {
      paused = v;
      const b = btn('pause');
      if (b) { b.textContent = v ? 'Weiter' : 'Pause'; b.setAttribute('aria-pressed', String(v)); }
    }
    const mobile = () => matchMedia('(max-width: 900px)').matches;
    function scrollToStep(i) {
      i = S.clamp(i, 0, stepEls.length - 1);
      const r = stepEls[i].getBoundingClientRect();
      const top = mobile() ? scrollY + r.top - innerHeight * 0.6 : scrollY + r.top + r.height / 2 - innerHeight / 2;
      scrollTo({ top, behavior: S.reduced ? 'auto' : 'smooth' });
    }
    function pick() {
      const r = root.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight * 0.7) return;
      const line = innerHeight * (mobile() ? 0.8 : 0.52);
      let idx = 0;
      stepEls.forEach((el, k) => { if (el.getBoundingClientRect().top < line) idx = k; });
      started = true;
      activate(idx);
    }
    let sq = false;
    addEventListener('scroll', () => { if (!sq) { sq = true; requestAnimationFrame(() => { sq = false; pick(); }); } }, { passive: true });
    addEventListener('resize', () => { redraw(); pick(); });
    btn('replay')?.addEventListener('click', () => (cur >= 0 ? activate(cur, true) : activate(0)));
    btn('pause')?.addEventListener('click', () => setPaused(!paused));
    btn('prev')?.addEventListener('click', () => scrollToStep(cur - 1));
    btn('next')?.addEventListener('click', () => scrollToStep(cur + 1));
    S.onTheme(redraw);

    prepare(0); // a complete first frame before anything plays
    requestAnimationFrame(pick);
    return {
      redraw,
      /** the reader grabbed something: stop the animation, keep the state */
      interrupt() {
        token++;
        stage.classList.remove('playing');
        captionEl.innerHTML = 'Du steuerst selbst. „Nochmal“ spielt den Schritt wieder ab.';
      },
      get step() { return cur; },
      get started() { return started; },
    };
  };

  readTokens();
})();
