# Project debt register

This file keeps known documentation, architecture, and process debt visible so it does not disappear into chat history.

## Current debt

### 1. `docs/orfe/spec.md` is still monolithic
- **Impact:** important knowledge is present, but product intent, architecture constraints, decisions, and command detail are still concentrated in one large document.
- **Current treatment:** use `docs/README.md`, the new product/architecture docs, and ADRs as the fast path for project memory.
- **Follow-up direction:** gradually split feature- and command-specific reference material out of the large spec when it becomes worthwhile.

### 2. Generated artifacts can look more authoritative than they are
- **Impact:** `dist/` may contain historical or transitional build output that does not explain the current intended architecture cleanly.
- **Current treatment:** treat source code and docs under `docs/` as canonical; treat generated output as implementation artifacts only.
- **Follow-up direction:** keep generated output aligned with source and reduce confusion where stale artifacts remain visible.

### 3. Some operational auth guidance is still transitional
- **Impact:** repository workflow instructions and runtime architecture can drift if operator guidance lags behind implementation changes.
- **Current treatment:** use `docs/architecture/invariants.md` and ADRs for architecture truth, and keep operational workflow guidance in `AGENTS.md` and role prompts explicit.
- **Follow-up direction:** continue reconciling operator guidance with the runtime as auth-related implementation evolves.

### 4. Feature-level docs are still sparse
- **Impact:** issue, PR, project, and auth flows are described mostly in the large spec rather than in smaller feature-oriented documents.
- **Current treatment:** use the detailed spec for command semantics and the new docs for higher-level memory.
- **Follow-up direction:** add focused feature docs when those areas become active enough to justify their own durable references.
