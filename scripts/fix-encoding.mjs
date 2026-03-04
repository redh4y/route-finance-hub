import { EncodingGuard } from "./encoding-guard.mjs";

const guard = new EncodingGuard();
const changed = guard.fixAll();

if (changed.length === 0) {
  console.log("Nenhum arquivo precisou de correcao de encoding.");
  process.exit(0);
}

for (const file of changed) {
  console.log(`[encoding] corrigido: ${file}`);
}

console.log(`\nTotal corrigido: ${changed.length} arquivo(s).`);
