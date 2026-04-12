// READ instructions.txt before editing this file.
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono:    ["Space Mono", "monospace"],
        display: ["Instrument Serif", "Georgia", "serif"],
      },
      colors: {
        accent: "#f5a623",
      },
    },
  },
  plugins: [],
};
