---
name: task-implementation-ready
description: Create or reuse the issue PR and record the implementation handoff
---

# task-implementation-ready

## Purpose
Create or link the pull request for an issue branch and record that implementation is ready for orchestration.

Usually used by **Greg** after implementation, tests, lint, typecheck, and build are complete.

## Inputs
- `issue-number` (required)
- `auth_mode` (optional): `bot` or `session`
- `pr-title` (optional): defaults to the issue title or a concise implementation title
- `summary` (optional): short bullets for the PR body
- `testing-performed` (optional): verification bullets for the PR body

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
- The implementation work for the issue is complete on the issue branch.
- Verification has already been run successfully.
- The branch/worktree in use matches the single-issue workflow from `AGENTS.md`.

## Preferred mechanisms
- Use **GitHub MCP** as the preferred mechanism for GitHub state changes: issue lookup, PR lookup/creation, and issue comments.
- Use **local git commands only for branch/worktree operations and pushing commits**.
- Exact MCP/API details may vary by environment, but the workflow outcome below is required.

## Auth rules
- `auth_mode` may be `bot` or `session`.
- If `bot` is requested or implied by repo config, **do not silently fall back** to `session`.
- If bot auth fails, stop and explicitly report or confirm the switch.

## Required outcome
1. Read `AGENTS.md` and derive the expected issue branch/worktree.
2. Verify the current branch and active worktree match that convention. If not, stop and reconcile first.
3. Push the branch if needed.
4. Create or reuse the PR for that branch.
5. Ensure the PR references the canonical GitHub issue with the exact first-line wording `Ref: #<issue-number>` required by `AGENTS.md`.
6. Post the structured `[WORKFLOW]` issue comment shown below.
7. Return PR number, URL, branch, and worktree details.

## Procedure
1. Derive the expected branch `issues/<project-acronym>-<issue-number>` and worktree `<worktree_root>/<project-acronym>-<issue-number>`.
2. Verify:
   - current git branch matches the derived branch
   - current worktree matches the derived worktree for this issue
   - working tree is ready to push
3. Push the branch to origin if needed, setting upstream when missing.
4. Check whether a PR for the branch already exists.
   - if yes, reuse it
   - if no, create it against the configured default branch
5. Ensure the PR references the canonical issue with the exact first-line wording `Ref: #<issue-number>`.
6. Use a lean PR body. Keep it focused on:
   - linked issue
   - short summary
   - testing performed
7. Post the `[WORKFLOW]` issue comment on the issue.
8. Return PR info for the handoff.

## Lean PR body guidance
```md
Ref: #<issue-number>

## Summary
- <short implementation summary>

## Testing
- <tests / lint / typecheck / build run>
```

## Exact workflow comment template
```text
[WORKFLOW]
Event: implementation-ready
Board: In Progress
Next-Owner: jelena
PR: #<pr-number>
```

## Idempotency
- Re-running this skill should reuse the existing PR when one already exists for the issue branch.
- Do not create duplicate PRs for the same issue branch.
- If the branch is already pushed and the issue already has a matching `implementation-ready` comment, add a new comment only when the PR linkage changed materially.

## Should not
- claim QA passed
- mark the issue ready for human review
- mark the issue done

## Notes
- The GitHub Issue remains the canonical task record.
- The PR is the implementation/review artifact for that issue branch.
