/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // TOKENS POR VARIÁVEL (2026-09-09). Os VALORES continuam os do cimento queimado — o padrão
        // em `:root` (index.css) é byte a byte o de antes, então dashboard/portal não mudam um pixel
        // (lei de 2026-06-20: nunca re-tonar tokens globais). O que muda: um escopo pode redefinir as
        // variáveis — `.frio` na landing traz de volta a paleta elétrica da v1 (ciano/verde elétrico
        // sobre azul-preto) sem tocar em quem está fora dele. `<alpha-value>` mantém bg-g-gold/10 etc.
        g: {
          green:  "rgb(var(--g-green) / <alpha-value>)",   // cimento: #3E9468 · frio: #1BC76B
          light:  "rgb(var(--g-light) / <alpha-value>)",   // cimento: #6FB892 · frio: #08D4F0 (ciano)
          dark:   "rgb(var(--g-dark) / <alpha-value>)",    // cimento: #2C6E4B
          word:   "rgb(var(--g-word) / <alpha-value>)",    // cimento: #EDE7DC
          gold:   "rgb(var(--g-gold) / <alpha-value>)",    // cimento: #D6C29A · frio: #F5A827
          copper: "rgb(var(--g-copper) / <alpha-value>)",  // cimento: #C2A878 · frio: #D4A520
          cream:  "rgb(var(--g-cream) / <alpha-value>)",   // cimento: #161512 · frio: #060A10
          creamd: "rgb(var(--g-creamd) / <alpha-value>)",  // cimento: #1C1A16
          deep:   "rgb(var(--g-deep) / <alpha-value>)",    // cimento: #100F0C
          line:   "rgb(var(--g-line) / <alpha-value>)",    // cimento: #2B2720
          ink:    "rgb(var(--g-ink) / <alpha-value>)",     // cimento: #C5BEB0
          muted:  "rgb(var(--g-muted) / <alpha-value>)",   // cimento: #948C7B
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
        rocketlaunch: { "0%": { transform: "translate(-50%,40px)", opacity: "0" }, "14%": { transform: "translate(-50%,14px)", opacity: "1" }, "82%": { transform: "translate(-50%,-150px)", opacity: "1" }, "100%": { transform: "translate(-50%,-182px)", opacity: "0" } },
        flameflicker: { "0%,100%": { transform: "scaleY(1) scaleX(1)", opacity: "0.9" }, "30%": { transform: "scaleY(1.45) scaleX(0.9)", opacity: "1" }, "60%": { transform: "scaleY(0.82) scaleX(1.1)", opacity: "0.65" } },
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
        rocketlaunch: "rocketlaunch 4.4s ease-in infinite",
        flameflicker: "flameflicker 0.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}
