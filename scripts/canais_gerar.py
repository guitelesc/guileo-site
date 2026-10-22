#!/usr/bin/env python3
# Gera CANAIS.md (repo, para desenvolvedores) e a página visual a partir de scripts/canais_dados.py.
# Uso: python3 scripts/canais_gerar.py [caminho_da_pagina.html]
import html, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from canais_dados import ATUALIZADO, BASE, CANAIS, INTEGRACOES

ROTULO = {"live": "No ar", "pronto": "Pronto · depende do cliente", "espera": "Aguarda terceiro", "plan": "Planejado", "parado": "Parado agora"}
EMOJI = {"live": "🟢", "pronto": "🟡", "espera": "🔵", "plan": "⚪", "parado": "🔴"}
QUEM = ["Luis", "Natura", "Guileo", "Terceiro"]
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def todos(): return CANAIS + INTEGRACOES

# ── CANAIS.md ──────────────────────────────────────────────────────────────────────────────────
md = [f"# CANAIS — o mapa por canal (atualizado {ATUALIZADO})", "",
      "> Fonte única: `scripts/canais_dados.py`. Mudou algo? Edite lá e rode `python3 scripts/canais_gerar.py` — este arquivo e a página visual saem iguais.",
      "> Estados: " + " · ".join(f"{EMOJI[k]} {v}" for k, v in ROTULO.items()) + ". Quem: Luis · Natura · Guileo (dev) · Terceiro.", "",
      "## O que vale para todos os canais", ""]
for k, v in BASE: md.append(f"- **{k}:** {v}")
md += ["", "## Quem precisa agir", ""]
for q in QUEM:
    itens = [(c["nome"], t) for c in todos() for (t, w, ok) in c["checklist"] if w == q and not ok]
    if not itens: continue
    md.append(f"### {q} ({len(itens)})")
    for n, t in itens: md.append(f"- [ ] **{n}:** {t}")
    md.append("")
for grupo, lista in (("Canais", CANAIS), ("Integrações", INTEGRACOES)):
    md += [f"## {grupo}", ""]
    for c in lista:
        md += [f"### {EMOJI[c['estado']]} {c['nome']} — {ROTULO[c['estado']]}", "", c["resumo"], ""]
        if c.get("contrato"): md += [f"**No contrato:** {c['contrato']}", ""]
        md += ["**Rotas**", ""] + [f"- `{a}` — {b}" for a, b in c["rotas"]] + [""]
        if c.get("automacoes"):
            md += ["**Automações** (como funciona · onde mora · como provar)", ""]
            for a in c["automacoes"]:
                t, st = a[0], a[1]
                md.append(f"- {EMOJI[st]} **{t}** ({ROTULO[st]})")
                if len(a) > 2:
                    md += [f"  - Como funciona: {a[2]}", f"  - Onde mora: `{a[3]}`", f"  - Como provar: {a[4]}"]
            md.append("")
        md += ["**Checklist**", ""] + [f"- [{'x' if ok else ' '}] {t} — _{w}_" for t, w, ok in c["checklist"]] + [""]
open(os.path.join(RAIZ, "CANAIS.md"), "w").write("\n".join(md))

