// node --test functions/lib/desligaAnthropic.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { desligaAnthropic } from "../api/_middleware.js";

test("sem ANTHROPIC_LIGADA, a chave some para o resto do código", () => {
  const env = { ANTHROPIC_API_KEY: "sk-x", ELEVENLABS_API_KEY: "e" };
  assert.equal(desligaAnthropic(env), true);
  assert.equal(env.ANTHROPIC_API_KEY, "");
  assert.equal(env.ELEVENLABS_API_KEY, "e", "a ElevenLabs não é tocada");
});
test("ANTHROPIC_LIGADA=1 religa sem deploy de código", () => {
  const env = { ANTHROPIC_API_KEY: "sk-x", ANTHROPIC_LIGADA: "1" };
  assert.equal(desligaAnthropic(env), false);
  assert.equal(env.ANTHROPIC_API_KEY, "sk-x");
});
test("env ausente não derruba", () => { assert.equal(desligaAnthropic(undefined), false); });
