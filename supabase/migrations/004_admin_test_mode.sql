-- =============================================
-- BGFS — Migration 004: Admin Test Mode
-- =============================================

-- Add is_test_account to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN DEFAULT FALSE;

-- Add is_test_account to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN DEFAULT FALSE;

-- Add is_test_booking to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_test_booking BOOLEAN DEFAULT FALSE;

-- Index for fast filtering in admin dashboard and stats
CREATE INDEX IF NOT EXISTS idx_bookings_is_test_booking ON bookings(is_test_booking);
CREATE INDEX IF NOT EXISTS idx_users_is_test_account ON users(is_test_account);
CREATE INDEX IF NOT EXISTS idx_teams_is_test_account ON teams(is_test_account);
