-- ================================================================
--  YourPass — Setup Supabase
--  À coller dans : Supabase Dashboard → SQL Editor → New query
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. TABLE PROFILES
--    Stocke les infos supplémentaires des utilisateurs
--    (auth.users gère email + password côté Supabase Auth)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  firstname   TEXT        NOT NULL,
  lastname    TEXT        DEFAULT '',
  email       TEXT        NOT NULL,
  phone       TEXT        DEFAULT '',
  avatar_url  TEXT        DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche par email
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

-- ────────────────────────────────────────────────────────────────
-- 2. ROW LEVEL SECURITY (RLS)
--    Chaque utilisateur ne voit et ne modifie QUE son propre profil
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Lecture : uniquement son propre profil
CREATE POLICY "Lecture profil personnel"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Insertion : uniquement pour soi-même
CREATE POLICY "Création profil personnel"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Mise à jour : uniquement son propre profil
CREATE POLICY "Modification profil personnel"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ────────────────────────────────────────────────────────────────
-- 3. TRIGGER : mise à jour automatique de updated_at
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────────
-- 4. (OPTIONNEL) TABLE TICKETS
--    Pour stocker les billets achetés en base de données
--    au lieu de localStorage uniquement
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tickets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name      TEXT        NOT NULL,
  ticket_type     TEXT        DEFAULT 'Standard',
  amount          INTEGER     NOT NULL,
  transaction_id  TEXT        NOT NULL,
  status          TEXT        DEFAULT 'approved',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture tickets personnels"
  ON public.tickets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Insertion ticket personnel"
  ON public.tickets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════
--  FIN DU SCRIPT
--  Cliquer sur "Run" dans Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════
