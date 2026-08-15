// VOZ NO NAVEGADOR — testes da parte que não dá pra ver.  node functions/lib/vozWeb.test.mjs
//
// POR QUE EXISTE: erro de áudio não estoura. Formato lido errado, byte na ordem errada, μ-law
// invertido — nada disso lança exceção: sai silêncio, chiado ou voz de robô, e a gente só
// descobre com um cliente do outro lado dizendo "não te escuto". A matemática do som é a única
// parte testável fora do navegador, então ela é testada aqui.
import { _interno, suporteDeVoz } from "../../src/lib/voiceWeb.js";

const { lerFormato, ulawParaPcm, pcmParaUlaw, paraB64, deB64 } = _interno;
let falhas = 0;
const ok = (cond, nome) => { console.log(`${cond ? "✅" : "❌"} ${nome}`); if (!cond) falhas++; };

// 1) formato negociado pelo servidor — o padrão só vale quando não veio nada
ok(lerFormato("pcm_16000").taxa === 16000 && lerFormato("pcm_16000").tipo === "pcm", "lê pcm_16000");
ok(lerFormato("pcm_48000").taxa === 48000, "lê pcm_48000 (não fixa 16k)");
ok(lerFormato("ulaw_8000").tipo === "ulaw" && lerFormato("ulaw_8000").taxa === 8000, "lê ulaw_8000");
ok(lerFormato("").taxa === 16000, "sem formato → padrão 16k");
ok(lerFormato("formato_maluco", { tipo: "pcm", taxa: 24000 }).taxa === 24000, "formato desconhecido cai no padrão informado");

// 2) μ-law ida e volta: o erro tem que ser pequeno (é compressão com perda, não identidade)
let pior = 0;
for (let v = -32000; v <= 32000; v += 137) {
  const volta = ulawParaPcm(pcmParaUlaw(v));
  pior = Math.max(pior, Math.abs(volta - v) / 32768);
}
ok(pior < 0.02, `μ-law ida-e-volta com erro < 2% (pior: ${(pior * 100).toFixed(2)}%)`);
ok(pcmParaUlaw(0) !== pcmParaUlaw(20000), "μ-law distingue silêncio de sinal alto");

// 3) base64 de bytes — o que vai no fio. Um off-by-one aqui vira chiado puro.
const bytes = new Uint8Array([0, 1, 127, 128, 255, 42, 7, 9]);
ok(paraB64(bytes) === Buffer.from(bytes).toString("base64"), "base64 igual ao do runtime");
ok([...deB64(paraB64(bytes))].join() === [...bytes].join(), "base64 ida-e-volta preserva os bytes");

// 4) bloco grande não pode estourar a pilha (era o bug clássico do fromCharCode.apply)
const grande = new Uint8Array(200000).map((_, i) => i % 251);
let sobreviveu = true;
try { paraB64(grande); } catch { sobreviveu = false; }
ok(sobreviveu, "base64 de 200KB não estoura a pilha");

// 5) fora do navegador o suporte responde MOTIVO, nunca lança — é o que garante a degradação honesta
let r; let lancou = false;
try { r = suporteDeVoz(); } catch { lancou = true; }
ok(!lancou && r && r.ok === false && !!r.motivo, "suporteDeVoz fora do navegador devolve motivo em vez de quebrar");

console.log(falhas ? `\n❌ ${falhas} falha(s)` : "\n✅ voz no navegador: matemática do áudio ok");
process.exit(falhas ? 1 : 0);
