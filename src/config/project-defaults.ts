import { OrfeError } from '../runtime/errors.js';

import type { ProjectCommandOptions, RepoLocalConfig, ResolvedProjectConfig } from './shared.js';

type ProjectDefaults = RepoLocalConfig['projects'] extends infer T ? (T extends { default?: infer D } ? D : never) : never;

export function resolveProjectCommandConfig(
  config: RepoLocalConfig,
  options: ProjectCommandOptions = {},
): ResolvedProjectConfig {
  const projectDefaults = config.projects?.default;
  const projectOwner = readProjectOwner(options, projectDefaults, config.configPath);
  const projectNumber = readProjectNumber(options, projectDefaults, config.configPath);
  const statusFieldName = readStatusFieldName(options, projectDefaults);

  return {
    projectOwner,
    projectNumber,
    statusFieldName,
  };
}

function readProjectOwner(
  options: ProjectCommandOptions,
  defaults: ProjectDefaults | undefined,
  configPath: string,
): string {
  if (typeof options.project_owner === 'string' && options.project_owner.trim().length > 0) {
    return options.project_owner.trim();
  }

  if (defaults?.owner) {
    return defaults.owner;
  }

  throw new OrfeError(
    'invalid_usage',
    `Project commands require --project-owner when ${configPath} has no projects.default.owner.`,
  );
}

function readProjectNumber(
  options: ProjectCommandOptions,
  defaults: ProjectDefaults | undefined,
  configPath: string,
): number {
  if (typeof options.project_number === 'number' && Number.isInteger(options.project_number) && options.project_number >= 0) {
    return options.project_number;
  }

  if (defaults?.projectNumber !== undefined) {
    return defaults.projectNumber;
  }

  throw new OrfeError(
    'invalid_usage',
    `Project commands require --project-number when ${configPath} has no projects.default.project_number.`,
  );
}

function readStatusFieldName(options: ProjectCommandOptions, defaults: ProjectDefaults | undefined): string {
  if (typeof options.status_field_name === 'string' && options.status_field_name.trim().length > 0) {
    return options.status_field_name.trim();
  }

  return defaults?.statusFieldName ?? 'Status';
}
