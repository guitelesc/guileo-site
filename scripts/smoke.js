/* Guileo portal smoke-test harness.
 * Paste/eval this on a *.guileoai.pages.dev/portal tab (Chrome MCP javascript_tool).
 * It installs window.__g with 1-call helpers so every feature has a 1-second test route.
 *
 * Typical flow (each line = one MCP eval call):
 *   __g.seed()                      // seed demo session (then reload the tab once)
 *   __g.nav('Integrations')         // jump to a section by label
 *   __g.openGui()                   // open the Gui assistant
 *   __g.ask('send an invoice to my top customer')   // type+send to Gui
 *   __g.lastReply()                 // read Gui's latest bubble
 *   __g.sweep()                     // click every nav section, report empty renders
 *   __g.state(/payments|stack|automations/)         // dump matching localStorage
 */
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const txt = (sel) => (document.querySelector(sel)?.innerText || '');
  const bubbles = () => [...document.querySelectorAll('div')].map((d) => d.textContent.trim());

  const g = {
    // seed a demo session on the CURRENT origin (reload the tab after calling)
    seed() {
      localStorage.setItem('guileo_portal_session', JSON.stringify({ email: 'demo@guileo.ai', name: 'Jane Staff', role: 'Staff', demo: true, at: Date.now() }));
      localStorage.setItem('guileo_onboarded', '1');
      localStorage.setItem('guileo_tour_done', '1');
      return 'seeded — reload the tab now';
    },
    // navigate to a section by its visible label
    nav(label) {
      const b = [...document.querySelectorAll('nav button')].find((x) => new RegExp(label, 'i').test(x.textContent));
      b && b.click();
      return { clicked: !!b, label };
    },
    // open the floating Gui assistant
    openGui() {
      const l = [...document.querySelectorAll('button[aria-label]')].find((b) => /Gui assistant/i.test(b.getAttribute('aria-label') || ''));
      l && l.click();
      return { opened: !!l || /Ask Gui/.test(document.body.innerText) };
    },
    // type a command into Gui and send it
    ask(t) {
      const inp = document.querySelector('input[placeholder*="Ask Gui"], input[placeholder*="Listening"]');
      if (!inp) return { sent: false, reason: 'Gui not open — call __g.openGui() first' };
      setVal(inp, t);
      [...inp.closest('form').querySelectorAll('button')].find((b) => /send/i.test(b.textContent))?.click();
      return { sent: true, text: t };
    },
    // read Gui's most recent reply bubble
    lastReply() {
      const b = bubbles().filter((t) => /^Gui/.test(t) || /✓|Pronto|Done|Set ✓/.test(t)).pop();
      return b ? b.slice(0, 260) : null;
    },
    // click through every section; report any that render < 40 chars (blank)
    sweep() {
      const navs = [...document.querySelectorAll('nav button')];
      let empty = 0; const blanks = [];
      navs.forEach((b) => { b.click(); const t = txt('main').trim(); if (t.length < 40) { empty++; blanks.push(b.textContent.trim().slice(0, 18)); } });
      return { sections: navs.length, empty, blanks };
    },
    // dump localStorage state keys matching a pattern
    state(re) {
      const rx = re instanceof RegExp ? re : new RegExp(re, 'i');
      return Object.keys(localStorage).filter((k) => rx.test(k)).reduce((o, k) => { o[k] = localStorage.getItem(k); return o; }, {});
    },
    sleep,
  };
  window.__g = g;
  return 'window.__g installed — helpers: seed, nav, openGui, ask, lastReply, sweep, state';
})();
