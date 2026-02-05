-- BASECAMP_2026_02_06.sql
-- Supabase SQL Editor에서 실행했던 “FTS + 인덱스” 베이스캠프 스냅샷

-- 1) FTS tsvector 컬럼
alter table public.tenders
add column if not exists search_tsv tsvector;

-- 2) 자동 갱신 함수/트리거
create or replace function public.tenders_search_tsv_update()
returns trigger
language plpgsql
as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(new.bid_no, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.agency, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(new.demand_org, '')), 'C');
  return new;
end;
$$;

drop trigger if exists tenders_search_tsv_trg on public.tenders;

create trigger tenders_search_tsv_trg
before insert or update of bid_no, title, agency, demand_org
on public.tenders
for each row
execute function public.tenders_search_tsv_update();

-- 3) 기존 데이터 backfill
update public.tenders
set search_tsv =
  setweight(to_tsvector('simple', coalesce(bid_no, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(title, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(agency, '')), 'C') ||
  setweight(to_tsvector('simple', coalesce(demand_org, '')), 'C')
where search_tsv is null;

-- 4) 성능 인덱스들 (이미 있다면 skip)
create index if not exists tenders_search_tsv_gin
on public.tenders
using gin (search_tsv);

-- 커서 페이지네이션 정렬키(announced_at desc, bid_no desc)
create index if not exists tenders_announced_bidno_idx
on public.tenders (announced_at desc, bid_no desc);

-- 기본 화면 필터(source + announced_at desc)
create index if not exists tenders_source_announced_at_desc_idx
on public.tenders (source, announced_at desc);

-- source + scope + announced_at desc
create index if not exists tenders_source_scope_announced_at_desc_idx
on public.tenders (source, scope, announced_at desc);
