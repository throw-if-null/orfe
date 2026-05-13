import path from 'node:path';

import { OrfeError } from '../runtime/errors.js';

import {
  expectLiteralNumber,
  expectNumber,
  expectObject,
  expectString,
  isObject,
  readJsonFile,
  resolveRepoConfigPath,
  type LoadRepoConfigOptions,
  type RepoLocalConfig,
} from './shared.js';

export async function loadRepoConfig(options: LoadRepoConfigOptions = {}): Promise<RepoLocalConfig> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const configPath = await resolveRepoConfigPath(cwd, options.configPath);
  const parsed = await readJsonFile(configPath, 'repo-local config');

  if (!isObject(parsed)) {
    throw new OrfeError('config_invalid', `Repo config at ${configPath} must contain a JSON object.`);
  }

  const version = expectLiteralNumber(parsed.version, 1, `${configPath}: version`);
  const repository = expectObject(parsed.repository, `${configPath}: repository`);
  const callerToBot = expectObject(parsed.caller_to_bot, `${configPath}: caller_to_bot`);

  const loadedConfig: RepoLocalConfig = {
    configPath,
    version,
    repository: {
      owner: expectString(repository.owner, `${configPath}: repository.owner`),
      name: expectString(repository.name, `${configPath}: repository.name`),
      defaultBranch: expectString(repository.default_branch, `${configPath}: repository.default_branch`),
    },
    callerToBot: readCallerBotMapping(callerToBot, configPath),
  };

  if ('projects' in parsed && parsed.projects !== undefined) {
    const projects = expectObject(parsed.projects, `${configPath}: projects`);

    if ('default' in projects && projects.default !== undefined) {
      const projectDefaults = expectObject(projects.default, `${configPath}: projects.default`);
      loadedConfig.projects = {
        default: {
          ...('owner' in projectDefaults && projectDefaults.owner !== undefined
            ? { owner: expectString(projectDefaults.owner, `${configPath}: projects.default.owner`) }
            : {}),
          ...('project_number' in projectDefaults && projectDefaults.project_number !== undefined
            ? { projectNumber: expectNumber(projectDefaults.project_number, `${configPath}: projects.default.project_number`) }
            : {}),
          ...('status_field_name' in projectDefaults && projectDefaults.status_field_name !== undefined
            ? {
                statusFieldName: expectString(
                  projectDefaults.status_field_name,
                  `${configPath}: projects.default.status_field_name`,
                ),
              }
            : {}),
        },
      };
    }
  }

  return loadedConfig;
}

export function resolveCallerBot(config: RepoLocalConfig, callerName: string): string {
  const normalizedCallerName = callerName.trim();

  if (normalizedCallerName.length === 0) {
    throw new OrfeError('caller_name_missing', 'Caller name is required.');
  }

  const botName = config.callerToBot[normalizedCallerName];
  if (!botName) {
    throw new OrfeError('caller_name_unmapped', `Caller name "${normalizedCallerName}" is not mapped in ${config.configPath}.`);
  }

  return botName;
}

function readCallerBotMapping(value: Record<string, unknown>, configPath: string): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const [callerName, botName] of Object.entries(value)) {
    if (callerName.trim().length === 0) {
      throw new OrfeError('config_invalid', `Repo config at ${configPath} contains an empty caller_to_bot key.`);
    }

    mapping[callerName] = expectString(botName, `${configPath}: caller_to_bot.${callerName}`);
  }

  return mapping;
}
