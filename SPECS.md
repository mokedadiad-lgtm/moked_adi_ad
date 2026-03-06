📝 System Specification: Anonymous Q&A Management System (2026 Edition)
1. Overview & Vision
A high-end, secure, and RTL-optimized management system designed to handle anonymous inquiries. The system facilitates a professional workflow from initial question intake to a finalized, styled PDF response.

Core Goal: Professionalism, anonymity, and efficiency.

Aesthetic: Modern, innovative, clean, and "calm" UI (using high-end Shadcn UI components and Framer Motion for smooth transitions).

2. Technical Stack
Framework: Next.js 15 (App Router).

Database & Auth: Supabase (PostgreSQL, RLS, Edge Functions).

Styling: Tailwind CSS + shadcn/ui (Modern/Innovative look).

Notifications: WhatsApp Cloud API & Resend (Email).

PDF Engine: @react-pdf/renderer for high-quality, styled documents.

3. User Roles & Entity Logic
Every user (except the Admin) must have the following metadata:

Gender: Male/Female (Used for dynamic UI strings: "משיב/ה", "מגיה/ה").

Capabilities: Boolean flags for is_respondent and is_proofreader.

Categories: List of assigned topics (e.g., Halacha, Counseling, Technical).

Proofreader Type: Categorization for the lobby (e.g., Content, Professional, Stylistic).

Communication Preference: WhatsApp, Email, or Both.

Constraints for Respondents:
Concurrency Limit: Max number of active questions handled simultaneously.

Cooldown Period: Minimum days required between receiving new questions.

Admin Note: Ability to receive a personal instruction from the Admin during assignment.

4. The 6-Stage Workflow
The system MUST strictly follow these stages in the database:

Waiting for Assignment (מחכה לשיבוץ): New anonymous question landed.

With Respondent (אצל משיב/ה): Assigned to a specific person; link sent via WhatsApp/Email.

In Proofreading Lobby (בלובי ההגהה): Answered; waiting for a proofreader of the matching type to "claim" it.

In Linguistic Review (בעריכה לשונית): Proofread; returned to the Admin (Linguistic Editor) for final polish.

Ready for Sending (מוכן לשליחה): Edited; PDF generated; awaiting final Admin "Send" click.

Sent & Archived (נשלח ואורכב): PDF emailed to the asker; question moved to the searchable archive.

5. UI/UX & Design Language
RTL First: Full support for Hebrew using Tailwind logical properties.

Gender-Dynamic UI: The system must detect the user's gender and render all labels accordingly (e.g., "שלום משיבה" vs "שלום משיב").

Admin Dashboard: Visual "Pipeline" view showing how many questions are in each stage.

Lobby Interaction: "Claim" (locks task), "Release" (returns to lobby quietly), and "Return to Admin" (escalates with a note).

Innovation: Use subtle blurs (Glassmorphism), elegant shadcn-inspired tables, and a high-quality color palette (Soft Blues/Greys until the logo is ready).

6. Automations & Alerts (Cron Jobs)
5-Day Inactivity: Trigger a reminder to Respondents/Proofreaders if a task is untouched for 5 days.

Daily Lobby Summary: Send a morning summary to Proofreaders only if there are pending tasks in their specific "Type".

Assignment Link: Links are token-based and expire immediately if the Admin reassigns the task to another user.

7. Security & Privacy
Anonymity: Proofreaders cannot see the identity of the Respondent.

Access Control: Supabase RLS policies must ensure users only see tasks assigned to them or available in their allowed lobby types.

Token Invalidation: When reassigned, the old access token must be invalidated globally.