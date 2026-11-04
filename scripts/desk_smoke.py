#!/usr/bin/env python3
# PROVA COMPLETA DO GUILEO DESK, AO VIVO (2026-10-05). Roda TODAS as ações do Balcão na conta de teste
# e2e-test@guileoai.com e desfaz o que criou. Use depois de cada deploy:
#
#   DESK_E2E_KEY=<chave da conta e2e> python3 scripts/desk_smoke.py [https://guileoai.com]
#
# Regras: só a conta e2e-test (nunca outra); a chave vem da variável, nunca do código; nenhuma cobrança
# real (o Stripe do negócio de teste não está conectado — as ações de pagamento devem dizer isso).
# Sai com código 1 se qualquer verificação falhar. Python puro + User-Agent (a Cloudflare barra urllib cru).
import json, os, sys, time, urllib.request, urllib.error, datetime as dt

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://guileoai.com").rstrip("/")
E = "e2e-test@guileoai.com"
K = os.environ.get("DESK_E2E_KEY", "").strip()
if not K:
    sys.exit("defina DESK_E2E_KEY (a chave da conta e2e-test)")
H = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 guileo-desk-smoke", "Origin": "https://guileoai.com"}
ANA, BIA = "32e804f4-89e8-4fbf-ac8f-0fa8414bf1ae", "1e640236-c311-4a92-9d9f-ad7ca4424494"
FACIAL, LOC = "53f8cee2-ae98-422c-b97b-976c15dd2f88", "89252040-f344-4073-9437-b071620f9883"
resultados, criados = [], []

def post(path, body):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers=H)
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}
    except Exception as e:
        return 0, {"erro": str(e)[:80]}

def desk(b): return post("/api/desk", {"email": E, "key": K, **b})
def ok(nome, cond, info=""):
    resultados.append((bool(cond), nome, str(info)[:110]))
    print(("✅" if cond else "❌"), nome, str(info)[:110])

agora = dt.datetime.now(dt.timezone.utc)
iso = lambda x: x.isoformat().replace("+00:00", "Z")
t0 = time.time()

# porta
s, j = post("/api/desk", {"email": E, "key": "errada", "action": "agenda"}); ok("chave errada é recusada", s == 401, s)
s, j = desk({"action": "plano"}); ok("plano (legado = sem trava)", s == 200 and j.get("ok"), j)
if s == 401:
    sys.exit("\nA chave em DESK_E2E_KEY foi recusada (401). Use a chave de conexão da conta e2e-test@guileoai.com "
             "(client_credits.access_key no Supabase, ou Central → Configurações → código de conexão dessa conta). Nada foi testado.")
# agenda e horários
s, j = desk({"action": "agenda", "from": iso(agora), "to": iso(agora + dt.timedelta(days=1))}); ok("agenda", s == 200 and j.get("ok"), f"pros={len(j.get('pros', []))}")
s, j = desk({"action": "availability", "service_id": FACIAL, "pro_id": ANA, "location_id": LOC, "days": 14})
vagas = [x["start"] for x in j.get("slots", [])]; ok("horários livres", s == 200 and len(vagas) > 4, f"{len(vagas)} vagas")
# marcar → situação → nota → mover
s, j = desk({"action": "book", "pro_id": ANA, "location_id": LOC, "service_id": FACIAL, "name": "Smoke Desk", "contact": "+17185550991", "start": vagas[3]})
aid = j.get("appointment_id"); ok("marcar", bool(aid), aid); aid and criados.append(aid)
for st in ("confirmed", "arrived"):
    s, j = desk({"action": "status", "id": aid, "status": st}); ok(f"situação {st}", j.get("ok"), s)
s, j = desk({"action": "note", "id": aid, "note": "smoke"}); ok("nota", j.get("ok"), s)
s, j = desk({"action": "move", "id": aid, "start": vagas[4], "pro_id": ANA}); ok("mover", j.get("ok"), j.get("erro") or s)
# caixa
s, j = desk({"action": "checkout", "sale": {"request_id": f"smoke-{aid}", "appointment_id": aid, "lines": [{"kind": "service", "ref_id": FACIAL, "pro_id": ANA, "qty": 1}],
             "payments": [{"method": "cash", "amount_cents": 9000}], "customer_name": "Smoke Desk", "customer_contact": "+17185550991", "location_id": LOC}})
sid = j.get("sale_id"); ok("caixa: cobrar", j.get("ok") and sid, sid)
s, j = desk({"action": "sale", "id": sid}); ok("caixa: ler venda", j.get("ok"), s)
s, j = desk({"action": "void", "id": sid, "reason": "smoke"}); ok("caixa: estornar", j.get("ok"), s)
s, j = desk({"action": "day_close", "from": iso(agora - dt.timedelta(days=1)), "to": iso(agora + dt.timedelta(days=1))}); ok("fechamento do dia", j.get("ok"), s)
# clientes e relatórios
s, j = desk({"action": "client_search", "q": "Smoke"}); ok("busca de cliente", s == 200, s)
s, j = desk({"action": "reports", "from": iso(agora - dt.timedelta(days=30)), "to": iso(agora)})
ok("relatórios (+extra, unidades, opiniões)", j.get("ok") and j.get("extra_ok") and "unidades" in j and "opinioes" in j, s)
s, j = desk({"action": "absence_plan", "pro_id": ANA, "from": iso(agora), "to": iso(agora + dt.timedelta(days=1))}); ok("alguém faltou: plano", j.get("ok"), s)
# exportar tudo (desk_v8): os 4 arquivos vêm inteiros; tipo inválido é recusado; a agenda exportada tem o agendamento do smoke
for w in ("clients", "appointments", "sales", "balances"):
    s, j = desk({"action": "export", "what": w})
    ok(f"exportar {w}", s == 200 and j.get("ok") and len(j.get("rows", [])) == min(int(j.get("total") or 0), 5000), f"total={j.get('total')}")
    if w == "appointments": ok("exportar: agenda traz o agendamento do smoke", any(r.get("id") == aid for r in j.get("rows", [])), aid)