# ── página visual ──────────────────────────────────────────────────────────────────────────────
e = html.escape
def pill(s): return f'<span class="pill s-{s}"><i></i>{e(ROTULO[s])}</span>'
def bloco(c):
    rotas = "".join(f'<li><code>{e(a)}</code><span>{e(b)}</span></li>' for a, b in c["rotas"])
    def auto(a):
        t, st = a[0], a[1]
        if len(a) == 2: return f'<li class="auto">{pill(st)}<b>{e(t)}</b></li>'
        return (f'<li class="auto"><details><summary>{pill(st)}<b>{e(t)}</b></summary>'
                f'<dl><dt>Como funciona</dt><dd>{e(a[2])}</dd><dt>Onde mora</dt><dd><code>{e(a[3])}</code></dd>'
                f'<dt>Como provar</dt><dd>{e(a[4])}</dd></dl></details></li>')
    autos = "".join(auto(a) for a in c.get("automacoes", []))
    check = "".join(f'<li data-quem="{e(w)}"><span class="box{" ok" if ok else ""}" aria-hidden="true"></span><span>{e(t)}</span><b class="quem q-{e(w.lower())}">{e(w)}</b></li>' for t, w, ok in c["checklist"])
    contrato = f'<p class="contrato"><b>No contrato</b> {e(c["contrato"])}</p>' if c.get("contrato") else ""
    col_auto = f'<div class="autosbox"><h4>Automações · toque para ver como funciona, onde mora e como provar</h4><ul class="autos">{autos}</ul></div>' if autos else ""
    return f'''<section class="canal" id="{e(c["id"])}">
  <header class="ch"><h3>{e(c["nome"])}</h3>{pill(c["estado"])}</header>
  <p class="resumo">{e(c["resumo"])}</p>{contrato}
  {col_auto}
  <div class="cols"><div class="col"><h4>Rotas no código</h4><ul class="rotas">{rotas}</ul></div><div class="col"><h4>Checklist</h4><ul class="check">{check}</ul></div></div>
</section>'''

contagem = {s: sum(1 for c in todos() if c["estado"] == s) for s in ROTULO}
por_quem = {q: sum(1 for c in todos() for (_, w, ok) in c["checklist"] if w == q and not ok) for q in QUEM}
nav = "".join(f'<a href="#{e(c["id"])}"><i class="dot s-{c["estado"]}"></i>{e(c["nome"])}</a>' for c in todos())
base = "".join(f'<div><dt>{e(k)}</dt><dd>{e(v)}</dd></div>' for k, v in BASE)
resumo = "".join(f'<li><i class="dot s-{s}"></i><b class="num">{n}</b> {e(ROTULO[s])}</li>' for s, n in contagem.items() if n)
filtros = '<button type="button" class="f on" data-f="todos" aria-pressed="true">Todos</button>' + "".join(f'<button type="button" class="f" data-f="{q}" aria-pressed="false">{q} <span class="num">{por_quem[q]}</span></button>' for q in QUEM if por_quem[q])

