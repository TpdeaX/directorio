export type ThemeMode = 'day' | 'night';

export type EcoAppId = 'directorio' | 'atelier' | 'unumbral' | 'arena';

export type DirectoryCategory = 'all' | 'atelier' | 'universidad' | 'entrenamiento' | 'personal';

export type EcosystemScope =
  | 'directory_config'
  | 'atelier_profile'
  | 'unumbral_backup'
  | 'arena_profile';

export interface ArenaCatalogMeta {
  version: number;
  total: number;
  academies: number;
  dexterity2d: number;
  action3d: number;
  updatedAt: number;
}

export interface CustomDirectoryLink {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  category: Exclude<DirectoryCategory, 'all'>;
  accent: string;
  iconKey: 'book' | 'graduation' | 'gamepad' | 'link' | 'star' | 'bulb' | 'dumbbell';
}

export interface DirectoryConfig {
  userName: string;
  userSubtitle: string;
  userInitials: string;
  ecosystemTitle: string;
  ecosystemSubtitle: string;
  activeCategory: DirectoryCategory;
  pinnedIds: string[];
  hiddenIds: string[];
  order: string[];
  customLinks: CustomDirectoryLink[];
  companionUrls: {
    atelier?: string;
    unumbral: string;
    arena: string;
  };
  updatedAt: number;
}

export interface CompanionActionItem {
  title: string;
  subtitle: string;
  badge: string;
  href: string;
  cta: string;
  priority?: 'high' | 'normal';
}

export type DailyRouteStepId = 'step-direction' | 'step-neuro' | 'step-body-skill';

export interface DailyRouteStep {
  id: DailyRouteStepId;
  order: 1 | 2 | 3;
  minutes: number;
  pillar: string;
  title: string;
  subtitle: string;
  href: string;
  cta: string;
  accent: string;
  done: boolean;
}

export interface DailyRouteState {
  day: string;
  doneIds: DailyRouteStepId[];
}

export interface DailyRoutePlan {
  day: string;
  periodLabel: string;
  totalMinutes: number;
  completedCount: number;
  steps: DailyRouteStep[];
  nextStep: DailyRouteStep | null;
}

export interface CompanionSummary {
  atelierHasData: boolean;
  atelierTodayDone: number;
  atelierTotalModules: number;
  atelierTodayHabits: Record<string, boolean>;
  atelierStreak: number;
  atelierResume: {
    moduleId: string;
    label: string;
    detail: string;
    timeLabel: string;
    href: string;
  } | null;
  atelierRecent: { label: string; timeLabel: string; href: string }[];
  pendingItems: CompanionActionItem[];
  recommendedItems: CompanionActionItem[];
  docsCount: number;
  unumbralHasData: boolean;
  unumbralCourses: number;
  unumbralPendingTasks: number;
  unumbralTodayClasses: number;
  unumbralCycles: number;
  unumbralUpdatedAt: number;
  arenaHasData: boolean;
  arenaRank: string;
  arenaOverall: number;
  arenaSessions: number;
  arenaScore: number;
  arenaNeuroScore: number | null;
  arenaNeuroDailyDone: boolean;
  arenaUpdatedAt: number;
}
