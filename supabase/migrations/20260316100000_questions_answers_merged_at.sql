-- כששאלה נשלחת למספר משיבים, מיזוג התשובות מתבצע בשלב העריכה הלשונית.
-- לאחר המיזוג נשמרת התשובה המאוחדת ב-questions.response_text ו-answers_merged_at מתעדכן.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS answers_merged_at TIMESTAMPTZ NULL;
COMMENT ON COLUMN questions.answers_merged_at IS 'מתי בוצע מיזוג תשובות (כשיש מספר question_answers); עד אז לא ניתן ליצור PDF';