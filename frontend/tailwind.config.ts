import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        primary: "hsl(var(--primary))"
      },
      boxShadow: {
        soft: "0 16px 60px -36px rgb(15 23 42 / 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