s, j = desk({"action": "export", "what": "tudo"}); ok("exportar: tipo inválido recusado", s == 400 and j.get("reason") == "invalid_export", s)
# casal / grupo (desk_v9): tudo ou nada — Ana e Bia lado a lado; repetir o pedido não duplica; choque numa pessoa = nada gravado
# A Bia não está ligada ao facial (sem vagas próprias): o motor marca mesmo assim, no horário livre da Ana.
casal_ini = vagas[6] if len(vagas) > 7 else None; ok("casal: horário livre da Ana para as duas", bool(casal_ini), casal_ini)
pedido = f"smoke-casal-{int(time.time())}"
itens = [{"pro_id": ANA, "service_id": FACIAL, "start": casal_ini, "name": "Smoke Casal A", "contact": "+17185550991"},
         {"pro_id": BIA, "service_id": FACIAL, "start": casal_ini, "name": "Smoke Casal B", "contact": "+17185550991"}]
s, j = desk({"action": "book_group", "location_id": LOC, "items": itens, "request_id": pedido, "confirm": False})
casal_ids = [x.get("appointment_id") for x in j.get("appointments", [])]; criados.extend(casal_ids)
ok("casal: marcar as 2 num pedido", s == 200 and j.get("ok") and j.get("rotulo") == "casal" and len(casal_ids) == 2 and all(casal_ids), j.get("reason") or j.get("grupo"))
s, j2 = desk({"action": "book_group", "location_id": LOC, "items": itens, "request_id": pedido, "confirm": False})
ok("casal: repetir o pedido não duplica", j2.get("ok") and j2.get("idempotent") and j2.get("grupo") == j.get("grupo"), j2.get("idempotent"))
s, ja = desk({"action": "agenda", "from": iso(agora), "to": iso(agora + dt.timedelta(days=15))})
do_casal = [a for a in ja.get("appointments", []) if a.get("id") in casal_ids]
ok("casal: agenda traz o vínculo 👥", len(do_casal) == 2 and all(a.get("grupo") == j.get("grupo") and a.get("grupo_total") == 2 for a in do_casal), [a.get("grupo_n") for a in do_casal])
antes = len([a for a in ja.get("appointments", []) if a.get("status") not in ("cancelled",)])
s, j3 = desk({"action": "book_group", "location_id": LOC, "items": [{**itens[0], "name": "Smoke Choque"}, {**itens[1], "start": vagas[-1], "name": "Smoke Fica Fora"}], "confirm": False})
s, ja2 = desk({"action": "agenda", "from": iso(agora), "to": iso(agora + dt.timedelta(days=15))})
depois = len([a for a in ja2.get("appointments", []) if a.get("status") not in ("cancelled",)])
ok("casal: choque na pessoa 1 → nada gravado", j3.get("ok") is False and j3.get("reason") == "slot_taken" and j3.get("index") == 1 and antes == depois, f"{j3.get('reason')} idx={j3.get('index')} {antes}=={depois}")
s, j4 = desk({"action": "book_group", "location_id": LOC, "items": itens[:1]}); ok("casal: 1 pessoa é recusada", s == 400 and j4.get("reason") == "group_size", s)
cancelados = [desk({"action": "status", "id": cid, "status": "cancelled"})[1].get("ok") for cid in casal_ids]
s, ja3 = desk({"action": "agenda", "from": iso(agora), "to": iso(agora + dt.timedelta(days=15))})
ok("casal: cancelar os 2 (um por vez, pelo motor)", all(cancelados) and all(a.get("status") == "cancelled" for a in ja3.get("appointments", []) if a.get("id") in casal_ids), cancelados)
# profissional × serviço (desk_v10): a Ana faz o facial em 45 min com 10/15 de preparo/limpeza e ganha 25,00 fixo; depois volta ao padrão
regra = {"service_id": FACIAL, "duration_min": 45, "prep_min": 10, "finish_min": 15, "pay_type": "flat", "pay_amount": 2500}
s, j = desk({"action": "staff_save", "pro": {"id": ANA, "service_rules": [regra]}}); ok("regra: salvar para a Ana", j.get("ok"), s)
s, ja = desk({"action": "agenda", "from": iso(agora), "to": iso(agora + dt.timedelta(days=1))})
minha = next((r for r in ja.get("pro_rules", []) if r.get("pro_id") == ANA and r.get("service_id") == FACIAL), None)
ok("regra: agenda traz pro_rules", bool(minha) and minha.get("duration_min") == 45 and minha.get("pay_type") == "flat", minha)
s, j = desk({"action": "availability", "service_id": FACIAL, "pro_id": ANA, "location_id": LOC, "days": 14})
ok("regra: vagas da Ana com duration_min 45", s == 200 and j.get("slots") and all(x.get("duration_min") == 45 for x in j["slots"]), f"{len(j.get('slots', []))} vagas")
s, j = desk({"action": "checkout", "sale": {"request_id": f"smoke-regra-{int(time.time())}", "lines": [{"kind": "service", "ref_id": FACIAL, "pro_id": ANA, "qty": 1}],
             "payments": [{"method": "cash", "amount_cents": 9000}], "customer_name": "Smoke Regra", "customer_contact": "+17185550991", "location_id": LOC}})
