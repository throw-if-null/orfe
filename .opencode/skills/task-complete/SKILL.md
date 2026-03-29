---
name: task-complete
description: Finalize a merged GitHub issue after human approval and clean up the issue branch
---

# task-complete

## Purpose
Finalize a merged issue after explicit human approval.

Executed by **Jelena** after the PR is merged and the human has explicitly instructed completion.

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
- `project_board_status_field`
- allowed GitHub auth modes

Derived naming convention:
- branch: `issues/<project-acronym>-<issue-number>`
- worktree: `.worktrees/<project-acronym>-<issue-number>`

## Preconditions
- Human approval to complete has been given explicitly.
- The referenced PR is already merged.

## Preferred mechanisms
- Use **GitHub MCP** as the preferred mechanism for GitHub state changes: PR verification, issue/project updates, comments, and issue closing.
- Use **local git commands only for branch/worktree cleanup**.
- Exact MCP/API details may vary by environment, but the workflow outcome below is required.

## Auth rules
- `auth_mode` may be `bot` or `session`.
- If `bot` is requested or implied by repo config, **do not silently fall back** to `session`.
- If bot auth fails, stop and explicitly report or confirm the switch.

## Required outcome
1. Verify the PR is merged.
2. Derive the issue branch/worktree from `AGENTS.md`.
3. Switch the issue worktree to the default branch.
4. Pull the latest default branch in that worktree.
5. Delete the local issue branch.
6. Delete the remote issue branch if it still exists.
7. Move the issue's project item to `Done`.
8. Close the GitHub issue.
9. Post the structured `[WORKFLOW]` issue comment shown below.

## Procedure
1. Derive the expected branch `issues/<project-acronym>-<issue-number>` and worktree `<worktree_root>/<project-acronym>-<issue-number>`.
2. Verify the referenced PR exists and is merged. Do not continue if it is open or merely approved.
3. In the issue worktree:
   - switch from the issue branch to the configured default branch
   - pull the latest default branch
4. Delete the local issue branch.
5. Delete the remote issue branch if it still exists.
6. Move the issue's GitHub Project item to `Done` using GitHub MCP.
7. Close the GitHub issue using GitHub MCP.
8. Post the `[WORKFLOW]` comment on the issue.
9. Return a short completion summary including PR, issue, branch, and cleanup status.

## Exact workflow comment template
```text
[WORKFLOW]
Event: complete
Board: Done
Next-Owner: none
PR: #<pr-number>
```

## Idempotency
- Re-running this skill should succeed even if the branch is already deleted, the remote branch is already gone, the project item is already `Done`, or the issue is already closed.
- The only hard stop is an unmerged PR or missing explicit human approval.
- Do not create follow-up tasks automatically.

## Should not
- merge the PR
- finalize the issue before the PR is merged
- create follow-up tasks automatically

## Notes
- The GitHub Issue is the canonical task record.
- The GitHub Project is the coarse-grained state tracker.
- The PR is the implementation/review artifact and must already be merged before this skill is used.
