import nock from 'nock';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function matchesIssueStateLookup(body: unknown, issueNumber: number): boolean {
  return (
    isObject(body) &&
    typeof body.query === 'string' &&
    body.query.includes('query IssueStateByNumber') &&
    isObject(body.variables) &&
    body.variables.issueNumber === issueNumber
  );
}

function matchesMarkIssueAsDuplicate(body: unknown, duplicateId: string, canonicalId: string): boolean {
  return (
    isObject(body) &&
    typeof body.query === 'string' &&
    body.query.includes('mutation MarkIssueAsDuplicate') &&
    isObject(body.variables) &&
    body.variables.duplicateId === duplicateId &&
    body.variables.canonicalId === canonicalId
  );
}

function matchesUnmarkIssueAsDuplicate(body: unknown, duplicateId: string, canonicalId: string): boolean {
  return (
    isObject(body) &&
    typeof body.query === 'string' &&
    body.query.includes('mutation UnmarkIssueAsDuplicate') &&
    isObject(body.variables) &&
    body.variables.duplicateId === duplicateId &&
    body.variables.canonicalId === canonicalId
  );
}

export function createIssueRestResponse(issueNumber: number, overrides: Record<string, unknown> = {}) {
  return {
    number: issueNumber,
    title: 'Issue title',
    body: 'Issue body',
    state: 'open',
    state_reason: null,
    labels: [],
    assignees: [],
    html_url: `https://github.com/throw-if-null/orfe/issues/${issueNumber}`,
    ...overrides,
  };
}

export function createIssueStateNode(options: {
  id: string;
  issueNumber: number;
  state: string;
  stateReason?: string | null;
  duplicateOfIssueNumber?: number;
  duplicateOfId?: string;
}) {
  return {
    id: options.id,
    number: options.issueNumber,
    state: options.state,
    stateReason: options.stateReason ?? null,
    duplicateOf:
      options.duplicateOfIssueNumber !== undefined
        ? {
            id: options.duplicateOfId ?? `I_${options.duplicateOfIssueNumber}`,
            number: options.duplicateOfIssueNumber,
          }
        : null,
  };
}

export function mockIssueGetRequest(options: {
  issueNumber: number;
  status?: number;
  responseBody?: Record<string, unknown>;
}) {
  const issueNumber = options.issueNumber;
  const status = options.status ?? 200;

  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/issues/${issueNumber}`)
    .reply(
      status,
      options.responseBody ?? {
        number: issueNumber,
        title: 'Build `orfe` foundation and runtime scaffolding',
        body: 'Issue body',
        state: 'open',
        state_reason: null,
        labels: [{ name: 'needs-input' }],
        assignees: [{ login: 'greg' }],
        html_url: `https://github.com/throw-if-null/orfe/issues/${issueNumber}`,
      },
    );
}

export function mockIssueCreateRequest(options: {
  requestBody: Record<string, unknown>;
  status?: number;
  responseBody?: Record<string, unknown>;
  repo?: { owner: string; name: string };
}) {
  const owner = options.repo?.owner ?? 'throw-if-null';
  const repo = options.repo?.name ?? 'orfe';
  const status = options.status ?? 201;

  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/installation`)
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .post(`/repos/${owner}/${repo}/issues`, options.requestBody)
    .reply(
      status,
      options.responseBody ?? {
        number: 21,
        node_id: 'I_kwDOOrfeIssue21',
        title: options.requestBody.title,
        body: options.requestBody.body ?? '',
        state: 'open',
        state_reason: null,
        labels: ((options.requestBody.labels as string[] | undefined) ?? []).map((name) => ({ name })),
        assignees: ((options.requestBody.assignees as string[] | undefined) ?? []).map((login) => ({ login })),
        html_url: `https://github.com/${owner}/${repo}/issues/21`,
      },
    );
}

export function mockIssueUpdateRequest(options: {
  issueNumber: number;
  requestBody: Record<string, unknown>;
  status?: number;
  responseBody?: Record<string, unknown>;
  issueGetStatus?: number;
  issueGetResponseBody?: Record<string, unknown>;
}) {
  const issueNumber = options.issueNumber;
  const status = options.status ?? 200;
  const issueGetStatus = options.issueGetStatus ?? 200;

  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/issues/${issueNumber}`)
    .reply(
      issueGetStatus,
      options.issueGetResponseBody ?? {
        number: issueNumber,
        title: 'Updated title',
        body: 'Updated body',
        state: 'open',
        state_reason: null,
        labels: [{ name: 'bug' }, { name: 'needs-input' }],
        assignees: [{ login: 'greg' }],
        html_url: `https://github.com/throw-if-null/orfe/issues/${issueNumber}`,
      },
    )
    .patch(`/repos/throw-if-null/orfe/issues/${issueNumber}`, options.requestBody)
    .reply(
      status,
      options.responseBody ?? {
        number: issueNumber,
        title: 'Updated title',
        body: 'Updated body',
        state: 'open',
        state_reason: null,
        labels: [{ name: 'bug' }, { name: 'needs-input' }],
        assignees: [{ login: 'greg' }],
        html_url: `https://github.com/throw-if-null/orfe/issues/${issueNumber}`,
      },
    );
}

