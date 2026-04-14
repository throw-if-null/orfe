import { executeOrfeTool } from '../../src/wrapper.js';
import { type ToolDefinition, tool } from '@opencode-ai/plugin';

const args = {
  command: tool.schema.string().min(1),
  repo: tool.schema.string().optional(),
  issue_number: tool.schema.number().int().positive().optional(),
  pr_number: tool.schema.number().int().positive().optional(),
  title: tool.schema.string().optional(),
  body: tool.schema.string().optional(),
  state: tool.schema.string().optional(),
  state_reason: tool.schema.string().optional(),
  duplicate_of: tool.schema.number().int().positive().optional(),
  labels: tool.schema.array(tool.schema.string()).optional(),
  assignees: tool.schema.array(tool.schema.string()).optional(),
  clear_labels: tool.schema.boolean().optional(),
  clear_assignees: tool.schema.boolean().optional(),
  head: tool.schema.string().optional(),
  base: tool.schema.string().optional(),
  draft: tool.schema.boolean().optional(),
  comment_id: tool.schema.number().int().positive().optional(),
  event: tool.schema.string().optional(),
  item_type: tool.schema.enum(['issue', 'pr']).optional(),
  item_number: tool.schema.number().int().positive().optional(),
  status: tool.schema.string().optional(),
  project_owner: tool.schema.string().optional(),
  project_number: tool.schema.number().int().positive().optional(),
  status_field_name: tool.schema.string().optional(),
};

const orfeTool: ToolDefinition = tool({
  description: 'Generic GitHub auth, issue, pull request, and project operations.',
  args,
  async execute(args, context) {
    const result = await executeOrfeTool(args, {
      agent: context.agent,
      cwd: context.directory,
    });

    return JSON.stringify(result);
  },
});

export default orfeTool;
