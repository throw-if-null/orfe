export const LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

export interface Logger {
  level: LogLevel;
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

export interface OctokitLogAdapter {
  debug(message: string, additionalInfo?: object): void;
  info(message: string, additionalInfo?: object): void;
  warn(message: string, additionalInfo?: object): void;
  error(message: string, additionalInfo?: object): void;
}

export type LogSink = (entry: LogEntry) => void;

export interface LogWriter {
  write(chunk: string): boolean;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && LOG_LEVELS.includes(value as LogLevel);
}

export function resolveLogLevel(value: unknown, fallback: LogLevel = 'error'): LogLevel {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalizedValue = value.trim().toLowerCase();
  return isLogLevel(normalizedValue) ? normalizedValue : fallback;
}

export function createLogger(options: { level?: LogLevel; sink?: LogSink } = {}): Logger {
  const level = options.level ?? 'error';
  const sink = options.sink ?? (() => undefined);

  const write = (entryLevel: LogLevel, message: string, context?: Record<string, unknown>) => {
    if (LOG_LEVEL_PRIORITY[entryLevel] > LOG_LEVEL_PRIORITY[level]) {
      return;
    }

    sink({
      level: entryLevel,
      message,
      ...(context && Object.keys(context).length > 0 ? { context } : {}),
    });
  };

  return {
    level,
    error(message, context) {
      write('error', message, context);
    },
    warn(message, context) {
      write('warn', message, context);
    },
    info(message, context) {
      write('info', message, context);
    },
    debug(message, context) {
      write('debug', message, context);
    },
  };
}

export function formatLogEntry(entry: LogEntry): string {
  const renderedContext = entry.context && Object.keys(entry.context).length > 0 ? ` ${JSON.stringify(entry.context)}` : '';
  return `[orfe][${entry.level}] ${entry.message}${renderedContext}`;
}

export function createWriteSink(writer: LogWriter): LogSink {
  return (entry) => {
    writer.write(`${formatLogEntry(entry)}\n`);
  };
}

export function createPluginSink(writer: LogWriter, level: LogLevel): LogSink {
  const writeSink = createWriteSink(writer);

  return (entry) => {
    if (level === 'error' && entry.level !== 'error') {
      return;
    }

    writeSink(entry);
  };
}

export function createCliLogger(options: { env?: NodeJS.ProcessEnv; stderr?: LogWriter } = {}): Logger {
  const level = resolveLogLevel(options.env?.ORFE_LOG_LEVEL, 'error');
  const stderr = options.stderr ?? process.stderr;

  return createLogger({
    level,
    sink: createWriteSink(stderr),
  });
}

export function createPluginLogger(options: { env?: NodeJS.ProcessEnv; stderr?: LogWriter } = {}): Logger {
  const level = resolveLogLevel(options.env?.ORFE_LOG_LEVEL, 'error');
  const stderr = options.stderr ?? process.stderr;

  return createLogger({
    level,
    sink: createPluginSink(stderr, level),
  });
}

export function createOctokitLog(logger: Logger): OctokitLogAdapter {
  return {
    debug(message, additionalInfo) {
      logger.debug(message, normalizeAdditionalInfo(additionalInfo));
    },
    info(message, additionalInfo) {
      logger.info(message, normalizeAdditionalInfo(additionalInfo));
    },
    warn(message, additionalInfo) {
      logger.warn(message, normalizeAdditionalInfo(additionalInfo));
    },
    error(message, additionalInfo) {
      logger.error(message, normalizeAdditionalInfo(additionalInfo));
    },
  };
}

function normalizeAdditionalInfo(value: object | undefined): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  return value as Record<string, unknown>;
}
