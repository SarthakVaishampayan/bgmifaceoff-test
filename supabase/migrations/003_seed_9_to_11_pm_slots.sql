-- =============================================
-- BGFS Migration 003 — Seed 9-11 PM Slots (Next 7 Days)
-- =============================================

-- Ensure unique constraint on (date, time_label) so duplicate slots cannot be created
ALTER TABLE slots DROP CONSTRAINT IF EXISTS unique_date_time;
ALTER TABLE slots ADD CONSTRAINT unique_date_time UNIQUE (date, time_label);

-- Seed 9:00 PM - 11:00 PM slots for the next 7 days from execution date
INSERT INTO slots (date, time_label, capacity, teams_booked_count, entry_fee, status, whatsapp_link)
VALUES
  (CURRENT_DATE,     '9:00 PM – 11:00 PM', 20, 0, 50, 'open', 'https://chat.whatsapp.com/KjNw5o6aktB6Xbe3J3ZgYt'),
  (CURRENT_DATE + 1, '9:00 PM – 11:00 PM', 20, 0, 50, 'open', 'https://chat.whatsapp.com/KjNw5o6aktB6Xbe3J3ZgYt'),
  (CURRENT_DATE + 2, '9:00 PM – 11:00 PM', 20, 0, 50, 'open', 'https://chat.whatsapp.com/KjNw5o6aktB6Xbe3J3ZgYt'),
  (CURRENT_DATE + 3, '9:00 PM – 11:00 PM', 20, 0, 50, 'open', 'https://chat.whatsapp.com/KjNw5o6aktB6Xbe3J3ZgYt'),
  (CURRENT_DATE + 4, '9:00 PM – 11:00 PM', 20, 0, 50, 'open', 'https://chat.whatsapp.com/KjNw5o6aktB6Xbe3J3ZgYt'),
  (CURRENT_DATE + 5, '9:00 PM – 11:00 PM', 20, 0, 50, 'open', 'https://chat.whatsapp.com/KjNw5o6aktB6Xbe3J3ZgYt'),
  (CURRENT_DATE + 6, '9:00 PM – 11:00 PM', 20, 0, 50, 'open', 'https://chat.whatsapp.com/KjNw5o6aktB6Xbe3J3ZgYt')
ON CONFLICT (date, time_label) DO NOTHING;
