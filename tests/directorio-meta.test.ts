import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DAILY_ROUTE_STORAGE_KEY,
  DEFAULT_DIRECTORY_ORDER,
  buildCompanionSummary,
  buildDailyRoutePlan,
  normalizeConfig,
  readArenaCatalogMeta,
  readDailyRouteDone,
  resolveEcosystemAppUrl,
  toggleDailyRouteStep,
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

test('readArenaCatalogMeta fallback returns total 40 and academies 22', () => {
  const cleanup = installWindowMock();
  try {
    const meta = readArenaCatalogMeta();
    assert.equal(meta.total, 40);
    assert.equal(meta.academies, 22);
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

test('Icons.palette, heartPulse, compass, briefcase, playCircle, brain and dumbbell render single-stroke SVGs', () => {
  for (const svg of [
    Icons.palette(),
    Icons.heartPulse(),
    Icons.compass(),
    Icons.briefcase(),
    Icons.playCircle(),
    Icons.brain(),
    Icons.dumbbell(),
  ]) {
    assert.ok(svg.includes('<svg'));
    assert.ok(svg.includes('stroke="currentColor"'));
    assert.ok(svg.includes('fill="none"'));
  }
});

test('DEFAULT_DIRECTORY_ORDER and normalizeConfig include new ecosystem modules and NeuroNation++ Lab', () => {
  for (const id of ['mod-compass', 'mod-career', 'mod-guides', 'app-neurolab']) {
    assert.ok(DEFAULT_DIRECTORY_ORDER.includes(id), `DEFAULT_DIRECTORY_ORDER should include ${id}`);
  }
  const cfg = normalizeConfig({ order: ['app-arena', 'mod-studio'] });
  assert.deepEqual(cfg.order.slice(0, 2), ['app-arena', 'mod-studio']);
  for (const id of ['mod-compass', 'mod-career', 'mod-guides', 'app-neurolab']) {
    assert.ok(cfg.order.includes(id), `normalized order should include ${id}`);
  }
});

test('buildCompanionSummary parses NeuroScore from direct neuroScore and neuro.pillars', () => {
  const cleanup = installWindowMock();
  try {
    // 1. Direct neuroScore in localStorage
    localStorage.setItem(
      'omni_arena_profile_v1',
      JSON.stringify({
        ratings: { memory: 600, logic: 640 },
        playCounts: { a: 4 },
        neuroScore: 785,
        updatedAt: 1000,
      })
    );
    const localSummary = buildCompanionSummary();
    assert.equal(localSummary.arenaNeuroScore, 785);

    // 2. Remote arena_profile newer than local with neuro.pillars average
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const remoteSummary = buildCompanionSummary({
      arena_profile: {
        updated_at: 2000,
        payload: {
          ratings: { memory: 700 },
          neuro: {
            pillars: { memory: 720, attention: 760, logic: 740, speed: 700 },
            dailyCompletedDate: todayStr,
          },
          updatedAt: 2000,
        },
      },
    });
    assert.equal(remoteSummary.arenaNeuroScore, 730);
    assert.equal(remoteSummary.arenaNeuroDailyDone, true);
  } finally {
    cleanup();
  }
});

test('buildDailyRoutePlan creates a 15-min 3-step sequence tailored to time, habits, and persists toggles per day', () => {
  const cleanup = installWindowMock('http://localhost:5178/');
  try {
    const baseSummary = buildCompanionSummary();
    baseSummary.arenaNeuroScore = 710;
    baseSummary.unumbralPendingTasks = 2;

    // Afternoon with pending tasks -> Step 1 UNUmbral, Step 2 NeuroLab, Step 3 Postura Pro
    const afternoonPlan = buildDailyRoutePlan(baseSummary, { hour: 14, day: '2026-11-24' });
    assert.equal(afternoonPlan.totalMinutes, 15);
    assert.equal(afternoonPlan.steps.length, 3);
    assert.equal(afternoonPlan.completedCount, 0);
    assert.ok(afternoonPlan.steps[0].href.includes('5177'));
    assert.ok(afternoonPlan.steps[1].href.includes('#neurolab'));
    assert.ok(afternoonPlan.steps[1].subtitle.includes('710'));
    assert.ok(afternoonPlan.steps[2].href.includes('#vitality'));
    assert.equal(afternoonPlan.nextStep?.id, 'step-direction');

    // Toggle step 1 and verify persistence in dir_daily_route_done_v1
    toggleDailyRouteStep('step-direction', '2026-11-24');
    assert.deepEqual(readDailyRouteDone('2026-11-24'), ['step-direction']);
    assert.ok(localStorage.getItem(DAILY_ROUTE_STORAGE_KEY)?.includes('step-direction'));

    // Next day resets cleanly
    assert.deepEqual(readDailyRouteDone('2026-11-25'), []);

    // Morning with vitality & reader already done -> Step 1 Brújula, Step 3 Creatividad
    baseSummary.atelierTodayHabits = { vitality: true, reader: true };
    const morningPlan = buildDailyRoutePlan(baseSummary, { hour: 8, day: '2026-11-24' });
    assert.ok(morningPlan.steps[0].href.includes('#compass'));
    assert.ok(morningPlan.steps[2].href.includes('#mindset'));
    assert.equal(morningPlan.completedCount, 1);
    assert.equal(morningPlan.nextStep?.id, 'step-neuro');

    // Complete remaining steps -> 3/3 and nextStep is null
    toggleDailyRouteStep('step-neuro', '2026-11-24');
    toggleDailyRouteStep('step-body-skill', '2026-11-24');
    const donePlan = buildDailyRoutePlan(baseSummary, { hour: 8, day: '2026-11-24' });
    assert.equal(donePlan.completedCount, 3);
    assert.equal(donePlan.nextStep, null);
  } finally {
    cleanup();
  }
});
