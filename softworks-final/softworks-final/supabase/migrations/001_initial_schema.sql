-- =========================================================
-- Softworks Brief Assistant — Initial Schema
-- Member 2 & 3 work: DB tables, RLS, storage buckets, indexes
-- =========================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- TABLE: briefs
-- Core record created when a user submits a request
-- ─────────────────────────────────────────────
create table if not exists public.briefs (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Submitter info (no account required)
  submitter_name    text not null,
  submitter_email   text not null,
  submitter_phone   text,

  -- Raw input
  raw_text          text,                          -- typed brief text

  -- AI-structured output (populated by Gemini after processing)
  structured_brief  jsonb,                         -- full AI output object
  project_title     text,
  goals             text[],
  ambiguities       text[],
  department        text,                          -- e.g. "design", "dev", "marketing"
  priority          text default 'normal',         -- low | normal | high | urgent
  deadline          date,

  -- Status flow
  status            text not null default 'pending_ai',
  -- pending_ai → ai_processed → pending_approval → approved → rejected → sent_to_dept

  -- Manager approval
  manager_notes     text,
  approved_by       text,                          -- manager name/email
  approved_at       timestamptz,

  -- Share token (for /share/[token] public link)
  share_token       text unique default encode(gen_random_bytes(24), 'base64url'),
  share_token_expires_at timestamptz default (now() + interval '30 days'),

  -- PDF export path in storage
  pdf_path          text
);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger briefs_updated_at
  before update on public.briefs
  for each row execute procedure public.set_updated_at();

-- ─────────────────────────────────────────────
-- TABLE: brief_assets
-- Audio / image / file attachments linked to a brief
-- ─────────────────────────────────────────────
create table if not exists public.brief_assets (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  brief_id    uuid not null references public.briefs(id) on delete cascade,
  file_name   text not null,
  file_type   text not null,          -- MIME type
  file_size   bigint,                 -- bytes
  storage_path text not null,         -- path inside the "brief-assets" bucket
  asset_type  text not null           -- 'image' | 'audio' | 'document'
);

-- ─────────────────────────────────────────────
-- TABLE: email_log
-- Track every email sent (Resend)
-- ─────────────────────────────────────────────
create table if not exists public.email_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  brief_id    uuid references public.briefs(id) on delete set null,
  recipient   text not null,
  subject     text not null,
  type        text not null,   -- 'manager_notification' | 'submitter_confirmation' | 'dept_routing'
  resend_id   text,            -- ID returned by Resend API
  status      text default 'sent'
);

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
create index if not exists briefs_status_idx        on public.briefs(status);
create index if not exists briefs_department_idx    on public.briefs(department);
create index if not exists briefs_share_token_idx   on public.briefs(share_token);
create index if not exists briefs_submitter_email   on public.briefs(submitter_email);
create index if not exists brief_assets_brief_id    on public.brief_assets(brief_id);
create index if not exists email_log_brief_id       on public.email_log(brief_id);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Enable RLS but allow service-role (server-side) full access
-- ─────────────────────────────────────────────
alter table public.briefs       enable row level security;
alter table public.brief_assets enable row level security;
alter table public.email_log    enable row level security;

-- Public read via share token (used by /share/[token] page — anon key)
create policy "Read brief by share token"
  on public.briefs for select
  using (share_token = current_setting('request.jwt.claims', true)::jsonb->>'share_token'
         or auth.role() = 'service_role');

-- Service role can do everything
create policy "Service role full access briefs"
  on public.briefs for all
  using (auth.role() = 'service_role');

create policy "Service role full access assets"
  on public.brief_assets for all
  using (auth.role() = 'service_role');

create policy "Service role full access email_log"
  on public.email_log for all
  using (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- STORAGE BUCKETS
-- Run these in the Supabase dashboard SQL editor or via the API
-- ─────────────────────────────────────────────
-- Storage bucket for brief attachments (images, audio, docs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brief-assets',
  'brief-assets',
  false,
  52428800,  -- 50 MB limit
  array[
    'image/jpeg','image/png','image/gif','image/webp',
    'audio/mpeg','audio/wav','audio/ogg','audio/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do nothing;

-- Storage bucket for generated PDFs
insert into storage.buckets (id, name, public, file_size_limit)
values ('brief-pdfs', 'brief-pdfs', false, 10485760)
on conflict (id) do nothing;

-- Storage policies: service role can do anything
create policy "Service role assets"
  on storage.objects for all
  using (bucket_id in ('brief-assets','brief-pdfs') and auth.role() = 'service_role');

-- Anon can upload to brief-assets (submitter form, no account)
create policy "Anon upload brief assets"
  on storage.objects for insert
  with check (bucket_id = 'brief-assets');
