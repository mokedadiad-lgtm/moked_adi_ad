import type { Metadata, Viewport } from "next";
import { Assistant } from "next/font/google";
import { UiStyleProvider } from "@/components/ui-style-provider";
import "./globals.css";

/** Assistant — גופן עברי עגול ונעים לקריאה (UI); PDF נשאר Heebo */
const assistant = Assistant({
  subsets: ["latin", "hebrew"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: 'פשו"ת שידוך',
  description: "מערכת ניהול שאלות אנונימיות",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: 'פשו"ת שידוך',
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon-192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#c2185b",
};

const uiStyleBootScript = `(function(){try{var k='ui-style';var v=localStorage.getItem(k);if(v!=='classic'&&v!=='fresh')v='fresh';document.documentElement.setAttribute('data-ui-style',v);}catch(e){document.documentElement.setAttribute('data-ui-style','fresh');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={assistant.variable} data-ui-style="fresh" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: uiStyleBootScript }} />
      </head>
      <body className={`${assistant.className} min-h-screen bg-background text-foreground antialiased`}>
        <UiStyleProvider>{children}</UiStyleProvider>
      </body>
    </html>
  );
}
