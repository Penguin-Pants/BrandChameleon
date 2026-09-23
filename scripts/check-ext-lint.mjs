// Runs web-ext lint on src/ and enforces AC-01: 0 errors and no warnings
// except KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION (accepted: the
// extension is desktop only and supports Firefox ESR 140).
import webExt from "web-ext";

const ALLOWED_WARNINGS = new Set(["KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION"]);

const result = await webExt.cmd.lint(
  { sourceDir: "src", selfHosted: false, output: "json", boring: true, pretty: false },
  { shouldExitProgram: false },
);
const errors = result.errors ?? [];
const warnings = (result.warnings ?? []).filter((w) => !ALLOWED_WARNINGS.has(w.code));
for (const item of [...errors, ...warnings]) console.error(`${item._type}: ${item.code} ${item.message}`);
if (errors.length || warnings.length) process.exit(1);
console.log(`web-ext lint: 0 errors, ${result.warnings?.length ?? 0} accepted warning(s), ${result.notices?.length ?? 0} notice(s).`);
