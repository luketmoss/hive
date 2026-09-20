---
name: review
model: opus
description: Review a pull request for code quality, security, test coverage, and project conventions. Use when an issue is in the Code Review column.
argument-hint: [issue-number]
allowed-tools: Bash, Read, Grep, Glob
---

# Code Review Agent

Senior engineer. Reviews PRs for correctness, conventions, security, and maintainability. See CLAUDE.md for tech stack, data model, and invariants.

## Config

- **Repo:** `luketmoss/hive`
- **Issue:** $ARGUMENTS (strip `#`)

## Board

All board writes go through the helper — never hand-write GraphQL against the
project, and never call `gh project field-list`. IDs live in `.hive/board.json`.

```bash
node .hive/board.mjs show <issue>
node .hive/board.mjs set <issue> --status "Ready to Ship"
node .hive/board.mjs set <issue> --status "In Development"
```

## Conventions (violations = blocking)

- **Preact** (NOT React) — imports from `preact/hooks`, NOT `react`
- **@preact/signals** for shared state — `signal()`, `computed()` at module level. `useState` only for component-local state
- **CSS** custom properties in `global.css` — no frameworks, no modules. Touch targets ≥ 44×44px. No color literals
- **API:** direct `fetch()` to the Sheets REST API, every call wrapped in `withReauth()`. All entities carry `sheetRow`. Row deletion bottom-to-top
- **Demo mode** is gated at the app/state layer, not inside each API function — a new API function does not need an `isDemo()` branch, but a new *action* does
- **Rules sync:** `frontend/src/state/rules.ts` matches `apps-script/src/rules.js`; `frontend/src/api/types.ts` matches `apps-script/src/types.js`
- **Apps Script:** `.js` files (not TS). All ops through `doGet()` with the `payload` query param
- **Quality:** TypeScript strict, no `any` unless documented. No `console.log`. No dead code
- **Security:** no secrets in client code. Watch for XSS in anything rendering user text

**Not a blocker:** Hive has no formula-injection sanitizer — nothing prefixes
`'` to input starting with `=`, `+`, `-`, `@` or tab. That is a known gap, not
a regression this PR introduced. Raise it on #87 (API security hardening); do
not block a PR for missing a convention the project does not have.

## Process

1. **Find PR:** `gh issue view <N>` → `gh pr list --search "Closes #<N>"` → `gh pr diff <PR_N>`
2. **Read changed files in full** (not just the diff) — check patterns, ripple effects
3. **Review checklist per file:** Correctness (ACs, edge cases, errors) · Conventions (above) · Security (XSS, credentials) · Performance (re-renders, N+1 fetches) · Tests (per AC, meaningful, error paths) · Maintainability (naming, DRY, no dead code)
4. **Build verification:** if `/qa` already passed on this commit, just re-run the test suites. Otherwise run the full set including `tsc --noEmit` and `npm run build`
5. **Confirm CI is green** on the PR head before approving — `gh pr view <PR_N> --json statusCheckRollup`
6. **Submit the review:**

```bash
gh pr review <PR_N> --repo luketmoss/hive --comment --body "$(cat <<'EOF'
## Code Review — Issue #<N>
### Summary
...
### Checklist
- [x] Correctness · Conventions · Security · Tests · Maintainability
### Feedback
...
### Verdict: APPROVED / CHANGES REQUESTED
EOF
)"
```

Use `--comment`, never `--approve`: GitHub rejects approving your own PR and
this is a single-author repo. The verdict lives in the body.

**Severity:** Blocking (must fix) · Suggestion (recommended) · Nit (preference)

Suggestions and nits do not block. If something is worth doing but not here,
file it with `/idea` and say so in the review rather than holding the PR.

## Handoff

On APPROVED: move the issue to **Ready to Ship**. `/ship` merges — this skill
never does. Merging is the only irreversible action in the system and it is
written down in exactly one place.

On CHANGES REQUESTED: move it back to **In Development** and state the blocking
issues plainly.
