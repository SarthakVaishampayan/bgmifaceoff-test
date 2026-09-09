-- =============================================
-- BGFS — Battlegrounds Faceoff Series
-- Initial Database Schema
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- CONFIG
-- =============================================
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default config values
INSERT INTO config (key, value) VALUES
  ('grand_finals_date', '2025-09-14T18:00:00+05:30'),
  ('whatsapp_invite_link', 'https://chat.whatsapp.com/your_community_link'),
  ('cycle_start_date', '2025-09-01'),
  ('cycle_end_date', '2025-09-14'),
  ('slot_entry_fee', '50')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- TEAMS
-- =============================================
CREATE TABLE IF NOT EXISTS teams (
  team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name TEXT UNIQUE NOT NULL,
  captain_user_id UUID,
  invite_code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- USERS (extends Supabase auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  display_name TEXT,
  team_id UUID REFERENCES teams(team_id),
  role TEXT DEFAULT 'player' CHECK (role IN ('player', 'captain', 'admin', 'admin_scores')),
  upi_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from teams to users (after users table exists)
ALTER TABLE teams ADD CONSTRAINT fk_captain
  FOREIGN KEY (captain_user_id) REFERENCES users(user_id) ON DELETE SET NULL
  NOT VALID;

-- =============================================
-- SLOTS
-- =============================================
CREATE TABLE IF NOT EXISTS slots (
  slot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  time_label TEXT NOT NULL,
  capacity INT DEFAULT 24,
  teams_booked_count INT DEFAULT 0,
  entry_fee INT DEFAULT 50,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'full', 'completed')),
  room_id TEXT,
  room_password TEXT,
  is_grand_finals BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- COUPONS (defined before bookings for FK)
-- =============================================
CREATE TABLE IF NOT EXISTS coupons (
  coupon_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(team_id) ON DELETE CASCADE,
  type TEXT DEFAULT 'free_slot',
  status TEXT DEFAULT 'unused' CHECK (status IN ('unused', 'used')),
  issued_from_slot UUID REFERENCES slots(slot_id),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- =============================================
-- BOOKINGS
-- =============================================
CREATE TABLE IF NOT EXISTS bookings (
  booking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(team_id) ON DELETE CASCADE,
  slot_id UUID REFERENCES slots(slot_id) ON DELETE CASCADE,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  payment_id TEXT,
  coupon_used BOOLEAN DEFAULT FALSE,
  coupon_id UUID REFERENCES coupons(coupon_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, slot_id)
);

-- =============================================
-- MATCHES
-- =============================================
CREATE TABLE IF NOT EXISTS matches (
  match_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID REFERENCES slots(slot_id) ON DELETE CASCADE,
  match_number INT NOT NULL CHECK (match_number BETWEEN 1 AND 3),
  team_id UUID REFERENCES teams(team_id) ON DELETE CASCADE,
  placement INT CHECK (placement BETWEEN 1 AND 24),
  kills INT DEFAULT 0,
  placement_points INT DEFAULT 0,
  kill_points INT DEFAULT 0,
  total_points INT DEFAULT 0,
  entered_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(slot_id, match_number, team_id)
);

-- =============================================
-- PAYOUTS
-- =============================================
CREATE TABLE IF NOT EXISTS payouts (
  payout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(team_id) ON DELETE CASCADE,
  slot_id UUID REFERENCES slots(slot_id) ON DELETE CASCADE,
  amount INT NOT NULL,
  place TEXT CHECK (place IN ('1st', '2nd')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  upi_id TEXT,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- LEADERBOARD VIEW
-- =============================================
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  t.team_id,
  t.team_name,
  COUNT(m.match_id) AS matches_played,
  COALESCE(SUM(m.total_points), 0) AS total_points_all,
  COALESCE(SUM(m.kills), 0) AS total_kills,
  COALESCE((
    SELECT SUM(pts)
    FROM (
      SELECT total_points AS pts
      FROM matches
      WHERE team_id = t.team_id
      ORDER BY total_points DESC
      LIMIT 16
    ) top16
  ), 0) AS best_16_total
FROM teams t
LEFT JOIN matches m ON m.team_id = t.team_id
GROUP BY t.team_id, t.team_name
ORDER BY best_16_total DESC, total_kills DESC;

-- =============================================
-- FUNCTIONS
-- =============================================

-- Auto-update teams_booked_count when a booking is paid
CREATE OR REPLACE FUNCTION update_slot_booking_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
    UPDATE slots
    SET teams_booked_count = teams_booked_count + 1,
        status = CASE WHEN teams_booked_count + 1 >= capacity THEN 'full' ELSE status END
    WHERE slot_id = NEW.slot_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_slot_booking_count
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_slot_booking_count();

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block signup if profile creation fails — app will handle it
  RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Users: can read own row, update own row, insert own row (safety net alongside handle_new_user trigger)
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Teams: anyone can read (for leaderboard/registration), only captain can update
CREATE POLICY "teams_select_all" ON teams FOR SELECT USING (TRUE);
CREATE POLICY "teams_insert_auth" ON teams FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "teams_update_captain" ON teams FOR UPDATE
  USING (auth.uid() = captain_user_id);

-- Slots: public read, admin write
CREATE POLICY "slots_select_all" ON slots FOR SELECT USING (TRUE);
CREATE POLICY "slots_admin_write" ON slots FOR ALL
  USING ((SELECT role FROM users WHERE user_id = auth.uid()) = 'admin');

-- Bookings: team can see own bookings, admin sees all
CREATE POLICY "bookings_select_own" ON bookings FOR SELECT
  USING (team_id = (SELECT team_id FROM users WHERE user_id = auth.uid())
    OR (SELECT role FROM users WHERE user_id = auth.uid()) = 'admin');
CREATE POLICY "bookings_insert_auth" ON bookings FOR INSERT
  WITH CHECK (team_id = (SELECT team_id FROM users WHERE user_id = auth.uid()));

-- Matches: public read (leaderboard), admin and admin_scores write
CREATE POLICY "matches_select_all" ON matches FOR SELECT USING (TRUE);
CREATE POLICY "matches_admin_write" ON matches FOR ALL
  USING ((SELECT role FROM users WHERE user_id = auth.uid()) IN ('admin', 'admin_scores'));

-- Coupons: own team sees their coupons
CREATE POLICY "coupons_select_own" ON coupons FOR SELECT
  USING (team_id = (SELECT team_id FROM users WHERE user_id = auth.uid())
    OR (SELECT role FROM users WHERE user_id = auth.uid()) = 'admin');

-- Payouts: admin only
CREATE POLICY "payouts_admin_only" ON payouts FOR ALL
  USING ((SELECT role FROM users WHERE user_id = auth.uid()) = 'admin');

-- Config: public read
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_select_all" ON config FOR SELECT USING (TRUE);
CREATE POLICY "config_admin_write" ON config FOR ALL
  USING ((SELECT role FROM users WHERE user_id = auth.uid()) = 'admin');
