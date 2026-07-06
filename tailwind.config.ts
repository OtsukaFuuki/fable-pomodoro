import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        abyss: "#0B0E14", // 背景。ほぼ黒の藍
        panel: "#131722", // カード背景（わずかに明るい）
        moon: "#AEB8F4", // 主役の光。リング・アクティブ・集中モード
        haze: "#8A93A8", // 弱い文字
        frost: "#E8EBF5", // 強い文字（数字など）
        // チャンネルカラー（スライダーのつまみ・トラックの発光色）
        rain: "#9DB8F0",
        wave: "#8FE0DC",
        windc: "#C9B4F2",
        chime: "#F2D091",
        padc: "#E8A8D8",
        insect: "#A8E8B0",
      },
      keyframes: {
        "ring-breathe": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.72" },
        },
        "corner-breathe": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "ring-breathe": "ring-breathe 2s ease-in-out infinite",
        "corner-breathe": "corner-breathe 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
