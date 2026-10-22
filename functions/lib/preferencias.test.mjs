// node --test functions/lib/preferencias.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { servicoDeCuidado, ehMassagem, limparPrefs, resumoPrefs, resumoCurto, corDoBotao, contrasteComBranco } from "./preferencias.js";
import { appointmentEmail, appointmentReminderEmail, visitPrefsEmail } from "./emailTemplates.js";

test("só serviço de cuidado recebe o link", () => {
  for (const s of ["Massage 60min · Astoria", "Deep Tissue 60min", "Facial + Microdermabrasion", "Haircut · UES", "Hair Color", "Lashes · Astoria (classic set)", "Deep Pore Cleansing", "Acupuncture", "Manicure"]) assert.ok(servicoDeCuidado(s), s);
  for (const s of ["Table for 2", "Drain cleaning", "AC repair", "Consultation call", "", null]) assert.equal(servicoDeCuidado(s), false, String(s));
});

test("pressão e foco só para massagem", () => {
  assert.ok(ehMassagem("Deep Tissue 60min"));
  assert.ok(ehMassagem("Massage 90min · UES Med Spa"));
  assert.equal(ehMassagem("Facial · Astoria"), false);
});

test("só entra o que é permitido; vazio não grava", () => {
  const r = limparPrefs({ conversation: "quiet", pressure: "brutal", scent: "none", allergies: "  Nuts\n and   latex ", hack: "x", notes: "a".repeat(900) });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.prefs).sort(), ["allergies", "conversation", "notes", "scent"]);
  assert.equal(r.prefs.allergies, "Nuts and latex");
  assert.equal(r.prefs.notes.length, 500);
  assert.equal(limparPrefs({}).ok, false);
  assert.equal(limparPrefs({ pressure: "brutal", focus: "   " }).ok, false);
  assert.equal(limparPrefs(null).ok, false);
  assert.equal(limparPrefs({ allergies: "nuts\u0000\u0007" }).prefs.allergies, "nuts");
});

test("resumo: alergia primeiro, valores no idioma do negócio", () => {
  const l = resumoPrefs({ conversation: "quiet", allergies: "Nuts", pressure: "firm" }, "pt");
  assert.deepEqual(l[0], ["Alergias ou sensibilidades", "Nuts"]);
  assert.deepEqual(l[1], ["Conversa", "Prefiro silêncio"]);
  assert.match(resumoCurto({ allergies: "x" }, "Maria", "Massage"), /alergia informada/);
});

test("e-mail de confirmação: linha só com link https e só em quem marcou", () => {
  const com = appointmentEmail({ kind: "book", name: "Ana", service: "Massage", prefsUrl: "https://guileoai.com/api/preferencias?t=a&a=b&s=c" }).html;
  assert.match(com, /Tell us how you like it/);
  assert.doesNotMatch(appointmentEmail({ kind: "book", name: "Ana", prefsUrl: "" }).html, /how you like it/);
  assert.doesNotMatch(appointmentEmail({ kind: "cancel", name: "Ana", prefsUrl: "https://x.test/p" }).html, /how you like it/);
  assert.doesNotMatch(appointmentEmail({ kind: "book", name: "Ana", prefsUrl: "javascript:alert(1)" }).html, /how you like it/);
  assert.match(appointmentReminderEmail({ name: "Ana", prefsUrl: "https://guileoai.com/api/preferencias?t=a" }).html, /My preferences/);
  assert.doesNotMatch(appointmentReminderEmail({ name: "Ana" }).html, /My preferences/);
});

test("aviso ao salão: alergia em destaque e escapada", () => {
  const { subject, html } = visitPrefsEmail({ customer: "Maria", service: "Massage", linhas: [["Conversation", "Quiet time, please"]], alergia: "<b>Nuts</b>", lang: "en" });
  assert.match(subject, /How Maria likes it/);
  assert.match(html, /Allergy or sensitivity/);
  assert.match(html, /&lt;b&gt;Nuts/);
  assert.doesNotMatch(html, /<b>Nuts/);
});

test("cor do botão: texto branco sempre legível", () => {
  for (const c of ["#4d88a0", "#015577", "#FF8A33", "#D4AF37", "#ffffff", "#C37B89"]) assert.ok(contrasteComBranco(corDoBotao(c)) >= 4.5, c);
  assert.equal(corDoBotao("#015577"), "#015577");   // a cor da marca já passa: não mexe
  assert.equal(corDoBotao("nada"), "#98505F");
});
