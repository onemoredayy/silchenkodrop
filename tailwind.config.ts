import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "#171a16", // фон — оливково-чёрный, как крашеный металл ящика
        panel: "#20241f",
        raised: "#2a2f28",
        line: "#353b33",
        bone: "#e9e5d8", // основной текст
        dust: "#9aa093", // второстепенный текст
        stencil: "#e0b43a", // маркировочная жёлтая краска — единственный акцент
        "stencil-dim": "#b38e2a",
        danger: "#e0614a",
        ok: "#8fbf6a",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: { DEFAULT: "4px", card: "6px" },
    },
  },
  plugins: [],
} satisfies Config;
