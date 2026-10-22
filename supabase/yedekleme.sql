-- SATIŞ TAKİP otomatik yedekleme
-- Supabase paneli > SQL Editor'e yapıştırıp bir kez çalıştırın. Tekrar çalıştırmak zararsızdır.
-- Önce supabase/kurulum.sql ve supabase/giderler.sql çalıştırılmış olmalı.
--
-- Ne yapar: her gece 05:00'te (Türkiye saati) tüm firma, fiyat, satış, tahsilat ve gider kayıtlarının
-- bir kopyasını st_backups tablosuna yazar. Son 35 günün günlük yedekleri ile her ayın ilk günü
-- alınan yedekler saklanır. Yedekler sitedeki Yedek sekmesinden görülür, indirilir, geri yüklenir.
-- Not: Bu yedekler aynı Supabase projesinin içindedir. Projenin kendisi silinirse onlar da gider;
-- bu yüzden ayda bir Yedek sekmesinden bir kopyayı bilgisayarınıza da indirin.

-- 1) Yedek tablosu --------------------------------------------------------------
create table if not exists public.st_backups (
  id bigint generated always as identity primary key,
  taken_at timestamptz not null default now(),
  kind text not null check (kind in ('otomatik','elle','oncesi')),
  note text not null default '',
  counts jsonb not null default '{}'::jsonb,
  payload jsonb not null
);
create index if not exists st_backups_taken_idx on public.st_backups (taken_at desc);

alter table public.st_backups enable row level security;
revoke all on public.st_backups from anon, authenticated;
grant select on public.st_backups to authenticated;
drop policy if exists st_yedek_oku on public.st_backups;
create policy st_yedek_oku on public.st_backups for select to authenticated
  using (public.st_role() in ('owner','admin'));

-- 2) Yedek alan fonksiyon (yalnızca sunucu tarafı; doğrudan çağrılamaz) ---------------
create or replace function public.st_take_snapshot(p_kind text, p_note text) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_payload jsonb;
  v_id bigint;
begin
  v_payload := jsonb_build_object(
    'firms',    (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'phone', phone) order by name), '[]'::jsonb) from public.st_firms),
    'menus',    (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]'::jsonb) from public.st_menus),
    'prices',   (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'firm', firm_id, 'menu', menu_id, 'price', price)), '[]'::jsonb) from public.st_prices),
    'sales',    (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'date', date, 'firm', firm_id, 'menu', menu_id, 'qty', qty, 'price', price, 'paid', paid, 'by', by_name) order by date, created_at), '[]'::jsonb) from public.st_sales),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'date', date, 'firm', firm_id, 'amount', amount, 'method', method, 'note', note, 'by', by_name) order by date, created_at), '[]'::jsonb) from public.st_payments),
    'suppliers', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'phone', phone) order by name), '[]'::jsonb) from public.st_suppliers),
    'expenses', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'date', date, 'supplier', supplier_id, 'category', category, 'desc', description, 'amount', amount, 'by', by_name) order by date, created_at), '[]'::jsonb) from public.st_expenses),
    'supplierPayments', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'date', date, 'supplier', supplier_id, 'amount', amount, 'method', method, 'note', note, 'by', by_name) order by date, created_at), '[]'::jsonb) from public.st_supplier_payments),
    'migratedV2', true
  );

  insert into public.st_backups (kind, note, counts, payload)
  values (
    p_kind, p_note,
    jsonb_build_object(
      'firms', jsonb_array_length(v_payload->'firms'),
      'sales', jsonb_array_length(v_payload->'sales'),
      'payments', jsonb_array_length(v_payload->'payments'),
      'expenses', jsonb_array_length(v_payload->'expenses'),
      'supplierPayments', jsonb_array_length(v_payload->'supplierPayments')),
    v_payload)
  returning id into v_id;

  -- Saklama: otomatik yedekler 35 gün (her ayın ilk günü kalıcı), elle ve öncesi yedekleri son 30 adet
  delete from public.st_backups
   where kind = 'otomatik'
     and taken_at < now() - interval '35 days'
     and extract(day from (taken_at at time zone 'Europe/Istanbul')) <> 1;
  delete from public.st_backups
   where kind in ('elle','oncesi')
     and id not in (select id from public.st_backups where kind in ('elle','oncesi') order by taken_at desc limit 30);

  return v_id;
end $$;
revoke all on function public.st_take_snapshot(text, text) from public, anon, authenticated;

-- 3) Sitenin çağırdığı "şimdi yedekle" (yalnızca ana hesap ve yönetici) --------------
create or replace function public.st_backup_now(p_kind text default 'elle', p_note text default '') returns bigint
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.st_role(), '') not in ('owner','admin') then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if p_kind not in ('elle','oncesi') then p_kind := 'elle'; end if;
  return public.st_take_snapshot(p_kind, left(coalesce(p_note, ''), 200));
end $$;
revoke all on function public.st_backup_now(text, text) from public, anon;
grant execute on function public.st_backup_now(text, text) to authenticated;

-- 4) Her gece 02:00 UTC (= 05:00 Türkiye) zamanlayıcısı -----------------------------
do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron açılamadı (%). Supabase panelinde Database > Extensions > pg_cron seçeneğini açıp bu dosyayı yeniden çalıştırın.', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'st-gunluk-yedek';
    perform cron.schedule('st-gunluk-yedek', '0 2 * * *', 'select public.st_take_snapshot(''otomatik'', '''')');
  end if;
end $$;

-- 5) İlk yedeği hemen alın ve zamanlayıcıyı kontrol edin -------------------------------
select public.st_take_snapshot('otomatik', 'kurulum') as ilk_yedek_no;
-- Zamanlayıcı kuruldu mu? Aşağıdaki sorgu bir satır (pg_cron) döndürmelidir. Boşsa Database > Extensions'tan pg_cron'u açıp dosyayı yeniden çalıştırın.
select extname as zamanlayici from pg_extension where extname = 'pg_cron';
