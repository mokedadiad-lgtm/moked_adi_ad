"use client";

import Link from "next/link";
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
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant={tab === "conversations" ? "default" : "outline"}
          size="sm"
          className={
            tab === "conversations"
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
          }
          onClick={() => setTab("conversations")}
        >
          שיחות (אנונימי / צוות)
        </Button>
        <Button
          type="button"
          variant={tab === "drafts" ? "default" : "outline"}
          size="sm"
          className={
            tab === "drafts"
              ? "bg-amber-600 text-white hover:bg-amber-700"
              : "border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
          }
          onClick={() => setTab("drafts")}
        >
          טיוטות ממתינות לאישור
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
        >
          <Link href="/admin/whatsapp-bot-demo">דוגמת בוט וואטסאפ</Link>
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

