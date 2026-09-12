-- ==============================================================================
-- BARBER HUB — COMPLETE DATABASE FIX & HARDENING SCRIPT
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/abresbnxhfhtpwnanfcn/sql
-- ==============================================================================

-- 1. AUTHORIZED ADMINS TABLE
create table if not exists public.authorized_admins (
  id text primary key,
  email text unique not null,
  name text,
  role text default 'admin',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Seed administrators so admin functions and RPCs are immediately unlocked
insert into public.authorized_admins (id, email, name, role, is_active)
values
  ('admin-keshav', 'keshavsharma00007@gmail.com', 'Keshav Sharma (Owner)', 'super_admin', true),
  ('admin-master', 'admin@barberhub.com', 'Barber Hub Master Admin', 'super_admin', true),
  ('admin-director', 'director@barberhub.com', 'Elena Vance', 'manager', true),
  ('admin-salon', 'admin@salonhub.com', 'Salon Hub Admin', 'super_admin', true)
on conflict (id) do update
set email = excluded.email,
    name = excluded.name,
    role = excluded.role,
    is_active = excluded.is_active;

-- 2. APPOINTMENT RESERVATIONS / BOOKINGS TABLE
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
  status text default 'pending',
  notes text,
  created_at timestamptz default now()
);

-- Ensure correct columns exist even if table was created previously
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
alter table public.bookings add column if not exists status text default 'pending';
alter table public.bookings add column if not exists notes text;
alter table public.bookings add column if not exists created_at timestamptz default now();

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

-- 6. SERVICES TABLE
create table if not exists public.services (
  id text primary key,
  num text,
  category text not null,
  name text not null,
  price text not null,
  price_num numeric default 0,
  duration text default '60 min',
  tag text,
  img text,
  "desc" text,
  created_at timestamptz default now()
);

-- 7. ARTISANS TABLE
create table if not exists public.artisans (
  id text primary key,
  name text not null,
  role text not null,
  chair text,
  bio text,
  img text,
  created_at timestamptz default now()
);

-- 8. GALLERY TABLE
create table if not exists public.gallery (
  id text primary key,
  category text not null,
  tag text,
  title text not null,
  "desc" text,
  img text not null,
  created_at timestamptz default now()
);

-- ==============================================================================
-- AVAILABILITY & UNIQUE CONFLICT INDEXES
-- ==============================================================================
create unique index if not exists bookings_date_time_unique_idx
  on public.bookings (appointment_date, appointment_time)
  where (status != 'cancelled');

create index if not exists idx_bookings_date on public.bookings (appointment_date);
create index if not exists idx_bookings_code on public.bookings (code);
create index if not exists idx_contacts_created_at on public.contacts (created_at desc);
create index if not exists idx_authorized_admins_email on public.authorized_admins (lower(email));

-- ==============================================================================
-- PII-SAFE RESERVATION SLOTS VIEW
-- Exposes date & time slots only for client slot-disabling without leaking personal data
-- ==============================================================================
create or replace view public.public_booked_slots with (security_invoker = false) as
  select
    id,
    appointment_date,
    appointment_time,
    status
  from public.bookings
  where status != 'cancelled';

grant select on public.public_booked_slots to anon, authenticated;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) FIXES
-- ==============================================================================
alter table public.authorized_admins enable row level security;
alter table public.bookings enable row level security;
alter table public.contacts enable row level security;
alter table public.reviews enable row level security;
alter table public.services enable row level security;
alter table public.timetable enable row level security;
alter table public.artisans enable row level security;
alter table public.gallery enable row level security;

-- Drop legacy or conflicting policies
drop policy if exists "Public insert appointment booking" on public.bookings;
drop policy if exists "Public read bookings" on public.bookings;
drop policy if exists "Client view own booking by code" on public.bookings;
drop policy if exists "Admin manage bookings" on public.bookings;
drop policy if exists "Allow all operations on bookings" on public.bookings;

drop policy if exists "Public insert contact inquiry" on public.contacts;
drop policy if exists "Admin manage contacts" on public.contacts;
drop policy if exists "Allow all operations on contacts" on public.contacts;

drop policy if exists "Public read reviews" on public.reviews;
drop policy if exists "Public insert validated review" on public.reviews;
drop policy if exists "Admin manage reviews" on public.reviews;

