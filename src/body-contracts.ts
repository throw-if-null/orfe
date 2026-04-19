import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OrfeError } from './errors.js';
import { findUp } from './path.js';
import type { RepoLocalConfig } from './types.js';

export type BodyArtifactType = 'issue' | 'pr';

export interface BodyContractRef {
  artifact_type: BodyArtifactType;
  contract_name: string;
  contract_version: string;
}

export interface BodyContractFieldDefinition {
  key: string;
  label: string;
  required?: boolean;
  allowed_values?: string[];
}

export interface BodyContractSectionDefinition {
  id: string;
  heading: string;
  required?: boolean;
  allow_empty?: boolean;
  required_patterns?: string[];
  forbidden_patterns?: string[];
  fields?: BodyContractFieldDefinition[];
}

export interface BodyContractDefinition extends BodyContractRef {
  schema_version: 1;
  description?: string;
  allow_additional_sections?: boolean;
  preamble_required_patterns?: string[];
  preamble_forbidden_patterns?: string[];
  required_patterns?: string[];
  forbidden_patterns?: string[];
  sections: BodyContractSectionDefinition[];
}

export interface PreparedArtifactBody {
  body: string;
  contract: BodyContractRef;
}

interface ParsedBodySection {
  heading: string;
  content: string;
}

interface ParsedBodyStructure {
  preamble: string;
  sections: ParsedBodySection[];
}

const CONTRACT_SELECTION_PATTERN = /^(?:(issue|pr)\/)?([a-z0-9][a-z0-9-]*)@([A-Za-z0-9._-]+)$/;
const PROVENANCE_PATTERN_SOURCE = '<!--\\s*orfe-body-contract:\\s*(issue|pr)\\/([a-z0-9][a-z0-9-]*)@([A-Za-z0-9._-]+)\\s*-->';
const TOP_LEVEL_SECTION_PATTERN = /^##\s+(.+?)\s*$/;

export async function prepareArtifactBody(options: {
  artifactType: BodyArtifactType;
  body?: string;
  bodyContract?: string;
  repoConfig: RepoLocalConfig;
}): Promise<PreparedArtifactBody | undefined> {
  if (options.body === undefined) {
    if (options.bodyContract !== undefined) {
      throw new OrfeError('invalid_usage', 'body_contract requires body in this runtime slice.');
    }

    return undefined;
  }

  const explicitContract =
    typeof options.bodyContract === 'string' ? parseContractSelection(options.bodyContract, options.artifactType) : undefined;
  const markerContract = extractBodyContractProvenance(options.body);
  const resolvedContract = resolveContractRef(options.artifactType, explicitContract, markerContract);

  if (!resolvedContract) {
    return undefined;
  }

  const contract = await loadBodyContract(options.repoConfig, resolvedContract);
  const bodyWithoutMarker = stripBodyContractProvenance(options.body);
  validateBodyAgainstContract(bodyWithoutMarker, contract);

  return {
    body: renderBodyWithContractProvenance(bodyWithoutMarker, contract),
    contract: toContractRef(contract),
  };
}

