import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "meadow-green": "#0C6038",
        outerspace: "#2D4C39",
        peach: "#F1D2A1",
        golden: "#F5A623",
        "bg-main": "#F7F5EF",
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
        comforter: ["ComforterBrush", "cursive"],
      },
    },
  },
  plugins: [],
};
export default config;
