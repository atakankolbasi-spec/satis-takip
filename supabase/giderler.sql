-- SATIŞ TAKİP gider modülü: nakit giderler ve firma (tedarikçi) giderleri
-- Supabase paneli > SQL Editor'e yapıştırıp bir kez çalıştırın. Tekrar çalıştırmak zararsızdır.
-- Önce supabase/kurulum.sql çalıştırılmış olmalı.

create table if not exists public.st_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists st_suppliers_name_uq on public.st_suppliers (lower(name));

-- kind = 'nakit': kasadan yapılan nakit harcama. kind = 'firma': bir tedarikçi firmanın faturası / alacağı.
create table if not exists public.st_expenses (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('nakit','firma')),
  date date not null,
  supplier_id uuid references public.st_suppliers(id) on delete restrict,
  category text not null default '',
  description text not null default '',
  amount numeric(12,2) not null check (amount > 0),
  by_name text not null default '',
  created_at timestamptz not null default now(),
  check ((kind = 'firma') = (supplier_id is not null))
);
create index if not exists st_expenses_date_idx on public.st_expenses (date);
create index if not exists st_expenses_supplier_idx on public.st_expenses (supplier_id);

create table if not exists public.st_supplier_payments (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  supplier_id uuid not null references public.st_suppliers(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  method text not null default '',
  note text not null default '',
  by_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists st_supplier_payments_supplier_idx on public.st_supplier_payments (supplier_id);

alter table public.st_suppliers         enable row level security;
alter table public.st_expenses          enable row level security;
alter table public.st_supplier_payments enable row level security;

revoke all on public.st_suppliers, public.st_expenses, public.st_supplier_payments from anon;
grant select, insert, update, delete on public.st_suppliers, public.st_expenses, public.st_supplier_payments to authenticated;

do $$
declare t text;
begin
  -- Okuma: hesabı açık herkes
  foreach t in array array['st_suppliers','st_expenses','st_supplier_payments'] loop
    execute format('drop policy if exists st_oku on public.%I', t);
    execute format('create policy st_oku on public.%I for select to authenticated using (public.st_role() is not null)', t);
  end loop;
  -- Tedarikçi listesi: yalnızca ana hesap ve yöneticiler
  execute 'drop policy if exists st_yaz on public.st_suppliers';
  execute 'create policy st_yaz on public.st_suppliers for all to authenticated using (public.st_role() in (''owner'',''admin'')) with check (public.st_role() in (''owner'',''admin''))';
  -- Gider ve tedarikçi ödemesi: giriş yetkilisi de ekler ve düzenler, silmeyi yalnızca yönetici yapar
  foreach t in array array['st_expenses','st_supplier_payments'] loop
    execute format('drop policy if exists st_ekle on public.%I', t);
    execute format('drop policy if exists st_duzenle on public.%I', t);
    execute format('drop policy if exists st_sil on public.%I', t);
    execute format('create policy st_ekle on public.%I for insert to authenticated with check (public.st_role() in (''owner'',''admin'',''entry''))', t);
    execute format('create policy st_duzenle on public.%I for update to authenticated using (public.st_role() in (''owner'',''admin'',''entry'')) with check (public.st_role() in (''owner'',''admin'',''entry''))', t);
    execute format('create policy st_sil on public.%I for delete to authenticated using (public.st_role() in (''owner'',''admin''))', t);
  end loop;
  -- Anlık güncelleme
  foreach t in array array['st_suppliers','st_expenses','st_supplier_payments'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
