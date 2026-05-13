import { resolveProjectCommandConfig } from '../../../config/project-defaults.js';
import { OrfeError } from '../../../runtime/errors.js';
import type { CommandContext } from '../../../core/context.js';
import {
  formatProjectTrackedItem,
  mapProjectSetStatusError,
} from '../shared/github-errors.js';
import { updateProjectStatus } from '../shared/mutations.js';
import { resolveProjectStatusContext, type ProjectItemType } from '../shared/lookup.js';
import { selectProjectStatusOption } from '../shared/status-field.js';
import type { ProjectSetStatusData } from './output.js';

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
      return {
        project_owner: projectConfig.projectOwner,
        project_number: projectConfig.projectNumber,
        status_field_name: currentStatusContext.statusField.name,
        status_field_id: currentStatusContext.statusField.id,
        item_type: itemType,
        item_number: itemNumber,
        project_item_id: currentStatusContext.projectItemId,
        status_option_id: currentStatusContext.status.option_id,
        status: currentStatusContext.status.name,
        previous_status_option_id: currentStatusContext.status.option_id,
        previous_status: currentStatusContext.status.name,
        changed: false,
      };
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

    return {
      project_owner: projectConfig.projectOwner,
      project_number: projectConfig.projectNumber,
      status_field_name: currentStatusContext.statusField.name,
      status_field_id: currentStatusContext.statusField.id,
      item_type: itemType,
      item_number: itemNumber,
      project_item_id: currentStatusContext.projectItemId,
      status_option_id: observedStatusContext.status.option_id,
      status: observedStatusContext.status.name,
      previous_status_option_id: currentStatusContext.status?.option_id ?? null,
      previous_status: currentStatusContext.status?.name ?? null,
      changed: true,
    };
  } catch (error) {
    throw mapProjectSetStatusError(error, itemType, itemNumber);
  }
}
