export type QuestionStage =
  | "waiting_assignment"
  | "with_respondent"
  | "in_proofreading_lobby"
  | "in_linguistic_review"
  | "ready_for_sending"
  | "pending_manager"
  | "sent_archived";

export const STAGE_LABELS: Record<QuestionStage, string> = {
  waiting_assignment: "מחכה לשיבוץ",
  with_respondent: "אצל משיב/ה",
  in_proofreading_lobby: "בלובי ההגהה",
  in_linguistic_review: "בעריכה לשונית",
  ready_for_sending: "מוכן לשליחה",
  pending_manager: "בהמתנה אצל מנהל המערכת",
  sent_archived: "נשלח ואורכב",
};

export const STAGE_ORDER: QuestionStage[] = [
  "waiting_assignment",
  "with_respondent",
  "in_proofreading_lobby",
  "in_linguistic_review",
  "ready_for_sending",
  "pending_manager",
  "sent_archived",
];

/** Stages that have a card at top of dashboard (excludes pending_manager and sent_archived) */
export const ACTIVE_STAGES: QuestionStage[] = [
  "waiting_assignment",
  "with_respondent",
  "in_proofreading_lobby",
  "in_linguistic_review",
  "ready_for_sending",
];

/** Stages to fetch for admin table (active + pending_manager) */
export const ADMIN_TABLE_STAGES: QuestionStage[] = [...ACTIVE_STAGES, "pending_manager"];

export interface QuestionRow {
  id: string;
  /** Display ID: 2 letters + 4 digits (e.g. AB1234) */
  short_id?: string | null;
  stage: QuestionStage;
  /** כותרת השאלה (מטופס השואל) */
  title?: string | null;
  content: string;
  created_at: string;
  sent_at?: string | null;
  asker_email?: string | null;
  asker_age: string | null;
  asker_gender?: "M" | "F" | null;
  response_type: "short" | "detailed" | null;
  publication_consent?: "publish" | "blur" | "none" | null;
  respondent_name?: string | null;
  proofreader_name?: string | null;
  topic_id?: string | null;
  sub_topic_id?: string | null;
  topic_name_he?: string | null;
  sub_topic_name_he?: string | null;
  response_text?: string | null;
  proofreader_note?: string | null;
  pdf_url?: string | null;
  /** מתי נוצר ה-PDF לאחרונה (להצגה ליד כפתור יצירת PDF) */
  pdf_generated_at?: string | null;
  /** סוג הגהה (מהנושא) — לפירוט בכרטיס לובי ההגהה */
  proofreader_type_id?: string | null;
  deleted_at?: string | null;
}
