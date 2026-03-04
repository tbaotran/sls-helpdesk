/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        stanford: {
          // Primary Identity Colors
          cardinal: "#8C1515",
          darkCardinal: "#6b1010",
          black: "#2E2D29",
          white: "#FFFFFF",
          // Supporting Palette
          coolGrey: "#4D4F53",
          lightGrey: "#B6B1A9",
          sandstone: "#D2BA92",
          paloAlto: "#007C92", // Use for "Resolved" or "Success"
          brightRed: "#B1040E",
        },
      },
      fontFamily: {
        // As per SLS typography requirements
        sans: ['"Source Sans 3"', "sans-serif"],
        serif: ['"Source Serif 4"', "serif"],
      },
    },
  },
  plugins: [],
};