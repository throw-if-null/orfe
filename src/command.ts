import { AuthCore } from './auth-core.js';
import { loadConfig } from './config.js';
import { TokennerError, formatError } from './errors.js';
import { formatProxyListenMessage, startGitHubMcpProxy } from './proxy.js';
import { createDefaultProviderRegistry, ProviderRegistry } from './provider-registry.js';
import { SUPPORTED_ROLES, type LoadedConfig, type OutputFormat, type Role, type TokenIssuer, type TokenResult } from './types.js';

export interface RunCliDependencies {
  env?: NodeJS.ProcessEnv;
  stdout?: Pick<NodeJS.WriteStream, 'write'>;
  stderr?: Pick<NodeJS.WriteStream, 'write'>;
  loadConfigImpl?: (options?: { configPath?: string }) => Promise<LoadedConfig>;
  providerRegistry?: ProviderRegistry;
  tokenIssuer?: TokenIssuer;
  startProxyImpl?: typeof startGitHubMcpProxy;
}

interface ParsedTokenCommand {
  command: 'token';
  role: Role;
  repo: string;
  format: OutputFormat;
}

interface ParsedProxyCommand {
  command: 'proxy';
  repo: string;
  host: string;
  port: number;
  remoteUrl?: string;
}

type ParsedCommand = ParsedTokenCommand | ParsedProxyCommand;

const USAGE = [
  'Usage:',
  '  tokenner token --role <zoran|jelena|greg|klarissa> --repo <owner/name> --format json',
  '  tokenner proxy --repo <owner/name> [--host 127.0.0.1] [--port 8787] [--remote-url https://api.githubcopilot.com/mcp/]',
].join('\n');

export async function runCli(args: string[], dependencies: RunCliDependencies = {}): Promise<number> {
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const env = dependencies.env ?? process.env;
  const loadConfigImpl = dependencies.loadConfigImpl ?? loadConfig;
  const providerRegistry = dependencies.providerRegistry ?? createDefaultProviderRegistry();
  const tokenIssuer =
    dependencies.tokenIssuer ??
    new AuthCore(
      {
        ...(env.TOKENNER_CONFIG_PATH ? { configPath: env.TOKENNER_CONFIG_PATH } : {}),
      },
      {
        loadConfigImpl,
        providerRegistry,
      },
    );
  const startProxyImpl = dependencies.startProxyImpl ?? startGitHubMcpProxy;

  try {
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
      stdout.write(`${USAGE}\n`);
      return 0;
    }

    const parsed = parseArgs(args);

    if (parsed.command === 'token') {
      const result = await tokenIssuer.getToken({
        role: parsed.role,
        repo: parsed.repo,
      });

      writeJson(stdout, result);
      return 0;
    }

    const proxy = await startProxyImpl(
      {
        repo: parsed.repo,
        host: parsed.host,
        port: parsed.port,
        ...(parsed.remoteUrl ? { remoteBaseUrl: parsed.remoteUrl } : {}),
        ...(env.TOKENNER_CONFIG_PATH ? { configPath: env.TOKENNER_CONFIG_PATH } : {}),
      },
      {
        tokenIssuer,
      },
    );

    stdout.write(`${formatProxyListenMessage(proxy)}\n`);
    registerSignalHandlers(proxy.close);
    await proxy.waitUntilClosed();
    return 0;
  } catch (error) {
    stderr.write(`${formatError(error)}\n`);
    return 1;
  }
}

function parseArgs(args: string[]): ParsedCommand {
  const [command, ...rest] = args;

  switch (command) {
    case 'token':
      return parseTokenCommand(rest);
    case 'proxy':
      return parseProxyCommand(rest);
    default:
      throw new TokennerError(`${USAGE}`);
  }
}

function parseTokenCommand(args: string[]): ParsedTokenCommand {
  let role: Role | undefined;
  let repo: string | undefined;
  let format: OutputFormat = 'json';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case '--role': {
        role = parseRole(args[index + 1]);
        index += 1;
        break;
      }
      case '--repo': {
        repo = parseRepo(args[index + 1]);
        index += 1;
        break;
      }
      case '--format': {
        format = parseFormat(args[index + 1]);
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

function parseProxyCommand(args: string[]): ParsedProxyCommand {
  let repo: string | undefined;
  let host = '127.0.0.1';
  let port = 8787;
  let remoteUrl: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case '--repo': {
        repo = parseRepo(args[index + 1]);
        index += 1;
        break;
      }
      case '--host': {
        host = parseHost(args[index + 1]);
        index += 1;
        break;
      }
      case '--port': {
        port = parsePort(args[index + 1]);
        index += 1;
        break;
      }
      case '--remote-url': {
        remoteUrl = parseRemoteUrl(args[index + 1]);
        index += 1;
        break;
      }
      default:
        throw new TokennerError(`Unknown argument "${arg}". ${USAGE}`);
    }
  }

  if (!repo) {
    throw new TokennerError(`Missing required --repo option. ${USAGE}`);
  }

  return {
    command: 'proxy',
    repo,
    host,
    port,
    ...(remoteUrl ? { remoteUrl } : {}),
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

function parseHost(value: string | undefined): string {
  if (!value) {
    throw new TokennerError('Missing value for --host.');
  }

  return value;
}

function parsePort(value: string | undefined): number {
  if (!value) {
    throw new TokennerError('Missing value for --port.');
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TokennerError(`Invalid port "${value}". Expected an integer between 1 and 65535.`);
  }

  return port;
}

function parseRemoteUrl(value: string | undefined): string {
  if (!value) {
    throw new TokennerError('Missing value for --remote-url.');
  }

  try {
    return new URL(value).toString();
  } catch {
    throw new TokennerError(`Invalid URL for --remote-url: ${value}`);
  }
}

function writeJson(stdout: Pick<NodeJS.WriteStream, 'write'>, value: TokenResult): void {
  stdout.write(`${JSON.stringify(value)}\n`);
}

function registerSignalHandlers(close: () => Promise<void>): void {
  const closeOnce = once(close);
  const handleSignal = () => {
    void closeOnce();
  };

  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);
}

function once<TArgs extends unknown[], TResult>(callback: (...args: TArgs) => TResult): (...args: TArgs) => TResult {
  let called = false;
  let result: TResult | undefined;

  return (...args: TArgs) => {
    if (!called) {
      called = true;
      result = callback(...args);
    }

    return result as TResult;
  };
}
