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

-- Disable Row Level Security (RLS) for testing or enable basic access
-- To keep it simple and match the request where "anyone logged in can edit",
-- you can set up simple policies or disable RLS:
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Allow all actions for authenticated users on materials"
ON public.materials FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all actions for authenticated users on transactions"
ON public.transactions FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all actions for profiles"
ON public.profiles FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
