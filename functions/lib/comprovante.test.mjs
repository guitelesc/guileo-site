// GUARDA DO COMPROVANTE — reserva feita sem nada na mão do cliente não pode sair calada.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// QUE DEFEITO REAL ESTE TESTE IMPEDE DE VOLTAR
// GUI-42F0 (2026-08-16), o PRIMEIRO agendamento real da plataforma: horário reservado, cliente
// sem e-mail no cadastro, SMS recusado pela campanha A2P. Não havia por onde mandar o comprovante
// — e o código tratou isso como "pulo legítimo". Resultado: o cliente não recebeu nada, o dono
// não soube que precisava ligar, e a falha só apareceu porque alguém foi procurar.
//
// Os quatro modos de errar que estes casos travam:
//   1. NENHUM canal → passar batido (era literalmente `return ok` em silêncio);
//   2. o provedor RECUSAR (Resend 4xx: domínio não verificado / endereço ruim) e alguém contar
//      isso como enviado — a mesma família do "200 de PATCH = mudou";
//   3. escolher o SMS enquanto o A2P está bloqueado, e registrar "avisado" para uma mensagem
//      que a Twilio recusou (erro 30034);
//   4. dizer ENTREGUE quando só temos ACEITO. Ninguém aqui recebeu confirmação de entrega.
//
// Sem rede: todos os envios e registros são injetados por `deps`.
import { entregarComprovante, escolherCanal, repararComprovante, canaisDisponiveis } from "./comprovante.js";

let falhas = 0;
const ok = (cond, oque, detalhe = "") => {
  if (cond) return;
  falhas++;
  console.log(`❌ ${oque}${detalhe ? `\n     ${detalhe}` : ""}`);
};

// Ambiente base: e-mail LIGADO (é o que a Guileo tem hoje), SMS e WhatsApp DESLIGADOS.
const ENV = { RESEND_API_KEY: "re_teste", INGEST_SECRET: "x", TWILIO_ACCOUNT_SID: "AC", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM: "+1555" };

// Fábrica de deps: registra tudo o que o módulo tentou fazer, sem tocar em rede.
function espiao({ emailAceita = true, textoAceita = true, motivoEmail = "resend 403: domain not verified" } = {}) {
  const s = { emails: [], textos: [], eventos: [], falhas: [] };
  return {
    s,
    deps: {
      enviarEmail: async (env, destino, p) => { s.emails.push({ destino, p }); return emailAceita ? { aceito: true } : { aceito: false, motivo: motivoEmail }; },
      enviarTexto: async (env, canal, destino, p) => { s.textos.push({ canal, destino, p }); return textoAceita ? { aceito: true } : { aceito: false, motivo: "twilio 30034" }; },
      registrar: async (env, ev) => { s.eventos.push(ev); },
      emitirFalha: async (env, tipo, tenant, detalhe) => { s.falhas.push({ tipo, tenant, detalhe }); },
    },
  };
}

const BASE = { tenant: "spa@exemplo.com", kind: "book", name: "Louise", service: "Massagem", whenLabel: "seg, 18 ago às 09:00", ref: "GUI-42F0", lang: "pt" };

// ── CASO 1 — SÓ TELEFONE (O GUI-42F0 EXATO) ───────────────────────────────────────────────────
{
  const { s, deps } = espiao();
  const r = await entregarComprovante(ENV, { ...BASE, phone: "929-535-0191" }, deps);
  ok(r.estado === "sem_canal", "1. só telefone: estado deve ser 'sem_canal'", `obtido: ${r.estado}`);
  ok(s.emails.length === 0 && s.textos.length === 0, "1. só telefone: nada pode ser enviado (SMS bloqueado)");
  ok(s.eventos.length === 1, "1. só telefone: tem que gravar UMA linha na trilha do tenant", `gravou ${s.eventos.length}`);
  ok(s.falhas.length === 1 && s.falhas[0].tipo === "comprovante_sem_canal", "1. só telefone: o DONO tem que ser avisado (barramento de falhas)");
  ok(/929-535-0191/.test(s.eventos[0]?.resumo || ""), "1. o aviso precisa trazer o telefone para o dono LIGAR", s.eventos[0]?.resumo);
  ok(s.eventos[0]?.payload?.comprovante === "pendente", "1. tem que ficar marcado como pendente (caminho de reparo do estoque)");
  ok(r.pendencia && r.pendencia.motivo === "sem_canal", "1. o resultado devolve a pendência para quem for reparar");
}