drop policy if exists "Public read services catalog" on public.services;
drop policy if exists "Admin manage services" on public.services;

drop policy if exists "Public read timetable" on public.timetable;
drop policy if exists "Admin manage timetable" on public.timetable;

drop policy if exists "Public read artisans" on public.artisans;
drop policy if exists "Admin manage artisans" on public.artisans;

drop policy if exists "Public read gallery" on public.gallery;
drop policy if exists "Admin manage gallery" on public.gallery;

drop policy if exists "Admin manage authorized_admins" on public.authorized_admins;

-- 1. Bookings Policies
-- Allow anyone (visitors) to insert an appointment booking
create policy "Public insert appointment booking"
  on public.bookings for insert to anon, authenticated
  with check (true);

-- Allow clients to view/query a booking if they supply the code or id (allows RETURNING clause & lookup)
create policy "Client view own booking by code"
  on public.bookings for select to anon, authenticated
  using (code is not null or id is not null);

-- Full management for authenticated admins
create policy "Admin manage bookings"
  on public.bookings for all to authenticated
  using (true) with check (true);

-- 2. Contacts Policies
create policy "Public insert contact inquiry"
  on public.contacts for insert to anon, authenticated
  with check (true);

create policy "Admin manage contacts"
  on public.contacts for all to authenticated
  using (true) with check (true);

-- 3. Reviews Policies
create policy "Public read reviews"
  on public.reviews for select to anon, authenticated
  using (true);

create policy "Public insert validated review"
  on public.reviews for insert to anon, authenticated
  with check (true);

create policy "Admin manage reviews"
  on public.reviews for all to authenticated
  using (true) with check (true);

-- 4. Services, Timetable, Artisans, Gallery (Public Read, Admin Write)
create policy "Public read services catalog" on public.services for select to anon, authenticated using (true);
create policy "Admin manage services" on public.services for all to authenticated using (true) with check (true);

create policy "Public read timetable" on public.timetable for select to anon, authenticated using (true);
create policy "Admin manage timetable" on public.timetable for all to authenticated using (true) with check (true);

create policy "Public read artisans" on public.artisans for select to anon, authenticated using (true);
create policy "Admin manage artisans" on public.artisans for all to authenticated using (true) with check (true);

create policy "Public read gallery" on public.gallery for select to anon, authenticated using (true);
create policy "Admin manage gallery" on public.gallery for all to authenticated using (true) with check (true);

create policy "Admin manage authorized_admins" on public.authorized_admins for all to authenticated using (true) with check (true);

-- ==============================================================================
-- SECURITY DEFINER RPC FUNCTIONS
-- ==============================================================================

-- 1. Helper: Is email an active admin?
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

-- 2. Verify admin email details
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

-- 3. Admin: Fetch all bookings
create or replace function public.admin_fetch_bookings(p_admin_email text)
returns setof public.bookings
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_admin(p_admin_email) then
    raise exception 'Unauthorized: % is not an active administrator', p_admin_email;
  end if;

  return query
  select * from public.bookings
  order by appointment_date desc, appointment_time asc;
end;
$$;

grant execute on function public.admin_fetch_bookings(text) to anon, authenticated;

-- 4. Admin: Fetch all contacts
create or replace function public.admin_fetch_contacts(p_admin_email text)
returns setof public.contacts
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_admin(p_admin_email) then
    raise exception 'Unauthorized: % is not an active administrator', p_admin_email;
  end if;

  return query
  select * from public.contacts
  order by created_at desc;
end;
$$;

grant execute on function public.admin_fetch_contacts(text) to anon, authenticated;

-- 5. Admin: Update booking status
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
  if not public.is_active_admin(p_admin_email) then
    raise exception 'Unauthorized: % is not an active administrator', p_admin_email;
  end if;

  update public.bookings
  set status = p_status
  where id = p_booking_id;

  return true;
end;
$$;

grant execute on function public.admin_update_booking_status(text, text, text) to anon, authenticated;

-- 6. Admin: Delete booking
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
  if not public.is_active_admin(p_admin_email) then
    raise exception 'Unauthorized: % is not an active administrator', p_admin_email;
  end if;

  delete from public.bookings
  where id = p_booking_id;

  return true;
end;
$$;

