-- ==============================================================================
-- SALON HUB — DATABASE UPDATE MIGRATION SCRIPT
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/abresbnxhfhtpwnanfcn/sql
-- ==============================================================================

-- 1. CREATE TIMETABLE & OPERATING HOURS TABLE
create table if not exists public.timetable (
  id text primary key default 'default',
  working_days jsonb not null,
  time_slots jsonb not null,
  notice text default 'All appointments are private 1-on-1 sessions with dedicated master stylists.',
  updated_at timestamptz default now()
);

-- 2. ENABLE ROW LEVEL SECURITY (RLS) ON TIMETABLE
alter table public.timetable enable row level security;

-- Drop existing policies if re-running (idempotent)
drop policy if exists "Allow all operations on timetable" on public.timetable;
drop policy if exists "Public read timetable" on public.timetable;
drop policy if exists "Admin manage timetable" on public.timetable;

-- 3. RLS POLICIES FOR TIMETABLE
-- Public can read live schedule & available booking slots
create policy "Public read timetable"
  on public.timetable for select to anon, authenticated
  using (true);

-- Authenticated admins have full management permissions
create policy "Admin manage timetable"
  on public.timetable for all to authenticated
  using (true) with check (true);

-- 4. SECURE RPC: ADMIN UPDATE TIMETABLE
-- Allows verified administrator to update weekly operating hours and reservation slots
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

-- 5. SEED STANDARD SALON TIMETABLE & WORKING HOURS
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
on conflict (id) do update
set working_days = excluded.working_days,
    time_slots = excluded.time_slots,
    notice = excluded.notice,
    updated_at = now();

-- 6. ENSURE CATALOG SERVICES ARE SEEDED
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
