-- SATIŞ TAKİP veritabanı kurulumu
-- Supabase paneli > SQL Editor'e yapıştırıp bir kez çalıştırın. Tekrar çalıştırmak zararsızdır.

-- 1) Tablolar ---------------------------------------------------------------
create table if not exists public.st_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,30}$'),
  name text not null,
  role text not null check (role in ('owner','admin','entry','view')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.st_firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists st_firms_name_uq on public.st_firms (lower(name));

create table if not exists public.st_menus (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.st_prices (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.st_firms(id) on delete cascade,
  menu_id uuid not null references public.st_menus(id) on delete cascade,
  price numeric(12,2) not null check (price >= 0),
  unique (firm_id, menu_id)
);

create table if not exists public.st_sales (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  firm_id uuid not null references public.st_firms(id) on delete restrict,
  menu_id uuid not null references public.st_menus(id) on delete restrict,
  qty integer not null check (qty > 0),
  price numeric(12,2) not null check (price >= 0),
  paid numeric(12,2) not null default 0,
  by_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists st_sales_date_idx on public.st_sales (date);
create index if not exists st_sales_firm_idx on public.st_sales (firm_id);

create table if not exists public.st_payments (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  firm_id uuid not null references public.st_firms(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  method text not null default '',
  note text not null default '',
  by_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists st_payments_firm_idx on public.st_payments (firm_id);

create table if not exists public.st_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb
);

-- 2) Yetki yardımcısı: giriş yapan kişinin rolü (hesabı kapalıysa boş döner) -----
create or replace function public.st_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.st_profiles where id = auth.uid() and active
$$;
revoke all on function public.st_role() from public, anon;
grant execute on function public.st_role() to authenticated;

-- 3) Satır düzeyi güvenlik (RLS) ----------------------------------------------
alter table public.st_profiles enable row level security;
alter table public.st_firms    enable row level security;
alter table public.st_menus    enable row level security;
alter table public.st_prices   enable row level security;
alter table public.st_sales    enable row level security;
alter table public.st_payments enable row level security;
alter table public.st_settings enable row level security;

revoke all on public.st_profiles, public.st_firms, public.st_menus, public.st_prices,
              public.st_sales, public.st_payments, public.st_settings from anon;
grant select, insert, update, delete on public.st_profiles, public.st_firms, public.st_menus,
  public.st_prices, public.st_sales, public.st_payments, public.st_settings to authenticated;

-- Okuma: hesabı açık her kullanıcı tüm kayıtları görür
do $$
declare t text;
begin
  foreach t in array array['st_firms','st_menus','st_prices','st_sales','st_payments','st_settings'] loop
    execute format('drop policy if exists st_oku on public.%I', t);
    execute format('create policy st_oku on public.%I for select to authenticated using (public.st_role() is not null)', t);
  end loop;
  -- Firma, menü, fiyat ve ayarlar: yalnızca ana hesap ve yöneticiler değiştirir
  foreach t in array array['st_firms','st_menus','st_prices','st_settings'] loop
    execute format('drop policy if exists st_yaz on public.%I', t);
    execute format('create policy st_yaz on public.%I for all to authenticated using (public.st_role() in (''owner'',''admin'')) with check (public.st_role() in (''owner'',''admin''))', t);
  end loop;
  -- Satış ve tahsilat: giriş yetkilisi de ekler ve düzenler, silmeyi yalnızca yönetici yapar
  foreach t in array array['st_sales','st_payments'] loop
    execute format('drop policy if exists st_ekle on public.%I', t);
    execute format('drop policy if exists st_duzenle on public.%I', t);
    execute format('drop policy if exists st_sil on public.%I', t);
    execute format('create policy st_ekle on public.%I for insert to authenticated with check (public.st_role() in (''owner'',''admin'',''entry''))', t);
    execute format('create policy st_duzenle on public.%I for update to authenticated using (public.st_role() in (''owner'',''admin'',''entry'')) with check (public.st_role() in (''owner'',''admin'',''entry''))', t);
    execute format('create policy st_sil on public.%I for delete to authenticated using (public.st_role() in (''owner'',''admin''))', t);
  end loop;
end $$;

-- Kullanıcı profilleri: herkes kendi satırını, ana hesap hepsini görür; yalnızca ana hesap yazar
drop policy if exists st_profil_oku on public.st_profiles;
drop policy if exists st_profil_yaz on public.st_profiles;
create policy st_profil_oku on public.st_profiles for select to authenticated
  using (id = auth.uid() or public.st_role() = 'owner');
create policy st_profil_yaz on public.st_profiles for all to authenticated
  using (public.st_role() = 'owner') with check (public.st_role() = 'owner');

-- 4) Ana hesabın şifre sıfırlama ve kullanıcı silme işlemleri --------------------
create or replace function public.st_set_password(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if public.st_role() is distinct from 'owner' then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Şifre en az 6 karakter olmalı';
  end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now()
   where id = p_user;
end $$;

create or replace function public.st_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if public.st_role() is distinct from 'owner' then
    raise exception 'yetkisiz' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'Kendi hesabınızı silemezsiniz';
  end if;
  delete from auth.users where id = p_user;
end $$;

revoke all on function public.st_set_password(uuid, text), public.st_delete_user(uuid) from public, anon;
grant execute on function public.st_set_password(uuid, text), public.st_delete_user(uuid) to authenticated;

-- 5) Anlık güncelleme (bir kişi kayıt girince diğerlerinin ekranı kendiliğinden yenilenir)
do $$
declare t text;
begin
  foreach t in array array['st_firms','st_menus','st_prices','st_sales','st_payments','st_settings','st_profiles'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- 6) ANA HESABI BAĞLAYIN (kurulumun son adımı) --------------------------------------
-- Önce Authentication > Users > Add user ile ana hesabı açın (e-posta = config.js'deki şablonun
-- karşılığı, "Auto Confirm User" işaretli). Sonra aşağıdaki satırı kendi bilgilerinizle çalıştırın:
--
-- insert into public.st_profiles (id, username, name, role)
-- select id, 'ana', 'Ana hesap', 'owner' from auth.users where email = 'adiniz+ana@gmail.com';
