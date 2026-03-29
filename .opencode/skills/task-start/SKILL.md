---
name: task-start
description: Activate a GitHub issue for work and prepare the issue branch/worktree
---

# task-start

## Purpose
Activate a GitHub issue for work.

Usually used by **Jelena** to move an assigned issue into active execution, create or reuse the issue branch/worktree, and record the workflow handoff.

## Inputs
- `issue-number` (required)
- `next-owner` (required): the worker who should act next
- `auth_mode` (optional): `bot` or `session`

## Read first
Read the repository workflow config from `AGENTS.md` and derive values from it instead of hardcoding them:
- `github_owner`
- `repo_name`
- `project_acronym`
- `default_branch`
- `worktree_root`
- `branch_prefix`
- `project_board_status_field`
- `project_board_values`
- allowed GitHub auth modes

Derived naming convention:
- branch: `issues/<project-acronym>-<issue-number>`
- worktree: `.worktrees/<project-acronym>-<issue-number>`

Example for issue `123` in this repo:
- branch: `issues/orfe-123`
- worktree: `.worktrees/orfe-123`

## Required outcome
1. Confirm the GitHub issue exists.
2. Derive the issue branch and issue worktree from `AGENTS.md`.
3. Create or reuse that branch/worktree locally.
4. Move the issue's GitHub Project item to `In Progress`.
5. Post the structured `[WORKFLOW]` issue comment shown below.
6. Return the derived branch/worktree details.

## Preferred mechanisms
- Use **GitHub MCP** as the preferred mechanism for GitHub state changes: issue lookup, project status changes, comments, and related metadata.
- Use **local git commands only for branch/worktree operations**.
- Exact MCP/API calls may vary by environment, but the workflow outcome above is required.

## Auth rules
- `auth_mode` may be `bot` or `session`.
- If `bot` is requested or implied by repo config, **do not silently fall back** to `session`.
- If bot auth fails, stop and explicitly report or confirm the switch.

## Procedure
1. Read `AGENTS.md` and derive:
   - issue branch: `issues/<project-acronym>-<issue-number>`
   - issue worktree: `<worktree_root>/<project-acronym>-<issue-number>`
2. Verify the GitHub issue exists in the configured repository.
3. Verify the issue is represented on the configured GitHub Project. If the issue or project item cannot be found, stop and report it.
4. Prepare local git state for the issue branch/worktree:
   - fetch latest refs
   - if the issue branch already exists, reuse it
   - if the issue worktree already exists, reuse it
   - otherwise create the branch from the configured default branch and create the matching worktree
5. Move the issue's project item to `In Progress` using GitHub MCP.
6. Post the `[WORKFLOW]` comment on the issue.
7. Return a short result including:
   - issue number
   - branch name
   - worktree path
   - board status
   - next owner

## Exact workflow comment template
```text
[WORKFLOW]
Event: start
Board: In Progress
Next-Owner: <next-owner>
```

## Idempotency
- Re-running this skill should **reuse** the existing issue branch, issue worktree, and `In Progress` board state when they already exist.
- Do not create duplicate worktrees or alternate branch names.
- If a matching `[WORKFLOW]` start comment already exists, add a new one only when ownership or execution context changed materially.

## Should not
- create a PR
- run the implementation loop
- run the QA loop
- mark the issue done

## Notes
- The GitHub Issue is the canonical task record.
- The GitHub Project is only the coarse-grained state tracker.
- The PR is an implementation/review artifact and is not created by this skill.