// ── CASO 2 — SÓ E-MAIL ────────────────────────────────────────────────────────────────────────
{
  const { s, deps } = espiao();
  const r = await entregarComprovante(ENV, { ...BASE, email: "luistelesc@gmail.com" }, deps);
  ok(r.estado === "aceito" && r.canal === "email", "2. só e-mail: manda por e-mail e aceita", `${r.estado}/${r.canal}`);
  ok(s.emails.length === 1 && s.emails[0].destino === "luistelesc@gmail.com", "2. o destino tem que ser o e-mail do cliente");
  ok(r.entrega_confirmada === false, "2. ⚠️ ACEITO NÃO É ENTREGUE — nada aqui pode afirmar entrega");
  ok(s.eventos[0]?.payload?.entrega_confirmada === false, "2. o registro também não pode afirmar entrega");
  ok(s.falhas.length === 0, "2. sucesso não pode disparar alerta de falha");
}

// ── CASO 3 — OS DOIS (e-mail ganha: é o único comprovante COMPLETO) ───────────────────────────
{
  const { s, deps } = espiao();
  const r = await entregarComprovante(ENV, { ...BASE, email: "luistelesc@gmail.com", phone: "929-535-0191" }, deps);
  ok(r.canal === "email", "3. os dois: o e-mail tem prioridade (leva endereço, mapa e referência)", `escolheu ${r.canal}`);
  ok(s.textos.length === 0, "3. os dois: não pode gastar um SMS bloqueado por cima do e-mail aceito");
}

// ── CASO 4 — NENHUM CONTATO ───────────────────────────────────────────────────────────────────
{
  const { s, deps } = espiao();
  const r = await entregarComprovante(ENV, { ...BASE }, deps);
  ok(r.estado === "sem_canal", "4. nenhum contato: 'sem_canal'", r.estado);
  ok(s.falhas.length === 1, "4. nenhum contato é o PIOR caso — o dono tem que saber na hora");
  ok(/Não temos nem telefone/.test(s.eventos[0]?.resumo || ""), "4. o aviso tem que dizer que não há nem para onde ligar", s.eventos[0]?.resumo);
}

// ── CASO 5 — E-MAIL RECUSADO PELO PROVEDOR ────────────────────────────────────────────────────
// O modo de falhar mais perigoso: houve tentativa, houve resposta, e ela foi 4xx. Contar isso
// como sucesso é exatamente o erro do "200 = mudou".
{
  const { s, deps } = espiao({ emailAceita: false });
  const r = await entregarComprovante(ENV, { ...BASE, email: "luis@dominio-nao-verificado.com" }, deps);
  ok(r.estado === "recusado", "5. Resend 4xx: estado 'recusado', NUNCA aceito", r.estado);
  ok(r.canal === null, "5. recusado não tem canal de sucesso");
  ok(/resend 403/.test(r.motivo || ""), "5. o motivo real do provedor tem que sobreviver até o resultado", r.motivo);
  ok(s.falhas.length === 1 && s.falhas[0].tipo === "comprovante_recusado", "5. recusa do provedor avisa o dono, com tipo próprio");
  ok(s.eventos[0]?.payload?.comprovante === "pendente", "5. recusa também entra na fila de reparo");
}

// ── CASO 6 — O SMS VOLTA A SER OPÇÃO QUANDO O A2P APROVAR, SEM REESCREVER NADA ─────────────────
{
  const envA2P = { ...ENV, SMS_A2P_APROVADO: "1" };
  const escolha = escolherCanal(envA2P, { phone: "929-535-0191" });
  ok(escolha.canal === "sms", "6. com SMS_A2P_APROVADO=1 o SMS volta a ser escolhido", `escolheu ${escolha.canal}`);
  const { s, deps } = espiao();
  const r = await entregarComprovante(envA2P, { ...BASE, phone: "929-535-0191" }, deps);
  ok(r.estado === "aceito" && r.canal === "sms", "6. e o envio por SMS acontece", `${r.estado}/${r.canal}`);
  ok(s.textos[0]?.canal === "sms", "6. o texto curto sai pelo canal certo");
}

