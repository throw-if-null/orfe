import { executeOrfeTool } from '../../src/wrapper.js';

export const name = 'orfe';
export const description = 'Generic GitHub issue, pull request, and project operations.';

export async function execute(input: Record<string, unknown>, context: { agent?: unknown; cwd?: string }) {
  return executeOrfeTool(input, context);
}

export default {
  name,
  description,
  execute,
};
