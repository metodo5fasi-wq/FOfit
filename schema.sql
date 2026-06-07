-- ─────────────────────────────────────────────
-- FOfit · Schema database Supabase
-- ─────────────────────────────────────────────

-- 1. PROFILI CLIENTI (estende auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  role text not null default 'client', -- 'client' | 'admin'
  avatar_url text,
  phone text,
  birth_date date,
  height_cm numeric,
  goal text, -- 'dimagrimento' | 'massa' | 'mantenimento' | 'forza' | 'resistenza'
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. PIANI ALIMENTARI
create table public.meal_plans (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.profiles(id) on delete cascade not null,
  created_by uuid references public.profiles(id) not null,
  title text not null default 'Piano alimentare',
  week_number int not null default 1,
  kcal_target int not null default 2000,
  protein_target_g int not null default 150,
  carbs_target_g int not null default 200,
  fat_target_g int not null default 65,
  is_active boolean default true,
  notes text,
  created_at timestamptz default now()
);

-- 3. PASTI DEL PIANO (per giorno e tipo pasto)
create table public.plan_meals (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.meal_plans(id) on delete cascade not null,
  day_of_week int not null check (day_of_week between 1 and 7), -- 1=lunedì
  meal_type text not null, -- 'colazione' | 'spuntino' | 'pranzo' | 'pre-workout' | 'cena'
  meal_order int default 0,
  coach_note text,
  created_at timestamptz default now()
);

-- 4. ALIMENTI NEI PASTI DEL PIANO
create table public.plan_meal_foods (
  id uuid default gen_random_uuid() primary key,
  plan_meal_id uuid references public.plan_meals(id) on delete cascade not null,
  food_name text not null,
  brand text,
  quantity_g numeric not null default 100,
  kcal numeric not null default 0,
  protein_g numeric default 0,
  carbs_g numeric default 0,
  fat_g numeric default 0,
  sort_order int default 0
);

-- 5. DIARIO GIORNALIERO
create table public.diary_entries (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.profiles(id) on delete cascade not null,
  entry_date date not null default current_date,
  meal_type text not null,
  food_name text not null,
  brand text,
  quantity_g numeric not null default 100,
  kcal numeric not null default 0,
  protein_g numeric default 0,
  carbs_g numeric default 0,
  fat_g numeric default 0,
  water_ml int default 0,
  created_at timestamptz default now(),
  unique(client_id, entry_date, meal_type, food_name)
);

-- 6. TRACKER PROGRESSI CORPOREI
create table public.body_measurements (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.profiles(id) on delete cascade not null,
  measured_at date not null default current_date,
  weight_kg numeric,
  body_fat_pct numeric,
  lean_mass_pct numeric,
  waist_cm numeric,
  hips_cm numeric,
  chest_cm numeric,
  right_arm_cm numeric,
  left_arm_cm numeric,
  right_thigh_cm numeric,
  left_thigh_cm numeric,
  right_calf_cm numeric,
  left_calf_cm numeric,
  notes text,
  created_at timestamptz default now(),
  unique(client_id, measured_at)
);

-- 7. FOTO PROGRESSI
create table public.progress_photos (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.profiles(id) on delete cascade not null,
  photo_url text not null,
  taken_at date not null default current_date,
  week_number int,
  notes text,
  created_at timestamptz default now()
);

-- 8. LISTA DELLA SPESA
create table public.shopping_items (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.profiles(id) on delete cascade not null,
  plan_id uuid references public.meal_plans(id) on delete set null,
  week_number int,
  item_name text not null,
  brand text,
  quantity text,
  category text not null default 'Altro',
  is_checked boolean default false,
  is_manual boolean default false,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.meal_plans enable row level security;
alter table public.plan_meals enable row level security;
alter table public.plan_meal_foods enable row level security;
alter table public.diary_entries enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.shopping_items enable row level security;

-- Profiles: ogni utente vede solo sé stesso, admin vede tutti
create policy "Utente vede il proprio profilo" on public.profiles
  for select using (auth.uid() = id);

create policy "Admin vede tutti i profili" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Utente aggiorna il proprio profilo" on public.profiles
  for update using (auth.uid() = id);

-- Piani: il cliente vede i suoi, l'admin gestisce tutto
create policy "Cliente vede i suoi piani" on public.meal_plans
  for select using (client_id = auth.uid());

create policy "Admin gestisce tutti i piani" on public.meal_plans
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Diario: ogni utente gestisce solo il suo
create policy "Cliente gestisce il suo diario" on public.diary_entries
  for all using (client_id = auth.uid());

create policy "Admin vede tutti i diari" on public.diary_entries
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Misurazioni: ogni utente gestisce le sue
create policy "Cliente gestisce le sue misurazioni" on public.body_measurements
  for all using (client_id = auth.uid());

create policy "Admin vede tutte le misurazioni" on public.body_measurements
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Shopping: ogni utente gestisce la sua lista
create policy "Cliente gestisce la sua lista spesa" on public.shopping_items
  for all using (client_id = auth.uid());

create policy "Admin gestisce tutte le liste" on public.shopping_items
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Foto progressi
create policy "Cliente gestisce le sue foto" on public.progress_photos
  for all using (client_id = auth.uid());

create policy "Admin vede tutte le foto" on public.progress_photos
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Piano pasti (visibili al cliente e all'admin)
create policy "Cliente vede i suoi pasti" on public.plan_meals
  for select using (
    exists (select 1 from public.meal_plans where id = plan_id and client_id = auth.uid())
  );

create policy "Admin gestisce tutti i pasti" on public.plan_meals
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Cliente vede i suoi alimenti" on public.plan_meal_foods
  for select using (
    exists (
      select 1 from public.plan_meals pm
      join public.meal_plans mp on mp.id = pm.plan_id
      where pm.id = plan_meal_id and mp.client_id = auth.uid()
    )
  );

create policy "Admin gestisce tutti gli alimenti" on public.plan_meal_foods
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ─────────────────────────────────────────────
-- TRIGGER: aggiorna updated_at su profiles
-- ─────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- ─────────────────────────────────────────────
-- TRIGGER: crea profilo automatico alla registrazione
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'client')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
