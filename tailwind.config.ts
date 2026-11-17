import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Assistant", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          hover: "var(--primary-hover)",
          muted: "var(--accent)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--background)",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        accent: "var(--accent)",
        border: "var(--border)",
        ring: "var(--ring)",
        card: {
          DEFAULT: "var(--card)",
          border: "var(--card-border)",
        },
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
        dialog: "var(--shadow-dialog)",
      },
      backgroundImage: {
        "app-atmosphere": "var(--app-atmosphere)",
      },
    },
  },
  plugins: [],
};

export default config;
