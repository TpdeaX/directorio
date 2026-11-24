import { cloudSync } from '../services/CloudSync.ts';
import type {
  ArenaCatalogMeta,
  CompanionSummary,
  CustomDirectoryLink,
  DirectoryCategory,
  DirectoryConfig,
  EcoAppId,
  EcosystemScope,
  ThemeMode,
} from '../types.ts';

const STORAGE_KEY = 'atelier_directory_config_v1';
const THEME_KEY = 'umbral-theme';
const ARENA_META_KEY = 'omni_arena_catalog_meta_v1';

const DEFAULT_ARENA_META: ArenaCatalogMeta = {
  version: 1,
  total: 33,
  academies: 15,
  dexterity2d: 13,
  action3d: 5,
  updatedAt: 0,
};

const ECO_APP_PORT: Record<EcoAppId, number> = {
  directorio: 5178,
  atelier: 5176,
  unumbral: 5177,
  arena: 5175,
};

const ECO_APP_PATH: Record<EcoAppId, string> = {
  directorio: '/directorio/',
  atelier: '/atelier-diario/',
  unumbral: '/UNUmbral/',
  arena: '/omni-arena/',
};

export const DEFAULT_DIRECTORY_ORDER = [
  'mod-reader',
  'mod-studio',
  'mod-calligraphy',
  'mod-drawing',
  'mod-typing',
  'mod-language',
  'mod-mindset',
  'mod-focuslab',
  'mod-singing',
  'mod-calm',
  'mod-critical',
  'mod-writing',
  'mod-finance',
  'mod-vitality',
  'app-unumbral',
  'app-arena',
];

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function normalizeEcoTheme(raw: string | null | undefined): 'light' | 'dark' | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === 'dark' || v === 'night') return 'dark';
  if (v === 'light' || v === 'day') return 'light';
  return null;
}

function toInternalTheme(eco: 'light' | 'dark'): ThemeMode {
  return eco === 'dark' ? 'night' : 'day';
}

function toEcoTheme(theme: ThemeMode): 'light' | 'dark' {
  return theme === 'night' ? 'dark' : 'light';
}

function isPrivateIp(host: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}

function computeInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'JM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function defaultDirectoryConfig(): DirectoryConfig {
  return {
    userName: 'Joseph Marquina',
    userSubtitle: 'Sede Personal · Ecosistema',
    userInitials: 'JM',
    ecosystemTitle: 'Directorio del Ecosistema',
    ecosystemSubtitle: 'Portal Central · Atelier Diario, UNUmbral y OMNI ARENA',
    activeCategory: 'all',
    pinnedIds: ['app-unumbral', 'mod-studio', 'app-arena'],
    hiddenIds: [],
    order: [...DEFAULT_DIRECTORY_ORDER],
    customLinks: [],
    companionUrls: {
      atelier: '',
      unumbral: '',
      arena: '',
    },
    updatedAt: 0,
  };
}

export function normalizeConfig(raw: Partial<DirectoryConfig> | null | undefined): DirectoryConfig {
  const base = defaultDirectoryConfig();
  if (!raw || typeof raw !== 'object') return base;
  const userName = (raw.userName ?? base.userName).trim() || base.userName;
  const incomingOrder = Array.isArray(raw.order) ? raw.order : [];
  const mergedOrder = Array.from(new Set([...incomingOrder, ...DEFAULT_DIRECTORY_ORDER]));
  return {
    ...base,
    ...raw,
    userName,
    userInitials:
      (raw.userInitials ?? computeInitials(userName)).trim().slice(0, 3).toUpperCase() || 'JM',
    pinnedIds: Array.isArray(raw.pinnedIds) ? raw.pinnedIds : base.pinnedIds,
    hiddenIds: Array.isArray(raw.hiddenIds) ? raw.hiddenIds : [],
    order: mergedOrder,
    customLinks: Array.isArray(raw.customLinks) ? raw.customLinks : [],
    companionUrls: {
      atelier: raw.companionUrls?.atelier ?? '',
      unumbral: raw.companionUrls?.unumbral ?? '',
      arena: raw.companionUrls?.arena ?? '',
    },
    updatedAt: Number(raw.updatedAt) || 0,
  };
}

