# Project debt register

This file keeps known documentation, architecture, and process debt visible so it does not disappear into chat history.

## Current debt

### 1. `docs/orfe/spec.md` is still monolithic
- **Impact:** important knowledge is present, but product intent, architecture constraints, decisions, and command detail are still concentrated in one large document.
- **Current treatment:** use `docs/README.md`, the new product/architecture docs, and ADRs as the fast path for project memory.
- **Follow-up direction:** gradually split feature- and command-specific reference material out of the large spec when it becomes worthwhile.

### 2. Generated artifacts can look more authoritative than they are
- **Impact:** `dist/` may contain historical or transitional build output that does not explain the current intended architecture cleanly.
- **Current treatment:** treat source code and docs under `docs/` as canonical for project intent and architecture; treat generated output as implementation artifacts unless repo guidance explicitly names a generated helper as operationally required.
- **Follow-up direction:** keep generated output aligned with source and reduce confusion where stale artifacts remain visible.

### 3. Bot token minting still depends on the workspace-root `tokenner` build
- **Impact:** agents currently rely on the workspace-root `dist/cli.js token` command to impersonate GitHub App bot identities. Without it, GitHub operations performed through `gh` would appear as the human session identity instead of the assigned bot role.
- **Current treatment:** preserve the explicit auth guidance in `AGENTS.md` and agent prompts, and do not assume the current issue worktree's build exposes the same token command.
- **Follow-up direction:** add a native `orfe token` command or another first-class bot-token path in a dedicated issue, then retire the transitional `tokenner` dependency intentionally.

### 4. Feature-level docs are still sparse
- **Impact:** issue, PR, project, and auth flows are described mostly in the large spec rather than in smaller feature-oriented documents.
- **Current treatment:** use the detailed spec for command semantics, the architecture overview/auth model docs for system context, and the new docs for higher-level memory.
- **Follow-up direction:** add focused feature docs when those areas become active enough to justify their own durable references.

### 5. Workflow structure now has templates, but enforcement is still lightweight
- **Impact:** issue and handoff quality should improve, but the repo still depends on humans and agents consistently using the templates rather than enforcing them mechanically.
- **Current treatment:** provide a standard issue template and documented handoff formats as the default path.
- **Follow-up direction:** consider GitHub issue forms, additional automation, or skill-level enforcement if drift remains high.

### 6. Some cross-cutting tests are still large after the command-slice refactor
- **Impact:** command metadata and validation ownership now live with slices, but `test/core.test.ts` and `test/cli.test.ts` still contain substantial integration coverage and shared HTTP fixture setup.
- **Current treatment:** keep true runtime and CLI integration coverage in `test/`, while new command-definition ownership tests live beside the slices.
- **Follow-up direction:** continue extracting reusable integration fixtures and shrink the large cross-cutting test files opportunistically without reducing behavior coverage.
