/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        g: {
          green:  "#3E9468",  // verde amazônia — discreet, deep (detail accent only)
          light:  "#6FB892",  // emerald light (small text accents)
          dark:   "#2C6E4B",  // deep forest
          word:   "#EDE7DC",  // headings — warm ivory / champagne white
          gold:   "#D6C29A",  // champanhe (soft metallic, not yellow gold)
          copper: "#C2A878",  // champagne darker
          cream:  "#161512",  // base bg — cimento queimado (warm cement charcoal)
          creamd: "#1C1A16",  // alt section — lighter cement
          deep:   "#100F0C",  // deepest concrete
          line:   "#2B2720",  // warm concrete border
          ink:    "#C5BEB0",  // body text — warm greige
          muted:  "#948C7B",  // muted taupe
        },
      },
      fontFamily: { sans: ['Inter','system-ui','sans-serif'] },
      boxShadow: {
        soft: "0 4px 24px -8px rgba(0,0,0,0.55)",
        lift: "0 28px 70px -24px rgba(0,0,0,0.78)",
        glow: "0 0 38px rgba(79,176,124,0.22)",
        gold: "0 0 38px rgba(214,194,154,0.20)",
      },
      borderRadius: { xl2: "1.25rem", xl3: "1.75rem" },
      keyframes: {
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-12px)" } },
        floatslow: { "0%,100%": { transform: "translateY(0) translateX(0)" }, "50%": { transform: "translateY(-9px) translateX(4px)" } },
        aurora: { "0%,100%": { transform: "translate(0,0) scale(1)" }, "33%": { transform: "translate(40px,-30px) scale(1.1)" }, "66%": { transform: "translate(-30px,20px) scale(0.95)" } },
        pulsering: { "0%": { transform: "scale(1)", opacity: "0.7" }, "100%": { transform: "scale(2.2)", opacity: "0" } },
        shine: { "0%": { transform: "translateX(-120%) skewX(-12deg)" }, "60%,100%": { transform: "translateX(220%) skewX(-12deg)" } },
        breathe: { "0%,100%": { transform: "scale(1)", boxShadow: "0 0 0 1px rgba(214,194,154,0.18), 0 0 38px rgba(214,194,154,0.10)" }, "50%": { transform: "scale(1.012)", boxShadow: "0 0 0 1px rgba(214,194,154,0.35), 0 0 54px rgba(214,194,154,0.18)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        glowpulse: { "0%,100%": { opacity: "0.35" }, "50%": { opacity: "0.8" } },
        growx: { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
      },
      animation: {
        marquee: "marquee 32s linear infinite",
        floaty: "floaty 6s ease-in-out infinite",
        floatslow: "floatslow 7s ease-in-out infinite",
        aurora: "aurora 18s ease-in-out infinite",
        pulsering: "pulsering 2s ease-out infinite",
        breathe: "breathe 4.5s ease-in-out infinite",
        shimmer: "shimmer 3.5s linear infinite",
        glowpulse: "glowpulse 3s ease-in-out infinite",
        growx: "growx 4.2s linear forwards",
      },
    },
  },
  plugins: [],
}
