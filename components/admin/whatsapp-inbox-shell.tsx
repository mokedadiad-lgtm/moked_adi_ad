"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WhatsappConversationsClient } from "@/components/admin/whatsapp-conversations-client";
import { WhatsappInboxClient } from "@/components/admin/whatsapp-inbox-client";

type ConversationsProps = React.ComponentProps<typeof WhatsappConversationsClient>;
type DraftsProps = React.ComponentProps<typeof WhatsappInboxClient>;

export function WhatsappInboxShell({
  initialConversations,
  initialDrafts,
}: {
  initialConversations: ConversationsProps["initialConversations"];
  initialDrafts: DraftsProps["initialDrafts"];
}) {
  const [tab, setTab] = useState<"conversations" | "drafts">("conversations");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={tab === "conversations" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("conversations")}
        >
          שיחות (אנונימי / צוות)
        </Button>
        <Button
          type="button"
          variant={tab === "drafts" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("drafts")}
        >
          טיוטות ממתינות לאישור
        </Button>
      </div>

      {tab === "conversations" ? (
        <WhatsappConversationsClient initialConversations={initialConversations} />
      ) : (
        <WhatsappInboxClient initialDrafts={initialDrafts} />
      )}
    </div>
  );
}

