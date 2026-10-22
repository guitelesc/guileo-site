// TRAVA POR PLANO DO GUILEO DESK (2026-10-05). Planos e preços: src/data/deskPlans.js.
// Quem decide o plano é o BANCO (desk_plano_svc): null = LEGADO (conta de antes do checkout do Desk, ou com
// contrato) → sem trava nenhuma. 'nenhum' = assinatura cancelada → só ler a agenda e exportar a base.
// Cada ação do /api/desk tem o plano MÍNIMO aqui; ação que não está no mapa é "basic".
export const ORDEM_DESK = ["basic", "medium", "pro", "ultra", "custom"];

export const PLANO_MINIMO = {
  agenda: "basic", move: "basic", note: "basic", status: "basic", availability: "basic", book: "basic", book_group: "basic", addons_set: "basic", noshow_undo: "basic", regras_get: "basic", regras_set: "basic", package_edit: "basic", block: "basic",
  catalog: "basic", client_search: "basic", client_card: "basic", client_save: "basic", export: "basic",
  merge_suggest: "basic", merge_preview: "basic", merge: "basic", merge_undo: "basic", merge_dismiss: "basic",
  staff_save: "basic", hours_set: "basic", inactive: "basic", service_save: "basic",
  // Medium — o balcão inteiro
  checkout: "medium", coupon_check: "medium", void: "medium", sale: "medium", receipt: "medium", day_close: "medium", product_save: "medium",
  import_clients: "medium", import_appointments: "medium", take_over_reminders: "medium", book_repeat: "medium",
  // Pro — a IA e os relatórios
  reports: "pro", absence_plan: "pro", absence_notify: "pro", deposit_link: "pro", assistente: "pro",
  publico_cruzado: "pro", relatorio_mensal: "pro",
};

// plano efetivo (null = legado) × ação → { ok } | { ok:false, precisa }
export function podeNoDesk(plano, acao) {
  if (plano == null) return { ok: true };                       // legado: nada muda
  const precisa = PLANO_MINIMO[acao] || "basic";
  // Cancelou: lê a agenda e LEVA A BASE embora ("sem taxa de saída", promessa do /desk).
  if (plano === "nenhum") return acao === "agenda" || acao === "export" ? { ok: true } : { ok: false, precisa };
  return ORDEM_DESK.indexOf(plano) >= ORDEM_DESK.indexOf(precisa) ? { ok: true } : { ok: false, precisa };
}
