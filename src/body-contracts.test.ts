import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { fileURLToPath } from 'node:url';

import {
  extractBodyContractProvenance,
  loadBodyContract,
  prepareArtifactBody,
  renderBodyContractProvenance,
  validateArtifactBody,
  validateBodyAgainstContract,
} from './body-contracts.js';
import { OrfeError } from './errors.js';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(sourceDirectory, '..');

function createRepoConfig() {
  return createRepoConfigForPath(path.join(workspaceRoot, '.orfe', 'config.json'));
}

function createRepoConfigForPath(configPath: string) {
  return {
    configPath,
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

async function writeIssueContract(options: {
  repoRoot: string;
  contractName: string;
  contractVersion?: string;
  contents: string;
}): Promise<void> {
  const contractVersion = options.contractVersion ?? '1.0.0';
  const contractDirectory = path.join(
    options.repoRoot,
    '.orfe',
    'contracts',
    'issues',
    options.contractName,
  );

  await mkdir(contractDirectory, { recursive: true });
  await writeFile(path.join(contractDirectory, `${contractVersion}.json`), options.contents);
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

test('prepareArtifactBody rejects body_contract when body is omitted', async () => {
  await assert.rejects(
    prepareArtifactBody({
      artifactType: 'issue',
      bodyContract: 'formal-work-item@1.0.0',
      repoConfig: createRepoConfig(),
    }),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'invalid_usage');
      assert.match(error.message, /body_contract requires body/);
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

test('validateBodyAgainstContract enforces the Ref line as the first preamble line', async () => {
  const contract = await loadBodyContract(createRepoConfig(), {
    artifact_type: 'pr',
    contract_name: 'implementation-ready',
    contract_version: '1.0.0',
  });

  assert.throws(
    () => validateBodyAgainstContract(`Intro line\n${createValidPrBody()}`, contract),
    /preamble is missing required pattern/,
  );
});

test('validateArtifactBody returns structured PR validation output agents can act on', async () => {
  const result = await validateArtifactBody({
    artifactType: 'pr',
    body: [
      'Intro line',
      'Ref: #58',
      '',
      '## Summary',
      '',
      '- add PR validation',
      '',
      '## Docs / ADR / debt',
      '',
      '- docs updated: yes',
      '- ADR updated: no',
      '- debt updated: no',
      '- details: updated the spec',
      '',
      'Closes: #58',
    ].join('\n'),
    bodyContract: 'implementation-ready@1.0.0',
    repoConfig: createRepoConfig(),
  });

  assert.deepEqual(result.contract, {
    artifact_type: 'pr',
    contract_name: 'implementation-ready',
    contract_version: '1.0.0',
  });
  assert.equal(result.contract_source, 'explicit');
  assert.equal(result.valid, false);
  assert.equal(result.normalized_body, undefined);
  assert.deepEqual(
    result.errors.map((issue) => issue.kind),
    ['missing_required_pattern', 'matched_forbidden_pattern', 'missing_required_section', 'missing_required_section'],
  );
  assert.equal(result.errors[0]?.scope, 'preamble');
  assert.equal(result.errors[1]?.scope, 'body');
  assert.equal(result.errors[2]?.section_heading, 'Verification');
  assert.equal(result.errors[3]?.section_heading, 'Risks / follow-ups');
});

test('validateArtifactBody requires explicit contract selection or provenance', async () => {
  const result = await validateArtifactBody({
    artifactType: 'pr',
    body: createValidPrBody(),
    repoConfig: createRepoConfig(),
  });

  assert.deepEqual(result, {
    valid: false,
    errors: [
      {
        kind: 'contract_selection_required',
        scope: 'provenance',
        message: 'Body validation requires body_contract or an existing body-contract provenance marker.',
      },
    ],
  });
});

test('validateArtifactBody returns structured issue validation output agents can act on', async () => {
  const result = await validateArtifactBody({
    artifactType: 'issue',
    body: [
      '## Problem / context',
      '',
      'Need deterministic issue-body validation.',
      '',
      '## Desired outcome',
      '',
      'Issue bodies validate against a versioned contract.',
      '',
      '## Scope',
      '',
      '### In scope',
      '- declarative contracts',
      '',
      '## Docs impact',
      '',
      '- Docs impact: maybe',
      '',
      '## ADR needed?',
      '',
      '- ADR needed: no',
    ].join('\n'),
    bodyContract: 'formal-work-item@1.0.0',
    repoConfig: createRepoConfig(),
  });

  assert.deepEqual(result.contract, {
    artifact_type: 'issue',
    contract_name: 'formal-work-item',
    contract_version: '1.0.0',
  });
  assert.equal(result.contract_source, 'explicit');
  assert.equal(result.valid, false);
  assert.equal(result.normalized_body, undefined);
  assert.deepEqual(
    result.errors.map((issue) => issue.kind),
    ['missing_required_pattern', 'missing_required_section', 'invalid_allowed_value'],
  );
  assert.equal(result.errors[0]?.scope, 'section');
  assert.equal(result.errors[0]?.section_heading, 'Scope');
  assert.equal(result.errors[1]?.scope, 'section');
  assert.equal(result.errors[1]?.section_heading, 'Acceptance criteria');
  assert.equal(result.errors[2]?.scope, 'field');
  assert.equal(result.errors[2]?.field_label, 'Docs impact');
});

test('validateArtifactBody normalizes valid issue bodies with provenance', async () => {
  const result = await validateArtifactBody({
    artifactType: 'issue',
    body: createValidIssueBody(),
    bodyContract: 'formal-work-item@1.0.0',
    repoConfig: createRepoConfig(),
  });

  assert.deepEqual(result, {
    valid: true,
    contract: {
      artifact_type: 'issue',
      contract_name: 'formal-work-item',
      contract_version: '1.0.0',
    },
    contract_source: 'explicit',
    normalized_body: `${createValidIssueBody()}\n\n${renderBodyContractProvenance({
      artifact_type: 'issue',
      contract_name: 'formal-work-item',
      contract_version: '1.0.0',
    })}`,
    errors: [],
  });
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

test('loadBodyContract reports missing contracts with contract_not_found', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'orfe-body-contracts-'));

  await assert.rejects(
    loadBodyContract(createRepoConfigForPath(path.join(repoRoot, '.orfe', 'config.json')), {
      artifact_type: 'issue',
      contract_name: 'missing-contract',
      contract_version: '1.0.0',
    }),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'contract_not_found');
      assert.match(error.message, /issue\/missing-contract@1\.0\.0/);
      return true;
    },
  );
});

test('loadBodyContract reports invalid JSON contracts with contract_invalid', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'orfe-body-contracts-'));
  await writeIssueContract({
    repoRoot,
    contractName: 'broken-contract',
    contents: '{not valid json',
  });

  await assert.rejects(
    loadBodyContract(createRepoConfigForPath(path.join(repoRoot, '.orfe', 'config.json')), {
      artifact_type: 'issue',
      contract_name: 'broken-contract',
      contract_version: '1.0.0',
    }),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'contract_invalid');
      assert.match(error.message, /is not valid JSON/);
      return true;
    },
  );
});