rsid = j.get("sale_id"); s, jv = desk({"action": "sale", "id": rsid})
ok("regra: caixa paga 25,00 fixo na linha da Ana", j.get("ok") and any(l.get("kind") == "service" and l.get("commission_cents") == 2500 for l in jv.get("lines", [])), [l.get("commission_cents") for l in jv.get("lines", [])])
desk({"action": "void", "id": rsid, "reason": "smoke"})
s, j = desk({"action": "staff_save", "pro": {"id": ANA, "service_rules": [{"service_id": FACIAL, "duration_min": None, "prep_min": None, "finish_min": None, "pay_type": None}]}})
s, ja = desk({"action": "agenda", "from": iso(agora), "to": iso(agora + dt.timedelta(days=1))})
ok("regra: voltar ao padrão (sem regra na agenda)", j.get("ok") and not any(r.get("pro_id") == ANA and r.get("service_id") == FACIAL for r in ja.get("pro_rules", [])), s)
# adicionais (desk_v11): um adicional de 10 min / 20,00; marcar com ele = +10 min; agenda marca o serviço e o agendamento; tirar = volta; caixa = 2 linhas
s, j = desk({"action": "service_save", "service": {"name": "Smoke Aroma", "duration_min": 10, "price_cents": 2000, "addon": True}}); AROMA = j.get("id")
ok("adicional: criar (10 min, 20,00)", j.get("ok") and AROMA, j)
s, j = desk({"action": "book", "pro_id": ANA, "location_id": LOC, "service_id": FACIAL, "name": "Smoke Addon", "contact": "+17185550991", "start": vagas[8], "addons": [AROMA], "confirm": False})
aid2 = j.get("appointment_id"); aid2 and criados.append(aid2)
ok("adicional: marcar com ele soma 10 min", j.get("ok") and j.get("duration_min") == 40 and len(j.get("addons", [])) == 1, f"dur={j.get('duration_min')}")
s, ja = desk({"action": "agenda", "from": iso(agora), "to": iso(agora + dt.timedelta(days=15))})
svc_a = next((x for x in ja.get("services", []) if x.get("id") == AROMA), {}); ap2 = next((a for a in ja.get("appointments", []) if a.get("id") == aid2), {})
ok("adicional: agenda marca o serviço e o agendamento", svc_a.get("addon") is True and len(ap2.get("addons", [])) == 1 and ap2["addons"][0].get("name") == "Smoke Aroma", ap2.get("addons"))
s, j = desk({"action": "checkout", "sale": {"request_id": f"smoke-addon-{int(time.time())}", "appointment_id": aid2, "lines": [{"kind": "service", "ref_id": FACIAL, "pro_id": ANA, "qty": 1}, {"kind": "service", "ref_id": AROMA, "pro_id": ANA, "qty": 1}],
             "payments": [{"method": "cash", "amount_cents": 11000}], "customer_name": "Smoke Addon", "customer_contact": "+17185550991", "location_id": LOC}})
asid = j.get("sale_id"); ok("adicional: caixa com 2 linhas = 110,00", j.get("ok") and j.get("total_cents") == 11000 and len(j.get("lines", [])) == 2, j.get("total_cents"))
desk({"action": "void", "id": asid, "reason": "smoke"})
s, j = desk({"action": "addons_set", "id": aid2, "addons": []}); ok("adicional: tirar volta a 30 min", j.get("ok") and j.get("duration_min") == 30, j.get("duration_min"))
desk({"action": "status", "id": aid2, "status": "cancelled"})
s, j = desk({"action": "service_save", "service": {"id": AROMA, "active": False}}); ok("adicional: desativar o de teste", j.get("ok"), s)
# falta automática / cancelou em cima da hora / concluir pelo caixa (desk_v12)
s, j = desk({"action": "regras_set", "auto_noshow_min": 15}); ok("regras: falta automática aos 15 min", j.get("ok") and j.get("auto_noshow_min") == 15, j)
atras = iso((agora - dt.timedelta(hours=2)).replace(second=0, microsecond=0))
s, j = desk({"action": "book", "pro_id": ANA, "location_id": LOC, "service_id": FACIAL, "name": "Smoke Falta", "contact": "+17185550991", "start": atras, "confirm": False})
fid = j.get("appointment_id"); fid and criados.append(fid)
s, ja = desk({"action": "agenda", "from": iso(agora - dt.timedelta(days=1)), "to": iso(agora + dt.timedelta(days=1))})
fa = next((a for a in ja.get("appointments", []) if a.get("id") == fid), {})
ok("falta automática: agenda varre e marca (sem chegada há 2 h)", fa.get("status") == "no_show" and fa.get("noshow_auto") is True and fa.get("noshow_auto_at"), fa.get("status"))
s, j = desk({"action": "noshow_undo", "id": fid}); ok("falta: chegou afinal", j.get("ok") and j.get("status") == "in_progress", j.get("reason") or s)
s, j = desk({"action": "noshow_undo", "id": fid}); ok("falta: desfazer de novo é recusado", j.get("reason") == "not_no_show", j.get("reason"))
s, j = desk({"action": "checkout", "sale": {"request_id": f"smoke-concluir-{int(time.time())}", "appointment_id": fid, "lines": [{"kind": "service", "ref_id": FACIAL, "pro_id": ANA, "qty": 1}],
             "payments": [{"method": "cash", "amount_cents": 9000}], "customer_name": "Smoke Falta", "customer_contact": "+17185550991", "location_id": LOC}})
