import { OrfeError } from '../../../runtime/errors.js';
import type { ProjectAddItemMutationResponse } from './graphql-types.js';

const PROJECT_ADD_ITEM_MUTATION = `
  mutation AddProjectItem($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(
      input: {
        projectId: $projectId
        contentId: $contentId
      }
    ) {
      item {
        id
      }
    }
  }
`;

const PROJECT_STATUS_UPDATE_MUTATION = `
  mutation UpdateProjectStatus($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }
    ) {
      clientMutationId
    }
  }
`;

export interface ProjectAddItemResult {
  projectId: string;
  projectItemId: string;
}

export async function updateProjectStatus(
  graphql: <TResponse>(query: string, variables?: Record<string, unknown>) => Promise<TResponse>,
  projectId: string,
  itemId: string,
  fieldId: string,
  optionId: string,
): Promise<void> {
  await graphql(PROJECT_STATUS_UPDATE_MUTATION, {
    projectId,
    itemId,
    fieldId,
    optionId,
  });
}

export async function addProjectItemByContentId(
  graphql: <TResponse>(query: string, variables?: Record<string, unknown>) => Promise<TResponse>,
  projectId: string,
  contentId: string,
): Promise<ProjectAddItemResult> {
  const response = await graphql<ProjectAddItemMutationResponse>(PROJECT_ADD_ITEM_MUTATION, {
    projectId,
    contentId,
  });

  const mutationResult = response.addProjectV2ItemById;
  if (!isObject(mutationResult) || !isObject(mutationResult.item) || typeof mutationResult.item.id !== 'string' || mutationResult.item.id.length === 0) {
    throw new OrfeError('internal_error', 'GitHub project add-item response is missing a valid project item id.');
  }

  return {
    projectId,
    projectItemId: mutationResult.item.id,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
