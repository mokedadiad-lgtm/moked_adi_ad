export type QuestionStage =
  | "waiting_assignment"
  | "with_respondent"
  | "in_proofreading_lobby"
  | "in_linguistic_review"
  | "ready_for_sending"
  | "sent_archived";

export const STAGE_LABELS: Record<QuestionStage, string> = {
  waiting_assignment: "מחכה לשיבוץ",
  with_respondent: "אצל משיב/ה",
  in_proofreading_lobby: "בלובי ההגהה",
  in_linguistic_review: "בעריכה לשונית",
  ready_for_sending: "מוכן לשליחה",
  sent_archived: "נשלח ואורכב",
};

export const STAGE_ORDER: QuestionStage[] = [
  "waiting_assignment",
  "with_respondent",
  "in_proofreading_lobby",
  "in_linguistic_review",
  "ready_for_sending",
  "sent_archived",
];

/** First 5 stages (active tasks only; exclude sent_archived) */
export const ACTIVE_STAGES: QuestionStage[] = STAGE_ORDER.slice(0, 5);

export interface QuestionRow {
  id: string;
  stage: QuestionStage;
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
}
