import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(rootDir, "src");

function resolveCandidate(absBase) {
  for (const candidate of [
    absBase,
    `${absBase}.ts`,
    `${absBase}.tsx`,
    path.join(absBase, "index.ts"),
    path.join(absBase, "index.tsx"),
  ]) {
    if (existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const target = resolveCandidate(path.join(srcDir, specifier.slice(2)));
      if (target) {
        return { shortCircuit: true, url: target };
      }
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:")
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const target = resolveCandidate(path.resolve(parentDir, specifier));
      if (target) {
        return { shortCircuit: true, url: target };
      }
    }
    return nextResolve(specifier, context);
  },
});
