// Guileo cron-worker — o despertador. A cada 15 min chama /api/cron-tick, que faz o
// fan-out interno com o DIGEST_TOKEN do lado do servidor (este worker NÃO carrega segredo).
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(fetch("https://guileoai.com/api/cron-tick", { method: "POST" }).catch(() => {}));
  },
  async fetch() {
    return new Response("guileo cron-worker · alive", { status: 200 });
  },
};
