import { OrfeError } from '../runtime/errors.js';

export function expectLiteralNumber(value: unknown, expected: 1, label: string): 1 {
  if (value !== expected) {
    throw new OrfeError('config_invalid', `${label} must be ${expected}.`);
  }

  return expected;
}

export function expectString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OrfeError('config_invalid', `${label} must be a non-empty string.`);
  }

  return value;
}

export function expectNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new OrfeError('config_invalid', `${label} must be a non-negative integer.`);
  }

  return value;
}

export function expectObject(value: unknown, label: string): Record<string, unknown> {
  if (!isObject(value)) {
    throw new OrfeError('config_invalid', `${label} must be an object.`);
  }

  return value;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