pagina = f'''<title>Canais da Natura</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: uma régua por canal — resumo e contrato em cima, três colunas (rotas · automações · checklist) embaixo; filtro por quem age. */
:root{{
  --bg:#F5F3EF;--panel:#FFFFFF;--ink:#1A1916;--ink2:#4D4A43;--muted:#77726A;--line:#E2DED5;--accent:#B5651D;
  --live:#2E8A5B;--pronto:#A9781C;--espera:#3F6E9E;--plan:#8A857C;--parado:#B4442E;
  --display:"Bricolage Grotesque","Avenir Next","Segoe UI",sans-serif;--body:"IBM Plex Sans","Helvetica Neue",Arial,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
  color-scheme:light;
}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--bg:#161512;--panel:#1F1D19;--ink:#F1EDE5;--ink2:#C9C3B8;--muted:#9C968B;--line:#34312B;--accent:#E0975A;--live:#55D89E;--pronto:#F2C66D;--espera:#86A8FF;--plan:#A39D92;--parado:#FF7B6B;color-scheme:dark}}}}
:root[data-theme="dark"]{{--bg:#161512;--panel:#1F1D19;--ink:#F1EDE5;--ink2:#C9C3B8;--muted:#9C968B;--line:#34312B;--accent:#E0975A;--live:#55D89E;--pronto:#F2C66D;--espera:#86A8FF;--plan:#A39D92;--parado:#FF7B6B;color-scheme:dark}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 var(--body);-webkit-font-smoothing:antialiased}}
.wrap{{max-width:1180px;margin:0 auto;padding-inline:16px;padding-block:28px 56px}}
h1,h2,h3{{font-family:var(--display);letter-spacing:-.015em;text-wrap:balance;margin:0}}
h1{{font-size:clamp(28px,4.4vw,44px);font-weight:700;line-height:1.05}}
h2{{font-size:13px;font-family:var(--body);font-weight:600;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:34px 0 12px}}
h3{{font-size:22px;font-weight:700}}
h4{{margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}}
.sub{{color:var(--ink2);max-width:68ch;margin:10px 0 0}}
.num{{font-variant-numeric:tabular-nums}}
.top{{display:flex;flex-wrap:wrap;gap:18px 28px;align-items:flex-end;justify-content:space-between}}
.estado{{display:flex;flex-wrap:wrap;gap:6px 16px;list-style:none;margin:16px 0 0;padding:0;font-size:13.5px;color:var(--ink2)}}
.estado li{{display:flex;align-items:center;gap:7px}}
.dot{{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none}}
.s-live{{--c:var(--live)}}.s-pronto{{--c:var(--pronto)}}.s-espera{{--c:var(--espera)}}.s-plan{{--c:var(--plan)}}.s-parado{{--c:var(--parado)}}
.dot{{background:var(--c)}}
.pill{{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;border:1px solid color-mix(in srgb,var(--c) 45%,transparent);color:var(--c);background:color-mix(in srgb,var(--c) 10%,transparent);white-space:nowrap}}
.pill i{{width:7px;height:7px;border-radius:50%;background:var(--c)}}
.base{{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:0}}
.base div{{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px}}
.base dt{{font-weight:600;font-size:13px}}.base dd{{margin:4px 0 0;color:var(--ink2);font-size:13.5px}}
.nav{{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(6px);border-block:1px solid var(--line);margin:22px -16px 0;padding:10px 16px;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}}
.nav a{{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;font-size:13px;text-decoration:none;color:var(--ink2);padding:6px 11px;border:1px solid var(--line);border-radius:999px;background:var(--panel)}}
.nav a:hover{{border-color:var(--ink2)}}
.filtros{{display:flex;flex-wrap:wrap;gap:8px;margin:0}}
.f{{font:inherit;font-size:13px;color:var(--ink2);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:6px 12px;cursor:pointer}}
.f.on{{background:var(--ink);color:var(--bg);border-color:var(--ink)}}
.f .num{{opacity:.7;margin-left:3px}}
.canal{{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px 18px 16px;margin-top:14px;scroll-margin-top:70px}}
.ch{{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;justify-content:space-between}}
.resumo{{margin:8px 0 0;max-width:80ch}}
.contrato{{margin:8px 0 0;font-size:13.5px;color:var(--ink2);max-width:90ch}}
.contrato b{{font-weight:600;color:var(--accent);margin-right:6px}}
.cols{{display:grid;grid-template-columns:1.2fr 1fr;gap:18px;margin-top:16px;border-top:1px solid var(--line);padding-top:14px}}
.col{{min-width:0}}
ul{{list-style:none;margin:0;padding:0;display:grid;gap:9px}}
.rotas li{{display:grid;gap:2px}}
code{{font-family:var(--mono);font-size:12px;color:var(--ink);background:color-mix(in srgb,var(--line) 55%,transparent);border-radius:5px;padding:1px 6px;word-break:break-word;justify-self:start}}
.rotas span{{font-size:13px;color:var(--ink2)}}
.autosbox{{margin-top:16px;border-top:1px solid var(--line);padding-top:14px}}
.autos{{gap:8px}}
.auto{{border:1px solid var(--line);border-radius:12px;background:color-mix(in srgb,var(--bg) 55%,var(--panel))}}
.auto > .pill,.auto > b{{margin:10px 12px}}
.auto summary{{list-style:none;cursor:pointer;display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:10px 12px;font-size:14px}}
.auto summary::-webkit-details-marker{{display:none}}
.auto summary::after{{content:"+";margin-left:auto;color:var(--muted);font-family:var(--mono)}}
.auto details[open] summary::after{{content:"−"}}
.auto .pill{{font-size:11px;padding:2px 8px}}
.auto dl{{margin:0;padding:0 12px 12px;display:grid;grid-template-columns:120px 1fr;gap:6px 14px;font-size:13.5px}}
.auto dt{{color:var(--muted);font-size:12px;font-weight:600;padding-top:2px}}
.auto dd{{margin:0;color:var(--ink2)}}
@media (max-width:640px){{.auto dl{{grid-template-columns:1fr}}.auto dt{{padding-top:6px}}}}
.check li{{display:grid;grid-template-columns:16px 1fr auto;gap:8px;align-items:start;font-size:13.5px}}
.box{{width:14px;height:14px;border:1.5px solid var(--line);border-radius:4px;margin-top:3px}}
.box.ok{{background:var(--live);border-color:var(--live)}}
.quem{{font-size:11px;font-weight:600;padding:1px 8px;border-radius:999px;border:1px solid var(--line);white-space:nowrap;color:var(--ink2)}}
.q-luis{{color:var(--parado);border-color:color-mix(in srgb,var(--parado) 40%,transparent)}}
.q-natura{{color:var(--pronto);border-color:color-mix(in srgb,var(--pronto) 45%,transparent)}}
.q-guileo{{color:var(--live);border-color:color-mix(in srgb,var(--live) 40%,transparent)}}
.q-terceiro{{color:var(--espera);border-color:color-mix(in srgb,var(--espera) 40%,transparent)}}
.esconde{{opacity:.28}}
.pe{{margin-top:34px;font-size:12.5px;color:var(--muted)}}
:focus-visible{{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}}
@media (max-width:900px){{.cols{{grid-template-columns:1fr}}}}
</style>
<div class="wrap">
  <div class="top">
    <div><h1>Canais da Natura</h1><p class="sub">Cada canal do contrato: as automações (como funcionam, onde moram no código, como provar), as rotas e o que falta, com quem faz cada passo. Atualizado em {e(ATUALIZADO)}.</p>
    <ul class="estado">{resumo}</ul></div>
  </div>
  <h2>O que vale para todos</h2>
  <dl class="base">{base}</dl>
  <h2>Quem precisa agir</h2>
  <div class="filtros" role="group" aria-label="Filtrar o checklist por quem age">{filtros}</div>
  <nav class="nav" aria-label="Canais">{nav}</nav>
  <h2>Canais</h2>
  {"".join(bloco(c) for c in CANAIS)}
  <h2>Integrações</h2>
  {"".join(bloco(c) for c in INTEGRACOES)}
  <p class="pe">Fonte única no repositório: <code>scripts/canais_dados.py</code> → <code>CANAIS.md</code> e esta página.</p>
</div>
<script>
(function(){{
  var bs=[].slice.call(document.querySelectorAll('.f'));
  function aplica(f){{
    bs.forEach(function(b){{var on=b.getAttribute('data-f')===f;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');}});
    [].slice.call(document.querySelectorAll('.check li')).forEach(function(li){{li.classList.toggle('esconde',f!=='todos'&&li.getAttribute('data-quem')!==f);}});
    try{{localStorage.setItem('canais-f',f);}}catch(e){{}}
  }}
  bs.forEach(function(b){{b.addEventListener('click',function(){{aplica(b.getAttribute('data-f'));}});}});
  try{{var s=localStorage.getItem('canais-f');if(s&&document.querySelector('.f[data-f="'+s+'"]'))aplica(s);}}catch(e){{}}
}})();
</script>
'''
destino = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "canais.html")
open(destino, "w").write(pagina)
print("CANAIS.md e", destino, "gerados ·", {k: v for k, v in contagem.items() if v}, "· pendências:", por_quem)
