// Dump every table of the Supabase project to JSON files on this computer (off-platform copy of the database rows).
//
// Needs the project's SERVICE ROLE key (Supabase dashboard > Project Settings > API). It bypasses row security, so treat it like a password:
// put it ONLY in a local file named .env.backup (git-ignored by the ".env*" rule), never in chat, code or GitHub:
//     SUPABASE_SERVICE_ROLE_KEY=eyJ...
// Run:     node scripts/backup-data.mjs
// Output:  <folder above the repo>/backups/data-YYYY-MM-DD/<table>.json  +  manifest.json (row counts)
// The backups folder is OUTSIDE the repo on purpose: the GitHub repo is public and the data is private.
//
// Test mode (no secret): node scripts/backup-data.mjs --publishable --tables storefront_products,storefront_variants
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const local = readEnv(join(repo, ".env.local"));
const backupEnv = readEnv(join(repo, ".env.backup"));
const url = local.NEXT_PUBLIC_SUPABASE_URL;
const usePublishable = flag("--publishable");
const key = usePublishable ? local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : backupEnv.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing in .env.local");
if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing: create .env.backup with SUPABASE_SERVICE_ROLE_KEY=... (see the header of this script)");

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const day = new Date().toISOString().slice(0, 10);
const outDir = opt("--out") ?? join(dirname(repo), "backups", `data-${day}`);
mkdirSync(outDir, { recursive: true });

async function listTables() {
  const res = await fetch(`${url}/rest/v1/`, { headers });
  if (!res.ok) throw new Error(`Cannot list tables: HTTP ${res.status}`);
  const spec = await res.json();
  return Object.keys(spec.paths ?? {})
    .map((p) => p.replace(/^\//, ""))
    .filter((p) => p && !p.startsWith("rpc/"))
    .sort();
}

const PAGE = 1000;

async function dumpTable(table) {
  const rows = [];
  for (const order of ["id.asc", null]) {
    rows.length = 0;
    let ok = true;
    for (let from = 0; ; from += PAGE) {
      const q = `${url}/rest/v1/${encodeURIComponent(table)}?select=*${order ? `&order=${order}` : ""}`;
      const res = await fetch(q, { headers: { ...headers, Range: `${from}-${from + PAGE - 1}`, "Range-Unit": "items" } });
      if (res.status === 400 && order) {
        ok = false; // no "id" column: retry without ordering
        break;
      }
      if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
      const page = await res.json();
      rows.push(...page);
      if (page.length < PAGE) break;
    }
    if (ok) return rows;
  }
  return rows;
}

const tables = opt("--tables")?.split(",") ?? (await listTables());
const manifest = { createdAt: new Date().toISOString(), project: url, tables: {} };
let failed = 0;
for (const table of tables) {
  try {
    const rows = await dumpTable(table);
    writeFileSync(join(outDir, `${table}.json`), JSON.stringify(rows));
    manifest.tables[table] = rows.length;
    console.log(`${table.padEnd(34)} ${String(rows.length).padStart(7)} rows`);
  } catch (e) {
    failed += 1;
    manifest.tables[table] = `ERROR: ${e.message}`;
    console.error(`${table}: FAILED ${e.message}`);
  }
}
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nSaved ${tables.length - failed}/${tables.length} tables to ${outDir}`);
if (failed > 0) process.exit(1);
