-- Create materials table
CREATE TABLE IF NOT EXISTS public.materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  quantity NUMERIC DEFAULT 0,
  max_quantity NUMERIC DEFAULT 100,
  unit TEXT DEFAULT 'db',
  category TEXT,
  location TEXT,
  image_url TEXT,
  qr_code_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id TEXT REFERENCES public.materials(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'intake' or 'checkout'
  quantity NUMERIC NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_name TEXT NOT NULL,
  notes TEXT
);

-- Create profiles table (optional, for role-based features)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'operator', -- 'admin' or 'operator'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users (with DROP IF EXISTS to avoid errors on re-running)
DROP POLICY IF EXISTS "Allow all actions for authenticated users on materials" ON public.materials;
CREATE POLICY "Allow all actions for authenticated users on materials"
  ON public.materials FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all actions for authenticated users on transactions" ON public.transactions;
CREATE POLICY "Allow all actions for authenticated users on transactions"
  ON public.transactions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all actions for profiles" ON public.profiles;
CREATE POLICY "Allow all actions for profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Migration helper: If access_requests table exists, migrate it to allowed_emails and fix columns
DO $$
BEGIN
  -- If access_requests table exists, rename to allowed_emails
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'access_requests') 
     AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'allowed_emails') THEN
    ALTER TABLE public.access_requests RENAME TO allowed_emails;
  END IF;

  -- Ensure created_at column exists in allowed_emails
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'allowed_emails') THEN
    -- If requested_at column exists, rename to created_at
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='allowed_emails' AND column_name='requested_at')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='allowed_emails' AND column_name='created_at') THEN
      ALTER TABLE public.allowed_emails RENAME COLUMN requested_at TO created_at;
    END IF;

    -- Add created_at column if it still doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='allowed_emails' AND column_name='created_at') THEN
      ALTER TABLE public.allowed_emails ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
  END IF;
END $$;

-- Create allowed_emails table for pre-authorized user registration & login
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Allow public/authenticated users to view and manage allowed_emails
DROP POLICY IF EXISTS "Allow public select on allowed_emails" ON public.allowed_emails;
CREATE POLICY "Allow public select on allowed_emails"
  ON public.allowed_emails FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Pre-approve default system accounts
INSERT INTO public.allowed_emails (email, name)
VALUES 
  ('kovacs.gabor@ceg.hu', 'Kovács Gábor'),
  ('kezelo.janos@ceg.hu', 'Kezelő János')
ON CONFLICT (email) DO NOTHING;

-- Create a trigger to automatically create a profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'Új Felhasználó'),
    COALESCE(new.raw_user_meta_data->>'role', 'operator')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create RPC function to retrieve database and table size stats for administrators
CREATE OR REPLACE FUNCTION public.get_database_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  db_size BIGINT;
  trans_size BIGINT;
  mats_size BIGINT;
  profs_size BIGINT;
BEGIN
  -- Total database size
  SELECT pg_database_size(current_database()) INTO db_size;
  
  -- Table sizes including index footprints
  SELECT pg_total_relation_size('public.transactions') INTO trans_size;
  SELECT pg_total_relation_size('public.materials') INTO mats_size;
  SELECT pg_total_relation_size('public.profiles') INTO profs_size;
  
  RETURN jsonb_build_object(
    'db_size_bytes', db_size,
    'transactions_size_bytes', trans_size,
    'materials_size_bytes', mats_size,
    'profiles_size_bytes', profs_size
  );
END;
$$;
