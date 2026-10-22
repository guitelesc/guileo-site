#!/usr/bin/env python3
# PROVA AO VIVO DO PONTO + "MEU MÊS" (/api/desk-eu, 2026-10-05). Só a conta e2e-test@guileoai.com.
#
#   DESK_E2E_KEY=<chave da conta e2e> python3 scripts/desk_eu_smoke.py [https://guileoai.com]
#
# Cria UM acesso de profissional para a Ana (pro 32e804f4…), bate entrada e saída, lê o relatório da dona,
# confere o "meu mês" e as recusas (equipe não lê relatório, dona não bate ponto, revogada não bate), e no fim
# REVOGA o acesso. Não apaga nada: os 1–2 turnos de prova ficam no ponto da conta de teste (é o registro).
# Sai com código 1 se qualquer verificação falhar. Python puro + User-Agent (a Cloudflare barra urllib cru).
import json, os, sys, time, urllib.request, urllib.error, datetime as dt

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://guileoai.com").rstrip("/")
E = "e2e-test@guileoai.com"
K = os.environ.get("DESK_E2E_KEY", "").strip()
if not K:
    sys.exit("defina DESK_E2E_KEY (a chave da conta e2e-test)")
H = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 guileo-desk-smoke", "Origin": "https://guileoai.com"}
ANA = "32e804f4-89e8-4fbf-ac8f-0fa8414bf1ae"
resultados = []

def post(path, body):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers=H)
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
    except Exception as e:
        return 0, {"erro": str(e)[:80]}

def ok(nome, cond, info=""):
    resultados.append((bool(cond), nome, str(info)[:110]))
    print(("✅" if cond else "❌"), nome, str(info)[:110])

desk = lambda b: post("/api/desk", {"email": E, "key": K, **b})
dona = lambda b: post("/api/desk-eu", {"email": E, "key": K, **b})
t0 = time.time()

# porta e recusas sem código
s, j = post("/api/desk-eu", {"email": E, "key": "errada", "action": "ponto_relatorio", "de": "2026-10-01", "ate": "2026-10-02"}); ok("dona: chave errada → 401", s == 401, s)
s, j = dona({"action": "ponto_bater", "esperado": "entrada"}); ok("dona NÃO bate ponto (403)", s == 403 and j.get("reason") == "role_forbidden", s)
s, j = dona({"action": "meu_mes"}); ok("dona: meu_mes é só da profissional (403)", s == 403, s)
s, j = dona({"action": "inventada"}); ok("ação desconhecida → 400", s == 400, s)

# acesso da profissional (Ana)
s, j = desk({"action": "acessos_criar", "nome": "Smoke Ponto Ana", "papel": "profissional", "pro_id": ANA}); cod, aid = j.get("codigo", ""), j.get("id")
ok("criar código da profissional", s == 200 and cod.startswith("bal_") and aid, j.get("papel"))
if not cod:
    sys.exit(1)
