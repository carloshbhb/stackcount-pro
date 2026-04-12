import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#07070f",
        foreground: "#f8fafc",
        accent: "#a855f7", // Roxo Elétrico
      },
    },
  },
  plugins: [],
};
export default config;
