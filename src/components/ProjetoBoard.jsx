// O QUADRO DO PROJETO (2026-10-08) — o mesmo componente nas duas pontas:
//   · modo "parceiro" (/projeto?t=…, inglês): marca Feito, prova, nota, bloqueio, comenta;
//   · modo "admin" (/admin/projetos, português): tudo isso + Aceito, editar, criar, apagar, link.
// O servidor é a verdade: cada clique manda a mudança, a tela mostra o otimista na hora e depois
// troca pelo estado que a RPC devolveu (se falhar, volta e avisa — nunca fica "marcado" de mentira).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import logo from "../assets/guileo-mark.png";
import naturaLogo from "../assets/natura-logo.png";

const TZ = "America/New_York";
const FASES = ["w1", "w2", "w3", "p2", "p34"];

const S = {
  en: {
    brand: "Implementation", eye: "Build to Go-Live", sub: "One checklist for Origem and Scale Pods, from kickoff to Go-Live. Scale Pods marks Done with the proof; Origem marks Accepted in writing.",
    toGo: "days to Go-Live", goLive: "Go-Live", done: "Done", accepted: "Accepted", late: "Overdue", of: "of",
    all: "All", sp: "Scale Pods", or: "Origem", na: "Natura", openOnly: "Open only", day: "Showing",
    clearDay: "Show all days", fases: { w1: "Week 1 · Access, requests, review", w2: "Week 2 · Integrations and booking", w3: "Week 3 · Three locations and Go-Live", p2: "Part 2 · After third-party approval", p34: "Parts 3–4 · After Go-Live" },
    weeks: ["Week 1", "Week 2", "Week 3"], due: "Due", noDate: "After approval",
    st: { acc: "Accepted", done: "Done · awaiting acceptance", blk: "Blocked", late: "Overdue", open: "Open" },
    cbDone: "Done", cbAcc: "Accepted", proof: "Proof", note: "Note", details: "Proof & note", close: "Close",
    proofPh: "https://… (recording, screenshot folder, submission page)", notePh: "What was done, what is missing, who is blocking",
    blocked: "Blocked (waiting on someone)", save: "Save", saving: "Saving…", saved: "Saved", lockedAcc: "Accepted by Origem — locked.",
    yourName: "Your name (shown in the activity log)", activity: "Activity", comment: "Write a message to the team", send: "Send",
    who: { origem: "Origem", parceiro: "Scale Pods" },
    acts: { feito: "marked done", desfeito: "unmarked done", aceito: "accepted", desaceito: "removed acceptance", prova: "added proof", nota: "updated the note", bloqueado: "marked blocked", desbloqueado: "unblocked", comentario: "wrote", item_novo: "added", item_editado: "edited", item_apagado: "removed", link_novo: "issued a new link" },
    err: { aceito: "This item was already accepted by Origem.", url: "The proof link must start with https://", token: "This link is no longer valid. Ask Luis for the current one.", indisponivel: "Could not reach the server. Try again in a moment.", devagar: "Too many clicks — wait a few seconds.", x: "That didn't save. Try again." },
    loading: "Loading the project…", empty: "Nothing here with these filters.", foot: "Guileo AI · ORIGEM LTDA · Confidential. No passwords or customer data on this page.",
    updated: "Updated", now: "just now",
  },
  pt: {
    brand: "Implantação", eye: "Implantação até o Go-Live", sub: "Um checklist só para a Origem e a Scale Pods, do início ao Go-Live. A Scale Pods marca Feito com a prova; a Origem marca Aceito.",
    toGo: "dias até o Go-Live", goLive: "Go-Live", done: "Feito", accepted: "Aceito", late: "Atrasados", of: "de",
    all: "Todos", sp: "Scale Pods", or: "Origem", na: "Natura", openOnly: "Só abertos", day: "Mostrando",
    clearDay: "Ver todos os dias", fases: { w1: "Semana 1 · Acessos, pedidos, revisão", w2: "Semana 2 · Integrações e agendamento", w3: "Semana 3 · Três unidades e Go-Live", p2: "Parte 2 · Depois da aprovação de terceiros", p34: "Partes 3–4 · Depois do Go-Live" },
    weeks: ["Semana 1", "Semana 2", "Semana 3"], due: "Prazo", noDate: "Depois da aprovação",
    st: { acc: "Aceito", done: "Feito · aguardando aceite", blk: "Bloqueado", late: "Atrasado", open: "Aberto" },
    cbDone: "Feito", cbAcc: "Aceito", proof: "Prova", note: "Nota", details: "Editar", close: "Fechar",
    proofPh: "https://… (gravação, pasta de prints, página do protocolo)", notePh: "O que foi feito, o que falta, quem está travando",
    blocked: "Bloqueado (esperando alguém)", save: "Salvar", saving: "Salvando…", saved: "Salvo", lockedAcc: "Aceito pela Origem — travado para o parceiro.",
    yourName: "", activity: "Atividade", comment: "Escreva uma mensagem para a equipe", send: "Enviar",
    who: { origem: "Origem", parceiro: "Scale Pods" },
    acts: { feito: "marcou feito", desfeito: "desmarcou feito", aceito: "aceitou", desaceito: "tirou o aceite", prova: "colocou a prova", nota: "atualizou a nota", bloqueado: "marcou bloqueado", desbloqueado: "desbloqueou", comentario: "escreveu", item_novo: "criou", item_editado: "editou", item_apagado: "apagou", link_novo: "gerou um link novo" },
    err: { aceito: "Este item já foi aceito.", url: "O link da prova precisa começar com https://", token: "Link inválido.", indisponivel: "Não consegui falar com o servidor. Tente de novo em instantes.", devagar: "Muitos cliques — espere uns segundos.", x: "Não salvou. Tente de novo." },
    loading: "Carregando o projeto…", empty: "Nada aqui com esses filtros.", foot: "Guileo AI · ORIGEM LTDA · Confidencial. Sem senhas nem dados de clientes nesta página.",
    updated: "Atualizado", now: "agora",
    title: "Título (inglês)", titlePt: "Título (português)", owner: "Responsável", phase: "Fase", newItem: "+ Novo item nesta fase", add: "Criar item",
    del: "Apagar item", delSure: "Apagar de vez?", yes: "Sim, apagar", no: "Cancelar",
  },
};

