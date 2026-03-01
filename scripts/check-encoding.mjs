import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOTS = ["src", "supabase", "docs", "."];
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".idea", ".vscode"]);
const ALLOWED_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".scss", ".md", ".html", ".sql", ".yml", ".yaml"]);

const BAD_PATTERNS = [
  /�/g,
  /Ã[\x80-\xBF]/g,
  /Â[\x80-\xBF]/g,
  /â[\x80-\xBF]/g,
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(full, out);
      continue;
    }
    const ext = extname(entry).toLowerCase();
    if (ALLOWED_EXT.has(ext)) out.push(full);
  }
  return out;
}

const seen = new Set();
let hasIssue = false;

for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (seen.has(file)) continue;
    seen.add(file);

    const content = readFileSync(file, "utf8");
    const hits = BAD_PATTERNS.some((p) => p.test(content));
    if (hits) {
      hasIssue = true;
      console.error(`[encoding] Possivel texto quebrado em: ${file}`);
    }
  }
}

if (hasIssue) {
  console.error("\nFalha: encontrados arquivos com possível encoding quebrado.");
  process.exit(1);
}

console.log("OK: sem sinais de encoding quebrado.");
