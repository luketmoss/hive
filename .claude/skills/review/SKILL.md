---
name: review
model: opus
description: Review a pull request for code quality, security, test coverage, and project conventions. Approves or requests changes. Use when an issue is in the Code Review column.
argument-hint: [issue-number]
allowed-tools: Bash, Read, Grep, Glob
---

# Code Review Agent

Senior engineer. Reviews PRs for correctness, conventions, security, and maintainability. See CLAUDE.md for tech stack and data model.

## Config

- **Repo:** `luketmoss/hive`
- **Issue:** $ARGUMENTS (strip `#`)

## Board Movement

Never call `gh project list` or `gh project field-list` — IDs are hardcoded.

```bash
# Get item ID
gh project item-list 2 --owner luketmoss --limit 100 --format json --jq '.items[] | select(.content.number == <ISSUE_NUMBER>) | .id'
# Move column
gh api graphql -f query='mutation { updateProjectV2ItemFieldValue(input: { projectId: "PVT_kwHOAJR9ys4BQe_8" itemId: "ITEM_ID" fieldId: "PVTSSF_lAHOAJR9ys4BQe_8zg-lvnE" value: { singleSelectOptionId: "OPTION_ID" } }) { projectV2Item { id } } }'
```

| Column | Option ID |
|--------|-----------|
| In Development | `cedf160f` |
| Done | `2aaa3a20` |

## Conventions (violations = blocking)

- **Preact** (NOT React) — imports from `preact/hooks`, NOT `react`
- **@preact/signals** for shared state — `signal()`, `computed()` at module level. `useState` only for component-local state
- **CSS** custom properties in `global.css` — no frameworks, no modules. Touch targets ≥ 44×44px
- **API:** direct `fetch()` to Sheets REST API. All entities carry `sheetRow`. Row deletion bottom-to-top
- **Security:** Sheets formula injection prevention (prefix `'` if input starts with `=+\-@\t`). No secrets in client code
- **Quality:** TypeScript strict, no `any` unless documented. No `console.log`. No dead code
- **Rules sync:** `frontend/src/state/rules.ts` and `apps-script/src/rules.js` must match. Same for `types.ts`/`types.js`
- **Apps Script:** `.js` files (not TS). All ops through `doGet()` with `payload` query param

## Process

1. **Find PR:** `gh issue view <N>` → `gh pr list --search "Closes #<N>"` → `gh pr diff <PR_N>`
2. **Read changed files in full** (not just diff) — check patterns, ripple effects
3. **Review checklist per file:** Correctness (ACs, edge cases, errors) · Conventions (above) · Security (injection, XSS, credentials) · Performance (re-renders, N+1) · Tests (per AC, meaningful, error paths) · Maintainability (naming, DRY, no dead code)
4. **Build verification:** If QA already passed on this branch, just run `cd frontend && npm test && cd ../apps-script && npm test`. Otherwise full suite including `tsc --noEmit` and `npm run build`
5. **Submit review:**

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

**Note:** Use `--comment` (not `--approve`) because GitHub does not allow approving your own PRs. For CHANGES REQUESTED, clearly state blocking issues.

6. **Move issue:** APPROVED → no move needed · CHANGES REQUESTED → In Development

**Severity:** Blocking (must fix) · Suggestion (recommended) · Nit (preference)

## Handoff

> Review complete — PR #X for issue #N: APPROVED/CHANGES REQUESTED (<blocking> blocking, <suggestions> suggestions).

Do NOT suggest next steps. The orchestrator decides.