csid = j.get("sale_id")
s, ja = desk({"action": "agenda", "from": iso(agora - dt.timedelta(days=1)), "to": iso(agora + dt.timedelta(days=1))})
ok("concluir pelo caixa: a venda fecha o agendamento", next((a.get("status") for a in ja.get("appointments", []) if a.get("id") == fid), None) == "completed", s)
desk({"action": "void", "id": csid, "reason": "smoke"})
s, j = desk({"action": "service_save", "service": {"id": FACIAL, "cancel_window_h": 24}})
perto = iso((agora + dt.timedelta(hours=2)).replace(second=0, microsecond=0))
s, j = desk({"action": "book", "pro_id": ANA, "location_id": LOC, "service_id": FACIAL, "name": "Smoke Em Cima", "contact": "+17185550991", "start": perto, "confirm": False})
lid = j.get("appointment_id"); lid and criados.append(lid)
desk({"action": "status", "id": lid, "status": "cancelled"})
s, ja = desk({"action": "agenda", "from": iso(agora - dt.timedelta(days=1)), "to": iso(agora + dt.timedelta(days=1))})
ok("cancelou em cima da hora: estado próprio na agenda", next((a.get("status") for a in ja.get("appointments", []) if a.get("id") == lid), None) == "late_cancelled", s)
desk({"action": "service_save", "service": {"id": FACIAL, "cancel_window_h": 0}})
s, j = desk({"action": "regras_set", "auto_noshow_min": 30}); ok("regras: volta ao padrão de 30 min", j.get("ok"), s)
# pacotes (desk_v13): validade, ativação na 1ª visita, serviço que debita 2 sessões
s, j = post("/api/packages", {"email": E, "token": K, "action": "upsert", "package": {"name": "Smoke Pacote", "sessions": 3, "price_cents": 10000, "valid_days": 30, "activation": "first_visit"}})
pkid = j.get("id"); ok("pacote: cadastrar com validade e ativação", j.get("ok") and pkid, s)
s, j = desk({"action": "catalog"})
pk = next((p for p in j.get("packages", []) if p.get("id") == pkid), {})
ok("pacote: catálogo traz validade e ativação", pk.get("valid_days") == 30 and pk.get("activation") == "first_visit", pk)
s, j = desk({"action": "checkout", "sale": {"request_id": f"smoke-pkg-venda-{int(time.time())}", "lines": [{"kind": "package", "ref_id": pkid, "qty": 1}],
             "payments": [{"method": "cash", "amount_cents": 10000}], "customer_name": "Smoke Pacote", "customer_contact": "+17185550991", "location_id": LOC}})
pvenda = j.get("sale_id"); ppid = next((l.get("purchase_id") for l in j.get("lines", []) if l.get("kind") == "package"), None)
ok("pacote: vender no caixa", j.get("ok") and ppid, j.get("reason"))
ficha_pkg = lambda: next((p for p in desk({"action": "client_card", "contact": "+17185550991"})[1].get("packages", []) if p.get("id") == ppid), {})
p0 = ficha_pkg(); ok("pacote: ainda não ativado (ativa na 1ª visita)", p0.get("status") == "not_activated" and not p0.get("expires_at"), p0.get("status"))
s, j = desk({"action": "service_save", "service": {"id": FACIAL, "pkg_sessions": 2}})
s, ja = desk({"action": "agenda", "from": iso(agora), "to": iso(agora + dt.timedelta(days=1))})
ok("serviço: debita 2 sessões (agenda devolve)", next((x.get("pkg_sessions") for x in ja.get("services", []) if x.get("id") == FACIAL), None) == 2, s)
resgate = lambda tag: desk({"action": "checkout", "sale": {"request_id": f"smoke-pkg-{tag}-{int(time.time())}", "lines": [{"kind": "service", "ref_id": FACIAL, "pro_id": ANA, "qty": 1}],
             "payments": [{"method": "package", "amount_cents": 9000, "ref": ppid, "service_id": FACIAL}], "customer_name": "Smoke Pacote", "customer_contact": "+17185550991", "location_id": LOC}})
