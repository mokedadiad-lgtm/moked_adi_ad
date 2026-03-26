/**
 * יוצר מפתחות VAPID ושומר ל־vapid-keys.txt (לא בגיט)
 * הרצה: npm run save-vapid-keys
 */
import fs from "fs";
import path from "path";
import webpush from "web-push";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "vapid-keys.txt");

const keys = webpush.generateVAPIDKeys();

const body = `מפתחות VAPID (נוצרו עכשיו — שמור בסוד, אל תעלה לגיט)

Public Key:
${keys.publicKey}

Private Key:
${keys.privateKey}

───────── העתק לקובץ .env.local (ושנה את mailto לכתובת אמיתית) ─────────

NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}
VAPID_PRIVATE_KEY=${keys.privateKey}
VAPID_SUBJECT=mailto:you@example.com
`;

fs.writeFileSync(outPath, body, "utf8");
console.log("נשמר:", outPath);
console.log("פתח את הקובץ בעורך והעתק את השורות מ־NEXT_PUBLIC_…");
