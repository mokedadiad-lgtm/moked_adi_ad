-- Backfill question_answers from existing questions that have an assignment (respondent or topic).
-- After this, the app will use question_answers for these questions; questions table keeps columns for backward compatibility.

INSERT INTO question_answers (
  question_id,
  topic_id,
  sub_topic_id,
  assigned_respondent_id,
  assigned_proofreader_id,
  proofreader_type_id,
  stage,
  response_text,
  proofreader_note,
  pdf_url,
  pdf_generated_at,
  created_at,
  updated_at
)
SELECT
  q.id,
  q.topic_id,
  q.sub_topic_id,
  q.assigned_respondent_id,
  q.assigned_proofreader_id,
  q.proofreader_type_id,
  q.stage,
  q.response_text,
  q.proofreader_note,
  NULL,
  NULL,
  q.created_at,
  q.updated_at
FROM questions q
WHERE q.deleted_at IS NULL
  AND (q.assigned_respondent_id IS NOT NULL OR q.topic_id IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM question_answers qa WHERE qa.question_id = q.id
  );
