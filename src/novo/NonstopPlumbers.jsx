// NONSTOP PLUMBERS NY — demonstration rebuild v3 (website-porta engine, Guileo)
// CONCEPT: THE DISPATCH BOARD — work-order tickets, a response clock, borough status board,
// a red emergency stripe as structure. Everything fully rounded (pills + 28-32px cards).
// Their own assets: /novo/nonstop/{hero-web.mp4,hero-poster.webp,logo-hi.webp,crew-hi.webp,boiler-hi.webp}
// Their own palette: red #d92a28 · cyan #17c6ff · navy #0c1a2e · paper #f5f7fa.
// Real content only — nonstopplumbers.com. Every fact, price, FAQ answer, address and
// borough line below is carried over from their own pages. No invented stats.
import { useEffect, useRef, useState } from "react";

const PHONE = "(212) 567-2000";
const TEL = "tel:+12125672000";
const PHONE_OFFICE = "(646) 992-9210";
const TEL_OFFICE = "tel:+16469929210";
const IG = "https://www.instagram.com/plumbingnewyork/";
const FB = "https://www.facebook.com/profile.php?id=100091333871352";
const SITE = "https://www.guileoai.com/novo/nonstop-plumbers";
const A = "/novo/nonstop/";
const SITE_ORIGIN = "https://www.guileoai.com";

