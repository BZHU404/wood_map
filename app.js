/* 木谱 · Wood Atlas
 * 纯静态站点，无依赖。数据来自 data/woods.js。
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- 基础工具 */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const hexToRgb = (h) => {
    const s = h.replace('#', '');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  };

  const rgbToHex = (r, g, b) =>
    '#' +
    [r, g, b]
      .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'))
      .join('');

  function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const target = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    return rgbToHex(r + (target - r) * p, g + (target - g) * p, b + (target - b) * p);
  }

  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function toHsl(hex) {
    let [r, g, b] = hexToRgb(hex).map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s, l };
  }

  /* ---------------------------------------------------------------- 标签推导 */

  const FEEL_ORDER = ['软', '中', '硬', '很硬'];
  const FAMILY_ORDER = ['浅色', '黄褐', '红褐', '红', '深褐', '近黑', '紫', '绿'];

  function feelOf(w) {
    if (w.janka == null) return w.feel;
    if (w.janka < 3000) return '软';
    if (w.janka < 5000) return '中';
    if (w.janka < 8000) return '硬';
    return '很硬';
  }

  function densityBand(v) {
    if (v < 0.45) return '轻';
    if (v < 0.65) return '中';
    if (v < 0.9) return '重';
    return '沉';
  }

  function colorFamily(hex) {
    const { h, s, l } = toHsl(hex);
    if (l <= 0.17) return '近黑';
    if (h >= 250 && h <= 335 && s >= 0.14 && l < 0.55) return '紫';
    if (h >= 60 && h <= 170 && s >= 0.1) return '绿';
    if (l < 0.3) return '深褐';
    if (l >= 0.62) return '浅色';
    if (h < 20 || h >= 340) return '红';
    if (h < 30) return '红褐';
    if (h < 60) return '黄褐';
    return '浅色';
  }

  const WOODS = (window.WOODS || []).slice();
  const byId = new Map(WOODS.map((w) => [w.id, w]));

  WOODS.forEach((w) => {
    w._feel = feelOf(w);
    w._density = w.density == null ? null : densityBand(w.density);
    w._family = colorFamily(w.color.heart);
    w._kind = w.extinct ? '古植物' : '木材';
    w._search = [
      w.name,
      w.en,
      w.sci,
      w.aliases.join(' '),
      w.type,
      w.origin.join(' '),
      w.uses.join(' '),
      w._feel,
      w._family,
      w.grain,
      w.texture,
      w.creative,
      w.mistake,
      w.fact
    ]
      .join(' ')
      .toLowerCase();
  });

  /* ---------------------------------------------------------------- 刨面纹理 */

  let texSeq = 0;

  function woodTexture(wood, opts = {}) {
    const detail = !!opts.detail;
    const W = 480;
    const H = detail ? 300 : 360;
    const t = wood.tex || {};
    const base = wood.color.heart;
    const dark = luminance(base) < 0.2;
    const lineDark = dark ? shade(base, 0.36) : shade(base, -0.4);
    const lineMid = dark ? shade(base, 0.19) : shade(base, -0.22);
    const lineLight = dark ? shade(base, 0.5) : shade(base, 0.3);
    const uid = 'tx' + ++texSeq;
    const rnd = mulberry32(hashStr(wood.id));
    const pattern = t.pattern || 'straight';
    const contrast = clamp(t.contrast == null ? 0.4 : t.contrast, 0.1, 1);

    const knots = [];
    for (let i = 0; i < (t.knots || 0); i++) {
      knots.push({
        x: 60 + rnd() * (W - 120),
        y: 50 + rnd() * (H - 100),
        r: 9 + rnd() * 12,
        draw: true
      });
    }
    if (pattern === 'cathedral') {
      const n = knots.length ? 2 : 3;
      for (let i = 0; i < n; i++) {
        knots.push({
          x: W * (0.12 + rnd() * 0.76),
          y: H * (0.18 + rnd() * 0.6),
          r: 11 + rnd() * 10,
          draw: false
        });
      }
    }

    const spacing = detail ? 3.4 : 3.8;
    const fibrous = pattern === 'fibrous';
    const fossil = pattern === 'fossil';
    const amp = pattern === 'wavy' ? 9 : pattern === 'cathedral' ? 3.6 : pattern === 'burl' ? 7 : fibrous ? 1.6 : 2.0;
    const freq = pattern === 'wavy' ? 0.01 : pattern === 'burl' ? 0.021 : 0.016;
    const phase = rnd() * Math.PI * 2;

    function grainPath(y0, ampScale) {
      let d = '';
      let first = true;
      for (let x = -12; x <= W + 12; x += 5) {
        let y =
          y0 +
          Math.sin(x * freq + phase + y0 * 0.045) * amp * ampScale * (0.4 + 0.6 * Math.sin(x * 0.0035 + y0 * 0.02)) +
          Math.sin(x * 0.0062 + y0 * 0.85) * (1.4 + ampScale) +
          Math.sin(x * 0.085 + y0 * 0.4) * 1.1;
        for (let k = 0; k < knots.length; k++) {
          const kn = knots[k];
          const dx = x - kn.x;
          const dy = y0 - kn.y;
          const fall =
            Math.exp(-(dx * dx) / (2 * Math.pow(kn.r * 2.7, 2))) *
            Math.exp(-(dy * dy) / (2 * Math.pow(kn.r * 2.4, 2)));
          y += Math.sign(dy || 1) * fall * kn.r * 1.9;
        }
        d += (first ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
        first = false;
      }
      return d;
    }

    // 年轮：早材宽带 + 晚材细线
    const bands = [];
    if (!fibrous && !fossil && pattern !== 'burl') for (let y = -14; y < H + 16; y += 11 + rnd() * 4) {
      const dLight = grainPath(y, 1);
      const dDark = grainPath(y + 1.2, 1);
      bands.push(
        '<path d="' + dLight + '" stroke="' + lineLight + '" stroke-width="' +
        (5 + rnd() * 4).toFixed(1) + '" opacity="' + (0.03 + contrast * 0.05).toFixed(3) + '"/>' +
        '<path d="' + dDark + '" stroke="' + lineMid + '" stroke-width="' +
        (1 + rnd() * 1.2).toFixed(1) + '" opacity="' + (0.05 + contrast * 0.1).toFixed(3) + '"/>'
      );
    }

    // 细纹
    const strokes = [];
    const lineCount = Math.ceil(H / spacing) + 8;
    if (!fibrous && !fossil) for (let i = -4; i < lineCount; i++) {
      const y0 = i * spacing + rnd() * 1.4;
      const d = grainPath(y0, 0.92);
      const r = rnd();
      let stroke;
      let opacity;
      let width;
      if (pattern === 'striped' && r < 0.36) {
        stroke = shade(wood.color.sap, -0.04);
        opacity = 0.3 + contrast * 0.36;
        width = 0.9 + rnd() * 1.9;
      } else if (r < 0.26) {
        stroke = lineDark;
        opacity = 0.12 + contrast * 0.3;
        width = 0.8 + rnd() * 1.3;
      } else if (r < 0.66) {
        stroke = lineMid;
        opacity = 0.08 + contrast * 0.2;
        width = 0.7 + rnd() * 1.0;
      } else {
        stroke = lineLight;
        opacity = 0.04 + contrast * 0.12;
        width = 0.7 + rnd() * 0.9;
      }
      strokes.push(
        '<path d="' + d + '" stroke="' + stroke + '" stroke-width="' + width.toFixed(2) +
        '" opacity="' + opacity.toFixed(3) + '"/>'
      );
    }

    let extra = '';

    // 交错纹：第二组斜向纤维
    if (pattern === 'interlocked') {
      let d = '';
      for (let i = -2; i < lineCount; i += 2) {
        const y0 = i * spacing * 1.6 + rnd() * 2;
        let p = '';
        let first = true;
        for (let x = -12; x <= W + 12; x += 8) {
          const y = y0 + Math.sin(x * 0.028 + i * 1.1) * 5 + Math.sin(x * 0.011) * 4;
          p += (first ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
          first = false;
        }
        d += p;
      }
      extra +=
        '<g fill="none" stroke="' + lineLight + '" stroke-width="1.2" opacity="' +
        (0.08 + contrast * 0.12).toFixed(2) + '"><path d="' + d + '"/></g>';
    }

    // 纤维材：无年轮的短纤维束（桫椤）
    if (fibrous) {
      let fine = '';
      for (let i = 0; i < 640; i++) {
        const x = rnd() * W;
        const y = rnd() * H;
        const len = 4 + rnd() * 24;
        const slope = (rnd() - 0.5) * 0.8;
        fine += 'M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'l' + len.toFixed(1) + ' ' + (len * slope).toFixed(1);
      }
      extra += '<path d="' + fine + '" stroke="' + lineDark + '" stroke-width="0.9" stroke-linecap="round" opacity="' +
        (0.16 + contrast * 0.22).toFixed(2) + '"/>';
      let coarse = '';
      for (let i = 0; i < 90; i++) {
        const x = rnd() * W;
        const y = rnd() * H;
        const len = 20 + rnd() * 60;
        const slope = (rnd() - 0.5) * 0.5;
        coarse += 'M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'l' + len.toFixed(1) + ' ' + (len * slope).toFixed(1);
      }
      extra += '<path d="' + coarse + '" stroke="' + lineLight + '" stroke-width="1.6" stroke-linecap="round" opacity="' +
        (0.1 + contrast * 0.12).toFixed(2) + '"/>';
    }

    // 瘤疤：稳定木瘤 / 树瘤的漩涡眼
    if (pattern === 'burl') {
      for (let i = 0; i < 22; i++) {
        const x = 30 + rnd() * (W - 60);
        const y = 30 + rnd() * (H - 60);
        const r = 3 + rnd() * 14;
        const rot = rnd() * 180;
        extra += '<g transform="rotate(' + rot.toFixed(0) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')" opacity="' +
          (0.25 + rnd() * 0.35).toFixed(2) + '">' +
          '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="' + r.toFixed(1) + '" ry="' + (r * 0.62).toFixed(1) +
          '" fill="none" stroke="' + lineDark + '" stroke-width="1.2"/>' +
          '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="' + (r * 0.55).toFixed(1) + '" ry="' + (r * 0.33).toFixed(1) +
          '" fill="none" stroke="' + lineMid + '" stroke-width="1"/>' +
          '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="' + (r * 0.2).toFixed(1) + '" ry="' + (r * 0.12).toFixed(1) +
          '" fill="' + shade(base, -0.45) + '"/></g>';
      }
    }

    // 化石：古植物的叶片印痕与裂纹
    if (fossil) {
      for (let i = 0; i < 7; i++) {
        const cx = 40 + rnd() * (W - 80);
        const cy = 40 + rnd() * (H - 80);
        const len = 18 + rnd() * 40;
        const wid = 5 + rnd() * 9;
        const rot = rnd() * 180;
        const x1 = cx - len / 2;
        const x2 = cx + len / 2;
        extra += '<g transform="rotate(' + rot.toFixed(0) + ' ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')" opacity="' +
          (0.16 + rnd() * 0.2).toFixed(2) + '">' +
          '<path d="M' + x1.toFixed(1) + ' ' + cy.toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + (cy - wid).toFixed(1) +
          ' ' + x2.toFixed(1) + ' ' + cy.toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + (cy + wid).toFixed(1) +
          ' ' + x1.toFixed(1) + ' ' + cy.toFixed(1) + 'Z" fill="none" stroke="' + lineLight + '" stroke-width="1.1"/>' +
          '<path d="M' + x1.toFixed(1) + ' ' + cy.toFixed(1) + 'L' + x2.toFixed(1) + ' ' + cy.toFixed(1) +
          '" stroke="' + lineLight + '" stroke-width="0.7" opacity="0.6"/></g>';
      }
      let cracks = '';
      for (let i = 0; i < 20; i++) {
        let px = rnd() * W;
        let py = rnd() * H;
        let d = 'M' + px.toFixed(1) + ' ' + py.toFixed(1);
        for (let s2 = 0; s2 < 3; s2++) {
          px += (rnd() - 0.35) * 30;
          py += (rnd() - 0.5) * 14;
          d += 'L' + px.toFixed(1) + ' ' + py.toFixed(1);
        }
        cracks += d;
      }
      extra += '<path d="' + cracks + '" fill="none" stroke="' + shade(base, -0.5) + '" stroke-width="0.8" opacity="0.4"/>';
      let specks = '';
      for (let i = 0; i < 90; i++) {
        specks += '<circle cx="' + (rnd() * W).toFixed(1) + '" cy="' + (rnd() * H).toFixed(1) +
          '" r="' + (0.4 + rnd() * 1.1).toFixed(1) + '" fill="' + lineLight + '" opacity="' + (0.1 + rnd() * 0.2).toFixed(2) + '"/>';
      }
      extra += specks;
    }

    // 深色条纹：橄榄、玫瑰木、柚木的带状花纹
    if (t.streak) {
      let d = '';
      const n = Math.round(6 + t.streak * 10);
      for (let i = 0; i < n; i++) {
        const y0 = rnd() * H;
        let p = '';
        let first = true;
        for (let x = -10; x <= W + 10; x += 8) {
          const y = y0 + Math.sin(x * 0.012 + i * 1.7) * 8 + Math.sin(x * 0.04 + i) * 2;
          p += (first ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
          first = false;
        }
        d += p;
      }
      extra += '<path d="' + d + '" fill="none" stroke="' + shade(base, -0.5) + '" stroke-width="' +
        (2 + rnd() * 5).toFixed(1) + '" opacity="' + (0.07 + t.streak * 0.12).toFixed(2) +
        '" stroke-linecap="round"/>';
    }

    // 斑纹：蛇桑木的蛇皮状黑斑
    if (pattern === 'mottle') {
      for (let i = 0; i < 30; i++) {
        const x = rnd() * W;
        const y = rnd() * H;
        const rx = 5 + rnd() * 20;
        const ry = 3 + rnd() * 11;
        const rot = rnd() * 180;
        extra += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="' + rx.toFixed(1) +
          '" ry="' + ry.toFixed(1) + '" transform="rotate(' + rot.toFixed(0) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) +
          ')" fill="' + shade(base, -0.55) + '" opacity="' + (0.1 + rnd() * 0.2).toFixed(2) + '"/>';
      }
    }

    // 导管孔：环孔材的深色短划
    if (t.pores) {
      let d = '';
      const n = detail ? 420 : 300;
      for (let i = 0; i < n; i++) {
        const row = Math.floor(rnd() * 16);
        const y = (row / 16) * H + (rnd() - 0.5) * 9;
        const x = rnd() * W;
        const len = 3 + rnd() * 6;
        d += 'M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'h' + len.toFixed(1);
      }
      extra +=
        '<path d="' + d + '" stroke="' + shade(base, -0.5) + '" stroke-width="1" stroke-linecap="round" opacity="' +
        (0.24 + contrast * 0.22).toFixed(2) + '"/>';
    }

    // 射线：橡木、榉木的短横斑
    if (t.rays) {
      let d = '';
      for (let i = 0; i < 52; i++) {
        const x = rnd() * W;
        const y = rnd() * H;
        const len = 5 + rnd() * 12;
        d += 'M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'h' + len.toFixed(1);
      }
      extra +=
        '<path d="' + d + '" stroke="' + lineLight + '" stroke-width="1.5" stroke-linecap="round" opacity="' +
        (0.16 + contrast * 0.16).toFixed(2) + '"/>';
    }

    // 鸟眼
    if (t.eyes) {
      for (let i = 0; i < 14; i++) {
        const x = 40 + rnd() * (W - 80);
        const y = 40 + rnd() * (H - 80);
        const r = 1.6 + rnd() * 2.8;
        extra +=
          '<g opacity="' + (0.3 + rnd() * 0.3).toFixed(2) + '">' +
          '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r.toFixed(1) +
          '" fill="none" stroke="' + lineDark + '" stroke-width="1.1"/>' +
          '<circle cx="' + (x + 0.6).toFixed(1) + '" cy="' + (y - 0.6).toFixed(1) + '" r="' +
          (r * 0.42).toFixed(1) + '" fill="' + lineLight + '"/></g>';
      }
    }

    // 节疤
    for (let i = 0; i < knots.length; i++) {
      const k = knots[i];
      if (!k.draw) continue;
      extra +=
        '<g opacity="0.72">' +
        '<ellipse cx="' + k.x.toFixed(1) + '" cy="' + k.y.toFixed(1) + '" rx="' + (k.r * 0.6).toFixed(1) +
        '" ry="' + (k.r * 0.4).toFixed(1) + '" fill="' + shade(base, -0.62) + '"/>' +
        '<ellipse cx="' + k.x.toFixed(1) + '" cy="' + k.y.toFixed(1) + '" rx="' + (k.r * 0.95).toFixed(1) +
        '" ry="' + (k.r * 0.68).toFixed(1) + '" fill="none" stroke="' + shade(base, -0.42) +
        '" stroke-width="1.6" opacity="0.6"/></g>';
    }

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H +
      '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
      '<defs>' +
      '<linearGradient id="bg' + uid + '" x1="0" y1="0" x2="0.85" y2="1">' +
      '<stop offset="0" stop-color="' + shade(base, 0.05) + '"/>' +
      '<stop offset="0.52" stop-color="' + base + '"/>' +
      '<stop offset="1" stop-color="' + shade(base, -0.07) + '"/>' +
      '</linearGradient>' +
      '<radialGradient id="sh' + uid + '" cx="0.24" cy="0.12" r="0.95">' +
      '<stop offset="0" stop-color="#fff" stop-opacity="0.05"/>' +
      '<stop offset="1" stop-color="#fff" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<radialGradient id="vg' + uid + '" cx="0.5" cy="0.5" r="0.72">' +
      '<stop offset="0.55" stop-color="#000" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="#000" stop-opacity="0.15"/>' +
      '</radialGradient>' +
      '</defs>' +
      '<rect width="' + W + '" height="' + H + '" fill="url(#bg' + uid + ')"/>' +
      '<g fill="none" stroke-linecap="round">' + bands.join('') + strokes.join('') + '</g>' +
      extra +
      '<rect width="' + W + '" height="' + H + '" fill="url(#vg' + uid + ')"/>' +
      '<rect width="' + W + '" height="' + H + '" fill="url(#sh' + uid + ')"/>' +
      '</svg>'
    );
  }

  function textureBlock(wood, opts = {}) {
    const cls = opts.detail ? 'tex tex--detail' : 'tex';
    const caption = opts.caption
      ? '<figcaption class="tex-cap">' + opts.caption + '</figcaption>'
      : '';
    const media = wood.photo
      ? '<img class="tex-img" src="' + esc(wood.photo) + '" alt="' + esc(wood.name) + ' 刨面" loading="' +
        (opts.detail ? 'eager' : 'lazy') + '">'
      : woodTexture(wood, opts);
    return (
      '<div class="' + cls + '">' + media +
      (wood.photo ? '' : '<span class="tex-grain" aria-hidden="true"></span>') + caption + '</div>'
    );
  }

  /* ---------------------------------------------------------------- 噪点贴图 */

  function installNoise() {
    const size = 96;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 120 + Math.random() * 135;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 30;
    }
    ctx.putImageData(img, 0, 0);
    document.documentElement.style.setProperty('--noise', 'url(' + c.toDataURL('image/png') + ')');
  }

  /* ---------------------------------------------------------------- 状态 */

  const PAGE_SIZE = 15;

  const state = {
    q: '',
    filters: { kind: new Set(), family: new Set(), feel: new Set(), density: new Set(), origin: new Set(), use: new Set(), price: new Set() },
    current: null,
    page: 1
  };

  const priceLabel = (p) => '¥'.repeat(p);
  const hexLabel = (hex) => hex.toUpperCase();

  /* ---------------------------------------------------------------- 筛选器 */

  function uniqueInOrder(list) {
    const seen = new Set();
    return list.filter((v) => (seen.has(v) ? false : (seen.add(v), true)));
  }

  const ORIGIN_ORDER = ['北美', '南美', '欧洲', '非洲', '东南亚', '南亚', '中国', '日本', '中美洲', '多产地'];

  const facets = [
    { key: 'kind', label: '类别', items: ['木材', '古植物'] },
    {
      key: 'family',
      label: '色系',
      items: FAMILY_ORDER.filter((f) => WOODS.some((w) => w._family === f)),
      swatch: true
    },
    { key: 'feel', label: '硬度', items: FEEL_ORDER.filter((f) => WOODS.some((w) => w._feel === f)) },
    { key: 'density', label: '密度 g/cm³', items: ['轻', '中', '重', '沉'].filter((f) => WOODS.some((w) => w._density === f)) },
    {
      key: 'origin',
      label: '产地',
      items: ORIGIN_ORDER.filter((o) => WOODS.some((w) => w.origin.includes(o))),
      multi: true
    },
    { key: 'use', label: '用途', items: uniqueInOrder(WOODS.flatMap((w) => w.uses)), multi: true },
    { key: 'price', label: '价格', items: [1, 2, 3, 4], price: true }
  ];

  const DENSITY_TIP = { 轻: '< 0.45', 中: '0.45 – 0.65', 重: '0.65 – 0.90', 沉: '> 0.90' };
  const DENSITY_WORD = { 轻: '轻质', 中: '中等', 重: '偏重', 沉: '沉水级' };
  const FEEL_TIP = { 软: '< 3,000 N', 中: '3,000 – 5,000 N', 硬: '5,000 – 8,000 N', 很硬: '> 8,000 N' };
  const FAMILY_TIP = {
    浅色: '米白、浅黄、奶油色系',
    黄褐: '金黄、蜜色、茶褐',
    红褐: '红棕、砖红、赤褐',
    红: '朱红、紫红、深红',
    深褐: '巧克力、咖啡、墨褐',
    近黑: '黑檀、墨色',
    紫: '紫罗兰、紫褐',
    绿: '橄榄绿、墨绿'
  };

  function familySwatchColor(fam) {
    const group = WOODS.filter((w) => w._family === fam);
    if (!group.length) return '#ccc';
    return group[Math.floor(group.length / 2)].color.heart;
  }

  function renderFilters() {
    const host = $('#filters-body');
    host.innerHTML = facets
      .map((f) => {
        const chips = f.items
          .map((item) => {
            const label = f.price ? priceLabel(item) : item;
            const dot = f.swatch
              ? '<i class="chip-dot" style="background:' + familySwatchColor(item) + '"></i>'
              : '';
            let tip = '';
            if (f.key === 'family') tip = FAMILY_TIP[item] || '';
            if (f.key === 'feel') tip = FEEL_TIP[item] || '';
            if (f.key === 'density') tip = DENSITY_TIP[item] || '';
            if (f.key === 'price') tip = ['入门', '常见', '偏高', '名贵'][item - 1] || '';
            return (
              '<button type="button" class="chip" data-facet="' + f.key + '" data-value="' + item +
              '" aria-pressed="false"' + (tip ? ' title="' + esc(tip) + '"' : '') + '>' + dot +
              '<span>' + label + '</span></button>'
            );
          })
          .join('');
        return (
          '<div class="facet" data-facet-group="' + f.key + '">' +
          '<h4>' + f.label + '</h4><div class="chips">' + chips + '</div></div>'
        );
      })
      .join('');
  }

  function toggleFilter(key, value) {
    const set = state.filters[key];
    if (set.has(value)) set.delete(value);
    else set.add(value);
    state.page = 1;
    syncFilterUI();
    render();
  }

  function syncFilterUI() {
    $$('.chip').forEach((chip) => {
      const set = state.filters[chip.dataset.facet];
      const on = set.has(chip.dataset.value);
      chip.classList.toggle('is-on', on);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const n = Object.values(state.filters).reduce((a, s) => a + s.size, 0);
    const badge = $('#filter-count');
    if (badge) {
      badge.textContent = n ? String(n) : '';
      badge.hidden = n === 0;
    }
    const clear = $('#clear-filters');
    if (clear) clear.hidden = n === 0;
  }

  function clearFilters() {
    Object.values(state.filters).forEach((s) => s.clear());
    state.page = 1;
    syncFilterUI();
    render();
  }

  function resetAll() {
    Object.values(state.filters).forEach((s) => s.clear());
    state.q = '';
    state.page = 1;
    const input = $('#search');
    if (input) input.value = '';
    syncFilterUI();
    render();
  }

  /* ---------------------------------------------------------------- 匹配与渲染 */

  function matches(w) {
    if (state.q && !w._search.includes(state.q)) return false;
    for (const key in state.filters) {
      const set = state.filters[key];
      if (!set.size) continue;
      if (key === 'origin') {
        if (!w.origin.some((o) => set.has(o))) return false;
      } else if (key === 'use') {
        if (!w.uses.some((o) => set.has(o))) return false;
      } else if (key === 'price') {
        if (!set.has(String(w.price))) return false;
      } else if (key === 'kind') {
        if (!set.has(w._kind)) return false;
      } else if (key === 'family') {
        if (!set.has(w._family)) return false;
      } else if (key === 'feel') {
        if (!set.has(w._feel)) return false;
      } else if (key === 'density') {
        if (!set.has(w._density)) return false;
      }
    }
    return true;
  }

  function cardHTML(w) {
    const extinct = !!w.extinct;
    const hard = w.janka ? fmt(w.janka) + ' N' : w._feel;
    const cl = w.color.labels || ['新切心材', '边材', '氧化后'];
    const specs = extinct
      ? '<span><i>年代</i><b>' + esc(w.era) + '</b></span>' +
        '<span><i>体型</i><b>' + esc(w.size) + '</b></span>' +
        '<span><i>产地</i><b>' + esc(w.origin[0]) + '</b></span>'
      : '<span><i>硬度</i><b>' + hard + '</b></span>' +
        '<span><i>密度</i><b>' + w.density.toFixed(2) + '</b></span>' +
        '<span><i>产地</i><b>' + esc(w.origin[0]) + '</b></span>';
    return (
      '<article class="card">' +
      '<a class="card-link" href="#' + w.id + '" data-id="' + w.id + '">' +
      textureBlock(w, { caption: '' }) +
      '<div class="card-body">' +
      '<div class="card-title"><h3>' + esc(w.name) + '</h3>' +
      '<span class="card-en">' + esc(w.en) + '</span></div>' +
      '<p class="card-sci">' + esc(w.sci) + '</p>' +
      '<div class="card-specs">' + specs + '</div>' +
      '<div class="card-foot">' +
      '<span class="swatches">' +
      '<i style="background:' + w.color.heart + '" title="' + cl[0] + ' ' + hexLabel(w.color.heart) + '"></i>' +
      '<i style="background:' + w.color.sap + '" title="' + cl[1] + ' ' + hexLabel(w.color.sap) + '"></i>' +
      '<i style="background:' + w.color.aged + '" title="' + cl[2] + ' ' + hexLabel(w.color.aged) + '"></i>' +
      '</span>' +
      '<span class="card-tag">' + esc(w.type) + ' · ' + esc(w.tagNote || (extinct ? '已灭绝' : priceLabel(w.price))) + '</span>' +
      '</div></div></a></article>'
    );
  }

  let gridBuilt = false;

  function render() {
    const list = WOODS.filter(matches);
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const start = (state.page - 1) * PAGE_SIZE;
    const pageList = list.slice(start, start + PAGE_SIZE);

    const grid = $('#grid');
    if (!gridBuilt) {
      grid.innerHTML = WOODS.map(cardHTML).join('');
      gridBuilt = true;
      grid.setAttribute('aria-busy', 'false');
    }
    const visible = new Set(pageList.map((w) => w.id));
    $$('.card', grid).forEach((card) => {
      const link = card.firstElementChild;
      card.hidden = !visible.has(link.dataset.id);
    });
    $('#empty').hidden = list.length > 0;
    $('#result-count').textContent = list.length;
    $('#result-total').textContent = WOODS.length;
    renderPager(totalPages, list.length, start, pageList.length);
  }

  function pageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const out = [1];
    const left = Math.max(2, current - 1);
    const right = Math.min(total - 1, current + 1);
    if (left > 2) out.push('…');
    for (let i = left; i <= right; i++) out.push(i);
    if (right < total - 1) out.push('…');
    out.push(total);
    return out;
  }

  function renderPager(totalPages, total, start, count) {
    const pager = $('#pager');
    if (!pager) return;
    if (totalPages <= 1) {
      pager.hidden = true;
      pager.innerHTML = '';
      return;
    }
    pager.hidden = false;
    const nums = pageNumbers(state.page, totalPages);
    pager.innerHTML =
      '<p class="pager-info">第 ' + (start + 1) + '–' + (start + count) + ' 种 · 共 ' + total + ' 种</p>' +
      '<div class="pager-nav">' +
      '<button type="button" class="pager-arrow" data-page="' + (state.page - 1) + '"' +
      (state.page <= 1 ? ' disabled' : '') + ' aria-label="上一页">←</button>' +
      nums
        .map((n) =>
          n === '…'
            ? '<span class="pager-gap" aria-hidden="true">…</span>'
            : '<button type="button" class="pager-num' + (n === state.page ? ' is-current' : '') +
              '" data-page="' + n + '"' + (n === state.page ? ' aria-current="page"' : '') + '>' + n + '</button>'
        )
        .join('') +
      '<button type="button" class="pager-arrow" data-page="' + (state.page + 1) + '"' +
      (state.page >= totalPages ? ' disabled' : '') + ' aria-label="下一页">→</button>' +
      '</div>';
  }

  /* ---------------------------------------------------------------- 抽屉 */

  const drawer = $('#drawer');
  const backdrop = $('#backdrop');
  let lastFocus = null;
  let backdropTimer = null;

  function swatchCard(label, hex, sub) {
    return (
      '<button type="button" class="swatch-card" data-hex="' + hex + '" title="点击复制 ' + hexLabel(hex) + '">' +
      '<span class="swatch-fill" style="background:' + hex + '"></span>' +
      '<span class="swatch-label">' + label + '</span>' +
      '<span class="swatch-hex">' + hexLabel(hex) + '</span>' +
      (sub ? '<span class="swatch-sub">' + sub + '</span>' : '') +
      '</button>'
    );
  }

  function drawerHTML(w) {
    const idx = WOODS.indexOf(w) + 1;
    const extinct = !!w.extinct;
    const cl = w.color.labels || ['新切心材', '边材', '氧化后'];
    const cs = w.color.subs || ['刨光后', '通常较浅', '见光数月'];
    const prot = w.protection || (w.cites ? 'CITES II' : '—');
    const protSub = w.protectionSub || (w.cites ? '国际贸易受管制' : '暂无国际管制');
    const hardness = w.janka
      ? '<b>' + fmt(w.janka) + ' N</b><span>詹卡硬度 · 参考</span>'
      : '<b>' + w._feel + '</b><span>按密度与手感标注</span>';
    const stats = extinct
      ? '<div class="d-stats">' +
        '<div class="d-stat"><span>年代</span><b>' + esc(w.era) + '</b><span>已灭绝</span></div>' +
        '<div class="d-stat"><span>体型</span><b>' + esc(w.size) + '</b><span>复原推测</span></div>' +
        '<div class="d-stat"><span>分类</span><b>' + esc(w.clade) + '</b><span>古植物</span></div>' +
        '<div class="d-stat"><span>化石</span><b>' + esc(w.origin[0]) + '</b><span>主要产地</span></div>' +
        '</div>'
      : '<div class="d-stats">' +
        '<div class="d-stat"><span>硬度</span>' + hardness + '</div>' +
        '<div class="d-stat"><span>密度</span><b>' + w.density.toFixed(2) + ' g/cm³</b><span>' + DENSITY_WORD[w._density] + '</span></div>' +
        '<div class="d-stat"><span>价格</span><b>' + priceLabel(w.price) + '</b><span>' +
        ['入门', '常见', '偏高', '名贵'][w.price - 1] + '</span></div>' +
        '<div class="d-stat"><span>保护</span><b>' + esc(prot) + '</b><span>' + esc(protSub) + '</span></div>' +
        '</div>';
    const traits = extinct
      ? '<section class="d-sec"><h3>形态与保存</h3><dl class="d-list">' +
        '<div><dt>形态</dt><dd>' + esc(w.grain) + '</dd></div>' +
        '<div><dt>质地</dt><dd>' + esc(w.texture) + '</dd></div>' +
        '<div><dt>生境</dt><dd>' + esc(w.habitat) + '</dd></div>' +
        '<div><dt>保存</dt><dd>' + esc(w.work) + '</dd></div>' +
        '</dl></section>'
      : '<section class="d-sec"><h3>材性</h3><dl class="d-list">' +
        '<div><dt>纹理</dt><dd>' + esc(w.grain) + '</dd></div>' +
        '<div><dt>手感</dt><dd>' + esc(w.texture) + '</dd></div>' +
        '<div><dt>加工</dt><dd>' + esc(w.work) + '</dd></div>' +
        '<div><dt>气味</dt><dd>' + esc(w.smell) + '</dd></div>' +
        '<div><dt>耐候</dt><dd>' + esc(w.durability) + '</dd></div>' +
        '</dl></section>';
    const similar = w.similar
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map(
        (s) =>
          '<a class="similar-card" href="#' + s.id + '" data-id="' + s.id + '">' +
          '<span class="similar-tex" style="background:' + s.color.heart + '">' +
          woodTexture(s, {}) + '</span>' +
          '<span class="similar-meta"><b>' + esc(s.name) + '</b><i>' + esc(s.en) + '</i></span></a>'
      )
      .join('');

    return (
      '<div class="drawer-head">' +
      '<span class="drawer-brand">木谱 · ' + String(idx).padStart(2, '0') + ' / ' + WOODS.length + '</span>' +
      '<button type="button" class="icon-btn" data-close aria-label="关闭详情">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>' +
      '</button></div>' +
      '<div class="drawer-scroll" data-scroll>' +
      '<figure class="d-figure">' + textureBlock(w, { detail: true }) +
      '<figcaption>' + (w.photo ? '刨面实拍' + (w.photoCredit ? ' · ' + esc(w.photoCredit) : '') : (extinct ? '化石复原示意 · 程序生成' : '刨面图 · 程序生成示意')) + '</figcaption></figure>' +
      '<header class="d-head">' +
      '<p class="d-kicker">' + esc(w.type) + ' · ' + esc(w.origin.join(' / ')) + '</p>' +
      '<h2 id="d-name">' + esc(w.name) + '</h2>' +
      '<p class="d-latin"><span>' + esc(w.en) + '</span>' + (w.sci ? '<i>' + esc(w.sci) + '</i>' : '') + '</p>' +
      (w.aliases.length
        ? '<p class="d-alias">别名 ' + w.aliases.map(esc).join(' · ') + '</p>'
        : '') +
      '</header>' +
      stats +
      '<section class="d-sec">' +
      '<h3>色泽 <span class="h3-sub">点击色块复制</span></h3>' +
      '<div class="d-colors">' +
      swatchCard(cl[0], w.color.heart, cs[0]) +
      swatchCard(cl[1], w.color.sap, cs[1]) +
      swatchCard(cl[2], w.color.aged, cs[2]) +
      '</div>' +
      '<p class="d-note">' + esc(w.color.note) + '</p>' +
      '</section>' +
      traits +
      '<section class="d-sec"><h3>常见用途</h3><ul class="chips chips--static">' +
      w.uses.map((u) => '<li>' + esc(u) + '</li>').join('') +
      '</ul></section>' +
      '<section class="note-box note-box--creative"><h3>创作提示</h3><p>' + esc(w.creative) + '</p></section>' +
      '<section class="note-box note-box--warn"><h3>常见误用</h3><p>' + esc(w.mistake) + '</p></section>' +
      '<section class="d-sec"><h3>冷知识</h3><p class="d-text">' + esc(w.fact) + '</p></section>' +
      '<section class="d-sec"><h3>' + (extinct ? '相关物种' : '相似木材') + '</h3><div class="similar">' +
      (similar || '<p class="d-text">暂无</p>') +
      '</div></section>' +
      '<div class="d-actions">' +
      '<button type="button" class="btn btn--primary" data-print>打印设定卡</button>' +
      '<button type="button" class="btn btn--ghost" data-random>随机换一种</button>' +
      '</div>' +
      '<p class="d-disclaimer">' + (extinct ? '古植物的复原形态与年代为参考，具体分类以最新研究为准。' : '数值随产地、含水率与生长条件浮动，仅供创作参考。') + '</p>' +
      '</div>'
    );
  }

  function openWood(id, opts = {}) {
    const w = byId.get(id);
    if (!w) return;
    if (!opts.fromHistory) {
      lastFocus = document.activeElement;
      history.pushState({ wood: id }, '', '#' + id);
    }
    state.current = w;
    drawer.innerHTML = drawerHTML(w);
    drawer.classList.add('is-open');
    drawer.removeAttribute('aria-hidden');
    backdrop.removeAttribute('hidden');
    requestAnimationFrame(() => backdrop.classList.add('is-open'));
    document.body.classList.add('is-locked');
    const scroller = $('[data-scroll]', drawer);
    if (scroller) scroller.scrollTop = 0;
    const closeBtn = $('[data-close]', drawer);
    if (closeBtn && !opts.silent) closeBtn.focus({ preventScroll: true });
  }

  function closeDrawer(opts = {}) {
    if (!drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('is-open');
    clearTimeout(backdropTimer);
    backdropTimer = setTimeout(() => {
      if (!drawer.classList.contains('is-open')) backdrop.setAttribute('hidden', '');
    }, 340);
    document.body.classList.remove('is-locked');
    state.current = null;
    if (!opts.fromHistory) {
      const url = location.pathname + location.search;
      history.pushState({}, '', url);
    }
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------------- 打印 */

  function buildPrintSheet(w) {
    const idx = WOODS.indexOf(w) + 1;
    const extinct = !!w.extinct;
    const cl = w.color.labels || ['新切心材', '边材', '氧化后'];
    const sheet = $('#print-sheet');
    const specs = extinct
      ? '<div class="ps-specs">' +
        '<div><span>年代</span><b>' + esc(w.era) + '</b></div>' +
        '<div><span>体型</span><b>' + esc(w.size) + '</b></div>' +
        '<div><span>分类</span><b>' + esc(w.clade) + '</b></div>' +
        '<div><span>产地</span><b>' + esc(w.origin.length > 2 ? w.origin[0] + ' 等' : w.origin.join('、')) + '</b></div>' +
        '</div>'
      : '<div class="ps-specs">' +
        '<div><span>硬度</span><b>' + (w.janka ? fmt(w.janka) + ' N' : w._feel) + '</b></div>' +
        '<div><span>密度</span><b>' + w.density.toFixed(2) + '</b></div>' +
        '<div><span>类型</span><b>' + esc(w.type) + '</b></div>' +
        '<div><span>产地</span><b>' + esc(w.origin.join(' / ')) + '</b></div>' +
        '</div>';
    sheet.innerHTML =
      '<div class="ps">' +
      '<div class="ps-top"><span>木谱 · WOOD ATLAS</span><span>No. ' + String(idx).padStart(2, '0') + '</span></div>' +
      '<h1>' + esc(w.name) + '</h1>' +
      '<p class="ps-latin">' + esc(w.en) + (w.sci ? ' · ' + esc(w.sci) : '') + '</p>' +
      '<div class="ps-tex">' + (w.photo
        ? '<img src="' + esc(w.photo) + '" alt="' + esc(w.name) + ' 刨面">'
        : woodTexture(w, { detail: true })) + '</div>' +
      specs +
      '<div class="ps-colors">' +
      '<div><i style="background:' + w.color.heart + '"></i><span>' + esc(cl[0]) + '</span><b>' + hexLabel(w.color.heart) + '</b></div>' +
      '<div><i style="background:' + w.color.sap + '"></i><span>' + esc(cl[1]) + '</span><b>' + hexLabel(w.color.sap) + '</b></div>' +
      '<div><i style="background:' + w.color.aged + '"></i><span>' + esc(cl[2]) + '</span><b>' + hexLabel(w.color.aged) + '</b></div>' +
      '</div>' +
      '<div class="ps-row"><h2>色泽</h2><p>' + esc(w.color.note) + '</p></div>' +
      '<div class="ps-row"><h2>用途</h2><p>' + w.uses.map(esc).join('、') + '</p></div>' +
      '<div class="ps-row"><h2>创作提示</h2><p>' + esc(w.creative) + '</p></div>' +
      '<div class="ps-row"><h2>常见误用</h2><p>' + esc(w.mistake) + '</p></div>' +
      '<div class="ps-foot"><span>数值为参考值 · 纹理为示意</span>' +
      '<span class="ps-brand"><img src="simon-workshop.png" alt="">' +
      '<span>Simon Workshop<sup>™</sup></span></span></div>' +
      '</div>';
  }

  /* ---------------------------------------------------------------- 提示条 */

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 1800);
  }

  /* ---------------------------------------------------------------- 事件 */

  function bind() {
    const search = $('#search');
    search.addEventListener('input', () => {
      state.q = search.value.trim().toLowerCase();
      state.page = 1;
      render();
    });

    $('#filters').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      toggleFilter(chip.dataset.facet, chip.dataset.value);
    });

    $('#clear-filters').addEventListener('click', clearFilters);
    $('#clear-empty').addEventListener('click', resetAll);

    $('#pager').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-page]');
      if (!btn || btn.disabled) return;
      const p = Number(btn.dataset.page);
      if (!p || p === state.page) return;
      state.page = p;
      render();
      const results = $('.results');
      if (results) results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const sample = $('#hero-sample');
    if (sample) {
      sample.addEventListener('click', (e) => {
        const a = e.target.closest('.sample-card');
        if (!a) return;
        e.preventDefault();
        openWood(a.dataset.id);
      });
    }

    $$('.search-hints button').forEach((btn) => {
      btn.addEventListener('click', () => {
        search.value = btn.dataset.q;
        state.q = btn.dataset.q.toLowerCase();
        state.page = 1;
        render();
        search.focus();
      });
    });

    $('#grid').addEventListener('click', (e) => {
      const link = e.target.closest('.card-link');
      if (!link) return;
      e.preventDefault();
      openWood(link.dataset.id);
    });

    $('#drawer').addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) {
        closeDrawer();
        return;
      }
      if (e.target.closest('[data-print]')) {
        if (state.current) {
          buildPrintSheet(state.current);
          document.body.classList.add('is-printing');
          window.print();
        }
        return;
      }
      if (e.target.closest('[data-random]')) {
        randomWood();
        return;
      }
      const sw = e.target.closest('.swatch-card');
      if (sw) {
        const hex = sw.dataset.hex.toUpperCase();
        copyText(hex).then(
          () => toast('已复制 ' + hex),
          () => toast('复制失败，请手动选择')
        );
        return;
      }
      const sim = e.target.closest('.similar-card');
      if (sim) {
        e.preventDefault();
        openWood(sim.dataset.id);
      }
    });

    backdrop.addEventListener('click', () => closeDrawer());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (drawer.classList.contains('is-open')) closeDrawer();
        else if (document.activeElement === search) {
          search.value = '';
          state.q = '';
          render();
          search.blur();
        }
      }
      if (e.key === '/' && document.activeElement !== search && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        e.preventDefault();
        search.focus();
      }
      if (e.key === 'Tab' && drawer.classList.contains('is-open')) {
        const f = $$('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])', drawer).filter(
          (el) => el.offsetParent !== null
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    window.addEventListener('popstate', () => {
      const id = location.hash.slice(1);
      if (id && byId.has(id)) openWood(id, { fromHistory: true, silent: true });
      else closeDrawer({ fromHistory: true });
    });

    $('#random-btn').addEventListener('click', () => randomWood());

    const filterToggle = $('#filter-toggle');
    if (filterToggle) {
      filterToggle.addEventListener('click', () => {
        const panel = $('#filters');
        const open = panel.classList.toggle('is-open');
        filterToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        filterToggle.firstChild.textContent = open ? '收起 ' : '筛选 ';
        if (open) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    window.addEventListener('beforeprint', () => {
      if (state.current) {
        buildPrintSheet(state.current);
        document.body.classList.add('is-printing');
      } else {
        document.body.classList.remove('is-printing');
      }
    });

    window.addEventListener('afterprint', () => {
      document.body.classList.remove('is-printing');
    });
  }

  let lastRandom = null;
  function randomWood() {
    let pool = WOODS.filter((w) => w.id !== (state.current && state.current.id) && w.id !== lastRandom);
    if (!pool.length) pool = WOODS;
    const w = pool[Math.floor(Math.random() * pool.length)];
    lastRandom = w.id;
    openWood(w.id);
    const scroller = $('[data-scroll]', drawer);
    if (scroller) scroller.scrollTop = 0;
  }

  function renderHeroSample() {
    const host = $('#hero-sample');
    if (!host) return;
    const d = new Date();
    const key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    const w = WOODS[hashStr(key) % WOODS.length];
    const idx = WOODS.indexOf(w) + 1;
    const extinct = !!w.extinct;
    const specLine = extinct
      ? esc(w.era) + ' · ' + esc(w.size) + ' · ' + esc(w.origin[0])
      : (w.janka ? fmt(w.janka) + ' N' : w._feel) + ' · ' + w.density.toFixed(2) + ' g/cm³ · ' + esc(w.origin[0]);
    const media = w.photo
      ? '<img class="tex-img" src="' + esc(w.photo) + '" alt="' + esc(w.name) + ' 刨面">'
      : woodTexture(w, { detail: true }) + '<span class="tex-grain" aria-hidden="true"></span>';
    host.innerHTML =
      '<a class="sample-card" href="#' + w.id + '" data-id="' + w.id + '">' +
      '<span class="sample-tex">' + media + '</span>' +
      '<span class="sample-body">' +
      '<span class="sample-kicker">' + (extinct ? '今日古植物' : '今日木样') + ' · ' + String(idx).padStart(2, '0') + ' / ' + WOODS.length + '</span>' +
      '<span class="sample-name">' + esc(w.name) + '</span>' +
      '<span class="sample-en">' + esc(w.en) + '</span>' +
      '<span class="sample-specs">' + specLine + '</span>' +
      '<span class="sample-cta">查看详情 <span aria-hidden="true">→</span></span>' +
      '</span></a>';
  }

  /* ---------------------------------------------------------------- 启动 */

  function init() {
    installNoise();
    $$('[data-wood-count]').forEach((el) => {
      el.textContent = String(WOODS.length);
    });
    renderHeroSample();
    $('#colorband').innerHTML = WOODS.map(
      (w) => '<span style="background:' + w.color.heart + '" title="' + esc(w.name) + '"></span>'
    ).join('');
    renderFilters();
    syncFilterUI();
    const initial = byId.get(location.hash.slice(1));
    if (initial) state.page = Math.floor(WOODS.indexOf(initial) / PAGE_SIZE) + 1;
    render();
    bind();
    if (initial) openWood(initial.id, { fromHistory: true, silent: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
