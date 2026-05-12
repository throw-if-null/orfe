import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { OrfeError } from '../runtime/errors.js';
import type { RepoLocalConfig } from '../config/shared.js';
import { formatTemplateRef } from './formatters.js';
import { resolveTemplatesRoot } from './root.js';
import { validateTemplateDefinition } from './schema.js';
import type { TemplateDefinition, TemplateRef } from './types.js';

export async function loadTemplate(config: RepoLocalConfig, ref: TemplateRef): Promise<TemplateDefinition> {
  const templatesRoot = await resolveTemplatesRoot(config.configPath);
  const templatePath = path.join(
    templatesRoot,
    ref.artifact_type === 'issue' ? 'issues' : 'pr',
    ref.template_name,
    `${ref.template_version}.json`,
  );

  let rawContents: string;

  try {
    rawContents = await readFile(templatePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new OrfeError('template_not_found', `Template ${formatTemplateRef(ref)} was not found at ${templatePath}.`);
    }

    throw new OrfeError('template_invalid', `Unable to read template ${formatTemplateRef(ref)} at ${templatePath}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContents) as unknown;
  } catch {
    throw new OrfeError('template_invalid', `Template ${formatTemplateRef(ref)} at ${templatePath} is not valid JSON.`);
  }

  return validateTemplateDefinition(parsed, templatePath, ref.artifact_type);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
