-- === Core tables ===

create table if not exists projects (
  id text primary key,
  title text not null,
  summary text,
  area text,
  category text,
  tags text[] default '{}',
  analyst_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists project_watch_rules (
  project_id text primary key references projects(id) on delete cascade,
  owner_agency text not null default '경기도 고양시',
  keywords text[] not null default '{}',
  exclude_keywords text[] not null default '{}',
  min_score int not null default 60,
  updated_at timestamptz default now()
);

-- 조달/입찰/계약 원천 데이터(정규화)
create table if not exists g2b_records (
  record_id text primary key,            -- 공고번호/사업번호 등(없으면 합성키)
  record_type text not null default 'BID_OR_CONTRACT',
  title text not null,
  agency text,                           -- 공고기관/기관명
  demand_agency text,                    -- 수요기관
  posted_date date,
  close_date date,
  status text,
  amount numeric,                        -- 계약금액/추정금액(있는 경우)
  source_tag text not null,
  raw jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_g2b_records_agency_date on g2b_records(agency, posted_date desc);
create index if not exists idx_g2b_records_title on g2b_records using gin (to_tsvector('simple', coalesce(title,'')));

-- 프로젝트 ↔ 조달기록 매칭(자동 후보 + 확정)
create table if not exists project_matches (
  project_id text references projects(id) on delete cascade,
  record_id text references g2b_records(record_id) on delete cascade,
  score int not null,
  reasons text[] not null default '{}',   -- 왜 매칭되었는지(설명가능성)
  is_confirmed boolean not null default false, -- 사람이 확정하면 true
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (project_id, record_id)
);

create index if not exists idx_project_matches_project on project_matches(project_id, score desc);

-- 시민 화면에 보여주는 "근거 카드"
create type evidence_type as enum ('PRESS', 'BUDGET', 'BID', 'PROGRESS', 'DONE');

create table if not exists evidences (
  id bigserial primary key,
  project_id text references projects(id) on delete cascade,
  type evidence_type not null,
  title text not null,
  date text not null,                    -- YYYY-MM or YYYY-MM-DD (표시용)
  url text not null,
  note text,
  source_record_id text,                 -- g2b_records.record_id (연결되면)
  created_at timestamptz default now()
);

create index if not exists idx_evidences_project on evidences(project_id, type);

-- updated_at 자동 갱신(간단 트리거)
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_touch on projects;
create trigger trg_projects_touch before update on projects
for each row execute function touch_updated_at();

drop trigger if exists trg_g2b_touch on g2b_records;
create trigger trg_g2b_touch before update on g2b_records
for each row execute function touch_updated_at();

drop trigger if exists trg_matches_touch on project_matches;
create trigger trg_matches_touch before update on project_matches
for each row execute function touch_updated_at();

