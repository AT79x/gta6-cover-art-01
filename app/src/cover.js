// Solmar Bay Cover Maker — the cover renderer.
//
// Draws a multi-panel poster-style cover from the editor state: each panel
// holds one of the user's photos (cropped and positioned per panel), a
// Vice City colour grade washes over the whole poster, and a big bold
// caption sits on a scrim at the top or the bottom. Everything is drawn
// with the canvas 2D API, no network, and the grain is deterministic: a
// seeded PRNG, never Math.random, so the same state always exports the
// same PNG bytes.

/** The five panel layouts. Each panel is a fraction {x, y, w, h} of the frame. */
export const LAYOUTS = {
  hero: {
    label: 'Hero — one big photo',
    panels: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  split: {
    label: 'Split — two side by side',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  trio: {
    label: 'Trio — hero over two small',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.62 },
      { x: 0, y: 0.62, w: 0.5, h: 0.38 },
      { x: 0.5, y: 0.62, w: 0.5, h: 0.38 },
    ],
  },
  grid: {
    label: 'Grid — four squares',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  strip: {
    label: 'Strip — hero over a wide strip',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.72 },
      { x: 0, y: 0.72, w: 1, h: 0.28 },
    ],
  },
};

/** The three colour grades: a photo filter plus a wash and an accent colour. */
export const GRADES = {
  sunset: {
    label: 'Sunset — warm Vice City dusk',
    filter: 'saturate(1.32) contrast(1.08) brightness(1.02)',
    washTop: 'rgba(255, 122, 61, 0.10)',
    washBottom: 'rgba(198, 32, 110, 0.34)',
    accent: '#ff7a3d',
    shadow: '#ff2e88',
  },
  neon: {
    label: 'Neon — magenta and cyan nights',
    filter: 'saturate(1.5) contrast(1.12) hue-rotate(-14deg)',
    washTop: 'rgba(255, 46, 166, 0.22)',
    washBottom: 'rgba(34, 230, 255, 0.26)',
    accent: '#22e6ff',
    shadow: '#ff2ea6',
  },
  noir: {
    label: 'Noir — high-contrast black and white',
    filter: 'grayscale(0.9) contrast(1.28) brightness(0.96)',
    washTop: 'rgba(20, 24, 48, 0.12)',
    washBottom: 'rgba(8, 8, 16, 0.42)',
    accent: '#f2f2f2',
    shadow: '#000000',
  },
};

/** The three export sizes, in pixels. */
export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square 1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Wide 1920 × 1080' },
};

/** A small deterministic PRNG (mulberry32): the grain must look the same every run. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let grainTile = null;
/** Builds (once) a small noise tile from the seeded PRNG, for the film grain. */
export function grainPattern(ctx) {
  if (grainTile) return grainTile;
  const size = 160;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext('2d');
  const image = tctx.createImageData(size, size);
  const rand = mulberry32(20261119);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  tctx.putImageData(image, 0, 0);
  grainTile = ctx.createPattern(tile, 'repeat');
  return grainTile;
}

/**
 * Panel rectangles in pixels for a layout, inside the poster's frame.
 * Returns [{x, y, w, h}] with `gutter` pixels between panels.
 */
export function coverFrame(width, height) {
  return {
    frame: Math.max(10, Math.round(Math.min(width, height) * 0.014)),
    gutter: Math.max(6, Math.round(Math.min(width, height) * 0.007)),
  };
}

export function panelRects(width, height, layout, frame, gutter) {
  const innerW = width - frame * 2;
  const innerH = height - frame * 2;
  return LAYOUTS[layout].panels.map((p) => {
    const x = frame + p.x * innerW + (p.x > 0 ? gutter / 2 : 0);
    const y = frame + p.y * innerH + (p.y > 0 ? gutter / 2 : 0);
    const w = p.w * innerW - (p.x > 0 ? gutter / 2 : 0) - (p.x + p.w < 1 ? gutter / 2 : 0);
    const h = p.h * innerH - (p.y > 0 ? gutter / 2 : 0) - (p.y + p.h < 1 ? gutter / 2 : 0);
    return { x, y, w, h };
  });
}

