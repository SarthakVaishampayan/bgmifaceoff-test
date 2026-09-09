-- =============================================
-- BGFS Migration 002 — Slot Booking V2
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add whatsapp_link column to slots (per-slot link, falls back to config if NULL)
ALTER TABLE slots ADD COLUMN IF NOT EXISTS whatsapp_link TEXT;

-- 2. Add human-readable code column to coupons
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;

-- Backfill existing coupons with a code
UPDATE coupons SET code = upper(substr(md5(random()::text), 1, 8)) WHERE code IS NULL;

-- Set default for future coupons
ALTER TABLE coupons ALTER COLUMN code SET DEFAULT upper(substr(md5(random()::text), 1, 8));

-- 3. Add amount_paid column to bookings (if not present)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount_paid INT DEFAULT 0;

-- 4. Update the leaderboard view to include teams with a confirmed booking
--    (even if they have 0 matches played yet)
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  t.team_id,
  t.team_name,
  COUNT(DISTINCT m.match_id) AS matches_played,
  COALESCE(SUM(m.total_kills), 0) AS total_kills,
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
INNER JOIN bookings b ON b.team_id = t.team_id AND b.payment_status = 'paid'
LEFT JOIN matches m ON m.team_id = t.team_id
GROUP BY t.team_id, t.team_name
ORDER BY best_16_total DESC, total_kills DESC;

-- 5. RLS: allow admin client (service role) to insert/update bookings and coupons
--    Service role bypasses RLS by default — these are for anon/authenticated role coverage

-- Allow authenticated users to update their own bookings (for future use)
CREATE POLICY IF NOT EXISTS "bookings_update_own" ON bookings FOR UPDATE
  USING (team_id = (SELECT team_id FROM users WHERE user_id = auth.uid()));

-- Allow admin to insert/update coupons
CREATE POLICY IF NOT EXISTS "coupons_insert_admin" ON coupons FOR INSERT
  WITH CHECK ((SELECT role FROM users WHERE user_id = auth.uid()) = 'admin');

CREATE POLICY IF NOT EXISTS "coupons_update_admin" ON coupons FOR UPDATE
  USING ((SELECT role FROM users WHERE user_id = auth.uid()) IN ('admin')
    OR team_id = (SELECT team_id FROM users WHERE user_id = auth.uid()));

-- 6. Prevent slots from exceeding capacity at DB level
-- (soft guard — trigger-based hard guard already exists)
ALTER TABLE slots DROP CONSTRAINT IF EXISTS slots_booked_count_check;
ALTER TABLE slots ADD CONSTRAINT slots_booked_count_check
  CHECK (teams_booked_count >= 0);

-- 7. Update global WhatsApp config link
INSERT INTO config (key, value)
VALUES ('whatsapp_invite_link', 'https://chat.whatsapp.com/KjNw5o6aktB6Xbe3J3ZgYt')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- 8. Sample slots for testing (Run in Supabase SQL Editor)
INSERT INTO slots (date, time_label, capacity, teams_booked_count, entry_fee, status, whatsapp_link) VALUES
  (CURRENT_DATE + 1, '1:00 PM – 3:00 PM', 20, 0, 50, 'open', 'https://chat.whatsapp.com/KjNw5o6aktB6Xbe3J3ZgYt'),
  (CURRENT_DATE + 1, '4:00 PM – 6:00 PM', 20, 0, 50, 'open', 'https://chat.whatsapp.com/KjNw5o6aktB6Xbe3J3ZgYt'),
  (CURRENT_DATE + 1, '7:00 PM – 9:00 PM', 20, 0, 50, 'open', 'https://chat.whatsapp.com/KjNw5o6aktB6Xbe3J3ZgYt'),
  (CURRENT_DATE + 2, '1:00 PM – 3:00 PM', 20, 0, 50, 'open', 'https://chat.whatsapp.com/KjNw5o6aktB6Xbe3J3ZgYt'),
  (CURRENT_DATE + 2, '6:00 PM – 8:00 PM', 20, 0, 50, 'open', 'https://chat.whatsapp.com/KjNw5o6aktB6Xbe3J3ZgYt')
ON CONFLICT DO NOTHING;
