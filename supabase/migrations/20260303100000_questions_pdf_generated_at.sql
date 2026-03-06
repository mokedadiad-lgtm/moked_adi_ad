-- מתי נוצר ה-PDF לאחרונה (להצגה ליד כפתור יצירת PDF)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMPTZ;