s, j = resgate("1"); rvenda = j.get("sale_id")
p1 = ficha_pkg()
ok("pacote: 1ª visita ativa e debita 2", j.get("ok") and p1.get("left") == 1 and p1.get("status") == "active" and p1.get("expires_at"), (j.get("reason"), p1.get("left"), p1.get("status")))
s, j = resgate("2"); ok("pacote: falta sessão → package_short 1/2", j.get("reason") == "package_short" and j.get("detail") == "1/2", (j.get("reason"), j.get("detail")))
s, j = desk({"action": "package_edit", "id": ppid, "expires_at": iso(agora - dt.timedelta(days=1))}); ok("pacote: dona muda a validade", j.get("ok") and j.get("status") == "expired", j)
s, j = desk({"action": "service_save", "service": {"id": FACIAL, "pkg_sessions": 1}})
s, j = resgate("3"); ok("pacote: vencido → package_expired", j.get("reason") == "package_expired" and j.get("detail"), (j.get("reason"), j.get("detail")))
s, j = desk({"action": "package_edit", "id": ppid, "expires_at": None}); ok("pacote: tirar vencimento", j.get("ok") and j.get("status") == "active" and j.get("expires_at") is None, j)
s, j = desk({"action": "package_edit", "id": ppid, "expires_at": "amanhã"}); ok("pacote: data inválida recusada", s == 400 and j.get("reason") == "invalid_date", s)
s, j = desk({"action": "export", "what": "balances"})
ok("exportar: saldo do pacote com estado e datas", any(r.get("item") == "Smoke Pacote" and r.get("status") == "active" and "expires_at" in r for r in j.get("rows", [])), s)
s, j = rvenda and desk({"action": "void", "id": rvenda, "reason": "smoke"}) or (0, {})
ok("estorno: devolve as 2 sessões que o facial debitou", j.get("ok") and ficha_pkg().get("left") == 3, (j.get("reason"), ficha_pkg().get("left")))
s, j = pvenda and desk({"action": "void", "id": pvenda, "reason": "smoke"}) or (0, {})
ok("estorno: venda do pacote intacto é estornada", j.get("ok"), j.get("reason"))
post("/api/packages", {"email": E, "token": K, "action": "delete", "id": pkid})
# cupom no caixa (desk_v14): o servidor calcula, a venda gasta o uso, o estorno devolve; limpa no fim
suf = str(int(time.time()))[-5:]
cup = lambda code, **kw: post("/api/coupons", {"email": E, "token": K, "action": "upsert", "coupon": {"code": code, **kw}})[1].get("id")
P20, ONE, B1 = f"SMKP20{suf}", f"SMKONE{suf}", f"SMKB1{suf}"
cids = [x for x in (cup(P20, kind="pct", value=20, label="smoke 20%"), cup(ONE, kind="percent", value=10, max_redemptions=1), cup(B1, kind="bogo")) if x]
ok("cupom: criar 3 cupons de teste", len(cids) == 3, cids)
venda_cupom = lambda tag, code, pago, **kw: desk({"action": "checkout", "sale": {"request_id": f"smoke-cupom-{tag}-{suf}", "coupon_code": code, "lines": [{"kind": "service", "ref_id": FACIAL, "pro_id": ANA, "qty": 1}],
             "payments": [{"method": "cash", "amount_cents": pago}], "customer_name": "Smoke Cupom", "customer_contact": "+17185550991", "location_id": LOC, **kw}})
s, j = desk({"action": "coupon_check", "code": P20.lower(), "subtotal_cents": 9000}); ok("cupom: prévia 20% de 90,00 = 18,00", j.get("ok") and j.get("discount_cents") == 1800, j.get("discount_cents") or j.get("reason"))
s, j = desk({"action": "coupon_check", "code": "NAOEXISTE" + suf, "subtotal_cents": 9000}); ok("cupom: código que não existe", s == 200 and j.get("reason") == "coupon_not_found", j.get("reason"))
s, j = desk({"action": "coupon_check", "code": "", "subtotal_cents": 9000}); ok("cupom: código vazio = 400", s == 400, s)
s, j = venda_cupom("p20", P20, 7200); csale = j.get("sale_id")
ok("cupom: venda com 20% cobra 72,00", j.get("ok") and j.get("total_cents") == 7200 and (j.get("coupon") or {}).get("discount_cents") == 1800, j.get("reason") or j.get("total_cents"))
s, j = desk({"action": "sale", "id": csale or "x"}); ok("cupom: a venda guarda o cupom", (j.get("sale") or {}).get("coupon_code") == P20 and (j.get("sale") or {}).get("coupon_discount_cents") == 1800, (j.get("sale") or {}).get("coupon_code"))
s, j = desk({"action": "day_close", "from": iso(agora - dt.timedelta(hours=2)), "to": iso(agora + dt.timedelta(hours=2))})
ok("cupom: fechamento traz o cupom", any(c.get("code") == P20 and c.get("discount_cents") == 1800 for c in j.get("coupons", [])) and any(v.get("coupon") == P20 for v in j.get("list", [])), len(j.get("coupons", [])))
s, j = venda_cupom("one1", ONE, 8100); onesale = j.get("sale_id"); ok("cupom: limite 1 — 1ª venda passa", j.get("ok"), j.get("reason"))
s, j = venda_cupom("one2", ONE, 8100); ok("cupom: limite 1 — 2ª recusada (esgotado)", j.get("reason") == "coupon_exhausted" and not j.get("sale_id"), j.get("reason"))
s, j = onesale and desk({"action": "void", "id": onesale, "reason": "smoke"}) or (0, {})
s2, j2 = desk({"action": "coupon_check", "code": ONE, "subtotal_cents": 9000}); ok("cupom: estorno devolve o uso", j.get("ok") and j2.get("ok"), (j.get("reason"), j2.get("reason")))
s, j = venda_cupom("b1a", B1, 9000); ok("cupom: sem valor automático pede o desconto", j.get("reason") == "coupon_needs_amount", j.get("reason"))
s, j = venda_cupom("b1b", B1, 8000, discount_cents=1000); bsale = j.get("sale_id"); ok("cupom: sem valor automático conta o desconto digitado", j.get("ok") and (j.get("coupon") or {}).get("discount_cents") == 1000, j.get("reason"))
s, j = venda_cupom("p20x", P20, 0, discount_cents=9000); ok("cupom: desconto acima da base recusado", j.get("reason") == "discount_over_base" and str(j.get("detail")) == "9000", (j.get("reason"), j.get("detail")))
for v in (csale, bsale):
    if v: desk({"action": "void", "id": v, "reason": "smoke"})