class DirectoryStore {
  private config: DirectoryConfig;
  private listeners = new Set<() => void>();
  private pushTimer = 0;

  constructor() {
    this.config = this.load();
  }

  private load(): DirectoryConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultDirectoryConfig();
      return normalizeConfig(JSON.parse(raw) as Partial<DirectoryConfig>);
    } catch {
      return defaultDirectoryConfig();
    }
  }

  private save(syncCloud = true): void {
    this.config.updatedAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch {
      // Ignore storage error
    }
    this.listeners.forEach((fn) => fn());
    if (syncCloud && cloudSync.isConfigured() && cloudSync.getConfig().autoSync) {
      window.clearTimeout(this.pushTimer);
      this.pushTimer = window.setTimeout(() => {
        void cloudSync.pushScope('directory_config', this.config, this.config.updatedAt);
      }, 900);
    }
  }

  public get(): DirectoryConfig {
    return {
      ...this.config,
      pinnedIds: [...this.config.pinnedIds],
      hiddenIds: [...this.config.hiddenIds],
      order: [...this.config.order],
      customLinks: this.config.customLinks.map((c) => ({ ...c })),
      companionUrls: { ...this.config.companionUrls },
    };
  }

  public getTheme(): ThemeMode {
    try {
      const normalized = normalizeEcoTheme(localStorage.getItem(THEME_KEY));
      if (normalized) return toInternalTheme(normalized);
    } catch {
      // Ignore storage error
    }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'night';
    }
    return 'day';
  }

  public setTheme(theme: ThemeMode): void {
    const eco = toEcoTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, eco);
    } catch {
      // Ignore storage error
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  public applyIncomingEcoTheme(): ThemeMode {
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        const param = normalizeEcoTheme(url.searchParams.get('eco_theme'));
        if (param) {
          localStorage.setItem(THEME_KEY, param);
          url.searchParams.delete('eco_theme');
          const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
          window.history.replaceState(null, '', cleanUrl || './');
        } else {
          const raw = localStorage.getItem(THEME_KEY);
          const norm = normalizeEcoTheme(raw);
          if (norm && raw !== norm) {
            localStorage.setItem(THEME_KEY, norm);
          }
        }
      } catch {
        // Ignore URL/storage errors
      }
    }
    const theme = this.getTheme();
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    return theme;
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public applyRemote(remote: Partial<DirectoryConfig> | null | undefined): boolean {
    if (!remote) return false;
    const incoming = normalizeConfig(remote);
    if (incoming.updatedAt > this.config.updatedAt) {
      this.config = incoming;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      } catch {
        // Ignore storage error
      }
      this.listeners.forEach((fn) => fn());
      return true;
    }
    return false;
  }

  public setCategory(cat: DirectoryCategory): void {
    this.config.activeCategory = cat;
    this.save(false);
  }

  public updateIdentity(patch: {
    userName?: string;
    userSubtitle?: string;
    userInitials?: string;
    ecosystemTitle?: string;
    ecosystemSubtitle?: string;
    atelierUrl?: string;
    unumbralUrl?: string;
    arenaUrl?: string;
  }): void {
    if (patch.userName !== undefined) {
      this.config.userName = patch.userName.trim() || 'Joseph Marquina';
      if (!patch.userInitials?.trim()) {
        this.config.userInitials = computeInitials(this.config.userName);
      }
    }
    if (patch.userInitials !== undefined && patch.userInitials.trim()) {
      this.config.userInitials = patch.userInitials.trim().slice(0, 3).toUpperCase();
    }
    if (patch.userSubtitle !== undefined) {
      this.config.userSubtitle = patch.userSubtitle.trim() || 'Sede Personal · Ecosistema';
    }
    if (patch.ecosystemTitle !== undefined) {
      this.config.ecosystemTitle = patch.ecosystemTitle.trim() || 'Directorio del Ecosistema';
    }
    if (patch.ecosystemSubtitle !== undefined) {
      this.config.ecosystemSubtitle =
        patch.ecosystemSubtitle.trim() || 'Portal Central · Atelier Diario, UNUmbral y OMNI ARENA';
    }
    if (patch.atelierUrl !== undefined) {
      this.config.companionUrls.atelier = patch.atelierUrl.trim();
    }
    if (patch.unumbralUrl !== undefined) {
      this.config.companionUrls.unumbral = patch.unumbralUrl.trim();
    }
    if (patch.arenaUrl !== undefined) {
      this.config.companionUrls.arena = patch.arenaUrl.trim();
    }
    this.save(true);
  }

  public togglePin(id: string): void {
    if (this.config.pinnedIds.includes(id)) {
      this.config.pinnedIds = this.config.pinnedIds.filter((x) => x !== id);
    } else {
      this.config.pinnedIds = [id, ...this.config.pinnedIds];
    }
    this.save(true);
  }

  public toggleHidden(id: string): void {
    if (this.config.hiddenIds.includes(id)) {
      this.config.hiddenIds = this.config.hiddenIds.filter((x) => x !== id);
    } else {
      this.config.hiddenIds = [...this.config.hiddenIds, id];
    }
    this.save(true);
  }

  public moveItem(id: string, direction: -1 | 1): void {
    const allIds = [...this.config.order];
    this.config.customLinks.forEach((c) => {
      if (!allIds.includes(c.id)) allIds.push(c.id);
    });
    const idx = allIds.indexOf(id);
    if (idx === -1) return;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= allIds.length) return;
    [allIds[idx], allIds[nextIdx]] = [allIds[nextIdx], allIds[idx]];
    this.config.order = allIds;
    this.save(true);
  }

  public addCustomLink(input: Omit<CustomDirectoryLink, 'id'>): CustomDirectoryLink {
    const id = `custom-${Date.now().toString(36)}`;
    const link: CustomDirectoryLink = {
      id,
      title: input.title.trim(),
      subtitle: input.subtitle.trim() || 'Acceso personalizado',
      url: input.url.trim(),
      category: input.category,
      accent: input.accent || '#0284c7',
      iconKey: input.iconKey || 'link',
    };
    this.config.customLinks = [link, ...this.config.customLinks];
    this.config.order = [id, ...this.config.order];
    this.save(true);
    return link;
  }

  public removeCustomLink(id: string): void {
    this.config.customLinks = this.config.customLinks.filter((c) => c.id !== id);
    this.config.order = this.config.order.filter((x) => x !== id);
    this.config.pinnedIds = this.config.pinnedIds.filter((x) => x !== id);
    this.config.hiddenIds = this.config.hiddenIds.filter((x) => x !== id);
    this.save(true);
  }

  public resetLayout(): void {
    const base = defaultDirectoryConfig();
    this.config.pinnedIds = base.pinnedIds;
    this.config.hiddenIds = [];
    this.config.order = [...DEFAULT_DIRECTORY_ORDER, ...this.config.customLinks.map((c) => c.id)];
    this.save(true);
  }

  public async pushNow(): Promise<boolean> {
    return cloudSync.pushScope('directory_config', this.config, this.config.updatedAt || Date.now());
  }
}

