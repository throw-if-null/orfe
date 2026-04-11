# Workflow handoff templates

Use these templates to keep agent-to-agent handoffs structured and easy to scan.
These are operational defaults for normal work in `orfe`.

## Zoran → Jelena

Use when a discussion becomes a formal work item or when a formal work item is materially reshaped.

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

## Klarissa → Jelena

Use after QA review is complete.

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

## Notes

- Keep the GitHub issue as the workflow source of truth.
- Keep detailed code review comments in the PR.
- Keep issue-level workflow outcomes aligned to the approved `[WORKFLOW]` event vocabulary in `AGENTS.md`.
