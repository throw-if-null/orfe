import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  extractBodyContractProvenance,
  loadBodyContract,
  prepareArtifactBody,
  renderBodyContractProvenance,
  validateBodyAgainstContract,
} from './body-contracts.js';
import { OrfeError } from './errors.js';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(sourceDirectory, '..');

function createRepoConfig() {
  return {
    configPath: path.join(workspaceRoot, '.orfe', 'config.json'),
    version: 1 as const,
    repository: {
      owner: 'throw-if-null',
      name: 'orfe',
      defaultBranch: 'main',
    },
    callerToBot: {
      Greg: 'greg',
    },
  };
}

function createValidIssueBody(): string {
  return [
    '## Problem / context',
    '',
    'Need deterministic validation for agent-authored issue bodies.',
    '',
    '## Desired outcome',
    '',
    'Agent-authored issues validate against a versioned contract.',
    '',
    '## Scope',
    '',
    '### In scope',
    '- load declarative contracts',
    '',
    '### Out of scope',
    '- executable plugins',
    '',
    '## Acceptance criteria',
    '',
    '- [ ] contracts load from .orfe/contracts',
    '',
    '## Docs impact',
    '',
    '- Docs impact: add new durable docs',
    '',
    '## ADR needed?',
    '',
    '- ADR needed: yes',
    '',
    '## Dependencies / sequencing notes',
    '',
    '- land foundation before follow-up validators',
    '',
    '## Risks / open questions / non-goals',
    '',
    '- keep the runtime generic',
  ].join('\n');
}

function createValidPrBody(): string {
  return [
    'Ref: #59',
    '',
    '## Summary',
    '',
    '- add body-contract loading and validation',
    '- append deterministic provenance markers',
    '',
    '## Verification',
    '',
    '- `npm test` ✅',
    '- `npm run lint` ✅',
    '- `npm run typecheck` ✅',
    '- `npm run build` ✅',
    '',
    '## Docs / ADR / debt',
    '',
    '- docs updated: yes',
    '- ADR updated: yes',
    '- debt updated: yes',
    '- details: added the new body-contract docs and ADR',
    '',
    '## Risks / follow-ups',
    '',
    '- richer contract-driven body assembly remains follow-up work',
  ].join('\n');
}

test('prepareArtifactBody validates an explicitly selected contract and appends provenance', async () => {
  const prepared = await prepareArtifactBody({
    artifactType: 'issue',
    body: createValidIssueBody(),
    bodyContract: 'formal-work-item@1.0.0',
    repoConfig: createRepoConfig(),
  });

  assert.deepEqual(prepared, {
    body: `${createValidIssueBody()}\n\n${renderBodyContractProvenance({
      artifact_type: 'issue',
      contract_name: 'formal-work-item',
      contract_version: '1.0.0',
    })}`,
    contract: {
      artifact_type: 'issue',
      contract_name: 'formal-work-item',
      contract_version: '1.0.0',
    },
  });
});

test('prepareArtifactBody validates a provenance-selected contract when no explicit selection is provided', async () => {
  const bodyWithMarker = `${createValidIssueBody()}\n\n${renderBodyContractProvenance({
    artifact_type: 'issue',
    contract_name: 'formal-work-item',
    contract_version: '1.0.0',
  })}`;

  const prepared = await prepareArtifactBody({
    artifactType: 'issue',
    body: bodyWithMarker,
    repoConfig: createRepoConfig(),
  });

  assert.equal(prepared?.body, bodyWithMarker);
  assert.deepEqual(extractBodyContractProvenance(prepared?.body ?? ''), {
    artifact_type: 'issue',
    contract_name: 'formal-work-item',
    contract_version: '1.0.0',
  });
});

test('prepareArtifactBody rejects mismatched explicit and provenance contracts', async () => {
  await assert.rejects(
    prepareArtifactBody({
      artifactType: 'issue',
      body: `${createValidIssueBody()}\n\n${renderBodyContractProvenance({
        artifact_type: 'issue',
        contract_name: 'formal-work-item',
        contract_version: '1.0.0',
      })}`,
      bodyContract: 'formal-work-item@2.0.0',
      repoConfig: createRepoConfig(),
    }),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'contract_validation_failed');
      assert.match(error.message, /does not match provenance marker/);
      return true;
    },
  );
});

test('validateBodyAgainstContract rejects forbidden PR auto-closing keywords', async () => {
  const contract = await loadBodyContract(createRepoConfig(), {
    artifact_type: 'pr',
    contract_name: 'implementation-ready',
    contract_version: '1.0.0',
  });

  assert.throws(
    () =>
      validateBodyAgainstContract(
        createValidPrBody().replace('Ref: #59', 'Ref: #59\nCloses: #59'),
        contract,
      ),
    /matched forbidden pattern/,
  );
});

test('loadBodyContract loads the repository-defined versioned contract files', async () => {
  const issueContract = await loadBodyContract(createRepoConfig(), {
    artifact_type: 'issue',
    contract_name: 'formal-work-item',
    contract_version: '1.0.0',
  });
  const prContract = await loadBodyContract(createRepoConfig(), {
    artifact_type: 'pr',
    contract_name: 'implementation-ready',
    contract_version: '1.0.0',
  });

  assert.equal(issueContract.artifact_type, 'issue');
  assert.equal(issueContract.contract_name, 'formal-work-item');
  assert.equal(prContract.artifact_type, 'pr');
  assert.equal(prContract.contract_name, 'implementation-ready');
});
