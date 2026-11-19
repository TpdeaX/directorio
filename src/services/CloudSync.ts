import type { EcosystemScope } from '../types.ts';

export interface CloudSyncConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  spaceCode: string;
  autoSync: boolean;
}

export interface RemoteScopeRow<T = unknown> {
  space_code: string;
  scope: EcosystemScope;
  payload: T;
  updated_at: number;
}

const CONFIG_KEY = 'atelier_cloud_sync_v1';

export const SUPABASE_SETUP_SQL = `-- =====================================================================
-- Ecosistema Atelier (Directorio + Atelier Diario + UNUmbral + OMNI ARENA)
-- Script idempotente para Supabase (Gratis)
-- Copia y pega este script completo en: Supabase -> SQL Editor -> Run
-- =====================================================================

create table if not exists public.atelier_documents (
  space_code text not null,
  id text not null,
  title text not null,
  kind text not null default 'notebook',
  paper text not null default 'dotted',
  page_count integer not null default 1,
  pages jsonb not null default '{}'::jsonb,
  pdf_storage_path text,
  updated_at bigint not null,
  primary key (space_code, id)
);

create table if not exists public.ecosystem_state (
  space_code text not null,
  scope text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at bigint not null,
  primary key (space_code, scope)
);

do $$
begin
  alter publication supabase_realtime add table public.atelier_documents;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ecosystem_state;
exception when duplicate_object then null;
end $$;

alter table public.atelier_documents enable row level security;
drop policy if exists "atelier_docs_select" on public.atelier_documents;
create policy "atelier_docs_select" on public.atelier_documents for select using (true);
drop policy if exists "atelier_docs_insert" on public.atelier_documents;
create policy "atelier_docs_insert" on public.atelier_documents for insert with check (char_length(space_code) >= 3);
drop policy if exists "atelier_docs_update" on public.atelier_documents;
create policy "atelier_docs_update" on public.atelier_documents for update using (char_length(space_code) >= 3);
drop policy if exists "atelier_docs_delete" on public.atelier_documents;
create policy "atelier_docs_delete" on public.atelier_documents for delete using (char_length(space_code) >= 3);

alter table public.ecosystem_state enable row level security;
drop policy if exists "eco_state_select" on public.ecosystem_state;
create policy "eco_state_select" on public.ecosystem_state for select using (true);
drop policy if exists "eco_state_insert" on public.ecosystem_state;
create policy "eco_state_insert" on public.ecosystem_state for insert with check (char_length(space_code) >= 3);
drop policy if exists "eco_state_update" on public.ecosystem_state;
create policy "eco_state_update" on public.ecosystem_state for update using (char_length(space_code) >= 3);
drop policy if exists "eco_state_delete" on public.ecosystem_state;
create policy "eco_state_delete" on public.ecosystem_state for delete using (char_length(space_code) >= 3);

insert into storage.buckets (id, name, public)
values ('atelier-pdfs', 'atelier-pdfs', true)
on conflict (id) do nothing;

drop policy if exists "atelier_pdfs_read" on storage.objects;
create policy "atelier_pdfs_read" on storage.objects for select using (bucket_id = 'atelier-pdfs');
drop policy if exists "atelier_pdfs_write" on storage.objects;
create policy "atelier_pdfs_write" on storage.objects for insert with check (bucket_id = 'atelier-pdfs');
drop policy if exists "atelier_pdfs_update" on storage.objects;
create policy "atelier_pdfs_update" on storage.objects for update using (bucket_id = 'atelier-pdfs');
drop policy if exists "atelier_pdfs_delete" on storage.objects;
create policy "atelier_pdfs_delete" on storage.objects for delete using (bucket_id = 'atelier-pdfs');`;

export function normalizeSupabaseUrl(input: string): string {
  const raw = input.trim().replace(/\/+$/, '');
  const dash = raw.match(/supabase\.com\/dashboard\/project\/([a-z0-9]{15,})/i);
  if (dash) return `https://${dash[1].toLowerCase()}.supabase.co`;
  if (/^[a-z0-9]{15,}$/i.test(raw)) return `https://${raw.toLowerCase()}.supabase.co`;
  const api = raw.match(/^(https:\/\/[a-z0-9-]+\.supabase\.co)/i);
  if (api) return api[1].toLowerCase();
  return raw;
}

