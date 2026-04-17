---
name: task-ready-for-human-review
description: Record that an issue passed QA and is ready for final human review
---

# task-ready-for-human-review

## Purpose
Record that an issue has passed QA and is ready for final human review.

Usually used by **Jelena** after Klarissa posts `qa-passed`.

## Inputs
- `issue-number` (required)
- `pr-number` or `pr-url` (required)
- `auth_mode` (optional): `bot` or `session`

## Read first
Read the repository workflow config from `AGENTS.md` and derive values from it instead of hardcoding them:
- `github_owner`
- `repo_name`
- `project_acronym`
- `branch_prefix`
- allowed GitHub auth modes

Derived naming convention:
- branch: `issues/<project-acronym>-<issue-number>`

## Preconditions
- The latest QA workflow outcome for the current review round is `qa-passed`.
- The PR exists and corresponds to the issue branch.
- Implementation verification, QA review, and any required docs/ADR/debt handling are already complete.

## Preferred mechanisms
- Use the **`orfe` OpenCode function tool** as the preferred mechanism for GitHub state changes: issue lookup, PR lookup, and issue comments.
- Use local git inspection only if needed to confirm the branch naming convention.
- Exact tool call details may vary by environment, but the workflow outcome below is required.

## Auth rules
- `auth_mode` may be `bot` or `session`.
- If `bot` is requested or implied by repo config, **do not silently fall back** to `session`.
- If bot auth fails, stop and explicitly report or confirm the switch.
- To mint a bot token for `gh` CLI writes: call the `orfe` **function tool** with `command: auth token` and `repo: throw-if-null/orfe`. Do not use bash for token minting — the bash `orfe` CLI is blocked by agent permissions.

## Required outcome
1. Verify the PR and issue still correspond to the same issue branch.
2. Verify the latest relevant QA outcome is `qa-passed`.
3. Post the structured `[WORKFLOW]` issue comment shown below.
4. Return the issue, PR, and final human-review handoff status.

## Procedure
1. Verify the referenced PR exists and uses the expected head branch `issues/<project-acronym>-<issue-number>`.
2. Verify the issue timeline already contains the implementation handoff and the latest relevant QA outcome is `qa-passed` for this PR.
3. Confirm there is no newer `qa-changes-requested`, `blocked`, or `needs-input` event that would make the work unready for final human review.
4. Post the `[WORKFLOW]` issue comment using the exact template below.
5. Return a short summary with issue number, PR number, and confirmation that the next owner is the human.

## Exact workflow comment template
```text
[WORKFLOW]
Event: ready-for-human-review
Board: In Progress
Next-Owner: Human
PR: #<pr-number>
```

## Idempotency
- Re-running this skill should succeed without changing branch or PR state.
- Do not post duplicate `ready-for-human-review` comments unless a new QA pass created a materially new review handoff.

## Should not
- claim the issue is complete
- move the project item to `Done`
- merge the PR

## Notes
- The issue remains the canonical workflow ledger.
- `ready-for-human-review` is not a substitute for `complete`; completion still requires merge and explicit human approval.