export async function loadBodyContract(config: RepoLocalConfig, ref: BodyContractRef): Promise<BodyContractDefinition> {
  const contractsRoot = await resolveContractsRoot(config.configPath);
  const contractPath = path.join(
    contractsRoot,
    ref.artifact_type === 'issue' ? 'issues' : 'pr',
    ref.contract_name,
    `${ref.contract_version}.json`,
  );

  let rawContents: string;

  try {
    rawContents = await readFile(contractPath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new OrfeError(
        'contract_not_found',
        `Body contract ${formatBodyContractRef(ref)} was not found at ${contractPath}.`,
      );
    }

    throw new OrfeError('contract_invalid', `Unable to read body contract ${formatBodyContractRef(ref)} at ${contractPath}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContents) as unknown;
  } catch {
    throw new OrfeError('contract_invalid', `Body contract ${formatBodyContractRef(ref)} at ${contractPath} is not valid JSON.`);
  }

  return validateBodyContractDefinition(parsed, contractPath, ref.artifact_type);
}

export function extractBodyContractProvenance(body: string): BodyContractRef | undefined {
  const matches = [...body.matchAll(new RegExp(PROVENANCE_PATTERN_SOURCE, 'g'))];

  if (matches.length === 0) {
    return undefined;
  }

  if (matches.length > 1) {
    throw new OrfeError('contract_validation_failed', 'Artifact body contains multiple body-contract provenance markers.');
  }

  const match = matches[0];
  if (!match) {
    return undefined;
  }

  return {
    artifact_type: match[1] as BodyArtifactType,
    contract_name: match[2]!,
    contract_version: match[3]!,
  };
}

export function stripBodyContractProvenance(body: string): string {
  return body.replace(new RegExp(PROVENANCE_PATTERN_SOURCE, 'g'), '').replace(/\n{3,}/g, '\n\n').trimEnd();
}

export function renderBodyContractProvenance(ref: BodyContractRef): string {
  return `<!-- orfe-body-contract: ${formatBodyContractRef(ref)} -->`;
}

export function renderBodyWithContractProvenance(body: string, ref: BodyContractRef): string {
  const marker = renderBodyContractProvenance(ref);
  const strippedBody = stripBodyContractProvenance(body);

  if (strippedBody.trim().length === 0) {
    return marker;
  }

  return `${strippedBody.trimEnd()}\n\n${marker}`;
}

export function validateBodyAgainstContract(body: string, contract: BodyContractDefinition): void {
  const parsedBody = parseBodyStructure(body);

  assertPatternsMatch(parsedBody.preamble, contract.preamble_required_patterns, 'preamble', 'required');
  assertPatternsMatch(parsedBody.preamble, contract.preamble_forbidden_patterns, 'preamble', 'forbidden');
  assertPatternsMatch(body, contract.required_patterns, 'body', 'required');
  assertPatternsMatch(body, contract.forbidden_patterns, 'body', 'forbidden');

  const sectionsByHeading = new Map<string, ParsedBodySection>();
  for (const section of parsedBody.sections) {
    if (sectionsByHeading.has(section.heading)) {
      throw new OrfeError('contract_validation_failed', `Body contract validation failed: duplicate section heading "${section.heading}".`);
    }

    sectionsByHeading.set(section.heading, section);
  }

  if (contract.allow_additional_sections === false) {
    const allowedHeadings = new Set(contract.sections.map((section) => section.heading));

    for (const section of parsedBody.sections) {
      if (!allowedHeadings.has(section.heading)) {
        throw new OrfeError(
          'contract_validation_failed',
          `Body contract validation failed: section "${section.heading}" is not allowed by ${formatBodyContractRef(contract)}.`,
        );
      }
    }
  }

  for (const sectionDefinition of contract.sections) {
    const parsedSection = sectionsByHeading.get(sectionDefinition.heading);

    if (!parsedSection) {
      if (sectionDefinition.required !== false) {
        throw new OrfeError(
          'contract_validation_failed',
          `Body contract validation failed: missing required section "${sectionDefinition.heading}".`,
        );
      }

      continue;
    }

    if (sectionDefinition.allow_empty !== true && parsedSection.content.trim().length === 0) {
      throw new OrfeError(
        'contract_validation_failed',
        `Body contract validation failed: section "${sectionDefinition.heading}" must not be empty.`,
      );
    }

    assertPatternsMatch(parsedSection.content, sectionDefinition.required_patterns, `section "${sectionDefinition.heading}"`, 'required');
    assertPatternsMatch(parsedSection.content, sectionDefinition.forbidden_patterns, `section "${sectionDefinition.heading}"`, 'forbidden');

    for (const fieldDefinition of sectionDefinition.fields ?? []) {
      validateSectionField(parsedSection, fieldDefinition, contract);
    }
  }
}

function resolveContractRef(
  artifactType: BodyArtifactType,
  explicitContract: BodyContractRef | undefined,
  markerContract: BodyContractRef | undefined,
): BodyContractRef | undefined {
  if (markerContract && markerContract.artifact_type !== artifactType) {
    throw new OrfeError(
      'contract_validation_failed',
      `Artifact body provenance ${formatBodyContractRef(markerContract)} does not match ${artifactType} body validation.`,
    );
  }

  if (explicitContract && markerContract) {
    if (
      explicitContract.artifact_type !== markerContract.artifact_type ||
      explicitContract.contract_name !== markerContract.contract_name ||
      explicitContract.contract_version !== markerContract.contract_version
    ) {
      throw new OrfeError(
        'contract_validation_failed',
        `Explicit body contract ${formatBodyContractRef(explicitContract)} does not match provenance marker ${formatBodyContractRef(markerContract)}.`,
      );
    }

    return explicitContract;
  }

  return explicitContract ?? markerContract;
}

function parseContractSelection(selection: string, expectedArtifactType: BodyArtifactType): BodyContractRef {
  const match = CONTRACT_SELECTION_PATTERN.exec(selection.trim());
  if (!match) {
    throw new OrfeError(
      'invalid_usage',
      `body_contract must be in "<name>@<version>" format. Received "${selection}".`,
    );
  }

  const selectionArtifactType = (match[1] as BodyArtifactType | undefined) ?? expectedArtifactType;
  if (selectionArtifactType !== expectedArtifactType) {
    throw new OrfeError(
      'invalid_usage',
      `body_contract ${selection} targets ${selectionArtifactType}, but this command validates ${expectedArtifactType} bodies.`,
    );
  }

  return {
    artifact_type: selectionArtifactType,
    contract_name: match[2]!,
    contract_version: match[3]!,
  };
}

function parseBodyStructure(body: string): ParsedBodyStructure {
  const lines = body.split(/\r?\n/);
  const sections: ParsedBodySection[] = [];
  const preambleLines: string[] = [];
  let currentSectionHeading: string | undefined;
  let currentSectionLines: string[] = [];

  for (const line of lines) {
    const headingMatch = TOP_LEVEL_SECTION_PATTERN.exec(line);

    if (headingMatch) {
      if (currentSectionHeading) {
        sections.push({
          heading: currentSectionHeading,
          content: currentSectionLines.join('\n').trim(),
        });
      }

      currentSectionHeading = headingMatch[1]!;
      currentSectionLines = [];
      continue;
    }

    if (currentSectionHeading) {
      currentSectionLines.push(line);
    } else {
      preambleLines.push(line);
    }
  }

  if (currentSectionHeading) {
    sections.push({
      heading: currentSectionHeading,
      content: currentSectionLines.join('\n').trim(),
    });
  }

  return {
    preamble: preambleLines.join('\n').trim(),
    sections,
  };
}

function validateSectionField(
  parsedSection: ParsedBodySection,
  fieldDefinition: BodyContractFieldDefinition,
  contract: BodyContractDefinition,
): void {
  const fieldPattern = new RegExp(`^\\s*-\\s*${escapeRegExp(fieldDefinition.label)}:\\s*(.+?)\\s*$`, 'gm');
  const matches = [...parsedSection.content.matchAll(fieldPattern)].map((match) => match[1]!.trim());

  if (matches.length === 0) {
    if (fieldDefinition.required !== false) {
      throw new OrfeError(
        'contract_validation_failed',
        `Body contract validation failed: missing required field "${fieldDefinition.label}" in section "${parsedSection.heading}" for ${formatBodyContractRef(contract)}.`,
      );
    }

    return;
  }

  if (matches.length > 1) {
    throw new OrfeError(
      'contract_validation_failed',
      `Body contract validation failed: field "${fieldDefinition.label}" appears multiple times in section "${parsedSection.heading}".`,
    );
  }

  const fieldValue = matches[0];
  if (!fieldValue || fieldValue.length === 0) {
    throw new OrfeError(
      'contract_validation_failed',
      `Body contract validation failed: field "${fieldDefinition.label}" in section "${parsedSection.heading}" must not be empty.`,
    );
  }

  if (fieldDefinition.allowed_values && !fieldDefinition.allowed_values.includes(fieldValue)) {
    throw new OrfeError(
      'contract_validation_failed',
      `Body contract validation failed: field "${fieldDefinition.label}" in section "${parsedSection.heading}" must be one of ${fieldDefinition.allowed_values.join(', ')}.`,
    );
  }
}

function assertPatternsMatch(
  value: string,
  patterns: string[] | undefined,
  label: string,
  mode: 'required' | 'forbidden',
): void {
  for (const pattern of patterns ?? []) {
    const regex = createContractPattern(pattern, label);
    const matched = regex.test(value);

    if (mode === 'required' && !matched) {
      throw new OrfeError('contract_validation_failed', `Body contract validation failed: ${label} is missing required pattern ${pattern}.`);
    }

    if (mode === 'forbidden' && matched) {
      throw new OrfeError('contract_validation_failed', `Body contract validation failed: ${label} matched forbidden pattern ${pattern}.`);
    }
  }
}

function createContractPattern(pattern: string, label: string): RegExp {
  try {
    return new RegExp(pattern, 'm');
  } catch {
    throw new OrfeError('contract_invalid', `Body contract ${label} contains invalid regex pattern "${pattern}".`);
  }
}

async function resolveContractsRoot(configPath: string): Promise<string> {
  const configDirectory = path.dirname(configPath);

  if (path.basename(configDirectory) === '.orfe') {
    return path.join(configDirectory, 'contracts');
  }

  const canonicalConfigPath = await findUp(configDirectory, '.orfe/config.json');
  if (canonicalConfigPath) {
    return path.join(path.dirname(canonicalConfigPath), 'contracts');
  }

  const sourceRelativeContractsRoot = await findUp(path.dirname(fileURLToPath(import.meta.url)), '.orfe/contracts');
  if (sourceRelativeContractsRoot) {
    return sourceRelativeContractsRoot;
  }

  const runtimeContractsRoot = await findUp(process.cwd(), '.orfe/contracts');
  if (runtimeContractsRoot) {
    return runtimeContractsRoot;
  }

  return path.join(configDirectory, '.orfe', 'contracts');
}

function validateBodyContractDefinition(
  value: unknown,
  contractPath: string,
  expectedArtifactType: BodyArtifactType,
): BodyContractDefinition {
  const contract = expectObject(value, contractPath);
  const schemaVersion = expectLiteralNumber(contract.schema_version, 1, `${contractPath}: schema_version`);
  const artifactType = expectArtifactType(contract.artifact_type, `${contractPath}: artifact_type`);

  if (artifactType !== expectedArtifactType) {
    throw new OrfeError(
      'contract_invalid',
      `Body contract ${contractPath} declares artifact_type "${artifactType}", expected "${expectedArtifactType}".`,
    );
  }

  const contractName = expectNonEmptyString(contract.contract_name, `${contractPath}: contract_name`);
  const contractVersion = expectNonEmptyString(contract.contract_version, `${contractPath}: contract_version`);
  const sections = expectArray(contract.sections, `${contractPath}: sections`).map((entry, index) =>
    validateBodyContractSection(entry, `${contractPath}: sections[${index}]`),
  );

  const validatedContract: BodyContractDefinition = {
    schema_version: schemaVersion,
    artifact_type: artifactType,
    contract_name: contractName,
    contract_version: contractVersion,
    sections,
  };

  if (contract.description !== undefined) {
    validatedContract.description = expectNonEmptyString(contract.description, `${contractPath}: description`);
  }

  if (contract.allow_additional_sections !== undefined) {
    validatedContract.allow_additional_sections = expectBoolean(
      contract.allow_additional_sections,
      `${contractPath}: allow_additional_sections`,
    );
  }

  assignPatternArray(contract, validatedContract, contractPath, 'preamble_required_patterns');
  assignPatternArray(contract, validatedContract, contractPath, 'preamble_forbidden_patterns');
  assignPatternArray(contract, validatedContract, contractPath, 'required_patterns');
  assignPatternArray(contract, validatedContract, contractPath, 'forbidden_patterns');

  return validatedContract;
}

function validateBodyContractSection(value: unknown, label: string): BodyContractSectionDefinition {
  const section = expectObject(value, label);
  const validatedSection: BodyContractSectionDefinition = {
    id: expectNonEmptyString(section.id, `${label}: id`),
    heading: expectNonEmptyString(section.heading, `${label}: heading`),
  };

  if (section.required !== undefined) {
    validatedSection.required = expectBoolean(section.required, `${label}: required`);
  }

  if (section.allow_empty !== undefined) {
    validatedSection.allow_empty = expectBoolean(section.allow_empty, `${label}: allow_empty`);
  }

  assignPatternArray(section, validatedSection, label, 'required_patterns');
  assignPatternArray(section, validatedSection, label, 'forbidden_patterns');

  if (section.fields !== undefined) {
    validatedSection.fields = expectArray(section.fields, `${label}: fields`).map((entry, index) =>
      validateBodyContractField(entry, `${label}: fields[${index}]`),
    );
  }

  return validatedSection;
}

function validateBodyContractField(value: unknown, label: string): BodyContractFieldDefinition {
  const field = expectObject(value, label);
  const validatedField: BodyContractFieldDefinition = {
    key: expectNonEmptyString(field.key, `${label}: key`),
    label: expectNonEmptyString(field.label, `${label}: label`),
  };

  if (field.required !== undefined) {
    validatedField.required = expectBoolean(field.required, `${label}: required`);
  }

  if (field.allowed_values !== undefined) {
    validatedField.allowed_values = expectArray(field.allowed_values, `${label}: allowed_values`).map((entry, index) =>
      expectNonEmptyString(entry, `${label}: allowed_values[${index}]`),
    );
  }

  return validatedField;
}

function assignPatternArray<
  TTarget extends Partial<
    Pick<BodyContractDefinition, 'preamble_required_patterns' | 'preamble_forbidden_patterns' | 'required_patterns' | 'forbidden_patterns'> &
      Pick<BodyContractSectionDefinition, 'required_patterns' | 'forbidden_patterns'>
  >,
>(
  source: Record<string, unknown>,
  target: TTarget,
  label: string,
  key: 'preamble_required_patterns' | 'preamble_forbidden_patterns' | 'required_patterns' | 'forbidden_patterns',
): void {
  if (source[key] === undefined) {
    return;
  }

  const patterns = expectArray(source[key], `${label}: ${key}`).map((entry, index) =>
    expectNonEmptyString(entry, `${label}: ${key}[${index}]`),
  );

  for (const pattern of patterns) {
    createContractPattern(pattern, `${label}: ${key}`);
  }

  target[key] = patterns;
}

function toContractRef(contract: BodyContractRef): BodyContractRef {
  return {
    artifact_type: contract.artifact_type,
    contract_name: contract.contract_name,
    contract_version: contract.contract_version,
  };
}

function formatBodyContractRef(ref: BodyContractRef): string {
  return `${ref.artifact_type}/${ref.contract_name}@${ref.contract_version}`;
}

function expectObject(value: unknown, label: string): Record<string, unknown> {
  if (!isObject(value)) {
    throw new OrfeError('contract_invalid', `${label} must be an object.`);
  }

  return value;
}

function expectArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new OrfeError('contract_invalid', `${label} must be an array.`);
  }

  return value;
}

function expectNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OrfeError('contract_invalid', `${label} must be a non-empty string.`);
  }

  return value;
}

function expectBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new OrfeError('contract_invalid', `${label} must be a boolean.`);
  }

  return value;
}

function expectLiteralNumber(value: unknown, expected: 1, label: string): 1 {
  if (value !== expected) {
    throw new OrfeError('contract_invalid', `${label} must be ${expected}.`);
  }

  return expected;
}

function expectArtifactType(value: unknown, label: string): BodyArtifactType {
  if (value === 'issue' || value === 'pr') {
    return value;
  }

  throw new OrfeError('contract_invalid', `${label} must be "issue" or "pr".`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
