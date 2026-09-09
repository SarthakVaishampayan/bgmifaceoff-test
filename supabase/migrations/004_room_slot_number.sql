-- Migration: 004_room_slot_number.sql
-- Adds room_slot_number column to bookings table for in-game custom room slot assignment (starts at Slot 5)

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_slot_number INT;

-- Backfill room_slot_number for existing paid bookings (First Come First Serve starting from 5)
WITH ranked_bookings AS (
  SELECT
    booking_id,
    4 + ROW_NUMBER() OVER (PARTITION BY slot_id ORDER BY created_at ASC) AS calc_slot
  FROM bookings
  WHERE payment_status = 'paid'
)
UPDATE bookings b
SET room_slot_number = rb.calc_slot
FROM ranked_bookings rb
WHERE b.booking_id = rb.booking_id
  AND b.room_slot_number IS NULL;

-- Ensure leaderboard view lists all teams with paid bookings
DROP VIEW IF EXISTS leaderboard CASCADE;
CREATE VIEW leaderboard AS
WITH slot_totals AS (
  SELECT
    m.team_id,
    m.slot_id,
    SUM(m.total_points) AS slot_points,
    ROW_NUMBER() OVER (PARTITION BY m.team_id ORDER BY SUM(m.total_points) DESC) AS slot_rank
  FROM matches m
  GROUP BY m.team_id, m.slot_id
),
top5_slots AS (
  SELECT
    team_id,
    SUM(slot_points) AS best_5_slots_points
  FROM slot_totals
  WHERE slot_rank <= 5
  GROUP BY team_id
)
SELECT
  t.team_id,
  t.team_name,
  COUNT(DISTINCT m.match_id) AS matches_played,
  COALESCE(SUM(m.kills), 0) AS total_kills,
  COALESCE(t5.best_5_slots_points, 0) AS best_16_total
FROM teams t
INNER JOIN bookings b ON b.team_id = t.team_id AND b.payment_status = 'paid'
LEFT JOIN matches m ON m.team_id = t.team_id
LEFT JOIN top5_slots t5 ON t5.team_id = t.team_id
GROUP BY t.team_id, t.team_name, t5.best_5_slots_points
ORDER BY best_16_total DESC, total_kills DESC;