s, j = post("/api/coupons", {"email": E, "token": K, "action": "list"})
ok("cupom: estornos zeram os usos", all(c.get("redeemed") == 0 for c in j.get("coupons", []) if c.get("id") in cids), [c.get("redeemed") for c in j.get("coupons", []) if c.get("id") in cids])
for c in cids: post("/api/coupons", {"email": E, "token": K, "action": "delete", "id": c})
# juntar fichas duplicadas (desk_v15): contatos FIXOS de teste (rodar de novo não acumula: as 2 fichas são as mesmas
# e a juntada termina desfeita)
JA, JB = "+17185550997", "smoke-juntar@example.com"
desk({"action": "client_save", "contact": JA, "data": {"name": "Smoke Juntar Dupla", "allergies": "Nut oils"}})
desk({"action": "client_save", "contact": JB, "data": {"name": "Smoke Juntar Dupla", "allergies": "Latex", "can_book_online": False}})
s, j = desk({"action": "merge_suggest"})
ok("juntar: sugestão acha as 2 fichas com o mesmo nome", j.get("ok") and any({m.get("contact_key") for m in g.get("members", [])} >= {"7185550997", JB} for g in j.get("groups", [])), j.get("total"))
s, j = desk({"action": "merge_preview", "keep": JA, "drop": JB})
ok("juntar: prévia soma alergias e fica bloqueada online", j.get("ok") and (j.get("result") or {}).get("allergies") == "Nut oils · Latex" and (j.get("result") or {}).get("can_book_online") is False, j.get("reason") or j.get("result"))
s, j = desk({"action": "merge", "keep": JA, "drop": JB}); mid = j.get("merge_id"); ok("juntar: juntar as 2 fichas", j.get("ok") and mid, j.get("reason"))
s, j = desk({"action": "client_card", "contact": JB}); ok("juntar: ficha aberta pelo e-mail cai na principal", j.get("contact_key") == "7185550997" and len(j.get("aliases", [])) == 1, j.get("contact_key"))
s, j = desk({"action": "client_search", "q": "Smoke Juntar"})
ok("juntar: busca mostra a pessoa uma vez", sum(1 for c in (j if isinstance(j, list) else []) if c.get("contact_key") in ("7185550997", JB)) == 1, len(j) if isinstance(j, list) else j)
s, j = desk({"action": "merge", "keep": JA, "drop": JB}); ok("juntar: de novo = já junta", j.get("reason") == "already_merged", j.get("reason"))
s, j = desk({"action": "merge_preview", "keep": JA, "drop": ""}); ok("juntar: sem a 2ª ficha = 400", s == 400, s)
s, j = desk({"action": "merge_undo", "id": mid or "x"}); ok("juntar: desfazer", j.get("ok"), j.get("reason"))
s, j = desk({"action": "client_card", "contact": JB}); ok("juntar: desfeito, a ficha do e-mail volta como era", j.get("contact_key") == JB and (j.get("profile") or {}).get("allergies") == "Latex", j.get("contact_key"))
s, j = desk({"action": "merge_undo", "id": mid or "x"}); ok("juntar: desfazer de novo = já desfeito", j.get("reason") == "already_undone", j.get("reason"))
# escolher a profissional no /agendar (desk_v16): "não marca pelo site" na Equipe + a página pública com escolha
s, j = desk({"action": "staff_save", "pro": {"id": BIA, "online": False}})
s, ja = desk({"action": "agenda", "from": iso(agora), "to": iso(agora + dt.timedelta(days=1))})
ok("site: Bia marcada 'não marca pelo site' (a agenda mostra)", next((p.get("online") for p in ja.get("pros", []) if p.get("id") == BIA), None) is False, s)
desk({"action": "staff_save", "pro": {"id": BIA, "title": next((p.get("title") for p in ja.get("pros", []) if p.get("id") == BIA), "") or ""}})
s, ja = desk({"action": "agenda", "from": iso(agora), "to": iso(agora + dt.timedelta(days=1))})
ok("site: salvar outra coisa não mexe na marca", next((p.get("online") for p in ja.get("pros", []) if p.get("id") == BIA), None) is False, s)
SLUG = os.environ.get("DESK_E2E_SLUG", "").strip()
if SLUG:
    vit = lambda b: post("/api/vitrine-agenda", {"slug": SLUG, **b})
    nome_facial = next((x.get("name") for x in ja.get("services", []) if x.get("id") == FACIAL), "")
    s, j = vit({"op": "menu"}); eq = j.get("equipe")
    ok("site: o menu traz a equipe e esconde a Bia", isinstance(eq, list) and any(p.get("id") == ANA for p in eq) and not any(p.get("id") == BIA for p in eq), s)
    ok("site: a equipe não traz contato", isinstance(eq, list) and all(set(p.keys()) <= {"id", "name", "title", "color", "services"} for p in eq), [sorted(p.keys()) for p in (eq or [])][:1])
    s, j = vit({"op": "horarios", "servico": nome_facial, "pro_id": ANA})
    ok("site: horários da Ana são só dela", j.get("ok") and j.get("escolha") is True and j.get("slots") and all(x.get("pro_id") == ANA for x in j.get("slots", [])), (s, len(j.get("slots", []))))
    vagas_ana = j.get("slots", [])
    s, j = vit({"op": "horarios", "servico": nome_facial})
    ok("site: sem preferência não oferece a Bia", j.get("ok") and not any(x.get("pro_id") == BIA for x in j.get("slots", [])), s)
    s, j = vit({"op": "horarios", "servico": nome_facial, "pro_id": BIA}); ok("site: escolher quem está fora do site = 404", s == 404 and j.get("error") == "pro_not_found", s)
    if vagas_ana:
        s, j = vit({"op": "marcar", "servico": nome_facial, "quando": vagas_ana[-1]["start"], "pro_id": ANA, "nome": "Smoke Site", "telefone": "+17185550993"})
        ok("site: marcar com a Ana marca com a Ana", j.get("ok") and j.get("id") and j.get("profissional"), (s, j.get("error"), j.get("profissional")))
        j.get("id") and criados.append(j.get("id"))
        s2, ja2 = desk({"action": "agenda", "from": iso(agora), "to": iso(agora + dt.timedelta(days=31))})
        ok("site: na agenda o agendamento é da Ana", next((a.get("pro_id") for a in ja2.get("appointments", []) if a.get("id") == j.get("id")), None) == ANA, j.get("id"))
