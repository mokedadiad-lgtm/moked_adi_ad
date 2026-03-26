import { getWaitingQuestionIntakeDrafts } from "@/app/admin/actions";
import { getWhatsappInboxConversations } from "@/lib/whatsapp/inboxService";
import { WhatsappInboxShell } from "@/components/admin/whatsapp-inbox-shell";

export default async function WhatsappInboxPage() {
  const [drafts, conversations] = await Promise.all([
    getWaitingQuestionIntakeDrafts(),
    getWhatsappInboxConversations("all"),
  ]);
  return <WhatsappInboxShell initialConversations={conversations} initialDrafts={drafts} />;
}

