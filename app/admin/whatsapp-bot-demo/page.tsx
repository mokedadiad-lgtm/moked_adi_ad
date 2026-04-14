import { WhatsappBotDemoClient } from "@/components/admin/whatsapp-bot-demo-client";
import { buildWhatsAppBotDemoBubbles } from "@/lib/whatsapp/botFlowDemoScript";

export const metadata = {
  title: "דוגמת בוט וואטסאפ",
};

export default function WhatsappBotDemoPage() {
  const bubblesM = buildWhatsAppBotDemoBubbles("M");
  const bubblesF = buildWhatsAppBotDemoBubbles("F");
  return <WhatsappBotDemoClient bubblesM={bubblesM} bubblesF={bubblesF} />;
}
