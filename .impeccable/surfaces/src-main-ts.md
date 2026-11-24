---
version: 1
slug: "src-main-ts"
primary_target: "src/main.ts"
related_targets: []
---

# Surface Brief: OMNI Ecosistema — Suite Unificada (Curso ISOM)

- **Scope & Mode:** `operate` — Rediseño visual y de UX unificado para las 4 PWA independientes del ecosistema (`directorio/`, `omni-life/` Atelier Diario, `omni-arena/` OMNI ARENA + NeuroLab y `UNUmbral/`), eliminando la duplicación del Directorio en Atelier Diario y reemplazando los 3 estilos previos por una sola gramática coherente en PC y móvil (día/noche).
- **Audience & Job:** Joseph Marquina operando su rutina diaria (Ruta de Hoy 15 min, 17 talleres de Atelier, ciclo universitario de 17 semanas en UNUmbral y 40 disciplinas 2D/3D + NeuroLab en OMNI ARENA) con máxima claridad, velocidad y cero sobrecarga.
- **Constraints:** Conservar 4 repositorios Git independientes (`main`), 100% de la funcionalidad, sincronización Supabase (`ecosystem_state`, `atelier_documents`), Capacitor Android y 68+ pruebas de UNUmbral, idioma español y soporte completo de modo día/noche (`umbral-theme` + `?eco_theme=`).

## Direction contract

- **THESIS:** Un sistema operativo personal inspirado en mapas y leyendas de orientación deportiva (estándar ISOM) donde el terreno de las 4 apps se mantiene limpio y sobrio mientras un único **Púrpura de Curso** (`#7B2CBF` día / `#C084FC` noche) marca estrictamente tu acción activa, paso en curso y siguiente control; rechaza las paredes de tarjetas con sombras blandas, los rombos institucionales heredados y la fragmentación entre 3 estilos distintos.
- **OWN-WORLD:** Terreno blanco/papel mineral (`#FAFBF8` / `#FFFFFF` día; `#0F1311` / `#161D19` noche) con filetes nítidos de `1px` (`#D8DFD4` / `#2A352E`), radios contenidos (`6px–8px`), cero sombras difusas, leyenda cromática ISOM para los 4 dominios (Directorio púrpura `△`, Atelier ocre `#C89D3C`, UNUmbral oliva `#4D6B4A`, OMNI ARENA azul agua `#335C7D`, contorno marrón `#8C5A2B` en metadatos) y el **Púrpura de Curso** reservado a botones primarios, controles activos, foco y estado actual. Tipografía: `Archivo` + `Barlow Condensed` (display/números de control), `Source Sans 3` (cuerpo), `JetBrains Mono` (cifras tabulares) y `Literata` (solo modo lectura larga).
- **STORY:** Al abrir cualquier app del ecosistema el usuario reconoce al instante la misma barra superior con leyenda de 4 dominios, sabe exactamente qué control sigue hoy (Ruta 1→2→3 o próxima clase), navega sin fricción ni duplicados y trabaja horas en modo día o noche sin fatiga visual.
- **FIRST VIEWPORT:** Cabecera fija unificada de `56px` con marca `△ OMNI Ecosistema`, navegación de 4 dominios con swatch ISOM y estado activo púrpura, píldora de sincronización Supabase, selector Día/Noche y botón `SOS Calma`. Debajo en Directorio, retícula bipartita (`440px` columna izquierda de Curso Activo: Ruta de Hoy con 3 círculos de control numerados conectados por línea púrpura + tarjeta de próxima clase UNUmbral con borde `2px` púrpura + 3 KPIs tabulares; columna derecha de Terreno Completo con filtros por dominio, búsqueda rápida `⌘K` y catálogo de módulos limpios). En móvil colapsa a columna única con la Ruta Activa primero y barra compacta táctil.
- **FORM:** Curso ISOM (challenger elegido por el usuario: `notation-diagram-systems-orienteering-map`, boceto `.impeccable/mocks/decision/challenger-orienteering.html`), `seed:3cff66a9516ccfe7`.
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