// ── CASO 7 — TELEFONE QUEBRADO NÃO É CANAL (o 929-535-191 do GUI-42F0) ────────────────────────
{
  const envA2P = { ...ENV, SMS_A2P_APROVADO: "1" };
  const e = escolherCanal(envA2P, { phone: "929-535-191" });
  ok(e.canal === null, "7. telefone de 9 dígitos não é destino, nem com o A2P ligado", `escolheu ${e.canal}`);
  ok(/inválido/.test(e.bloqueios.find((b) => b.canal === "sms")?.motivo || ""), "7. e o motivo tem que dizer que o telefone é inválido");
}

// ── CASO 8 — O ESTOQUE: reparar uma pendência quando o e-mail finalmente aparece ───────────────
{
  const { s: s1, deps: d1 } = espiao();
  const r1 = await entregarComprovante(ENV, { ...BASE, phone: "929-535-0191" }, d1);
  ok(r1.estado === "sem_canal", "8. pré-condição: nasce pendente");
  const { s: s2, deps: d2 } = espiao();
  const r2 = await repararComprovante(ENV, { ...r1.pendencia, tenant: BASE.tenant }, { email: "luistelesc@gmail.com", service: "Massagem", lang: "pt" }, d2);
  ok(r2.estado === "aceito" && r2.canal === "email", "8. reparo entrega pelo MESMO motor", `${r2.estado}/${r2.canal}`);
  ok(s2.eventos.some((e) => e.payload?.comprovante === "resolvido"), "8. e fecha a pendência (senão a varredura alerta para sempre)");
  ok(s2.eventos.some((e) => /GUI-42F0/.test(e.payload?.ref || "")), "8. a referência do agendamento tem que atravessar o reparo");
}

// ── CASO 9 — REGISTRO/ALERTA QUEBRADO NUNCA DERRUBA O AGENDAMENTO ─────────────────────────────
// A reserva já existe. Explodir aqui trocaria "cliente sem comprovante" por "erro na ligação".
{
  const deps = {
    enviarEmail: async () => { throw new Error("fetch failed"); },
    registrar: async () => { throw new Error("supabase fora"); },
    emitirFalha: async () => { throw new Error("bus fora"); },
  };
  let explodiu = false; let r = null;
  try { r = await entregarComprovante(ENV, { ...BASE, email: "luistelesc@gmail.com" }, deps); } catch { explodiu = true; }
  ok(!explodiu, "9. nada aqui pode lançar — o agendamento já aconteceu");
  ok(r && r.estado === "recusado", "9. exceção de transporte conta como RECUSA, nunca como sucesso", r && r.estado);
  ok(r && r.registrado === false, "9. e o resultado admite que NÃO conseguiu registrar (não chuta 'true')");
}

// ── CASO 10 — o retrato dos canais explica cada recusa ────────────────────────────────────────
{
  const lista = canaisDisponiveis(ENV, { phone: "929-535-0191" });
  ok(lista.every((c) => c.ok || c.motivo), "10. todo canal indisponível tem que dizer POR QUÊ");
  ok(/A2P/.test(lista.find((c) => c.canal === "sms")?.motivo || ""), "10. o motivo do SMS tem que nomear o bloqueio real (A2P)");
}

if (falhas) {
  console.log(`\n${falhas} caso(s) errado(s). O que está em jogo:`);
  console.log("   comprovante que não sai e ninguém vê -> o cliente não aparece e o negócio culpa a Guileo;");
  console.log("   'enviado' afirmado sem prova        -> o dono para de conferir, e a falha seguinte some junto.");
  process.exit(1);
}
console.log("✅ comprovante: sem canal vira tarefa do dono, recusa do provedor não vira sucesso, e 'aceito' nunca vira 'entregue'");
