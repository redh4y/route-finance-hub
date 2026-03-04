import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

export class EncodingGuard {
  constructor(options = {}) {
    this.roots = options.roots || ["src", "supabase", "docs", "."];
    this.skipDirs = options.skipDirs || new Set(["node_modules", "dist", ".git", ".idea", ".vscode"]);
    this.allowedExt =
      options.allowedExt ||
      new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".scss", ".md", ".html", ".sql", ".yml", ".yaml"]);
    this.badPatterns = options.badPatterns || [/�/g, /Ã[\x80-\xBF]/g, /Â[\x80-\xBF]/g, /â[\x80-\xBF]/g];
  }

  walk(dir, out = []) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (!this.skipDirs.has(entry)) this.walk(full, out);
        continue;
      }
      const ext = extname(entry).toLowerCase();
      if (this.allowedExt.has(ext)) out.push(full);
    }
    return out;
  }

  listFiles() {
    const seen = new Set();
    const files = [];
    for (const root of this.roots) {
      for (const file of this.walk(root)) {
        if (seen.has(file)) continue;
        seen.add(file);
        files.push(file);
      }
    }
    return files;
  }

  countHits(content) {
    return this.badPatterns.reduce((acc, p) => {
      const m = content.match(p);
      return acc + (m ? m.length : 0);
    }, 0);
  }

  hasIssue(content) {
    return this.badPatterns.some((p) => p.test(content));
  }

  repairCandidate(content) {
    return Buffer.from(content, "latin1").toString("utf8");
  }

  repairIfBetter(content) {
    const before = this.countHits(content);
    if (before === 0) return { changed: false, content };

    const repaired = this.repairCandidate(content);
    const after = this.countHits(repaired);

    if (after < before) {
      return { changed: true, content: repaired };
    }

    return { changed: false, content };
  }

  check() {
    const files = this.listFiles();
    const issues = [];

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      if (this.hasIssue(content)) issues.push(file);
    }

    return issues;
  }

  fixAll() {
    const files = this.listFiles();
    const changed = [];

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const result = this.repairIfBetter(content);
      if (!result.changed) continue;
      writeFileSync(file, result.content, { encoding: "utf8" });
      changed.push(file);
    }

    return changed;
  }
}
