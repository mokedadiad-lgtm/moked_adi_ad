import { getWaitingQuestionIntakeDrafts } from "@/app/admin/actions";
import { WhatsappInboxClient } from "@/components/admin/whatsapp-inbox-client";

export default async function WhatsappInboxPage() {
  const drafts = await getWaitingQuestionIntakeDrafts();
  return <WhatsappInboxClient initialDrafts={drafts} />;
}