eu = lambda b: post("/api/desk-eu", {"email": E, "key": cod, **b})
try:
    s, j = eu({"action": "ponto_status"}); ok("status: começa fora do turno", s == 200 and j.get("ok") and j.get("dentro") is False and j.get("tz"), j.get("tz"))
    s, j = eu({"action": "ponto_bater", "esperado": "entrada"}); turno = (j.get("turno") or {}).get("id")
    ok("bater entrada", s == 200 and j.get("acao") == "entrada" and turno and (j.get("turno") or {}).get("pro_id") == ANA, j.get("acao"))
    s, j = eu({"action": "ponto_bater", "esperado": "entrada"}); ok("toque duplo não abre outro turno (409)", s == 409 and j.get("reason") == "state_changed", s)
    s, j = eu({"action": "ponto_status"}); ok("status: dentro, com a entrada", j.get("dentro") is True and (j.get("aberto") or {}).get("id") == turno, j.get("aberto"))
    s, j = eu({"action": "ponto_relatorio", "de": "2026-10-01", "ate": "2026-10-05"}); ok("equipe NÃO lê o relatório (403)", s == 403 and j.get("reason") == "role_forbidden", s)
    s, j = eu({"action": "ponto_corrigir", "id": turno, "saida": dt.datetime.now(dt.timezone.utc).isoformat(), "motivo": "tentativa"}); ok("equipe NÃO acerta turno (403)", s == 403, s)
    time.sleep(2)
    s, j = eu({"action": "ponto_bater", "esperado": "saida"}); ok("bater saída fecha o MESMO turno", s == 200 and j.get("acao") == "saida" and (j.get("turno") or {}).get("id") == turno and (j.get("turno") or {}).get("saida"), j.get("acao"))
    s, j = eu({"action": "ponto_bater", "esperado": "saida"}); ok("saída sem entrada recusada (409)", s == 409, s)
    # meu mês: só os números dela, marcado como estimativa
    s, j = eu({"action": "meu_mes"})
    campos = ("concluidos", "faltas", "servicos_cents", "produtos_cents", "gorjetas_cents", "comissao_cents", "pct_servico")
    ok("meu mês: números dela, estimativa", s == 200 and j.get("ok") and j.get("estimativa") is True and all(c in j for c in campos) and j.get("nome") == "Teste Ana",
       {c: j.get(c) for c in ("concluidos", "servicos_cents", "comissao_cents")})
    ok("meu mês: nenhum número de outra profissional no corpo", "pro_sales" not in j and "pessoas" not in j, sorted(j.keys())[:6])
    # relatório da dona (período de hoje no fuso do negócio, com folga de 1 dia)
    hoje = dt.datetime.now(dt.timezone.utc).date()
    s, j = dona({"action": "ponto_relatorio", "de": str(hoje - dt.timedelta(days=1)), "ate": str(hoje + dt.timedelta(days=1))})
    meu = [t for t in j.get("turnos", []) if t.get("id") == turno]
    ok("dona: relatório traz o turno fechado", s == 200 and j.get("ok") and meu and meu[0].get("situacao") == "fechado" and meu[0].get("minutos") is not None, meu[0].get("situacao") if meu else s)
    ok("dona: CSV com cabeçalho", j.get("csv", "").startswith("nome,papel,dia,entrada,saida,minutos"), j.get("csv", "")[:40])
    pessoa = [p for p in j.get("pessoas", []) if p.get("acesso_id") == aid]
    ok("dona: horas por pessoa/dia/semana", pessoa and pessoa[0].get("turnos") >= 1 and pessoa[0].get("dias") and pessoa[0].get("semanas"), pessoa[0].get("dias") if pessoa else None)
    s, j = dona({"action": "ponto_relatorio", "de": "2026-01-01", "ate": "2026-12-31"}); ok("dona: período grande demais recusado", s in (200, 400) and j.get("reason") == "invalid_range", j.get("reason"))
    s, j = dona({"action": "ponto_corrigir", "id": turno, "saida": dt.datetime.now(dt.timezone.utc).isoformat(), "motivo": ""}); ok("dona: acerto sem motivo recusado", s == 400 and j.get("reason") == "reason_required", j.get("reason"))
    s, j = dona({"action": "ponto_corrigir", "id": turno, "entrada": "2026-10-05T10:00:00Z", "saida": "2026-10-05T09:00:00Z", "motivo": "ordem trocada"}); ok("dona: saída antes da entrada recusada", j.get("reason") == "invalid_hours", j.get("reason"))
finally:
    s, j = desk({"action": "acessos_revogar", "id": aid}); ok("revogar o acesso de prova", j.get("ok"), j)

s, j = eu({"action": "ponto_bater", "esperado": "entrada"}); ok("revogada NÃO bate ponto (401)", s == 401, s)
s, j = eu({"action": "meu_mes"}); ok("revogada NÃO lê o mês (401)", s == 401, s)

falhas = [r for r in resultados if not r[0]]
print(f"\n{len(resultados) - len(falhas)}/{len(resultados)} em {time.time() - t0:.1f}s")
sys.exit(1 if falhas else 0)
