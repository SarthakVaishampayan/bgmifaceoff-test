-- Allow 'closed' in slots status check constraint
ALTER TABLE slots DROP CONSTRAINT IF EXISTS slots_status_check;
ALTER TABLE slots ADD CONSTRAINT slots_status_check CHECK (status IN ('open', 'full', 'completed', 'closed'));