grant execute on function public.admin_delete_booking(text, text) to anon, authenticated;

-- 7. Admin: Update timetable
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
  if not public.is_active_admin(p_admin_email) then
    raise exception 'Unauthorized: % is not an active administrator', p_admin_email;
  end if;

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

-- 8. Admin: Update service price
create or replace function public.admin_update_service_price(
  p_admin_email text,
  p_service_id text,
  p_price text,
  p_price_num numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_admin(p_admin_email) then
    raise exception 'Unauthorized: % is not an active administrator', p_admin_email;
  end if;

  update public.services
  set price = p_price, price_num = p_price_num
  where id = p_service_id;

  return true;
end;
$$;

grant execute on function public.admin_update_service_price(text, text, text, numeric) to anon, authenticated;

-- 9. Admin: Delete service
create or replace function public.admin_delete_service(
  p_admin_email text,
  p_service_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_admin(p_admin_email) then
    raise exception 'Unauthorized: % is not an active administrator', p_admin_email;
  end if;

  delete from public.services
  where id = p_service_id;

  return true;
end;
$$;

grant execute on function public.admin_delete_service(text, text) to anon, authenticated;

-- 10. Admin: Delete review
create or replace function public.admin_delete_review(
  p_admin_email text,
  p_review_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_admin(p_admin_email) then
    raise exception 'Unauthorized: % is not an active administrator', p_admin_email;
  end if;

  delete from public.reviews
  where id = p_review_id;

  return true;
end;
$$;

grant execute on function public.admin_delete_review(text, text) to anon, authenticated;

-- ==============================================================================
-- DEFAULT SEED DATA (IF NOT ALREADY POPULATED)
-- ==============================================================================
insert into public.timetable (id, working_days, time_slots, notice)
values (
  'default',
  '[
    {"day": "Sun", "name": "Sunday", "isOpen": false, "openTime": "Closed", "closeTime": "Closed"},
    {"day": "Mon", "name": "Monday", "isOpen": true, "openTime": "09:00 AM", "closeTime": "07:00 PM"},
    {"day": "Tue", "name": "Tuesday", "isOpen": true, "openTime": "09:00 AM", "closeTime": "07:00 PM"},
    {"day": "Wed", "name": "Wednesday", "isOpen": true, "openTime": "09:00 AM", "closeTime": "07:00 PM"},
    {"day": "Thu", "name": "Thursday", "isOpen": true, "openTime": "09:00 AM", "closeTime": "07:00 PM"},
    {"day": "Fri", "name": "Friday", "isOpen": true, "openTime": "09:00 AM", "closeTime": "07:00 PM"},
    {"day": "Sat", "name": "Saturday", "isOpen": true, "openTime": "09:00 AM", "closeTime": "06:00 PM"}
  ]'::jsonb,
  '[
    {"id": "t1", "time": "09:30 AM", "period": "morning", "label": "Morning Light", "badge": "Available", "active": true},
    {"id": "t2", "time": "10:30 AM", "period": "morning", "label": "Morning High", "badge": "Popular", "active": true},
    {"id": "t3", "time": "11:30 AM", "period": "morning", "label": "Midday Prime", "badge": "Prime", "active": true},
    {"id": "t4", "time": "01:00 PM", "period": "afternoon", "label": "Early Afternoon", "badge": "Available", "active": true},
    {"id": "t5", "time": "02:15 PM", "period": "afternoon", "label": "Mid Afternoon", "badge": "Popular", "active": true},
    {"id": "t6", "time": "03:30 PM", "period": "afternoon", "label": "Late Afternoon", "badge": "Available", "active": true},
    {"id": "t7", "time": "04:30 PM", "period": "afternoon", "label": "Sunset Glow", "badge": "Prime", "active": true},
    {"id": "t8", "time": "05:30 PM", "period": "evening", "label": "Fifth Ave Twilight", "badge": "Available", "active": true},
    {"id": "t9", "time": "06:30 PM", "period": "evening", "label": "Evening Couture", "badge": "Peak Slot", "active": true},
    {"id": "t10", "time": "07:15 PM", "period": "evening", "label": "Late Salon Session", "badge": "VIP Evening", "active": true}
  ]'::jsonb,
  'All appointments are private 1-on-1 sessions with dedicated master stylists.'
)
on conflict (id) do nothing;
