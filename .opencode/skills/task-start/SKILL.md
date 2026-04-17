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
- `next-owner` (optional): the worker who should act next; default to `Greg` when omitted for a normal implementation handoff
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
4. Move the issue's GitHub Project item to `In Progress` when a project item exists; otherwise note that the issue has no project item and continue.
5. Resolve the next owner, defaulting to `Greg` when `next-owner` was omitted for a routine implementation start.
6. Post the structured `[WORKFLOW]` issue comment shown below.
7. Return the derived branch/worktree details.

## Preferred mechanisms
- Use the **`orfe` OpenCode function tool** as the preferred mechanism for GitHub state changes: issue lookup, project status changes, comments, and related metadata.
- Use **local git commands only for branch/worktree operations**.
- Exact tool call details may vary by environment, but the workflow outcome above is required.

## Auth rules
- `auth_mode` may be `bot` or `session`.
- If `bot` is requested or implied by repo config, **do not silently fall back** to `session`.
- If bot auth fails, stop and explicitly report or confirm the switch.
- To mint a bot token for `gh` CLI writes: call the `orfe` **function tool** with `command: auth token` and `repo: throw-if-null/orfe`. Do not use bash for token minting — the bash `orfe` CLI is blocked by agent permissions.

## Procedure
1. Read `AGENTS.md` and derive:
   - issue branch: `issues/<project-acronym>-<issue-number>`
   - issue worktree: `<worktree_root>/<project-acronym>-<issue-number>`
2. Verify the GitHub issue exists in the configured repository.
3. Check whether the issue is represented on the configured GitHub Project.
   - If the issue itself cannot be found, stop and report it.
   - If the issue exists but no project item exists yet, treat that as a non-fatal path: note that the issue is not currently on the project and continue.
   - If project metadata cannot be read for some other reason, stop and report that failure.
4. Prepare local git state for the issue branch/worktree:
   - fetch latest refs
   - if the issue branch already exists, reuse it
   - if the issue worktree already exists, reuse it
   - otherwise create the branch from the configured default branch and create the matching worktree
5. If a project item exists, move it to `In Progress` using GitHub MCP. Otherwise skip the project update and continue.
6. Resolve `next-owner`:
   - if `next-owner` was provided, use it
   - if `next-owner` was omitted, default to `Greg` for the normal Jelena → Greg implementation handoff
7. Post the `[WORKFLOW]` comment on the issue using the resolved next owner.
8. Return a short result including:
   - issue number
   - branch name
   - worktree path
   - board status, or a note that no project item exists
   - resolved next owner

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
- Re-running without `next-owner` should keep using the default `Greg` handoff unless a different next owner is intentionally supplied.
- If no project item exists, re-running should continue to succeed without treating that missing item as a fatal error.

## Should not
- create a PR
- perform implementation or QA directly as part of this skill
- mark the issue done

## Notes
- The GitHub Issue is the canonical task record.
- The GitHub Project is only the coarse-grained state tracker.
- The PR is an implementation/review artifact and is not created by this skill.
- This skill activates the issue; it does not end Jelena's orchestration responsibility.
- Not performing implementation or QA directly does **not** mean Jelena should stop after activation; Jelena should normally continue by handing the issue to the resolved next owner.
