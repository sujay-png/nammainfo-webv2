import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0B0B0C",
          900: "#121214",
          800: "#1B1B1F",
          700: "#26262B",
        },
        brand: {
          50: "#FBEEEC",
          100: "#F3D3CE",
          300: "#D98B7E",
          500: "#8C2F22",
          600: "#6E2419",
          700: "#4A1811",
          900: "#2B0E09",
        },
        accent: {
          500: "#2F6FED",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -12px rgba(0,0,0,0.35)",
      },
      backgroundImage: {
        "card-sheen":
          "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 40%)",
      },
    },
  },
  plugins: [],
};
export default config;
