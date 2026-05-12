import { OrfeError } from '../errors.js';
import type { BodyValidationIssue } from './types.js';

export function throwFirstValidationIssue(issues: BodyValidationIssue[]): never {
  throw new OrfeError('template_validation_failed', issues[0]?.message ?? 'Template validation failed.');
}
