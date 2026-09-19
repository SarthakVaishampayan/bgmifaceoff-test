-- Migration: 007_slot_prize_pool.sql
-- Add prize pool columns to slots table with defaults and insert default prize config

ALTER TABLE slots
ADD COLUMN IF NOT EXISTS first_prize INT DEFAULT 200,
ADD COLUMN IF NOT EXISTS second_prize INT DEFAULT 150;

-- Insert default global prize config if not exists
INSERT INTO config (key, value) VALUES
  ('slot_first_prize', '200'),
  ('slot_second_prize', '150')
ON CONFLICT (key) DO NOTHING;
