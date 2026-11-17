export type ThemeMode = 'day' | 'night';

export type DirectoryCategory = 'all' | 'atelier' | 'universidad' | 'entrenamiento' | 'personal';

export type EcosystemScope =
  | 'directory_config'
  | 'atelier_profile'
  | 'unumbral_backup'
  | 'arena_profile';

export interface CustomDirectoryLink {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  category: Exclude<DirectoryCategory, 'all'>;
  accent: string;
  iconKey: 'book' | 'graduation' | 'gamepad' | 'link' | 'star' | 'bulb';
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

export interface CompanionSummary {
  atelierTodayDone: number;
  atelierTotalModules: number;
  atelierStreak: number;
  atelierLevel: number;
  docsCount: number;
  unumbralCourses: number;
  unumbralPendingTasks: number;
  unumbralCycles: number;
  unumbralUpdatedAt: number;
  arenaRank: string;
  arenaSessions: number;
  arenaScore: number;
  arenaUpdatedAt: number;
}
