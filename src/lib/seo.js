import { useEffect } from "react";

const SITE = "https://guileoai.com";
const DEFAULT_TITLE = "Guileo — AI Systems for Business · Work Smart. Grow Faster. Sleep Better.";
const DEFAULT_DESC = "AI voice agents, websites, apps and growth for restaurants, clinics and service businesses. Your AI answers calls, books appointments and closes deals 24/7. Live in under 7 days. 30-day money-back.";

function setMeta(selector, attr, value) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    const [, key, val] = selector.match(/\[(name|property)="([^"]+)"\]/) || [];
    if (key && val) el.setAttribute(key, val);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}
function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) { el = document.createElement("link"); el.setAttribute("rel", rel); document.head.appendChild(el); }
  el.setAttribute("href", href);
}

/**
 * Per-route SEO for this SPA: sets <title>, meta description, canonical and the
 * OG/Twitter title+description+url so each page ranks for its own keywords and
 * shares with the right preview. Restores the site defaults on unmount.
 *   useSeo({ title, description, path: "/home-services" })
 */
export function useSeo({ title, description, path = "" } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title}` : DEFAULT_TITLE;
    const desc = description || DEFAULT_DESC;
    const url = SITE + (path || "/");
    document.title = fullTitle;
    setMeta('meta[name="description"]', "content", desc);
    setMeta('meta[property="og:title"]', "content", title || "Guileo — AI Systems for Business");
    setMeta('meta[property="og:description"]', "content", desc);
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('meta[name="twitter:title"]', "content", title || "Guileo — AI Systems for Business");
    setMeta('meta[name="twitter:description"]', "content", desc);
    setLink("canonical", url);
    return () => {
      // restore defaults so the next route (or back to home) isn't stuck on this page's tags
      document.title = DEFAULT_TITLE;
      setMeta('meta[name="description"]', "content", DEFAULT_DESC);
      setMeta('meta[property="og:url"]', "content", SITE);
      setLink("canonical", SITE + "/");
    };
  }, [title, description, path]);
}
