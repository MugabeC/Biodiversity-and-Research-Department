-- Long eBird history load that runs on its own (migration "ebird_backfill").
-- The row holds the next day to read; the job below calls species-sync every 5 minutes until the range is done.
create table if not exists public.ebird_backfill (
  id int primary key default 1 check (id = 1),
  next_day date,
  to_day date,
  active boolean not null default false,
  records int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.ebird_backfill enable row level security;
revoke all on public.ebird_backfill from anon, authenticated;

select cron.schedule('ebird-backfill', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://dakgnvnaqiosizouuciy.supabase.co/functions/v1/species-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_oQDiC7Y224MSpc2ip23KGg_jjwjMlG9'),
    body := '{"continue": true}'::jsonb)
  where exists (select 1 from public.ebird_backfill where active)
$$);

-- To start a load: insert into public.ebird_backfill (id, next_day, to_day, active) values (1, '2020-01-01', '2025-11-23', true)
--   on conflict (id) do update set next_day = excluded.next_day, to_day = excluded.to_day, active = true, records = 0;
