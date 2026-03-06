-- הגבלת INSERT ל-question_response_versions: רק כאשר edited_by = auth.uid()
-- (הטריגר save_response_version מכניס עם edited_by = auth.uid(), כך שהמדיניות מאפשרת את ההכנסה)
DROP POLICY IF EXISTS question_response_versions_insert ON question_response_versions;
CREATE POLICY question_response_versions_insert ON question_response_versions
  FOR INSERT TO authenticated
  WITH CHECK (edited_by = auth.uid());
