import type { TemplateRef } from './types.js';

export function formatTemplateRef(ref: TemplateRef): string {
  return `${ref.artifact_type}/${ref.template_name}@${ref.template_version}`;
}
