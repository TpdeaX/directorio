import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DIRECTORY_ORDER,
  buildCompanionSummary,
  normalizeConfig,
  readArenaCatalogMeta,
  resolveEcosystemAppUrl,
} from '../src/state/DirectoryStore.ts';
import { Icons } from '../src/icons.ts';

function installWindowMock(href = 'http://localhost:5178/') {
  const storage = new Map<string, string>();
  const url = new URL(href);
  const prevWindow = (globalThis as { window?: unknown }).window;
  const prevStorage = (globalThis as { localStorage?: unknown }).localStorage;

  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      storage.set(k, String(v));
    },
    removeItem: (k: string) => {
      storage.delete(k);
    },
    clear: () => storage.clear(),
  };

  (globalThis as { window?: unknown }).window = {
    location: {
      href: url.href,
      hostname: url.hostname,
      port: url.port,
      protocol: url.protocol,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
    },
    matchMedia: () => ({ matches: false }),
    setTimeout,
    clearTimeout,
  };

  return () => {
    (globalThis as { window?: unknown }).window = prevWindow;
    (globalThis as { localStorage?: unknown }).localStorage = prevStorage;
  };
}

test('DEFAULT_DIRECTORY_ORDER includes mod-drawing right after mod-calligraphy', () => {
  const calliIdx = DEFAULT_DIRECTORY_ORDER.indexOf('mod-calligraphy');
  const drawingIdx = DEFAULT_DIRECTORY_ORDER.indexOf('mod-drawing');
  assert.ok(calliIdx >= 0, 'mod-calligraphy should exist');
  assert.equal(drawingIdx, calliIdx + 1, 'mod-drawing should appear right after mod-calligraphy');
});

test('readArenaCatalogMeta fallback returns total 33 and academies 15', () => {
  const cleanup = installWindowMock();
  try {
    const meta = readArenaCatalogMeta();
    assert.equal(meta.total, 33);
    assert.equal(meta.academies, 15);
    assert.equal(meta.dexterity2d, 13);
    assert.equal(meta.action3d, 5);
  } finally {
    cleanup();
  }
});

test('buildCompanionSummary defaults atelierTotalModules to 10', () => {
  const cleanup = installWindowMock();
  try {
    const summary = buildCompanionSummary();
    assert.equal(summary.atelierTotalModules, 10);
  } finally {
    cleanup();
  }
});

test("resolveEcosystemAppUrl('atelier', 'calm?sos=1') keeps ?eco_theme= before #calm?sos=1", () => {
  const cleanup = installWindowMock('http://localhost:5178/');
  try {
    localStorage.setItem('umbral-theme', 'dark');
    const url = resolveEcosystemAppUrl('atelier', 'calm?sos=1');
    assert.equal(url, 'http://localhost:5176/?eco_theme=dark#calm?sos=1');
    const ecoIdx = url.indexOf('?eco_theme=');
    const hashIdx = url.indexOf('#calm?sos=1');
    assert.ok(ecoIdx > 0 && hashIdx > ecoIdx, 'eco_theme query param must precede #calm?sos=1');
  } finally {
    cleanup();
  }
});

test('normalizeConfig merges legacy custom order preserving existing order and adding mod-drawing', () => {
  const legacyOrder = ['app-arena', 'mod-studio', 'mod-calligraphy'];
  const cfg = normalizeConfig({ order: legacyOrder });
  assert.deepEqual(cfg.order.slice(0, 3), legacyOrder);
  assert.ok(cfg.order.includes('mod-drawing'));
});

test('Icons.palette and Icons.heartPulse render single-stroke SVGs with stroke="currentColor"', () => {
  for (const svg of [Icons.palette(), Icons.heartPulse()]) {
    assert.ok(svg.includes('<svg'));
    assert.ok(svg.includes('stroke="currentColor"'));
    assert.ok(svg.includes('fill="none"'));
  }
});
