import assert from 'node:assert/strict';

import { test } from 'vitest';

import { invokeCli } from '../../../../test/support/cli-test.js';
import { createRepoConfig } from '../../../../test/support/command-runtime.js';

test('runCli validates PR bodies without caller identity, auth config, or GitHub access', async () => {
  const result = await invokeCli(
    [
      'pr',
      'validate',
      '--body',
      'Ref: #58\n\n## Summary\n- add PR body validation\n\n## Verification\n- `npm test` ✅\n- `npm run lint` ✅\n- `npm run typecheck` ✅\n- `npm run build` ✅\n\n## Docs / ADR / debt\n- docs updated: yes\n- ADR updated: no\n- debt updated: no\n- details: updated docs/orfe/spec.md\n\n## Risks / follow-ups\n- none',
      '--template',
      'implementation-ready@1.0.0',
    ],
    {
      env: {},
      loadRepoConfigImpl: async () => createRepoConfig(),
      loadAuthConfigImpl: async () => {
        throw new Error('loadAuthConfigImpl should not run');
      },
    },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    command: 'pr validate',
    repo: 'throw-if-null/orfe',
    data: {
      valid: true,
      template: {
        artifact_type: 'pr',
        template_name: 'implementation-ready',
        template_version: '1.0.0',
      },
      template_source: 'explicit',
      normalized_body:
        'Ref: #58\n\n## Summary\n- add PR body validation\n\n## Verification\n- `npm test` ✅\n- `npm run lint` ✅\n- `npm run typecheck` ✅\n- `npm run build` ✅\n\n## Docs / ADR / debt\n- docs updated: yes\n- ADR updated: no\n- debt updated: no\n- details: updated docs/orfe/spec.md\n\n## Risks / follow-ups\n- none\n\n<!-- orfe-template: pr/implementation-ready@1.0.0 -->',
      errors: [],
    },
  });
});

test('runCli prints structured PR validation failures for pr validate', async () => {
  const result = await invokeCli(['pr', 'validate', '--body', 'Ref: #58\n\nCloses: #58', '--template', 'implementation-ready@1.0.0'], {
    env: {},
    loadRepoConfigImpl: async () => createRepoConfig(),
    loadAuthConfigImpl: async () => {
      throw new Error('loadAuthConfigImpl should not run');
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, '');
  assert.equal(JSON.parse(result.stdout).data.valid, false);
  assert.deepEqual(
    JSON.parse(result.stdout).data.errors.map((issue: { kind: string }) => issue.kind),
    ['matched_forbidden_pattern', 'missing_required_section', 'missing_required_section', 'missing_required_section', 'missing_required_section'],
  );
});
