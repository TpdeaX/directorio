# Directorio del Ecosistema — Integración SOS Pánico, Dibujo y Contadores Actualizados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar en `directorio` la tarjeta del nuevo **Taller de Dibujo** (`mod-drawing`), un acceso rápido visible de **SOS Pánico** hacia Atelier (`#calm?sos=1`), actualizar los contadores fallback de OMNI ARENA (`33 disciplinas · 15 academias`) y de Canto (`15 canciones`), y refrescar el Service Worker.

**Architecture:** Cambios mínimos y fieles al diseño institucional actual (`dir-shell`, `dir-diamond`, tokens day/night), conservando el contrato compartido de `localStorage` (`umbral-theme`, `omni_arena_catalog_meta_v1`, `atelier_diario_profile_v1`, `atelier_directory_config_v1`) y sincronización Supabase.

**Tech Stack:** TypeScript 7, Vite 8, Node 22 native test runner (`node --test`).

**Spec:** `C:\Users\Joseph\.gemini\antigravity\scratch\omni-arena\docs\superpowers\specs\2026-11-19-aprendizaje-total-ecosistema-design.md` (Sección 4 Bloque F)

## Global Constraints

- Identidad Git personal obligatoria: `TpdeaX <personaljosephunu@gmail.com>` en rama `main` (sin `git push` salvo instrucción explícita).
- Cero emojis y cero glifos pictográficos en UI (`\p{Extended_Pictographic}` vacío en `src/`); únicamente SVG de un trazo (`stroke="currentColor"`, `stroke-width="1.9"`/`"2"`, `fill="none"`).
- Puerto dev estricto `5178`; incrementar `CACHE_NAME` en `public/sw.js` de `directorio-ecosistema-v4` a `directorio-ecosistema-v5`.

## Review Focus

- **Orden personalizado existente en Supabase (`normalizeConfig`):** si el usuario ya personalizó el orden del directorio antes de existir `mod-drawing`, `normalizeConfig` fusiona `DEFAULT_DIRECTORY_ORDER` con `incomingOrder`, asegurando que `mod-drawing` aparezca disponible sin borrar el orden guardado del usuario.
- **Resolución de `#calm?sos=1` en `resolveEcosystemAppUrl`:** `resolveEcoUrl('atelier', { hash: 'calm?sos=1' })` debe conservar `?eco_theme=light|dark` antes del `#` (ej. `http://localhost:5176/?eco_theme=dark#calm?sos=1`) para no perder la sincronización de tema al saltar de puerto.

---

### Task 1: Añadir `mod-drawing`, Acceso Rápido `SOS Pánico` y Contadores Actualizados (`directorio`)

**Files:**
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\directorio\src\icons.ts`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\directorio\src\state\DirectoryStore.ts`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\directorio\src\main.ts`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\directorio\src\style.css`
- Modify: `C:\Users\Joseph\.gemini\antigravity\scratch\directorio\public\sw.js`
- Test: `C:\Users\Joseph\.gemini\antigravity\scratch\directorio\tests\directorio-meta.test.ts` *(create)*

**Interfaces:**
- Produces:
  - `Icons.palette`, `Icons.heartPulse`
  - `DEFAULT_DIRECTORY_ORDER` incluye `'mod-drawing'` tras `'mod-calligraphy'`
  - `DEFAULT_ARENA_META = { version: 1, total: 33, academies: 15, dexterity2d: 13, action3d: 5, updatedAt: 0 }`
  - `resolveEcosystemAppUrl('atelier', 'calm?sos=1')` mantiene `?eco_theme=...` antes de `#calm?sos=1`

- [ ] **Step 1: Write the failing test `tests/directorio-meta.test.ts`**

Assert:
1. `DEFAULT_DIRECTORY_ORDER` contains `'mod-drawing'` after `'mod-calligraphy'`.
2. `readArenaCatalogMeta()` fallback returns `total === 33` and `academies === 15`.
3. `resolveEcosystemAppUrl('atelier', 'calm?sos=1')` places `?eco_theme=` before `#calm?sos=1` (never inside the hash).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Users\Joseph\.gemini\antigravity\scratch\directorio && node --test tests/directorio-meta.test.ts`
Expected: FAIL (`mod-drawing` missing, fallback is `26 / 8`).

- [ ] **Step 3: Implement `icons.ts`, `DirectoryStore.ts`, `main.ts`, `style.css` and `public/sw.js`**

1. In `src/icons.ts`: add `palette` and `heartPulse` single-stroke SVGs.
2. In `src/state/DirectoryStore.ts`: add `'mod-drawing'` to `DEFAULT_DIRECTORY_ORDER` after `'mod-calligraphy'`, update `DEFAULT_ARENA_META` to `{ total: 33, academies: 15, dexterity2d: 13, action3d: 5 }`, and fix `buildCompanionSummary` default `atelierTotalModules` to `10`.
3. In `src/main.ts` & `src/style.css`:
   - Add built-in tile `mod-drawing` (`Taller de Dibujo`, `#B45309`, `resolveEcosystemAppUrl('atelier', 'drawing')`, metric `'20 láminas guiadas y lienzo'`).
   - Update `mod-singing` metric to `'Canto, 15 canciones, piano y oído'` and `mod-calm` metric to `'SOS Pánico, 5-4-3-2-1 y respiración'`.
   - Add crisp **`SOS Pánico`** quick-action link button in `.dir-topbar-actions` pointing to `resolveEcosystemAppUrl('atelier', 'calm?sos=1')`.
4. Bump `CACHE_NAME` in `public/sw.js` to `'directorio-ecosistema-v5'`.

- [ ] **Step 4: Run tests, typecheck, and build**

```powershell
cd C:\Users\Joseph\.gemini\antigravity\scratch\directorio
npx tsc --noEmit
node --test tests/*.test.ts
npm run build
```
Expected: 0 errors, tests pass, build succeeds, zero emojis in `src/`.

- [ ] **Step 5: Commit `directorio` changes**

```powershell
cd C:\Users\Joseph\.gemini\antigravity\scratch\directorio
git -c user.name="TpdeaX" -c user.email="personaljosephunu@gmail.com" add -A
git -c user.name="TpdeaX" -c user.email="personaljosephunu@gmail.com" commit -m "feat: acceso SOS panico, taller de dibujo y metricas actualizadas"
```
