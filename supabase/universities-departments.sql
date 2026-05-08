-- ============================================================
-- Universities + Departments (admin-managed taxonomy)
-- ============================================================
-- Run this once in the Supabase SQL editor on top of schema.sql.

CREATE TABLE IF NOT EXISTS public.universities (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  short_name  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_universities_name ON public.universities(name);

DROP TRIGGER IF EXISTS universities_updated_at ON public.universities;
CREATE TRIGGER universities_updated_at BEFORE UPDATE ON public.universities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS public.departments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id  UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (university_id, name)
);

CREATE INDEX IF NOT EXISTS idx_departments_university ON public.departments(university_id);

DROP TRIGGER IF EXISTS departments_updated_at ON public.departments;
CREATE TRIGGER departments_updated_at BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: anyone can read, only admins can write
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "universities_select_all"   ON public.universities;
DROP POLICY IF EXISTS "universities_admin_write"  ON public.universities;
CREATE POLICY "universities_select_all"  ON public.universities FOR SELECT USING (true);
CREATE POLICY "universities_admin_write" ON public.universities FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "departments_select_all"   ON public.departments;
DROP POLICY IF EXISTS "departments_admin_write"  ON public.departments;
CREATE POLICY "departments_select_all"  ON public.departments FOR SELECT USING (true);
CREATE POLICY "departments_admin_write" ON public.departments FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.universities TO anon, authenticated;
GRANT SELECT ON public.departments  TO anon, authenticated;
GRANT ALL    ON public.universities TO service_role;
GRANT ALL    ON public.departments  TO service_role;

-- Seed universities + departments from any existing courses so nothing is lost
INSERT INTO public.universities (name)
  SELECT DISTINCT school FROM public.courses
  WHERE school IS NOT NULL AND school <> ''
  ON CONFLICT (name) DO NOTHING;

INSERT INTO public.departments (university_id, name)
  SELECT u.id, c.department
  FROM public.courses c
  JOIN public.universities u ON u.name = c.school
  WHERE c.department IS NOT NULL AND c.department <> ''
  GROUP BY u.id, c.department
  ON CONFLICT (university_id, name) DO NOTHING;

-- ============================================================
-- Storage buckets — idempotent; fixes "Bucket not found" on upload
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('exam-uploads', 'exam-uploads', false)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;