/* ── inline icons, 1.5px stroke — no emoji anywhere ── */
const I = {
  bolt: <path d="M13 2.5 4.5 13.5H11L9.8 21.5 18.5 10H12l1-7.5z" />,
  drop: <path d="M12 3.2s6 6.6 6 11a6 6 0 1 1-12 0c0-4.4 6-11 6-11zM9.5 14.5a2.6 2.6 0 0 0 2.4 2.6" />,
  wrench: <path d="M14.7 6.3a4.2 4.2 0 0 0-5.6 5.2L3.5 17.1a1.9 1.9 0 0 0 2.7 2.7l5.6-5.6a4.2 4.2 0 0 0 5.2-5.6l-2.6 2.6-2.3-.6-.6-2.3 2.6-2.6z" />,
  flame: <path d="M12 3c1.2 3-.6 4.6-1.6 6C9.2 10.6 8 12 8 14.2A4.3 4.3 0 0 0 12.3 18a4.1 4.1 0 0 0 3.7-4.2c0-1.6-.8-2.6-1.4-3.5-.5.8-.9 1.1-1.6 1.4.5-2.9-.2-6-1-8.7zM4 21h16" />,
  clip: <path d="M9 4.5h6M9.5 3h5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8.5 5H7a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17 5h-1.5M8.7 12l2 2 4-4.2M9 17.5h6" />,
  valve: <path d="M12 8v13M5 21h14M12 8a4 4 0 0 1-4-4h8a4 4 0 0 1-4 4zM6.5 14.5h11" />,
  bldg: <path d="M4 21h16M6 21V5.5A1.5 1.5 0 0 1 7.5 4h6A1.5 1.5 0 0 1 15 5.5V21m0-11h3.5a.5.5 0 0 1 .5.5V21M8.5 7.5h1.5m2.5 0H14M8.5 11h1.5m2.5 0H14M8.5 14.5h1.5m2.5 0H14M10.5 21v-3h2v3" />,
  pipe: <path d="M3 8h6a2 2 0 0 1 2 2v11M3 12h4a2 2 0 0 1 2 2v7M14 3v6a2 2 0 0 0 2 2h5M14 3h7M18 11v2m-8 4h2" />,
  phone: <path d="M5.5 3.5h3l1.5 4-2 1.5a11.5 11.5 0 0 0 5 5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5C9.6 17.9 6.1 14.4 5 6.9A1.5 1.5 0 0 1 5.5 3.5z" />,
  shield: <path d="M12 3 5 5.8v5.4c0 4.3 2.9 7.5 7 8.8 4.1-1.3 7-4.5 7-8.8V5.8L12 3zm-2.6 8.6 2 2 4.4-4.6" />,
  clock: <><circle cx="12" cy="12" r="8.8" /><path d="M12 6.8V12l3.4 2" /></>,
  pin: <path d="M12 21s6.5-6 6.5-10.6a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21zM12 12.6a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z" />,
  arrow: <path d="M4.5 12h14m-5.5-5.6 5.6 5.6-5.6 5.6" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  hard: <path d="M4 16.5h16M6.5 16V11a5.5 5.5 0 0 1 11 0v5M10 6.2V4.6A1.1 1.1 0 0 1 11.1 3.5h1.8A1.1 1.1 0 0 1 14 4.6v1.6M4 16.5v1.4A1.1 1.1 0 0 0 5.1 19h13.8a1.1 1.1 0 0 0 1.1-1.1v-1.4" />,
  star: <path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.6z" />,
};
const Ic = ({ d, s = 22 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

const SERVICES = [
  { ic: I.bolt, wo: "WO-2401", t: "Emergency Services", tag: "Priority 1", d: ["24/7 emergency repairs", "Leak detection", "Water heater installation & repair", "Violation removal & compliance corrections"] },
  { ic: I.drop, wo: "WO-2402", t: "Drain & Sewer", tag: "Priority 1", d: ["Drain cleaning", "Sewer line service", "Snaking", "Camera inspections"] },
  { ic: I.valve, wo: "WO-2403", t: "Water Main Services", tag: "Priority 1", d: ["Water main repair & replacement", "Street-to-building service lines"] },
  { ic: I.flame, wo: "WO-2404", t: "Fire Suppression", tag: "Licensed", d: ["Sprinkler design & installation", "Inspections & compliance testing", "System maintenance", "Standpipe 5-year inspections"] },
  { ic: I.clip, wo: "WO-2405", t: "Compliance Testing", tag: "Scheduled", d: ["Annual backflow preventer testing", "Local Law 152 gas piping inspections", "NYC plumbing code inspections"] },
  { ic: I.wrench, wo: "WO-2406", t: "Installations & Remodeling", tag: "Scheduled", d: ["Fixture installation", "Pipe repair & repiping", "Bath & kitchen plumbing", "Gas lines"] },
  { ic: I.bldg, wo: "WO-2407", t: "New Construction", tag: "Project", d: ["Ground-up plumbing systems", "Full build-outs & remodels"] },
  { ic: I.pipe, wo: "WO-2408", t: "Service Plans", tag: "Ongoing", d: ["Building service plans", "Home plumbing memberships"] },
];
const CREDS = [
  { ic: I.shield, t: "Master Plumber" },
  { ic: I.flame, t: "Fire Suppression" },
  { ic: I.clip, t: "Fully Insured" },
  { ic: I.clock, t: "24/7 Dispatch" },
];
const BOROUGHS = [
  { b: "Manhattan", c: "MN", d: "Leaks, drain backups, gas piping compliance and high-rise service from Harlem to the Financial District." },
  { b: "Brooklyn", c: "BK", d: "Brownstones, multifamily buildings, drain backups, remodel plumbing and emergency leak response." },
  { b: "Queens", c: "QN", d: "Water heaters, water service problems, drain work, backflow compliance and emergency response." },
  { b: "Bronx", c: "BX", d: "Multifamily emergencies, drain and sewer issues, code corrections and plumbing compliance support." },
  { b: "Staten Island", c: "SI", d: "Water-main work, gas piping, fixture upgrades, drain issues and emergency plumbing support." },
];
/* Hand-drawn NYC — stylized silhouettes in their real relative positions.
   Decorative: it lights the borough you are reading, it never claims data. */
const MAP = [
  { c: "BX", p: "M264.5 19.0L272.9 22.1L277.0 14.5L284.2 20.7L286.4 27.5L311.7 35.3L312.5 38.4L310.1 43.2L306.4 47.5L305.1 47.2L308.0 50.5L314.2 39.2L316.0 37.8L317.3 39.6L319.5 46.5L314.7 48.4L314.0 54.5L312.9 57.7L310.0 60.1L309.3 64.5L307.2 61.2L306.2 53.5L304.7 56.2L300.8 51.9L299.3 54.1L300.9 54.6L298.8 61.7L299.5 66.0L301.0 65.4L300.4 66.4L301.5 67.1L301.8 66.0L301.7 67.2L302.0 66.0L300.6 68.7L298.2 67.7L300.6 71.6L299.3 73.0L300.1 78.2L301.5 80.6L303.3 80.8L301.2 81.6L301.9 83.0L300.8 84.1L305.1 83.1L306.8 88.5L310.9 90.3L307.6 93.6L305.2 90.3L306.2 93.0L308.1 95.5L315.1 98.0L314.6 100.3L306.9 96.7L303.5 93.4L299.1 92.5L291.1 94.7L289.6 99.7L286.7 98.9L284.7 94.5L285.5 85.7L283.4 80.5L285.5 76.3L284.7 72.0L285.2 75.6L282.9 79.4L284.6 87.7L281.0 95.0L278.0 92.0L275.6 92.3L279.3 93.9L279.5 99.9L274.6 99.8L273.0 98.6L273.1 95.6L272.9 97.1L262.4 90.6L265.3 93.0L265.0 103.1L261.2 101.5L257.1 102.0L254.2 98.9L250.5 98.4L246.6 99.7L241.7 105.7L239.5 106.3L231.0 101.0L228.4 97.4L227.5 75.5L234.0 60.6L241.5 49.7L243.7 41.6L241.6 39.6L236.9 42.2L232.8 39.6L241.0 11.1L263.4 18.6Z M315.4 56.2L316.7 57.0L316.8 60.3L321.0 64.3L319.6 68.3L321.7 68.1L319.7 68.4L321.5 68.2L320.2 69.6L321.5 69.6L319.2 73.9L314.4 65.4L315.5 61.3L313.4 61.4L315.3 60.7L313.8 61.0L314.9 59.9L313.6 57.9L315.4 56.2Z", x: 295.5, y: 66.2 },
  { c: "MN", p: "M231.7 40.7L234.1 41.4L234.7 44.3L235.7 44.0L235.1 42.5L236.4 44.3L240.2 43.9L241.5 45.9L236.0 56.0L234.7 54.9L235.3 56.7L226.4 75.1L226.8 95.2L229.8 102.0L229.9 107.1L221.1 117.6L222.0 122.4L221.1 124.9L204.3 148.8L203.1 155.8L202.1 155.7L203.1 155.9L202.2 156.3L203.8 163.7L201.0 175.0L196.8 177.0L187.3 178.1L185.0 181.0L184.2 180.4L184.3 181.7L183.1 181.3L183.8 182.4L182.5 181.7L183.0 182.8L180.8 183.2L181.1 184.4L177.4 184.6L174.7 179.1L176.2 169.7L178.4 169.5L177.5 168.4L179.3 163.8L177.1 163.2L179.6 159.4L180.0 153.7L178.7 151.8L180.6 151.8L180.8 150.0L179.0 149.2L180.9 149.2L179.2 147.8L180.8 146.9L179.5 145.3L182.9 138.7L182.1 136.8L184.2 136.4L185.3 134.3L184.5 132.3L186.7 133.1L187.4 131.7L186.0 129.5L188.6 129.6L189.6 126.5L188.5 125.3L190.2 125.6L188.8 124.8L190.3 125.2L192.3 121.9L193.3 120.2L191.8 120.2L193.3 119.8L194.4 115.7L212.2 85.5L211.3 84.5L214.7 80.6L219.6 68.1L219.0 62.8L222.2 60.0L231.0 41.5Z M234.8 103.0L237.8 105.6L238.4 110.4L233.7 117.2L230.4 119.1L225.9 116.9L226.0 115.3L229.6 110.7L231.9 110.9L230.5 109.9L231.4 103.7L234.0 102.2Z", x: 177.9, y: 118.2 },
  { c: "QN", p: "M296.8 102.9L301.0 106.1L302.0 105.2L312.7 107.8L313.8 112.8L320.6 110.9L321.2 108.5L319.7 107.8L324.0 106.8L327.3 112.8L324.9 114.3L329.8 120.1L331.3 125.6L343.4 138.9L337.0 130.0L336.7 126.9L338.1 125.4L336.8 121.8L340.0 117.9L369.9 142.2L370.7 151.5L367.3 159.9L363.6 162.9L352.4 166.7L354.3 176.2L355.1 200.8L353.5 211.3L355.3 221.9L345.4 229.0L345.3 237.6L345.5 235.2L344.0 234.3L342.0 236.0L341.7 230.7L337.2 227.1L341.7 232.3L340.9 237.2L330.9 242.0L327.5 249.6L326.7 246.9L324.8 250.1L326.7 246.9L324.6 244.1L322.2 243.8L318.5 249.8L321.1 254.7L315.0 259.7L309.0 256.2L312.7 247.7L316.0 247.3L318.7 244.3L318.2 239.9L315.1 238.2L310.6 240.6L314.7 238.0L313.8 236.7L298.3 228.4L296.4 226.1L295.6 217.8L297.8 216.4L302.4 216.6L297.9 215.6L295.0 217.1L295.1 227.0L293.3 225.3L293.2 226.7L291.8 226.0L290.3 223.5L291.5 220.4L289.6 221.7L291.4 219.9L290.8 217.4L291.3 219.7L289.7 221.4L289.2 218.8L290.3 226.4L288.1 226.9L285.6 215.3L287.0 229.2L279.0 230.1L277.2 228.0L279.0 224.2L275.0 224.3L271.7 220.1L274.4 210.3L267.6 192.0L260.5 192.0L254.6 197.3L251.5 196.7L250.2 198.8L244.8 188.0L233.1 173.4L235.3 171.8L232.5 166.5L235.4 165.6L224.5 160.1L222.3 155.7L219.7 154.4L223.1 152.1L223.7 149.9L220.0 153.8L214.8 152.5L209.5 153.4L211.9 146.9L214.3 145.9L213.4 144.8L220.4 133.8L226.4 127.1L225.7 122.2L231.7 121.3L240.7 112.0L246.3 112.2L250.1 114.9L246.5 119.7L251.4 116.5L250.3 117.4L250.8 118.6L252.3 117.6L252.5 122.0L253.0 123.8L254.0 122.2L254.2 125.0L257.3 124.1L257.2 119.9L260.7 119.4L260.5 117.7L266.8 115.1L266.3 120.3L275.5 126.6L273.6 127.7L274.8 128.9L270.9 130.6L273.4 134.5L274.4 132.8L274.6 134.8L273.4 134.6L278.4 136.5L285.0 130.4L281.8 131.7L279.9 130.5L279.5 127.5L277.9 126.6L279.3 121.5L277.2 120.3L278.9 120.0L277.7 119.9L279.0 119.8L279.1 118.1L275.4 118.3L272.9 115.4L276.8 113.4L275.7 113.0L277.0 110.9L276.4 108.6L279.4 109.0L280.0 107.1L282.6 107.8L283.0 106.2L283.8 107.4L285.8 105.0L284.8 106.2L286.6 108.6L286.5 112.6L289.2 113.0L292.3 109.4L291.3 106.3L294.1 105.8L296.8 103.2Z M329.9 254.3L330.9 256.1L333.4 256.7L333.0 258.6L342.0 256.4L347.3 267.3L345.2 268.7L347.2 268.4L347.7 270.4L342.2 270.5L337.8 273.3L333.0 272.6L323.6 273.9L301.1 279.3L270.9 293.1L251.0 300.7L243.3 302.1L223.2 312.2L223.3 302.9L232.1 297.0L240.5 293.6L243.8 296.1L246.7 296.0L252.3 291.4L261.9 291.1L279.5 280.4L285.3 280.4L291.2 278.4L297.6 275.7L303.5 271.1L305.9 273.4L306.8 272.5L304.5 270.6L305.7 269.5L307.6 271.9L308.0 270.4L306.2 268.6L307.6 266.8L314.2 265.9L317.8 263.3L315.3 266.7L315.7 270.1L316.2 267.4L319.6 263.7L319.3 261.8L322.4 258.2L325.3 258.8L325.0 259.9L324.1 258.5L325.0 262.4L320.5 267.2L321.6 268.4L324.6 264.5L325.9 267.6L329.0 267.7L327.1 266.4L328.5 258.3L325.3 256.2L325.8 254.8L329.8 254.3Z", x: 303.3, y: 198.0 },
  { c: "BK", p: "M214.5 153.1L219.0 154.7L219.0 156.9L219.9 155.1L221.6 155.9L225.3 161.2L229.8 162.5L232.7 169.7L228.1 172.7L227.4 175.7L229.2 177.7L228.9 172.7L233.2 170.5L234.5 177.2L245.0 188.1L247.2 194.6L250.3 198.7L251.5 196.8L255.2 196.7L260.6 191.9L267.6 192.5L274.7 211.5L273.7 215.6L270.5 219.7L274.3 225.0L274.1 230.6L271.5 231.1L269.1 234.5L260.6 221.6L267.2 234.8L264.2 236.5L253.4 225.9L261.2 235.1L261.4 237.8L258.4 240.3L258.6 243.0L255.4 243.0L250.5 247.6L237.2 240.4L246.2 246.0L247.5 248.4L250.1 248.5L250.4 254.0L253.5 255.5L251.6 256.8L254.2 256.9L252.0 260.5L248.2 261.5L247.8 257.7L242.7 251.9L242.9 253.2L242.0 252.5L246.5 257.4L246.8 261.3L244.7 261.9L242.5 260.5L242.7 262.3L239.4 262.5L237.5 258.8L239.2 253.9L235.9 259.6L239.7 264.1L242.5 264.6L257.4 261.6L262.2 278.1L258.7 282.8L250.7 284.8L248.6 276.0L244.1 275.6L240.9 277.2L240.5 270.3L238.7 267.0L234.7 264.4L232.6 266.1L228.9 262.7L228.6 264.3L239.2 274.6L236.3 277.2L232.6 277.5L230.8 275.6L233.0 272.9L230.2 275.1L229.1 274.0L229.5 270.7L228.0 270.0L229.7 276.0L228.7 276.4L232.8 278.4L239.7 277.2L240.3 279.4L237.4 279.6L240.8 280.7L233.5 279.3L218.7 279.3L215.1 280.0L227.9 281.2L228.5 283.6L226.5 285.8L207.9 287.4L197.3 289.0L196.6 290.2L185.3 290.0L178.8 285.5L179.4 282.1L184.0 280.7L194.1 282.9L194.5 281.1L191.4 280.8L192.4 278.5L189.3 280.3L186.3 279.6L187.1 276.9L190.0 275.3L186.3 276.9L188.0 272.7L186.4 273.1L186.8 271.6L179.7 265.3L167.4 261.6L164.3 258.3L161.5 253.2L160.7 246.8L162.6 233.8L164.3 233.2L165.3 230.4L169.8 229.3L170.7 224.2L173.3 224.6L172.2 223.0L175.0 222.5L175.0 219.0L183.8 215.9L181.7 213.4L184.2 215.0L186.4 214.1L185.4 211.8L187.2 207.8L185.6 210.5L182.2 212.4L183.2 209.5L182.1 210.3L174.9 208.3L176.6 212.8L179.2 208.6L175.4 206.0L174.4 201.9L180.2 198.1L184.3 193.2L189.7 181.4L199.4 179.9L201.5 182.3L201.4 185.2L202.6 183.6L204.4 184.7L203.3 179.8L205.3 179.9L206.5 171.4L210.2 164.4L212.3 164.8L210.0 163.8L209.8 156.7L214.3 153.1Z", x: 214.6, y: 242.4 },
  { c: "SI", p: "M135.9 226.8L139.4 227.8L143.2 231.4L141.6 234.6L143.1 235.8L141.5 237.7L142.6 247.2L153.4 261.1L154.2 266.0L141.0 281.9L141.4 283.4L140.4 282.9L135.8 287.5L121.8 303.9L120.9 303.1L119.1 304.5L117.0 308.3L111.5 310.4L101.6 323.0L100.1 318.4L104.1 318.2L108.0 313.4L106.8 310.0L104.9 309.1L102.4 310.7L101.5 309.8L101.3 311.8L100.6 311.1L100.2 313.0L98.9 312.8L99.6 316.8L77.3 331.4L75.1 330.2L73.2 331.1L66.4 338.9L63.6 337.7L64.0 336.5L60.3 337.0L57.2 338.6L52.7 344.3L44.3 345.5L38.8 349.0L33.2 349.8L30.8 347.0L29.3 340.6L32.4 333.9L35.1 333.9L34.6 333.1L38.9 330.5L37.1 329.6L37.7 319.5L35.6 317.1L34.2 311.7L44.6 302.0L52.1 302.6L56.0 299.9L60.8 279.1L60.7 274.7L65.0 268.5L61.8 258.7L63.0 241.3L66.7 235.8L72.6 230.2L73.5 231.6L73.9 229.6L76.3 229.4L76.0 231.9L79.2 229.3L81.1 231.2L80.1 233.1L81.1 231.8L85.3 232.3L88.4 235.2L89.5 234.4L92.5 235.8L103.0 232.1L108.3 233.7L108.8 232.5L114.2 232.1L119.6 228.9L129.2 228.6L134.6 226.4Z", x: 88.1, y: 287.0 },
];

const PLANS = [
  { wo: "WO-BSP", t: "Building Service Plans", s: "For managed buildings & commercial properties",
    from: "From $1,199 / month",
    d: ["Monthly house trap cleaning, pressure jetting, pipe inspection and valve exercising",
        "Local Law 152, FDNY and DEP inspections, backflow and standpipe support on Tier 2 and 3",
        "24/7 priority with no after-hours surcharge, and 10–20% off additional services",
        "Tier 1 $1,199 · Tier 2 $2,299 (most popular) · Tier 3 VIP $3,499 — 36-month agreement gets 2 months free"] },
  { wo: "WO-HPM", t: "Home Plumbing Memberships", s: "For homeowners and apartments",
    from: "From $99 / year",
    d: ["10–20% off all services, VIP priority scheduling and $0 dispatch fees",
        "Silver Care $99/yr — everyday savings and priority scheduling",
        "Gold Plus $399/yr — one complimentary visit, assessment and labor-only service every year",
        "Diamond Elite $799/yr — whole-home visit and two complimentary labor-only services a year"] },
];

const OFFICES = [
  { c: "Astoria", a1: "14-31 Astoria Blvd", loc: "Astoria", zip: "11102", ph: PHONE, tel: TEL, lab: "24-hour emergency service" },
  { c: "Brooklyn", a1: "555 Macon St Suite 1", loc: "Brooklyn", zip: "11233", ph: PHONE, tel: TEL, lab: "24-hour emergency service" },
  { c: "Manhattan", a1: "30 Wall St 8th Floor", loc: "New York", zip: "10005", ph: PHONE_OFFICE, tel: TEL_OFFICE, lab: "Office line" },
].map((o) => ({ ...o, n: `Nonstop Plumbers CORP — ${o.c}`, a2: `${o.loc}, NY ${o.zip}` }));

const STANDARDS = [
  ["State-of-the-art equipment", "The right tools for the job, so plumbing problems are solved cleanly and accurately."],
  ["Prompt appointments in a busy city", "Modern scheduling and responsive dispatch, because your time counts too."],
  ["Customers who come back", "Straightforward, fair and professional from the first call to the final walkthrough."],
  ["Clean finish, not just finished", "The site is left in order — the mess doesn't stay behind for the customer."],
];

const FAQ = [
  { q: "How quickly can you send a plumber in NYC?",
    a: "For active leaks, drain backups, no-water conditions or any urgent problem, the fastest path is to call dispatch. The team routes the nearest qualified crew based on borough, building access and the actual severity. Arrival depends on traffic, access restrictions and current emergency volume — the goal is always to stabilize the property first, explain the condition clearly, then move into the right repair scope." },
  { q: "Should I call or use the contact form for an emergency?",
    a: "Call for anything active or time-sensitive: leaking water, sewer backup, no hot water in a building, gas concerns, or a shutdown already affecting occupants. Dispatch can triage immediately and tell you what to do before a technician arrives. Use the form for estimates, planned work and follow-ups — it is good for organized scope intake, but it is not the path for a live emergency." },
  { q: "What should I do before the plumber arrives for a leak or backup?",
    a: "If it is safe, shut off the local fixture or the nearest water source, stop using the affected drains and move valuables away. In multifamily or commercial buildings, notify building staff right away so access and shutdown decisions happen faster. Note which fixtures are affected and whether the problem is isolated or building-wide — that narrows the likely cause before anyone arrives." },
  { q: "What causes recurring drain backups in apartment buildings or brownstones?",
    a: "Recurring backups usually point to a deeper line condition, not a one-time surface clog: grease buildup, scale, partial collapses, root intrusion, poor pitch, or a branch line that was only opened temporarily instead of properly cleaned. In older NYC buildings, stacked systems and limited access hide where the real restriction starts, so repeat backups need a full diagnosis rather than another pass with a cable." },
  { q: "Why did my apartment or building lose hot water?",
    a: "A hot-water outage can come from the heater itself, boiler controls, recirculation problems, gas supply, electrical failures, or a larger building-system condition — and it looks different depending on whether one line, one riser or the whole property is affected. The first step is confirming whether the loss is local or building-wide and whether there is any safety concern, then diagnosis, safe restoration and any follow-up work." },
  { q: "Can you coordinate with supers, property managers and building staff?",
    a: "Yes. A large part of NYC plumbing work is coordinating around live buildings, occupied units, elevator rules, cellar access, freight windows, shutdown timing and management approval. Access needs get identified early and authority on site confirmed up front, which keeps the job moving and cuts repeat visits caused by preventable access problems." },
  { q: "Do plumbing repairs or replacements in NYC require permits?",
    a: "Some work is handled as repair or maintenance; other scopes need permits, filings, inspections or licensed sign-off. It depends on what is being changed, whether gas or water service is affected, and which agency has jurisdiction. The safest assumption is not to guess — the job is evaluated on actual site conditions and mapped to the correct code and filing path first." },
  { q: "Can you help with DOB, DEP, FDNY, gas and backflow-related scopes?",
    a: "Yes. Compliance work often overlaps gas piping, sprinkler coordination, backflow requirements, water-service issues or agency-driven corrections, where paperwork, testing and sequence matter as much as the repair. Work is handled under NYC Master Plumber License #1332, with Master Fire Suppression License #543B when the scope touches sprinkler or standpipe systems." },
  { q: "Do you provide estimates for non-emergency plumbing work?",
    a: "Yes. Fixture replacement, remodeling, water heater changes, piping upgrades, compliance corrections and building-wide improvements can all be scoped through an estimate or a site visit. The more accurate the access details and project information you send, the more useful that estimate is — and the fewer surprises later." },
  { q: "Do you service all five boroughs?",
    a: "Yes — Manhattan, Brooklyn, Queens, the Bronx and Staten Island, for emergency response, drain and sewer work, hot-water issues, compliance-driven plumbing, repairs and planned projects. Coverage is citywide, but scheduling and scope still vary by borough because access, traffic, building density and agency coordination are not the same everywhere." },
];

const ROLES = ["Licensed plumbers", "Drain and sewer technicians", "Helpers and apprentices",
  "Dispatch and customer coordination", "Project and compliance support"];

/* Six real photos from their own jobs. Captions describe ONLY what is visible —
   no invented address, no invented client. */
const PHOTOS = [
  { s: "p-crew.webp", c: "Our crew, Brooklyn" },
  { s: "p-van.webp", c: "Dispatch van" },
  { s: "p-corridor.webp", c: "Corridor repair" },
  { s: "p-wall.webp", c: "Open-wall repair" },
  { s: "p-pipes.webp", c: "Mechanical pipe work" },
  { s: "p-sprinkler.webp", c: "Fire suppression, garage" },
];

/* RED = emergency/action only. Everything else on the board is cyan-ink or navy. */
const tagStyle = (tag) => tag === "Priority 1"
  ? { background: "rgba(217,42,40,.09)", color: "var(--red-d)" }
  : { background: "rgba(23,198,255,.14)", color: "var(--cyan-d)" };

const nyTime = () =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })
    .format(new Date());

