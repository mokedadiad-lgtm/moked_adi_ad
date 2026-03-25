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
        sans: ["var(--font-heebo)", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#d81b60",
          foreground: "#ffffff",
          hover: "#ad1457",
          muted: "#fce4ec",
        },
        secondary: {
          DEFAULT: "#5c5c78",
          foreground: "#faf7f9",
        },
        background: "#faf7f9",
        foreground: "#2c2c54",
        "muted-foreground": "#75759e",
        card: {
          DEFAULT: "#ffffff",
          border: "#e8e0e5",
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
