import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { test } from 'vitest';

import {
  extractTemplateProvenance,
  loadTemplate,
  prepareArtifactBody,
  prepareIssueBodyFromInput,
  renderTemplateProvenance,
  validateArtifactBody,
  validateBodyAgainstTemplate,
} from '../../src/templates.js';
import { OrfeError } from '../../src/runtime/errors.js';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(sourceDirectory, '../..');

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

async function writeIssueTemplate(options: {
  repoRoot: string;
  templateName: string;
  templateVersion?: string;
  contents: string;
}): Promise<void> {
  const templateVersion = options.templateVersion ?? '1.0.0';
  const templateDirectory = path.join(options.repoRoot, '.orfe', 'templates', 'issues', options.templateName);

  await mkdir(templateDirectory, { recursive: true });
  await writeFile(path.join(templateDirectory, `${templateVersion}.json`), options.contents);
}

function createValidIssueBody(): string {
  return [
    '## Problem / context',
    '',
    'Need deterministic validation for agent-authored issue bodies.',
    '',
    '## Desired outcome',
    '',
    'Agent-authored issues validate against a versioned template.',
    '',
    '## Scope',
    '',
    '### In scope',
    '- load declarative templates',
    '',
    '### Out of scope',
    '- executable plugins',
    '',
    '## Acceptance criteria',
    '',
    '- [ ] templates load from .orfe/templates',
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
    '- add template loading and validation',
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
    '- details: added the new template docs and ADR',
    '',
    '## Risks / follow-ups',
    '',
    '- richer template-driven body assembly remains follow-up work',
  ].join('\n');
}

test('prepareArtifactBody validates an explicitly selected template and appends provenance', async () => {
  const prepared = await prepareArtifactBody({
    artifactType: 'issue',
    body: createValidIssueBody(),
    template: 'formal-work-item@1.0.0',
    repoConfig: createRepoConfig(),
  });

  assert.deepEqual(prepared, {
    body: `${createValidIssueBody()}\n\n${renderTemplateProvenance({
      artifact_type: 'issue',
      template_name: 'formal-work-item',
      template_version: '1.0.0',
    })}`,
    template: {
      artifact_type: 'issue',
      template_name: 'formal-work-item',
      template_version: '1.0.0',
    },
  });
});

test('prepareArtifactBody validates a provenance-selected template when no explicit selection is provided', async () => {
  const bodyWithMarker = `${createValidIssueBody()}\n\n${renderTemplateProvenance({
    artifact_type: 'issue',
    template_name: 'formal-work-item',
    template_version: '1.0.0',
  })}`;

  const prepared = await prepareArtifactBody({
    artifactType: 'issue',
    body: bodyWithMarker,
    repoConfig: createRepoConfig(),
  });

  assert.equal(prepared?.body, bodyWithMarker);
  assert.deepEqual(extractTemplateProvenance(prepared?.body ?? ''), {
    artifact_type: 'issue',
    template_name: 'formal-work-item',
    template_version: '1.0.0',
  });
});

test('prepareIssueBodyFromInput lives in the template layer and appends provenance', async () => {
  const prepared = await prepareIssueBodyFromInput(
    {
      body: createValidIssueBody(),
      template: 'formal-work-item@1.0.0',
    },
    createRepoConfig(),
  );

  assert.equal(
    prepared,
    `${createValidIssueBody()}\n\n${renderTemplateProvenance({
      artifact_type: 'issue',
      template_name: 'formal-work-item',
      template_version: '1.0.0',
    })}`,
  );
});

test('prepareArtifactBody rejects mismatched explicit and provenance templates', async () => {
  await assert.rejects(
    prepareArtifactBody({
      artifactType: 'issue',
      body: `${createValidIssueBody()}\n\n${renderTemplateProvenance({
        artifact_type: 'issue',
        template_name: 'formal-work-item',
        template_version: '1.0.0',
      })}`,
      template: 'formal-work-item@2.0.0',
      repoConfig: createRepoConfig(),
    }),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'template_validation_failed');
      assert.match(error.message, /does not match provenance marker/);
      return true;
    },
  );
});

