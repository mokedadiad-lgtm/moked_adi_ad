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
      colors: {
        primary: {
          DEFAULT: "#4f46e5",
          foreground: "#ffffff",
          hover: "#4338ca",
          muted: "#eef2ff",
        },
        secondary: {
          DEFAULT: "#64748b",
          foreground: "#f8fafc",
        },
        background: "#f8fafc",
        card: {
          DEFAULT: "#ffffff",
          border: "#e2e8f0",
        },
      },
      borderRadius: {
        DEFAULT: "0.75rem",
      },
      boxShadow: {
        soft: "0 2px 15px -3px rgb(0 0 0 / 0.06), 0 4px 6px -4px rgb(0 0 0 / 0.04)",
        card: "0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)",
        dialog: "0 25px 50px -12px rgb(0 0 0 / 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