else:
    print("⚠️  DESK_E2E_SLUG ausente: a página pública (/api/vitrine-agenda) NÃO foi testada nesta rodada")
desk({"action": "staff_save", "pro": {"id": BIA, "online": True}})
s, ja = desk({"action": "agenda", "from": iso(agora), "to": iso(agora + dt.timedelta(days=1))})
ok("site: Bia volta a marcar pelo site", next((p.get("online") for p in ja.get("pros", []) if p.get("id") == BIA), None) is True, s)
s, j = desk({"action": "deposit_link", "id": aid}); ok("sinal inerte sem Stripe", j.get("reason") in ("payments_not_connected", "no_deposit_configured") or j.get("ok"), j.get("reason"))
# agenda da profissional (código preso à Ana): só o dia dela, sem contato, só chegou/terminou/nota nos DELA
s, j = desk({"action": "acessos_criar", "nome": "Smoke Ana", "papel": "profissional", "pro_id": ANA}); pcod, pid = j.get("codigo", ""), j.get("id")
ok("profissional: criar código", s == 200 and pcod.startswith("bal_") and j.get("papel") == "profissional", j.get("papel"))
pro = lambda b: post("/api/desk", {"email": E, "key": pcod, **b})
s, j = pro({"action": "quem"}); ok("profissional: entra presa à Ana", j.get("papel") == "profissional" and j.get("pro_id") == ANA, j.get("papel"))
s, j = pro({"action": "agenda", "from": iso(agora - dt.timedelta(days=20)), "to": iso(agora + dt.timedelta(days=20))})
ap = j.get("appointments", [])
ok("profissional: só os agendamentos dela, sem contato", s == 200 and ap and all(a.get("pro_id") == ANA and not a.get("customer_contact") for a in ap) and [p["id"] for p in j.get("pros", [])] == [ANA], f"{len(ap)} agend.")
ok("profissional: só as regras (pagamento) dela", all(r.get("pro_id") == ANA for r in j.get("pro_rules", [])), len(j.get("pro_rules", [])))
s, j = pro({"action": "note", "id": aid, "note": "smoke profissional"}); ok("profissional: nota no agendamento dela", j.get("ok"), s)
s, j = pro({"action": "status", "id": aid, "status": "completed"}); ok("profissional: terminei no dela", j.get("ok"), s)
s, j = pro({"action": "status", "id": "00000000-0000-4000-8000-000000000000", "status": "arrived"}); ok("profissional: agendamento de outra recusado", s == 403, s)
s, j = pro({"action": "status", "id": aid, "status": "cancelled"}); ok("profissional: cancelar recusado", s == 403, s)
s, j = pro({"action": "book", "pro_id": ANA, "location_id": LOC, "service_id": FACIAL, "name": "x", "contact": "+17185550991", "start": vagas[5]}); ok("profissional: marcar recusado", s == 403, s)
s, j = pro({"action": "checkout", "sale": {}}); ok("profissional: caixa recusado", s == 403, s)
s, j = desk({"action": "acessos_revogar", "id": pid}); ok("profissional: revogar", j.get("ok"), j)
s, j = pro({"action": "agenda", "from": iso(agora), "to": iso(agora + dt.timedelta(days=1))}); ok("profissional: revogada não entra", s == 401, s)

