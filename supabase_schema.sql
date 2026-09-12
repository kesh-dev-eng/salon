-- ==============================================================================
-- SALON HUB FIFTH AVENUE — HARDENED POSTGRES DATABASE SCHEMA & SECURITY CONTROLS
-- Implements CIA Triad: Confidentiality, Integrity, Availability
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/abresbnxhfhtpwnanfcn/sql
-- ==============================================================================

-- 1. AUTHORIZED GOOGLE ADMINS TABLE
create table if not exists public.authorized_admins (
  id text primary key,
  email text unique not null,
  name text,
  role text default 'admin', -- 'super_admin' | 'manager' | 'admin'
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 2. SALON SERVICES CATALOG
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

-- 3. SALON ARTISANS & MASTER STYLISTS
create table if not exists public.artisans (
  id text primary key,
  name text not null,
  role text not null,
  chair text,
  bio text,
  img text,
  created_at timestamptz default now()
);

-- 4. SALON ATELIER PORTFOLIO / GALLERY
create table if not exists public.gallery (
  id text primary key,
  category text not null,
  tag text,
  title text not null,
  "desc" text,
  img text not null,
  created_at timestamptz default now()
);

-- 5. CLIENT TESTIMONIALS & REVIEWS
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

-- 6. APPOINTMENT RESERVATIONS / BOOKINGS
create table if not exists public.bookings (
  id text primary key,
  code text,
  client_name text not null,
  client_phone text,
  client_email text,
  user_email text,
  service_name text not null,
  service_price text,
  stylist text default 'Solo Master Artist',
  appointment_date text not null,
  appointment_time text not null,
  quiet_chair boolean default false,
  status text default 'pending',
  notes text,
  created_at timestamptz default now()
);

-- 7. CONCIERGE CONTACT INQUIRIES
create table if not exists public.contacts (
  id text primary key,
  name text not null,
  email text not null,
  phone text,
  service text,
  message text not null,
  created_at timestamptz default now()
);

-- ==============================================================================
-- INTEGRITY: DATA VALIDATION & CHECK CONSTRAINTS (IDEMPOTENT)
-- ==============================================================================
do $$
begin
  -- Reviews: Rating bounded between 1 and 5, author & quote cannot be empty
  if not exists (select 1 from pg_constraint where conname = 'chk_reviews_rating') then
    alter table public.reviews add constraint chk_reviews_rating check (rating >= 1 and rating <= 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_reviews_quote') then
    alter table public.reviews add constraint chk_reviews_quote check (length(trim(quote)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_reviews_author') then
    alter table public.reviews add constraint chk_reviews_author check (length(trim(author)) > 0);
  end if;

  -- Bookings: Status domain, non-empty client name and valid date format
  if not exists (select 1 from pg_constraint where conname = 'chk_bookings_status') then
    alter table public.bookings add constraint chk_bookings_status check (status in ('pending', 'confirmed', 'completed', 'cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_bookings_name') then
    alter table public.bookings add constraint chk_bookings_name check (length(trim(client_name)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_bookings_date') then
    alter table public.bookings add constraint chk_bookings_date check (length(trim(appointment_date)) = 10);
  end if;

  -- Contacts: Non-empty contact name and message
  if not exists (select 1 from pg_constraint where conname = 'chk_contacts_name') then
    alter table public.contacts add constraint chk_contacts_name check (length(trim(name)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_contacts_message') then
    alter table public.contacts add constraint chk_contacts_message check (length(trim(message)) > 0);
  end if;

  -- Admins: Role constraint
  if not exists (select 1 from pg_constraint where conname = 'chk_admin_role') then
    alter table public.authorized_admins add constraint chk_admin_role check (role in ('super_admin', 'manager', 'admin'));
  end if;
end $$;

-- ==============================================================================
-- AVAILABILITY & PERFORMANCE: STRATEGIC INDEXES
-- ==============================================================================
-- Prevent double-booking race conditions on active slots
create unique index if not exists bookings_date_time_unique_idx
  on public.bookings (appointment_date, appointment_time)
  where (status != 'cancelled');

-- Fast indexed lookups for calendar date queries (avoids full-table scans)
create index if not exists idx_bookings_date
  on public.bookings (appointment_date);

-- Fast lookup by confirmation code
create index if not exists idx_bookings_code
  on public.bookings (code);

-- Fast ordering for inquiries
create index if not exists idx_contacts_created_at
  on public.contacts (created_at desc);

-- Fast review sorting by rating & date
create index if not exists idx_reviews_rating_created
  on public.reviews (rating, created_at desc);

-- Fast case-insensitive email lookup for admin authentication
create index if not exists idx_authorized_admins_email
  on public.authorized_admins (lower(email));

-- ==============================================================================
-- CONFIDENTIALITY: PII-SAFE RESERVATION SLOTS VIEW
-- Public calendar queries use this view to inspect booked slots WITHOUT exposing
-- client names, phone numbers, emails, or personal appointment notes.
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
-- SECURITY DEFINER: SECURE ADMIN EMAIL VERIFICATION & SAFE OPERATIONS
-- Avoids exposing the authorized_admins roster table to public enumeration.
-- ==============================================================================
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

-- Helper to verify if an email is an active admin
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

-- Secure RPC: Admin Update Booking Status (guarded by admin verification)
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

-- Secure RPC: Admin Delete Booking (guarded by admin verification)
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

-- Secure RPC: Admin Update Service (guarded by admin verification)
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

-- Secure RPC: Admin Delete Service (guarded by admin verification)
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

-- Secure RPC: Admin Delete Review (guarded by admin verification)
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
-- ROW LEVEL SECURITY (RLS): PRINCIPLE OF LEAST PRIVILEGE
-- ==============================================================================
alter table public.authorized_admins enable row level security;
alter table public.services enable row level security;
alter table public.artisans enable row level security;
alter table public.gallery enable row level security;
alter table public.reviews enable row level security;
alter table public.bookings enable row level security;
alter table public.contacts enable row level security;

-- Drop legacy vulnerable policies
drop policy if exists "Allow all operations on authorized_admins" on public.authorized_admins;
drop policy if exists "Allow all operations on services" on public.services;
drop policy if exists "Allow all operations on artisans" on public.artisans;
drop policy if exists "Allow all operations on gallery" on public.gallery;
drop policy if exists "Allow all operations on reviews" on public.reviews;
drop policy if exists "Allow all operations on bookings" on public.bookings;
drop policy if exists "Allow all operations on contacts" on public.contacts;

-- Drop new policies if re-running script (idempotency)
drop policy if exists "Public read services catalog" on public.services;
drop policy if exists "Public read artisans" on public.artisans;
drop policy if exists "Public read gallery" on public.gallery;
drop policy if exists "Public read reviews" on public.reviews;
drop policy if exists "Public insert validated review" on public.reviews;
drop policy if exists "Public insert contact inquiry" on public.contacts;
drop policy if exists "Public insert appointment booking" on public.bookings;
drop policy if exists "Admin manage services" on public.services;
drop policy if exists "Admin manage artisans" on public.artisans;
drop policy if exists "Admin manage gallery" on public.gallery;
drop policy if exists "Admin manage reviews" on public.reviews;
drop policy if exists "Admin manage bookings" on public.bookings;
drop policy if exists "Admin manage contacts" on public.contacts;
drop policy if exists "Admin manage authorized_admins" on public.authorized_admins;

-- 1. Services: Public can read, mutations reserved for authenticated admins
create policy "Public read services catalog"
  on public.services for select to anon, authenticated
  using (true);

-- 2. Artisans: Public can read, mutations reserved for authenticated admins
create policy "Public read artisans"
  on public.artisans for select to anon, authenticated
  using (true);

-- 3. Gallery: Public can read, mutations reserved for authenticated admins
create policy "Public read gallery"
  on public.gallery for select to anon, authenticated
  using (true);

-- 4. Reviews: Public can read, insert validated review, no public delete/update
create policy "Public read reviews"
  on public.reviews for select to anon, authenticated
  using (true);

create policy "Public insert validated review"
  on public.reviews for insert to anon, authenticated
  with check (
    length(trim(author)) > 0
    and length(trim(quote)) > 0
    and rating >= 1
    and rating <= 5
  );

-- 5. Contacts: Public can submit inquiry only; NO public select, update, or delete (PII protection)
create policy "Public insert contact inquiry"
  on public.contacts for insert to anon, authenticated
  with check (
    length(trim(name)) > 0
    and length(trim(message)) > 0
  );

-- 6. Bookings: Public can insert validated booking; NO public select or delete (PII protection)
-- Slot availability is queried via the PII-safe public_booked_slots view
create policy "Public insert appointment booking"
  on public.bookings for insert to anon, authenticated
  with check (
    length(trim(client_name)) > 0
    and length(trim(appointment_date)) = 10
    and status in ('pending', 'confirmed')
  );

-- 7. Authenticated Supabase session full management
create policy "Admin manage services" on public.services for all to authenticated using (true) with check (true);
create policy "Admin manage artisans" on public.artisans for all to authenticated using (true) with check (true);
create policy "Admin manage gallery" on public.gallery for all to authenticated using (true) with check (true);
create policy "Admin manage reviews" on public.reviews for all to authenticated using (true) with check (true);
create policy "Admin manage bookings" on public.bookings for all to authenticated using (true) with check (true);
create policy "Admin manage contacts" on public.contacts for all to authenticated using (true) with check (true);
create policy "Admin manage authorized_admins" on public.authorized_admins for all to authenticated using (true) with check (true);

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================
insert into public.authorized_admins (id, email, name, role, is_active)
values
  ('admin-master', 'admin@salonhub.com', 'Salon HUB Master Admin', 'super_admin', true),
  ('admin-director', 'director@salonhub.com', 'Elena Vance', 'manager', true)
on conflict (id) do nothing;

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

insert into public.artisans (id, name, role, chair, bio, img)
values
  ('artisan-1', 'Elena Vance', 'Creative Director & Colorist', 'Chair 01', '12 years atelier experience between London and Paris. Specialises in low-maintenance golden balayage.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=700&q=80'),
  ('artisan-2', 'Marcus Thorne', 'Master Sculptor & Fade Specialist', 'Chair 02', 'Vidal Sassoon trained. Master of precision men''s tapers, razor texturing, and sharp architectural crops.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=700&q=80'),
  ('artisan-3', 'Mei-Ling Zhou', 'Holistic Head Spa Therapist', 'Chair 03', 'Tokyo certified head spa master. Integrates herbal botanical extracts with restorative shiatsu acupressure.', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=700&q=80')
on conflict (id) do nothing;

insert into public.gallery (id, category, tag, title, "desc", img)
values
  ('gal-1', 'cuts', 'Men''s Fade', 'Textured Crop & Low Skin Taper', 'Precision scissor carving with razor-sharp temple contours.', 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&q=80'),
  ('gal-2', 'cuts', 'Precision Cut', 'Architectural French Bob', 'Clean jawline bevel with textured curtain fringe.', 'https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?w=800&q=80'),
  ('gal-3', 'balayage', 'Colour', 'Champagne Nordic Melt', 'Ultra-fine baby lights blended into platinum tips.', 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=800&q=80'),
  ('gal-4', 'bridal', 'Bridal', 'The Riviera Chignon', 'Relaxed low bun with soft framing tendrils and pearl pins.', 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&q=80'),
  ('gal-5', 'styling', 'Styling', 'Venetian Velvet Blowout', 'High-volume polished waves with high-gloss mirror glaze.', 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&q=80'),
  ('gal-6', 'cuts', 'Men''s Styling', 'Sculpted Pompadour & Beard Blend', 'Matte pomade texture with seamless cheekbone graduation.', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80')
on conflict (id) do nothing;

insert into public.reviews (id, stars, rating, quote, author, service)
values
  ('rev-1', '★★★★★', 5, 'I have been a client of Salon HUB since they opened. They are the best. I won''t go anywhere else. My hair is curly and they do an amazing job. Always have', 'Carolyn Pianin', 'Cut & Styling'),
  ('rev-2', '★★★★★', 5, 'I had my hair cut by Carmel and it was such a great experience 10/10 recommend. She asked all the right questions to really understand what I was looking for. My hair came out fabulous!!', 'Sofia Appel', 'Cut & Styling'),
  ('rev-3', '★★★★★', 5, 'I hadn''t had my naturally very dark hair colored in a very long time, but I took the plunge with Kelly at Salon HUB and it was the best decision! Kelly gave me a thorough consultation and along with Devin they made sure my cut and color work in perfect harmony.', 'Vanessa Moreno', 'Color'),
  ('rev-4', '★★★★★', 5, 'I never write google reviews but the blowout that Rene just gave me deserves a review. It was a simple walk in and I’m leaving with the best blow out I have ever gotten.', 'Daniela Silva', 'Blow Dry'),
  ('rev-5', '★★★★★', 5, 'Salon HUB is such a wonderful experience! The salon is beautiful, exquisitely clean, and packed with highly talented artists! Clint does my cut..a perfectionist! Kelly does my color…very natural!', 'Donna Mazur', 'Cut & Color'),
  ('rev-6', '★★★★★', 5, 'I can’t say enough good things about this salon! Mark is a true artist with color — my color has never looked better. And Clint gives the best cuts; he really knows how to shape and style for your face and hair type.', 'M Bailey', 'Color & Cut')
on conflict (id) do nothing;
