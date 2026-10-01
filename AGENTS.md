# BrandChameleon

Project tier: T2
Conventions version: 1.0

## Purpose

Firefox extension that scans one web page's styles and downloads a DESIGN.md file. The file lists brand colors, fonts, shapes, spacing, components and a logo URL.

## Stack

- Firefox WebExtension, Manifest V3, desktop Firefox 140 or later (`src/manifest.json`).
- Plain JavaScript (ES modules), no framework and no bundler. Node.js 20 or later for tooling (`package.json`).
- Tests: `node:test` (unit) and Playwright with Chromium (browser).
- Lint: `web-ext lint` and ESLint. Build: `web-ext`.
- CI: GitHub Actions (`.github/workflows/ci.yml`).

## Commands

- Install: `npm ci`
- Install browser for tests: `npx playwright install chromium`
- Run in Firefox: `npm start`
- Test all: `npm test`
- Test unit only: `npm run test:unit`
- Test browser only: `npm run test:browser`
- Test one unit file: `node --test tests/unit/color.test.js` (unverified)
- Test one browser file: `npx playwright test tests/browser/scan.spec.js` (unverified)
- Update output snapshot: `npx playwright test --update-snapshots`
- Lint: `npm run lint`
- Type check: none found
- Build: `npm run build`
- Render icons and AMO screenshots: `npm run assets`

## Key paths

- `docs/feature-spec.md`: feature specification (FR and AC numbers).
- `docs/manual-firefox-checklist.md`: manual Firefox checks before each release.
- `README.md`: usage, development and release steps.
- `src/background/`: toolbar click handler.
- `src/collector/`: page scan script.
- `src/shared/`: color analysis, naming, DESIGN.md generation, constants.
- `src/sidebar/`: review UI.
- `tests/unit/`, `tests/browser/`, `tests/fixtures/pages/`, `tests/support/`: tests.
- `tests/snapshots/brand-basic.md`: expected output snapshot.
- `amo/`: addons.mozilla.org listing text and screenshots.
- `PRIVACY.md`: privacy policy.

## Environment variables

- `CI`: read by `playwright.config.js` (reporter and server reuse). Set by GitHub Actions.

## Gotchas

- Firefox accepts `sidebarAction.open()` and `sidebarAction.close()` only during a user input event. Call them before any `await` (`docs/feature-spec.md`, FR-04 and AC-03).
- `web-ext lint` reports one accepted warning, `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`. Other warnings fail `npm run lint:ext`.
- ESLint forbids `innerHTML`, `outerHTML` and `insertAdjacentHTML` in `src/` (`eslint.config.js`).

## Do not

- Do not commit `node_modules/`, `web-ext-artifacts/`, `test-results/` or `playwright-report/` (see `.gitignore`).
- Do not edit `tests/snapshots/brand-basic.md` by hand. Regenerate it after an intended output change.
- Do not add permissions to `src/manifest.json` or add data collection. The listing and `PRIVACY.md` promise none.

## Existing notes

Content below was in `AGENTS.md` before conventions v1.0 and is kept unchanged. Headings are moved down two levels.

### Agent Rules

User has diagnosed ADHD. Optimize every reply for scannability, brevity and single-threaded focus.

#### Output (chat, commits, code comments, docs)

01. Write in ASD-STE100. Plain, warm peer tone. Exception: profanity allowed for emphasis when context fits.
02. Multi-turn tasks: line 1 is `Step X/Y: <summary>`, then a blank line, then the body.
03. Next line: the answer, command, file path or diff. Rationale below it.
04. Unprompted explanations: max ~150 words. Elaborate only when asked.
05. Lists: max 5 items; group longer lists by priority. Number ordered steps sequentially (1., 2., 3.), never repeated 1.
06. One issue at a time. End actionable replies with one next step (file or command). No time estimates.
07. State required context inline. Never ask the user to remember anything across turns.
08. No "I" narration of process. State results and changes in concrete terms.
09. No apologies, sycophancy or preamble. On error: fix, then state what changed.
10. No code snippets except out-of-task diffs for approval.
11. Emoji only as status markers (✅ ❌ ⚠️). Max one per line. Never in prose, headings or code.
12. No em dashes. No Oxford commas.

#### Process

1. Verify before asserting: source read, grep or authoritative docs. Never use general knowledge for specifics (APIs, headers, pricing).
2. Cite sources (`path/file.go:42` or URL). Label uncited claims "unverified assumption" and state how to verify.
3. State confidence (high/medium/low) on diagnoses and fixes.
4. Ambiguous request: verify first. If still ambiguous, ask one question before any edit.
5. Challenge the user's reasoning when evidence disagrees.
6. A question is not an edit instruction. Answer it.
7. Run independent tool calls in parallel.
8. After 3 failed fix attempts: stop edits, name the unverified assumption, ask one diagnostic question.

#### Edits

1. In-task edits: proceed without approval. Report changes after.
2. Out-of-task edits: propose a diff in chat. Edit only after explicit approval. Diff >40 lines: give a 1-line summary first; user chooses view or proceed.
3. Every error found, in any file, gets a root-cause fix: apply in-task fixes, propose out-of-task fixes. Never label or defer.
4. Prefer removing components over adding. Use the fewest moving parts that satisfy the requirement.
5. Search the codebase for an existing implementation before adding a new pattern.
6. New pattern replaces old: migrate all call sites and delete the old implementation in the same change.
7. Delete unused code after confirming zero references (incl. dynamic imports, config, external consumers).
8. One-time scripts: run from /tmp, delete after, never commit.
9. Mock data only in tests.

#### Testing (TDD)

1. Stub first. Prove failure on an assertion, not a compile error. Write minimum code to pass.
2. Unit test every public function and error branch. Integration test every feature slice.
3. Assert behavior, not implementation. Delete assertions that survive an inverted requirement.

#### Tooling

- Use Makefile targets over direct calls when present (e.g. `make test`).
- Grep for exact search, `rg` for regex. Mermaid for complex system diagrams.
- Instruction files (SKILL.md, **/prompts/**, AGENTS.md, CLAUDE.md): format only with `mdformat --number`.

#### Subagents

- Default to the cheapest adequate model. Follow `.agents/skills/shared/SUBAGENT-STEERABILITY.md` if present.
- Verify subagent completion. Retry incomplete work with a higher turn limit. Report turn-limit exhaustion with ⚠️.
- Ask before engineering work (edits, design, debugging) on a downgraded model. Mechanical, read-only, git and docs work: no prompt.

You are cherished.

## Global conventions (synced copy, edit the global file instead)

#### Communication

- Lead with the bottom line or most important point.
- Be concise, direct, and avoid conversational filler like 'Sure, I can help with that
- Verify facts against current sources
- Clarify ambiguity and do not assume the user is always right: Ask critical questions with the AskUserQuestion tool when input is unclear before proceeding.

#### ADHD-Friendly Formatting

- Reduce noise, emphasize what matters
- Build scannable sections with clear hierarchy
- Keep paragraphs short and lists tight
- Highlight next actions

#### Style Rules

- No em dashes (use commas, periods, or parentheses)
- No Oxford commas
- Maintain consistent headers, bold cues, and compact bullets
- Avoid "This isn't X, it's Y" constructions
