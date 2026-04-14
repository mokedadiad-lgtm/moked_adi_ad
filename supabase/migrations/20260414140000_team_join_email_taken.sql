-- בדיקה האם כתובת אימייל כבר רשומה ב-Auth (למניעת הצטרפות כפולה מטופס ציבורי)
CREATE OR REPLACE FUNCTION public.team_join_email_taken(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE lower(trim(COALESCE(u.email::text, ''))) = lower(trim(COALESCE(p_email, '')))
  );
$$;

REVOKE ALL ON FUNCTION public.team_join_email_taken(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.team_join_email_taken(text) TO service_role;

COMMENT ON FUNCTION public.team_join_email_taken(text) IS 'נקרא מ-API team/join (service role) — האם האימייל כבר קיים ב-auth.users';
