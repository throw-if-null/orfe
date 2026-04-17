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
- Use the **`orfe` OpenCode function tool** as the preferred mechanism for GitHub state changes: PR verification, issue/project updates, comments, and issue closing.
- Use **local git commands only for branch/worktree cleanup**.
- Exact tool call details may vary by environment, but the workflow outcome below is required.

## Auth rules
- `auth_mode` may be `bot` or `session`.
- If `bot` is requested or implied by repo config, **do not silently fall back** to `session`.
- If bot auth fails, stop and explicitly report or confirm the switch.
- To mint a bot token for `gh` CLI writes: call the `orfe` **function tool** with `command: auth token` and `repo: throw-if-null/orfe`. Do not use bash for token minting — the bash `orfe` CLI is blocked by agent permissions.

## Required outcome
1. Verify the PR is merged.
2. Derive the issue branch/worktree from `AGENTS.md`.
3. Attempt to switch the issue worktree to the default branch.
4. Pull the latest default branch in that worktree when the checkout succeeds.
5. Remove the local issue worktree if it still exists.
6. Delete the local issue branch.
7. Delete the remote issue branch if it still exists.
8. Move the issue's project item to `Done` when a project item exists; otherwise note that no project item exists and continue.
9. Close the GitHub issue.
10. Post the structured `[WORKFLOW]` issue comment shown below.

## Procedure
1. Derive the expected branch `issues/<project-acronym>-<issue-number>` and worktree `<worktree_root>/<project-acronym>-<issue-number>`.
2. Verify the referenced PR exists and is merged. Do not continue if it is open or merely approved.
3. In the issue worktree, attempt to switch from the issue branch to the configured default branch.
   - If the checkout succeeds, pull the latest default branch in that worktree.
   - If the checkout fails specifically because the default branch is already checked out in another worktree, treat that as a non-fatal path: skip the checkout in the issue worktree, skip the pull there, and continue with worktree removal.
   - If the checkout fails for any other reason, stop and report the failure.
4. Remove the issue worktree if it still exists. If step 3 hit the "already checked out in another worktree" case, this removal is how you clear the branch checkout before deleting the branch locally.
5. Delete the local issue branch from the repository root or another remaining worktree.
6. Delete the remote issue branch if it still exists.
7. If the issue has a GitHub Project item, move it to `Done` using the `orfe` OpenCode function tool. If no project item exists, note that in the result and continue.
8. Close the GitHub issue using the `orfe` OpenCode function tool.
9. Post the `[WORKFLOW]` comment on the issue.
10. Return a short completion summary including PR, issue, branch, worktree cleanup status, and whether the project item existed.

## Exact workflow comment template
```text
[WORKFLOW]
Event: complete
Board: Done
Next-Owner: none
PR: #<pr-number>
```

## Idempotency
- Re-running this skill should succeed even if the worktree is already removed, the branch is already deleted, the remote branch is already gone, the project item is already `Done`, the issue is already closed, or the issue never had a project item.
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
- A missing GitHub Project item is non-fatal during completion; the skill should still close the issue and finish cleanup.
