#!/usr/bin/env python3
# Builds the ENGLISH "Natura Channels" handoff page (Natura × Guileo theme) from scripts/canais_dados_en.py.
# Usage: python3 scripts/canais_pagina_en.py <out.html> [icons_dir]
# icons_dir = folder with simple-icons SVGs (<slug>.svg). They are inlined: the artifact CSP blocks external images.
import base64, html, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from canais_dados_en import UPDATED, BASE, STACK, CHANNELS, INTEGRATIONS, RULES, TIMELINE, STEPS

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "canais-en.html")
ICONS = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(OUT), "icons")
e = html.escape

LABEL = {"live": "Live", "ready": "Ready · waiting on client", "waiting": "Waiting on third party", "planned": "Planned", "down": "Down right now"}
OWNERS = ["Scale Pods", "Luis", "Natura", "Guileo", "Third party"]
def okey(o): return re.sub(r"[^a-z]", "", o.lower())

def b64(p): return base64.b64encode(open(p, "rb").read()).decode()
G = b64(os.path.join(RAIZ, "src/assets/guileo-mark.png"))
NL = b64(os.path.join(RAIZ, "src/assets/natura-logo.png"))

_paths = {}
def logo(slug, color, size=18):
    if slug not in _paths:
        svg = open(os.path.join(ICONS, f"{slug}.svg")).read()
        _paths[slug] = re.search(r' d="([^"]+)"', svg).group(1)
    col = "var(--ink)" if color == "ink" else color
    return (f'<svg class="lg" width="{size}" height="{size}" viewBox="0 0 24 24" aria-hidden="true" style="color:{col}">'
            f'<path fill="currentColor" d="{_paths[slug]}"/></svg>')

def pill(s): return f'<span class="pill st-{s}"><i></i>{e(LABEL[s])}</span>'

def owners_of(step_owner): return [o for o in OWNERS if o.lower() in step_owner.lower() or (o == "Guileo" and "origem" in step_owner.lower())]

def chip(o): return f'<b class="who w-{okey(o)}">{e(o)}</b>'

def block(c):
    steps = STEPS.get(c["id"], [])
    st_html = ""
    for i, (txt, own, done) in enumerate(steps, 1):
        tags = " ".join(okey(o) for o in owners_of(own))
        st_html += (f'<li class="step" data-own="{tags}" data-q="{e((txt + " " + own + " " + done).lower())}">'
                    f'<span class="n num">{i:02d}</span><div class="sb"><p>{e(txt)}</p>'
                    f'<p class="dw"><span>Done when</span>{e(done)}</p></div>'
                    f'<div class="owners">{"".join(chip(o) for o in owners_of(own)) or chip(own)}</div></li>')
    autos = ""
    for (em, name, s, how, where, proof) in c.get("automations", []):
        autos += (f'<li class="auto" data-q="{e((name + " " + how + " " + where).lower())}"><details><summary><span class="em" aria-hidden="true">{em}</span>'
                  f'<b>{e(name)}</b>{pill(s)}</summary><dl>'
                  f'<dt>⚙️ How it works</dt><dd>{e(how)}</dd>'
                  f'<dt>📍 Where it lives</dt><dd><code>{e(where)}</code></dd>'
                  f'<dt>🧾 How to prove it</dt><dd>{e(proof)}</dd></dl></details></li>')
    routes = "".join(f'<li><button type="button" class="cp" data-cp="{e(a)}" title="Copy path"><code>{e(a)}</code></button><span>{e(b)}</span></li>' for a, b in c["routes"])
    logos = "".join(logo(s, col, 22) for s, col in c.get("logos", []))
    contract = f'<p class="contract"><span>📜 In the contract</span>{e(c["contract"])}</p>' if c.get("contract") else ""
    auto_sec = (f'<section class="sub"><h4>🤖 Automations <small>tap one to see how it works, where it lives and how to prove it</small></h4>'
                f'<ul class="autos">{autos}</ul></section>') if autos else ""
    n_auto_live = sum(1 for a in c.get("automations", []) if a[2] == "live")
    return f'''<article class="ch" id="{e(c["id"])}" data-q="{e((c["name"] + " " + c["summary"]).lower())}">
  <header class="chh"><div class="cht"><span class="bigem" aria-hidden="true">{c["emoji"]}</span><div><h3>{e(c["name"])}</h3><div class="logos">{logos}</div></div></div>{pill(c["status"])}</header>
  <p class="sum">{e(c["summary"])}</p>{contract}
  <div class="meter"><span><b class="num">{len(steps)}</b> build steps</span><span><b class="num">{len(c.get("automations", []))}</b> automations · <b class="num">{n_auto_live}</b> live</span><span><b class="num">{len(c["routes"])}</b> code routes</span></div>
  <section class="sub"><h4>🛠️ Build steps <small>in order · one owner each · done only with the proof</small></h4><ol class="steps">{st_html}</ol></section>
  {auto_sec}
  <section class="sub"><h4>🗂️ Code routes <small>tap a path to copy it</small></h4><ul class="routes">{routes}</ul></section>
</article>'''

