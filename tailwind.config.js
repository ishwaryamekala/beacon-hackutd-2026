/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#05060a",
        panel: "#0d1018",
        cyan: { neon: "#22d3ee" },
        violet: { neon: "#a855f7" },
        pink: { neon: "#f472b6" },
        firefly: "#d4ff3a",
      },
      fontFamily: { mono: ["JetBrains Mono", "ui-monospace", "monospace"] },
    },
  },
  plugins: [],
};
