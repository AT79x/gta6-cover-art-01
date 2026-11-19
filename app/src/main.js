// Solmar Bay Cover Maker — the editor.
//
// Wires the page: photos in (upload or the three built-in samples), a panel
// picked by clicking the preview, drag to pan and a slider to zoom each
// photo, caption and grade controls, and a one-click PNG export in the
// three post sizes. A `?shot=` query sets up a fixed scene for a
// screenshot instead (./shots.js).

import { LAYOUTS, GRADES, SIZES, drawCover, renderExport, panelRects, coverFrame } from './cover.js';
import { runShot } from './shots.js';

/** The three photos shipped with the app, free to use in a cover. */
export const SAMPLES = [
  { id: 'pier', name: 'Pier — fishing at noon', file: 'samples/pier.jpg' },
  { id: 'boulevard', name: 'Boulevard — sunset convertible', file: 'samples/boulevard.jpg' },
  { id: 'solmar', name: 'Solmar Bay — the city itself', file: 'samples/solmar.jpg' },
];

/** A fresh editor state: trio layout, sunset grade, square export. */
export function createDefaultState() {
  return {
    layout: 'trio',
    grade: 'sunset',
    size: '1080x1080',
    title: 'Sunset Heist',
    subtitle: 'Solmar Bay',
    titleScale: 1,
    captionPos: 'bottom',
    photos: [],
    assignments: [],
    crops: {},
    selectedPanel: 0,
  };
}

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const state = createDefaultState();
let photoCounter = 0;

function defaultCrop() {
  // Faces usually sit in the upper half of a photo, so the focal point
  // starts a little above centre.
  return { cx: 0.5, cy: 0.42, zoom: 1, fit: 'fill' };
}

/** Adds a loaded image to the photo tray and fills empty panels with it. */
export function addPhoto(img, name) {
  const photo = { id: `photo-${++photoCounter}`, name, img };
  state.photos.push(photo);
  state.crops[photo.id] = defaultCrop();
  const count = LAYOUTS[state.layout].panels.length;
  while (state.assignments.length < count) state.assignments.push(-1);
  for (let i = 0; i < state.assignments.length; i += 1) {
    if (state.assignments[i] === -1) state.assignments[i] = state.photos.length - 1;
  }
  renderTray();
  return photo;
}

/** Re-assigns every panel to the photo at `photoIndex`. */
export function fillAllPanels(photoIndex) {
  state.assignments = state.assignments.map(() => photoIndex);
}

/** Keeps assignments the right length when the layout changes. */
export function applyLayout(layout) {
  state.layout = layout;
  const count = LAYOUTS[layout].panels.length;
  const fallback = state.photos.length ? state.photos.length - 1 : -1;
  state.assignments = Array.from({ length: count }, (_, i) => state.assignments[i] ?? fallback);
  if (state.selectedPanel >= count) state.selectedPanel = 0;
}

/** Redraws the preview canvas at the chosen export size. */
export function redraw() {
  const size = SIZES[state.size];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  drawCover(canvas, state);
  syncControls();
}

/** Reflects the state back into the control panel (buttons, sliders, tray). */
export function syncControls() {
  document.querySelectorAll('[data-layout]').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('[data-grade]').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  document.querySelectorAll('[data-size]').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === state.size);
  });
  document.querySelectorAll('[data-pos]').forEach((b) => {
    b.classList.toggle('active', b.dataset.pos === state.captionPos);
  });
  const crop = selectedCrop();
  const zoom = document.getElementById('zoom');
  if (zoom) zoom.value = String(crop.zoom);
  const zoomValue = document.getElementById('zoom-value');
  if (zoomValue) zoomValue.textContent = `${crop.zoom.toFixed(2)}×`;
  const fit = document.getElementById('fit');
  if (fit) fit.textContent = crop.fit === 'fill' ? 'Fill panel' : 'Fit whole photo';
  const panelLabel = document.getElementById('panel-label');
  if (panelLabel) {
    panelLabel.textContent = `Panel ${state.selectedPanel + 1} of ${LAYOUTS[state.layout].panels.length}`;
  }
  document.querySelectorAll('#tray .thumb').forEach((thumb) => {
    thumb.classList.toggle(
      'assigned',
      state.assignments[state.selectedPanel] === Number(thumb.dataset.photo),
    );
  });
}

/** The crop of the photo in the selected panel (a blank default when empty). */
export function selectedCrop() {
  const photoIndex = state.assignments[state.selectedPanel];
  const photo = photoIndex >= 0 ? state.photos[photoIndex] : null;
  return photo ? state.crops[photo.id] : defaultCrop();
}

/** Rebuilds the photo tray thumbnails from the loaded photos. */
export function renderTray() {
  const tray = document.getElementById('tray');
  tray.innerHTML = '';
  state.photos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb';
    button.dataset.photo = String(index);
    button.title = `${photo.name} — click to put in the selected panel`;
    const thumb = document.createElement('img');
    thumb.src = photo.img.src;
    thumb.alt = photo.name;
    button.appendChild(thumb);
    const label = document.createElement('span');
    label.textContent = photo.name;
    button.appendChild(label);
    button.addEventListener('click', () => {
      state.assignments[state.selectedPanel] = index;
      redraw();
    });
    button.addEventListener('dblclick', () => {
      fillAllPanels(index);
      redraw();
    });
    tray.appendChild(button);
  });
}

