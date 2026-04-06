# AGENTS.md

## Operating context

Agents in this repository operate inside the **OpenCode agent environment**. OpenCode is an open source AI coding agent available in terminal, desktop, and IDE contexts; this repository is operated through OpenCode. Work should follow the OpenCode environment rules, this repo's workflow, and any higher-priority system/developer instructions.

- OpenCode supports **primary agents** and **subagents**. Agents may invoke subagents and use built-in tools when appropriate.
- `AGENTS.md` defines repository-wide/shared policy and operating constraints. Exact role-specific instructions belong in the relevant agent definition/prompt. Skills, commands, and tools provide reusable execution support inside those constraints.

## OpenCode primitives

- **Skills**: reusable workflow guidance discovered from `.opencode/skills/*/SKILL.md` and loaded on demand. If a relevant skill exists, agents should prefer it over improvising a workflow.
- **Commands**: reusable prompt entrypoints from `.opencode/commands/*`, useful for repeated human-triggered workflows.
- **Tools**: callable capabilities used to perform actions. Custom tools from `.opencode/tools/*` should be used for deterministic helpers such as auth helpers, GitHub wrappers, validation, and similar automation.
- If `AGENTS.md` and a loaded skill disagree, **ask for clarification before proceeding**.

## Repository workflow config

```yaml
github_owner: throw-if-null
repo_name: orfe
project_name: Orfe
project_acronym: orfe
default_branch: main
worktree_root: .worktrees
branch_prefix: issues
canonical_task_system: github
canonical_task_object: issue
project_board_type: github-project
project_board_status_field: Status
project_board_values: [Todo, In Progress, Done]
labels: [blocked, needs-input, duplicate, wont-do]
auth:
  preferred_mode: bot
  allowed_modes: [bot, session]
  token_cli: "node /home/backsippan/gh/tin/orfe/dist/cli.js token --role <role> --repo throw-if-null/orfe --format json"
  bot_roles:
    zoran: Z0R4N-BOT
    jelena: J3L3N4-BOT
    greg: GR3G-BOT
    klarissa: KL4R1554-BOT
```

## Role model

### Human
- Sets priorities, approves scope, and gives final human review/approval.
- Decides when merged work is complete from a product perspective.

### Zoran
- Product strategy and backlog-shaping partner to the human.
- Co-owns product/task definition with the human.
- Creates, refines, and updates GitHub issues/projects to reflect agreed scope and plans.
- Does not bypass the issue-driven workflow.

### Jelena
- Orchestrator for execution.
- Assigns and sequences work.
- Decides who owns the next step.
- Workers do not pull backlog autonomously; Jelena directs work.

### Greg
- Implementation worker.
- Makes code changes, updates tests, verifies the branch, and prepares PRs.

### Klarissa
- QA/review worker.
- Validates behavior, requests changes when needed, and marks QA outcomes.

## Source of truth

- **GitHub Issue is the canonical task record.**
- **GitHub Project is the canonical coarse-grained state tracker** using `Todo`, `In Progress`, and `Done`.
- **Pull requests are for implementation and review only**; they are not the canonical task definition.

## Ownership rules

- Exactly **one active worker per issue** at a time.
- **One issue = one branch = one worktree**.
- Jelena orchestrates ownership transitions.
- Workers must **not** pull new backlog items autonomously.
- If ownership is unclear, stop and ask.

## Branch and worktree conventions

- Branch name: `issues/<project-acronym>-<issue-number>`
- Branch example: `issues/orfe-123`
- Worktree path: `.worktrees/<project-acronym>-<issue-number>`
- Worktree example: `.worktrees/orfe-123`
- Do not work on multiple issues in the same worktree.

## GitHub auth rules

- Preferred GitHub auth mode is **bot**.
- Allowed auth modes: **bot** and **session**.
- **No silent fallback from bot to session auth.** If bot auth fails, stop, report it, and explicitly confirm or document the switch to session auth.
- When acting as a bot, use the repo role mapping from the YAML config. Critical role-specific behavior belongs in the relevant agent definition/prompt.
- In this repository, the supported bot token helper is the **workspace-root** CLI build at `/home/backsippan/gh/tin/orfe/dist/cli.js`.
- Do **not** assume the current issue worktree's `dist/cli.js` still exposes the legacy `token` command.
- When minting bot tokens from an issue worktree, call the workspace-root helper explicitly, for example:

```bash
TOKEN=$(node /home/backsippan/gh/tin/orfe/dist/cli.js token --role <role> --repo throw-if-null/orfe --format json | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).token)")
```

## Skill usage by phase

- `AGENTS.md` defines shared repo policy; skills define phase/workflow execution details; agent definitions/prompts define critical role-specific behavior.
- **task-start**: load/use the relevant task-start skill before beginning work.
- **task-implementation-ready**: load/use the implementation-ready skill before opening or updating a pull request.
- **task-complete**: load/use the completion/handoff skill before marking work complete.
- If the required skill is unavailable in the OpenCode environment, follow this file and report that the skill was unavailable.

## Workflow event vocabulary

Workflow-significant updates must be recorded in the GitHub issue using structured `[WORKFLOW]` comments.

The exact comment format/template is defined by the relevant workflow skills.

Allowed `Event` values:

- `start`
- `implementation-ready`
- `qa-changes-requested`
- `qa-passed`
- `blocked`
- `needs-input`
- `ready-for-human-review`
- `complete`
- `wont-do`
- `duplicate`

Do not invent new workflow states if an existing event fits.

## Pull request rules

- Open a PR only for implementation/review work tied to a GitHub issue.
- Keep PR scope aligned to the single issue branch.
- Reference the canonical issue in the PR.
- Ensure implementation, tests, and verification are complete before requesting review.
- Do not treat PR open/close state as the task source of truth.

## Standard workflow

1. Jelena assigns or confirms the issue owner.
2. Create or use the issue branch: `issues/<project-acronym>-<issue-number>`.
3. Create or use the matching worktree: `.worktrees/<project-acronym>-<issue-number>`.
4. Post a `[WORKFLOW]` comment with `Event: start` and set/confirm board state `In Progress`.
5. Implement or review according to role.
6. If implementation is ready, open/update PR and post `Event: implementation-ready`.
7. Klarissa performs QA and posts either `qa-changes-requested` or `qa-passed`.
8. When QA passes and the branch is ready for final review, post `ready-for-human-review`.
9. After merge **and** human approval, post `complete` and move the issue to `Done`.

## Safety rules

- No silent fallback from bot to session auth.
- Do not move an issue to `Done` before **merge + human approval**.
- Do not delete branches before confirming merge.
- Do not work on multiple issues in the same worktree.
- Do not invent new workflow states if an existing event fits.
- If `AGENTS.md` and a skill disagree, ask for clarification.
