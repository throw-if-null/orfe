# Workflow handoff templates

Use these templates to keep agent-to-agent handoffs structured and easy to scan.
These are operational defaults for normal work in `orfe`.

## Handoff messages vs `[WORKFLOW]` issue events

These are different artifacts and both matter:

- **handoff messages** explain work, expectations, review context, and risks
- **`[WORKFLOW]` issue events** are the official workflow record in the GitHub issue timeline

A handoff message does **not** replace the required `[WORKFLOW]` issue event.
Use the handoff template for communication, and post the matching issue-level workflow event for the official record.

## Zoran → Jelena

Use when a discussion becomes a formal work item or when a formal work item is materially reshaped.
Issue creation/refinement does not by itself imply a new `[WORKFLOW]` event; use normal workflow events only when execution state actually changes.

```md
## Handoff
- Issue: #<number>
- Title: <issue title>

### Problem / context
- ...

### Desired outcome
- ...

### Scope boundaries
- In scope: ...
- Out of scope: ...

### Acceptance criteria
- ...

### Risks / open questions
- ...

### Docs impact
- none | update required
- details: ...

### ADR needed
- no | yes
- details: ...
```

## Jelena → Greg

Use when implementation work is being assigned.
Matching issue event: post `[WORKFLOW] Event: start` when implementation ownership begins and the issue moves into active execution.

```md
## Assignment
- Issue: #<number>
- Branch/worktree: `issues/<acronym>-<number>` / `.worktrees/<acronym>-<number>`

### What to build
- ...

### Acceptance criteria
- ...

### Constraints / invariants to preserve
- ...

### Verification required
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

### Docs / ADR expectations
- docs expected: yes | no
- ADR expected: yes | no
- debt update expected: yes | no
```

## Greg → Klarissa

Use when implementation is ready for QA review.
Before opening or updating the PR, make sure the PR body starts with `Ref: #<issue-number>` so the canonical issue remains linked.
Matching issue event: post `[WORKFLOW] Event: implementation-ready` when Greg hands off completed implementation for QA.

```md
## Implementation-ready handoff
- Issue: #<number>
- PR: #<number>

### What changed
- ...

### Tests added or updated
- ...

### Verification run
- `npm test` ✅/❌
- `npm run lint` ✅/❌
- `npm run typecheck` ✅/❌
- `npm run build` ✅/❌

### Docs / ADR / debt
- docs updated: yes | no
- ADR updated: yes | no
- debt updated: yes | no
- if no, explain why: ...

### Known limitations / follow-ups / risks
- ...
```

Exact `[WORKFLOW]` issue comment template:

```text
[WORKFLOW]
Event: implementation-ready
Board: In Progress
Next-Owner: Jelena
PR: #<pr-number>
```

## Klarissa → Jelena

Use after QA review is complete.
Matching issue event: post `[WORKFLOW] Event: qa-passed` or `[WORKFLOW] Event: qa-changes-requested` to record the official QA outcome.

```md
## QA outcome
- Issue: #<number>
- PR: #<number>
- Decision: APPROVED | CHANGES REQUIRED

### Blockers
- ...

### Important
- ...

### Docs / invariants review
- ...

### What I verified
- ...

### Next owner
- Greg | Jelena | Human
```

Exact `[WORKFLOW]` issue comment templates:

`qa-changes-requested`

```text
[WORKFLOW]
Event: qa-changes-requested
Board: In Progress
Next-Owner: Greg
PR: #<pr-number>
```

`qa-passed`

```text
[WORKFLOW]
Event: qa-passed
Board: In Progress
Next-Owner: Jelena
PR: #<pr-number>
```

## Jelena → Human

Use after QA has passed and the work is ready for final human review.
Matching issue event: post `[WORKFLOW] Event: ready-for-human-review` when Jelena hands the issue back for final review.

```md
## Ready for human review
- Issue: #<number>
- PR: #<number>

### What changed
- ...

### Verification summary
- Greg verification passed: yes | no
- Klarissa QA passed: yes | no

### Docs / ADR / debt
- docs updated: yes | no
- ADR updated: yes | no
- debt updated: yes | no
- if no, explain why: ...

### Remaining risks / follow-ups
- ...
```

Exact `[WORKFLOW]` issue comment template:

```text
[WORKFLOW]
Event: ready-for-human-review
Board: In Progress
Next-Owner: Human
PR: #<pr-number>
```

## Notes

- Keep the GitHub issue as the workflow source of truth.
- Keep detailed code review comments in the PR.
- Keep issue-level workflow outcomes aligned to the approved `[WORKFLOW]` event vocabulary in `AGENTS.md`.
- Keep the exact comment templates above synchronized with the matching workflow skills.