const CSS = `
/* ── THE BOROUGH BOARD — hand-drawn map + in-place ticket accordion ── */
.np-map{display:block;width:100%;height:auto;max-width:520px;margin:0 auto;overflow:visible}
.np-mg{cursor:pointer}
.np-mg path{fill:rgba(255,255,255,.055);stroke:rgba(255,255,255,.2);stroke-width:1.4;stroke-linejoin:round;transition:fill .5s cubic-bezier(.2,.7,.3,1),stroke .5s,filter .5s}
.np-mg:hover path{fill:rgba(255,255,255,.115);stroke:rgba(255,255,255,.34)}
.np-mg.np-on path{fill:var(--red);stroke:rgba(255,255,255,.6);filter:drop-shadow(0 0 12px rgba(217,42,40,.8)) drop-shadow(0 0 34px rgba(217,42,40,.45))}
.np-mg text{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;font-weight:600;letter-spacing:.14em;fill:rgba(255,255,255,.4);pointer-events:none;transition:fill .5s}
.np-mg.np-on text{fill:#fff}
.np-mapcap{text-align:center;color:#8ea2b8}

.np-boro{position:relative;display:flex;width:100%;text-align:left;align-items:flex-start;gap:14px;border:0;cursor:pointer;background:transparent;font-family:inherit;border-radius:26px;padding:18px;transition:background .3s ease}
.np-boro:hover{background:rgba(23,198,255,.09)}
.np-boro:focus-visible{outline:2px solid var(--cyan);outline-offset:-2px}
.np-boro[aria-expanded="true"]{background:rgba(217,42,40,.15)}
.np-brow+.np-brow{border-top:1px solid rgba(255,255,255,.07)}
.np-led{flex:none;margin-top:7px;width:3px;height:30px;border-radius:99px;transition:background .35s,box-shadow .35s;background:linear-gradient(180deg,#39d98a,rgba(57,217,138,.15));box-shadow:0 0 10px rgba(57,217,138,.45)}
.np-boro[aria-expanded="true"] .np-led{background:linear-gradient(180deg,#ff6f5f,rgba(217,42,40,.2));box-shadow:0 0 12px rgba(217,42,40,.7)}
.np-bc{flex:none;margin-top:3px;font-size:11px;padding:5px 9px;border-radius:999px;background:rgba(23,198,255,.12);color:var(--cyan);letter-spacing:.1em}
.np-boro[aria-expanded="true"] .np-bc{background:rgba(217,42,40,.22);color:#ffb9b3}
.np-bn{display:block;color:#fff;font-weight:800;font-size:20px;line-height:1.2;letter-spacing:-.015em}
.np-bd{display:block;margin-top:7px;color:#a9bbcf;font-size:15px;line-height:1.64}
.np-boro-go{flex:none;display:inline-flex;align-items:center;gap:7px;margin-top:4px;color:var(--cyan);font-size:10px;opacity:.55;transition:opacity .25s ease,color .25s ease}
.np-boro:hover .np-boro-go,.np-boro:focus-visible .np-boro-go{opacity:1}
.np-boro-go svg{transition:transform .35s cubic-bezier(.2,.7,.3,1)}
.np-boro[aria-expanded="true"] .np-boro-go{opacity:1;color:#ff9a92}
.np-boro[aria-expanded="true"] .np-boro-go svg{transform:rotate(45deg)}
@media(max-width:639px){.np-boro-go span{display:none}}
.np-panel{animation:npOpen .42s cubic-bezier(.2,.7,.3,1) both}
@keyframes npOpen{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
.np-field.np-field-d{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.22);color:#fff}
.np-field.np-field-d::placeholder{color:rgba(255,255,255,.46)}
.np-field.np-field-d:focus{background:rgba(255,255,255,.1);border-color:var(--cyan)}

.np{--navy:#0c1a2e;--navy-2:#132741;--red:#d92a28;--red-d:#ab1f1d;--cyan:#17c6ff;--cyan-d:#0a6b91;--ink:#0c1a2e;--mut:#54657a;
 --line:rgba(12,26,46,.11);--paper:#f5f7fa;--stage:#fff;--dot:rgba(12,26,46,.3);
 background:#fff;color:var(--ink);font-family:'Inter Tight','Inter',system-ui,sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased}
.np p,.np li{line-height:1.62}
.np *{box-sizing:border-box}
/* display = Archivo, signage weight and a touch of extra width */
.np h1,.np h2,.np h3,.np h4,.np .dsp{font-family:'Archivo',system-ui,sans-serif;font-weight:800;
 font-variation-settings:'wdth' 112,'wght' 800;letter-spacing:-.024em;line-height:1.06}
.np h1{letter-spacing:-.034em;line-height:1.0}
.np .dsp{letter-spacing:-.03em;line-height:1.02}
.np p,.np li,.np address{letter-spacing:-.004em}
.np .mono{font-family:'JetBrains Mono','Space Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.np-w{max-width:1200px;margin:0 auto;padding:0 20px}
@media(min-width:768px){.np-w{padding:0 36px}}
.np-lab{font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:600;font-size:11px;letter-spacing:.16em;text-transform:uppercase}

/* the recurring structural element: emergency stripe */
.np-stripe{height:9px;background:repeating-linear-gradient(115deg,var(--red) 0 16px,var(--red-d) 16px 32px)}
.np-stripe-r{border-radius:999px}

/* fully rounded pills */
.np-pill{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:8px 15px;
 border:1px solid var(--line);background:#fff;color:var(--navy);white-space:nowrap}
.np-pill-d{border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.09);color:#fff;backdrop-filter:blur(6px)}
/* ── BUTTON SYSTEM — gradient depth, lit top edge, glow, sheen sweep, press ── */
.np-btn,.np-btn-o,.np-btn-n{position:relative;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;text-decoration:none;cursor:pointer;font-family:inherit;transition:transform .24s cubic-bezier(.2,.7,.3,1),box-shadow .3s,border-color .3s,background .3s,filter .24s}
.np-btn::before,.np-btn-o::before,.np-btn-n::before{content:"";position:absolute;top:0;left:0;width:44%;height:100%;pointer-events:none;background:linear-gradient(105deg,transparent,rgba(255,255,255,.32),transparent);transform:translateX(-190%) skewX(-14deg);transition:transform .8s ease}
.np-btn:hover::before,.np-btn-o:hover::before,.np-btn-n:hover::before{transform:translateX(330%) skewX(-14deg)}
.np-btn{gap:12px;padding:18px 30px;border:0;font-weight:800;letter-spacing:-.012em;color:#fff;background:linear-gradient(180deg,#ec4442 0%,var(--red) 46%,var(--red-d) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.38),inset 0 -1px 0 rgba(0,0,0,.24),0 0 0 1px rgba(217,42,40,.4),0 18px 38px -18px rgba(217,42,40,.9)}
.np-btn:hover{transform:translateY(-3px);filter:brightness(1.04);box-shadow:inset 0 1px 0 rgba(255,255,255,.45),inset 0 -1px 0 rgba(0,0,0,.24),0 0 0 1px rgba(23,198,255,.35),0 0 34px rgba(217,42,40,.4),0 26px 52px -18px rgba(217,42,40,.95)}
.np-btn:active{transform:scale(.98)}
.np-btn:focus-visible{outline:2px solid var(--cyan);outline-offset:3px}
.np-btn-o{gap:10px;padding:17px 26px;font-weight:700;letter-spacing:-.008em;color:#fff;backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.3);background:linear-gradient(180deg,rgba(255,255,255,.15),rgba(255,255,255,.05));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 14px 30px -20px rgba(0,0,0,.9)}
.np-btn-o:hover{transform:translateY(-3px);border-color:rgba(23,198,255,.75);background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.08));box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 0 30px rgba(23,198,255,.28),0 20px 40px -20px rgba(0,0,0,.9)}
.np-btn-o:active{transform:scale(.98)}
.np-btn-o:focus-visible{outline:2px solid var(--cyan);outline-offset:3px}
/* SECONDARY on light surfaces — navy steel, same depth system, never competes
   with the one red emergency pill in the view */
.np-btn-n{gap:11px;padding:17px 26px;border:0;font-weight:800;letter-spacing:-.01em;color:#fff;background:linear-gradient(180deg,#22406a 0%,#152b47 46%,#0c1a2e 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),inset 0 -1px 0 rgba(0,0,0,.35),0 0 0 1px rgba(23,198,255,.22),0 14px 30px -18px rgba(12,26,46,.85)}
.np-btn-n:hover{transform:translateY(-3px);filter:brightness(1.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.34),0 0 0 1px rgba(23,198,255,.7),0 0 30px rgba(23,198,255,.26),0 24px 46px -18px rgba(12,26,46,.92)}
.np-btn-n:active{transform:scale(.98)}
.np-btn-n:focus-visible{outline:2px solid var(--cyan);outline-offset:3px}

/* ══ THE QUOTE BUTTON — its own species. Not red (red is the phone), not navy
   (navy is secondary): a machined object with a living metal edge. One per view. ══ */
@property --np-a{syntax:"<angle>";inherits:false;initial-value:0deg}
@keyframes np-edge{to{--np-a:360deg}}
.np-btn-q{position:relative;isolation:isolate;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
 border:0;border-radius:999px;padding:15px 30px;cursor:pointer;font-family:inherit;color:#fff;text-decoration:none;text-align:center;
 background:linear-gradient(180deg,#17324f 0%,#0a1a2d 48%,#03080f 100%);
 box-shadow:inset 0 1px 0 rgba(255,255,255,.26),inset 0 -1px 0 rgba(0,0,0,.65),0 12px 26px -14px rgba(3,8,15,.9),0 28px 54px -26px rgba(3,8,15,.95);
 transition:transform .24s cubic-bezier(.2,.7,.3,1),box-shadow .34s,filter .24s}
/* the travelling edge: a conic gradient masked down to a 1.5px ring */
.np-btn-q::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.5px;pointer-events:none;
 background:conic-gradient(from var(--np-a,0deg),rgba(23,198,255,.16),var(--cyan) 11%,#eaf8ff 22%,var(--cyan) 34%,rgba(23,198,255,.14) 52%,rgba(23,198,255,.55) 76%,rgba(23,198,255,.16) 100%);
 -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;
 mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;
 animation:np-edge 6s linear infinite}
/* top reflection — the button reads as a lit machined surface */
.np-btn-q::after{content:"";position:absolute;left:7%;right:7%;top:2px;height:44%;border-radius:999px;pointer-events:none;z-index:0;
 background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,.04) 58%,transparent)}
.np-btn-q:hover{transform:translateY(-3px);
 box-shadow:inset 0 1px 0 rgba(255,255,255,.34),inset 0 -1px 0 rgba(0,0,0,.65),0 0 36px rgba(23,198,255,.34),0 16px 30px -14px rgba(3,8,15,.9),0 30px 58px -26px rgba(3,8,15,.95)}
.np-btn-q:hover::before{animation-duration:3.2s}
.np-btn-q:active{transform:scale(.98)}
.np-btn-q:focus-visible{outline:2px solid var(--cyan);outline-offset:3px}
.np-q-lab{position:relative;z-index:1;display:inline-flex;align-items:center;gap:11px;font-weight:800;font-size:17px;letter-spacing:-.012em}
.np-qarrow{display:inline-flex;transition:transform .28s cubic-bezier(.2,.7,.3,1)}
.np-btn-q:hover .np-qarrow{transform:translateX(5px)}
.np-q-sub{position:relative;z-index:1;font-size:10.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:rgba(214,233,250,.55)}
.np-btn-q.sm{padding:13px 22px;gap:3px}
.np-btn-q.sm .np-q-lab{font-size:15.5px;gap:9px}
.np-btn-q.sm .np-q-sub{font-size:9.5px;letter-spacing:.12em}
/* the three steps that follow the quote button */
.np-step{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:start}
.np-stepn{grid-row:span 2;width:22px;height:22px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;
 font-size:11px;font-weight:800;color:var(--navy);background:rgba(23,198,255,.16);box-shadow:inset 0 0 0 1px rgba(23,198,255,.4)}
/* nav pills — same family, light surface */
.np-navp{box-shadow:inset 0 1px 0 rgba(255,255,255,.85);transition:transform .24s cubic-bezier(.2,.7,.3,1),box-shadow .3s,border-color .3s,color .3s}
.np-navp:hover{transform:translateY(-2px);border-color:rgba(23,198,255,.65);color:var(--navy)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 3px rgba(23,198,255,.1),0 10px 20px -12px rgba(12,26,46,.55)}
.np-navp:active{transform:scale(.98)}
.np-navp:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}

/* ── CREDENTIAL STRIP — one tidy line at 1200px+, balanced rows below ── */
.np-creds{border-top:1px solid rgba(255,255,255,.1)}
.np-credrow{display:grid;grid-template-columns:repeat(2,minmax(0,auto));justify-content:center;align-items:center;gap:14px 30px}
.np-credrow>:first-child{grid-column:1/-1;justify-self:center}
.np-cred{display:inline-flex;align-items:center;gap:9px;white-space:nowrap;color:#d3dfec;font-size:11px;letter-spacing:.17em}
.np-cred svg{color:var(--cyan);flex:none}
@media(max-width:479px){.np-credrow{grid-template-columns:minmax(0,auto)}}
@media(min-width:1200px){.np-credrow{grid-template-columns:repeat(5,auto);justify-content:space-between;gap:0 18px}.np-credrow>:first-child{grid-column:auto;justify-self:start}}

/* THE DISPATCH TICKET — punched notches + perforation, generous radius */
/* MATERIAL REALISM — light comes from above-right on every panel of this page:
   a soft top reflection sweeping down, a lit top rim, a dark bottom rim, and two
   layered shadows (contact + cast). Panels read as objects with thickness. */
.np-tk{position:relative;background:#fff;border:1px solid var(--line);border-radius:28px;overflow:hidden;
 box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(12,26,46,.07),0 1px 2px rgba(12,26,46,.05),0 10px 20px -16px rgba(12,26,46,.35),0 30px 58px -38px rgba(12,26,46,.55);
 transition:transform .34s cubic-bezier(.2,.7,.3,1),box-shadow .34s,border-color .34s}
.np-tk::before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;border-radius:inherit;
 mix-blend-mode:screen;background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.015) 16%,transparent 38%),radial-gradient(120% 70% at 84% -14%,rgba(255,255,255,.07),transparent 56%)}
.np-tk:hover{transform:translateY(-6px);border-color:rgba(12,26,46,.2);
 box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 rgba(12,26,46,.08),0 2px 4px rgba(12,26,46,.06),0 16px 28px -18px rgba(12,26,46,.4),0 46px 80px -36px rgba(12,26,46,.6)}
/* dark glass variant — same light, tuned for the navy panels */
.np-glass{box-shadow:inset 0 1px 0 rgba(255,255,255,.14),inset 0 -1px 0 rgba(0,0,0,.4),0 12px 26px -18px rgba(0,0,0,.8),0 40px 80px -40px rgba(0,0,0,.95)}
.np-glass::before{background:linear-gradient(180deg,rgba(255,255,255,.085),rgba(255,255,255,.02) 17%,transparent 40%),radial-gradient(120% 70% at 84% -12%,rgba(23,198,255,.10),transparent 56%)}
.np-glass:hover{transform:none;border-color:rgba(255,255,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 -1px 0 rgba(0,0,0,.42),0 12px 26px -18px rgba(0,0,0,.8),0 46px 90px -40px rgba(0,0,0,.95)}
.np-tk::after{content:"";position:absolute;inset:0;pointer-events:none;
 background:linear-gradient(104deg,transparent 38%,rgba(23,198,255,.13) 50%,transparent 62%);
 transform:translateX(-125%);transition:transform .9s ease}
.np-tk:hover::after{transform:translateX(125%)}
.np-notch{position:absolute;width:24px;height:24px;border-radius:999px;background:var(--stage);
 border:1px solid var(--line);z-index:2}
.np-notch-l{left:-13px}.np-notch-r{right:-13px}
.np-perf{border-top:1.5px dashed rgba(12,26,46,.2)}
.np-perf-d{border-top:1.5px dashed rgba(255,255,255,.24)}
.np-tk-head{background:var(--paper);border-bottom:1px solid var(--line)}

/* dark dispatch-desk surface */
.np-dark{position:relative;background-color:#08111e;background-image:
 radial-gradient(1200px 640px at 78% -12%,rgba(23,198,255,.14),transparent 60%),
 radial-gradient(900px 520px at 4% 12%,rgba(217,42,40,.13),transparent 58%)}
.np-grain::before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;opacity:.4;mix-blend-mode:soft-light;
 background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)'/%3E%3C/svg%3E")}
.np-grain-s::before{opacity:.24}
/* the thin navy band is a real surface too: lit from above-right, never a flat fill */
.np-band{position:relative;background-color:var(--navy);background-image:radial-gradient(900px 260px at 84% -60%,rgba(23,198,255,.13),transparent 62%),radial-gradient(700px 240px at 6% 140%,rgba(217,42,40,.09),transparent 60%);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),inset 0 -1px 0 rgba(0,0,0,.5)}

.np-live{width:9px;height:9px;border-radius:999px;background:#39d98a;box-shadow:0 0 0 0 rgba(57,217,138,.6);animation:npPulse 2.4s ease-out infinite}
@keyframes npPulse{70%{box-shadow:0 0 0 9px rgba(57,217,138,0)}100%{box-shadow:0 0 0 0 rgba(57,217,138,0)}}
.np-frame{position:relative;border-radius:32px;overflow:hidden;border:1px solid var(--line);box-shadow:0 14px 30px -22px rgba(0,0,0,.7),0 44px 90px -44px rgba(0,0,0,.85)}
.np-frame::after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;border-radius:inherit;
 box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -1px 0 rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.05);background:linear-gradient(180deg,rgba(255,255,255,.10),transparent 20%),radial-gradient(120% 60% at 86% -10%,rgba(255,255,255,.12),transparent 55%);mix-blend-mode:screen}
/* ── THE CREW SLIDESHOW ── */
.np-show{aspect-ratio:16/11;background:#0a1524}
@media(min-width:1024px){.np-show{aspect-ratio:41/50}}
.np-slide{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transform:scale(1.035);transition:opacity 1.05s ease,transform 7s linear}
.np-slide.np-on{opacity:1;transform:scale(1)}
.np-shade{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,rgba(6,14,25,.36),transparent 24%,transparent 44%,rgba(6,14,25,.82))}
.np-cap{position:absolute;z-index:3;left:16px;bottom:16px;max-width:calc(100% - 130px);display:inline-flex;align-items:center;font-size:10px;letter-spacing:.15em;color:#eaf3fb;padding:8px 13px;border-radius:999px;border:1px solid rgba(255,255,255,.24);background:rgba(9,18,32,.62);backdrop-filter:blur(9px);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 10px 22px -14px rgba(0,0,0,.9)}
.np-dots{position:absolute;z-index:3;right:16px;bottom:22px;display:flex;gap:6px}
.np-dot{width:16px;height:5px;padding:0;border:0;border-radius:999px;cursor:pointer;background:rgba(255,255,255,.34);box-shadow:inset 0 1px 0 rgba(255,255,255,.4);transition:width .4s cubic-bezier(.2,.7,.3,1),background .4s,box-shadow .4s}
.np-dot:hover{background:rgba(255,255,255,.62)}
.np-dot.np-on{width:32px;background:var(--cyan);box-shadow:0 0 14px rgba(23,198,255,.65)}
.np-dot:focus-visible{outline:2px solid var(--cyan);outline-offset:3px}
.np-rev{opacity:0;transform:translateY(18px);transition:opacity .7s ease,transform .7s cubic-bezier(.2,.7,.3,1)}
.np-rev.np-in{opacity:1;transform:none}
.np-in-d1{transition-delay:.07s}.np-in-d2{transition-delay:.14s}.np-in-d3{transition-delay:.21s}
.np-field{width:100%;background:#fff;border:1px solid var(--line);border-radius:999px;padding:14px 18px;font-size:15.5px;color:var(--ink);outline:none;transition:border-color .2s,box-shadow .2s,background .2s;font-family:inherit;box-shadow:inset 0 2px 4px rgba(12,26,46,.06),inset 0 -1px 0 rgba(255,255,255,.9)}
textarea.np-field{border-radius:22px;resize:vertical}
.np-field:focus{border-color:var(--cyan);box-shadow:inset 0 2px 4px rgba(12,26,46,.05),0 0 0 3px rgba(23,198,255,.18)}
.np-field.np-field-d{box-shadow:inset 0 2px 5px rgba(0,0,0,.3),inset 0 -1px 0 rgba(255,255,255,.08)}
.np-field.np-field-d:focus{box-shadow:inset 0 2px 5px rgba(0,0,0,.28),0 0 0 3px rgba(23,198,255,.22)}
/* FAQ — native details/summary dressed as a rounded ticket row */
.np-q{list-style:none;cursor:pointer;display:flex;align-items:flex-start;gap:16px;padding:20px 22px}
.np-q::-webkit-details-marker{display:none}
.np-q:focus-visible{outline:2px solid var(--cyan);outline-offset:-3px;border-radius:24px}
.np-qi{flex:none;width:32px;height:32px;border-radius:999px;display:grid;place-items:center;background:rgba(23,198,255,.13);color:var(--cyan-d);box-shadow:inset 0 1px 0 rgba(255,255,255,.8),inset 0 -1px 0 rgba(12,26,46,.06);transition:transform .3s cubic-bezier(.2,.7,.3,1),background .25s,color .25s}
.np-fq[open] .np-qi{transform:rotate(45deg);background:var(--navy);color:var(--cyan)}
.np-fq{transition:border-color .3s,box-shadow .3s}
.np-fq[open]{border-color:rgba(12,26,46,.22)}
.np-fq:hover{border-color:rgba(12,26,46,.2)}
.np-faqs{display:grid;gap:14px}
@media(min-width:1024px){.np-faqs{display:block;columns:2;column-gap:14px}
 .np-faqs>details{break-inside:avoid;margin-bottom:14px}}

/* sticky mobile call bar — sits UNDER the floating AI widget (z-40) */
.np-callbar{position:fixed;left:0;right:0;bottom:0;z-index:30;pointer-events:none;
 padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));
 background:linear-gradient(180deg,rgba(245,247,250,0),rgba(245,247,250,.94) 42%);backdrop-filter:blur(10px);
 transform:translateY(130%);transition:transform .38s cubic-bezier(.2,.7,.3,1)}
.np-callbar.np-show{transform:none;pointer-events:auto}

.np-err{border-color:rgba(217,42,40,.55)!important;box-shadow:0 0 0 3px rgba(217,42,40,.13)!important}
@media(prefers-reduced-motion:reduce){.np-rev{opacity:1;transform:none;transition:none}
 .np-tk,.np-btn,.np-btn-o,.np-btn-n,.np-live,.np-slide,.np-dot,.np-callbar,.np-qi,.np-panel,.np-mg path,.np-mg text{transition:none;animation:none}
 .np-btn::before,.np-btn-o::before,.np-btn-n::before{display:none}
 .np-tk::after{display:none}}
`;

