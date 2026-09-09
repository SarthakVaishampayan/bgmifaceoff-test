-- Add name_changed boolean flag to teams table to enforce 1-time team rename limit
ALTER TABLE teams ADD COLUMN IF NOT EXISTS name_changed BOOLEAN DEFAULT FALSE;
