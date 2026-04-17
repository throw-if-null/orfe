---
name: task-qa
description: Review an implementation PR and record the canonical QA outcome on the issue
---

# task-qa

## Purpose
Review an implementation PR and record the official QA outcome on the GitHub issue.

Usually used by **Klarissa** after Greg posts `implementation-ready`.

## Inputs
- `issue-number` (required)
- `pr-number` or `pr-url` (required)
- `auth_mode` (optional): `bot` or `session`

## Read first
Read the repository workflow config from `AGENTS.md` and derive values from it instead of hardcoding them:
- `github_owner`
- `repo_name`
- `project_acronym`
- `default_branch`
- `worktree_root`
- `branch_prefix`
- allowed GitHub auth modes

Derived naming convention:
- branch: `issues/<project-acronym>-<issue-number>`
- worktree: `.worktrees/<project-acronym>-<issue-number>`

## Preconditions
- Greg has already handed off the work with `implementation-ready`.
- The PR exists and is tied to the issue branch for this issue.
- Klarissa is performing review only; no code or branch mutation is part of this skill.

## Preferred mechanisms
- Use the **`orfe` OpenCode function tool** as the preferred mechanism for GitHub state changes: issue lookup, PR lookup, PR review actions, and issue comments.
- Use **read-only local git and verification commands only** when additional inspection is needed.
- Exact tool call details may vary by environment, but the workflow outcome below is required.

## Auth rules
- `auth_mode` may be `bot` or `session`.
- If `bot` is requested or implied by repo config, **do not silently fall back** to `session`.
- If bot auth fails, stop and explicitly report or confirm the switch.
- To mint a bot token for `gh` CLI writes: call the `orfe` **function tool** with `command: auth token` and `repo: throw-if-null/orfe`. Do not use bash for token minting — the bash `orfe` CLI is blocked by agent permissions.

## Review standards
Treat these as **blockers** unless explicitly waived by the task:
- failing tests, lint, typecheck, or build
- correctness gaps against the issue requirements
- missing or clearly weak tests for changed behavior
- security, accessibility, regression, or maintainability problems that make the change unsafe to accept
- required docs, invariant handling, ADR updates, or debt visibility that are missing for materially durable changes

Use this finding classification in the PR review:
- **Blocker**: must be fixed before QA can pass
- **Important**: should be addressed soon, but does not alone prevent QA pass
- **Nice-to-have**: optional improvement, not a QA gate

## Required outcome
1. Review the PR against the issue scope, changed files, tests, and verification claims.
2. Leave detailed QA feedback on the PR, with blockers clearly separated from non-blocking comments.
3. Post the structured `[WORKFLOW]` issue comment shown below using either `qa-changes-requested` or `qa-passed`.
4. Return the decision, key blockers or concerns, and the next-owner implication.

## Procedure
1. Read the GitHub issue, current `[WORKFLOW]` comments, and PR body.
2. Verify the PR is for the expected issue branch `issues/<project-acronym>-<issue-number>` and still references the canonical issue with `Ref: #<issue-number>` on the first line of the PR body.
3. Review the submitted implementation:
   - inspect the PR diff and any relevant commits
   - compare the work against the issue scope and acceptance criteria
   - check whether tests meaningfully cover the changed behavior
   - verify Greg's reported validation work
   - check relevant docs, invariants, ADRs, and debt updates when the change touches durable project truth
4. Run read-only verification commands when needed to confirm or challenge the submitted verification summary.
5. Classify findings:
   - if one or more **blockers** remain, request changes in the PR and post `qa-changes-requested` on the issue
   - if only **important** or **nice-to-have** comments remain, leave them in the PR and post `qa-passed` on the issue
6. Record the official issue-level outcome with the exact template below.
7. If this is a repeated QA loop, call that out explicitly in the PR review and escalate to Jelena when the same blocker recurs or the issue appears to need reframing.

## Out-of-scope bugs found during QA
- If an out-of-scope bug is introduced by the submitted change, blocks acceptance criteria, or makes merge unsafe, treat it as a **blocker** and use `qa-changes-requested`.
- If an out-of-scope bug appears unrelated to the submitted change and does not make this issue unsafe to accept, record it as **important** or **nice-to-have**, recommend a follow-up issue, and do **not** fail QA solely for that unrelated work.
- If the bug is severe enough that the team needs a scope or priority decision before QA can reasonably continue, escalate to Jelena immediately. Use `blocked` or `needs-input` only when the situation is genuinely waiting on an external decision rather than a normal QA changes loop.

## Repeated QA loop escalation
- If the same blocker comes back again, or two full QA rounds still reveal materially unresolved problems, explicitly tell Jelena the issue may need reframing, splitting, or tighter implementation guidance.
- Keep the current QA outcome honest: use `qa-changes-requested` while blockers remain, even when you are also escalating the loop.

## Exact workflow comment templates

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

## Idempotency
- Re-running this skill should reuse the same PR and issue.
- Do not post duplicate issue-level QA outcomes unless the QA decision changed materially or a new review round completed.
- A later `qa-passed` may supersede an earlier `qa-changes-requested`, but only after blockers were actually resolved and review was repeated.

## Should not
- edit code or branch state
- mark the issue ready for human review
- mark the issue done

## Notes
- The PR carries detailed review discussion.
- The GitHub Issue carries the canonical workflow outcome.
- After `qa-passed`, Jelena owns the separate `ready-for-human-review` handoff.