/* ── ONLINE PRESENCE: head tags + structured data, all cleaned up on unmount ── */
const META = [
  ["name", "description", "24/7 emergency plumbing in NYC since 1992 — drain & sewer, water main, fire suppression and Local Law 152 compliance across Manhattan, Brooklyn, Queens, the Bronx and Staten Island. Master Plumber licensed, fully insured. Dispatch (212) 567-2000."],
  ["name", "robots", "index,follow,max-image-preview:large"],
  ["property", "og:type", "website"],
  ["property", "og:site_name", "Nonstop Plumbers NY"],
  ["property", "og:title", "Nonstop Plumbers NY — 24/7 Emergency Plumbing Across NYC"],
  ["property", "og:description", "Licensed 24/7/365 emergency plumbing, drain & sewer, fire suppression and NYC compliance in all five boroughs. Dispatch (212) 567-2000."],
  ["property", "og:image", SITE_ORIGIN + A + "hero-poster.webp"],
  ["property", "og:url", SITE],
  ["name", "twitter:card", "summary_large_image"],
  ["name", "twitter:title", "Nonstop Plumbers NY — 24/7 Emergency Plumbing Across NYC"],
  ["name", "twitter:image", SITE_ORIGIN + A + "hero-poster.webp"],
  ["name", "twitter:description", "Emergency plumbing, drain & sewer, fire suppression and NYC compliance. Five boroughs, 24/7/365."],
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = [{ "@type": "OpeningHoursSpecification", dayOfWeek: DAYS, opens: "00:00", closes: "23:59" }];
const addr = (street, loc, zip) => ({
  "@type": "PostalAddress", streetAddress: street, addressLocality: loc,
  addressRegion: "NY", postalCode: zip, addressCountry: "US",
});

const LD = () => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["Plumber", "LocalBusiness"],
      "@id": SITE + "#business",
      name: "Nonstop Plumbers NY",
      legalName: "Nonstop Plumbers CORP",
      description: "Licensed 24/7 emergency plumbing, drain and sewer, water main, fire suppression and NYC compliance service across the five boroughs since 1992.",
      url: SITE,
      telephone: "+1-212-567-2000",
      foundingDate: "1992",
      image: SITE_ORIGIN + A + "hero-poster.webp",
      logo: SITE_ORIGIN + A + "logo-hi.webp",
      address: addr("30 Wall St 8th Floor", "New York", "10005"),
      areaServed: ["Manhattan", "Brooklyn", "Queens", "The Bronx", "Staten Island"].map((n) => ({
        "@type": "AdministrativeArea", name: n,
      })),
      openingHoursSpecification: HOURS,
      sameAs: [IG, FB],
      department: OFFICES.map((o) => ({
        "@type": ["Plumber", "LocalBusiness"],
        name: o.n,
        telephone: "+1-" + o.ph.replace(/[^0-9]/g, "").replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3"),
        address: addr(o.a1, o.loc, o.zip),
        openingHoursSpecification: HOURS,
      })),
    },
    {
      "@type": "FAQPage",
      "@id": SITE + "#faq",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question", name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@type": "BreadcrumbList",
      "@id": SITE + "#breadcrumb",
      itemListElement: [["Home", ""], ["Services", "#services"], ["FAQ", "#faq"]].map(([n, h], i) => ({
        "@type": "ListItem", position: i + 1, name: n, item: SITE + h,
      })),
    },
  ],
});

