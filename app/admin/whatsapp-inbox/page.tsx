import { getWaitingQuestionIntakeDrafts } from "@/app/admin/actions";
import { getWhatsappInboxConversations } from "@/lib/whatsapp/inboxService";
import { WhatsappInboxShell } from "@/components/admin/whatsapp-inbox-shell";

export default async function WhatsappInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; conversationId?: string; unreadAnchorAt?: string }>;
}) {
  const params = await searchParams;
  const initialTab = params.tab === "drafts" ? "drafts" : "conversations";
  const initialConversationId =
    typeof params.conversationId === "string" && params.conversationId.trim().length > 0
      ? params.conversationId
      : null;
  const initialUnreadAnchorAt =
    typeof params.unreadAnchorAt === "string" && params.unreadAnchorAt.trim().length > 0
      ? params.unreadAnchorAt
      : null;

  const [drafts, conversations] = await Promise.all([
    getWaitingQuestionIntakeDrafts(),
    getWhatsappInboxConversations("all"),
  ]);
  return (
    <WhatsappInboxShell
      initialConversations={conversations}
      initialDrafts={drafts}
      initialTab={initialTab}
      initialConversationId={initialConversationId}
      initialUnreadAnchorAt={initialUnreadAnchorAt}
    />
  );
}

