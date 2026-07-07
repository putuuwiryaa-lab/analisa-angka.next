-- Store the latest 4D result separately so the homepage does not need to read long history_data.

alter table public.markets
  add column if not exists last_result text;

alter table public.markets
  add constraint markets_last_result_format
  check (last_result is null or last_result ~ '^\d{4}$')
  not valid;

create or replace function public.extract_latest_4d_result(history_text text)
returns text
language sql
stable
as $$
  select token
  from regexp_split_to_table(coalesce(history_text, ''), E'[\\s\\n\\r\\t,;|]+') with ordinality as t(token, ord)
  where token ~ '^\d{4}$'
  order by ord desc
  limit 1;
$$;

update public.markets
set last_result = public.extract_latest_4d_result(history_data)
where last_result is null
  and public.extract_latest_4d_result(history_data) is not null;

create or replace function public.set_market_last_result()
returns trigger
language plpgsql
as $$
declare
  latest_result text;
begin
  latest_result := public.extract_latest_4d_result(new.history_data);

  if latest_result is not null then
    new.last_result := latest_result;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_markets_set_last_result on public.markets;

create trigger trg_markets_set_last_result
before insert or update of history_data on public.markets
for each row
execute function public.set_market_last_result();
