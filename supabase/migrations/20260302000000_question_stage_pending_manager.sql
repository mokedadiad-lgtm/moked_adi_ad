-- Add stage: בהמתנה אצל מנהל המערכת (when proofreader returns with note)
ALTER TYPE question_stage ADD VALUE IF NOT EXISTS 'pending_manager';

COMMENT ON TYPE question_stage IS 'Workflow stages; pending_manager = returned by proofreader to manager with note (no card in dashboard, red row in table)';