/* ── THE CREW SLIDESHOW — their own photos, soft cross-fade, pause on hover/focus,
   still on the first frame when the visitor asked for reduced motion. ── */
function CrewShow({ still }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (still || hold) return;
    const t = setInterval(() => setI((p) => (p + 1) % PHOTOS.length), 4500);
    return () => clearInterval(t);
  }, [still, hold]);
  const pause = () => setHold(true), play = () => setHold(false);
  return (
    <div className="np-frame np-show" onMouseEnter={pause} onMouseLeave={play}
      onFocus={pause} onBlur={play}>
      {PHOTOS.map((p, n) => (
        <img key={p.s} src={A + p.s} alt={p.c} className={`np-slide ${n === i ? "np-on" : ""}`}
          width="1200" height="1500" decoding="async" aria-hidden={n !== i}
          loading={n ? "lazy" : "eager"} fetchPriority={n ? undefined : "high"} />
      ))}
      <span className="np-shade" aria-hidden="true" />
      <p className="np-cap np-lab" aria-live="polite">{PHOTOS[i].c}</p>
      <div className="np-dots">
        {PHOTOS.map((p, n) => (
          <button key={p.s} type="button" className={`np-dot ${n === i ? "np-on" : ""}`}
            aria-current={n === i} onClick={() => setI(n)}
            aria-label={`Show photo ${n + 1} of ${PHOTOS.length} — ${p.c}`} />
        ))}
      </div>
    </div>
  );
}

