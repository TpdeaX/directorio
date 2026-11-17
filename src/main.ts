import './style.css';
import { Icons } from './icons';
import { cloudSync, SUPABASE_SETUP_SQL } from './services/CloudSync';
import {
  buildCompanionSummary,
  directoryStore,
  resolveEcosystemAppUrl,
} from './state/DirectoryStore';
import {
  CompanionSummary,
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
  return Icons.link;
}

function buildTiles(): DirectoryTileDef[] {
  const dir = directoryStore.get();

  const builtIns: DirectoryTileDef[] = [
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
      title: 'Biblioteca y Lector',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#2563eb',
      icon: Icons.book,
      href: resolveEcosystemAppUrl('atelier', 'reader'),
      metric: () => 'Clásicos y lectura libre',
    },
    {
      id: 'mod-calligraphy',
      title: 'Taller de Caligrafía',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#d97706',
      icon: Icons.pen,
      href: resolveEcosystemAppUrl('atelier', 'calligraphy'),
      metric: () => '12 plantillas guiadas',
    },
    {
      id: 'mod-typing',
      title: 'Mecanografía',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#475569',
      icon: Icons.keyboard,
      href: resolveEcosystemAppUrl('atelier', 'typing'),
      metric: () => 'Velocidad y precisión',
    },
    {
      id: 'mod-language',
      title: 'Ortografía y Léxico',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#0891b2',
      icon: Icons.spell,
      href: resolveEcosystemAppUrl('atelier', 'language'),
      metric: () => '40+ reglas y glosario',
    },
    {
      id: 'mod-mindset',
      title: 'Frases y Criterio',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#ca8a04',
      icon: Icons.bulb,
      href: resolveEcosystemAppUrl('atelier', 'mindset'),
      metric: () => 'Frases guardadas y notas',
    },
    {
      id: 'mod-vault',
      title: 'Baúl de Guardados',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#0f4c81',
      icon: Icons.archive,
      href: resolveEcosystemAppUrl('atelier', 'vault'),
      metric: () => '1,290+ ideas y recursos',
    },
    {
      id: 'mod-focuslab',
      title: 'Oratoria y Enfoque',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#0f766e',
      icon: Icons.mic,
      href: resolveEcosystemAppUrl('atelier', 'focuslab'),
      metric: () => 'Muletillas, Schulte y Recall',
    },
    {
      id: 'mod-singing',
      title: 'Estudio de Canto',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#be185d',
      icon: Icons.mic,
      href: resolveEcosystemAppUrl('atelier', 'singing'),
      metric: () => '12 ejercicios y afinador',
    },
    {
      id: 'mod-calm',
      title: 'Centro de Calma',
      prefix: 'Módulo Atelier',
      category: 'atelier',
      accent: '#0f766e',
      icon: Icons.wind,
      href: resolveEcosystemAppUrl('atelier', 'calm'),
      metric: () => 'Respiración y 12 pasos SOS',
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
        s.unumbralCourses > 0
          ? `${s.unumbralCourses} cursos · ${s.unumbralPendingTasks} tareas`
          : 'Horario, cursos y notas',
    },
    {
      id: 'app-arena',
      title: 'OMNI ARENA 2D/3D',
      prefix: 'App Entrenamiento',
      category: 'entrenamiento',
      accent: '#7c3aed',
      icon: Icons.gamepad,
      href: resolveEcosystemAppUrl('arena'),
      metric: (s) =>
        s.arenaSessions > 0
          ? `${s.arenaRank} · ${s.arenaSessions} partidas`
          : '14 disciplinas cognitivas',
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
          <button type="button" class="dir-close-btn" data-close-modal aria-label="Cerrar">&times;</button>
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
          <button type="button" class="dir-close-btn" data-close-modal aria-label="Cerrar">&times;</button>
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
  renderApp();
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

  root.innerHTML = `
    <div class="dir-shell">
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
            <button type="button" class="dir-cloud-pill ${configured ? 'is-live' : ''} ${cloudSync.lastError ? 'is-err' : ''}" id="dir-open-cloud">
              ${Icons.cloud(15)}
              <span>${esc(cloudLabel)}</span>
            </button>

            <button type="button" class="dir-icon-btn" id="dir-theme-toggle" title="${theme === 'day' ? 'Cambiar a modo noche' : 'Cambiar a modo día'}">
              ${theme === 'day' ? Icons.moon(17) : Icons.sun(17)}
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
            <div class="dir-kpi"><span>Atelier Hoy</span><strong>${summary.atelierTodayDone}/${summary.atelierTotalModules}</strong></div>
            <div class="dir-kpi"><span>Cursos UNU</span><strong>${summary.unumbralCourses}</strong></div>
            <div class="dir-kpi"><span>OMNI ARENA</span><strong>${esc(summary.arenaRank)}</strong></div>
          </div>
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
              <a class="dir-btn dir-btn-sm" href="${resolveEcosystemAppUrl('atelier', 'studio')}">Abrir Cuaderno</a>
            </div>
            <div class="dir-stat-grid">
              <div class="dir-stat-box"><span>Hoy</span><strong>${summary.atelierTodayDone}/${summary.atelierTotalModules}</strong></div>
              <div class="dir-stat-box"><span>Racha</span><strong>${summary.atelierStreak} días</strong></div>
              <div class="dir-stat-box"><span>Nivel</span><strong>Niv. ${summary.atelierLevel}</strong></div>
              <div class="dir-stat-box"><span>Documentos</span><strong>${summary.docsCount}</strong></div>
            </div>
          </div>

          <div class="dir-card">
            <div class="dir-card-head">
              <h2>UNUmbral y OMNI ARENA</h2>
              <a class="dir-btn dir-btn-sm" href="${resolveEcosystemAppUrl('unumbral')}">Ir a UNUmbral</a>
            </div>
            <div class="dir-stat-grid">
              <div class="dir-stat-box"><span>Cursos UNU</span><strong>${summary.unumbralCourses}</strong></div>
              <div class="dir-stat-box"><span>Tareas pend.</span><strong>${summary.unumbralPendingTasks}</strong></div>
              <div class="dir-stat-box"><span>Rango Arena</span><strong>${esc(summary.arenaRank)}</strong></div>
              <div class="dir-stat-box"><span>Partidas</span><strong>${summary.arenaSessions}</strong></div>
            </div>
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

  root.querySelector('#dir-add-link-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = (root.querySelector('#dir-new-title') as HTMLInputElement).value;
    const subtitle = (root.querySelector('#dir-new-sub') as HTMLInputElement).value;
    const url = (root.querySelector('#dir-new-url') as HTMLInputElement).value;
    const category = (root.querySelector('#dir-new-cat') as HTMLSelectElement).value as Exclude<
      DirectoryCategory,
      'all'
    >;
    const accent = (root.querySelector('#dir-new-color') as HTMLInputElement).value;
    directoryStore.addCustomLink({
      title,
      subtitle,
      url,
      category,
      accent,
      iconKey: category === 'universidad' ? 'graduation' : category === 'entrenamiento' ? 'gamepad' : 'link',
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
        atelier_profile: localStorage.getItem('atelier_profile_v2'),
        arena_profile: localStorage.getItem('omni_arena_profile_v1'),
        unumbral_snapshot: localStorage.getItem('unumbral_last_snapshot_v1'),
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

renderApp();
void syncWithSupabase(false);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
