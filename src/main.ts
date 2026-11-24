import './style.css';
import { Icons } from './icons';
import { cloudSync, SUPABASE_SETUP_SQL } from './services/CloudSync';
import {
  buildCompanionSummary,
  buildDailyRoutePlan,
  DAILY_ROUTE_STORAGE_KEY,
  directoryStore,
  readArenaCatalogMeta,
  resolveEcoUrl,
  resolveEcosystemAppUrl,
  toggleDailyRouteStep,
} from './state/DirectoryStore';
import {
  CompanionSummary,
  DailyRouteStepId,
  DirectoryCategory,
  EcosystemScope,
} from './types';

interface DirectoryTileDef {
  id: string;
  title: string;
  prefix: string;
  category: Exclude<DirectoryCategory, 'all'>;
  accent: string;
  icon: (s?: number) => string;
  href: string;
  metric: (s: CompanionSummary) => string;
  isCustom?: boolean;
}

const root = document.getElementById('app')!;
let editMode = false;
let showAddForm = false;
let showHidden = false;
let activeModal: 'none' | 'cloud' | 'profile' = 'none';
let cloudStatusMsg = '';
let showSql = false;
let showEcoTutorial = (() => {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('dir-eco-tut-open') === '1';
  } catch {
    return false;
  }
})();
let remoteScopes: Partial<Record<EcosystemScope, { payload: unknown; updated_at: number }>> = {};
let remoteDocsCount: number | null = null;

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function customIcon(key: string): (s?: number) => string {
  if (key === 'book') return Icons.book;
  if (key === 'graduation') return Icons.graduation;
  if (key === 'gamepad') return Icons.gamepad;
  if (key === 'star') return Icons.star;
  if (key === 'bulb') return Icons.bulb;
  if (key === 'dumbbell') return Icons.dumbbell;
  return Icons.link;
}

function buildTiles(): DirectoryTileDef[] {
  const dir = directoryStore.get();

  const builtIns: DirectoryTileDef[] = [
    {
      id: 'mod-compass',
      title: 'Brújula Personal',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#7c3aed',
      icon: Icons.compass,
      href: resolveEcosystemAppUrl('atelier', 'compass'),
      metric: () => 'Diario 3 min, Rueda, Metas 90d y Anti-hábitos',
    },
    {
      id: 'mod-studio',
      title: 'Cuaderno y PDF',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#15803d',
      icon: Icons.tablet,
      href: resolveEcosystemAppUrl('atelier', 'studio'),
      metric: (s) => `${s.docsCount} ${s.docsCount === 1 ? 'documento' : 'documentos'}`,
    },
    {
      id: 'mod-reader',
      title: 'Biblioteca y RSVP',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#2563eb',
      icon: Icons.book,
      href: resolveEcosystemAppUrl('atelier', 'reader'),
      metric: () => 'Clásicos, lectura rápida WPM y síntesis',
    },
    {
      id: 'mod-calligraphy',
      title: 'Taller de Caligrafía',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#d97706',
      icon: Icons.pen,
      href: resolveEcosystemAppUrl('atelier', 'calligraphy'),
      metric: () => '128 plantillas guiadas',
    },
    {
      id: 'mod-drawing',
      title: 'Taller de Dibujo',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#B45309',
      icon: Icons.palette,
      href: resolveEcosystemAppUrl('atelier', 'drawing'),
      metric: () => '56 láminas + 12 retos',
    },
    {
      id: 'mod-typing',
      title: 'Mecanografía',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#475569',
      icon: Icons.keyboard,
      href: resolveEcosystemAppUrl('atelier', 'typing'),
      metric: () => 'Teclado visual y adaptativo',
    },
    {
      id: 'mod-language',
      title: 'Ortografía y Léxico',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#0891b2',
      icon: Icons.spell,
      href: resolveEcosystemAppUrl('atelier', 'language'),
      metric: () => '96 reglas, examen y léxico',
    },
    {
      id: 'mod-mindset',
      title: 'Criterio y Creatividad',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#ca8a04',
      icon: Icons.bulb,
      href: resolveEcosystemAppUrl('atelier', 'mindset'),
      metric: () => 'Frases, SCAMPER y pensamiento lateral',
    },
    {
      id: 'mod-focuslab',
      title: 'Oratoria, SM-2 y Feynman',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#0f766e',
      icon: Icons.mic,
      href: resolveEcosystemAppUrl('atelier', 'focuslab'),
      metric: () => 'Muletillas, repetición espaciada y recall',
    },
    {
      id: 'mod-singing',
      title: 'Estudio de Canto',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#be185d',
      icon: Icons.mic,
      href: resolveEcosystemAppUrl('atelier', 'singing'),
      metric: () => '34+ canciones, piano y oído',
    },
    {
      id: 'mod-calm',
      title: 'Centro de Calma',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#0f766e',
      icon: Icons.wind,
      href: resolveEcosystemAppUrl('atelier', 'calm'),
      metric: () => 'SOS Pánico, 5-4-3-2-1 y respiración',
    },
    {
      id: 'mod-critical',
      title: 'Pensamiento Crítico',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#3730A3',
      icon: Icons.scale,
      href: resolveEcosystemAppUrl('atelier', 'critical'),
      metric: () => '18 sesgos/falacias y matriz ponderada',
    },
    {
      id: 'mod-writing',
      title: 'Escritura Clara',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#0F766E',
      icon: Icons.feather,
      href: resolveEcosystemAppUrl('atelier', 'writing'),
      metric: () => 'Síntesis y analizador en vivo',
    },
    {
      id: 'mod-finance',
      title: 'Finanzas y Ahorro',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#047857',
      icon: Icons.wallet,
      href: resolveEcosystemAppUrl('atelier', 'finance'),
      metric: () => '50/30/20, metas e interés compuesto',
    },
    {
      id: 'mod-vitality',
      title: 'Postura Pro y Energía',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#0284C7',
      icon: Icons.activity,
      href: resolveEcosystemAppUrl('atelier', 'vitality'),
      metric: () => 'Monitor webcam, mapa corporal, 21d y nutrición',
    },
    {
      id: 'mod-career',
      title: 'Social y Carrera',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#0369a1',
      icon: Icons.briefcase,
      href: resolveEcosystemAppUrl('atelier', 'career'),
      metric: () => 'Negociación, entrevistas STAR y Brag Doc',
    },
    {
      id: 'mod-guides',
      title: 'Rutas y YouTube',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#dc2626',
      icon: Icons.playCircle,
      href: resolveEcosystemAppUrl('atelier', 'guides'),
      metric: () => 'Origami, dibujo, caligrafía y rutas YouTube',
    },
    {
      id: 'app-unumbral',
      title: 'UNUmbral Académico',
      prefix: 'App Universidad',
      category: 'universidad',
      accent: '#1d4ed8',
      icon: Icons.graduation,
      href: resolveEcosystemAppUrl('unumbral'),
      metric: (s) =>
        s.unumbralHasData
          ? `${s.unumbralCourses} cursos · ${s.unumbralPendingTasks} tareas`
          : 'Horario, cursos y notas',
    },
    {
      id: 'app-neurolab',
      title: 'NeuroNation++ Lab',
      prefix: 'OMNI ARENA · Cognitivo',
      category: 'entrenamiento',
      accent: '#4f46e5',
      icon: Icons.brain,
      href: resolveEcosystemAppUrl('arena', 'neurolab'),
      metric: (s) =>
        s.arenaNeuroScore !== null
          ? `NeuroScore ${s.arenaNeuroScore}${s.arenaNeuroDailyDone ? ' · Hoy listo' : ' · Sesión diaria'}`
          : 'Test cognitivo, sesión diaria y 4 cursos',
    },
    {
      id: 'app-arena',
      title: 'OMNI ARENA 2D/3D',
      prefix: 'App Entrenamiento',
      category: 'entrenamiento',
      accent: '#7c3aed',
      icon: Icons.gamepad,
      href: resolveEcosystemAppUrl('arena'),
      metric: (s) => {
        const meta = readArenaCatalogMeta();
        return s.arenaHasData && s.arenaSessions > 0
          ? `${s.arenaRank} (${s.arenaOverall}) · ${s.arenaSessions} partidas`
          : `${meta.total} disciplinas · ${meta.academies} academias`;
      },
    },
  ];

  const customs: DirectoryTileDef[] = dir.customLinks.map((c) => ({
    id: c.id,
    title: c.title,
    prefix: c.subtitle || 'Acceso Personal',
    category: c.category,
    accent: c.accent || '#0284c7',
    icon: customIcon(c.iconKey),
    href: c.url,
    metric: () => 'Enlace guardado en Supabase',
    isCustom: true,
  }));

  const map = new Map<string, DirectoryTileDef>([...builtIns, ...customs].map((t) => [t.id, t]));
  const ordered: DirectoryTileDef[] = [];
  dir.order.forEach((id) => {
    const found = map.get(id);
    if (found) {
      ordered.push(found);
      map.delete(id);
    }
  });
  map.forEach((rest) => ordered.push(rest));
  return ordered;
}

