# ADR 0002: the wrapper reads runtime context and the core receives plain data

- Status: Accepted
- Date: 2026-04-10

## Context

`orfe` has two entrypoints: a CLI and an OpenCode tool wrapper.
Only the OpenCode wrapper has access to runtime-specific caller context such as `context.agent`.

If the core depended on that runtime context directly, it would become harder to test, less reusable, and coupled to a single execution environment.

## Decision

The OpenCode wrapper is the only layer allowed to read runtime-specific caller context.
After resolving caller identity, it passes only plain structured input and `callerName` into the core.

The core remains runtime-agnostic and callable from both CLI and OpenCode wrapper entrypoints.

## Consequences

- The core stays testable with plain requests.
- CLI and wrapper entrypoints can share one runtime implementation.
- OpenCode-specific concerns are isolated to the wrapper boundary.
- Future changes that need runtime-specific data must be evaluated carefully to avoid breaking this boundary.
