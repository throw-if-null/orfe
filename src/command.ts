import { getRoleConfig, loadConfig } from './config.js';
import { TokennerError, formatError } from './errors.js';
import { createDefaultProviderRegistry, ProviderRegistry } from './provider-registry.js';
import { SUPPORTED_ROLES, type LoadedConfig, type OutputFormat, type Role, type TokenResult } from './types.js';

export interface RunCliDependencies {
  env?: NodeJS.ProcessEnv;
  stdout?: Pick<NodeJS.WriteStream, 'write'>;
  stderr?: Pick<NodeJS.WriteStream, 'write'>;
  loadConfigImpl?: (options?: { configPath?: string }) => Promise<LoadedConfig>;
  providerRegistry?: ProviderRegistry;
}

interface ParsedTokenCommand {
  command: 'token';
  role: Role;
  repo: string;
  format: OutputFormat;
}

const USAGE = 'Usage: tokenner token --role <zoran|jelena|greg|klarissa> --repo <owner/name> --format json';

export async function runCli(args: string[], dependencies: RunCliDependencies = {}): Promise<number> {
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const env = dependencies.env ?? process.env;
  const loadConfigImpl = dependencies.loadConfigImpl ?? loadConfig;
  const providerRegistry = dependencies.providerRegistry ?? createDefaultProviderRegistry();

  try {
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
      stdout.write(`${USAGE}\n`);
      return 0;
    }

    const parsed = parseArgs(args);
    const configPath = env.TOKENNER_CONFIG_PATH;
    const config = await loadConfigImpl(configPath ? { configPath } : {});
    const roleConfig = getRoleConfig(config, parsed.role);
    const provider = providerRegistry.get(roleConfig.provider.kind);

    const result = await provider.mintToken({
      role: parsed.role,
      repo: parsed.repo,
      provider: roleConfig.provider,
    });

    writeJson(stdout, result);
    return 0;
  } catch (error) {
    stderr.write(`${formatError(error)}\n`);
    return 1;
  }
}

function parseArgs(args: string[]): ParsedTokenCommand {
  const [command, ...rest] = args;

  if (command !== 'token') {
    throw new TokennerError(`${USAGE}`);
  }

  let role: Role | undefined;
  let repo: string | undefined;
  let format: OutputFormat = 'json';

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    switch (arg) {
      case '--role': {
        role = parseRole(rest[index + 1]);
        index += 1;
        break;
      }
      case '--repo': {
        repo = parseRepo(rest[index + 1]);
        index += 1;
        break;
      }
      case '--format': {
        format = parseFormat(rest[index + 1]);
        index += 1;
        break;
      }
      default:
        throw new TokennerError(`Unknown argument "${arg}". ${USAGE}`);
    }
  }

  if (!role) {
    throw new TokennerError(`Missing required --role option. ${USAGE}`);
  }

  if (!repo) {
    throw new TokennerError(`Missing required --repo option. ${USAGE}`);
  }

  return {
    command: 'token',
    role,
    repo,
    format,
  };
}

function parseRole(value: string | undefined): Role {
  if (!value) {
    throw new TokennerError('Missing value for --role.');
  }

  if ((SUPPORTED_ROLES as readonly string[]).includes(value)) {
    return value as Role;
  }

  throw new TokennerError(`Invalid role "${value}". Supported roles: ${SUPPORTED_ROLES.join(', ')}.`);
}

function parseRepo(value: string | undefined): string {
  if (!value) {
    throw new TokennerError('Missing value for --repo.');
  }

  const parts = value.split('/');

  if (parts.length !== 2 || parts[0]!.length === 0 || parts[1]!.length === 0) {
    throw new TokennerError(`Repository must be in "owner/name" format. Received: ${value}`);
  }

  return value;
}

function parseFormat(value: string | undefined): OutputFormat {
  if (!value) {
    throw new TokennerError('Missing value for --format.');
  }

  if (value !== 'json') {
    throw new TokennerError(`Unsupported format "${value}". tokenner v1 supports json only.`);
  }

  return 'json';
}

function writeJson(stdout: Pick<NodeJS.WriteStream, 'write'>, value: TokenResult): void {
  stdout.write(`${JSON.stringify(value)}\n`);
}
