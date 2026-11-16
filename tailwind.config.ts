import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b0d12",
          surface: "#141821",
          elevated: "#1b2130",
        },
        brand: {
          50: "#eef4ff",
          100: "#d9e5ff",
          500: "#5b7cfa",
          600: "#4463ea",
          700: "#334dc4",
        },
        accent: {
          500: "#22d3b4",
          600: "#13b89b",
        },
        muted: {
          DEFAULT: "#8891a3",
          strong: "#aab2c3",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(91,124,250,0.3), 0 10px 40px -10px rgba(91,124,250,0.4)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at 50% 0%, rgba(91,124,250,0.15), transparent 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
