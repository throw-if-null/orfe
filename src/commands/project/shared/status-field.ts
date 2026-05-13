import { OrfeError } from '../../../runtime/errors.js';
import type {
  ProjectSingleSelectFieldNode,
  ProjectSingleSelectFieldOptionNode,
  ProjectSingleSelectFieldValueNode,
} from './graphql-types.js';

export interface ProjectStatusField {
  id: string;
  name: string;
  options: ProjectStatusFieldOption[];
}

export interface ProjectStatusFieldOption {
  id: string;
  name: string;
}

export interface ProjectStatusValue {
  option_id: string;
  name: string;
}

export function selectProjectStatusOption(
  statusField: ProjectStatusField,
  projectOwner: string,
  projectNumber: number,
  targetStatus: string,
): ProjectStatusFieldOption {
  for (const option of statusField.options) {
    if (option.name === targetStatus) {
      return option;
    }
  }

  throw new OrfeError(
    'project_status_option_not_found',
    `GitHub Project ${projectOwner}/${projectNumber} field "${statusField.name}" has no option named "${targetStatus}".`,
  );
}

export function selectProjectStatusField(
  fieldNodes: unknown,
  projectOwner: string,
  projectNumber: number,
  statusFieldName: string,
): ProjectStatusField | null {
  if (!Array.isArray(fieldNodes)) {
    throw new OrfeError('internal_error', `GitHub Project ${projectOwner}/${projectNumber} is missing fields nodes.`);
  }

  for (const rawField of fieldNodes) {
    if (!isObject(rawField)) {
      continue;
    }

    const field = rawField as ProjectSingleSelectFieldNode;
    if (field.__typename !== 'ProjectV2SingleSelectField') {
      continue;
    }

    if (field.name === statusFieldName) {
      if (typeof field.id !== 'string' || field.id.length === 0) {
        throw new OrfeError(
          'internal_error',
          `GitHub Project ${projectOwner}/${projectNumber} returned an invalid id for field "${statusFieldName}".`,
        );
      }

      return {
        id: field.id,
        name: statusFieldName,
        options: readProjectStatusFieldOptions(field.options, projectOwner, projectNumber, statusFieldName),
      };
    }
  }

  return null;
}

export function readProjectStatusValue(
  rawValue: unknown,
  statusField: ProjectStatusField,
  projectOwner: string,
  projectNumber: number,
): ProjectStatusValue | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (!isObject(rawValue)) {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned an invalid value for field "${statusField.name}".`,
    );
  }

  const statusValue = rawValue as ProjectSingleSelectFieldValueNode;
  if (statusValue.__typename !== 'ProjectV2ItemFieldSingleSelectValue') {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned an unexpected value type for field "${statusField.name}".`,
    );
  }

  if (typeof statusValue.optionId !== 'string' || statusValue.optionId.length === 0) {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned an invalid option id for field "${statusField.name}".`,
    );
  }

  if (!isObject(statusValue.field)) {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned invalid field metadata for "${statusField.name}".`,
    );
  }

  const field = statusValue.field as ProjectSingleSelectFieldNode;
  if (field.id !== statusField.id || field.name !== statusField.name) {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned mismatched field metadata for "${statusField.name}".`,
    );
  }

  if (typeof statusValue.name !== 'string') {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned an invalid status value for field "${statusField.name}".`,
    );
  }

  return {
    option_id: statusValue.optionId,
    name: statusValue.name,
  };
}

function readProjectStatusFieldOptions(
  rawOptions: unknown,
  projectOwner: string,
  projectNumber: number,
  statusFieldName: string,
): ProjectStatusFieldOption[] {
  if (rawOptions === undefined || rawOptions === null) {
    return [];
  }

  if (!Array.isArray(rawOptions)) {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned invalid options metadata for field "${statusFieldName}".`,
    );
  }

  return rawOptions.map((rawOption) => readProjectStatusFieldOption(rawOption, projectOwner, projectNumber, statusFieldName));
}

function readProjectStatusFieldOption(
  rawOption: unknown,
  projectOwner: string,
  projectNumber: number,
  statusFieldName: string,
): ProjectStatusFieldOption {
  if (!isObject(rawOption)) {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned an invalid option entry for field "${statusFieldName}".`,
    );
  }

  const option = rawOption as ProjectSingleSelectFieldOptionNode;
  if (typeof option.id !== 'string' || option.id.length === 0) {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned an invalid option id for field "${statusFieldName}".`,
    );
  }

  if (typeof option.name !== 'string') {
    throw new OrfeError(
      'internal_error',
      `GitHub Project ${projectOwner}/${projectNumber} returned an invalid option name for field "${statusFieldName}".`,
    );
  }

  return {
    id: option.id,
    name: option.name,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
