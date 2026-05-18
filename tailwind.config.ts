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
        // Core neutrals
        "background": "#FAFAF8",
        "foreground": "#0A0A0B",
        
        // Surface layers
        "surface": "#FFFFFF",
        "surface-elevated": "#F5F5F3",
        "surface-sunken": "#EEEEEC",
        
        // Swiss banking navy (primary accent)
        "navy": {
          50: "#F0F4F8",
          100: "#D9E2EC",
          200: "#BCCCDC",
          300: "#9FB3C8",
          400: "#829AB0",
          500: "#5E7A8B",
          600: "#3D5A6C",
          700: "#2C4A5C",
          800: "#1C3A4C",
          900: "#0F2B3D",
          950: "#061E2E",
        },
        
        // Supporting accents
        "accent": {
          DEFAULT: "#2C4A5C",
          light: "#3D5A6C",
          dark: "#1C3A4C",
        },
        
        "muted": {
          DEFAULT: "#78716C",
          light: "#A8A29E",
          lighter: "#D6D3D1",
        },
        
        // Legacy dojo mappings (kept for compatibility, mapped to new system)
        "dojo-bg": "#FAFAF8",
        "dojo-surface": "#FFFFFF",
        "dojo-teal": "#2C4A5C",
        "dojo-gold": "#B8870B",
        "dojo-success": "#2C4A5C",
        "dojo-text": "#44403C",
        "dojo-heading": "#0A0A0B",
        
        // Lane colors (subtle, muted for editorial look)
        "dojo-research": "#7C6F9B",
        "dojo-code": "#4A5568",
        "dojo-data": "#5E7A8B",
        "dojo-outreach": "#8B7355",
        
        // Border color
        "border": "rgba(10, 10, 11, 0.08)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        heading: ["var(--font-satoshi)", "Satoshi", "Georgia", "serif"],
        serif: ["Georgia", "Times New Roman", "serif"],
      },
      fontSize: {
        "display": ["4.5rem", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        "display-sm": ["3rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "heading-1": ["2.25rem", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        "heading-2": ["1.875rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "heading-3": ["1.5rem", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        "heading-4": ["1.25rem", { lineHeight: "1.4", letterSpacing: "-0.01em" }],
      },
      letterSpacing: {
        "tighter": "-0.05em",
        "tight": "-0.02em",
        "normal": "0em",
        "wide": "0.05em",
        "wider": "0.1em",
        "widest": "0.15em",
      },
      boxShadow: {
        // Subtle, refined shadows (no colored glows)
        "sm": "0 1px 2px 0 rgba(10, 10, 11, 0.05)",
        "DEFAULT": "0 1px 3px 0 rgba(10, 10, 11, 0.08), 0 1px 2px -1px rgba(10, 10, 11, 0.08)",
        "md": "0 4px 6px -1px rgba(10, 10, 11, 0.08), 0 2px 4px -2px rgba(10, 10, 11, 0.08)",
        "lg": "0 10px 15px -3px rgba(10, 10, 11, 0.08), 0 4px 6px -4px rgba(10, 10, 11, 0.08)",
        "xl": "0 20px 25px -5px rgba(10, 10, 11, 0.08), 0 8px 10px -6px rgba(10, 10, 11, 0.08)",
        "2xl": "0 25px 50px -12px rgba(10, 10, 11, 0.15)",
        
        // Specific component shadows
        "card": "0 2px 8px rgba(10, 10, 11, 0.04), 0 0 0 1px rgba(10, 10, 11, 0.06)",
        "card-hover": "0 8px 24px rgba(10, 10, 11, 0.08), 0 0 0 1px rgba(10, 10, 11, 0.08)",
        "glow-subtle": "0 0 0 1px rgba(44, 74, 92, 0.1)",
        "glow": "0 0 0 1px rgba(44, 74, 92, 0.15), 0 4px 12px rgba(44, 74, 92, 0.08)",
        
        // Legacy compatibility
        "dojo-card": "0 2px 8px rgba(10, 10, 11, 0.04), 0 0 0 1px rgba(10, 10, 11, 0.06)",
        "dojo-hover": "0 8px 24px rgba(10, 10, 11, 0.08), 0 0 0 1px rgba(10, 10, 11, 0.08)",
        "dojo-stat-hover": "0 8px 24px rgba(10, 10, 11, 0.08), 0 0 0 1px rgba(44, 74, 92, 0.12)",
        "dojo-glow": "0 0 0 1px rgba(44, 74, 92, 0.1)",
      },
      borderRadius: {
        "none": "0px",
        "sm": "4px",
        "DEFAULT": "6px",
        "md": "8px",
        "lg": "12px",
        "xl": "16px",
        "2xl": "20px",
        "3xl": "24px",
        "full": "9999px",
        
        // Legacy compatibility
        "dojo-card": "16px",
        "dojo-button": "6px",
        "dojo-modal": "20px",
      },
      backdropBlur: {
        "xs": "2px",
      },
    },
  },
  plugins: [
    // Custom plugin for glass effect
    function ({ addUtilities }: { addUtilities: any }) {
      addUtilities({
        '.glass': {
          'background': 'rgba(255, 255, 255, 0.7)',
          'backdrop-filter': 'blur(12px) saturate(180%)',
          '-webkit-backdrop-filter': 'blur(12px) saturate(180%)',
          'border-bottom': '1px solid rgba(10, 10, 11, 0.06)',
        },
        '.glass-strong': {
          'background': 'rgba(255, 255, 255, 0.85)',
          'backdrop-filter': 'blur(16px) saturate(180%)',
          '-webkit-backdrop-filter': 'blur(16px) saturate(180%)',
        },
        '.glass-dark': {
          'background': 'rgba(10, 10, 11, 0.6)',
          'backdrop-filter': 'blur(12px) saturate(180%)',
          '-webkit-backdrop-filter': 'blur(12px) saturate(180%)',
        },
        '.text-balance': {
          'text-wrap': 'balance',
        },
      });
    },
  ],
};

export default config;