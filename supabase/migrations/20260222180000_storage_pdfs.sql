-- Bucket לאחסון קבצי PDF: ליצור ידנית ב-Dashboard → Storage → New bucket
-- שם: response-pdfs, גישה: Public. אחרי היצירה המדיניות למטה תחול.
-- (ב-Supabase Cloud אין תמיכה ב-storage.create_bucket ב-SQL.)

-- העלאה: משתמשים מאומתים (ובפועל האפליקציה עם service role)
DROP POLICY IF EXISTS "Allow authenticated upload response-pdfs" ON storage.objects;
CREATE POLICY "Allow authenticated upload response-pdfs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'response-pdfs');

-- קריאה: כולם (כי ה-bucket ציבורי)
DROP POLICY IF EXISTS "Public read response-pdfs" ON storage.objects;
CREATE POLICY "Public read response-pdfs" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'response-pdfs');
