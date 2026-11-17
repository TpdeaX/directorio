import { cloudSync } from '../services/CloudSync';
import {
  CompanionSummary,
  CustomDirectoryLink,
  DirectoryCategory,
  DirectoryConfig,
  EcosystemScope,
  ThemeMode,
} from '../types';

const STORAGE_KEY = 'atelier_directory_config_v1';
const THEME_KEY = 'umbral-theme';

export const DEFAULT_DIRECTORY_ORDER = [
  'mod-reader',
  'mod-studio',
  'mod-calligraphy',
  'mod-typing',
  'mod-language',
  'mod-mindset',
  'mod-vault',
  'mod-singing',
  'mod-calm',
  'app-unumbral',
  'app-arena',
];

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

function normalizeConfig(raw: Partial<DirectoryConfig> | null | undefined): DirectoryConfig {
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
      return localStorage.getItem(THEME_KEY) === 'night' ? 'night' : 'day';
    } catch {
      return 'day';
    }
  }

  public setTheme(theme: ThemeMode): void {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore storage error
    }
    document.documentElement.setAttribute('data-theme', theme);
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

export function resolveEcosystemAppUrl(
  target: 'atelier' | 'unumbral' | 'arena',
  hash = ''
): string {
  const custom = directoryStore.get().companionUrls[target]?.trim();
  const suffix = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '';
  if (custom) {
    return `${custom.replace(/#.*$/, '').replace(/\/?$/, '/')}${suffix}`;
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  if (host.endsWith('github.io')) {
    if (target === 'atelier') return `../atelier-diario/${suffix}`;
    if (target === 'unumbral') return `../UNUmbral/${suffix}`;
    return `../omni-arena/${suffix}`;
  }
  if (target === 'atelier') return `http://localhost:5176/${suffix}`;
  if (target === 'unumbral') return `http://localhost:5177/${suffix}`;
  return `http://localhost:5175/${suffix}`;
}

export function buildCompanionSummary(
  remoteScopes?: Partial<Record<EcosystemScope, { payload: unknown; updated_at: number }>>,
  remoteDocsCount?: number | null
): CompanionSummary {
  const summary: CompanionSummary = {
    atelierTodayDone: 0,
    atelierTotalModules: 8,
    atelierStreak: 0,
    atelierLevel: 1,
    docsCount: remoteDocsCount ?? 0,
    unumbralCourses: 0,
    unumbralPendingTasks: 0,
    unumbralCycles: 0,
    unumbralUpdatedAt: 0,
    arenaRank: 'BRONZE II',
    arenaSessions: 0,
    arenaScore: 0,
    arenaUpdatedAt: 0,
  };

  try {
    const remoteAtelier = remoteScopes?.atelier_profile?.payload as
      | { streak?: number; xp?: number; dailyTasks?: Record<string, Record<string, boolean>> }
      | undefined;
    const localAtelierRaw = localStorage.getItem('atelier_profile_v2');
    const localAtelier = localAtelierRaw
      ? (JSON.parse(localAtelierRaw) as {
          streak?: number;
          xp?: number;
          dailyTasks?: Record<string, Record<string, boolean>>;
        })
      : undefined;
    const atelier = remoteAtelier || localAtelier;
    if (atelier) {
      const todayKey = new Date().toISOString().slice(0, 10);
      const todayMap = atelier.dailyTasks?.[todayKey] ?? {};
      summary.atelierTodayDone = Object.values(todayMap).filter(Boolean).length;
      summary.atelierStreak = Number(atelier.streak) || 0;
      const xp = Number(atelier.xp) || 0;
      summary.atelierLevel = Math.max(1, Math.floor(xp / 240) + 1);
    }

    if (remoteDocsCount === null || remoteDocsCount === undefined) {
      const docsRaw = localStorage.getItem('atelier_docs_local_v1');
      if (docsRaw) {
        const parsed = JSON.parse(docsRaw) as unknown[];
        if (Array.isArray(parsed)) summary.docsCount = parsed.length;
      }
    }

    const remoteUmbral = remoteScopes?.unumbral_backup?.payload as
      | {
          data?: { cursos?: unknown[]; tareas?: { estado?: string; completada?: boolean }[]; ciclos?: unknown[] };
          timestamp?: number;
        }
      | undefined;
    const localUmbralRaw = localStorage.getItem('unumbral_last_snapshot_v1');
    const localUmbral = localUmbralRaw ? JSON.parse(localUmbralRaw) : undefined;
    const uSource = remoteUmbral?.data || localUmbral;
    if (uSource) {
      summary.unumbralCourses = Array.isArray(uSource.cursos) ? uSource.cursos.length : 0;
      const tareas = Array.isArray(uSource.tareas) ? uSource.tareas : [];
      summary.unumbralPendingTasks = tareas.filter(
        (t: { estado?: string; completada?: boolean }) =>
          t.estado !== 'completed' && t.completada !== true
      ).length;
      summary.unumbralCycles = Array.isArray(uSource.ciclos) ? uSource.ciclos.length : 0;
      summary.unumbralUpdatedAt =
        remoteScopes?.unumbral_backup?.updated_at || Number(remoteUmbral?.timestamp) || 0;
    }

    const remoteArena = remoteScopes?.arena_profile?.payload as
      | { rankTier?: string; totalSessions?: number; bestScore?: number; highScores?: Record<string, { bestScore?: number }> }
      | undefined;
    const localArenaRaw = localStorage.getItem('omni_arena_profile_v1');
    const localArena = localArenaRaw ? JSON.parse(localArenaRaw) : undefined;
    const arena = remoteArena || localArena;
    if (arena) {
      summary.arenaRank = String(arena.rankTier || 'BRONZE II');
      summary.arenaSessions = Number(arena.totalSessions) || 0;
      const scores = arena.highScores
        ? Object.values(arena.highScores as Record<string, { bestScore?: number }>).map(
            (h) => Number(h?.bestScore) || 0
          )
        : [];
      summary.arenaScore =
        scores.length > 0 ? Math.max(...scores) : Number(arena.bestScore) || 0;
      summary.arenaUpdatedAt = remoteScopes?.arena_profile?.updated_at || 0;
    }
  } catch {
    // Ignore storage/parse errors
  }

  return summary;
}