ALL = CHANNELS + INTEGRATIONS
n_steps = sum(len(v) for v in STEPS.values())
n_auto = sum(len(c.get("automations", [])) for c in ALL)
n_live = sum(1 for c in ALL for a in c.get("automations", []) if a[2] == "live")
by_owner = {o: sum(1 for v in STEPS.values() for s in v if o in owners_of(s[1])) for o in OWNERS}

nav = "".join(f'<a href="#{e(c["id"])}"><i class="dot st-{c["status"]}"></i><span aria-hidden="true">{c["emoji"]}</span>{e(c["name"])}</a>' for c in ALL)
stack = "".join(f'<li>{logo(s, col, 20)}<b>{e(n)}</b><span>{e(w)}</span></li>' for n, s, col, w in STACK)
rules = "".join(f'<li><span class="em" aria-hidden="true">{em}</span><div><b>{e(t)}</b><p>{e(d)}</p></div></li>' for em, t, d in RULES)
base = "".join(f'<li><span class="em" aria-hidden="true">{em}</span><div><b>{e(t)}</b><p>{e(d)}</p></div></li>' for em, t, d in BASE)
MESES = {"Oct": 10}
tl = "".join(f'<li data-d="2026-{MESES[d.split()[0]]:02d}-{int(d.split()[1]):02d}"><span class="td num">{e(d)}</span><span class="tx">{e(w)}</span><span class="tw">{"".join(chip(o) for o in owners_of(o_)) or chip(o_)}</span></li>' for d, w, o_ in TIMELINE)
filters = '<button type="button" class="f on" data-f="all" aria-pressed="true">Everyone</button>' + "".join(
    f'<button type="button" class="f" data-f="{okey(o)}" aria-pressed="false">{e(o)} <span class="num">{by_owner[o]}</span></button>' for o in OWNERS if by_owner[o])

