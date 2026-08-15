// src/components/VoiceWeb.jsx — o botão que faz a Gui ATENDER POR VOZ no navegador.
//
// Mora no site do CLIENTE (marca dele), então o estilo é inline e usa a cor dele — o cimento
// quente do cockpit não se aplica aqui, de propósito (mesma regra do ClientSite.jsx).
//
// A REGRA QUE MANDA NESTA TELA: nunca um botão que não faz nada. Todo caminho que não termina
// em conversa termina em uma frase que explica o motivo e deixa telefone/formulário à mão:
// navegador sem suporte, microfone negado, chave do provedor ausente, cliente sem agente,
// cota do dia estourada. Cada um tem sua frase; nenhum vira "tente novamente" genérico.
import { useCallback, useEffect, useRef, useState } from "react";
import { iniciarVoz, suporteDeVoz } from "../lib/voiceWeb.js";

const T = {
  pt: {
    titulo: "Falar agora, por voz",
    sub: "Atendimento por voz, direto no navegador — sem ligação telefônica.",
    botao: "🎙️ Falar com",
    conectando: "Conectando…",
    mic: "Permita o microfone…",
    ouvindo: "Pode falar",
    falando: "Falando…",
    encerrar: "Encerrar",
    fim: "Conversa encerrada.",
    denovo: "Falar de novo",
    tempo: "Tempo da conversa encerrado. Quer continuar? Fale com a gente pelo formulário ou pelo telefone.",
    voce: "Você",
    restante: "restam",
    motivos: {
      inseguro: "A voz só funciona em conexão segura (https).",
      sem_ws: "Este navegador não suporta a conversa por voz — use o formulário abaixo ou ligue pra gente.",
      sem_audio: "Este navegador não suporta áudio — use o formulário abaixo ou ligue pra gente.",
      sem_mic: "Este navegador não dá acesso ao microfone — use o formulário abaixo ou ligue pra gente.",
      mic_negado: "Sem microfone eu não consigo te ouvir. Libere o microfone nas permissões do navegador e tente de novo — ou use o formulário abaixo.",
      no_key: "A voz está fora do ar neste momento. Use o formulário abaixo ou ligue pra gente.",
      no_agent: "A voz ainda não foi ativada para este negócio. Use o formulário abaixo ou ligue pra gente.",
      no_site: "A voz ainda não foi ativada para este negócio.",
      disabled: "A voz está desativada neste momento. Use o formulário abaixo.",
      rate_limited: "Você já iniciou várias conversas agora há pouco. Tente em alguns minutos ou use o formulário abaixo.",
      ip_cap: "Você já usou a voz várias vezes hoje. Use o formulário abaixo que a gente te retorna.",
      daily_minutes: "O atendimento por voz atingiu o limite de hoje. Use o formulário abaixo — a gente te retorna.",
      daily_sessions: "O atendimento por voz atingiu o limite de hoje. Use o formulário abaixo — a gente te retorna.",
      platform_daily: "O atendimento por voz atingiu o limite de hoje. Use o formulário abaixo — a gente te retorna.",
      platform_off: "A voz está temporariamente desativada. Use o formulário abaixo.",
      quota_unavailable: "A voz está fora do ar neste momento. Use o formulário abaixo ou ligue pra gente.",
      provider: "Não consegui abrir a linha de voz agora. Use o formulário abaixo ou ligue pra gente.",
      erro: "A conversa caiu. Pode tentar de novo, ou usar o formulário abaixo.",
      padrao: "Não consegui abrir a voz agora. Use o formulário abaixo ou ligue pra gente.",
    },
  },
  en: {
    titulo: "Talk now, by voice",
    sub: "Voice support right in your browser — no phone call needed.",
    botao: "🎙️ Talk to",
    conectando: "Connecting…",
    mic: "Allow the microphone…",
    ouvindo: "Go ahead, I'm listening",
    falando: "Speaking…",
    encerrar: "End",
    fim: "Conversation ended.",
    denovo: "Talk again",
    tempo: "The conversation time is up. Want to continue? Use the form below or give us a call.",
    voce: "You",
    restante: "left",
    motivos: {
      inseguro: "Voice only works over a secure (https) connection.",
      sem_ws: "This browser can't run the voice conversation — use the form below or call us.",
      sem_audio: "This browser doesn't support audio — use the form below or call us.",
      sem_mic: "This browser gives no microphone access — use the form below or call us.",
      mic_negado: "Without a microphone I can't hear you. Allow the mic in your browser settings and try again — or use the form below.",
      no_key: "Voice is offline right now. Use the form below or call us.",
      no_agent: "Voice isn't activated for this business yet. Use the form below or call us.",
      no_site: "Voice isn't activated for this business yet.",
      disabled: "Voice is switched off right now. Use the form below.",
      rate_limited: "You've started several conversations just now. Try again in a few minutes, or use the form below.",
      ip_cap: "You've used voice several times today. Use the form below and we'll get back to you.",
      daily_minutes: "Voice support hit today's limit. Use the form below — we'll get back to you.",
      daily_sessions: "Voice support hit today's limit. Use the form below — we'll get back to you.",
      platform_daily: "Voice support hit today's limit. Use the form below — we'll get back to you.",
      platform_off: "Voice is temporarily off. Use the form below.",
      quota_unavailable: "Voice is offline right now. Use the form below or call us.",
      provider: "I couldn't open the voice line right now. Use the form below or call us.",
      erro: "The conversation dropped. You can try again, or use the form below.",
      padrao: "I couldn't open voice right now. Use the form below or call us.",
    },
  },
  es: {
    titulo: "Hablar ahora, por voz",
    sub: "Atención por voz directamente en el navegador — sin llamada telefónica.",
    botao: "🎙️ Hablar con",
    conectando: "Conectando…",
    mic: "Permite el micrófono…",
    ouvindo: "Puedes hablar",
    falando: "Hablando…",
    encerrar: "Terminar",
    fim: "Conversación terminada.",
    denovo: "Hablar de nuevo",
    tempo: "Se acabó el tiempo de la conversación. ¿Quieres seguir? Usa el formulario o llámanos.",
    voce: "Tú",
    restante: "restan",
    motivos: {
      inseguro: "La voz solo funciona con conexión segura (https).",
      sem_ws: "Este navegador no soporta la conversación por voz — usa el formulario o llámanos.",
      sem_audio: "Este navegador no soporta audio — usa el formulario o llámanos.",
      sem_mic: "Este navegador no da acceso al micrófono — usa el formulario o llámanos.",
      mic_negado: "Sin micrófono no puedo oírte. Permite el micrófono en el navegador e inténtalo de nuevo — o usa el formulario.",
      no_key: "La voz está fuera de servicio ahora. Usa el formulario o llámanos.",
      no_agent: "La voz aún no está activada para este negocio. Usa el formulario o llámanos.",
      no_site: "La voz aún no está activada para este negocio.",
      disabled: "La voz está desactivada ahora. Usa el formulario.",
      rate_limited: "Ya iniciaste varias conversaciones hace poco. Inténtalo en unos minutos o usa el formulario.",
      ip_cap: "Ya usaste la voz varias veces hoy. Usa el formulario y te contactamos.",
      daily_minutes: "La atención por voz alcanzó el límite de hoy. Usa el formulario — te contactamos.",
      daily_sessions: "La atención por voz alcanzó el límite de hoy. Usa el formulario — te contactamos.",
      platform_daily: "La atención por voz alcanzó el límite de hoy. Usa el formulario — te contactamos.",
      platform_off: "La voz está temporalmente desactivada. Usa el formulario.",
      quota_unavailable: "La voz está fuera de servicio ahora. Usa el formulario o llámanos.",
      provider: "No pude abrir la línea de voz ahora. Usa el formulario o llámanos.",
      erro: "La conversación se cortó. Puedes intentar de nuevo o usar el formulario.",
      padrao: "No pude abrir la voz ahora. Usa el formulario o llámanos.",
    },
  },
};

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function VoiceWeb({ slug, brand = "#2F6F4E", business = "", lang = "pt", phone = "" }) {
  const t = T[(lang || "pt").slice(0, 2)] || T.pt;
  const [estado, setEstado] = useState("idle");   // idle | pedindo_mic | conectando | ouvindo | falando | fim
  const [aviso, setAviso] = useState("");         // frase honesta quando não dá pra falar
  const [linhas, setLinhas] = useState([]);       // transcrição ao vivo (as últimas)
  const [restante, setRestante] = useState(0);
  const sessaoRef = useRef(null);
  const tickRef = useRef(null);

  // O suporte é conferido no cliente ANTES de desenhar o botão — quem não pode falar vê a
  // explicação, não um botão que gira para sempre.
  const [sup] = useState(() => suporteDeVoz());

  const limparTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };

  useEffect(() => () => {
    limparTick();
    try { sessaoRef.current?.encerrar(); } catch { /* já encerrada */ }
  }, []);

  const falar = useCallback(async () => {
    setAviso(""); setLinhas([]);
    setEstado("pedindo_mic");
    try {
      const s = await iniciarVoz({
        slug,
        onEstado: (e) => setEstado(e),
        onFala: ({ quem, texto }) => {
          if (!texto || !texto.trim()) return;
          setLinhas((l) => [...l.slice(-5), { quem, texto: texto.trim().slice(0, 300) }]);
        },
        onFim: ({ motivo }) => {
          limparTick();
          sessaoRef.current = null;
          setEstado("fim");
          if (motivo === "tempo") setAviso(t.tempo);
          else if (motivo === "erro") setAviso(t.motivos.erro);
        },
      });
      sessaoRef.current = s;
      setRestante(s.maxSegundos);
      tickRef.current = setInterval(() => {
        const r = Math.max(0, s.maxSegundos - s.segundos());
        setRestante(r);
      }, 1000);
    } catch (e) {
      setEstado("fim");
      setAviso(t.motivos[e?.reason] || t.motivos.padrao);
    }
  }, [slug, t]);

  const encerrar = () => { try { sessaoRef.current?.encerrar(); } catch { /* */ } };

  const ativo = ["pedindo_mic", "conectando", "ouvindo", "falando"].includes(estado);

  const S = {
    caixa: { border: "1px solid #e8e8e8", borderRadius: 16, padding: "20px 20px 18px", background: "#fff", maxWidth: 460, margin: "0 auto" },
    titulo: { fontWeight: 700, fontSize: "1.05rem", margin: 0, color: "#1a1a1a" },
    sub: { color: "#777", fontSize: ".88rem", margin: "6px 0 16px", lineHeight: 1.5 },
    btn: { width: "100%", padding: "14px", borderRadius: 12, border: 0, background: brand, color: "#fff", fontSize: "1rem", fontWeight: 650, cursor: "pointer" },
    btnFim: { width: "100%", padding: "12px", borderRadius: 12, border: `1px solid ${brand}`, background: "#fff", color: brand, fontSize: ".95rem", fontWeight: 650, cursor: "pointer" },
    estado: { display: "flex", alignItems: "center", gap: 10, justifyContent: "center", color: "#444", fontWeight: 600, fontSize: ".95rem", padding: "10px 0 14px" },
    ponto: { width: 9, height: 9, borderRadius: "50%", background: brand, display: "inline-block" },
    linhas: { maxHeight: 168, overflowY: "auto", margin: "0 0 14px", padding: "12px 14px", background: "#fafafa", borderRadius: 12, fontSize: ".9rem", lineHeight: 1.5 },
    quem: { fontWeight: 700, color: brand },
    aviso: { color: "#8a5a00", background: "#fff8e6", border: "1px solid #ffe2a8", borderRadius: 12, padding: "11px 13px", fontSize: ".88rem", lineHeight: 1.5, margin: "0 0 12px" },
    tempo: { textAlign: "center", color: "#999", fontSize: ".78rem", marginTop: 10 },
  };

  // Navegador incapaz: uma frase honesta + o telefone, se houver. Nunca o botão.
  if (!sup.ok) {
    return (
      <div style={S.caixa}>
        <h3 style={S.titulo}>{t.titulo}</h3>
        <p style={S.aviso}>{t.motivos[sup.motivo] || t.motivos.padrao}</p>
        {phone ? <a href={`tel:${phone}`} style={{ ...S.btn, display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}>📞 {phone}</a> : null}
      </div>
    );
  }

  return (
    <div style={S.caixa}>
      <style>{"@keyframes guipulso{0%,100%{opacity:.35;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}@media (prefers-reduced-motion: reduce){.gui-pulso{animation:none!important}}"}</style>
      <h3 style={S.titulo}>{t.titulo}</h3>
      <p style={S.sub}>{t.sub}</p>

      {aviso ? <p style={S.aviso}>{aviso}</p> : null}

      {ativo ? (
        <>
          <div style={S.estado} role="status" aria-live="polite">
            <span className="gui-pulso" style={{ ...S.ponto, animation: "guipulso 1.1s ease-in-out infinite" }} />
            {estado === "pedindo_mic" ? t.mic : estado === "conectando" ? t.conectando : estado === "falando" ? t.falando : t.ouvindo}
          </div>
          {linhas.length ? (
            <div style={S.linhas}>
              {linhas.map((l, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <span style={l.quem === "gui" ? S.quem : { fontWeight: 700, color: "#666" }}>
                    {l.quem === "gui" ? (business || "Gui") : t.voce}:
                  </span>{" "}
                  <span style={{ color: "#333" }}>{l.texto}</span>
                </div>
              ))}
            </div>
          ) : null}
          <button type="button" onClick={encerrar} style={S.btnFim}>{t.encerrar}</button>
          <div style={S.tempo}>{mmss(restante)} {t.restante}</div>
        </>
      ) : (
        <button type="button" onClick={falar} style={S.btn}>
          {estado === "fim" ? t.denovo : `${t.botao}${business ? " " + business : ""}`}
        </button>
      )}
    </div>
  );
}