class DirectorioCloudSync {
  private config: CloudSyncConfig;
  public lastSyncedAt = 0;
  public lastError = '';
  private listeners = new Set<() => void>();

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): CloudSyncConfig {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CloudSyncConfig>;
        return {
          supabaseUrl: normalizeSupabaseUrl(parsed.supabaseUrl ?? ''),
          supabaseAnonKey: (parsed.supabaseAnonKey ?? '').trim(),
          spaceCode: (parsed.spaceCode || 'mi-espacio').trim().toLowerCase(),
          autoSync: parsed.autoSync ?? true,
        };
      }
    } catch {
      // Ignore storage error
    }
    return {
      supabaseUrl: '',
      supabaseAnonKey: '',
      spaceCode: 'mi-espacio',
      autoSync: true,
    };
  }

  public getConfig(): CloudSyncConfig {
    this.config = this.loadConfig();
    return { ...this.config };
  }

  public isConfigured(): boolean {
    const cfg = this.getConfig();
    return Boolean(
      cfg.supabaseUrl.startsWith('https://') &&
        cfg.supabaseAnonKey.length > 20 &&
        cfg.spaceCode.length >= 3
    );
  }

  public saveConfig(next: CloudSyncConfig): void {
    this.config = {
      supabaseUrl: normalizeSupabaseUrl(next.supabaseUrl),
      supabaseAnonKey: next.supabaseAnonKey.trim(),
      spaceCode: next.spaceCode.trim().toLowerCase() || 'mi-espacio',
      autoSync: next.autoSync,
    };
    this.lastError = '';
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
    } catch {
      // Ignore storage error
    }
    this.notify();
  }

  public exportConfigToken(): string {
    return JSON.stringify(this.getConfig());
  }

  public importConfigToken(raw: string): boolean {
    try {
      const parsed = JSON.parse(raw.trim()) as Partial<CloudSyncConfig>;
      if (!parsed.supabaseUrl || !parsed.supabaseAnonKey) return false;
      this.saveConfig({
        supabaseUrl: parsed.supabaseUrl,
        supabaseAnonKey: parsed.supabaseAnonKey,
        spaceCode: parsed.spaceCode || 'mi-espacio',
        autoSync: parsed.autoSync ?? true,
      });
      return true;
    } catch {
      return false;
    }
  }

  public onStatusChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      apikey: this.config.supabaseAnonKey,
      Authorization: `Bearer ${this.config.supabaseAnonKey}`,
    };
  }

  public async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { ok: false, message: 'Completa URL, Anon Key y código de espacio.' };
    }
    try {
      const url = `${this.config.supabaseUrl}/rest/v1/ecosystem_state?select=scope&limit=1`;
      const res = await fetch(url, { headers: this.headers() });
      if (res.status === 404 || res.status === 400) {
        this.lastError = 'Falta ejecutar supabase_setup.sql';
        this.notify();
        return {
          ok: false,
          message: 'Falta ejecutar el SQL actualizado en Supabase (no existe la tabla ecosystem_state).',
        };
      }
      if (!res.ok) {
        this.lastError = `HTTP ${res.status}`;
        this.notify();
        return { ok: false, message: `Error de conexión (${res.status}). Verifica URL y Anon Key.` };
      }
      this.lastError = '';
      this.lastSyncedAt = Date.now();
      this.notify();
      return {
        ok: true,
        message: `Conexión verificada en el espacio «${this.config.spaceCode}».`,
      };
    } catch {
      this.lastError = 'Sin red';
      this.notify();
      return { ok: false, message: 'No se pudo conectar con Supabase.' };
    }
  }

  public async pushScope<T>(scope: EcosystemScope, payload: T, updatedAt?: number): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const ts = updatedAt || Date.now();
    try {
      const res = await fetch(
        `${this.config.supabaseUrl}/rest/v1/ecosystem_state?on_conflict=space_code,scope`,
        {
          method: 'POST',
          headers: {
            ...this.headers(),
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify({
            space_code: this.config.spaceCode,
            scope,
            payload,
            updated_at: ts,
          }),
        }
      );
      if (!res.ok) {
        this.lastError = `HTTP ${res.status}`;
        this.notify();
        return false;
      }
      this.lastSyncedAt = Date.now();
      this.lastError = '';
      this.notify();
      return true;
    } catch {
      this.lastError = 'Sin red';
      this.notify();
      return false;
    }
  }

  public async pullAllScopes(): Promise<Partial<Record<EcosystemScope, RemoteScopeRow>>> {
    if (!this.isConfigured()) return {};
    try {
      const url = `${this.config.supabaseUrl}/rest/v1/ecosystem_state?space_code=eq.${encodeURIComponent(
        this.config.spaceCode
      )}&select=space_code,scope,payload,updated_at`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) return {};
      const rows = (await res.json()) as RemoteScopeRow[];
      const map: Partial<Record<EcosystemScope, RemoteScopeRow>> = {};
      rows.forEach((row) => {
        map[row.scope] = row;
      });
      this.lastSyncedAt = Date.now();
      this.lastError = '';
      this.notify();
      return map;
    } catch {
      return {};
    }
  }

  public async pullDocsCount(): Promise<number | null> {
    if (!this.isConfigured()) return null;
    try {
      const url = `${this.config.supabaseUrl}/rest/v1/atelier_documents?space_code=eq.${encodeURIComponent(
        this.config.spaceCode
      )}&select=id`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) return null;
      const rows = (await res.json()) as { id: string }[];
      return Array.isArray(rows) ? rows.length : null;
    } catch {
      return null;
    }
  }

  public async pullAllRawDocuments(): Promise<unknown[]> {
    if (!this.isConfigured()) return [];
    try {
      const url = `${this.config.supabaseUrl}/rest/v1/atelier_documents?space_code=eq.${encodeURIComponent(
        this.config.spaceCode
      )}&select=*`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) return [];
      const rows = (await res.json()) as unknown[];
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }
}

export const cloudSync = new DirectorioCloudSync();