page = f'''<title>Natura Channels</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
/* Layout: Natura × Guileo deck look — dark gold-ruled cover, then one card per channel: build steps (ordered, owner, proof) → automations → code routes. */
:root{{
  --paper:#FAF7F0;--panel:#FFFFFF;--panel2:#F3EEE2;--ink:#161512;--ink2:#4A463E;--muted:#6F695D;--line:#E4DDCC;
  --gold:#8E6D2C;--gold-hi:#D9B26A;--green:#2F8A60;
  --cover:#161512;--cover2:#1F1D19;--cover-line:#34312B;--cover-fg:#F3EFE7;--cover-muted:#A39D92;
  --s-live:#2F8A60;--s-ready:#9A6F12;--s-wait:#3C64B1;--s-plan:#7A7468;--s-down:#B4442E;
  --o-sp:#7A3FB8;--o-luis:#B4442E;--o-natura:#9A6F12;--o-guileo:#2F8A60;--o-third:#3C64B1;
  --sans:"Inter","Helvetica Neue",Helvetica,Arial,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;
  color-scheme:light;
}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--paper:#12110F;--panel:#1C1A17;--panel2:#24211D;--ink:#F3EFE7;--ink2:#CFC8BB;--muted:#9C968B;--line:#34312B;--gold:#D9B26A;--s-live:#55D89E;--s-ready:#F2C66D;--s-wait:#86A8FF;--s-plan:#A39D92;--s-down:#FF7B6B;--o-sp:#C29BFF;--o-luis:#FF7B6B;--o-natura:#F2C66D;--o-guileo:#55D89E;--o-third:#86A8FF;--cover:#0B0A09;--cover2:#171512;color-scheme:dark}}}}
:root[data-theme="dark"]{{--paper:#12110F;--panel:#1C1A17;--panel2:#24211D;--ink:#F3EFE7;--ink2:#CFC8BB;--muted:#9C968B;--line:#34312B;--gold:#D9B26A;--s-live:#55D89E;--s-ready:#F2C66D;--s-wait:#86A8FF;--s-plan:#A39D92;--s-down:#FF7B6B;--o-sp:#C29BFF;--o-luis:#FF7B6B;--o-natura:#F2C66D;--o-guileo:#55D89E;--o-third:#86A8FF;--cover:#0B0A09;--cover2:#171512;color-scheme:dark}}
*{{box-sizing:border-box}}
html{{scroll-behavior:smooth}}
@media (prefers-reduced-motion:reduce){{html{{scroll-behavior:auto}}*{{transition:none!important;animation:none!important}}}}
body{{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 var(--sans);-webkit-font-smoothing:antialiased}}
.wrap{{max-width:1160px;margin:0 auto;padding-inline:16px}}
.num{{font-variant-numeric:tabular-nums}}
code{{font-family:var(--mono);font-size:12px}}
:focus-visible{{outline:2px solid var(--gold);outline-offset:2px;border-radius:6px}}
h1,h2,h3{{text-wrap:balance;margin:0}}
/* cover */
.cover{{background:radial-gradient(900px 380px at 92% -20%,rgba(217,178,106,.18),transparent 60%),var(--cover);color:var(--cover-fg);border-top:5px solid var(--gold-hi)}}
.cover .wrap{{padding-block:22px 30px}}
.brands{{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-bottom:20px;border-bottom:1px solid var(--cover-line)}}
.brand{{display:flex;align-items:center;gap:10px}}
.brand img{{width:34px;height:34px;border-radius:50%;display:block}}
.brand b{{display:block;font-size:15px;font-weight:800;letter-spacing:-.01em;line-height:1.1}}
.brand span{{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--cover-muted);margin-top:2px}}
.nlogo{{height:24px;width:auto;max-width:40vw;display:block;filter:brightness(0) invert(1)}}
.eye{{font-family:var(--mono);font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-hi);margin-top:26px}}
h1{{margin-top:10px;font-size:clamp(32px,5.6vw,56px);font-weight:900;letter-spacing:-.04em;line-height:.98}}
h1 em{{font-style:normal;color:#4FAE80}}
.lede{{margin:14px 0 0;max-width:72ch;color:var(--cover-muted);font-size:16.5px}}
.lede b{{color:var(--cover-fg)}}
.kpis{{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin-top:24px;border-top:1px solid var(--cover-line);padding-top:18px}}
.kpi b{{display:block;font-size:clamp(26px,3.6vw,38px);font-weight:800;letter-spacing:-.03em;line-height:1}}
.kpi span{{display:block;margin-top:6px;font-size:12.5px;color:var(--cover-muted)}}
.kpi.gold b{{color:var(--gold-hi)}}
.stack{{list-style:none;margin:22px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px}}
.stack li{{display:flex;align-items:center;gap:8px;background:var(--cover2);border:1px solid var(--cover-line);border-radius:999px;padding:6px 12px 6px 9px;font-size:12.5px}}
.stack li span{{color:var(--cover-muted)}}
.stack .lg{{color:var(--cover-fg)}}
.stack li .lg[style*="var(--ink)"]{{color:var(--cover-fg)!important}}
/* nav */
.nav{{position:sticky;top:env(safe-area-inset-top,0px);z-index:9;background:color-mix(in srgb,var(--paper) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}}
.nav .wrap{{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-block:10px}}
.nav a{{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;font-size:13px;text-decoration:none;color:var(--ink2);padding:6px 11px;border:1px solid var(--line);border-radius:999px;background:var(--panel);transition:border-color .15s}}
.nav a:hover,.nav a.here{{border-color:var(--gold);color:var(--ink)}}
.dot{{width:8px;height:8px;border-radius:50%;background:var(--c);flex:none}}
.st-live{{--c:var(--s-live)}}.st-ready{{--c:var(--s-ready)}}.st-waiting{{--c:var(--s-wait)}}.st-planned{{--c:var(--s-plan)}}.st-down{{--c:var(--s-down)}}
.pill{{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;border:1px solid color-mix(in srgb,var(--c) 45%,transparent);color:var(--c);background:color-mix(in srgb,var(--c) 10%,transparent);white-space:nowrap}}
.pill i{{width:7px;height:7px;border-radius:50%;background:var(--c)}}
.st-down .pill i,.pill.st-down i{{animation:pulse 1.6s ease-in-out infinite}}
@keyframes pulse{{50%{{opacity:.25}}}}
/* sections */
main .wrap{{padding-block:8px 60px}}
h2{{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.16em;color:var(--gold);margin:40px 0 14px;display:flex;align-items:center;gap:10px}}
h2::after{{content:"";flex:1;height:1px;background:var(--line)}}
.cards{{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}}
.cards li{{display:flex;gap:12px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px}}
.cards .em{{font-size:22px;line-height:1}}
.cards b{{font-size:14px}}
.cards p{{margin:4px 0 0;font-size:13.5px;color:var(--ink2)}}
.cards div{{min-width:0}}
/* timeline */
.tl{{list-style:none;margin:0;padding:0;border:1px solid var(--line);border-radius:14px;background:var(--panel);overflow:hidden}}
.tl li{{display:grid;grid-template-columns:70px 1fr auto;gap:12px;align-items:center;padding:11px 14px;border-top:1px solid var(--line);font-size:14px}}
.tl li:first-child{{border-top:0}}
.tl .td{{font-family:var(--mono);font-size:12.5px;color:var(--muted)}}
.tl .tx{{min-width:0}}
.tl .tw{{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}}
.tl li.past{{opacity:.55}}
.tl li.today{{background:color-mix(in srgb,var(--gold) 12%,transparent)}}
.tl li.today .td{{color:var(--gold);font-weight:600}}
.tl li.today .td::after{{content:" · today"}}
.tl li.golive{{background:color-mix(in srgb,var(--s-live) 10%,transparent);font-weight:600}}
/* toolbar */
.tools{{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-top:6px}}
.filters{{display:flex;flex-wrap:wrap;gap:6px}}
.f,.btn{{font:inherit;font-size:13px;color:var(--ink2);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:6px 12px;cursor:pointer}}
.f.on{{background:var(--ink);color:var(--paper);border-color:var(--ink)}}
.f .num{{opacity:.7;margin-left:2px}}
.search{{display:flex;gap:8px;align-items:center;flex:1 1 260px;max-width:420px}}
.search input{{flex:1;min-width:0;font:inherit;font-size:14px;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:7px 14px}}
.hint{{font-size:13px;color:var(--muted);margin:8px 0 0}}
/* channel card */
.ch{{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:20px;margin-top:16px;scroll-margin-top:72px}}
.chh{{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;justify-content:space-between}}
.cht{{display:flex;align-items:center;gap:12px}}
.bigem{{font-size:30px;line-height:1}}
.ch h3{{font-size:23px;font-weight:800;letter-spacing:-.02em}}
.logos{{display:flex;gap:8px;margin-top:5px}}
.lg{{display:block;flex:none}}
.sum{{margin:12px 0 0;max-width:82ch;color:var(--ink2)}}
.contract{{margin:10px 0 0;font-size:13.5px;color:var(--ink2);max-width:92ch;background:var(--panel2);border-radius:10px;padding:9px 12px}}
.contract span{{font-weight:600;color:var(--gold);margin-right:8px}}
.meter{{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:12px;font-size:12.5px;color:var(--muted)}}
.meter b{{color:var(--ink)}}
.sub{{margin-top:18px;border-top:1px solid var(--line);padding-top:14px}}
h4{{margin:0 0 10px;font-size:13px;font-weight:700}}
h4 small{{font-weight:400;color:var(--muted);margin-left:6px}}
ol,ul{{margin:0;padding:0;list-style:none}}
.steps{{display:grid;gap:8px}}
.step{{display:grid;grid-template-columns:30px 1fr auto;gap:12px;align-items:start;padding:10px 12px;border:1px solid var(--line);border-radius:12px;transition:opacity .15s,border-color .15s}}
.step .n{{font-family:var(--mono);font-size:12.5px;font-weight:600;color:var(--gold);padding-top:1px}}
.step p{{margin:0;font-size:14px}}
.step .sb{{min-width:0}}
.step .dw{{margin-top:4px;font-size:13px;color:var(--ink2)}}
.step .dw span{{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-right:8px}}
.owners{{display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end}}
.who{{font-size:11px;font-weight:600;padding:2px 9px;border-radius:999px;border:1px solid color-mix(in srgb,var(--c) 45%,transparent);color:var(--c);white-space:nowrap}}
.w-scalepods{{--c:var(--o-sp)}}.w-luis{{--c:var(--o-luis)}}.w-natura{{--c:var(--o-natura)}}.w-guileo{{--c:var(--o-guileo)}}.w-thirdparty{{--c:var(--o-third)}}
.dim{{opacity:.25}}
.hit{{border-color:var(--gold)!important}}
.autos{{display:grid;gap:8px}}
.auto{{border:1px solid var(--line);border-radius:12px;background:var(--panel2)}}
.auto summary{{list-style:none;cursor:pointer;display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:10px 12px;font-size:14px}}
.auto summary::-webkit-details-marker{{display:none}}
.auto summary::after{{content:"+";margin-left:auto;color:var(--muted);font-family:var(--mono)}}
.auto details[open] summary::after{{content:"−"}}
.auto .em{{font-size:17px}}
.auto .pill{{font-size:11px;padding:2px 8px}}
.auto dl{{margin:0;padding:0 12px 12px;display:grid;grid-template-columns:150px 1fr;gap:8px 14px;font-size:13.5px}}
.auto dt{{color:var(--muted);font-size:12px;font-weight:600;padding-top:2px}}
.auto dd{{margin:0;color:var(--ink2);min-width:0}}
.auto dd code{{word-break:break-word}}
.routes{{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px 18px}}
.routes li{{display:grid;gap:3px;min-width:0}}
.routes span{{font-size:13px;color:var(--ink2)}}
.cp{{all:unset;cursor:pointer;justify-self:start;max-width:100%}}
.cp code{{display:inline-block;background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:2px 7px;word-break:break-word;color:var(--ink)}}
.cp:hover code{{border-color:var(--gold)}}
.cp.ok code{{border-color:var(--s-live);color:var(--s-live)}}
.toast{{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--ink);color:var(--paper);padding:8px 14px;border-radius:999px;font-size:13px;z-index:20}}
.foot{{margin-top:40px;font-size:12.5px;color:var(--muted)}}
@media (max-width:760px){{.kpis{{grid-template-columns:repeat(2,minmax(0,1fr))}}.step{{grid-template-columns:28px 1fr}}.owners{{grid-column:2;justify-content:flex-start}}.auto dl{{grid-template-columns:1fr}}.tl li{{grid-template-columns:58px 1fr}}.tl .tw{{grid-column:2;justify-content:flex-start}}}}
</style>
<header class="cover"><div class="wrap">
  <div class="brands"><div class="brand"><img src="data:image/png;base64,{G}" alt=""><div><b>Guileo</b><span>AI systems for business</span></div></div><img class="nlogo" src="data:image/png;base64,{NL}" alt="Natura Spa"></div>
  <div class="eye">Technical handoff · Scale Pods · updated {e(UPDATED)}</div>
  <h1>Natura Spa, <em>channel by channel.</em></h1>
  <p class="lede">Every channel in the contract with the <b>build steps</b> in order, who owns each one and the <b>proof</b> we accept, plus every <b>automation</b>: how it works, where it lives in the code and how to prove it. Go-Live is <b>October 29, 2026</b>.</p>
  <div class="kpis">
    <div class="kpi gold"><b class="num" id="days">13</b><span>days to Go-Live</span></div>
    <div class="kpi"><b class="num">{n_steps}</b><span>build steps · {by_owner["Scale Pods"]} for Scale Pods</span></div>
    <div class="kpi"><b class="num">{n_auto}</b><span>automations · {n_live} already live</span></div>
    <div class="kpi"><b class="num">{len(ALL)}</b><span>channels and integrations</span></div>
  </div>
  <ul class="stack" aria-label="Software stack">{stack}</ul>
</div></header>
<nav class="nav" aria-label="Channels"><div class="wrap">{nav}</div></nav>
<main><div class="wrap">
  <h2>🧭 How we work</h2>
  <ul class="cards">{rules}</ul>
  <h2>🏗️ What every channel shares</h2>
  <ul class="cards">{base}</ul>
  <h2>📆 Road to Go-Live</h2>
  <ol class="tl" id="tl">{tl}</ol>
  <h2>📡 Channels</h2>
  <div class="tools">
    <div class="filters" role="group" aria-label="Show steps for">{filters}</div>
    <div class="search"><input id="q" type="search" placeholder="Search steps, automations, files…" aria-label="Search"><button type="button" class="btn" id="openall">Open all</button></div>
  </div>
  <p class="hint" id="hint">Pick an owner to highlight their steps. Search finds steps, automations and file paths.</p>
  {"".join(block(c) for c in CHANNELS)}
  <h2>🔌 Integrations</h2>
  {"".join(block(c) for c in INTEGRATIONS)}
  <p class="foot">Source of truth in the repo: <code>scripts/canais_dados_en.py</code> (English page) and <code>scripts/canais_dados.py</code> → <code>CANAIS.md</code> (Portuguese). Questions go to Origem in the tracker, never by changing the live agent.</p>
</div></main>
<script>
(function(){{
  var golive=new Date('2026-10-29T09:00:00-04:00'),now=new Date();
  var d=Math.max(0,Math.ceil((golive-now)/864e5));var el=document.getElementById('days');if(el)el.textContent=d;
  var today=now.toISOString().slice(0,10);
  [].forEach.call(document.querySelectorAll('#tl li'),function(li){{var x=li.getAttribute('data-d');if(x<today)li.classList.add('past');else if(x===today)li.classList.add('today');if(x==='2026-10-29')li.classList.add('golive');}});
  var fs=[].slice.call(document.querySelectorAll('.f')),cur='all',q=document.getElementById('q'),hint=document.getElementById('hint');
  function apply(){{
    var term=(q.value||'').trim().toLowerCase(),n=0;
    [].forEach.call(document.querySelectorAll('.step'),function(s){{
      var own=cur==='all'||(' '+s.getAttribute('data-own')+' ').indexOf(' '+cur+' ')>-1;
      var hit=!term||s.getAttribute('data-q').indexOf(term)>-1;
      s.classList.toggle('dim',!(own&&hit));s.classList.toggle('hit',!!term&&own&&hit);if(own&&hit)n++;
    }});
    [].forEach.call(document.querySelectorAll('.auto'),function(a){{var hit=!term||a.getAttribute('data-q').indexOf(term)>-1;a.classList.toggle('dim',!hit);if(term&&hit)a.querySelector('details').open=true;}});
    hint.textContent=(cur==='all'&&!term)?'Pick an owner to highlight their steps. Search finds steps, automations and file paths.':n+' step'+(n===1?'':'s')+' match.';
    try{{localStorage.setItem('nc-f',cur);}}catch(e){{}}
  }}
  fs.forEach(function(b){{b.addEventListener('click',function(){{cur=b.getAttribute('data-f');fs.forEach(function(x){{var on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on?'true':'false');}});apply();}});}});
  q.addEventListener('input',apply);
  try{{var s=localStorage.getItem('nc-f');var b=s&&document.querySelector('.f[data-f="'+s+'"]');if(b)b.click();}}catch(e){{}}
  var oa=document.getElementById('openall'),open=false;
  oa.addEventListener('click',function(){{open=!open;[].forEach.call(document.querySelectorAll('.auto details'),function(d){{d.open=open;}});oa.textContent=open?'Close all':'Open all';}});
  function toast(t){{var x=document.createElement('div');x.className='toast';x.textContent=t;document.body.appendChild(x);setTimeout(function(){{x.remove();}},1400);}}
  [].forEach.call(document.querySelectorAll('.cp'),function(b){{b.addEventListener('click',function(){{
    var t=b.getAttribute('data-cp');
    function done(){{b.classList.add('ok');toast('Copied');setTimeout(function(){{b.classList.remove('ok');}},1200);}}
    try{{navigator.clipboard.writeText(t).then(done,function(){{sel(b);}});}}catch(e){{sel(b);}}
  }});}});
  function sel(b){{var r=document.createRange();r.selectNodeContents(b.querySelector('code'));var s=getSelection();s.removeAllRanges();s.addRange(r);toast('Selected — press Copy');}}
  var links=[].slice.call(document.querySelectorAll('.nav a'));
  if('IntersectionObserver' in window){{var io=new IntersectionObserver(function(es){{es.forEach(function(en){{if(en.isIntersecting){{links.forEach(function(a){{a.classList.toggle('here',a.getAttribute('href')==='#'+en.target.id);}});}}}});}},{{rootMargin:'-40% 0px -55% 0px'}});[].forEach.call(document.querySelectorAll('.ch'),function(c){{io.observe(c);}});}}
}})();
</script>
'''
open(OUT, "w").write(page)
print("ok", OUT, "steps", n_steps, "autos", n_auto, "live", n_live, by_owner, f"{len(page)//1024} KB")