export default function NonstopPlumbers() {
  const root = useRef(null);
  const [sent, setSent] = useState(false);
  // Clicar num borough do quadro leva pro formulário JÁ preenchido — o quadro
  // trabalha, não decora (Luis: "esse botão on call com cara de ai").
  const [boro, setBoro] = useState("");
  // O quadro dos boroughs: um aberto por vez, e o mapa acende o que você está lendo.
  // ?boro=BK (ou ?boro=brooklyn) já abre o ticket daquele bairro: um anúncio do
  // Brooklyn cai direto no pedido do Brooklyn, sem procurar nada na página.
  const [openB, setOpenB] = useState(() => {
    try {
      const q = (new URLSearchParams(window.location.search).get("boro") || "").trim().toLowerCase();
      if (!q) return "";
      const hit = BOROUGHS.find((b) => b.c.toLowerCase() === q || b.b.toLowerCase() === q || b.b.toLowerCase().startsWith(q));
      return hit ? hit.c : "";
    } catch { return ""; }
  });
  const [hovB, setHovB] = useState("");
  const [bsent, setBsent] = useState("");
  const lit = hovB || openB;
  const toggleB = (c) => { setBsent(""); setOpenB((p) => (p === c ? "" : c)); };
  const [still, setStill] = useState(false);
  const [clock, setClock] = useState(nyTime);
  const [bar, setBar] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [err, setErr] = useState("");

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(m.matches);
    const on = (e) => setStill(e.matches);
    m.addEventListener?.("change", on);

    const tick = setInterval(() => setClock(nyTime()), 20000);

    const onScroll = () => setBar(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // ── ONLINE PRESENCE: title, meta, canonical, JSON-LD (all removed on unmount) ──
    const prevTitle = document.title;
    document.title = "Nonstop Plumbers NY — 24/7 Emergency Plumbing, Drain & Sewer Across NYC";
    // O site tem SEO global no index.html: SOBRESCREVE a tag existente e devolve
    // o valor original ao desmontar — senão a página fica com duas descrições.
    const seo = [], restore = [];
    META.forEach(([k, v, c]) => {
      const found = document.head.querySelector(`meta[${k}="${v}"]`);
      if (found) { restore.push([found, found.getAttribute("content")]); found.setAttribute("content", c); return; }
      const el = document.createElement("meta");
      el.setAttribute(k, v); el.setAttribute("content", c); el.setAttribute("data-np-seo", "1");
      document.head.appendChild(el); seo.push(el);
    });
    const oldCanon = document.head.querySelector("link[rel=canonical]");
    if (oldCanon) { restore.push([oldCanon, oldCanon.getAttribute("href"), "href"]); oldCanon.setAttribute("href", SITE); }
    else {
      const canon = document.createElement("link");
      canon.rel = "canonical"; canon.href = SITE;
      document.head.appendChild(canon); seo.push(canon);
    }
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify(LD());
    document.head.appendChild(ld); seo.push(ld);

    const links = [
      Object.assign(document.createElement("link"), { rel: "preconnect", href: "https://fonts.googleapis.com" }),
      Object.assign(document.createElement("link"), { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" }),
      Object.assign(document.createElement("link"), {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,500..900&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap",
      }),
    ];
    links.forEach((l) => document.head.appendChild(l));

    const els = root.current ? Array.from(root.current.querySelectorAll(".np-rev")) : [];
    const show = () => els.forEach((el) => el.classList.add("np-in"));
    let io;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (ents) => ents.forEach((e) => e.isIntersecting && (e.target.classList.add("np-in"), io.unobserve(e.target))),
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
      );
      els.forEach((el) => io.observe(el));
    }
    const failOpen = setTimeout(show, 1400); // MANDATORY fail-open

    return () => {
      clearTimeout(failOpen); clearInterval(tick); io?.disconnect();
      m.removeEventListener?.("change", on);
      window.removeEventListener("scroll", onScroll);
      document.title = prevTitle;
      seo.forEach((el) => el.remove());
      restore.forEach(([el, val, at = "content"]) => (val === null ? el.removeAttribute(at) : el.setAttribute(at, val)));
      links.forEach((l) => l.remove());
    };
  }, []);

  // Um único selo VIVO no site inteiro: diz a hora de NY agora, não repete
  // "on call" cinco vezes como enfeite. (Luis: "esse botão on call com cara de ai".)
  const DeskOpen = ({ dark }) => (
    <span className={`np-pill np-lab ${dark ? "np-pill-d" : ""}`} style={dark ? undefined : { background: "rgba(57,217,138,.1)", borderColor: "rgba(20,140,90,.28)", color: "#13603f" }}>
      <span className="np-live" /> Desk open
      <span className="mono ml-1.5" style={{ fontSize: 10.5, letterSpacing: ".06em", opacity: .85 }}>{clock} NYC</span>
    </span>
  );

  return (
    <div className="np" ref={root}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── HEADER — pill nav, pill CTA ───────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md">
        <div className="np-w flex items-center justify-between gap-4 h-[78px]">
          <a href="#top" className="flex items-center shrink-0">
            <img src={`${A}logo-hi.webp`} alt="Nonstop Plumbers NY" className="h-11 w-auto" width="220" height="44" />
          </a>
          <nav className="hidden lg:flex items-center gap-1.5 np-lab">
            {[["#services", "Services"], ["#crew", "Boroughs"], ["#plans", "Service plans"], ["#about", "About"], ["#faq", "FAQ"], ["#contact", "Contact"]].map(([h, t]) => (
              <a key={h} href={h} className="np-pill np-navp"
                style={{ color: "var(--mut)", background: "var(--paper)" }}>{t}</a>
            ))}
          </nav>
          <a href={TEL} className="np-btn-n !py-3.5 !px-5 text-sm">
            <Ic d={I.phone} s={18} />
            <span className="hidden sm:inline">{PHONE}</span>
            <span className="sm:hidden">Call 24/7</span>
          </a>
        </div>
        <div className="np-stripe" />
      </header>

      {/* ── HERO — THEIR video + dispatch pill + live NYC clock ── */}
      <section id="top" className="relative isolate np-dark np-grain overflow-hidden">
        <div className="absolute inset-0 z-0">
          {still ? (
            <img src={`${A}hero-poster.webp`} alt="Nonstop Plumbers technicians on a New York job site"
              className="w-full h-full object-cover" width="1920" height="1080" decoding="async" />
          ) : (
            <video className="w-full h-full object-cover" style={{ filter: "contrast(1.07) saturate(1.06) brightness(1.05)" }} autoPlay muted loop playsInline preload="metadata"
              poster={`${A}hero-poster.webp`} aria-hidden="true">
              <source src={`${A}hero-web.mp4`} type="video/mp4" />
            </video>
          )}
        </div>
        <div className="absolute inset-0 z-[1]" style={{
          background:
            "linear-gradient(180deg,rgba(6,14,25,.84) 0%,rgba(6,14,25,.55) 34%,rgba(6,14,25,.74) 74%,rgba(6,14,25,.96) 100%)," +
            "linear-gradient(90deg,rgba(6,14,25,.82) 0%,rgba(6,14,25,.26) 62%,rgba(6,14,25,.10) 100%)",
        }} />
        <div className="relative z-10 np-w pt-10 pb-14 sm:pt-14 sm:pb-18 lg:pt-16 lg:pb-20">
          {/* announcement pill — real, dated, live */}
          <div className="np-rev flex flex-wrap items-center gap-2.5">
            <span className="np-pill np-lab" style={{ background: "var(--red)", borderColor: "transparent", color: "#fff" }}>
              Dispatch desk
            </span>
            <span className="np-pill np-pill-d np-lab">
              <span className="np-live" />
              Open right now — <span className="mono ml-1" style={{ color: "var(--cyan)", letterSpacing: ".06em" }}>{clock}</span>
              <span className="ml-1">in NYC</span>
            </span>
          </div>

          <div className="max-w-3xl">
            <h1 className="np-rev np-in-d1 mt-7 text-white text-[42px] sm:text-[56px] lg:text-[72px]">
              When it can&rsquo;t wait,<br />we don&rsquo;t <span style={{ color: "var(--red)" }}>stop.</span>
            </h1>
            <p className="np-rev np-in-d2 mt-5 text-[16px] sm:text-[17.5px] leading-relaxed max-w-xl" style={{ color: "#cdd8e6" }}>
              Emergency plumbing, drain &amp; sewer, fire suppression and NYC compliance —
              Master Plumber and Master Fire Suppression licensed, fully insured, across
              Manhattan, Brooklyn, Queens, the Bronx and Staten Island. 24/7/365.
            </p>

            <div className="np-rev np-in-d3 mt-8">
              <div className="np-lab mb-4 max-w-md leading-relaxed" style={{ color: "#a9bbcf" }}>
                Emergency dispatch — answered 24/7 by AI, dispatched in minutes
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a href={TEL} className="np-btn dsp text-2xl sm:text-[28px] !py-5 !px-8">
                  <Ic d={I.phone} s={26} /> {PHONE}
                </a>
                <a href="#services" className="np-btn-o">
                  See what we dispatch <Ic d={I.arrow} s={18} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CREDENTIAL STATUS PILLS BAND ─────────────────────── */}
      <section className="np-creds np-band np-grain np-grain-s">
        <div className="np-w py-5 relative z-[3]">
          <div className="np-credrow">
            <DeskOpen dark />
            {CREDS.map((c) => (
              <span key={c.t} className="np-cred np-lab"><Ic d={c.ic} s={15} />{c.t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES — dispatch tickets ──────────────────────── */}
      <section id="services" style={{ background: "var(--paper)", "--stage": "var(--paper)" }} className="py-20 sm:py-28">
        <div className="np-w">
          <div className="np-rev max-w-2xl">
            <div className="np-lab flex items-center gap-3" style={{ color: "var(--red-d)" }}>
              <span className="np-stripe np-stripe-r w-10 shrink-0" style={{ height: 6 }} />
              The board
            </div>
            <h2 className="mt-5 text-4xl sm:text-5xl">Every ticket we take.</h2>
            <p className="mt-4 text-[17.5px] leading-relaxed" style={{ color: "var(--mut)" }}>
              One licensed crew takes the emergency at 3 AM and the compliance inspection on the calendar.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s, i) => (
              <article key={s.t} className={`np-tk np-rev ${["", "np-in-d1", "np-in-d2", "np-in-d3"][i % 4]} flex flex-col`}>
                <div className="np-tk-head px-5 py-3 flex items-center justify-between gap-2">
                  <span className="mono text-[11px]" style={{ color: "var(--mut)", letterSpacing: ".08em" }}>{s.wo}</span>
                  <span className="np-lab text-[10px] px-2.5 py-1 rounded-full" style={tagStyle(s.tag)}>{s.tag}</span>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-full"
                    style={{ background: "var(--navy)", color: "var(--cyan)" }}><Ic d={s.ic} s={21} /></span>
                  <h3 className="mt-5 text-[21px]" style={{ color: "var(--navy)" }}>{s.t}</h3>
                  <div className="np-notch np-notch-l" style={{ top: "calc(50% + 18px)" }} />
                  <div className="np-notch np-notch-r" style={{ top: "calc(50% + 18px)" }} />
                  <ul className="np-perf mt-5 pt-5 space-y-2.5 text-[15px]" style={{ color: "var(--mut)" }}>
                    {s.d.map((x) => (
                      <li key={x} className="flex gap-2.5">
                        <span className="mt-[8px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--dot)" }} />
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO SHOWS UP — crew photo + borough dispatch board ── */}
      <section id="crew" className="relative np-dark np-grain py-20 sm:py-28" style={{ "--stage": "#0d1a2b" }}>
        <div className="np-w relative z-[3]">
          {/* the headline spans the top so both columns below start on the same edge */}
          <div className="np-rev max-w-3xl">
            <div className="np-lab flex items-center gap-3" style={{ color: "var(--cyan)" }}>
              <span className="np-stripe np-stripe-r w-10 shrink-0" style={{ height: 6 }} />
              Who shows up
            </div>
            <h2 className="mt-5 text-4xl sm:text-[46px] text-white">
              A licensed crew and a marked van, in your building today.
            </h2>
            <p className="mt-4 text-[17.5px] max-w-2xl" style={{ color: "#c2d0e0", lineHeight: 1.64 }}>
              The call is answered 24/7 and dispatched in minutes — then real people arrive:
              Master Plumber and Master Fire Suppression licensed, fully insured, working in
              New York buildings every day of the year.
            </p>
          </div>

          <div className="mt-11 grid gap-8 lg:gap-10 lg:grid-cols-[.86fr_1.14fr] lg:items-start">
            {/* their own job photos, passing */}
            <div className="np-rev lg:sticky lg:top-[104px]">
              <CrewShow still={still} />
              <p className="np-lab mt-4 text-[10px]" style={{ color: "#8ea2b8" }}>
                Real jobs · real crews · five boroughs
              </p>
            </div>

            {/* THE BOROUGH BOARD — hand-drawn map + tickets that open in place */}
            <div className="np-tk np-glass np-rev np-in-d1" style={{ background: "rgba(255,255,255,.05)", borderColor: "rgba(255,255,255,.16)" }}>
              <div className="px-5 py-3.5 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,.14)" }}>
                <span className="np-lab flex items-center gap-2" style={{ color: "#a9bbcf" }}>
                  <span className="np-live" /> Dispatch desk open
                </span>
                <span className="mono text-[11px]" style={{ color: "var(--cyan)", letterSpacing: ".08em" }}>NYC {clock}</span>
              </div>

              {/* the map: it lights the borough you are hovering or reading */}
              <div className="px-5 pt-6 pb-2">
                <svg className="np-map" viewBox="0 0 400 360" role="img" aria-label="Stylized map of the five New York City boroughs">
                  {MAP.map((m) => (
                    <g key={m.c} className={`np-mg ${lit === m.c ? "np-on" : ""}`} onClick={() => toggleB(m.c)}
                      onMouseEnter={() => setHovB(m.c)} onMouseLeave={() => setHovB("")}>
                      <path d={m.p} />
                      <text x={m.x} y={m.y} textAnchor="middle">{m.c}</text>
                    </g>
                  ))}
                </svg>
                <div className="np-mapcap np-lab mt-3 text-[10px]">Five boroughs · one dispatch desk</div>
              </div>

              <div className="p-2 sm:p-3" style={{ borderTop: "1px solid rgba(255,255,255,.09)" }}>
                {BOROUGHS.map((b) => {
                  const on = openB === b.c;
                  return (
                    <div key={b.b} className="np-brow" onMouseEnter={() => setHovB(b.c)} onMouseLeave={() => setHovB("")}>
                      <button type="button" className="np-boro" id={`np-b-${b.c}`} aria-expanded={on}
                        aria-controls={`np-p-${b.c}`} onClick={() => toggleB(b.c)}>
                        <span className="np-led" aria-hidden="true" />
                        <span className="np-bc mono np-lab" aria-hidden="true">{b.c}</span>
                        <span className="min-w-0 flex-1">
                          <span className="np-bn">{b.b}</span>
                          <span className="np-bd">{b.d}</span>
                        </span>
                        <span className="np-boro-go np-lab">
                          <span>{on ? "Close" : "Open a ticket"}</span><Ic d={I.plus} s={15} />
                        </span>
                      </button>

                      {on && (
                        <div className="np-panel px-4 sm:px-5 pb-5" id={`np-p-${b.c}`} role="region" aria-labelledby={`np-b-${b.c}`}>
                          <div className="np-perf-d pt-5">
                            <div className="np-lab" style={{ color: "var(--cyan)" }}>New ticket · {b.b}</div>
                            <form className="mt-4 grid gap-2.5" noValidate
                              onSubmit={(e) => { e.preventDefault(); setBsent(b.c); }}>
                              <input className="np-field np-field-d" placeholder="What's going on?" aria-label={`What's going on in ${b.b}`} />
                              <div className="grid sm:grid-cols-2 gap-2.5">
                                <input className="np-field np-field-d" placeholder="Address" aria-label="Address" />
                                <input className="np-field np-field-d" type="tel" placeholder="Phone" aria-label="Phone" />
                              </div>
                              <button type="submit" className="np-btn w-full !py-4 mt-1">
                                Open the ticket <Ic d={I.arrow} s={18} />
                              </button>
                            </form>
                            {bsent === b.c && (
                              <p className="mt-3.5 text-[13px] leading-relaxed px-4 py-3 rounded-2xl" role="status" style={{ background: "rgba(23,198,255,.1)", border: "1px solid rgba(23,198,255,.35)", color: "#e6f0fa" }}>
                                This is a demonstration rebuild — on the live site this reaches dispatch in seconds.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICE PLANS — two tickets + boiler photo ───────── */}
      <section id="plans" className="py-20 sm:py-28" style={{ background: "#fff", "--stage": "#fff" }}>
        <div className="np-w">
          <div className="np-rev max-w-2xl">
            <div className="np-lab flex items-center gap-3" style={{ color: "var(--red-d)" }}>
              <span className="np-stripe np-stripe-r w-10 shrink-0" style={{ height: 6 }} />
              Standing orders
            </div>
            <h2 className="mt-5 text-4xl sm:text-5xl">Before it becomes an emergency.</h2>
            <p className="mt-4 text-[17.5px] leading-relaxed" style={{ color: "var(--mut)" }}>
              Two ways to keep us on your building&rsquo;s board all year — for property managers and for homes.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1fr_.86fr] items-stretch">
            {PLANS.map((p, i) => (
              <article key={p.t} className={`np-tk np-rev ${i ? "np-in-d1" : ""} flex flex-col`}>
                <div className="np-tk-head px-6 py-3.5 flex items-center justify-between gap-2">
                  <span className="mono text-[11px]" style={{ color: "var(--mut)", letterSpacing: ".08em" }}>{p.wo}</span>
                  <span className="np-lab" style={{ color: "var(--cyan-d)", fontSize: 10 }}>Standing order</span>
                </div>
                <div className="p-7 flex-1 flex flex-col">
                  <h3 className="text-[25px]" style={{ color: "var(--navy)" }}>{p.t}</h3>
                  <p className="mt-2.5 text-[15px]" style={{ color: "var(--mut)" }}>{p.s}</p>
                  <span className="np-pill np-lab mt-4 self-start"
                    style={{ background: "rgba(12,26,46,.05)", borderColor: "rgba(12,26,46,.16)", color: "var(--navy)" }}>
                    {p.from}
                  </span>
                  <div className="np-notch np-notch-l" style={{ top: "calc(50% + 26px)" }} />
                  <div className="np-notch np-notch-r" style={{ top: "calc(50% + 26px)" }} />
                  <ul className="np-perf mt-6 pt-6 space-y-3 text-[15.5px]" style={{ color: "var(--mut)" }}>
                    {p.d.map((x) => (
                      <li key={x} className="flex gap-3">
                        <span className="mt-[9px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--dot)" }} />
                        {x}
                      </li>
                    ))}
                  </ul>
                  <a href="#contact" className="np-btn-n mt-7 w-full !py-4">
                    Request plan details <Ic d={I.arrow} s={18} />
                  </a>
                </div>
              </article>
            ))}
            <div className="np-rev np-in-d2 np-frame min-h-[260px] lg:min-h-0">
              <img src={`${A}boiler-hi.webp`} alt="Nonstop Plumbers technician working in a boiler room"
                className="w-full h-full object-cover" width="900" height="1200" loading="lazy" decoding="async" />
            </div>
          </div>
        </div>
      </section>

      {/* ── ABOUT — their real story + the three real offices ─── */}
      <section id="about" aria-labelledby="about-h" className="py-20 sm:py-28"
        style={{ background: "var(--paper)", "--stage": "var(--paper)" }}>
        <div className="np-w">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
            <div className="np-rev max-w-2xl">
              <div className="np-lab flex items-center gap-3" style={{ color: "var(--red-d)" }}>
                <span className="np-stripe np-stripe-r w-10 shrink-0" style={{ height: 6 }} />
                Since 1992
              </div>
              <h2 id="about-h" className="mt-5 text-4xl sm:text-5xl">
                The crews NYC buildings trust when the work has to be done right.
              </h2>
              <p className="mt-5 text-[17.5px] leading-relaxed" style={{ color: "var(--mut)" }}>
                New York&rsquo;s premier residential and commercial buildings, institutions and private schools
                rely on Nonstop Plumbers CORP for a reason: since 1992 the reputation has been built on
                high-quality, fairly priced service and impeccable attention to detail.
              </p>
              <p className="mt-4 text-[17.5px] leading-relaxed" style={{ color: "var(--mut)" }}>
                We believe in doing a job right the first time, and doing it neatly, without excuses. With over
                60 trained professionals and live plumbers answering the phone, customers get immediate access to
                real help — and with locations in Astoria, Brooklyn and Manhattan, we can always be there fast.
              </p>
              <div className="mt-7 flex flex-wrap gap-2.5">
                <span className="np-pill np-lab"><Ic d={I.shield} s={15} />NYC Master Plumber License #1332</span>
                <span className="np-pill np-lab"><Ic d={I.flame} s={15} />Master Fire Suppression License #543B</span>
                <span className="np-pill np-lab"><Ic d={I.star} s={15} />30+ years · 60+ professionals</span>
              </div>
            </div>

            <div className="np-rev np-in-d1 np-tk">
              <div className="np-tk-head px-6 py-3.5 flex items-center justify-between gap-2">
                <span className="mono text-[11px]" style={{ color: "var(--mut)", letterSpacing: ".08em" }}>WO-STD</span>
                <span className="np-lab" style={{ color: "var(--cyan-d)", fontSize: 10 }}>Our standards</span>
              </div>
              <div className="p-7">
                <h3 className="text-[22px]" style={{ color: "var(--navy)" }}>Done right the first time, and clean when we leave.</h3>
                <p className="mt-2.5 text-[15.5px]" style={{ color: "var(--mut)" }}>
                  Use the right equipment, respect the schedule, communicate clearly, and leave every
                  space in order when the job is done.
                </p>
                <div className="np-notch np-notch-l" style={{ top: 150 }} />
                <div className="np-notch np-notch-r" style={{ top: 150 }} />
                <ul className="np-perf mt-6 pt-6 space-y-4">
                  {STANDARDS.map(([t, d]) => (
                    <li key={t} className="flex gap-3.5">
                      <span className="mt-[3px] flex-none inline-flex items-center justify-center w-7 h-7 rounded-full"
                        style={{ background: "rgba(23,198,255,.12)", color: "var(--navy)" }}><Ic d={I.shield} s={15} /></span>
                      <span>
                        <span className="block font-semibold text-[15px]" style={{ color: "var(--navy)" }}>{t}</span>
                        <span className="block mt-1.5 text-[15px]" style={{ color: "var(--mut)" }}>{d}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* three real offices, one 24-hour response team */}
          <h3 className="np-rev mt-16 text-[26px] sm:text-3xl" style={{ color: "var(--navy)" }}>
            Three NYC offices backing one 24-hour response team.
          </h3>
          <div className="mt-7 grid gap-6 md:grid-cols-3">
            {OFFICES.map((o, i) => (
              <article key={o.c} className={`np-tk np-rev ${["", "np-in-d1", "np-in-d2"][i]} flex flex-col`}>
                <div className="np-tk-head px-6 py-3.5 flex items-center justify-between gap-2">
                  <span className="mono text-[11px]" style={{ color: "var(--mut)", letterSpacing: ".08em" }}>{o.c.toUpperCase()}</span>
                  <span className="np-lab" style={{ fontSize: 10, color: o.tel === TEL ? "var(--red-d)" : "var(--cyan-d)" }}>{o.lab}</span>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-full"
                    style={{ background: "var(--navy)", color: "var(--cyan)" }}><Ic d={I.pin} s={20} /></span>
                  <h4 className="mt-5 text-[19px] font-extrabold tracking-tight" style={{ color: "var(--navy)" }}>{o.n}</h4>
                  <address className="mt-2.5 not-italic text-[15.5px]" style={{ color: "var(--mut)" }}>
                    {o.a1}<br />{o.a2}
                  </address>
                  <div className="np-notch np-notch-l" style={{ top: "calc(100% - 92px)" }} />
                  <div className="np-notch np-notch-r" style={{ top: "calc(100% - 92px)" }} />
                  <div className="np-perf mt-6 pt-5 mt-auto">
                    <a href={o.tel} className="np-btn-n w-full !py-4 text-[17px]">
                      <Ic d={I.phone} s={18} /> {o.ph}
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="np-rev mt-5 text-[14px]" style={{ color: "var(--mut)" }}>
            {PHONE} is the 24-hour emergency dispatch line. {PHONE_OFFICE} is the Manhattan office line at 30 Wall St.
          </p>
        </div>
      </section>

      {/* ── FAQ — their real questions, accessible accordion ──── */}
      <section id="faq" aria-labelledby="faq-h" className="py-20 sm:py-28" style={{ background: "#fff", "--stage": "#fff" }}>
        <div className="np-w">
          <div className="np-rev max-w-2xl">
            <div className="np-lab flex items-center gap-3" style={{ color: "var(--red-d)" }}>
              <span className="np-stripe np-stripe-r w-10 shrink-0" style={{ height: 6 }} />
              Before you call
            </div>
            <h2 id="faq-h" className="mt-5 text-4xl sm:text-5xl">Plumbing questions from NYC owners and managers.</h2>
            <p className="mt-4 text-[17.5px] leading-relaxed" style={{ color: "var(--mut)" }}>
              Direct answers about emergency response, drain and sewer issues, permits, compliance work
              and what to expect before a licensed NYC plumber arrives.
            </p>
          </div>

          <div className="np-faqs mt-11">
            {FAQ.map((f, i) => (
              <details key={f.q} className={`np-tk np-fq np-rev ${["", "np-in-d1", "np-in-d2", "np-in-d3"][i % 4]}`}>
                <summary className="np-q">
                  <span className="np-qi" aria-hidden="true"><Ic d={I.plus} s={16} /></span>
                  <h3 className="flex-1 text-[16.5px] leading-snug font-extrabold tracking-tight pt-[5px]"
                    style={{ color: "var(--navy)" }}>{f.q}</h3>
                </summary>
                <div className="px-[22px] pb-[22px] pl-[70px]">
                  <p className="np-perf pt-4 text-[16.5px]" style={{ color: "var(--mut)", lineHeight: 1.68 }}>{f.a}</p>
                </div>
              </details>
            ))}
          </div>

          <div className="np-rev mt-10 flex flex-col sm:flex-row gap-3 sm:items-center">
            <a href={TEL} className="np-btn"><Ic d={I.phone} s={20} /> Call 24/7 dispatch — {PHONE}</a>
            <span className="text-[15px]" style={{ color: "var(--mut)" }}>
              Not sure it&rsquo;s an emergency? Call anyway — dispatch triages it before you hang up.
            </span>
          </div>
        </div>
      </section>

      {/* ── CONTACT — dispatch line + work-order ticket form ──── */}
      <section id="contact" className="py-20 sm:py-28" style={{ background: "var(--paper)", "--stage": "var(--paper)" }}>
        <div className="np-w grid gap-8 lg:grid-cols-[.95fr_1.05fr] lg:items-start">
          <div className="np-rev">
            <div className="np-lab flex items-center gap-3" style={{ color: "var(--red-d)" }}>
              <span className="np-stripe np-stripe-r w-10 shrink-0" style={{ height: 6 }} />
              Dispatch
            </div>
            <h2 className="mt-5 text-4xl sm:text-5xl">One number, any hour.</h2>
            <p className="mt-4 text-[17.5px] leading-relaxed" style={{ color: "var(--mut)" }}>
              Water where it shouldn&rsquo;t be, no heat, a violation to clear, a sprinkler inspection due —
              the same line takes all of it.
            </p>

            <div className="np-tk np-glass mt-8" style={{ background: "var(--navy)", borderColor: "rgba(255,255,255,.14)" }}>
              <div className="np-stripe" />
              <div className="p-7">
                <div className="np-lab" style={{ color: "#a9bbcf" }}>Emergency dispatch — answered 24/7 by AI, dispatched in minutes</div>
                <a href={TEL} className="dsp mt-4 block text-[40px] sm:text-[52px] leading-none" style={{ color: "#fff" }}>{PHONE}</a>
                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <DeskOpen dark />
                  <span className="np-pill np-pill-d np-lab"><Ic d={I.clock} s={15} />24/7/365</span>
                  <span className="np-pill np-pill-d np-lab"><Ic d={I.pin} s={15} />All five boroughs</span>
                </div>
                <a href={TEL} className="np-btn mt-7 w-full"><Ic d={I.phone} s={20} /> Call the dispatch desk</a>
              </div>
            </div>
          </div>

          <div className="np-rev np-in-d1">
            <form className="np-tk" noValidate onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim() || !form.phone.trim()) {
                setSent(false);
                setErr("We need a name and a phone number to call you back — everything else is optional.");
                return;
              }
              setErr(""); setSent(true);
            }}>
              <div className="np-tk-head px-6 py-3.5 flex items-center justify-between gap-2">
                <span className="mono text-[11px]" style={{ color: "var(--mut)", letterSpacing: ".08em" }}>WO-NEW</span>
                <span className="mono text-[11px]" style={{ color: "var(--mut)", letterSpacing: ".08em" }}>NYC {clock}</span>
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-[25px]" style={{ color: "var(--navy)" }}>Open a work order</h3>
                <p className="mt-2.5 text-[15.5px]" style={{ color: "var(--mut)" }}>
                  Not an emergency? Send the details and dispatch comes back with a time.
                </p>
                <div className="np-notch np-notch-l" style={{ top: 158 }} />
                <div className="np-notch np-notch-r" style={{ top: 158 }} />
                <div className="np-perf mt-6 pt-6 grid gap-3">
                  <input className={`np-field ${err && !form.name.trim() ? "np-err" : ""}`} placeholder="Full name *"
                    aria-label="Full name" aria-required="true" aria-invalid={!!err && !form.name.trim()}
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input className={`np-field ${err && !form.phone.trim() ? "np-err" : ""}`} placeholder="Phone *"
                      aria-label="Phone" type="tel" aria-required="true" aria-invalid={!!err && !form.phone.trim()}
                      value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    <input className="np-field" placeholder="Email" aria-label="Email" type="email" />
                  </div>
                  <input className="np-field" placeholder="Address or borough" aria-label="Address or borough" value={boro} onChange={(e) => setBoro(e.target.value)} />
                  <select className="np-field" aria-label="Service needed" defaultValue="">
                    <option value="" disabled>Service needed</option>
                    {SERVICES.map((s) => <option key={s.t}>{s.t}</option>)}
                  </select>
                  <textarea className="np-field" rows="3" placeholder="What's going on?" aria-label="What's going on?" />
                </div>
                <button type="submit" className="np-btn-n w-full mt-5">Send the work order <Ic d={I.arrow} s={18} /></button>
                <p className="mt-4 flex gap-2.5 text-[14px]" style={{ color: "var(--mut)" }}>
                  <span className="mt-[2px] shrink-0" style={{ color: "var(--cyan-d)" }}><Ic d={I.shield} s={15} /></span>
                  What happens next: dispatch triages what you sent, calls you back, and tells you what to do
                  before a technician arrives. Anything active right now — a leak, a backup, no hot water —
                  should go straight to <a href={TEL} className="font-semibold underline whitespace-nowrap"
                    style={{ color: "var(--navy)" }}>{PHONE}</a> instead.
                </p>
                {err && (
                  <p className="mt-4 text-[13px] leading-relaxed px-4 py-3 rounded-2xl" role="alert"
                    style={{ background: "rgba(217,42,40,.08)", border: "1px solid rgba(217,42,40,.35)", color: "var(--navy)" }}>
                    {err}
                  </p>
                )}
                {sent && (
                  <p className="mt-4 text-[13px] leading-relaxed px-4 py-3 rounded-2xl" role="status"
                    style={{ background: "rgba(23,198,255,.09)", border: "1px solid rgba(23,198,255,.35)", color: "var(--navy)" }}>
                    This is a demonstration rebuild — the form is not connected. For real service, call {PHONE}.
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ── CAREERS — real: they hire licensed NYC plumbers ───── */}
      <section id="careers" aria-labelledby="careers-h" className="relative np-dark np-grain py-16 sm:py-20"
        style={{ "--stage": "#0d1a2b" }}>
        <div className="np-w relative z-[3] grid gap-9 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div className="np-rev">
            <div className="np-lab flex items-center gap-3" style={{ color: "var(--cyan)" }}>
              <span className="np-stripe np-stripe-r w-10 shrink-0" style={{ height: 6 }} />
              Careers
            </div>
            <h2 id="careers-h" className="mt-5 text-3xl sm:text-[42px] text-white">
              We hire licensed NYC plumbers.
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed max-w-xl" style={{ color: "#c2d0e0" }}>
              Licensed plumbers, drain and sewer specialists, helpers, apprentices and operations support
              who want steady work, clear expectations and real NYC field experience. We look for people
              who communicate clearly, respect customers and job sites, and treat timing seriously.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <a href="#contact" className="np-btn-n"><Ic d={I.hard} s={20} /> Tell us where you fit</a>
              <a href={TEL_OFFICE} className="np-btn-o">Call the office line <Ic d={I.arrow} s={18} /></a>
            </div>
          </div>
          <div className="np-rev np-in-d1 np-tk np-glass" style={{ background: "rgba(255,255,255,.05)", borderColor: "rgba(255,255,255,.16)" }}>
            <div className="px-6 py-3.5 np-lab" style={{ color: "#a9bbcf", borderBottom: "1px solid rgba(255,255,255,.14)" }}>
              Typical hiring paths
            </div>
            <ul className="p-6 space-y-3 text-[15.5px]" style={{ color: "#dfe8f2" }}>
              {ROLES.map((r) => (
                <li key={r} className="flex gap-3 items-start">
                  <span className="mt-[8px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--cyan)" }} />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── STICKY MOBILE CALL BAR — z-30, room kept for the AI widget ── */}
      <div className={`np-callbar sm:hidden ${bar ? "np-show" : ""}`}>
        <div className="pr-24">
          <a href={TEL} className="np-btn w-full !py-4 !px-5 text-[16px]" aria-label={`Call Nonstop Plumbers dispatch at ${PHONE}`}>
            <Ic d={I.phone} s={19} /> Call 24/7 dispatch
          </a>
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-white">
        <div className="np-stripe" />
        <div className="np-w py-12 grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <img src={`${A}logo-hi.webp`} alt="Nonstop Plumbers NY logo" className="h-12 w-auto" width="240" height="48" loading="lazy" decoding="async" />
            <p className="mt-5 text-[15px] max-w-sm" style={{ color: "var(--mut)" }}>
              24/7/365 emergency plumbing, drain &amp; sewer, fire suppression and NYC compliance.
              Master Plumber and Master Fire Suppression licensed · fully insured.
            </p>
          </div>
          <div>
            <div className="np-lab" style={{ color: "var(--navy)" }}>Service area</div>
            <ul className="mt-4 space-y-2 text-[14px]" style={{ color: "var(--mut)" }}>
              {BOROUGHS.map((b) => <li key={b.b}>{b.b}</li>)}
            </ul>
            <div className="np-lab mt-7" style={{ color: "var(--navy)" }}>Offices</div>
            <ul className="mt-4 space-y-3 text-[14px] leading-relaxed" style={{ color: "var(--mut)" }}>
              {OFFICES.map((o) => <li key={o.c}><strong style={{ color: "var(--navy)" }}>{o.c}</strong><br />{o.a1}, {o.a2}</li>)}
            </ul>
          </div>
          <div>
            <div className="np-lab" style={{ color: "var(--navy)" }}>Emergency dispatch</div>
            <a href={TEL} className="dsp mt-4 block text-3xl" style={{ color: "var(--red)" }}>{PHONE}</a>
            <p className="mt-3 text-[14px]" style={{ color: "var(--mut)" }}>Answered every hour of every day — including holidays.</p>
            <div className="np-lab mt-7" style={{ color: "var(--navy)" }}>Manhattan office</div>
            <a href={TEL_OFFICE} className="mt-2 block text-[15px] font-semibold" style={{ color: "var(--navy)" }}>{PHONE_OFFICE}</a>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <a href={IG} target="_blank" rel="noopener noreferrer" className="np-pill np-lab hover:border-[color:var(--cyan)] transition-colors" style={{ color: "var(--mut)" }}>Instagram</a>
              <a href={FB} target="_blank" rel="noopener noreferrer" className="np-pill np-lab hover:border-[color:var(--cyan)] transition-colors" style={{ color: "var(--mut)" }}>Facebook</a>
            </div>
          </div>
        </div>
        <div className="border-t" style={{ borderColor: "var(--line)" }}>
          <div className="np-w py-5 flex flex-wrap items-center justify-between gap-3 text-[12px]" style={{ color: "var(--mut)" }}>
            <span>© {new Date().getFullYear()} Nonstop Plumbers CORP. All rights reserved. · Serving NYC since 1992.</span>
            <a href="https://www.guileoai.com" target="_blank" rel="noopener noreferrer"
              className="hover:text-[color:var(--navy)] transition-colors">
              Demonstration rebuild proposed by Guileo · website + AI
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
