import { getWaitingQuestionIntakeDrafts } from "@/app/admin/actions";
import { getWhatsappInboxConversations } from "@/lib/whatsapp/inboxService";
import { WhatsappInboxShell } from "@/components/admin/whatsapp-inbox-shell";

export default async function WhatsappInboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    conversationId?: string;
    unreadAnchorAt?: string;
    draftId?: string;
  }>;
}) {
  const params = await searchParams;
  const hasDraftId =
    typeof params.draftId === "string" && params.draftId.trim().length > 0;
  const initialTab =
    params.tab === "drafts" || hasDraftId ? "drafts" : "conversations";
  const initialConversationId =
    typeof params.conversationId === "string" && params.conversationId.trim().length > 0
      ? params.conversationId
      : null;
  const initialUnreadAnchorAt =
    typeof params.unreadAnchorAt === "string" && params.unreadAnchorAt.trim().length > 0
      ? params.unreadAnchorAt
      : null;
  const initialDraftId =
    typeof params.draftId === "string" && params.draftId.trim().length > 0 ? params.draftId.trim() : null;

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
      initialDraftId={initialDraftId}
    />
  );
}