test('loadBodyContract resolves contracts from the discovered canonical .orfe root', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'orfe-body-contracts-'));
  await mkdir(path.join(repoRoot, '.orfe'), { recursive: true });
  await writeFile(path.join(repoRoot, '.orfe', 'config.json'), '{}');
  await writeIssueContract({
    repoRoot,
    contractName: 'temp-contract',
    contents: JSON.stringify({
      schema_version: 1,
      artifact_type: 'issue',
      contract_name: 'temp-contract',
      contract_version: '1.0.0',
      sections: [],
    }),
  });

  const contract = await loadBodyContract(createRepoConfigForPath(path.join(repoRoot, 'nested', 'custom-config.json')), {
    artifact_type: 'issue',
    contract_name: 'temp-contract',
    contract_version: '1.0.0',
  });

  assert.equal(contract.contract_name, 'temp-contract');
  assert.equal(contract.contract_version, '1.0.0');
});

test('loadBodyContract falls back to source-relative bundled contracts when configPath is external', async () => {
  const externalDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-body-contracts-'));
  const previousCwd = process.cwd();

  process.chdir(externalDirectory);

  try {
    const contract = await loadBodyContract(createRepoConfigForPath(path.join(externalDirectory, 'nested', 'config.json')), {
      artifact_type: 'issue',
      contract_name: 'formal-work-item',
      contract_version: '1.0.0',
    });

    assert.equal(contract.contract_name, 'formal-work-item');
    assert.equal(contract.artifact_type, 'issue');
  } finally {
    process.chdir(previousCwd);
  }
});

test('validateBodyAgainstContract rejects overlapping docs-impact values not allowed by the formal work-item contract', async () => {
  const contract = await loadBodyContract(createRepoConfig(), {
    artifact_type: 'issue',
    contract_name: 'formal-work-item',
    contract_version: '1.0.0',
  });

  assert.throws(
    () =>
      validateBodyAgainstContract(
        createValidIssueBody().replace(
          '- Docs impact: add new durable docs',
          '- Docs impact: update existing docs and add new durable docs',
        ),
        contract,
      ),
    /must be one of none, update existing docs, add new durable docs/,
  );
});