/** Panel rectangles of the preview canvas, in canvas pixels. */
export function previewRects() {
  const { frame, gutter } = coverFrame(canvas.width, canvas.height);
  return panelRects(canvas.width, canvas.height, state.layout, frame, gutter);
}

/** Which panel (if any) holds the canvas point (x, y). */
export function panelAt(x, y) {
  return previewRects().findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

/** Converts a pointer event on the canvas to canvas pixels. */
export function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

// ---- photo input: uploads and samples -------------------------------------

document.getElementById('upload').addEventListener('change', async (event) => {
  const files = [...event.target.files];
  for (const file of files) {
    try {
      const img = await loadImage(URL.createObjectURL(file));
      addPhoto(img, file.name.replace(/\.[^.]+$/, ''));
    } catch {
      status.textContent = `Could not read ${file.name} as a photo.`;
    }
  }
  redraw();
});

document.getElementById('fill-all').addEventListener('click', () => {
  const photoIndex = state.assignments[state.selectedPanel];
  if (photoIndex >= 0) {
    fillAllPanels(photoIndex);
    redraw();
    status.textContent = 'One photo now fills every panel.';
  }
});

// ---- layout, grade, size, caption ------------------------------------------

document.querySelectorAll('[data-layout]').forEach((button) => {
  button.addEventListener('click', () => {
    applyLayout(button.dataset.layout);
    redraw();
  });
});
document.querySelectorAll('[data-grade]').forEach((button) => {
  button.addEventListener('click', () => {
    state.grade = button.dataset.grade;
    redraw();
  });
});
document.querySelectorAll('[data-size]').forEach((button) => {
  button.addEventListener('click', () => {
    state.size = button.dataset.size;
    redraw();
  });
});
document.querySelectorAll('[data-pos]').forEach((button) => {
  button.addEventListener('click', () => {
    state.captionPos = button.dataset.pos;
    redraw();
  });
});

document.getElementById('title').addEventListener('input', (event) => {
  state.title = event.target.value;
  redraw();
});
document.getElementById('subtitle').addEventListener('input', (event) => {
  state.subtitle = event.target.value;
  redraw();
});
document.getElementById('title-size').addEventListener('input', (event) => {
  state.titleScale = Number(event.target.value);
  redraw();
});

// ---- per-panel crop: zoom slider, fit toggle, recenter ---------------------

document.getElementById('zoom').addEventListener('input', (event) => {
  selectedCrop().zoom = Number(event.target.value);
  redraw();
});
document.getElementById('fit').addEventListener('click', () => {
  const crop = selectedCrop();
  crop.fit = crop.fit === 'fill' ? 'fit' : 'fill';
  redraw();
});
document.getElementById('recenter').addEventListener('click', () => {
  const crop = selectedCrop();
  crop.cx = 0.5;
  crop.cy = 0.5;
  crop.zoom = 1;
  redraw();
});

// ---- pointer: click a panel to select it, drag to pan its photo ------------

let drag = null;
canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  const hit = panelAt(point.x, point.y);
  if (hit === -1) return;
  state.selectedPanel = hit;
  canvas.setPointerCapture(event.pointerId);
  drag = { x: point.x, y: point.y, moved: false };
  redraw();
});
canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const point = canvasPoint(event);
  const dx = point.x - drag.x;
  const dy = point.y - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
  const photoIndex = state.assignments[state.selectedPanel];
  const photo = photoIndex >= 0 ? state.photos[photoIndex] : null;
  if (!photo) return;
  const crop = state.crops[photo.id];
  const rect = previewRects()[state.selectedPanel];
  const iw = photo.img.naturalWidth || photo.img.width;
  const ih = photo.img.naturalHeight || photo.img.height;
  const base = crop.fit === 'fit'
    ? Math.min(rect.w / iw, rect.h / ih)
    : Math.max(rect.w / iw, rect.h / ih);
  const scale = base * crop.zoom;
  crop.cx = Math.min(1.15, Math.max(-0.15, crop.cx - dx / (iw * scale)));
  crop.cy = Math.min(1.15, Math.max(-0.15, crop.cy - dy / (ih * scale)));
  drag.x = point.x;
  drag.y = point.y;
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const crop = selectedCrop();
  crop.zoom = Math.min(3, Math.max(1, crop.zoom * Math.exp(-event.deltaY * 0.0012)));
  redraw();
}, { passive: false });

// ---- export ----------------------------------------------------------------

document.getElementById('export').addEventListener('click', () => {
  const size = SIZES[state.size];
  const out = renderExport(state, state.size);
  out.toBlob((blob) => {
    if (!blob) {
      status.textContent = 'Export failed — the browser could not write the PNG.';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `solmar-bay-cover-${state.size}.png`;
    a.click();
    status.textContent = `Saved solmar-bay-cover-${state.size}.png (${size.w} × ${size.h}).`;
  }, 'image/png');
});

// ---- boot: samples in, then either a screenshot scene or the live editor ----

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, {
    state,
    loadSample: async (name) => {
      const sample = SAMPLES.find((s) => s.id === name) || SAMPLES[0];
      const existing = state.photos.findIndex((p) => p.name === sample.name);
      if (existing >= 0) return state.photos[existing];
      return addPhoto(await loadImage(sample.file), sample.name);
    },
    applyLayout,
    fillAllPanels,
    redraw,
  });
} else {
  (async () => {
    for (const sample of SAMPLES) {
      addPhoto(await loadImage(sample.file), sample.name);
    }
    applyLayout('trio');
    state.assignments = [0, 1, 2];
    redraw();
  })();
}
