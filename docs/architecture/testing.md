# `orfe` testing strategy

## Summary

`orfe` prefers **behavioral tests over structural tests**.

When choosing a test shape, optimize for the most confidence per test:

1. prefer **live E2E** when the flow is high-value, safe, and deterministic
2. otherwise prefer **integration tests with minimal mocking**
3. use **unit tests rarely and intentionally**

Broad behavioral coverage is more valuable here than a large count of narrow tests or inflated coverage numbers.

This strategy preserves the architecture invariants from ADR 0001, ADR 0002, ADR 0007, and `docs/architecture/invariants.md`: tests should reinforce `orfe` as a generic runtime, keep the wrapper/core boundary explicit, and treat command slices as the semantic owners of command behavior.

## Decision rule

Before adding a test, ask:

- what public or architectural boundary am I protecting?
- can a broader behavioral test cover this with the same or better confidence?
- am I mocking only true external boundaries?
- if this is a unit test, why would a broader integration test be insufficient or too costly?

If a test mostly restates implementation structure, command metadata, or wrapper passthrough, it is probably not the right default.

## Preferred test surfaces in this repository

### 1. CLI boundary

Prefer CLI tests when protecting:

- command-line parsing
- usage errors and help output
- JSON success and error envelopes
- caller requirements for direct CLI usage

Use the real `runCli` path with minimal stubbing around config, auth, and network boundaries.

### 2. OpenCode tool boundary

Prefer OpenCode tool tests when protecting:

- `context.agent` handling
- tool-specific input rejection
- OpenCode result envelopes
- plugin/tool contract behavior that is not visible from CLI tests

Test the real `executeOrfeTool` path. Only keep plugin-shape tests when the plugin schema itself is part of the public contract under protection.

### 3. Core runtime boundary

Prefer core tests when protecting:

- wrapper-independent command behavior
- command dispatch, validation, and dependency loading rules
- auth/config/GitHub requirements at the runtime boundary

These tests should exercise the real `runOrfeCore` composition path rather than mocking internal collaborators slice-by-slice.

### 4. Command + GitHub integration path

For GitHub-backed commands, default to integration tests that:

- run the real command through CLI, tool, or core
- use real slice definitions and handlers
- mock only external boundaries such as GitHub HTTP, machine-local auth config, or repo-local config loading

This is the main practical default for `orfe` today.

### 5. Template runtime behavior

Template loading, validation, provenance, and normalization should be tested behaviorally at the template/runtime boundary rather than by inspecting template-loading implementation details.

## Mocking guidance

Mock only true external boundaries when practical:

- GitHub network calls
- machine-local auth/config files
- repo-local config discovery when a test needs a controlled repo shape
- runtime host context such as `context.agent`

Avoid over-mocking internal collaborators when the real integration path is easy to exercise.

## When unit tests are justified

Unit tests are acceptable, but they are the exception rather than the default.

Use them mainly for:

- sensitive auth or security logic
- tricky normalization or validation logic
- small pure functions with failure modes that are hard to diagnose from higher-level tests
- performance-sensitive logic where isolated feedback materially helps

Do **not** default to unit tests just because they are easy to write or increase coverage percentages.

## Low-value test patterns to avoid

Treat these categories skeptically and keep them only when they protect a meaningful public contract:

- **thin forwarding tests** that only prove one wrapper passes inputs straight through
- **source-text assertions** that inspect implementation files instead of runtime behavior
- **shallow metadata tests** that mostly restate command literals, option declarations, or examples
- **duplicated routing/help assertions across layers** when one slice-local suite plus one real boundary suite already covers the contract
- **over-mocked tests** that replace practical internal integration with isolated doubles

Metadata tests are justified only when the metadata itself is the contract, such as published package entrypoints or the OpenCode plugin schema.

## Current suite review and changes applied in issue #159

This issue reviewed the existing suite against the strategy above and reduced several low-signal categories:

- removed thin forwarding tests for the CLI entrypoint wrapper and OpenCode core-input passthrough
- removed duplicated runtime-routing/help tests from broad cross-cutting suites when slice-local help tests already covered the same behavior
- removed metadata-heavy command definition tests that mainly restated static option declarations instead of protecting runtime behavior
- removed the CLI source shebang source-text assertion because it inspected implementation text rather than observable behavior
- kept stronger behavioral tests around CLI execution, OpenCode behavior, core runtime behavior, template validation, and GitHub-backed command flows
- kept contract-oriented metadata checks only where the metadata itself is meaningful public surface, such as package entrypoints and plugin schema exposure

The suite should continue moving toward fewer but broader behavioral tests, especially when a command already has strong CLI/core/tool coverage.

## Live E2E guidance

Live GitHub E2E is worth keeping or adding later for a **small smoke set**, not for every workflow.

Highest-value candidates are:

- bot-auth token minting against a real sandbox installation
- one read/write issue flow in a disposable sandbox repo
- one PR creation or update flow in a disposable sandbox repo
- one project status mutation smoke test if the sandbox setup is reliable

Live E2E should stay selective because `orfe` depends on bot auth, GitHub state, and external API stability. Integration tests with mocked external boundaries remain the main default until safe sandbox E2E is routine.

## Reviewer checklist

When reviewing a new test, prefer these outcomes:

- a meaningful repo boundary is exercised
- internal mocking is minimal
- the test protects behavior, not implementation layout
- a unit test includes a clear reason it is narrower than the default strategy
- no one is using coverage percentage as the primary success metric

## Related docs

- `docs/README.md`
- `docs/architecture/invariants.md`
- `docs/architecture/overview.md`
- `docs/project/debt.md`
