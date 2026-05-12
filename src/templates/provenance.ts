import { throwFirstValidationIssue } from './errors.js';
import { formatTemplateRef } from './formatters.js';
import type { BodyValidationIssue, TemplateRef } from './types.js';

const PROVENANCE_PATTERN_SOURCE = '<!--\\s*orfe-template:\\s*(issue|pr)\\/([a-z0-9][a-z0-9-]*)@([A-Za-z0-9._-]+)\\s*-->';

export function inspectTemplateProvenance(body: string): { template?: TemplateRef; issues: BodyValidationIssue[] } {
  const matches = [...body.matchAll(new RegExp(PROVENANCE_PATTERN_SOURCE, 'g'))];

  if (matches.length === 0) {
    return { issues: [] };
  }

  if (matches.length > 1) {
    return {
      issues: [
        {
          kind: 'multiple_provenance_markers',
          scope: 'provenance',
          message: 'Artifact body contains multiple template provenance markers.',
        },
      ],
    };
  }

  const match = matches[0];
  if (!match) {
    return { issues: [] };
  }

  return {
    template: {
      artifact_type: match[1] as TemplateRef['artifact_type'],
      template_name: match[2]!,
      template_version: match[3]!,
    },
    issues: [],
  };
}

export function extractTemplateProvenance(body: string): TemplateRef | undefined {
  const provenance = inspectTemplateProvenance(body);

  if (provenance.issues.length > 0) {
    throwFirstValidationIssue(provenance.issues);
  }

  return provenance.template;
}

export function stripTemplateProvenance(body: string): string {
  return body.replace(new RegExp(PROVENANCE_PATTERN_SOURCE, 'g'), '').replace(/\n{3,}/g, '\n\n').trimEnd();
}

export function renderTemplateProvenance(ref: TemplateRef): string {
  return `<!-- orfe-template: ${formatTemplateRef(ref)} -->`;
}

export function renderBodyWithTemplateProvenance(body: string, ref: TemplateRef): string {
  const marker = renderTemplateProvenance(ref);
  const strippedBody = stripTemplateProvenance(body);

  if (strippedBody.trim().length === 0) {
    return marker;
  }

  return `${strippedBody.trimEnd()}\n\n${marker}`;
}
