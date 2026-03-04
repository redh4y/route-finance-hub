import { EncodingGuard } from "./encoding-guard.mjs";

const guard = new EncodingGuard();
const issues = guard.check();

if (issues.length > 0) {
  for (const file of issues) {
    console.error(`[encoding] Possivel texto quebrado em: ${file}`);
  }
  console.error("\nFalha: encontrados arquivos com possivel encoding quebrado.");
  process.exit(1);
}

console.log("OK: sem sinais de encoding quebrado.");