export function mockIssueCommentRequest(options: {
  issueNumber: number;
  body: string;
  status?: number;
  responseBody?: Record<string, unknown>;
  issueGetStatus?: number;
  issueGetResponseBody?: Record<string, unknown>;
}) {
  const issueNumber = options.issueNumber;
  const status = options.status ?? 201;
  const issueGetStatus = options.issueGetStatus ?? 200;

  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/issues/${issueNumber}`)
    .reply(
      issueGetStatus,
      options.issueGetResponseBody ?? {
        number: issueNumber,
        title: 'Issue title',
        body: 'Issue body',
        state: 'open',
        state_reason: null,
        labels: [],
        assignees: [],
        html_url: `https://github.com/throw-if-null/orfe/issues/${issueNumber}`,
      },
    )
    .post(`/repos/throw-if-null/orfe/issues/${issueNumber}/comments`, { body: options.body })
    .reply(
      status,
      options.responseBody ?? {
        id: 123456,
        html_url: `https://github.com/throw-if-null/orfe/issues/${issueNumber}#issuecomment-123456`,
      },
    );
}

export function mockIssueSetStateRequest(options: {
  issueNumber: number;
  currentIssueState: Record<string, unknown>;
  restUpdateBody?: Record<string, unknown>;
  observedIssueState?: Record<string, unknown>;
  issueGetStatus?: number;
  issueGetResponseBody?: Record<string, unknown>;
  includeGraphql?: boolean;
  unmark?: { duplicateId: string; canonicalId: string };
}) {
  const scope = nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/issues/${options.issueNumber}`)
    .reply(options.issueGetStatus ?? 200, options.issueGetResponseBody ?? createIssueRestResponse(options.issueNumber));

  if (options.includeGraphql !== false) {
    scope.post('/graphql', (body: unknown) => matchesIssueStateLookup(body, options.issueNumber)).reply(200, {
      data: { repository: { issue: options.currentIssueState } },
    });
  }

  if (options.unmark) {
    scope
      .post('/graphql', (body: unknown) => matchesUnmarkIssueAsDuplicate(body, options.unmark!.duplicateId, options.unmark!.canonicalId))
      .reply(200, { data: { unmarkIssueAsDuplicate: { clientMutationId: null } } });
  }

  if (options.restUpdateBody) {
    scope
      .patch(`/repos/throw-if-null/orfe/issues/${options.issueNumber}`, options.restUpdateBody)
      .reply(200, createIssueRestResponse(options.issueNumber, options.restUpdateBody))
      .post('/graphql', (body: unknown) => matchesIssueStateLookup(body, options.issueNumber))
      .reply(200, { data: { repository: { issue: options.observedIssueState ?? options.currentIssueState } } });
  }

  return scope;
}

export function mockIssueSetStateDuplicateRequest(options: {
  issueNumber: number;
  duplicateOfIssueNumber: number;
  currentIssueState: Record<string, unknown>;
  canonicalIssueState: Record<string, unknown> | null;
  duplicateTargetGetStatus?: number;
  duplicateTargetGetResponseBody?: Record<string, unknown>;
  unmark?: { duplicateId: string; canonicalId: string };
  mark?: { duplicateId: string; canonicalId: string };
  restUpdateBody?: Record<string, unknown>;
  observedIssueState?: Record<string, unknown>;
  issueGetStatus?: number;
  issueGetResponseBody?: Record<string, unknown>;
  includeGraphql?: boolean;
}) {
  const scope = nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/issues/${options.issueNumber}`)
    .reply(options.issueGetStatus ?? 200, options.issueGetResponseBody ?? createIssueRestResponse(options.issueNumber));

  if (options.includeGraphql !== false) {
    scope
      .post('/graphql', (body: unknown) => matchesIssueStateLookup(body, options.issueNumber))
      .reply(200, { data: { repository: { issue: options.currentIssueState } } })
      .post('/graphql', (body: unknown) => matchesIssueStateLookup(body, options.duplicateOfIssueNumber))
      .reply(200, { data: { repository: { issue: options.canonicalIssueState } } });
  }

  if (options.canonicalIssueState === null) {
    scope
      .get(`/repos/throw-if-null/orfe/issues/${options.duplicateOfIssueNumber}`)
      .reply(options.duplicateTargetGetStatus ?? 404, options.duplicateTargetGetResponseBody ?? { message: 'Not Found' });
  }

  if (options.unmark) {
    scope
      .post('/graphql', (body: unknown) => matchesUnmarkIssueAsDuplicate(body, options.unmark!.duplicateId, options.unmark!.canonicalId))
      .reply(200, { data: { unmarkIssueAsDuplicate: { clientMutationId: null } } });
  }

  if (options.mark) {
    scope
      .post('/graphql', (body: unknown) => matchesMarkIssueAsDuplicate(body, options.mark!.duplicateId, options.mark!.canonicalId))
      .reply(200, { data: { markIssueAsDuplicate: { clientMutationId: null } } });
  }

  if (options.observedIssueState) {
    if (options.restUpdateBody) {
      scope
        .patch(`/repos/throw-if-null/orfe/issues/${options.issueNumber}`, options.restUpdateBody)
        .reply(200, createIssueRestResponse(options.issueNumber, options.restUpdateBody));
    }

    scope
      .post('/graphql', (body: unknown) => matchesIssueStateLookup(body, options.issueNumber))
      .reply(200, { data: { repository: { issue: options.observedIssueState } } });
  }

  return scope;
}
