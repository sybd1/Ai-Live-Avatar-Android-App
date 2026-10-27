create table if not exists program_documents (
  program_id uuid primary key,
  version_id uuid not null,
  document jsonb not null,
  imported_at timestamptz not null default now()
);
create table if not exists program_versions (
  version_id uuid primary key,
  program_id uuid not null,
  document jsonb not null,
  imported_at timestamptz not null default now()
);
create table if not exists ai_usage_counters (
  period_key text primary key,
  used bigint not null default 0
);
