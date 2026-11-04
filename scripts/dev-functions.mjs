// Runs `wrangler pages dev` proxying to `npm run dev` (Vite), so Functions (/api/*)
// and the frontend run together locally with HMR. Plain Node so it works from any
// shell (PowerShell, cmd, bash) without relying on `bash` being on PATH.
//
// Why this wrapper exists: wrangler.toml's `pages_build_output_dir = "dist"` makes
// newer Wrangler (confirmed on 4.157.0) treat "dist" as the directory of static
// assets to serve — which Wrangler then refuses to combine with the `-- npm run dev`
// proxy command ("Cannot specify both a directory and a proxy command"). Production
// deploys (scripts/deploy.sh, scripts/subir.sh) pass `dist` explicitly on the CLI and
// never relied on that config field, so it's safe to drop ONLY for this local-dev
// run — never edit the committed wrangler.toml, since Cloudflare's dashboard may
// still read pages_build_output_dir for its own build/deploy settings.
//
// The file is restored a few seconds after launch (once Wrangler has read it at
// startup) rather than only on exit — a forcefully killed process (closed terminal,
// crash, task manager) never fires JS exit handlers, so waiting until exit to
// restore risks leaving wrangler.toml permanently stripped on disk.
//
// Also: Wrangler auto-detects the proxy's port by shelling out to `wmic`, which
// recent Windows builds no longer ship ("'wmic' is not recognized..."). Pin Vite to
// a fixed port with --strictPort (fails loudly instead of silently moving to 5174+
// if taken) and tell wrangler that same port with --proxy, so it skips wmic detection.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tomlPath = join(root, "wrangler.toml");
const original = readFileSync(tomlPath, "utf8");
const stripped = original
  .split("\n")
  .filter((line) => !line.startsWith("pages_build_output_dir"))
  .join("\n");

let restored = false;
const restore = () => {
  if (restored) return;
  restored = true;
  try {
    writeFileSync(tomlPath, original);
  } catch {
    // best effort — file may already be restored
  }
};

writeFileSync(tomlPath, stripped);
// Give Wrangler a few seconds to start and read the config, then put it back —
// independent of how/when the dev session itself later ends.
const restoreTimer = setTimeout(restore, 4000);
process.on("exit", restore);

const vitePort = process.env.VITE_PORT || "5173";

const child = spawn(
  "npx",
  [
    "wrangler",
    "pages",
    "dev",
    "--port",
    "8788",
    "--compatibility-date=2026-06-01",
    "--env-file=.env",
    "--proxy",
    vitePort,
    "--",
    "npm",
    "run",
    "dev",
    "--",
    "--port",
    vitePort,
    "--strictPort",
  ],
  { cwd: root, stdio: "inherit", shell: true }
);

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));

child.on("error", (err) => {
  clearTimeout(restoreTimer);
  restore();
  console.error(err);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  clearTimeout(restoreTimer);
  restore();
  process.exitCode = code ?? (signal ? 1 : 0);
});