test('prepareArtifactBody rejects template when body is omitted', async () => {
  await assert.rejects(
    prepareArtifactBody({
      artifactType: 'issue',
      template: 'formal-work-item@1.0.0',
      repoConfig: createRepoConfig(),
    }),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'invalid_usage');
      assert.match(error.message, /template requires body/);
      return true;
    },
  );
});

test('validateBodyAgainstTemplate rejects forbidden PR auto-closing keywords', async () => {
  const template = await loadTemplate(createRepoConfig(), {
    artifact_type: 'pr',
    template_name: 'implementation-ready',
    template_version: '1.0.0',
  });

  assert.throws(
    () => validateBodyAgainstTemplate(createValidPrBody().replace('Ref: #59', 'Ref: #59\nCloses: #59'), template),
    /matched forbidden pattern/,
  );
});

test('validateBodyAgainstTemplate enforces the Ref line as the first preamble line', async () => {
  const template = await loadTemplate(createRepoConfig(), {
    artifact_type: 'pr',
    template_name: 'implementation-ready',
    template_version: '1.0.0',
  });

  assert.throws(() => validateBodyAgainstTemplate(`Intro line\n${createValidPrBody()}`, template), /preamble is missing required pattern/);
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
    template: 'implementation-ready@1.0.0',
    repoConfig: createRepoConfig(),
  });

  assert.deepEqual(result.template, {
    artifact_type: 'pr',
    template_name: 'implementation-ready',
    template_version: '1.0.0',
  });
  assert.equal(result.template_source, 'explicit');
  assert.equal(result.valid, false);
  assert.equal(result.normalized_body, undefined);
  assert.deepEqual(
    result.errors.map((issue) => issue.kind),
    ['missing_required_pattern', 'matched_forbidden_pattern', 'missing_required_section', 'missing_required_section'],
  );
});

test('validateArtifactBody requires explicit template selection or provenance', async () => {
  const result = await validateArtifactBody({
    artifactType: 'pr',
    body: createValidPrBody(),
    repoConfig: createRepoConfig(),
  });

  assert.deepEqual(result, {
    valid: false,
    errors: [
      {
        kind: 'template_selection_required',
        scope: 'provenance',
        message: 'Body validation requires template or an existing template provenance marker.',
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
      'Issue bodies validate against a versioned template.',
      '',
      '## Scope',
      '',
      '### In scope',
      '- declarative templates',
      '',
      '## Docs impact',
      '',
      '- Docs impact: maybe',
      '',
      '## ADR needed?',
      '',
      '- ADR needed: no',
    ].join('\n'),
    template: 'formal-work-item@1.0.0',
    repoConfig: createRepoConfig(),
  });

  assert.deepEqual(result.template, {
    artifact_type: 'issue',
    template_name: 'formal-work-item',
    template_version: '1.0.0',
  });
  assert.equal(result.template_source, 'explicit');
  assert.equal(result.valid, false);
  assert.equal(result.normalized_body, undefined);
  assert.deepEqual(
    result.errors.map((issue) => issue.kind),
    ['missing_required_pattern', 'missing_required_section', 'invalid_allowed_value'],
  );
});

test('validateArtifactBody normalizes valid issue bodies with provenance', async () => {
  const result = await validateArtifactBody({
    artifactType: 'issue',
    body: createValidIssueBody(),
    template: 'formal-work-item@1.0.0',
    repoConfig: createRepoConfig(),
  });

  assert.deepEqual(result, {
    valid: true,
    template: {
      artifact_type: 'issue',
      template_name: 'formal-work-item',
      template_version: '1.0.0',
    },
    template_source: 'explicit',
    normalized_body: `${createValidIssueBody()}\n\n${renderTemplateProvenance({
      artifact_type: 'issue',
      template_name: 'formal-work-item',
      template_version: '1.0.0',
    })}`,
    errors: [],
  });
});

test('loadTemplate loads the repository-defined versioned template files', async () => {
  const issueTemplate = await loadTemplate(createRepoConfig(), {
    artifact_type: 'issue',
    template_name: 'formal-work-item',
    template_version: '1.0.0',
  });
  const prTemplate = await loadTemplate(createRepoConfig(), {
    artifact_type: 'pr',
    template_name: 'implementation-ready',
    template_version: '1.0.0',
  });

  assert.equal(issueTemplate.artifact_type, 'issue');
  assert.equal(issueTemplate.template_name, 'formal-work-item');
  assert.equal(prTemplate.artifact_type, 'pr');
  assert.equal(prTemplate.template_name, 'implementation-ready');
});

test('loadTemplate reports missing templates with template_not_found', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'orfe-templates-'));

  await assert.rejects(
    loadTemplate(createRepoConfigForPath(path.join(repoRoot, '.orfe', 'config.json')), {
      artifact_type: 'issue',
      template_name: 'missing-template',
      template_version: '1.0.0',
    }),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'template_not_found');
      assert.match(error.message, /issue\/missing-template@1\.0\.0/);
      return true;
    },
  );
});

