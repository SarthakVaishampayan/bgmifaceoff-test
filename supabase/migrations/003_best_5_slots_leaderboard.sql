-- Migration: 003_best_5_slots_leaderboard.sql
-- Updates leaderboard view so that a team's top 5 highest-scoring SLOTS (3 matches per slot = 15 matches total) are summed for the overall leaderboard standing.

CREATE OR REPLACE VIEW leaderboard AS
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
  COALESCE(SUM(m.total_kills), 0) AS total_kills,
  COALESCE(t5.best_5_slots_points, 0) AS best_16_total
FROM teams t
INNER JOIN bookings b ON b.team_id = t.team_id AND b.payment_status = 'paid'
LEFT JOIN matches m ON m.team_id = t.team_id
LEFT JOIN top5_slots t5 ON t5.team_id = t.team_id
GROUP BY t.team_id, t.team_name, t5.best_5_slots_points
ORDER BY best_16_total DESC, total_kills DESC;
