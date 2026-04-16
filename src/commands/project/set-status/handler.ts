import { resolveProjectCommandConfig } from '../../../config.js';
import { OrfeError } from '../../../errors.js';
import type { CommandContext } from '../../../types.js';
import {
  formatProjectTrackedItem,
  mapProjectSetStatusError,
  normalizeProjectSetStatusResult,
  resolveProjectStatusContext,
  selectProjectStatusOption,
  updateProjectStatus,
  type ProjectItemType,
  type ProjectSetStatusData,
} from '../shared.js';

export async function handleProjectSetStatus(context: CommandContext<'project set-status'>): Promise<ProjectSetStatusData> {
  const itemType = context.input.item_type as ProjectItemType;
  const itemNumber = context.input.item_number as number;
  const targetStatus = context.input.status as string;
  const projectConfig = resolveProjectCommandConfig(context.repoConfig, context.input);

  try {
    const { graphql } = await context.getGitHubClient();
    const currentStatusContext = await resolveProjectStatusContext(
      graphql,
      context.repo.owner,
      context.repo.name,
      projectConfig.projectOwner,
      projectConfig.projectNumber,
      projectConfig.statusFieldName,
      itemType,
      itemNumber,
    );
    const targetOption = selectProjectStatusOption(
      currentStatusContext.statusField,
      projectConfig.projectOwner,
      projectConfig.projectNumber,
      targetStatus,
    );

    if (currentStatusContext.status?.option_id === targetOption.id) {
      return normalizeProjectSetStatusResult(
        projectConfig.projectOwner,
        projectConfig.projectNumber,
        itemType,
        itemNumber,
        currentStatusContext,
        currentStatusContext.status,
        false,
      );
    }

    await updateProjectStatus(
      graphql,
      currentStatusContext.projectId,
      currentStatusContext.projectItemId,
      currentStatusContext.statusField.id,
      targetOption.id,
    );

    const observedStatusContext = await resolveProjectStatusContext(
      graphql,
      context.repo.owner,
      context.repo.name,
      projectConfig.projectOwner,
      projectConfig.projectNumber,
      projectConfig.statusFieldName,
      itemType,
      itemNumber,
    );

    if (
      observedStatusContext.status === null ||
      observedStatusContext.status.option_id !== targetOption.id ||
      observedStatusContext.status.name !== targetOption.name
    ) {
      throw new OrfeError(
        'internal_error',
        `GitHub Project ${projectConfig.projectOwner}/${projectConfig.projectNumber} did not reach status "${targetStatus}" for ${formatProjectTrackedItem(itemType)} #${itemNumber}.`,
      );
    }

    return normalizeProjectSetStatusResult(
      projectConfig.projectOwner,
      projectConfig.projectNumber,
      itemType,
      itemNumber,
      currentStatusContext,
      observedStatusContext.status,
      true,
    );
  } catch (error) {
    throw mapProjectSetStatusError(error, itemType, itemNumber);
  }
}
