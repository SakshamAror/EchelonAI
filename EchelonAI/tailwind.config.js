// READ instructions.txt before editing this file.
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono:    ["DM Mono", "monospace"],
        display: ["Instrument Serif", "Georgia", "serif"],
        bebas:   ["Bebas Neue", "sans-serif"],
      },
      colors: { accent: "#f5a623" },
    },
  },
  plugins: [],
};
