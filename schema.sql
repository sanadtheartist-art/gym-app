-- Supabase SQL Schema for JEXI Gym Tracker V2
-- Supports Authentication, Multi-user Isolation (RLS), and complex JSON data.

-- ==========================================
-- DANGER ZONE: IF YOU ARE GETTING ERRORS ABOUT EXISTING COLUMNS, 
-- UNCOMMENT THE 4 LINES BELOW TO RESET YOUR TABLES. 
-- (THIS WILL DELETE EXISTING PROTOTYPE DATA)
-- ==========================================
-- DROP TABLE IF EXISTS public.workouts CASCADE;
-- DROP TABLE IF EXISTS public.split_exercises CASCADE;
-- DROP TABLE IF EXISTS public.splits CASCADE;
-- DROP TABLE IF EXISTS public.body_metrics CASCADE;

-- 1. Create Tables

CREATE TABLE IF NOT EXISTS public.workouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    exercise_name TEXT NOT NULL,
    muscle_group TEXT,
    sets INTEGER,
    reps INTEGER,
    weight_kg NUMERIC,
    sets_data JSONB,
    session_duration_seconds INTEGER,
    
    -- New Columns missing from previous version:
    input_weight NUMERIC,
    input_unit TEXT,
    set_duration_seconds INTEGER,
    mechanic_type TEXT,
    machine_used TEXT,
    assisted_muscles JSONB,
    custom_notes TEXT,
    split_id UUID,
    media_url TEXT
);

CREATE TABLE IF NOT EXISTS public.splits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.split_exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    split_id UUID REFERENCES public.splits(id) ON DELETE CASCADE NOT NULL,
    exercise_name TEXT NOT NULL,
    muscle_group TEXT,
    sets INTEGER,
    reps INTEGER,
    display_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.body_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    bodyweight_kg NUMERIC,
    site_measurements_cm JSONB
);

-- ==========================================
-- 1.5. ADD COLUMNS TO EXISTING TABLES (If tables already existed)
-- ==========================================
DO $$ 
BEGIN
    -- Add user_id to all tables (without NOT NULL to prevent errors on existing rows)
    ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
    ALTER TABLE public.splits ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
    ALTER TABLE public.split_exercises ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
    ALTER TABLE public.body_metrics ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

    -- Add missing columns to workouts
    ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS sets_data JSONB;
    ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS session_duration_seconds INTEGER;
    ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS input_weight NUMERIC;
    ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS input_unit TEXT;
    ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS set_duration_seconds INTEGER;
    ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS mechanic_type TEXT;
    ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS machine_used TEXT;
    ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS assisted_muscles JSONB;
    ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS custom_notes TEXT;
    ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS split_id UUID;
    ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS media_url TEXT;

    -- Add missing columns to body_metrics
    ALTER TABLE public.body_metrics ADD COLUMN IF NOT EXISTS bodyweight_kg NUMERIC;
    ALTER TABLE public.body_metrics ADD COLUMN IF NOT EXISTS site_measurements_cm JSONB;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;


-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to prevent "policy already exists" errors
DROP POLICY IF EXISTS "Users can view own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Users can insert own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Users can update own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Users can delete own workouts" ON public.workouts;

DROP POLICY IF EXISTS "Users can view own splits" ON public.splits;
DROP POLICY IF EXISTS "Users can insert own splits" ON public.splits;
DROP POLICY IF EXISTS "Users can update own splits" ON public.splits;
DROP POLICY IF EXISTS "Users can delete own splits" ON public.splits;

DROP POLICY IF EXISTS "Users can view own split exercises" ON public.split_exercises;
DROP POLICY IF EXISTS "Users can insert own split exercises" ON public.split_exercises;
DROP POLICY IF EXISTS "Users can update own split exercises" ON public.split_exercises;
DROP POLICY IF EXISTS "Users can delete own split exercises" ON public.split_exercises;

DROP POLICY IF EXISTS "Users can view own body metrics" ON public.body_metrics;
DROP POLICY IF EXISTS "Users can insert own body metrics" ON public.body_metrics;
DROP POLICY IF EXISTS "Users can update own body metrics" ON public.body_metrics;
DROP POLICY IF EXISTS "Users can delete own body metrics" ON public.body_metrics;

-- 4. Create RLS Policies (Users can only read and write their own data)

-- Workouts Policies
CREATE POLICY "Users can view own workouts" ON public.workouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workouts" ON public.workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workouts" ON public.workouts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workouts" ON public.workouts FOR DELETE USING (auth.uid() = user_id);

-- Splits Policies
CREATE POLICY "Users can view own splits" ON public.splits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own splits" ON public.splits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own splits" ON public.splits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own splits" ON public.splits FOR DELETE USING (auth.uid() = user_id);

-- Split Exercises Policies
CREATE POLICY "Users can view own split exercises" ON public.split_exercises FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own split exercises" ON public.split_exercises FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own split exercises" ON public.split_exercises FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own split exercises" ON public.split_exercises FOR DELETE USING (auth.uid() = user_id);

-- Body Metrics Policies
CREATE POLICY "Users can view own body metrics" ON public.body_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own body metrics" ON public.body_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own body metrics" ON public.body_metrics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own body metrics" ON public.body_metrics FOR DELETE USING (auth.uid() = user_id);