/**
 * Draws one photo into a panel rect, honouring its crop: `crop.cx/cy` is the
 * focal point (0..1 across the photo), `crop.zoom` magnifies it, and
 * `crop.fit` is 'fill' (cover the panel) or 'fit' (show the whole photo).
 */
export function drawPhotoInPanel(ctx, img, rect, crop, filter) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = crop.fit === 'fit'
    ? Math.min(rect.w / iw, rect.h / ih)
    : Math.max(rect.w / iw, rect.h / ih);
  const scale = base * (crop.zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  let dx = rect.x + rect.w / 2 - (crop.cx ?? 0.5) * dw;
  let dy = rect.y + rect.h / 2 - (crop.cy ?? 0.5) * dh;
  // Never leave a gap: when the photo only just covers the panel in a
  // direction, centre it there; otherwise keep the focal point in view.
  dx = dw <= rect.w
    ? rect.x + (rect.w - dw) / 2
    : Math.min(rect.x, Math.max(rect.x + rect.w - dw, dx));
  dy = dh <= rect.h
    ? rect.y + (rect.h - dh) / 2
    : Math.min(rect.y, Math.max(rect.y + rect.h - dh, dy));
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = filter || 'none';
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** The heavy poster lettering: uppercase, slanted, outlined, with a colour drop shadow. */
export function drawTitle(ctx, text, cx, baselineY, maxWidth, size, grade) {
  const words = text.trim().toUpperCase();
  if (!words) return;
  let fontSize = size;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const setFont = (s) => {
    ctx.font = `900 ${s}px "Arial Black", "Arial Bold", system-ui, sans-serif`;
    try { ctx.letterSpacing = `${Math.max(1, s * 0.015)}px`; } catch { /* older canvas: no letterSpacing */ }
  };
  setFont(fontSize);
  while (ctx.measureText(words).width > maxWidth && fontSize > 16) {
    fontSize -= 4;
    setFont(fontSize);
  }
  // A slight forward slant, the poster's signature lean.
  ctx.translate(cx, baselineY);
  ctx.transform(1, 0, -0.07, 1, 0, 0);
  ctx.shadowColor = grade.shadow;
  ctx.shadowBlur = fontSize * 0.22;
  ctx.shadowOffsetX = fontSize * 0.045;
  ctx.shadowOffsetY = fontSize * 0.045;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(12, 4, 20, 0.9)';
  ctx.lineWidth = Math.max(2, fontSize * 0.09);
  ctx.strokeText(words, 0, 0);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(words, 0, 0);
  ctx.restore();
}

/** The smaller sub-caption, letterspaced, in the grade's accent colour. */
export function drawSubtitle(ctx, text, cx, baselineY, maxWidth, size, grade) {
  const words = text.trim().toUpperCase();
  if (!words) return;
  let fontSize = size;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const setFont = (s) => {
    ctx.font = `700 ${s}px system-ui, sans-serif`;
    try { ctx.letterSpacing = `${Math.max(2, s * 0.22)}px`; } catch { /* older canvas */ }
  };
  setFont(fontSize);
  while (ctx.measureText(words).width > maxWidth && fontSize > 10) {
    fontSize -= 2;
    setFont(fontSize);
  }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(12, 4, 20, 0.85)';
  ctx.lineWidth = Math.max(2, fontSize * 0.16);
  ctx.strokeText(words, cx, baselineY);
  ctx.fillStyle = grade.accent;
  ctx.fillText(words, cx, baselineY);
  ctx.restore();
}

/**
 * Draws the whole cover onto `canvas` (at its own size) from the editor state:
 *   state = { layout, grade, title, subtitle, titleScale, captionPos,
 *             photos: [{img}], assignments: [photoIndex], crops: {photoId: crop} }
 * A photo index of -1 leaves the panel as a flat colour block.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const grade = GRADES[state.grade] || GRADES.sunset;
  const { frame, gutter } = coverFrame(W, H);

  // Backing: deep plum, then the cream poster frame.
  ctx.fillStyle = '#160a24';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f7f1e3';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#160a24';
  ctx.fillRect(frame, frame, W - frame * 2, H - frame * 2);

  // Panels.
  const rects = panelRects(W, H, state.layout, frame, gutter);
  const fallback = ['#3d1c5c', '#7a2a6d', '#c2452f', '#1d4e6b'];
  rects.forEach((rect, i) => {
    const photoIndex = state.assignments[i];
    const photo = photoIndex >= 0 ? state.photos[photoIndex] : null;
    if (photo && photo.img) {
      const crop = state.crops[photo.id] || { cx: 0.5, cy: 0.5, zoom: 1, fit: 'fill' };
      drawPhotoInPanel(ctx, photo.img, rect, crop, grade.filter);
    } else {
      ctx.fillStyle = fallback[i % fallback.length];
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  });

  // The grade wash: warm sunset from the top, deeper colour at the foot.
  const wash = ctx.createLinearGradient(0, frame, 0, H - frame);
  wash.addColorStop(0, grade.washTop);
  wash.addColorStop(1, grade.washBottom);
  ctx.fillStyle = wash;
  ctx.fillRect(frame, frame, W - frame * 2, H - frame * 2);

  // Vignette: darkened corners pull the eye to the middle.
  const vig = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(8, 2, 16, 0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(frame, frame, W - frame * 2, H - frame * 2);

  // Film grain, deterministic: the same seeded tile every run.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(frame, frame, W - frame * 2, H - frame * 2);
  ctx.restore();

  // Caption scrim + lettering, at the top or the bottom.
  const atTop = state.captionPos === 'top';
  const bandH = H * 0.36;
  const scrim = atTop
    ? ctx.createLinearGradient(0, frame, 0, frame + bandH)
    : ctx.createLinearGradient(0, H - frame - bandH, 0, H - frame);
  if (atTop) {
    scrim.addColorStop(0, 'rgba(10, 4, 20, 0.78)');
    scrim.addColorStop(1, 'rgba(10, 4, 20, 0)');
  } else {
    scrim.addColorStop(0, 'rgba(10, 4, 20, 0)');
    scrim.addColorStop(1, 'rgba(10, 4, 20, 0.78)');
  }
  ctx.fillStyle = scrim;
  ctx.fillRect(frame, atTop ? frame : H - frame - bandH, W - frame * 2, bandH);

  const pad = frame + W * 0.045;
  const maxText = W - pad * 2;
  const baseTitle = H * 0.105 * (state.titleScale || 1);
  const baseSub = H * 0.032;
  if (atTop) {
    drawTitle(ctx, state.title, W / 2, frame + baseTitle * 1.05, maxText, baseTitle, grade);
    drawSubtitle(ctx, state.subtitle, W / 2, frame + baseTitle * 1.05 + baseSub * 1.7, maxText, baseSub, grade);
  } else {
    drawSubtitle(ctx, state.subtitle, W / 2, H - frame - baseTitle * 1.28, maxText, baseSub, grade);
    drawTitle(ctx, state.title, W / 2, H - frame - baseTitle * 0.28, maxText, baseTitle, grade);
  }

  // Thin dark keyline just inside the cream frame.
  ctx.strokeStyle = 'rgba(22, 10, 36, 0.55)';
  ctx.lineWidth = Math.max(2, Math.round(Math.min(W, H) * 0.002));
  ctx.strokeRect(frame + 2, frame + 2, W - frame * 2 - 4, H - frame * 2 - 4);
}

/** Renders the state to a fresh canvas at one of the export sizes. */
export function renderExport(state, sizeKey) {
  const size = SIZES[sizeKey] || SIZES['1080x1080'];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state);
  return canvas;
}