# cancelar (libera a vaga e oferece à fila)
s, j = desk({"action": "status", "id": aid, "status": "cancelled"}); ok("cancelar + fila", j.get("ok") and "fila" in j, j.get("fila"))
# rotas vizinhas
s, j = post("/api/desk-pagamentos", {"email": E, "key": K, "action": "cartao_status", "contact": "+17185550991"}); ok("pagamentos: status do cartão", j.get("ok") and j.get("connected") is False, j)
s, j = post("/api/desk-pagamentos", {"email": E, "key": K, "action": "cancelamento_info", "id": aid}); ok("pagamentos: cancelamento registrado", j.get("ok") and j.get("cancelled_at"), j.get("cancelled_by"))
s, j = post("/api/reserva", {"t": E, "a": aid, "s": "falso", "action": "get"}); ok("link da cliente falso é recusado", s == 401, s)
s, j = post("/api/minha-conta", {"action": "pedir", "t": E, "email": "ninguem@exemplo.com", "lang": "pt"}); ok("minha conta: resposta neutra", j.get("status") == "if_client_sent", j)
s, j = post("/api/gui-voz", {"email": E, "key": K}); ok("assistente: link assinado", j.get("ok") and str(j.get("signed_url", "")).startswith("wss://"), s)
s, j = post("/api/resumo-manha", {"email": E, "key": K, "action": "get"}); ok("resumo da manhã: leitura", j.get("ok"), s)
s, j = post("/api/relatorio-mensal", {"email": E, "key": K, "action": "get"}); ok("relatório mensal: leitura", j.get("ok"), s)
s, j = post("/api/desk-checkout", {"plan": "nao-existe"}); ok("checkout: plano inválido recusado", s == 400, s)

# acesso da recepção (código próprio): o dia sim, dinheiro/ajustes não, revogar corta na hora
s, j = desk({"action": "acessos_criar", "nome": "Smoke Recepção"}); cod, acid = j.get("codigo", ""), j.get("id")
ok("recepção: criar código", s == 200 and cod.startswith("bal_") and acid, s)
rec = lambda b: post("/api/desk", {"email": E, "key": cod, **b})
s, j = rec({"action": "quem"}); ok("recepção: entra como recepcao", j.get("papel") == "recepcao", j)
s, j = rec({"action": "agenda", "from": iso(agora), "to": iso(agora + dt.timedelta(days=1))}); ok("recepção: lê a agenda", s == 200 and j.get("ok"), s)
s, j = rec({"action": "reports", "from": iso(agora - dt.timedelta(days=7)), "to": iso(agora)}); ok("recepção: relatórios recusados", s == 403 and j.get("reason") == "role_forbidden", s)
s, j = rec({"action": "void", "id": sid or "x", "reason": "x"}); ok("recepção: estorno recusado", s == 403, s)
s, j = rec({"action": "coupon_check", "code": "NAOEXISTE", "subtotal_cents": 1000}); ok("recepção: confere cupom no caixa", s == 200 and j.get("reason") == "coupon_not_found", s)
s, j = rec({"action": "merge_suggest"}); ok("recepção: juntar fichas recusado", s == 403 and j.get("reason") == "role_forbidden", s)
s, j = rec({"action": "acessos_criar", "nome": "x"}); ok("recepção: não cria acesso", s == 403, s)
s, j = rec({"action": "export", "what": "clients"}); ok("recepção: exportar a base recusado", s == 403 and j.get("reason") == "role_forbidden", s)
s, j = rec({"action": "package_edit", "id": ppid or "x", "expires_at": None}); ok("recepção: mudar validade de pacote recusado", s == 403 and j.get("reason") == "role_forbidden", s)
s, j = post("/api/desk-pagamentos", {"email": E, "key": cod, "action": "cartao_status", "contact": "+17185550991"}); ok("recepção: Stripe do negócio fechado", s == 401, s)
s, j = post("/api/relatorio-mensal", {"email": E, "key": cod, "action": "get"}); ok("recepção: avisos da dona fechados", s == 401, s)
s, j = desk({"action": "acessos_revogar", "id": acid}); ok("recepção: revogar", j.get("ok"), j)
s, j = rec({"action": "agenda", "from": iso(agora), "to": iso(agora + dt.timedelta(days=1))}); ok("recepção: revogado não entra", s == 401, s)

# limpeza: TODO agendamento criado termina cancelado (o "Smoke Falta" de 2 h atrás ficava ocupando a Ana e a
# rodada seguinte, dentro de 1 h, batia nele com slot_taken — 2026-10-22)
for a in criados: desk({"action": "status", "id": a, "status": "cancelled"})

falhas = [r for r in resultados if not r[0]]
print(f"\n{len(resultados) - len(falhas)}/{len(resultados)} ok em {round(time.time() - t0, 1)}s · criados (e cancelados): {len(criados)}")
sys.exit(1 if falhas else 0)