export const directoryStore = new DirectoryStore();

function appendEcoThemeParam(baseUrl: string, ecoTheme: 'light' | 'dark'): string {
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}eco_theme=${ecoTheme}`;
}

export function resolveEcoUrl(
  app: EcoAppId,
  opts: { hash?: string; carryTheme?: boolean } = {}
): string {
  const cleanHash = opts.hash ? `#${opts.hash.replace(/^#/, '')}` : '';
  const carryTheme = opts.carryTheme !== false;
  const ecoTheme = toEcoTheme(directoryStore.getTheme());

  const customUrls = directoryStore.get().companionUrls;
  const custom =
    app === 'atelier'
      ? customUrls.atelier?.trim()
      : app === 'unumbral'
        ? customUrls.unumbral?.trim()
        : app === 'arena'
          ? customUrls.arena?.trim()
          : '';

  if (custom) {
    let base = `${custom.replace(/#.*$/, '').replace(/\/?$/, '/')}`;
    try {
      if (typeof window !== 'undefined' && carryTheme) {
        const targetOrigin = new URL(base, window.location.href).origin;
        if (targetOrigin !== window.location.origin) {
          base = appendEcoThemeParam(base, ecoTheme);
        }
      }
    } catch {
      // Ignore malformed custom URL
    }
    return `${base}${cleanHash}`;
  }

  const loc = typeof window !== 'undefined' ? window.location : null;
  const host = loc?.hostname ?? '';
  const port = loc?.port ?? '';
  const protocol = loc?.protocol || 'http:';
  const isCapacitor =
    typeof window !== 'undefined' && Boolean((window as { Capacitor?: unknown }).Capacitor);

  const route = ECO_APP_PATH[app];
  const appPort = ECO_APP_PORT[app];

  let base = '';
  let crossOrigin = false;

  if (isCapacitor || (host === 'localhost' && port === '')) {
    base = `https://tpdeax.github.io${route}`;
    crossOrigin = true;
  } else if (host.endsWith('github.io')) {
    base = `..${route}`;
    crossOrigin = false;
  } else if (
    port !== '' &&
    (host === 'localhost' || host === '127.0.0.1' || isPrivateIp(host))
  ) {
    base = `${protocol}//${host}:${appPort}/`;
    crossOrigin = String(appPort) !== String(port);
  } else {
    base = `https://tpdeax.github.io${route}`;
    crossOrigin = true;
  }

  if (crossOrigin && carryTheme) {
    base = appendEcoThemeParam(base, ecoTheme);
  }
  return `${base}${cleanHash}`;
}

