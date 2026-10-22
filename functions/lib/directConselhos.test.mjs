// Prova das regras de "o que melhorar" do Guileo Direct (src/portal/directConselhos.js).
// Cada regra tem o caso que a faz aparecer E o caso que a faz ficar quieta — conselho que aparece
// sempre é ruído, e ruído é o que faz o dono parar de ler o painel.
//   node functions/lib/directConselhos.test.mjs
import { conselhosDoDirect, DIAS_CONTA_MUDA } from "../../src/portal/directConselhos.js";

let falhas = 0;
const ok = (c, o) => { if (!c) { falhas++; console.log("  ✗ " + o); } else console.log("  ✓ " + o); };
const AGORA = Date.parse("2026-10-04T12:00:00Z");
const ids = (m) => conselhosDoDirect(m, AGORA).map((x) => x.id);
const base = (extra = {}) => ({
  funil: { comentarios: 0, casou: 0, segurado: 0, dm_enviado: 0, dm_falhou: 0, conversas: 0, leads: 0, ...(extra.funil || {}) },
  conversa: { recebidas: 0, respondidas: 0, nao_entregues: 0, standby: 0, quem_respondeu: {}, ...(extra.conversa || {}) },
  idioma_via: extra.idioma_via || {}, falhas: extra.falhas || [], contas: extra.contas || [], por_campanha: extra.por_campanha || [],
});

console.log("\n— o caso REAL da Chigo (lido de direct_metricas em 04/10) —");
const chigo = base({
  funil: { casou: 3, segurado: 6, dm_enviado: 3 },
  conversa: { recebidas: 167 },
  falhas: [{ n: 1, motivo: 'graph 400: {"error":{"message":"(#3) Application does not have the capability' }],
  contas: [{ ig_id: "17841445435680594", pagina: "Chigo Turismo e Negócios", ultima_dm_recebida: "2026-09-03T03:40:16Z" }],
  por_campanha: [{ nome: "Preço e visto", ativa: true, tem_link: false }],
});
const cc = conselhosDoDirect(chigo, AGORA);
ok(cc[0].nivel === "red" && cc[0].id === "falha_envio", "a falha de envio vem primeiro (vermelho no topo)");
const muda = cc.find((x) => x.id === "conta_muda");
ok(muda && muda.vars.n === 31 && muda.vars.conta === "Chigo Turismo e Negócios", "acusa a conta muda há 31 dias — o silêncio de 03/09 que ninguém viu por um mês");
ok(ids(chigo).includes("sem_link"), "acusa a campanha sem link (lead impossível de contar)");
ok(ids(chigo).includes("freio") && !ids(chigo).includes("tudo_certo"), "explica o freio, e NÃO diz 'tudo certo' com problema aberto");

console.log("\n— cada limiar: aparece quando deve, cala quando não deve —");
const conta = (dias) => [{ usuario: "loja", ultima_dm_recebida: new Date(AGORA - dias * 86400000).toISOString() }];
ok(!ids(base({ contas: conta(DIAS_CONTA_MUDA) })).includes("conta_muda"), `${DIAS_CONTA_MUDA} dias sem DM ainda não é alarme`);
ok(ids(base({ contas: conta(DIAS_CONTA_MUDA + 1) })).includes("conta_muda"), `${DIAS_CONTA_MUDA + 1} dias sem DM é`);
ok(ids(base({ contas: [{ usuario: "nova" }] })).includes("conta_sem_dm"), "conta que nunca recebeu DM pelo Guileo é dita como tal (não como 'muda')");
ok(!ids(base({ contas: [{ usuario: "guileo.ad" }, { pagina: "Guileo AI" }], conversa: { recebidas: 11, sem_conta: 11 } })).includes("conta_sem_dm"),
   "o caso REAL da Guileo: 11 DMs sem conta conhecida → NÃO acusa 'nunca recebeu' (seria mentira)");
ok(conselhosDoDirect(base({ contas: conta(30) }), AGORA).find((x) => x.id === "conta_muda").vars.conta === "@loja", "usa o @ quando existe");

ok(ids(base({ funil: { dm_enviado: 10 }, idioma_via: { padrao: 4 } })).includes("idioma_padrao"), "40% no idioma padrão → falta tradução");
ok(!ids(base({ funil: { dm_enviado: 10 }, idioma_via: { padrao: 3 } })).includes("idioma_padrao"), "30% ainda não acusa");
ok(!ids(base({ funil: { dm_enviado: 4 }, idioma_via: { padrao: 4 } })).includes("idioma_padrao"), "com menos de 5 DMs não conclui nada (amostra pequena)");

ok(ids(base({ funil: { comentarios: 100, casou: 4 } })).includes("poucos_casam"), "4 de 100 comentários casam → palavra errada");
ok(!ids(base({ funil: { comentarios: 19, casou: 0 } })).includes("poucos_casam"), "com menos de 20 comentários não conclui");

ok(ids(base({ funil: { dm_enviado: 20, conversas: 1 } })).includes("poucas_conversas"), "1 conversa em 20 DMs → o DM não puxa resposta");
ok(!ids(base({ funil: { dm_enviado: 20, conversas: 2 } })).includes("poucas_conversas"), "10% já não acusa");

const fs = (n, tot) => base({ conversa: { respondidas: tot, quem_respondeu: { frase_segura: n, elevenlabs: tot - n } } });
ok(ids(fs(3, 10)).includes("frase_segura"), "30% de frase segura → a IA está desistindo");
ok(!ids(fs(2, 10)).includes("frase_segura"), "20% ainda não acusa");
ok(!ids(fs(3, 4)).includes("frase_segura"), "com menos de 5 respostas não conclui");

ok(ids(base({ conversa: { standby: 2 } })).includes("standby"), "standby aparece (outro app dono da conversa)");
ok(ids(base({ conversa: { nao_entregues: 1 } }))[0] === "nao_entregues", "resposta não entregue é vermelho");

console.log("\n— o verde e o vazio —");
ok(ids(base({ funil: { dm_enviado: 8, conversas: 3 }, contas: conta(1) })).join() === "tudo_certo", "sem nada a consertar e com DMs saindo → 'tudo certo' (e só isso)");
ok(ids(base()).join() === "sem_dados", "período vazio → diz que está vazio, não inventa conselho");
ok(conselhosDoDirect(null).length === 0 && conselhosDoDirect({}).length === 0, "métrica ausente → nenhum conselho (a tela mostra o erro de leitura)");

console.log(falhas ? `\n❌ ${falhas} falha(s)\n` : "\n✅ directConselhos: cada regra aparece e cala na hora certa\n");
process.exit(falhas ? 1 : 0);
