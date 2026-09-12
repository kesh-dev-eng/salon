-- ==============================================================================
-- BARBER HUB / SALON HUB — DATABASE UPDATE & PERMISSIONS MIGRATION
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/abresbnxhfhtpwnanfcn/sql
-- ==============================================================================

-- 1. AUTHORIZED ADMINS TABLE & SEED
create table if not exists public.authorized_admins (
  id text primary key,
  email text unique not null,
  name text,
  role text default 'admin',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Safely upsert authorized administrators by unique email
insert into public.authorized_admins (id, email, name, role, is_active)
values
  ('admin-keshav', 'keshavsharma00007@gmail.com', 'Keshav Sharma (Owner)', 'super_admin', true),
  ('admin-master', 'admin@barberhub.com', 'Barber Hub Master Admin', 'super_admin', true),
  ('admin-director', 'director@barberhub.com', 'Elena Vance', 'manager', true),
  ('admin-salon', 'admin@salonhub.com', 'Salon Hub Admin', 'super_admin', true)
on conflict (email) do update
set name = excluded.name,
    role = excluded.role,
    is_active = excluded.is_active;

-- 2. APPOINTMENT RESERVATIONS / BOOKINGS TABLE & COLUMNS
create table if not exists public.bookings (
  id text primary key,
  code text,
  client_name text not null,
  client_phone text,
  client_email text,
  user_email text,
  service_name text not null,
  service_price text,
  stylist text default 'Fifth Avenue Master Stylist',
  appointment_date text not null,
  appointment_time text not null,
  quiet_chair boolean default false,
  status text default 'confirmed',
  notes text,
  created_at timestamptz default now()
);

-- Ensure all customer columns exist
alter table public.bookings add column if not exists code text;
alter table public.bookings add column if not exists client_name text;
alter table public.bookings add column if not exists client_phone text;
alter table public.bookings add column if not exists client_email text;
alter table public.bookings add column if not exists user_email text;
alter table public.bookings add column if not exists service_name text;
alter table public.bookings add column if not exists service_price text;
alter table public.bookings add column if not exists stylist text default 'Fifth Avenue Master Stylist';
alter table public.bookings add column if not exists appointment_date text;
alter table public.bookings add column if not exists appointment_time text;
alter table public.bookings add column if not exists quiet_chair boolean default false;
alter table public.bookings add column if not exists status text default 'confirmed';
alter table public.bookings add column if not exists notes text;
alter table public.bookings add column if not exists created_at timestamptz default now();

-- Ensure case-insensitive valid status check constraint
alter table public.bookings drop constraint if exists chk_bookings_status;
alter table public.bookings add constraint chk_bookings_status
  check (lower(trim(status)) in ('pending', 'confirmed', 'completed', 'cancelled'));

create index if not exists bookings_code_idx on public.bookings (code);
create index if not exists idx_bookings_date on public.bookings (appointment_date);

-- 3. CONCIERGE CONTACT INQUIRIES TABLE
create table if not exists public.contacts (
  id text primary key,
  name text not null,
  email text not null,
  phone text,
  service text,
  message text not null,
  created_at timestamptz default now()
);

-- 4. TIMETABLE TABLE
create table if not exists public.timetable (
  id text primary key default 'default',
  working_days jsonb not null,
  time_slots jsonb not null,
  notice text default 'All appointments are private 1-on-1 sessions with dedicated master stylists.',
  updated_at timestamptz default now()
);

-- 5. REVIEWS TABLE
create table if not exists public.reviews (
  id text primary key,
  author text not null,
  role text default 'Patron',
  stars text default '★★★★★',
  rating integer default 5,
  service text,
  quote text not null,
  created_at timestamptz default now()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.authorized_admins enable row level security;
alter table public.bookings enable row level security;
alter table public.contacts enable row level security;
alter table public.reviews enable row level security;
alter table public.timetable enable row level security;

-- Authorized Admins RLS
drop policy if exists "Public select authorized_admins" on public.authorized_admins;
drop policy if exists "Admin manage authorized_admins" on public.authorized_admins;

create policy "Public select authorized_admins"
  on public.authorized_admins for select to anon, authenticated
  using (true);

create policy "Admin manage authorized_admins"
  on public.authorized_admins for all to anon, authenticated
  using (true) with check (true);

grant all on public.authorized_admins to anon, authenticated;

-- Bookings RLS
drop policy if exists "Public insert appointment booking" on public.bookings;
drop policy if exists "Client view own booking by code" on public.bookings;
drop policy if exists "Admin manage bookings" on public.bookings;
drop policy if exists "Public select bookings" on public.bookings;
drop policy if exists "Public update bookings" on public.bookings;
drop policy if exists "Public delete bookings" on public.bookings;

-- Allow anon and authenticated to view all bookings so admin console can see all customer submissions
create policy "Public select bookings"
  on public.bookings for select to anon, authenticated
  using (true);

create policy "Public insert appointment booking"
  on public.bookings for insert to anon, authenticated
  with check (true);

create policy "Public update bookings"
  on public.bookings for update to anon, authenticated
  using (true) with check (true);

create policy "Public delete bookings"
  on public.bookings for delete to anon, authenticated
  using (true);

grant all on public.bookings to anon, authenticated;

-- Contacts RLS
drop policy if exists "Public insert contact inquiry" on public.contacts;
drop policy if exists "Admin manage contacts" on public.contacts;
drop policy if exists "Public select contacts" on public.contacts;

create policy "Public select contacts"
  on public.contacts for select to anon, authenticated
  using (true);

create policy "Public insert contact inquiry"
  on public.contacts for insert to anon, authenticated
  with check (true);

create policy "Admin manage contacts"
  on public.contacts for all to anon, authenticated
  using (true) with check (true);

grant all on public.contacts to anon, authenticated;

-- Timetable RLS
drop policy if exists "Public read timetable" on public.timetable;
drop policy if exists "Admin manage timetable" on public.timetable;

create policy "Public read timetable"
  on public.timetable for select to anon, authenticated
  using (true);

create policy "Admin manage timetable"
  on public.timetable for all to anon, authenticated
  using (true) with check (true);

grant all on public.timetable to anon, authenticated;

-- Reviews RLS
drop policy if exists "Public read reviews" on public.reviews;
drop policy if exists "Public insert validated review" on public.reviews;
drop policy if exists "Admin manage reviews" on public.reviews;

create policy "Public read reviews"
  on public.reviews for select to anon, authenticated
  using (true);

create policy "Public insert validated review"
  on public.reviews for insert to anon, authenticated
  with check (true);

create policy "Admin manage reviews"
  on public.reviews for all to anon, authenticated
  using (true) with check (true);

grant all on public.reviews to anon, authenticated;

-- ==============================================================================
-- RESERVATION SLOTS VIEW (With full customer details)
-- ==============================================================================
drop view if exists public.public_booked_slots cascade;

create or replace view public.public_booked_slots with (security_invoker = false) as
  select
    id,
    code,
    client_name,
    client_phone,
    client_email,
    user_email,
    service_name,
    service_price,
    stylist,
    appointment_date,
    appointment_time,
    quiet_chair,
    status,
    notes,
    created_at
  from public.bookings
  where status != 'cancelled';

grant select on public.public_booked_slots to anon, authenticated;

-- ==============================================================================
-- RPC FUNCTIONS FOR ADMIN OPERATIONS
-- ==============================================================================
create or replace function public.is_active_admin(check_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.authorized_admins
    where lower(trim(email)) = lower(trim(check_email))
      and is_active = true
  );
$$;

grant execute on function public.is_active_admin(text) to anon, authenticated;

create or replace function public.verify_admin_email(check_email text)
returns table (
  is_authorized boolean,
  admin_id text,
  email text,
  name text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    true as is_authorized,
    a.id as admin_id,
    a.email,
    a.name,
    a.role
  from public.authorized_admins a
  where lower(trim(a.email)) = lower(trim(check_email))
    and a.is_active = true
  limit 1;
end;
$$;

grant execute on function public.verify_admin_email(text) to anon, authenticated;

create or replace function public.admin_fetch_bookings(p_admin_email text default null)
returns setof public.bookings
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select * from public.bookings
  order by appointment_date desc, appointment_time asc;
end;
$$;

grant execute on function public.admin_fetch_bookings(text) to anon, authenticated;
grant execute on function public.admin_fetch_bookings() to anon, authenticated;

create or replace function public.admin_fetch_contacts(p_admin_email text default null)
returns setof public.contacts
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select * from public.contacts
  order by created_at desc;
end;
$$;

grant execute on function public.admin_fetch_contacts(text) to anon, authenticated;
grant execute on function public.admin_fetch_contacts() to anon, authenticated;

create or replace function public.admin_update_booking_status(
  p_admin_email text,
  p_booking_id text,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bookings
  set status = lower(trim(p_status))
  where id = p_booking_id;

  return true;
end;
$$;

grant execute on function public.admin_update_booking_status(text, text, text) to anon, authenticated;

create or replace function public.admin_delete_booking(
  p_admin_email text,
  p_booking_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.bookings
  where id = p_booking_id;

  return true;
end;
$$;

grant execute on function public.admin_delete_booking(text, text) to anon, authenticated;

create or replace function public.admin_update_timetable(
  p_admin_email text,
  p_working_days jsonb,
  p_time_slots jsonb,
  p_notice text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.timetable (id, working_days, time_slots, notice, updated_at)
  values ('default', p_working_days, p_time_slots, coalesce(p_notice, ''), now())
  on conflict (id) do update
  set working_days = excluded.working_days,
      time_slots = excluded.time_slots,
      notice = excluded.notice,
      updated_at = now();

  return true;
end;
$$;

grant execute on function public.admin_update_timetable(text, jsonb, jsonb, text) to anon, authenticated;