export function resolveEcosystemAppUrl(
  target: 'atelier' | 'unumbral' | 'arena',
  hash = ''
): string {
  return resolveEcoUrl(target, { hash });
}

export function readArenaCatalogMeta(): ArenaCatalogMeta {
  try {
    const raw = localStorage.getItem(ARENA_META_KEY);
    if (!raw) return DEFAULT_ARENA_META;
    const parsed = JSON.parse(raw) as Partial<ArenaCatalogMeta>;
    const total = Number(parsed.total);
    const academies = Number(parsed.academies);
    if (Number.isFinite(total) && total > 0 && Number.isFinite(academies) && academies >= 0) {
      return {
        version: 1,
        total,
        academies,
        dexterity2d: Number(parsed.dexterity2d) || DEFAULT_ARENA_META.dexterity2d,
        action3d: Number(parsed.action3d) || DEFAULT_ARENA_META.action3d,
        updatedAt: Number(parsed.updatedAt) || 0,
      };
    }
  } catch {
    // Fallback to default metadata
  }
  return DEFAULT_ARENA_META;
}

export function ratingToRankGrade(rating: number): string {
  if (rating >= 900) return 'OMNI';
  if (rating >= 800) return 'SS';
  if (rating >= 700) return 'S';
  if (rating >= 580) return 'A';
  if (rating >= 460) return 'B';
  if (rating >= 340) return 'C';
  return 'D';
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function formatRelativeEs(ts: number): string {
  if (!ts || ts <= 0) return 'Reciente';
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (diffMin < 1) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return diffD === 1 ? 'Ayer' : `Hace ${diffD} días`;
}

export function buildCompanionSummary(
  remoteScopes?: Partial<Record<EcosystemScope, { payload: unknown; updated_at: number }>>,
  remoteDocsCount?: number | null
): CompanionSummary {
  const summary: CompanionSummary = {
    atelierHasData: false,
    atelierTodayDone: 0,
    atelierTotalModules: 10,
    atelierStreak: 0,
    atelierResume: null,
    atelierRecent: [],
    pendingItems: [],
    recommendedItems: [],
    docsCount: remoteDocsCount ?? 0,
    unumbralHasData: false,
    unumbralCourses: 0,
    unumbralPendingTasks: 0,
    unumbralTodayClasses: 0,
    unumbralCycles: 0,
    unumbralUpdatedAt: 0,
    arenaHasData: false,
    arenaRank: '--',
    arenaOverall: 300,
    arenaSessions: 0,
    arenaScore: 0,
    arenaUpdatedAt: 0,
  };

  try {
    const today = todayStamp();

    // 1. Atelier Diario (remoto vs local atelier_diario_profile_v1 -> heredado atelier_profile_v2)
    interface AtelierProfileShape {
      dailyStreak?: number;
      streak?: number;
      lastActiveDay?: string;
      todayHabits?: Record<string, boolean>;
      dailyTasks?: Record<string, Record<string, boolean>>;
      modulePrefs?: {
        reader?: { lastArticleTitle?: string };
      };
      progress?: {
        activity?: {
          lastModule?: string | null;
          lastVisitedAt?: number;
          recent?: { moduleId: string; at: number; label: string; detail: string }[];
        };
        reader?: { scrollByTitle?: Record<string, number> };
        language?: { missedOrthoIds?: string[] };
        drawing?: { savedDrafts?: Record<string, unknown[]> };
        calligraphy?: { savedStrokes?: Record<string, unknown[]> };
        typing?: { keyErrors?: Record<string, number> };
        calm?: { groundDone?: boolean[] };
        vault?: { reviewedToday?: number; dailyGoal?: number; lastReviewDay?: string };
      };
      updatedAt?: number;
    }
    const remoteAtelier = remoteScopes?.atelier_profile?.payload as AtelierProfileShape | undefined;
    const remoteAtelierTs = Number(remoteScopes?.atelier_profile?.updated_at) || Number(remoteAtelier?.updatedAt) || 0;
    const localAtelier =
      safeJsonParse<AtelierProfileShape>(localStorage.getItem('atelier_diario_profile_v1')) ||
      safeJsonParse<AtelierProfileShape>(localStorage.getItem('atelier_profile_v2'));
    const localAtelierTs = Number(localAtelier?.updatedAt) || 0;

    const atelier =
      remoteAtelier && (!localAtelier || remoteAtelierTs >= localAtelierTs)
        ? remoteAtelier
        : localAtelier;

    if (atelier && typeof atelier === 'object') {
      summary.atelierHasData = true;
      summary.atelierStreak = Number(atelier.dailyStreak ?? atelier.streak) || 0;
      if (atelier.todayHabits && typeof atelier.todayHabits === 'object') {
        const keys = Object.keys(atelier.todayHabits);
        summary.atelierTotalModules = keys.length || 10;
        summary.atelierTodayDone =
          atelier.lastActiveDay === today
            ? Object.values(atelier.todayHabits).filter(Boolean).length
            : 0;
      } else if (atelier.dailyTasks) {
        const todayMap = atelier.dailyTasks[today] ?? {};
        summary.atelierTotalModules = 10;
        summary.atelierTodayDone = Object.values(todayMap).filter(Boolean).length;
      }

      const pr = atelier.progress;
      const act = pr?.activity;
      if (act?.lastModule) {
        const first = Array.isArray(act.recent)
          ? act.recent.find((r) => r.moduleId === act.lastModule)
          : undefined;
        summary.atelierResume = {
          moduleId: act.lastModule,
          label: first?.label || `Atelier · ${act.lastModule}`,
          detail: first?.detail || 'Retoma exactamente donde lo dejaste.',
          timeLabel: formatRelativeEs(act.lastVisitedAt || first?.at || atelier.updatedAt || 0),
          href: resolveEcosystemAppUrl('atelier', act.lastModule),
        };
      } else if (atelier.modulePrefs?.reader?.lastArticleTitle) {
        summary.atelierResume = {
          moduleId: 'reader',
          label: `Lectura · ${atelier.modulePrefs.reader.lastArticleTitle}`,
          detail: 'Última lectura guardada en Atelier Diario.',
          timeLabel: formatRelativeEs(atelier.updatedAt || 0),
          href: resolveEcosystemAppUrl('atelier', 'reader'),
        };
      }

      if (Array.isArray(act?.recent)) {
        summary.atelierRecent = act.recent.slice(0, 4).map((r) => ({
          label: (r.label || r.moduleId).split('·')[0].trim(),
          timeLabel: formatRelativeEs(r.at),
          href: resolveEcosystemAppUrl('atelier', r.moduleId),
        }));
      }

      // Pendientes reales de Atelier
      const halfRead = Object.entries(pr?.reader?.scrollByTitle ?? {}).find(
        ([, pct]) => typeof pct === 'number' && pct > 0 && pct < 100
      );
      if (halfRead) {
        summary.pendingItems.push({
          title: `Retomar lectura: ${halfRead[0].slice(0, 38)}`,
          subtitle: `Te quedaste al ${halfRead[1]}%.`,
          badge: `${halfRead[1]}%`,
          href: resolveEcosystemAppUrl('atelier', 'reader'),
          cta: 'Seguir leyendo',
          priority: 'high',
        });
      }
      const missedOrtho = pr?.language?.missedOrthoIds?.length ?? 0;
      if (missedOrtho > 0) {
        summary.pendingItems.push({
          title: `Repasar ${missedOrtho} ${missedOrtho === 1 ? 'regla fallada' : 'reglas falladas'} de Ortografía`,
          subtitle: 'Cola de fallos lista en Ortografía y Léxico.',
          badge: `${missedOrtho} fallos`,
          href: resolveEcosystemAppUrl('atelier', 'language'),
          cta: 'Repasar ahora',
          priority: 'high',
        });
      }
      const drawDrafts = Object.keys(pr?.drawing?.savedDrafts ?? {}).length;
      if (drawDrafts > 0) {
        summary.pendingItems.push({
          title: `Borrador de Dibujo guardado (${drawDrafts})`,
          subtitle: 'Tus trazos siguen en el lienzo listos para continuar.',
          badge: 'Borrador',
          href: resolveEcosystemAppUrl('atelier', 'drawing'),
          cta: 'Abrir lienzo',
          priority: 'high',
        });
      }
      const calDrafts = Object.keys(pr?.calligraphy?.savedStrokes ?? {}).length;
      if (calDrafts > 0) {
        summary.pendingItems.push({
          title: 'Hoja de Caligrafía en curso',
          subtitle: 'Retoma tu trazo guardado y evalúa tu puntaje.',
          badge: 'En curso',
          href: resolveEcosystemAppUrl('atelier', 'calligraphy'),
          cta: 'Continuar',
        });
      }
      const groundDone = Array.isArray(pr?.calm?.groundDone)
        ? pr.calm.groundDone.filter(Boolean).length
        : 0;
      if (groundDone > 0 && groundDone < 15) {
        summary.pendingItems.push({
          title: `Calma 5-4-3-2-1 a medias (${groundDone}/15)`,
          subtitle: 'Completa el ejercicio sensorial en 2 minutos.',
          badge: `${groundDone}/15`,
          href: resolveEcosystemAppUrl('atelier', 'calm'),
          cta: 'Continuar calma',
        });
      }
    }

    if (remoteDocsCount === null || remoteDocsCount === undefined) {
      const parsedDocs = safeJsonParse<unknown[]>(localStorage.getItem('atelier_docs_local_v1'));
      if (Array.isArray(parsedDocs)) summary.docsCount = parsedDocs.length;
    }

    // 2. UNUmbral (remoto unumbral_backup -> local unumbral_last_snapshot_v1 -> heredado atelier_umbral_snapshot_v1)
    interface UmbralRawBackup {
      data?: {
        cursos?: unknown[];
        tareas?: { estado?: string; completada?: boolean }[];
        ciclos?: unknown[];
        clases?: unknown[];
      };
      cursos?: unknown[];
      tareas?: { estado?: string; completada?: boolean }[];
      ciclos?: unknown[];
      clases?: unknown[];
      timestamp?: number;
      _updatedAt?: number;
      version?: number;
      updatedAt?: number;
      coursesCount?: number;
      pendingTasks?: number;
      todayClasses?: number;
      cyclesCount?: number;
    }

    const remoteUmbralWrap = remoteScopes?.unumbral_backup;
    const remoteUmbral = remoteUmbralWrap?.payload as UmbralRawBackup | undefined;
    const remoteUmbralTs =
      Number(remoteUmbralWrap?.updated_at) || Number(remoteUmbral?.timestamp) || 0;
    const localUmbralSnap = safeJsonParse<UmbralRawBackup>(
      localStorage.getItem('unumbral_last_snapshot_v1')
    );
    const localUmbralLegacy = safeJsonParse<UmbralRawBackup>(
      localStorage.getItem('atelier_umbral_snapshot_v1')
    );
    const localSnapTs = Number(localUmbralSnap?.updatedAt) || 0;

    if (remoteUmbral && (!localUmbralSnap || remoteUmbralTs >= localSnapTs)) {
      const uData = remoteUmbral.data || remoteUmbral;
      summary.unumbralHasData = true;
      summary.unumbralCourses = Array.isArray(uData.cursos) ? uData.cursos.length : 0;
      const tareas = Array.isArray(uData.tareas) ? uData.tareas : [];
      summary.unumbralPendingTasks = tareas.filter(
        (t) => t.estado !== 'completed' && t.completada !== true
      ).length;
      summary.unumbralCycles = Array.isArray(uData.ciclos) ? uData.ciclos.length : 0;
      summary.unumbralUpdatedAt = remoteUmbralTs;
    } else if (localUmbralSnap && typeof localUmbralSnap.coursesCount === 'number') {
      summary.unumbralHasData = true;
      summary.unumbralCourses = Number(localUmbralSnap.coursesCount) || 0;
      summary.unumbralPendingTasks = Number(localUmbralSnap.pendingTasks) || 0;
      summary.unumbralTodayClasses = Number(localUmbralSnap.todayClasses) || 0;
      summary.unumbralCycles = Number(localUmbralSnap.cyclesCount) || 0;
      summary.unumbralUpdatedAt = localSnapTs;
    } else if (localUmbralSnap || localUmbralLegacy) {
      const uSource = localUmbralSnap?.data || localUmbralSnap || localUmbralLegacy;
      if (uSource) {
        summary.unumbralHasData = true;
        summary.unumbralCourses = Array.isArray(uSource.cursos) ? uSource.cursos.length : 0;
        const tareas = Array.isArray(uSource.tareas) ? uSource.tareas : [];
        summary.unumbralPendingTasks = tareas.filter(
          (t) => t.estado !== 'completed' && t.completada !== true
        ).length;
        summary.unumbralCycles = Array.isArray(uSource.ciclos) ? uSource.ciclos.length : 0;
        summary.unumbralUpdatedAt =
          Number(
            localUmbralSnap?._updatedAt ??
              localUmbralSnap?.timestamp ??
              localUmbralLegacy?._updatedAt ??
              localUmbralLegacy?.timestamp
          ) || 0;
      }
    }

    // 3. OMNI ARENA (remoto arena_profile vs local omni_arena_profile_v1)
    interface ArenaProfileShape {
      level?: number;
      xp?: number;
      ratings?: Record<string, number>;
      bestScores?: Record<string, number>;
      playCounts?: Record<string, number>;
      updatedAt?: number;
      // Legacy fallbacks
      rankTier?: string;
      totalSessions?: number;
      bestScore?: number;
      highScores?: Record<string, { bestScore?: number }>;
    }

    const remoteArenaWrap = remoteScopes?.arena_profile;
    const remoteArena = remoteArenaWrap?.payload as ArenaProfileShape | undefined;
    const remoteArenaTs =
      Number(remoteArenaWrap?.updated_at) || Number(remoteArena?.updatedAt) || 0;
    const localArena = safeJsonParse<ArenaProfileShape>(
      localStorage.getItem('omni_arena_profile_v1')
    );
    const localArenaTs = Number(localArena?.updatedAt) || 0;

    const arena =
      remoteArena && (!localArena || remoteArenaTs >= localArenaTs) ? remoteArena : localArena;

    if (arena && typeof arena === 'object') {
      summary.arenaHasData = true;
      const ratingValues = arena.ratings
        ? Object.values(arena.ratings).map(Number).filter((n) => Number.isFinite(n))
        : [];
      const overall =
        ratingValues.length > 0
          ? Math.round(ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length)
          : 300;
      summary.arenaOverall = overall;
      summary.arenaRank = ratingValues.length > 0
        ? ratingToRankGrade(overall)
        : String(arena.rankTier || ratingToRankGrade(overall));

      const playCountValues = arena.playCounts
        ? Object.values(arena.playCounts).map((n) => Number(n) || 0)
        : [];
      summary.arenaSessions =
        playCountValues.length > 0
          ? playCountValues.reduce((a, b) => a + b, 0)
          : Number(arena.totalSessions) || 0;

      const bestValues = arena.bestScores
        ? Object.values(arena.bestScores).map((n) => Number(n) || 0)
        : arena.highScores
          ? Object.values(arena.highScores).map((h) => Number(h?.bestScore) || 0)
          : [];
      summary.arenaScore =
        bestValues.length > 0 ? Math.max(...bestValues) : Number(arena.bestScore) || 0;
      summary.arenaUpdatedAt = Math.max(remoteArenaTs, localArenaTs);
    }

    // 4. Pendientes académicos + Recomendaciones inteligentes del ecosistema
    if (summary.unumbralPendingTasks > 0) {
      summary.pendingItems.unshift({
        title: `${summary.unumbralPendingTasks} ${summary.unumbralPendingTasks === 1 ? 'tarea pendiente' : 'tareas pendientes'} en UNUmbral`,
        subtitle: 'Revisa entregas próximas y planifica un bloque con plantilla Cornell.',
        badge: 'Universidad',
        href: resolveEcoUrl('unumbral'),
        cta: 'Abrir UNUmbral',
        priority: 'high',
      });
    }

    const hour = new Date().getHours();
    if (summary.unumbralPendingTasks > 0) {
      summary.recommendedItems.push({
        title: 'Organiza tu tarea urgente con plantilla Cornell',
        subtitle: 'Abre Cuaderno y PDF en modo Plantillas didácticas para avanzar en 15 min.',
        badge: 'Prioridad',
        href: resolveEcosystemAppUrl('atelier', 'studio'),
        cta: 'Ir a Cuaderno',
        priority: 'high',
      });
    }
    if (hour < 12) {
      summary.recommendedItems.push({
        title: 'Activa la mañana con Ortografía o Evocación Activa',
        subtitle: '5 minutos de práctica guiada suman racha y refuerzan memoria.',
        badge: 'Mañana',
        href: resolveEcosystemAppUrl('atelier', 'language'),
        cta: 'Practicar hoy',
      });
    } else if (hour < 19) {
      summary.recommendedItems.push({
        title: 'Avanza 1 lámina paso a paso en Dibujo o 5 min de Canto',
        subtitle: 'Entrena técnica guiada con guardado automático de trazos y puntaje.',
        badge: 'Tarde',
        href: resolveEcosystemAppUrl('atelier', 'drawing'),
        cta: 'Abrir taller',
      });
    } else {
      summary.recommendedItems.push({
        title: 'Cierra el día con Calma 3-6 y registro emocional',
        subtitle: 'Baja revoluciones y mide tu reducción de tensión antes de descansar.',
        badge: 'Noche',
        href: resolveEcosystemAppUrl('atelier', 'calm'),
        cta: 'Ir a Calma',
      });
    }
    summary.recommendedItems.push({
      title: 'Ronda rápida de entrenamiento en OMNI ARENA',
      subtitle: summary.arenaHasData
        ? `Rango actual ${summary.arenaRank} (${summary.arenaOverall} radar). Mantén tus reflejos e IQ activos.`
        : '33 disciplinas 2D/3D y 15 academias guiadas para entrenar mente y música.',
      badge: 'Arena',
      href: resolveEcoUrl('arena'),
      cta: 'Entrar a Arena',
    });

    summary.pendingItems = summary.pendingItems.slice(0, 4);
    summary.recommendedItems = summary.recommendedItems.slice(0, 3);
  } catch {
    // Ignore storage/parse errors
  }

  return summary;
}