function renderCloudModal(): string {
  const cfg = cloudSync.getConfig();
  return `
    <div class="dir-overlay" id="dir-modal-overlay">
      <div class="dir-modal" role="dialog" aria-modal="true" aria-label="Nube Supabase y Respaldo del Ecosistema">
        <div class="dir-modal-head">
          <h2>Nube Supabase y Respaldo del Ecosistema</h2>
          <button type="button" class="dir-close-btn" data-close-modal aria-label="Cerrar">${Icons.closeX(16)}</button>
        </div>
        <p class="dir-empty">
          Guarda y sincroniza con el mismo <strong>código de espacio</strong>: orden del directorio, accesos propios, cuadernos/PDFs, perfil Atelier, respaldo de UNUmbral y puntajes de OMNI ARENA.
        </p>
        <form class="dir-form" id="dir-cloud-form">
          <label>
            <span>Supabase Project URL</span>
            <input type="url" id="dir-sb-url" value="${esc(cfg.supabaseUrl)}" placeholder="https://tuproyecto.supabase.co" />
          </label>
          <label>
            <span>Supabase Anon Key</span>
            <input type="text" id="dir-sb-key" value="${esc(cfg.supabaseAnonKey)}" placeholder="eyJhbGciOi..." />
          </label>
          <label>
            <span>Código de espacio compartido</span>
            <input type="text" id="dir-sb-space" value="${esc(cfg.spaceCode)}" placeholder="joseph-ecosistema" />
          </label>
          <label class="dir-inline-check">
            <input type="checkbox" id="dir-sb-auto" ${cfg.autoSync ? 'checked' : ''} />
            <span>Guardar automáticamente cada modificación</span>
          </label>

          ${cloudStatusMsg ? `<p class="dir-status-msg">${esc(cloudStatusMsg)}</p>` : ''}

          <div class="dir-form-actions">
            <button type="submit" class="dir-btn dir-btn-primary">${Icons.cloud(15)}<span>Guardar y probar conexión</span></button>
            <button type="button" class="dir-btn" id="dir-sb-sync-now">${Icons.refresh(15)}<span>Sincronizar ahora</span></button>
            <button type="button" class="dir-btn" id="dir-sb-copy-token">${Icons.link(15)}<span>Copiar llave rápida</span></button>
            <button type="button" class="dir-btn" id="dir-sb-paste-token">Pegar llave rápida</button>
          </div>
        </form>

        <div class="dir-sql-box">
          <div class="dir-form-actions">
            <button type="button" class="dir-btn dir-btn-sm" id="dir-toggle-sql">${showSql ? 'Ocultar SQL' : 'Ver SQL para Supabase'}</button>
            <button type="button" class="dir-btn dir-btn-sm" id="dir-copy-sql">Copiar SQL completo</button>
            <button type="button" class="dir-btn dir-btn-sm" id="dir-export-all">${Icons.download(14)}<span>Exportar respaldo .json</span></button>
            <label class="dir-btn dir-btn-sm" style="cursor:pointer;">
              ${Icons.upload(14)}<span>Importar .json</span>
              <input type="file" id="dir-import-all" accept=".json,application/json" style="display:none" />
            </label>
          </div>
          ${showSql ? `<pre class="dir-sql-pre">${esc(SUPABASE_SETUP_SQL)}</pre>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderProfileModal(): string {
  const dir = directoryStore.get();
  return `
    <div class="dir-overlay" id="dir-modal-overlay">
      <div class="dir-modal" role="dialog" aria-modal="true" aria-label="Perfil y enlaces del Directorio">
        <div class="dir-modal-head">
          <h2>Perfil y configuración del Directorio</h2>
          <button type="button" class="dir-close-btn" data-close-modal aria-label="Cerrar">${Icons.closeX(16)}</button>
        </div>
        <form class="dir-form" id="dir-profile-form">
          <label>
            <span>Nombre visible</span>
            <input type="text" id="dir-prof-name" value="${esc(dir.userName)}" required />
          </label>
          <label>
            <span>Sede o subtítulo personal</span>
            <input type="text" id="dir-prof-sub" value="${esc(dir.userSubtitle)}" />
          </label>
          <label>
            <span>Iniciales del avatar (máx. 3)</span>
            <input type="text" id="dir-prof-init" maxlength="3" value="${esc(dir.userInitials)}" />
          </label>
          <label>
            <span>Título del Directorio</span>
            <input type="text" id="dir-prof-title" value="${esc(dir.ecosystemTitle)}" />
          </label>
          <label>
            <span>Subtítulo del Directorio</span>
            <input type="text" id="dir-prof-subtitle" value="${esc(dir.ecosystemSubtitle)}" />
          </label>
          <label>
            <span>URL personalizada Atelier Diario (opcional)</span>
            <input type="url" id="dir-prof-atelier" value="${esc(dir.companionUrls.atelier ?? '')}" placeholder="https://tpdeax.github.io/atelier-diario/" />
          </label>
          <label>
            <span>URL personalizada UNUmbral (opcional)</span>
            <input type="url" id="dir-prof-unumbral" value="${esc(dir.companionUrls.unumbral)}" placeholder="https://tpdeax.github.io/UNUmbral/" />
          </label>
          <label>
            <span>URL personalizada OMNI ARENA (opcional)</span>
            <input type="url" id="dir-prof-arena" value="${esc(dir.companionUrls.arena)}" placeholder="https://tpdeax.github.io/omni-arena/" />
          </label>
          <div class="dir-form-actions">
            <button type="submit" class="dir-btn dir-btn-primary">${Icons.check(15)}<span>Guardar y sincronizar</span></button>
            <button type="button" class="dir-btn" id="dir-reset-layout">Restablecer orden original</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function syncWithSupabase(pushLocalFirst = false): Promise<void> {
  if (!cloudSync.isConfigured()) return;
  if (pushLocalFirst) {
    await directoryStore.pushNow();
  }
  const [scopes, docsCount] = await Promise.all([
    cloudSync.pullAllScopes(),
    cloudSync.pullDocsCount(),
  ]);
  remoteScopes = scopes;
  if (docsCount !== null) remoteDocsCount = docsCount;
  const remoteDir = scopes.directory_config?.payload as Parameters<typeof directoryStore.applyRemote>[0];
  if (remoteDir) {
    directoryStore.applyRemote(remoteDir);
  }
  directoryStore.setTheme(directoryStore.getTheme());
  renderApp();
}

function renderEcoSwitch(): string {
  return `
    <nav class="eco-switch" aria-label="Aplicaciones del ecosistema">
      <a class="eco-switch-link is-current" data-eco-app="directorio" aria-current="page" href="${esc(resolveEcoUrl('directorio'))}">
        ${Icons.grid(16)}<span class="eco-label-full">Directorio</span><span class="eco-label-short">Directorio</span>
      </a>
      <a class="eco-switch-link" data-eco-app="atelier" href="${esc(resolveEcoUrl('atelier'))}">
        ${Icons.bookOpen(16)}<span class="eco-label-full">Atelier Diario</span><span class="eco-label-short">Atelier</span>
      </a>
      <a class="eco-switch-link" data-eco-app="unumbral" href="${esc(resolveEcoUrl('unumbral'))}">
        ${Icons.graduation(16)}<span class="eco-label-full">UNUmbral</span><span class="eco-label-short">UNUmbral</span>
      </a>
      <a class="eco-switch-link" data-eco-app="arena" href="${esc(resolveEcoUrl('arena'))}">
        ${Icons.omni(16)}<span class="eco-label-full">OMNI ARENA</span><span class="eco-label-short">Arena</span>
      </a>
    </nav>
  `;
}

function renderDailyRouteCard(summary: CompanionSummary): string {
  const plan = buildDailyRoutePlan(summary);
  const progressPct = Math.round((plan.completedCount / plan.steps.length) * 100);
  const allDone = plan.completedCount === plan.steps.length;

  return `
    <section class="dir-card dir-daily-route-card ${allDone ? 'is-complete' : ''}" aria-label="Ruta de Hoy, bloque de 15 minutos">
      <div class="dir-route-head">
        <div class="dir-route-title-wrap">
          <span class="dir-route-icon">${Icons.clock(18)}</span>
          <div>
            <div class="dir-route-kicker">
              <span class="dir-route-pill">${esc(plan.periodLabel)} · ${plan.totalMinutes} min</span>
              <span class="dir-route-count">${plan.completedCount}/${plan.steps.length} completados</span>
            </div>
            <h2>Ruta de Hoy · Bloque de 15 min</h2>
            <p>Secuencia guiada de 3 pasos para avanzar sin parálisis de elección.</p>
          </div>
        </div>

        <div class="dir-route-head-actions">
          ${
            plan.nextStep
              ? `<a class="dir-btn dir-btn-primary dir-route-cta" href="${esc(plan.nextStep.href)}" title="Ir a ${esc(plan.nextStep.title)}">
                  <span>Empezar paso siguiente</span>
                  ${Icons.arrowRight(15)}
                </a>`
              : `<span class="dir-route-done-badge">${Icons.check(15)}<span>Bloque de 15 min completado</span></span>`
          }
        </div>
      </div>

      <div class="dir-route-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${plan.steps.length}" aria-valuenow="${plan.completedCount}" aria-label="Progreso de la Ruta de Hoy">
        <div class="dir-route-progress-fill" style="width: ${progressPct}%;"></div>
      </div>

      <div class="dir-route-steps">
        ${plan.steps
          .map((step) => {
            const isNext = plan.nextStep?.id === step.id;
            return `
              <article class="dir-route-step ${step.done ? 'is-done' : ''} ${isNext ? 'is-next' : ''}" style="--step-accent: ${step.accent};">
                <div class="dir-route-step-top">
                  <button
                    type="button"
                    class="dir-route-check ${step.done ? 'is-checked' : ''}"
                    data-route-toggle="${step.id}"
                    role="checkbox"
                    aria-checked="${step.done ? 'true' : 'false'}"
                    aria-label="Marcar paso ${step.order} (${esc(step.title)}) como ${step.done ? 'pendiente' : 'completado'}"
                    title="${step.done ? 'Desmarcar paso' : 'Marcar paso completado'}"
                  >
                    ${step.done ? Icons.check(13) : ''}
                  </button>
                  <div class="dir-route-step-meta">
                    <span class="dir-route-step-badge">Paso ${step.order} · ${step.minutes} min</span>
                    <span class="dir-route-step-pillar">${esc(step.pillar)}</span>
                  </div>
                </div>
                <div class="dir-route-step-body">
                  <h3>${esc(step.title)}</h3>
                  <p>${esc(step.subtitle)}</p>
                </div>
                <div class="dir-route-step-foot">
                  <a class="dir-route-step-link" href="${esc(step.href)}">
                    <span>${esc(step.cta)}</span>
                    ${Icons.arrowRight(13)}
                  </a>
                  ${isNext ? '<span class="dir-route-next-tag">Siguiente</span>' : ''}
                </div>
              </article>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}

function renderApp(): void {
  const theme = directoryStore.getTheme();
  document.documentElement.setAttribute('data-theme', theme);
  const dir = directoryStore.get();
  const syncCfg = cloudSync.getConfig();
  const configured = cloudSync.isConfigured();
  const cloudLabel = configured
    ? cloudSync.lastError
      ? 'Nube con aviso'
      : `Supabase · ${syncCfg.spaceCode}`
    : 'Conectar Supabase';

  const summary = buildCompanionSummary(remoteScopes, remoteDocsCount);
  const tiles = buildTiles();
  const visible = tiles.filter((t) => {
    const isHidden = dir.hiddenIds.includes(t.id);
    if (!editMode && !showHidden && isHidden) return false;
    if (dir.activeCategory !== 'all' && t.category !== dir.activeCategory) return false;
    return true;
  });

  visible.sort((a, b) => {
    const ap = dir.pinnedIds.includes(a.id) ? 0 : 1;
    const bp = dir.pinnedIds.includes(b.id) ? 0 : 1;
    return ap - bp;
  });

  const atelierCount = tiles.filter((t) => t.category === 'atelier').length;
  const tabs: { id: DirectoryCategory; label: string }[] = [
    { id: 'all', label: 'Todo el ecosistema' },
    { id: 'atelier', label: `Atelier Diario (${atelierCount})` },
    { id: 'universidad', label: 'Universidad' },
    { id: 'entrenamiento', label: 'Entrenamiento' },
    { id: 'personal', label: 'Mis Accesos' },
  ];

  const emptyOriginNote =
    'Sin datos de esta app en este origen. Abre el ecosistema publicado o activa la Nube para verlos aquí.';

  root.innerHTML = `
    <div class="dir-shell">
      ${renderEcoSwitch()}
      <header class="dir-topbar">
        <div class="dir-topbar-main">
          <div class="dir-brand">
            <span class="dir-brand-emblem">
              <span class="dir-brand-emblem-core">${Icons.grid(18)}</span>
            </span>
            <div class="dir-brand-copy">
              <span class="dir-brand-name">${esc(dir.ecosystemTitle)}</span>
              <span class="dir-brand-sub">${esc(dir.ecosystemSubtitle)}</span>
            </div>
          </div>

          <div class="dir-topbar-actions">
            <a class="dir-sos-btn" href="${esc(resolveEcosystemAppUrl('atelier', 'calm?sos=1'))}" title="Abrir contención inmediata SOS Pánico">
              ${Icons.heartPulse(15)}
              <span>SOS Pánico</span>
            </a>

            <button type="button" class="dir-cloud-pill ${configured ? 'is-live' : ''} ${cloudSync.lastError ? 'is-err' : ''}" id="dir-open-cloud">
              ${Icons.cloud(15)}
              <span>${esc(cloudLabel)}</span>
            </button>

            <button type="button" class="dir-btn dir-btn-sm dir-theme-btn" id="dir-theme-toggle" title="${theme === 'day' ? 'Cambiar a modo noche' : 'Cambiar a modo día'}" aria-pressed="${theme === 'night'}">
              ${theme === 'day' ? Icons.moon(16) : Icons.sun(16)}
              <span>${theme === 'day' ? 'Tema: Día' : 'Tema: Noche'}</span>
            </button>

            <button type="button" class="dir-profile-chip" id="dir-open-profile" title="Editar perfil y enlaces">
              <span class="dir-avatar">${esc(dir.userInitials)}</span>
              <span class="dir-profile-meta">
                <strong>${esc(dir.userName)}</strong>
                <small>${esc(dir.userSubtitle)}</small>
              </span>
              ${Icons.chevronDown(14)}
            </button>
          </div>
        </div>
      </header>

      <main class="dir-main">
        <section class="dir-hero-strip" aria-label="Resumen del ecosistema">
          <div class="dir-hero-copy">
            <h1>Ecosistema Personal</h1>
            <p>Tus módulos de estudio, organización universitaria y entrenamiento cognitivo sincronizados en un solo lugar.</p>
          </div>
          <div class="dir-hero-kpis">
            <div class="dir-kpi"><span>Atelier Hoy</span><strong>${summary.atelierHasData ? `${summary.atelierTodayDone}/${summary.atelierTotalModules}` : '--'}</strong></div>
            <div class="dir-kpi"><span>Cursos UNU</span><strong>${summary.unumbralHasData ? summary.unumbralCourses : '--'}</strong></div>
            <div class="dir-kpi"><span>OMNI ARENA</span><strong>${summary.arenaHasData ? esc(summary.arenaRank) : '--'}</strong></div>
            <div class="dir-kpi"><span>NeuroScore</span><strong>${summary.arenaNeuroScore !== null ? summary.arenaNeuroScore : '--'}</strong></div>
          </div>
        </section>

        ${renderDailyRouteCard(summary)}

        <section class="dir-cockpit-grid" aria-label="Continuar donde lo dejaste y recomendaciones del día">
          <article class="dir-card dir-cockpit-card">
            <div class="dir-card-head">
              <h2>Donde lo dejaste</h2>
              <span class="dir-empty">Sincronizado</span>
            </div>
            ${
              summary.atelierResume
                ? `
              <div class="dir-cockpit-resume">
                <span class="dir-empty">${esc(summary.atelierResume.timeLabel)}</span>
                <strong>${esc(summary.atelierResume.label)}</strong>
                <p>${esc(summary.atelierResume.detail)}</p>
                <a class="dir-btn dir-btn-primary dir-btn-sm" href="${esc(summary.atelierResume.href)}">Continuar donde lo dejaste</a>
              </div>`
                : `
              <div class="dir-cockpit-resume">
                <strong>Sin sesión reciente registrada</strong>
                <p>Abre cualquier taller de Atelier Diario y aquí aparecerá exactamente dónde te quedaste.</p>
                <a class="dir-btn dir-btn-primary dir-btn-sm" href="${esc(resolveEcoUrl('atelier'))}">Abrir Atelier Diario</a>
              </div>`
            }
            ${
              summary.atelierRecent.length > 0
                ? `<div class="dir-recent-row">${summary.atelierRecent
                    .map(
                      (r) =>
                        `<a class="dir-recent-pill" href="${esc(r.href)}">${esc(r.label)} · ${esc(r.timeLabel)}</a>`
                    )
                    .join('')}</div>`
                : ''
            }
          </article>

          <article class="dir-card dir-cockpit-card">
            <div class="dir-card-head">
              <h2>Pendientes y a medias (${summary.pendingItems.length})</h2>
              <span class="dir-empty">Retoma al instante</span>
            </div>
            <div class="dir-cockpit-list">
              ${
                summary.pendingItems.length > 0
                  ? summary.pendingItems
                      .map(
                        (item) => `
                    <a class="dir-cockpit-item ${item.priority === 'high' ? 'is-priority' : ''}" href="${esc(item.href)}">
                      <div class="dir-cockpit-item-top">
                        <strong>${esc(item.title)}</strong>
                        <span class="dir-cockpit-badge">${esc(item.badge)}</span>
                      </div>
                      <span class="dir-cockpit-sub">${esc(item.subtitle)}</span>
                      <span class="dir-cockpit-cta">${esc(item.cta)}</span>
                    </a>`
                      )
                      .join('')
                  : '<p class="dir-empty" style="margin:0;">Sin pendientes a medias en este momento. Todo está al día.</p>'
              }
            </div>
          </article>

          <article class="dir-card dir-cockpit-card">
            <div class="dir-card-head">
              <h2>Recomendado para hoy</h2>
              <span class="dir-empty">Según tu avance y hora</span>
            </div>
            <div class="dir-cockpit-list">
              ${summary.recommendedItems
                .map(
                  (rec) => `
                <a class="dir-cockpit-item" href="${esc(rec.href)}">
                  <div class="dir-cockpit-item-top">
                    <strong>${esc(rec.title)}</strong>
                    <span class="dir-cockpit-badge">${esc(rec.badge)}</span>
                  </div>
                  <span class="dir-cockpit-sub">${esc(rec.subtitle)}</span>
                  <span class="dir-cockpit-cta">${esc(rec.cta)}</span>
                </a>`
                )
                .join('')}
            </div>
          </article>
        </section>

        <section class="dir-card dir-tutorial-card ${showEcoTutorial ? 'is-open' : ''}" aria-label="Tutorial rápido del Ecosistema">
          <div class="dir-tutorial-head">
            <div class="dir-tutorial-title-wrap">
              <span class="dir-tutorial-icon">${Icons.bookOpen(18)}</span>
              <div>
                <h2>Tutorial rápido del Ecosistema (4 pasos)</h2>
                <p>Qué hace cada app y cómo sincronizar tus datos en la nube con Supabase.</p>
              </div>
            </div>
            <button type="button" class="dir-btn dir-btn-sm" id="dir-toggle-eco-tut" aria-expanded="${showEcoTutorial ? 'true' : 'false'}">
              <span>${showEcoTutorial ? 'Ocultar tutorial' : 'Abrir tutorial'}</span>
              ${Icons.chevronDown(14)}
            </button>
          </div>
          ${
            showEcoTutorial
              ? `<div class="dir-tutorial-body">
                  <div class="dir-tutorial-steps">
                    <div class="dir-tutorial-step">
                      <div class="dir-tutorial-step-head">${Icons.grid(16)}<strong>1. Directorio</strong></div>
                      <p>Portal central del ecosistema. Personaliza el orden de tus tarjetas, fija tus favoritos arriba, agrega enlaces propios y vigila tu pulso diario.</p>
                    </div>
                    <div class="dir-tutorial-step">
                      <div class="dir-tutorial-step-head">${Icons.bookOpen(16)}<strong>2. Atelier Diario</strong></div>
                      <p>Taller práctico con Brújula Personal, Cuaderno/PDF, Biblioteca RSVP, Caligrafía, Dibujo, Postura Pro, Social y Carrera, Rutas YouTube, Oratoria SM-2/Feynman y Canto.</p>
                    </div>
                    <div class="dir-tutorial-step">
                      <div class="dir-tutorial-step-head">${Icons.graduation(16)}<strong>3. UNUmbral</strong></div>
                      <p>Organizador universitario para ciclos, cursos, evaluaciones ponderadas, horarios de clase y seguimiento de tareas académicas.</p>
                    </div>
                    <div class="dir-tutorial-step">
                      <div class="dir-tutorial-step-head">${Icons.omni(16)}<strong>4. OMNI ARENA</strong></div>
                      <p>Entrenamiento 2D/3D con 40 disciplinas, 22 academias guiadas, NeuroNation++ Lab (test cognitivo y sesión diaria), 5 dificultades y radar de 5 ejes.</p>
                    </div>
                  </div>
                  <div class="dir-tutorial-cloud">
                    <div class="dir-tutorial-cloud-copy">
                      <span class="dir-tutorial-cloud-icon">${Icons.cloud(16)}</span>
                      <div>
                        <strong>Sincronización en la nube (Supabase):</strong>
                        <span>Pulsa <em>${configured ? `Supabase · ${esc(syncCfg.spaceCode)}` : 'Conectar Supabase'}</em> arriba para guardar tu URL, Anon Key y Código de espacio, o usa <em>Copiar / Pegar llave rápida</em> para vincular Atelier, UNUmbral y OMNI ARENA en segundos.</span>
                      </div>
                    </div>
                    <button type="button" class="dir-btn dir-btn-primary dir-btn-sm" data-open-cloud>${Icons.cloud(14)}<span>${configured ? 'Revisar Nube' : 'Activar Nube'}</span></button>
                  </div>
                </div>`
              : ''
          }
        </section>

        <section class="dir-toolbar">
          <div class="dir-filter-tabs" role="tablist">
            ${tabs
              .map(
                (t) => `
              <button type="button" class="dir-tab ${dir.activeCategory === t.id ? 'is-active' : ''}" data-cat="${t.id}">
                ${t.label}
              </button>`
              )
              .join('')}
          </div>

          <div class="dir-toolbar-actions">
            <button type="button" class="dir-btn" id="dir-toggle-add">${Icons.plus(15)}<span>Nuevo acceso</span></button>
            <button type="button" class="dir-btn ${editMode ? 'dir-btn-primary' : ''}" id="dir-toggle-edit">
              ${Icons.sliders(15)}<span>${editMode ? 'Listo' : 'Personalizar'}</span>
            </button>
          </div>
        </section>

        ${
          showAddForm
            ? `
          <form class="dir-card dir-form" id="dir-add-link-form">
            <div class="dir-card-head">
              <h2>Agregar acceso directo al Directorio (se guarda en Supabase)</h2>
              <button type="button" class="dir-btn dir-btn-sm" id="dir-cancel-add">Cerrar</button>
            </div>
            <div class="dir-preset-row">
              <span class="dir-preset-label">Plantilla rápida:</span>
              <button type="button" class="dir-preset-chip" id="dir-preset-workout">
                ${Icons.dumbbell(14)}
                <span>Plantilla: Mi app de ejercicio en casa</span>
              </button>
            </div>
            <div class="dir-custom-form-grid">
              <label>
                <span>Nombre del módulo o enlace</span>
                <input type="text" id="dir-new-title" required placeholder="Ej. Portal UNU o Notion" />
              </label>
              <label>
                <span>Subtítulo</span>
                <input type="text" id="dir-new-sub" placeholder="Ej. Acceso rápido" />
              </label>
              <label>
                <span>URL completa</span>
                <input type="url" id="dir-new-url" required placeholder="https://..." />
              </label>
              <label>
                <span>Categoría</span>
                <select id="dir-new-cat">
                  <option value="personal">Mis Accesos</option>
                  <option value="universidad">Universidad</option>
                  <option value="atelier">Atelier Diario</option>
                  <option value="entrenamiento">Entrenamiento</option>
                </select>
              </label>
              <label>
                <span>Color del rombo</span>
                <input type="color" id="dir-new-color" value="#0284c7" />
              </label>
            </div>
            <div class="dir-form-actions">
              <button type="submit" class="dir-btn dir-btn-primary">${Icons.check(15)}<span>Guardar en Directorio</span></button>
            </div>
          </form>`
            : ''
        }

        ${
          editMode && dir.hiddenIds.length > 0
            ? `
          <div class="dir-card dir-form-actions" style="justify-content:space-between;align-items:center;">
            <span class="dir-empty">Hay ${dir.hiddenIds.length} módulos ocultos. Puedes volver a mostrarlos aquí.</span>
            <button type="button" class="dir-btn dir-btn-sm" id="dir-toggle-hidden">${showHidden ? 'Ocultar lista' : 'Mostrar ocultos'}</button>
          </div>`
            : ''
        }

        <section class="dir-grid" aria-label="Módulos del ecosistema">
          ${visible
            .map((tile) => {
              const pinned = dir.pinnedIds.includes(tile.id);
              const hidden = dir.hiddenIds.includes(tile.id);
              return `
                <article class="dir-tile ${pinned ? 'is-pinned' : ''} ${hidden ? 'is-hidden-preview' : ''}" style="--tile-accent: ${tile.accent};">
                  ${pinned ? `<span class="dir-pin-dot" title="Fijado arriba">${Icons.star(14)}</span>` : ''}
                  <a class="dir-tile-open" href="${esc(tile.href)}">
                    <div class="dir-diamond">
                      <span class="dir-diamond-frame"></span>
                      <span class="dir-diamond-tint"></span>
                      <span class="dir-diamond-icon">${tile.icon(28)}</span>
                    </div>
                    <div class="dir-tile-copy">
                      <span class="dir-tile-prefix">${esc(tile.prefix)}</span>
                      <h3 class="dir-tile-title">${esc(tile.title)}</h3>
                      <p class="dir-tile-metric">${esc(tile.metric(summary))}</p>
                    </div>
                  </a>
                  ${
                    editMode
                      ? `
                    <div class="dir-tile-controls">
                      <button type="button" class="dir-ctrl-btn ${pinned ? 'is-active' : ''}" data-pin="${tile.id}" title="Fijar arriba">${Icons.star(14)}</button>
                      <button type="button" class="dir-ctrl-btn" data-move-up="${tile.id}" title="Subir">${Icons.arrowUp(14)}</button>
                      <button type="button" class="dir-ctrl-btn" data-move-down="${tile.id}" title="Bajar">${Icons.arrowDown(14)}</button>
                      <button type="button" class="dir-ctrl-btn" data-hide="${tile.id}" title="${hidden ? 'Mostrar' : 'Ocultar'}">${hidden ? Icons.eye(14) : Icons.eyeOff(14)}</button>
                      ${
                        tile.isCustom
                          ? `<button type="button" class="dir-ctrl-btn is-danger" data-del-custom="${tile.id}" title="Eliminar enlace">${Icons.trash(14)}</button>`
                          : ''
                      }
                    </div>`
                      : ''
                  }
                </article>`;
            })
            .join('')}
        </section>

        <section class="dir-overview-grid">
          <div class="dir-card">
            <div class="dir-card-head">
              <h2>Pulso de Atelier Diario</h2>
              <a class="dir-btn dir-btn-sm" href="${esc(resolveEcosystemAppUrl('atelier', 'studio'))}">Abrir Cuaderno</a>
            </div>
            ${
              summary.atelierHasData
                ? `
                  <p class="dir-origin-meta">Racha ${summary.atelierStreak} ${summary.atelierStreak === 1 ? 'día' : 'días'} · ${summary.atelierTodayDone}/${summary.atelierTotalModules} hábitos hoy</p>
                  <div class="dir-stat-grid">
                    <div class="dir-stat-box"><span>Hábitos hoy</span><strong>${summary.atelierTodayDone}/${summary.atelierTotalModules}</strong></div>
                    <div class="dir-stat-box"><span>Racha</span><strong>${summary.atelierStreak} días</strong></div>
                    <div class="dir-stat-box"><span>Documentos</span><strong>${summary.docsCount}</strong></div>
                  </div>`
                : `
                  <div class="dir-origin-note">
                    <p>${emptyOriginNote}</p>
                    ${!configured ? `<button type="button" class="dir-btn dir-btn-sm" data-open-cloud>Configurar Nube</button>` : ''}
                  </div>`
            }
          </div>

          <div class="dir-card">
            <div class="dir-card-head">
              <h2>UNUmbral y OMNI ARENA</h2>
              <a class="dir-btn dir-btn-sm" href="${esc(resolveEcosystemAppUrl('unumbral'))}">Ir a UNUmbral</a>
            </div>
            ${
              summary.unumbralHasData || summary.arenaHasData
                ? `
                  <div class="dir-stat-grid">
                    <div class="dir-stat-box"><span>Cursos UNU</span><strong>${summary.unumbralHasData ? summary.unumbralCourses : '--'}</strong></div>
                    <div class="dir-stat-box"><span>Tareas pend.</span><strong>${summary.unumbralHasData ? summary.unumbralPendingTasks : '--'}</strong></div>
                    <div class="dir-stat-box"><span>Rango Arena</span><strong>${summary.arenaHasData ? `${esc(summary.arenaRank)} (${summary.arenaOverall})` : '--'}</strong></div>
                    <div class="dir-stat-box"><span>NeuroScore</span><strong>${summary.arenaNeuroScore !== null ? summary.arenaNeuroScore : '--'}</strong></div>
                    <div class="dir-stat-box"><span>Partidas</span><strong>${summary.arenaHasData ? summary.arenaSessions : '--'}</strong></div>
                  </div>
                  ${
                    !summary.unumbralHasData || !summary.arenaHasData
                      ? `<div class="dir-origin-note" style="margin-top:10px;"><p>${emptyOriginNote}</p>${!configured ? `<button type="button" class="dir-btn dir-btn-sm" data-open-cloud>Configurar Nube</button>` : ''}</div>`
                      : ''
                  }`
                : `
                  <div class="dir-origin-note">
                    <p>${emptyOriginNote}</p>
                    ${!configured ? `<button type="button" class="dir-btn dir-btn-sm" data-open-cloud>Configurar Nube</button>` : ''}
                  </div>`
            }
          </div>
        </section>
      </main>

      ${activeModal === 'cloud' ? renderCloudModal() : activeModal === 'profile' ? renderProfileModal() : ''}
    </div>
  `;

  bindEvents();
}

function bindEvents(): void {
  root.querySelector('#dir-open-cloud')?.addEventListener('click', () => {
    activeModal = 'cloud';
    renderApp();
  });
  root.querySelector('#dir-toggle-eco-tut')?.addEventListener('click', () => {
    showEcoTutorial = !showEcoTutorial;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('dir-eco-tut-open', showEcoTutorial ? '1' : '0');
      }
    } catch {
      // ignore storage errors
    }
    renderApp();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-open-cloud]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeModal = 'cloud';
      renderApp();
    });
  });
  root.querySelector('#dir-open-profile')?.addEventListener('click', () => {
    activeModal = 'profile';
    renderApp();
  });
  root.querySelector('#dir-theme-toggle')?.addEventListener('click', () => {
    const next = directoryStore.getTheme() === 'day' ? 'night' : 'day';
    directoryStore.setTheme(next);
    renderApp();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      directoryStore.setCategory(btn.dataset.cat as DirectoryCategory);
    });
  });
  root.querySelector('#dir-toggle-edit')?.addEventListener('click', () => {
    editMode = !editMode;
    renderApp();
  });
  root.querySelector('#dir-toggle-add')?.addEventListener('click', () => {
    showAddForm = !showAddForm;
    renderApp();
  });
  root.querySelector('#dir-cancel-add')?.addEventListener('click', () => {
    showAddForm = false;
    renderApp();
  });
  root.querySelector('#dir-toggle-hidden')?.addEventListener('click', () => {
    showHidden = !showHidden;
    renderApp();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-route-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const stepId = btn.dataset.routeToggle as DailyRouteStepId | undefined;
      if (!stepId) return;
      toggleDailyRouteStep(stepId);
      renderApp();
    });
  });

  root.querySelector('#dir-preset-workout')?.addEventListener('click', () => {
    const form = root.querySelector('#dir-add-link-form') as HTMLFormElement | null;
    const titleInput = root.querySelector('#dir-new-title') as HTMLInputElement | null;
    const subInput = root.querySelector('#dir-new-sub') as HTMLInputElement | null;
    const catSelect = root.querySelector('#dir-new-cat') as HTMLSelectElement | null;
    const colorInput = root.querySelector('#dir-new-color') as HTMLInputElement | null;
    const urlInput = root.querySelector('#dir-new-url') as HTMLInputElement | null;
    if (titleInput) titleInput.value = 'Ejercicio en casa';
    if (subInput) subInput.value = 'Rutina externa sin máquinas';
    if (catSelect) catSelect.value = 'personal';
    if (colorInput) colorInput.value = '#16a34a';
    if (form) form.dataset.presetIcon = 'dumbbell';
    if (urlInput) {
      urlInput.placeholder = 'https://tu-app-o-playlist-de-ejercicio...';
      urlInput.focus();
    }
  });

  root.querySelector('#dir-add-link-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const title = (root.querySelector('#dir-new-title') as HTMLInputElement).value;
    const subtitle = (root.querySelector('#dir-new-sub') as HTMLInputElement).value;
    const url = (root.querySelector('#dir-new-url') as HTMLInputElement).value;
    const category = (root.querySelector('#dir-new-cat') as HTMLSelectElement).value as Exclude<
      DirectoryCategory,
      'all'
    >;
    const accent = (root.querySelector('#dir-new-color') as HTMLInputElement).value;
    const iconKey =
      form.dataset.presetIcon === 'dumbbell' ||
      /ejercicio|entreno|rutina|workout/i.test(`${title} ${subtitle}`)
        ? 'dumbbell'
        : category === 'universidad'
          ? 'graduation'
          : category === 'entrenamiento'
            ? 'gamepad'
            : 'link';
    directoryStore.addCustomLink({
      title,
      subtitle,
      url,
      category,
      accent,
      iconKey,
    });
    showAddForm = false;
  });

  root.querySelectorAll<HTMLButtonElement>('[data-pin]').forEach((b) => {
    b.addEventListener('click', () => directoryStore.togglePin(b.dataset.pin!));
  });
  root.querySelectorAll<HTMLButtonElement>('[data-hide]').forEach((b) => {
    b.addEventListener('click', () => directoryStore.toggleHidden(b.dataset.hide!));
  });
  root.querySelectorAll<HTMLButtonElement>('[data-move-up]').forEach((b) => {
    b.addEventListener('click', () => directoryStore.moveItem(b.dataset.moveUp!, -1));
  });
  root.querySelectorAll<HTMLButtonElement>('[data-move-down]').forEach((b) => {
    b.addEventListener('click', () => directoryStore.moveItem(b.dataset.moveDown!, 1));
  });
  root.querySelectorAll<HTMLButtonElement>('[data-del-custom]').forEach((b) => {
    b.addEventListener('click', () => directoryStore.removeCustomLink(b.dataset.delCustom!));
  });

  // Modals
  root.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeModal = 'none';
      cloudStatusMsg = '';
      renderApp();
    });
  });
  root.querySelector('#dir-modal-overlay')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'dir-modal-overlay') {
      activeModal = 'none';
      cloudStatusMsg = '';
      renderApp();
    }
  });

  root.querySelector('#dir-cloud-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    cloudSync.saveConfig({
      supabaseUrl: (root.querySelector('#dir-sb-url') as HTMLInputElement).value,
      supabaseAnonKey: (root.querySelector('#dir-sb-key') as HTMLInputElement).value,
      spaceCode: (root.querySelector('#dir-sb-space') as HTMLInputElement).value,
      autoSync: (root.querySelector('#dir-sb-auto') as HTMLInputElement).checked,
    });
    cloudStatusMsg = 'Probando conexión con Supabase...';
    renderApp();
    const res = await cloudSync.testConnection();
    cloudStatusMsg = res.message;
    if (res.ok) {
      await syncWithSupabase(true);
    }
    renderApp();
  });

  root.querySelector('#dir-sb-sync-now')?.addEventListener('click', async () => {
    cloudStatusMsg = 'Sincronizando todo con Supabase...';
    renderApp();
    await syncWithSupabase(true);
    cloudStatusMsg = cloudSync.lastError
      ? `Aviso: ${cloudSync.lastError}`
      : 'Directorio y estado sincronizados correctamente.';
    renderApp();
  });

  root.querySelector('#dir-sb-copy-token')?.addEventListener('click', async () => {
    const token = cloudSync.exportConfigToken();
    try {
      await navigator.clipboard.writeText(token);
      cloudStatusMsg = 'Llave rápida copiada al portapapeles.';
    } catch {
      window.prompt('Copia esta llave rápida para pegarla en otra app:', token);
    }
    renderApp();
  });

  root.querySelector('#dir-sb-paste-token')?.addEventListener('click', () => {
    const raw = window.prompt('Pega aquí la llave rápida JSON:');
    if (!raw) return;
    if (cloudSync.importConfigToken(raw)) {
      cloudStatusMsg = 'Llave importada. Sincronizando...';
      void syncWithSupabase(false);
    } else {
      cloudStatusMsg = 'Llave inválida. Revisa el JSON.';
    }
    renderApp();
  });

  root.querySelector('#dir-toggle-sql')?.addEventListener('click', () => {
    showSql = !showSql;
    renderApp();
  });

  root.querySelector('#dir-copy-sql')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
      cloudStatusMsg = 'SQL copiado al portapapeles.';
    } catch {
      showSql = true;
      cloudStatusMsg = 'Copia el SQL desde el recuadro inferior.';
    }
    renderApp();
  });

  root.querySelector('#dir-export-all')?.addEventListener('click', async () => {
    const remoteDocs = await cloudSync.pullAllRawDocuments();
    const payload = {
      exportedAt: new Date().toISOString(),
      source: 'directorio-ecosistema',
      directory_config: directoryStore.get(),
      remote_scopes: remoteScopes,
      atelier_documents: remoteDocs,
      local: {
        atelier_profile:
          localStorage.getItem('atelier_diario_profile_v1') ||
          localStorage.getItem('atelier_profile_v2'),
        arena_profile: localStorage.getItem('omni_arena_profile_v1'),
        unumbral_snapshot:
          localStorage.getItem('unumbral_last_snapshot_v1') ||
          localStorage.getItem('atelier_umbral_snapshot_v1'),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecosistema-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    cloudStatusMsg = 'Archivo .json completo descargado.';
    renderApp();
  });

  root.querySelector('#dir-import-all')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as {
        directory_config?: Parameters<typeof directoryStore.applyRemote>[0];
      };
      if (parsed.directory_config) {
        parsed.directory_config.updatedAt = Date.now();
        directoryStore.applyRemote(parsed.directory_config);
        await directoryStore.pushNow();
      }
      cloudStatusMsg = 'Configuración del Directorio importada y sincronizada.';
    } catch {
      cloudStatusMsg = 'No se pudo leer el archivo .json.';
    }
    renderApp();
  });

  root.querySelector('#dir-profile-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    directoryStore.updateIdentity({
      userName: (root.querySelector('#dir-prof-name') as HTMLInputElement).value,
      userSubtitle: (root.querySelector('#dir-prof-sub') as HTMLInputElement).value,
      userInitials: (root.querySelector('#dir-prof-init') as HTMLInputElement).value,
      ecosystemTitle: (root.querySelector('#dir-prof-title') as HTMLInputElement).value,
      ecosystemSubtitle: (root.querySelector('#dir-prof-subtitle') as HTMLInputElement).value,
      atelierUrl: (root.querySelector('#dir-prof-atelier') as HTMLInputElement).value,
      unumbralUrl: (root.querySelector('#dir-prof-unumbral') as HTMLInputElement).value,
      arenaUrl: (root.querySelector('#dir-prof-arena') as HTMLInputElement).value,
    });
    activeModal = 'none';
    renderApp();
  });

  root.querySelector('#dir-reset-layout')?.addEventListener('click', () => {
    directoryStore.resetLayout();
    activeModal = 'none';
    renderApp();
  });
}

directoryStore.subscribe(() => renderApp());
cloudSync.onStatusChange(() => {
  const pill = root.querySelector('#dir-open-cloud span');
  if (pill) {
    const cfg = cloudSync.getConfig();
    pill.textContent = cloudSync.isConfigured()
      ? cloudSync.lastError
        ? 'Nube con aviso'
        : `Supabase · ${cfg.spaceCode}`
      : 'Conectar Supabase';
  }
});

directoryStore.applyIncomingEcoTheme();
window.addEventListener('storage', (e) => {
  if (e.key === 'umbral-theme' || e.key === DAILY_ROUTE_STORAGE_KEY) {
    renderApp();
  }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    renderApp();
  }
});

renderApp();
void syncWithSupabase(false);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
