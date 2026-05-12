import type { Logger } from './logger.js';

export interface OctokitLogAdapter {
  debug(message: string, additionalInfo?: object): void;
  info(message: string, additionalInfo?: object): void;
  warn(message: string, additionalInfo?: object): void;
  error(message: string, additionalInfo?: object): void;
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
