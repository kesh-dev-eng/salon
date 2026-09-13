-- ==============================================================================
-- SALON HUB — COMPLETE ALL-IN-ONE DATABASE SETUP & PERMISSIONS SCRIPT
-- Copy and paste this ENTIRE file into your Supabase SQL Editor and click "Run":
-- https://supabase.com/dashboard/project/abresbnxhfhtpwnanfcn/sql
-- ==============================================================================

-- ==============================================================================
-- 1. TABLES CREATION
-- ==============================================================================

-- 1.1 Authorized Administrators
create table if not exists public.authorized_admins (
  id text primary key,
  email text unique not null,
  name text,
  role text default 'admin',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 1.2 Appointments & Reservations
create table if not exists public.bookings (
  id text primary key,
  code text,
  client_name text,
  client_phone text,
  client_email text,
  user_email text,
  service_name text,
  service_price text,
  stylist text default 'Fifth Avenue Master Stylist',
  appointment_date text not null,
  appointment_time text not null,
  quiet_chair boolean default false,
  status text default 'confirmed',
  notes text,
  created_at timestamptz default now()
);

-- Ensure all booking columns exist (in case table was previously created)
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

update public.bookings set status = 'confirmed' where status is null or trim(status) = '';
alter table public.bookings drop constraint if exists chk_bookings_status;
alter table public.bookings add constraint chk_bookings_status
  check (status is null or lower(trim(status)) in ('pending', 'confirmed', 'completed', 'cancelled'));

create index if not exists bookings_code_idx on public.bookings (code);
create index if not exists idx_bookings_date on public.bookings (appointment_date);

-- 1.3 Concierge Contact Inquiries
create table if not exists public.contacts (
  id text primary key,
  name text not null,
  email text not null,
  phone text,
  service text,
  message text not null,
  created_at timestamptz default now()
);

-- 1.4 Operating Hours & Timetable
create table if not exists public.timetable (
  id text primary key default 'default',
  working_days jsonb not null,
  time_slots jsonb not null,
  notice text default 'All appointments are private 1-on-1 sessions with dedicated master stylists.',
  updated_at timestamptz default now()
);

-- 1.5 Client Testimonials & Reviews
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

-- 1.6 Services Catalog
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

-- 1.7 Salon Artisans & Stylists
create table if not exists public.artisans (
  id text primary key,
  name text not null,
  role text not null,
  chair text,
  bio text,
  img text,
  created_at timestamptz default now()
);

-- 1.8 Atelier Gallery / Portfolio
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
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- Enables instant frontend reading & admin management without permissions issues
-- ==============================================================================

-- 2.1 Bookings (Allows viewing full client dossiers in Admin Panel)
alter table public.bookings enable row level security;
drop policy if exists "Public insert appointment booking" on public.bookings;
drop policy if exists "Client view own booking by code" on public.bookings;
drop policy if exists "Admin manage bookings" on public.bookings;
drop policy if exists "Public select bookings" on public.bookings;
drop policy if exists "Public update bookings" on public.bookings;
drop policy if exists "Public delete bookings" on public.bookings;

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

-- 2.2 Authorized Admins
alter table public.authorized_admins enable row level security;
drop policy if exists "Public select authorized_admins" on public.authorized_admins;
drop policy if exists "Admin manage authorized_admins" on public.authorized_admins;

create policy "Public select authorized_admins"
  on public.authorized_admins for select to anon, authenticated
  using (true);

create policy "Admin manage authorized_admins"
  on public.authorized_admins for all to anon, authenticated
  using (true) with check (true);

grant all on public.authorized_admins to anon, authenticated;

-- 2.3 Contacts
alter table public.contacts enable row level security;
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

-- 2.4 Timetable (Hours of Operation)
alter table public.timetable enable row level security;
drop policy if exists "Public read timetable" on public.timetable;
drop policy if exists "Admin manage timetable" on public.timetable;

create policy "Public read timetable"
  on public.timetable for select to anon, authenticated
  using (true);

create policy "Admin manage timetable"
  on public.timetable for all to anon, authenticated
  using (true) with check (true);

grant all on public.timetable to anon, authenticated;

-- 2.5 Reviews
alter table public.reviews enable row level security;
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

-- 2.6 Services
alter table public.services enable row level security;
drop policy if exists "Public read services catalog" on public.services;
drop policy if exists "Admin manage services" on public.services;

create policy "Public read services catalog"
  on public.services for select to anon, authenticated
  using (true);

create policy "Admin manage services"
  on public.services for all to anon, authenticated
  using (true) with check (true);

grant all on public.services to anon, authenticated;

-- 2.7 Artisans
alter table public.artisans enable row level security;
drop policy if exists "Public read artisans" on public.artisans;
drop policy if exists "Admin manage artisans" on public.artisans;

create policy "Public read artisans"
  on public.artisans for select to anon, authenticated
  using (true);

create policy "Admin manage artisans"
  on public.artisans for all to anon, authenticated
  using (true) with check (true);

grant all on public.artisans to anon, authenticated;

-- 2.8 Gallery
alter table public.gallery enable row level security;
drop policy if exists "Public read gallery" on public.gallery;
drop policy if exists "Admin manage gallery" on public.gallery;

create policy "Public read gallery"
  on public.gallery for select to anon, authenticated
  using (true);

create policy "Admin manage gallery"
  on public.gallery for all to anon, authenticated
  using (true) with check (true);

grant all on public.gallery to anon, authenticated;


-- ==============================================================================
-- 3. CALENDAR RESERVATIONS VIEW (With Full Customer Dossiers)
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
-- 4. SECURITY DEFINER RPC FUNCTIONS
-- ==============================================================================

-- 4.1 Admin Check
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

-- 4.2 Verify Admin Email
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

-- 4.3 Admin Fetch All Bookings
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

-- 4.4 Admin Fetch All Contacts
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

-- 4.5 Admin Update Booking Status
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

-- 4.6 Admin Delete Booking
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

-- 4.7 Admin Update Timetable (Operating Hours)
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


-- ==============================================================================
-- 5. SEED INITIAL DATA (SAFE & IDEMPOTENT)
-- ==============================================================================

-- 5.1 Authorized Administrators
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

-- 5.2 Operating Hours / Timetable (Standard Hours)
insert into public.timetable (id, working_days, time_slots, notice)
values (
  'default',
  '[
    {"day": "Mon", "name": "Monday", "isOpen": false, "openTime": "10:00 AM", "closeTime": "07:00 PM"},
    {"day": "Tue", "name": "Tuesday", "isOpen": true, "openTime": "10:00 AM", "closeTime": "07:00 PM"},
    {"day": "Wed", "name": "Wednesday", "isOpen": true, "openTime": "09:00 AM", "closeTime": "07:30 PM"},
    {"day": "Thu", "name": "Thursday", "isOpen": true, "openTime": "09:00 AM", "closeTime": "07:30 PM"},
    {"day": "Fri", "name": "Friday", "isOpen": true, "openTime": "09:00 AM", "closeTime": "07:30 PM"},
    {"day": "Sat", "name": "Saturday", "isOpen": true, "openTime": "09:00 AM", "closeTime": "06:00 PM"},
    {"day": "Sun", "name": "Sunday", "isOpen": true, "openTime": "10:30 AM", "closeTime": "06:00 PM"}
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
  'Tue – Sun: Dedicated Private Chair Sessions · Appointments & Walk-ins'
)
on conflict (id) do update
set working_days = excluded.working_days,
    time_slots = excluded.time_slots,
    notice = excluded.notice;

-- 5.3 Services Catalog
insert into public.services (id, num, category, name, price, price_num, duration, tag, img, "desc")
values
  ('s1', '01', 'cut', 'Cut & Styling', 'Rs 150+', 150, '60 min', 'Hair', '/images/services/cut-styling.jpg', 'From precision haircuts tailored to your individual look to polished blowouts and elegant updos, every cut and styling service is crafted to bring out the best in your hair.'),
  ('s2', '02', 'color', 'Color', 'Rs 220+', 220, '120 min', 'Color', '/images/services/color.jpg', 'From rich single-process color to expertly crafted balayage and highlights, our color services are tailored to complement your unique look by master colorists.'),
  ('s3', '03', 'treatments', 'Conditioning Hair Treatments', 'Rs 95+', 95, '45 min', 'Care', '/images/services/conditioning.jpg', 'Restore softness, strength, and luminosity with luxury formulas from Kérastase, Shu Uemura, and Olaplex, leaving you with a healthier, radiant result.'),
  ('s4', '04', 'makeup', 'Makeup', 'Rs 125+', 125, '60 min', 'Beauty', '/images/services/makeup.jpg', 'From custom blended makeup application and lash enhancements to eyebrow shaping and personalized lessons, designed to complement and elevate your full look.'),
  ('s5', '05', 'bridal', 'Bridal', 'Rs 350+', 350, '180 min', 'Occasion', '/images/services/bridal.jpg', 'From your bridal trial to the moment you walk down the aisle, offering both in-salon and on-location hair services tailored to your wedding vision.'),
  ('s6', '06', 'perms', 'Perms & Relaxer', 'Rs 200+', 200, '120 min', 'Texture', '/images/services/perms-relaxer.jpg', 'Whether you are looking to add lasting curl definition with a perm or achieve smooth, manageable results with a relaxer, tailored to your hair texture.'),
  ('s7', '07', 'nails', 'Nails', 'Rs 65+', 65, '50 min', 'Nails', '/images/services/nails.jpg', 'From a classic manicure to gel, Dazzle Dry, powder gel, and beyond, luxury nail services designed to leave your hands and feet looking polished and refined.')
on conflict (id) do nothing;

-- 5.4 Artisans
insert into public.artisans (id, name, role, chair, bio, img)
values
  ('artisan-1', 'Elena Vance', 'Creative Director & Colorist', 'Chair 01', '12 years atelier experience between London and Paris. Specialises in low-maintenance golden balayage.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=700&q=80'),
  ('artisan-2', 'Marcus Thorne', 'Master Sculptor & Fade Specialist', 'Chair 02', 'Vidal Sassoon trained. Master of precision men''s tapers, razor texturing, and sharp architectural crops.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=700&q=80'),
  ('artisan-3', 'Mei-Ling Zhou', 'Holistic Head Spa Therapist', 'Chair 03', 'Tokyo certified head spa master. Integrates herbal botanical extracts with restorative shiatsu acupressure.', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=700&q=80')
on conflict (id) do nothing;

-- 5.5 Reviews
insert into public.reviews (id, stars, rating, quote, author, service)
values
  ('rev-1', '★★★★★', 5, 'I have been a client of Salon HUB since they opened. They are the best. I won''t go anywhere else. My hair is curly and they do an amazing job. Always have', 'Carolyn Pianin', 'Cut & Styling'),
  ('rev-2', '★★★★★', 5, 'I had my hair cut by Carmel and it was such a great experience 10/10 recommend. She asked all the right questions to really understand what I was looking for. My hair came out fabulous!!', 'Sofia Appel', 'Cut & Styling'),
  ('rev-3', '★★★★★', 5, 'I hadn''t had my naturally very dark hair colored in a very long time, but I took the plunge with Kelly at Salon HUB and it was the best decision! Kelly gave me a thorough consultation and along with Devin they made sure my cut and color work in perfect harmony.', 'Vanessa Moreno', 'Color'),
  ('rev-4', '★★★★★', 5, 'I never write google reviews but the blowout that Rene just gave me deserves a review. It was a simple walk in and I’m leaving with the best blow out I have ever gotten.', 'Daniela Silva', 'Blow Dry'),
  ('rev-5', '★★★★★', 5, 'Salon HUB is such a wonderful experience! The salon is beautiful, exquisitely clean, and packed with highly talented artists! Clint does my cut..a perfectionist! Kelly does my color…very natural!', 'Donna Mazur', 'Cut & Color'),
  ('rev-6', '★★★★★', 5, 'I can’t say enough good things about this salon! Mark is a true artist with color — my color has never looked better. And Clint gives the best cuts; he really knows how to shape and style for your face and hair type.', 'M Bailey', 'Color & Cut')
on conflict (id) do nothing;
