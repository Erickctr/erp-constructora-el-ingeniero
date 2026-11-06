import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1B365D",
          50: "#EEF2F8",
          100: "#DCE5F1",
          200: "#B9CAE2",
          700: "#1B365D",
          800: "#152B4A",
          900: "#0F2038",
        },
        steel: {
          DEFAULT: "#2B547E",
          50: "#EEF4FA",
          100: "#D9E6F3",
          500: "#2B547E",
          600: "#244768",
        },
      },
    },
  },
  plugins: [],
};

export default config;

