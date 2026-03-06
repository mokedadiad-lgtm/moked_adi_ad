-- Seed default categories so "נושאי תשובה (קטגוריות)" in team management has options.
INSERT INTO categories (id, name_he, slug)
VALUES
  (gen_random_uuid(), 'הלכה', 'halacha'),
  (gen_random_uuid(), 'ייעוץ ורגשות', 'counseling'),
  (gen_random_uuid(), 'משפחה וזוגיות', 'family'),
  (gen_random_uuid(), 'כללי', 'general')
ON CONFLICT (slug) DO NOTHING;