// "hoje" e as datas sempre no fuso da Natura (o prazo é um dia em Nova York, não em Cuiabá)
const hojeNY = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const fmtDia = (iso, lang) => {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00Z");
  return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(d);
};
const fmtHora = (ts, lang) => new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(ts));
const diasUteis = (de, ate) => { // dias úteis de "de" (exclusive) até "ate" (inclusive)
  let n = 0; const d = new Date(de + "T12:00:00Z"); const fim = new Date(ate + "T12:00:00Z");
  while (d < fim) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return n;
};
const diasDoPlano = (inicio, golive) => {
  const out = []; const d = new Date(inicio + "T12:00:00Z"); const fim = new Date(golive + "T12:00:00Z");
  while (d <= fim && out.length < 40) { const w = d.getUTCDay(); if (w !== 0 && w !== 6) out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
};
const estado = (it, hoje) => it.aceito ? "acc" : it.feito ? "done" : it.bloqueado ? "blk" : (it.prazo && it.prazo < hoje) ? "late" : "open";

// número que conta até o valor (para no lugar se o usuário pediu menos movimento)
function useConta(alvo) {
  const [v, setV] = useState(alvo);
  const de = useRef(0);
  useEffect(() => {
    const quieto = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quieto) { setV(alvo); de.current = alvo; return undefined; }
    const ini = de.current; const t0 = performance.now(); let raf;
    const passo = (t) => { const k = Math.min(1, (t - t0) / 700); const e = 1 - Math.pow(1 - k, 3); setV(Math.round(ini + (alvo - ini) * e)); if (k < 1) raf = requestAnimationFrame(passo); else de.current = alvo; };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo]);
  return v;
}
function Num({ v, className = "", suf }) { const n = useConta(v); return <div className={"v " + className}>{n}{suf ? <small>{suf}</small> : null}</div>; }

