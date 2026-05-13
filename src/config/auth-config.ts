import path from 'node:path';

import { OrfeError } from '../runtime/errors.js';
import { expandUserPath } from '../path/path.js';

import {
  expectLiteralNumber,
  expectNumber,
  expectObject,
  expectString,
  isObject,
  readJsonFile,
  resolveAuthConfigPath,
  type GitHubAppBotAuthConfig,
  type LoadAuthConfigOptions,
  type MachineAuthConfig,
} from './shared.js';

export async function loadAuthConfig(options: LoadAuthConfigOptions = {}): Promise<MachineAuthConfig> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const authConfigPath = resolveAuthConfigPath(cwd, options.authConfigPath, options.homeDirectory);
  const parsed = await readJsonFile(authConfigPath, 'machine-local auth config');

  if (!isObject(parsed)) {
    throw new OrfeError('config_invalid', `Auth config at ${authConfigPath} must contain a JSON object.`);
  }

  const version = expectLiteralNumber(parsed.version, 1, `${authConfigPath}: version`);
  const bots = expectObject(parsed.bots, `${authConfigPath}: bots`);
  const loadedBots: MachineAuthConfig['bots'] = {};

  for (const [botName, botValue] of Object.entries(bots)) {
    const botObject = expectObject(botValue, `${authConfigPath}: bots.${botName}`);
    const provider = expectString(botObject.provider, `${authConfigPath}: bots.${botName}.provider`);

    if (provider !== 'github-app') {
      throw new OrfeError(
        'config_invalid',
        `Auth config at ${authConfigPath} only supports provider "github-app" in v1. Received "${provider}" for bot "${botName}".`,
      );
    }

    loadedBots[botName] = {
      provider: 'github-app',
      appId: expectNumber(botObject.app_id, `${authConfigPath}: bots.${botName}.app_id`),
      appSlug: expectString(botObject.app_slug, `${authConfigPath}: bots.${botName}.app_slug`),
      privateKeyPath: expandUserPath(
        expectString(botObject.private_key_path, `${authConfigPath}: bots.${botName}.private_key_path`),
        options.homeDirectory,
      ),
    };
  }

  return {
    configPath: authConfigPath,
    version,
    bots: loadedBots,
  };
}

export function getBotAuthConfig(config: MachineAuthConfig, botName: string): GitHubAppBotAuthConfig {
  const botConfig = config.bots[botName];

  if (!botConfig) {
    throw new OrfeError('auth_failed', `Auth config at ${config.configPath} has no entry for GitHub bot "${botName}".`);
  }

  return botConfig;
}
