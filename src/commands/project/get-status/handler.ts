import { resolveProjectCommandConfig } from '../../../config/project-defaults.js';
import type { CommandContext } from '../../../core/context.js';
import {
  mapProjectGetStatusError,
  resolveProjectStatusContext,
  type ProjectGetStatusData,
  type ProjectItemType,
} from '../shared.js';

export async function handleProjectGetStatus(context: CommandContext<'project get-status'>): Promise<ProjectGetStatusData> {
  const itemType = context.input.item_type as ProjectItemType;
  const itemNumber = context.input.item_number as number;
  const projectConfig = resolveProjectCommandConfig(context.repoConfig, context.input);

  try {
    const { graphql } = await context.getGitHubClient();
    const resolvedStatusContext = await resolveProjectStatusContext(
      graphql,
      context.repo.owner,
      context.repo.name,
      projectConfig.projectOwner,
      projectConfig.projectNumber,
      projectConfig.statusFieldName,
      itemType,
      itemNumber,
    );

    return {
      project_owner: projectConfig.projectOwner,
      project_number: projectConfig.projectNumber,
      status_field_name: resolvedStatusContext.statusField.name,
      status_field_id: resolvedStatusContext.statusField.id,
      item_type: itemType,
      item_number: itemNumber,
      project_item_id: resolvedStatusContext.projectItemId,
      status_option_id: resolvedStatusContext.status?.option_id ?? null,
      status: resolvedStatusContext.status?.name ?? null,
    };
  } catch (error) {
    throw mapProjectGetStatusError(error, itemType, itemNumber);
  }
}