export default function ProjetoBoard({ modo, lang, call, slug }) {
  const t = S[lang];
  const admin = modo === "admin";
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [dono, setDono] = useState("all");
  const [abertos, setAbertos] = useState(false);
  const [dia, setDia] = useState("");
  const [aberto, setAberto] = useState("");
  const [toast, setToast] = useState("");
  const [pop, setPop] = useState("");
  const [flash, setFlash] = useState("");
  const [nome, setNome] = useState(() => { try { return localStorage.getItem("prj_nome") || ""; } catch { return ""; } });
  const [msg, setMsg] = useState("");
  const hoje = hojeNY();
  const toastT = useRef(0);

  const avisa = (s) => { setToast(s); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 2400); };
  const errMsg = (r) => t.err[r && r.erro] || t.err.x;

  const carregar = useCallback(async () => {
    const r = await call(admin ? { action: "admin_ler", slug } : { action: "ler" });
    if (r && r.ok) { setD(r); setErro(""); } else setErro(errMsg(r));
  }, [call, admin, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar(); }, [carregar]);
  // os dois lados veem o que o outro fez: relê a cada 30 s com a aba visível
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") carregar(); }, 30000);
    return () => clearInterval(id);
  }, [carregar]);
  useEffect(() => { try { localStorage.setItem("prj_nome", nome); } catch { /* sem armazenamento: segue sem nome */ } }, [nome]);

  // muda um item: otimista na tela, servidor decide
  const mudar = async (it, campos, okMsg) => {
    const antes = d;
    setD((x) => x && { ...x, itens: x.itens.map((i) => (i.id === it.id ? { ...i, ...campos, ...(campos.aceito ? { feito: true } : {}) } : i)) });
    const r = await call(admin ? { action: "admin_salvar", slug, item: { id: it.id, ...campos } } : { action: "marcar", item: { id: it.id, ...campos }, nome });
    if (r && r.ok) { setD(r); setFlash(it.id); setTimeout(() => setFlash(""), 1400); if (okMsg) avisa(okMsg); return true; }
    setD(antes); avisa(errMsg(r)); return false;
  };
  const marcar = (it, campo) => { setPop(it.id + campo); setTimeout(() => setPop(""), 340); mudar(it, { [campo]: !it[campo] }, !it[campo] ? (campo === "aceito" ? "✓ " + t.accepted : "✓ " + t.done) : t.saved); };

  const proj = d && d.projeto;
  const itens = useMemo(() => (d ? d.itens : []), [d]);
  const tot = itens.length;
  const nFeito = itens.filter((i) => i.feito).length;
  const nAc = itens.filter((i) => i.aceito).length;
  const nAtras = itens.filter((i) => estado(i, hoje) === "late").length;
  const faltam = proj && proj.go_live ? (hoje >= proj.go_live ? 0 : diasUteis(hoje, proj.go_live)) : 0;
  const dias = proj && proj.inicio && proj.go_live ? diasDoPlano(proj.inicio, proj.go_live) : [];
  const titulo = (it) => (lang === "pt" && it.titulo_pt) || it.titulo;
  const porId = useMemo(() => Object.fromEntries(itens.map((i) => [i.id, i])), [itens]);

  const visiveis = itens.filter((i) => (dono === "all" || i.dono === dono) && (!abertos || !i.aceito) && (!dia || i.prazo === dia));

  if (erro && !d) return <Casca t={t} lang={lang}><div className="prj-wrap" style={{ paddingBlock: 40 }}><div className="sn-err p-4"><div className="sn-err-t font-bold">{erro}</div></div></div></Casca>;
  if (!d) return <Casca t={t} lang={lang}><div className="prj-wrap" style={{ paddingBlock: 40 }}><div className="sn-skel rounded-xl p-6 sn-muted" role="status">{t.loading}</div></div></Casca>;

  const pct = (n) => (tot ? Math.round((n / tot) * 100) : 0);

  return (
    <Casca t={t} lang={lang}>
      <div className="sn-band" style={{ borderTop: 0 }}><div className="prj-wrap">
        <div className="prj-hero">
          <div className="prj-eye-d prj-rise">{t.eye} · {proj.cliente}</div>
          <h1 className="prj-rise" style={{ "--i": 1 }}>{proj.nome}</h1>
          <p className="prj-sub prj-rise" style={{ "--i": 2 }}>{t.sub}</p>
          <div className="prj-stats prj-rise" style={{ "--i": 3 }}>
            <div className="prj-stat"><div className="k">{t.goLive} · {fmtDia(proj.go_live, lang)}</div><Num v={faltam} className="gold" suf={t.toGo} /></div>
            <div className="prj-stat"><div className="k">{t.done}</div><Num v={nFeito} suf={`${t.of} ${tot}`} /><div className="prj-bar"><i style={{ width: pct(nFeito) + "%", background: "#C9A04F" }} /></div></div>
            <div className="prj-stat"><div className="k">{t.accepted}</div><Num v={nAc} suf={`${t.of} ${tot}`} /><div className="prj-bar"><i style={{ width: pct(nAc) + "%", background: "#4FAE80" }} /></div></div>
            <div className="prj-stat"><div className="k">{t.late}</div><Num v={nAtras} className={nAtras ? "red" : ""} /></div>
          </div>
        </div>
      </div></div>

      <div className="prj-wrap">
        {/* linha do tempo: clicar num dia filtra as tarefas daquele dia */}
        {dias.length > 0 && (
          <section className="prj-tl prj-rise" style={{ "--i": 4 }} aria-label="Timeline">
            <div className="prj-tl-scroll"><div className="prj-tl-inner">
              {dias.length === 15 && <div className="prj-weeks">{t.weeks.map((w) => <span key={w}>{w}</span>)}</div>}
              <div className="prj-tl-row" style={{ gridTemplateColumns: `repeat(${dias.length}, minmax(0,1fr))` }}>
                {dias.map((x) => {
                  const doDia = itens.filter((i) => i.prazo === x);
                  const ok = doDia.length && doDia.every((i) => i.aceito);
                  const parte = doDia.some((i) => i.feito);
                  const late = doDia.some((i) => estado(i, hoje) === "late");
                  const [w, , n] = fmtDia(x, lang).replace(",", "").split(" ");
                  return (
                    <button type="button" key={x} aria-pressed={dia === x} onClick={() => setDia(dia === x ? "" : x)}
                      className={"prj-day" + (x === hoje ? " today" : "") + (x === proj.go_live ? " gl" : "")}
                      title={`${fmtDia(x, lang)} · ${doDia.length}`}>
                      <div className="d">{w}</div>
                      <div className="n">{lang === "pt" ? x.slice(8, 10).replace(/^0/, "") : (n || x.slice(8, 10))}</div>
                      <div className={"dot" + (late ? " late" : ok ? " ok" : parte ? " part" : "")} />
                    </button>
                  );
                })}
              </div>
            </div></div>
          </section>
        )}

        <div className="prj-tools mt-5 prj-rise" style={{ "--i": 5 }}>
          <div className="sn-seg" role="group" aria-label="Owner">
            {[["all", t.all], ["SP", t.sp], ["OR", t.or], ["NA", t.na]].map(([k, l]) => (
              <button key={k} type="button" aria-pressed={dono === k} onClick={() => setDono(k)}>{l}</button>
            ))}
          </div>
          <label className="prj-toggle"><input type="checkbox" className="sn-check" checked={abertos} onChange={(e) => setAbertos(e.target.checked)} /> {t.openOnly}</label>
        </div>
        {dia && (
          <div className="sn-warn mt-3 px-4 py-2.5 text-sm flex flex-wrap items-center justify-between gap-2">
            <span>{t.day}: <b>{fmtDia(dia, lang)}</b></span>
            <button type="button" className="prj-more" onClick={() => setDia("")}>{t.clearDay}</button>
          </div>
        )}
        {!admin && (
          <label className="prj-lbl mt-4" style={{ maxWidth: 360 }}>{t.yourName}
            <input className="prj-in" value={nome} onChange={(e) => setNome(e.target.value.slice(0, 60))} placeholder="e.g. Ana · Scale Pods" autoComplete="name" />
          </label>
        )}

        {FASES.map((f, fi) => {
          const lista = visiveis.filter((i) => i.fase === f);
          const todos = itens.filter((i) => i.fase === f);
          if (!lista.length && !admin) return null;
          if (!lista.length && (dia || dono !== "all" || abertos)) return null;
          return (
            <section key={f} className="prj-phase prj-rise" style={{ "--i": 6 + fi }}>
              <div className="prj-phase-h">
                <h2>{t.fases[f]}</h2>
                <span className="c">{todos.filter((i) => i.aceito).length}/{todos.length} {t.accepted.toLowerCase()}</span>
              </div>
              <div className="sn-panel overflow-hidden">
                <ul className="prj-list">
                  {lista.map((it, k) => (
                    <Item key={it.id} it={it} k={k} t={t} lang={lang} admin={admin} hoje={hoje} titulo={titulo(it)}
                      aberto={aberto === it.id} abrir={() => setAberto(aberto === it.id ? "" : it.id)}
                      pop={pop} flash={flash === it.id} marcar={marcar} mudar={mudar}
                      apagar={async () => { const r = await call({ action: "admin_apagar", slug, item: { id: it.id } }); if (r && r.ok) { setD(r); avisa(t.saved); } else avisa(errMsg(r)); }} />
                  ))}
                  {!lista.length && <li className="prj-item sn-muted text-sm" style={{ display: "block" }}>{t.empty}</li>}
                </ul>
                {admin && <NovoItem t={t} fase={f} criar={async (item) => { const r = await call({ action: "admin_salvar", slug, item }); if (r && r.ok) { setD(r); avisa(t.saved); return true; } avisa(errMsg(r)); return false; }} />}
              </div>
            </section>
          );
        })}

        <section className="prj-phase prj-rise" style={{ "--i": 12 }}>
          <div className="prj-phase-h"><h2>{t.activity}</h2><span className="c">{t.updated}: {fmtHora(d.agora, lang)}</span></div>
          <div className="sn-panel overflow-hidden">
            <form className="p-3 flex flex-wrap gap-2" onSubmit={async (e) => {
              e.preventDefault(); if (!msg.trim()) return;
              const r = await call(admin ? { action: "admin_comentar", slug, texto: msg } : { action: "comentar", texto: msg, nome });
              if (r && r.ok) { setD(r); setMsg(""); avisa(t.saved); } else avisa(errMsg(r));
            }}>
              <input className="prj-in" style={{ flex: "1 1 260px" }} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t.comment} aria-label={t.comment} />
              <button className="prj-btn" disabled={!msg.trim()}>{t.send}</button>
            </form>
            <ul className="prj-log">
              {d.eventos.slice(0, 60).map((e) => {
                const alvo = e.item_id && porId[e.item_id];
                return (
                  <li key={e.id}>
                    <div className="t">{fmtHora(e.criado_em, lang)}</div>
                    <div className="x"><span className="w">{e.nome ? `${e.nome} · ` : ""}{t.who[e.quem] || e.quem}</span> {t.acts[e.acao] || e.acao}
                      {alvo ? <> — <i>{titulo(alvo)}</i></> : null}
                      {e.acao === "comentario" && e.detalhe ? <>: “{e.detalhe}”</> : null}
                      {e.acao === "item_apagado" && e.detalhe ? <> — <i>{e.detalhe}</i></> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
        <div className="prj-foot">{t.foot}</div>
      </div>
      {toast && <div className="prj-toast" role="status" aria-live="polite">{toast}</div>}
    </Casca>
  );
}

function Casca({ children, t }) {
  return (
    <div className="sign-natura prj">
      <div className="sn-band" style={{ borderBottom: "1px solid #34312B" }}><div className="prj-wrap prj-band-in">
        <div className="prj-brand">
          <img src={logo} alt="" className="sn-band-logo" />
          <div><div className="sn-band-name">Guileo</div><div className="sn-band-sub">{t.brand}</div></div>
        </div>
        <img src={naturaLogo} alt="Natura Spa" className="prj-natura" />
      </div></div>
      {children}
    </div>
  );
}

function Item({ it, k, t, lang, admin, hoje, titulo, aberto, abrir, pop, flash, marcar, mudar, apagar }) {
  const st = estado(it, hoje);
  const travado = !admin && it.aceito;
  const [prova, setProva] = useState(it.prova_url || "");
  const [nota, setNota] = useState(it.nota || "");
  const [blk, setBlk] = useState(!!it.bloqueado);
  const [ed, setEd] = useState({ titulo: it.titulo, titulo_pt: it.titulo_pt || "", prazo: it.prazo || "", dono: it.dono, fase: it.fase });
  const [busy, setBusy] = useState(false);
  const [conf, setConf] = useState(false);
  useEffect(() => { if (!aberto) { setProva(it.prova_url || ""); setNota(it.nota || ""); setBlk(!!it.bloqueado); setEd({ titulo: it.titulo, titulo_pt: it.titulo_pt || "", prazo: it.prazo || "", dono: it.dono, fase: it.fase }); setConf(false); } }, [aberto, it]);

  const salvar = async (e) => {
    e.preventDefault(); setBusy(true);
    const campos = { prova_url: prova.trim(), nota, bloqueado: blk, ...(admin ? ed : {}) };
    const ok = await mudar(it, campos, t.saved);
    setBusy(false); if (ok) abrir();
  };

  return (
    <li className={"prj-item prj-rise" + (st === "acc" ? " acc" : "") + (st === "late" ? " late" : "") + (st === "blk" ? " blk" : "") + (flash ? " flash" : "")} style={{ "--i": Math.min(k, 12) }}>
      <div className="prj-checks">
        <label className="prj-cb" title={t.cbDone}>
          <input type="checkbox" checked={!!it.feito} disabled={travado} className={pop === it.id + "feito" ? "pop" : ""}
            onChange={() => marcar(it, "feito")} aria-label={`${t.cbDone}: ${titulo}`} />
          <span>{t.cbDone}</span>
        </label>
        <label className="prj-cb" title={t.cbAcc}>
          <input type="checkbox" checked={!!it.aceito} disabled={!admin} className={pop === it.id + "aceito" ? "pop" : ""}
            onChange={() => marcar(it, "aceito")} aria-label={`${t.cbAcc}: ${titulo}`} />
          <span>{t.cbAcc}</span>
        </label>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="prj-title">{titulo}</div>
        <div className="prj-meta">
          <span className={"prj-who " + it.dono}>{{ SP: t.sp, OR: t.or, NA: t.na }[it.dono]}</span>
          <span className={"prj-due" + (st === "late" ? " late" : "")}>{it.prazo ? `${t.due} ${fmtDia(it.prazo, lang)}` : t.noDate}</span>
          <span className={"prj-pill " + st}><i />{t.st[st]}</span>
          {it.prova_url && /^https:\/\//i.test(it.prova_url) && <a className="prj-link" href={it.prova_url} target="_blank" rel="noopener noreferrer">{t.proof} ↗</a>}
          {!travado && <button type="button" className="prj-more" onClick={abrir} aria-expanded={aberto}>{aberto ? t.close : t.details}</button>}
        </div>
        {it.nota && !aberto && <div className="prj-note">{it.nota}</div>}
        {it.feito && it.feito_em && <div className="prj-meta" style={{ marginTop: 3 }}>{t.done}: {fmtHora(it.feito_em, lang)}{it.feito_por ? ` · ${it.feito_por}` : ""}{it.aceito && it.aceito_em ? ` · ${t.accepted}: ${fmtHora(it.aceito_em, lang)}` : ""}</div>}
        {travado && <div className="prj-meta" style={{ marginTop: 3 }}>{t.lockedAcc}</div>}
      </div>
      {aberto && (
        <form className="prj-edit sn-soft" onSubmit={salvar}>
          {admin && (
            <>
              <div className="row">
                <label className="prj-lbl">{t.title}<input className="prj-in" value={ed.titulo} onChange={(e) => setEd({ ...ed, titulo: e.target.value })} required /></label>
                <label className="prj-lbl">{t.titlePt}<input className="prj-in" value={ed.titulo_pt} onChange={(e) => setEd({ ...ed, titulo_pt: e.target.value })} /></label>
              </div>
              <div className="row">
                <label className="prj-lbl">{t.due}<input type="date" className="prj-in" value={ed.prazo} onChange={(e) => setEd({ ...ed, prazo: e.target.value })} /></label>
                <label className="prj-lbl">{t.owner}<select className="prj-in" value={ed.dono} onChange={(e) => setEd({ ...ed, dono: e.target.value })}><option value="SP">{t.sp}</option><option value="OR">{t.or}</option><option value="NA">{t.na}</option></select></label>
                <label className="prj-lbl">{t.phase}<select className="prj-in" value={ed.fase} onChange={(e) => setEd({ ...ed, fase: e.target.value })}>{FASES.map((f) => <option key={f} value={f}>{t.fases[f]}</option>)}</select></label>
              </div>
            </>
          )}
          <label className="prj-lbl">{t.proof}<input className="prj-in" type="url" inputMode="url" value={prova} onChange={(e) => setProva(e.target.value)} placeholder={t.proofPh} /></label>
          <label className="prj-lbl">{t.note}<textarea className="prj-in" value={nota} onChange={(e) => setNota(e.target.value)} placeholder={t.notePh} /></label>
          <label className="prj-toggle"><input type="checkbox" className="sn-check" checked={blk} onChange={(e) => setBlk(e.target.checked)} /> {t.blocked}</label>
          <div className="prj-btns">
            <button className="prj-btn" disabled={busy}>{busy ? t.saving : t.save}</button>
            <button type="button" className="prj-btn ghost" onClick={abrir}>{t.close}</button>
            {admin && !conf && <button type="button" className="prj-btn danger" style={{ marginLeft: "auto" }} onClick={() => setConf(true)}>{t.del}</button>}
            {admin && conf && <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8, alignItems: "center" }}><b className="sn-err-t text-sm">{t.delSure}</b><button type="button" className="prj-btn danger" onClick={apagar}>{t.yes}</button><button type="button" className="prj-btn ghost" onClick={() => setConf(false)}>{t.no}</button></span>}
          </div>
        </form>
      )}
    </li>
  );
}

function NovoItem({ t, fase, criar }) {
  const [on, setOn] = useState(false);
  const [f, setF] = useState({ titulo: "", titulo_pt: "", dono: "SP", prazo: "" });
  if (!on) return <div className="px-4 py-3" style={{ borderTop: "1px solid var(--sn-line)" }}><button type="button" className="prj-more" onClick={() => setOn(true)}>{t.newItem}</button></div>;
  return (
    <form className="prj-edit sn-soft" style={{ margin: 12 }} onSubmit={async (e) => { e.preventDefault(); if (await criar({ ...f, fase })) { setF({ titulo: "", titulo_pt: "", dono: "SP", prazo: "" }); setOn(false); } }}>
      <div className="row">
        <label className="prj-lbl">{t.title}<input className="prj-in" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} required autoFocus /></label>
        <label className="prj-lbl">{t.titlePt}<input className="prj-in" value={f.titulo_pt} onChange={(e) => setF({ ...f, titulo_pt: e.target.value })} /></label>
      </div>
      <div className="row">
        <label className="prj-lbl">{t.due}<input type="date" className="prj-in" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} /></label>
        <label className="prj-lbl">{t.owner}<select className="prj-in" value={f.dono} onChange={(e) => setF({ ...f, dono: e.target.value })}><option value="SP">{t.sp}</option><option value="OR">{t.or}</option><option value="NA">{t.na}</option></select></label>
      </div>
      <div className="prj-btns"><button className="prj-btn">{t.add}</button><button type="button" className="prj-btn ghost" onClick={() => setOn(false)}>{t.close}</button></div>
    </form>
  );
}
