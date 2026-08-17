import { useEffect } from "react";
import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";

// Shared shell for legal pages (Privacy, Terms). Renders the site chrome + a clean
// reading column. `sections` = [{ h: "Heading", body: <>...</> }]. A clearly-marked
// banner reminds that these are templates pending lawyer review.
export default function LegalDoc({ title, updated, intro, sections, note }) {
  useEffect(() => { document.title = `${title} · Guileo`; window.scrollTo(0, 0); }, [title]);
  return (
    <>
      <Navbar />
      <main className="wrap pt-28 pb-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-black tracking-tight text-g-word sm:text-4xl">{title}</h1>
          <div className="mt-2 text-[13px] text-g-muted">Última atualização: {updated}</div>

          <div className="mt-5 rounded-xl border border-g-gold/30 bg-g-gold/[0.06] p-4 text-[12.5px] leading-relaxed text-g-ink">
            {note || <>ℹ️ Este é um <span className="font-bold text-g-word">resumo dos termos padrão da Guileo</span>. O contrato de prestação de serviços assinado entre as partes prevalece sobre este resumo.</>}
          </div>

          {intro && <p className="mt-6 text-[15px] leading-relaxed text-g-ink">{intro}</p>}

          <div className="mt-8 space-y-8">
            {sections.map((s, i) => (
              <section key={i}>
                <h2 className="text-lg font-black text-g-word">{i + 1}. {s.h}</h2>
                <div className="mt-2 space-y-2 text-[14px] leading-relaxed text-g-ink [&_a]:text-g-green [&_a:hover]:underline [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-g-word">{s.body}</div>
              </section>
            ))}
          </div>

          <div className="mt-12 border-t border-white/10 pt-6 text-[13px] text-g-muted">
            Dúvidas sobre este documento? Fale com <a href="mailto:smart@guileoai.com" className="text-g-green hover:underline">smart@guileoai.com</a>.<br />
            Guileo · ORIGEM LTDA · New York 🗽 · Cuiabá, MT 🇧🇷
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
