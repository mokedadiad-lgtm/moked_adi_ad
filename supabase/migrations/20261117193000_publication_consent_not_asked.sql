-- New publication consent value: asker was not asked about publishing
ALTER TYPE publication_consent ADD VALUE IF NOT EXISTS 'not_asked';

COMMENT ON COLUMN questions.publication_consent IS 'מסכימ/ה לפרסם / בטשטוש / לא לפרסום / לא נשאל';
