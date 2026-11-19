// Fixed scenes for screenshots: ?shot=editor shows the editor with a sample
// photo loaded; ?shot=cover shows the cover alone, full-bleed; ?shot=cover
// -portrait shows the portrait export. Parameters:
//   photo    — sample id for the hero panel (pier, boulevard, solmar)
//   photos   — comma list of sample ids, one per panel, in order
//   caption  — the big title; subtitle — the small line under/over it
//   layout   — hero, split, trio, grid, strip
//   grade    — sunset, neon, noir
//   size     — 1080x1080, 1080x1350, 1920x1080
// window.__shotReady is set once the scene has painted.
export async function runShot(shot, query, env) {
  const get = (key, fallback) => query.get(key) ?? fallback;
  const isCover = shot === 'cover' || shot === 'cover-portrait';
  if (isCover) document.body.classList.add('shot-cover');

  env.state.layout = get('layout', shot === 'cover-portrait' ? 'strip' : 'trio');
  env.state.grade = get('grade', shot === 'cover-portrait' ? 'neon' : 'sunset');
  env.state.title = get('caption', 'Sunset Heist');
  env.state.subtitle = get('subtitle', 'Solmar Bay');
  env.state.captionPos = get('pos', 'bottom');
  env.state.size = get('size', shot === 'cover-portrait' ? '1080x1350' : '1080x1080');
  env.state.titleScale = Number(get('scale', '1'));

  // Load every sample first, so the editor's tray shows all three; then
  // assign the named ones to the panels, in order.
  for (const sample of ['pier', 'boulevard', 'solmar']) await env.loadSample(sample);
  const names = (get('photos', get('photo', 'pier'))).split(',').map((n) => n.trim());
  const photos = [];
  for (const name of names) photos.push(await env.loadSample(name));
  env.applyLayout(env.state.layout);
  env.state.assignments = env.state.assignments.map((_, i) => {
    const photo = photos[Math.min(i, photos.length - 1)];
    return env.state.photos.indexOf(photo);
  });

  // In cover shots, bias every photo's focal point upward so faces stay
  // clear of the caption scrim and out of short panels.
  if (isCover) {
    for (const photo of photos) env.state.crops[photo.id].cy = 0.35;
  }

  env.redraw();
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  window.__shotReady = true;
}
