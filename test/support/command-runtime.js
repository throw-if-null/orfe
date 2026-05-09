import { runOrfeCore } from '../../src/core.js';
import { executeOrfeTool } from '../../src/wrapper.js';
import { createAuthConfig, createGitHubClientFactory, createRepoConfig, createRepoConfigWithDefaultProject, } from './runtime-fixtures.js';
export function createCoreDependencies(options = {}) {
    return {
        loadRepoConfigImpl: async () => options.repoConfig ?? createRepoConfig(),
        loadAuthConfigImpl: async () => options.authConfig ?? createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
        ...options.overrides,
    };
}
export async function runCoreCommand(options) {
    return runOrfeCore({
        callerName: 'Greg',
        command: options.command,
        input: options.input,
        ...options.request,
    }, options.dependencies ?? createCoreDependencies({ repoConfig: options.repoConfig, authConfig: options.authConfig }));
}
export function createToolDependencies(options = {}) {
    return {
        loadRepoConfigImpl: async () => options.repoConfig ?? createRepoConfig(),
        loadAuthConfigImpl: async () => options.authConfig ?? createAuthConfig(),
        githubClientFactory: createGitHubClientFactory(),
        ...options.overrides,
    };
}
export async function runToolCommand(options) {
    return executeOrfeTool(options.input, {
        agent: 'Greg',
        cwd: '/tmp/repo',
        ...options.context,
    }, options.dependencies ?? createToolDependencies({ repoConfig: options.repoConfig, authConfig: options.authConfig }));
}
export { createRepoConfig, createRepoConfigWithDefaultProject, createAuthConfig };
//# sourceMappingURL=command-runtime.js.map