test('loadTemplate reports invalid JSON templates with template_invalid', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'orfe-templates-'));
  await writeIssueTemplate({
    repoRoot,
    templateName: 'broken-template',
    contents: '{not valid json',
  });

  await assert.rejects(
    loadTemplate(createRepoConfigForPath(path.join(repoRoot, '.orfe', 'config.json')), {
      artifact_type: 'issue',
      template_name: 'broken-template',
      template_version: '1.0.0',
    }),
    (error: unknown) => {
      assert(error instanceof OrfeError);
      assert.equal(error.code, 'template_invalid');
      assert.match(error.message, /is not valid JSON/);
      return true;
    },
  );
});

test('loadTemplate resolves templates from the discovered canonical .orfe root', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'orfe-templates-'));
  await mkdir(path.join(repoRoot, '.orfe'), { recursive: true });
  await writeFile(path.join(repoRoot, '.orfe', 'config.json'), '{}');
  await writeIssueTemplate({
    repoRoot,
    templateName: 'temp-template',
    contents: JSON.stringify({
      schema_version: 1,
      artifact_type: 'issue',
      template_name: 'temp-template',
      template_version: '1.0.0',
      sections: [],
    }),
  });

  const template = await loadTemplate(createRepoConfigForPath(path.join(repoRoot, 'nested', 'custom-config.json')), {
    artifact_type: 'issue',
    template_name: 'temp-template',
    template_version: '1.0.0',
  });

  assert.equal(template.template_name, 'temp-template');
  assert.equal(template.template_version, '1.0.0');
});

test('loadTemplate falls back to source-relative bundled templates when configPath is external', async () => {
  const externalDirectory = await mkdtemp(path.join(os.tmpdir(), 'orfe-templates-'));
  const previousCwd = process.cwd();

  process.chdir(externalDirectory);

  try {
    const template = await loadTemplate(createRepoConfigForPath(path.join(externalDirectory, 'nested', 'config.json')), {
      artifact_type: 'issue',
      template_name: 'formal-work-item',
      template_version: '1.0.0',
    });

    assert.equal(template.template_name, 'formal-work-item');
    assert.equal(template.artifact_type, 'issue');
  } finally {
    process.chdir(previousCwd);
  }
});

test('validateBodyAgainstTemplate rejects overlapping docs-impact values not allowed by the formal work-item template', async () => {
  const template = await loadTemplate(createRepoConfig(), {
    artifact_type: 'issue',
    template_name: 'formal-work-item',
    template_version: '1.0.0',
  });

  assert.throws(
    () =>
      validateBodyAgainstTemplate(
        createValidIssueBody().replace(
          '- Docs impact: add new durable docs',
          '- Docs impact: update existing docs and add new durable docs',
        ),
        template,
      ),
    /must be one of none, update existing docs, add new durable docs/,
  );
});
