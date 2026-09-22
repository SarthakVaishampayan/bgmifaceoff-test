-- Allow 3rd place in payouts check constraint
ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_place_check;
ALTER TABLE payouts ADD CONSTRAINT payouts_place_check CHECK (place IN ('1st', '2nd', '3rd'));
