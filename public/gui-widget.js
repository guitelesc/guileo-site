/* Guileo · Gui webchat widget — self-contained, zero-dependency embed.
   Clients paste ONE tag on THEIR site:
   <script src="https://guileoai.com/gui-widget.js" data-guileo="CLIENT_EMAIL" data-lang="pt" defer></script>
   Everything is prefixed .gw- and lives in its own container so it never clashes
   with (or breaks) the host page. Talks to https://guileoai.com/api/widget-chat.
   No innerHTML anywhere — all nodes built via createElement/textContent (XSS-proof). */
(function () {
  "use strict";
  try {
    if (window.__guiWidget) return;
    var sc = document.currentScript || document.querySelector("script[data-guileo]");
    if (!sc) return;
    var CLIENT = (sc.getAttribute("data-guileo") || "").trim();
    if (!CLIENT || CLIENT.indexOf("@") < 0) return;
    window.__guiWidget = 1;
    var LANG = (sc.getAttribute("data-lang") || (navigator.language || "en")).slice(0, 2).toLowerCase();
    if (["pt", "es", "en"].indexOf(LANG) < 0) LANG = "en";
    var API = "https://guileoai.com/api/widget-chat";
    // Optional per-client branding via data-* attrs (explicit always wins over API config).
    // data-name = agent name (e.g. "Lilian"), data-logo = logo image URL, data-accent = hex.
    function hex(v) { v = (v || "").trim(); return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : ""; }
    var BRAND_NAME = (sc.getAttribute("data-name") || "").trim().slice(0, 40);
    var BRAND_LOGO = (sc.getAttribute("data-logo") || "").trim();
    if (BRAND_LOGO && !/^https?:\/\//i.test(BRAND_LOGO)) BRAND_LOGO = ""; // only real remote images
    var ATTR_ACCENT = hex(sc.getAttribute("data-accent"));
    var ACCENT = ATTR_ACCENT || "#FF8A33";
    // which brand bits the site set explicitly — these always win over API-returned config
    var hasAttrName = !!BRAND_NAME, hasAttrLogo = !!BRAND_LOGO, hasAttrAccent = !!ATTR_ACCENT;
    var T = {
      en: { greet: "Hi! I'm {n}, the virtual assistant here — I can book, quote or answer anything you need 👋", ph: "Type your message…", send: "Send", sub: "AI assistant · online", err: "I'm having a connection hiccup — please try again in a moment.", errP: "I'm having a connection hiccup — you can also call us: ", open: "Chat with us", close: "Close chat" },
      pt: { greet: "Oi! Sou a {n}, assistente virtual daqui — posso reservar, orçar ou responder o que precisar 👋", ph: "Escreva sua mensagem…", send: "Enviar", sub: "assistente IA · online", err: "Tive uma falha de conexão — tente de novo em instantes.", errP: "Tive uma falha de conexão — você também pode ligar: ", open: "Fale com a gente", close: "Fechar chat" },
      es: { greet: "¡Hola! Soy {n}, la asistente virtual de aquí — puedo reservar, cotizar o responder lo que necesites 👋", ph: "Escribe tu mensaje…", send: "Enviar", sub: "asistente IA · online", err: "Tuve una falla de conexión — intenta de nuevo en un momento.", errP: "Tuve una falla de conexión — también puedes llamar: ", open: "Habla con nosotros", close: "Cerrar chat" }
    };
    var t = T[LANG];

    // session identity + persisted chat history (per browser tab session)
    var SID = "", hist, bizPhone = "", bizName = "";
    try { SID = sessionStorage.getItem("gw_sid") || ""; } catch (e) { /* blocked storage */ }
    if (!SID) {
      SID = "gw" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      try { sessionStorage.setItem("gw_sid", SID); } catch (e) { /* ok */ }
    }
    try { hist = JSON.parse(sessionStorage.getItem("gw_hist") || "[]"); } catch (e) { hist = []; }
    if (!(hist instanceof Array)) hist = [];
    try { bizPhone = sessionStorage.getItem("gw_phone") || ""; } catch (e) { /* ok */ }
    function save() { try { sessionStorage.setItem("gw_hist", JSON.stringify(hist.slice(-30))); } catch (e) { /* ok */ } }

    var CSS = ".gw-root{all:initial;position:fixed;z-index:2147483000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;right:0;bottom:0}" +
      ".gw-root *{box-sizing:border-box;margin:0;padding:0;font-family:inherit}" +
      ".gw-bubble{position:fixed;right:18px;bottom:18px;width:58px;height:58px;border-radius:50%;background:#1d1b18;border:1.5px solid color-mix(in srgb,var(--gw-accent) 60%,transparent);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:26px;line-height:1;box-shadow:0 6px 24px rgba(0,0,0,.35);animation:gw-breathe 3.2s ease-in-out infinite;transition:transform .18s ease}" +
      ".gw-bubble:hover{transform:scale(1.07)}" +
      "@keyframes gw-breathe{0%,100%{box-shadow:0 6px 24px rgba(0,0,0,.35),0 0 0 0 color-mix(in srgb,var(--gw-accent) 32%,transparent)}50%{box-shadow:0 6px 24px rgba(0,0,0,.35),0 0 0 11px color-mix(in srgb,var(--gw-accent) 0%,transparent)}}" +
      ".gw-panel{position:fixed;right:16px;bottom:88px;width:min(376px,calc(100vw - 24px));max-height:min(600px,calc(100vh - 110px));height:540px;background:#161512;color:#f1ece2;border:1px solid rgba(255,255,255,.09);border-radius:18px;display:none;flex-direction:column;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.5);opacity:0;transform:translateY(14px);transition:opacity .22s ease,transform .22s ease}" +
      ".gw-panel.gw-on{display:flex}.gw-panel.gw-vis{opacity:1;transform:translateY(0)}" +
      "@media (max-width:480px){.gw-panel{right:8px;left:8px;width:auto;bottom:84px;height:min(560px,calc(100vh - 100px))}}" +
      ".gw-head{display:flex;align-items:center;gap:10px;padding:13px 14px;background:#1d1b18;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0}" +
      ".gw-ava{width:36px;height:36px;border-radius:50%;background:color-mix(in srgb,var(--gw-accent) 16%,transparent);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;overflow:hidden}" +
      ".gw-ava img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}" +
      ".gw-tt{flex:1;min-width:0}.gw-name{display:block;font-size:14px;font-weight:800;color:#f1ece2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".gw-sub{font-size:11px;color:#9d968a}.gw-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#37d67a;margin-right:4px}" +
      ".gw-x{background:none;border:0;color:#9d968a;font-size:18px;cursor:pointer;padding:4px 6px;line-height:1}.gw-x:hover{color:#f1ece2}" +
      ".gw-msgs{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:8px}" +
      ".gw-m{max-width:84%;padding:9px 12px;border-radius:14px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:break-word}" +
      ".gw-m.gw-u{align-self:flex-end;background:var(--gw-accent);color:#1a120a;border-bottom-right-radius:4px;font-weight:500}" +
      ".gw-m.gw-g{align-self:flex-start;background:rgba(255,255,255,.07);color:#f1ece2;border-bottom-left-radius:4px}" +
      ".gw-typ{align-self:flex-start;display:none;background:rgba(255,255,255,.07);border-radius:14px;border-bottom-left-radius:4px;padding:11px 14px}" +
      ".gw-typ.gw-on{display:flex;gap:4px}.gw-typ i{width:6px;height:6px;border-radius:50%;background:var(--gw-accent);animation:gw-b 1.1s infinite}" +
      ".gw-typ i:nth-child(2){animation-delay:.18s}.gw-typ i:nth-child(3){animation-delay:.36s}" +
      "@keyframes gw-b{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}" +
      ".gw-bar{display:flex;gap:8px;padding:10px 12px;border-top:1px solid rgba(255,255,255,.08);background:#1d1b18;flex-shrink:0}" +
      ".gw-in{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:11px;color:#f1ece2;font-size:13.5px;padding:10px 12px;outline:none;min-width:0}" +
      ".gw-in:focus{border-color:color-mix(in srgb,var(--gw-accent) 55%,transparent)}.gw-in::placeholder{color:#8a8375}" +
      ".gw-send{background:var(--gw-accent);color:#1a120a;border:0;border-radius:11px;font-size:13px;font-weight:800;padding:0 15px;cursor:pointer;flex-shrink:0}" +
      ".gw-send:hover{background:color-mix(in srgb,var(--gw-accent) 82%,#fff)}.gw-send:disabled{opacity:.5;cursor:default}" +
      ".gw-foot{text-align:center;padding:6px 0 8px;background:#1d1b18;flex-shrink:0}" +
      ".gw-foot a{font-size:10.5px;color:#8a8375;text-decoration:none}.gw-foot a:hover{color:var(--gw-accent)}.gw-foot b{color:var(--gw-accent);font-weight:700}";

    // tiny safe element factory — tag, className, textContent
    function el(tag, cls, txt) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (txt) n.textContent = txt;
      return n;
    }

    // Build the avatar node — the client's logo <img> when we have one, else the emoji.
    // Never innerHTML: the <img> is created via createElement so a hostile logo URL can't inject.
    function avatar(logo) {
      var a = el("div", "gw-ava");
      if (logo) {
        var im = document.createElement("img");
        im.src = logo;
        im.alt = "";
        im.setAttribute("aria-hidden", "true");
        // if the logo fails to load, fall back to the plant emoji so the header never looks broken
        im.addEventListener("error", function () { try { a.removeChild(im); a.textContent = "🌱"; } catch (e) { /* ok */ } });
        a.appendChild(im);
      } else {
        a.textContent = "🌱";
      }
      return a;
    }

    function build() {
      if (!document.body) return;
      var root = el("div", "gw-root");
      root.style.setProperty("--gw-accent", ACCENT);
      var st = document.createElement("style");
      st.textContent = CSS;
      root.appendChild(st);

      var bub = el("button", "gw-bubble", "🌱");
      bub.type = "button";
      bub.setAttribute("aria-label", t.open);
      root.appendChild(bub);

      var panel = el("div", "gw-panel");
      // header
      var head = el("div", "gw-head");
      var avaEl = avatar(BRAND_LOGO);
      head.appendChild(avaEl);
      var tt = el("div", "gw-tt");
      var nameEl = el("span", "gw-name", BRAND_NAME || "Gui");
      var subEl = el("span", "gw-sub");
      subEl.appendChild(el("i", "gw-dot"));
      subEl.appendChild(document.createTextNode(t.sub));
      tt.appendChild(nameEl);
      tt.appendChild(subEl);
      head.appendChild(tt);
      var closeBtn = el("button", "gw-x", "✕");
      closeBtn.type = "button";
      closeBtn.setAttribute("aria-label", t.close);
      head.appendChild(closeBtn);
      panel.appendChild(head);
      // messages + typing indicator
      var msgs = el("div", "gw-msgs");
      panel.appendChild(msgs);
      var typ = el("div", "gw-typ");
      for (var d = 0; d < 3; d++) typ.appendChild(el("i"));
      // input bar
      var bar = el("div", "gw-bar");
      var input = el("input", "gw-in");
      input.type = "text";
      input.maxLength = 600;
      input.placeholder = t.ph;
      input.setAttribute("aria-label", t.ph);
      var sendBtn = el("button", "gw-send", t.send);
      sendBtn.type = "button";
      bar.appendChild(input);
      bar.appendChild(sendBtn);
      panel.appendChild(bar);
      // footer — the viral loop, always visible
      var foot = el("div", "gw-foot");
      var fa = el("a", "", "⚡ powered by ");
      fa.href = "https://guileoai.com?utm_source=widget";
      fa.target = "_blank";
      fa.rel = "noopener";
      fa.appendChild(el("b", "", "Guileo"));
      foot.appendChild(fa);
      panel.appendChild(foot);
      root.appendChild(panel);
      document.body.appendChild(root);

      function add(role, text) {
        var m = el("div", "gw-m " + (role === "user" ? "gw-u" : "gw-g"), text);
        msgs.appendChild(m);
        msgs.scrollTop = msgs.scrollHeight;
      }

      var open = false, busy = false, greeted = false;
      function toggle(on) {
        open = on === undefined ? !open : on;
        if (open) {
          panel.classList.add("gw-on");
          requestAnimationFrame(function () { panel.classList.add("gw-vis"); });
          if (!greeted) {
            greeted = true;
            if (hist.length) { for (var i = 0; i < hist.length; i++) add(hist[i].role === "user" ? "user" : "gui", String(hist[i].text || "")); }
            // CR-01 (2026-10-08): a 1ª mensagem do chat se apresenta como ASSISTENTE VIRTUAL (sem aviso de gravação — é texto).
            else { var g0 = t.greet.replace("{n}", BRAND_NAME || "Gui"); add("gui", g0); hist.push({ role: "gui", text: g0 }); save(); }
            msgs.appendChild(typ);
          }
          setTimeout(function () { try { input.focus(); } catch (e) { /* ok */ } }, 180);
        } else {
          panel.classList.remove("gw-vis");
          setTimeout(function () { panel.classList.remove("gw-on"); }, 220);
        }
      }
      bub.addEventListener("click", function () { toggle(); });
      closeBtn.addEventListener("click", function () { toggle(false); });

      function fail() { add("gui", bizPhone ? t.errP + bizPhone + "." : t.err); }

      // Merge brand config the API returns (name / logo / accent). Explicit data-* attrs on the
      // embed tag always win, so this only fills what the site didn't set. Runs once (idempotent).
      var brandApplied = false;
      function applyBrand(dta) {
        if (brandApplied) return;
        var apiName = (dta.name || "").toString().trim().slice(0, 40);
        var apiLogo = (dta.logo || "").toString().trim();
        if (apiLogo && !/^https?:\/\//i.test(apiLogo)) apiLogo = "";
        var apiAccent = hex(dta.accent);
        // name: explicit attr > API agent name > legacy "Gui · business"
        if (!hasAttrName) {
          if (apiName) nameEl.textContent = apiName;
          else if (dta.biz && !bizName) { bizName = dta.biz; nameEl.textContent = "Gui · " + dta.biz; }
        }
        // logo: explicit attr > API logo (swap the avatar node in place)
        if (!hasAttrLogo && apiLogo) {
          var next = avatar(apiLogo);
          if (avaEl.parentNode) { avaEl.parentNode.replaceChild(next, avaEl); avaEl = next; }
        }
        // accent: explicit attr > API accent
        if (!hasAttrAccent && apiAccent) { ACCENT = apiAccent; root.style.setProperty("--gw-accent", apiAccent); }
        brandApplied = true;
      }

      function send() {
        var v = (input.value || "").trim();
        if (!v || busy) return;
        input.value = "";
        add("user", v);
        hist.push({ role: "user", text: v });
        save();
        busy = true;
        sendBtn.disabled = true;
        typ.classList.add("gw-on");
        msgs.appendChild(typ);
        msgs.scrollTop = msgs.scrollHeight;
        var userTurns = 0;
        for (var i = 0; i < hist.length; i++) if (hist[i].role === "user") userTurns++;
        var done = function () { busy = false; sendBtn.disabled = false; typ.classList.remove("gw-on"); };
        fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client: CLIENT, sessionId: SID, message: v, lang: LANG, start: userTurns === 1, history: hist.slice(0, -1).slice(-6) })
        }).then(function (r) { return r.json(); }).then(function (dta) {
          done();
          if (dta && dta.ok && dta.answer) {
            if (dta.phone) { bizPhone = dta.phone; try { sessionStorage.setItem("gw_phone", dta.phone); } catch (e) { /* ok */ } }
            applyBrand(dta);
            add("gui", dta.answer);
            hist.push({ role: "gui", text: dta.answer });
            save();
          } else fail();
        }).catch(function () { done(); fail(); });
      }
      sendBtn.addEventListener("click", send);
      input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
    }

    if (document.body) build();
    else document.addEventListener("DOMContentLoaded", build);
  } catch (e) { /* NEVER break the host page */ }
})();
