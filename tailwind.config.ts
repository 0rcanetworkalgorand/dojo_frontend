import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "dojo-bg": "#FAF9F5",
        "dojo-surface": "#FFFFFF",
        "dojo-teal": "#00BFA5",
        "dojo-gold": "#EAB308",
        "dojo-success": "#10B981",
        "dojo-text": "#111827",
        "dojo-heading": "#0F172A",
        "dojo-research": "#6366F1",
        "dojo-code": "#10B981",
        "dojo-data": "#0EA5E9",
        "dojo-outreach": "#F59E0B",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        heading: ["var(--font-satoshi)", "Satoshi", "var(--font-inter)", "Inter", "sans-serif"],
      },
      boxShadow: {
        "dojo-card": "0 2px 12px rgba(0,0,0,0.06)",
        "dojo-hover": "0 0 0 2px rgba(0,191,165,0.20)",
        "dojo-pill": "0 4px 14px 0 rgba(0, 191, 165, 0.15)",
      },
      borderRadius: {
        "dojo-card": "16px",
        "dojo-button": "12px",
        "dojo-modal": "24px",
      },
    },
  },
  plugins: [],
};
export default config;
