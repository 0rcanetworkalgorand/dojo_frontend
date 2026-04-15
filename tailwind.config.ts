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
        "dojo-bg": "#050505",
        "dojo-surface": "#0D0D0D",
        "dojo-teal": "#00F5D4",
        "dojo-gold": "#FFD700",
        "dojo-success": "#00F5D4",
        "dojo-text": "#E5E5E5",
        "dojo-heading": "#FFFFFF",
        "dojo-research": "#A78BFA",
        "dojo-code": "#00F5D4",
        "dojo-data": "#38BDF8",
        "dojo-outreach": "#FB923C",
        "border": "rgba(255, 255, 255, 0.1)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        heading: ["var(--font-satoshi)", "Satoshi", "var(--font-inter)", "Inter", "sans-serif"],
      },
      letterSpacing: {
        tighter: "-0.05em",
        tight: "-0.02em",
      },
      boxShadow: {
        "dojo-card": "0 0 0 1px rgba(255, 255, 255, 0.05), 0 8px 32px rgba(0, 0, 0, 0.4)",
        "dojo-hover": "0 0 0 1px rgba(0, 245, 212, 0.5), 0 0 40px rgba(0, 245, 212, 0.3)",
        "dojo-stat-hover": "0 0 0 1px rgba(0, 245, 212, 1), 0 0 40px rgba(0, 245, 212, 0.5)",
        "dojo-glow": "0 0 30px rgba(0, 245, 212, 0.35)",
      },
      borderRadius: {
        "dojo-card": "24px",
        "dojo-button": "9999px",
        "dojo-modal": "32px",
      },
    },
  },
  plugins: [],
};
export default config;
