import nock from 'nock';

export function mockPullRequestGetRequest(options: {
  prNumber: number;
  status?: number;
  responseBody?: Record<string, unknown>;
}) {
  const prNumber = options.prNumber;
  const status = options.status ?? 200;

  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/pulls/${prNumber}`)
    .reply(
      status,
      options.responseBody ?? {
        number: prNumber,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'PR body',
        state: 'open',
        draft: false,
        head: { ref: 'issues/orfe-13' },
        base: { ref: 'main' },
        html_url: `https://github.com/throw-if-null/orfe/pull/${prNumber}`,
      },
    );
}

export function mockPullRequestGetOrCreateRequest(options: {
  head: string;
  base?: string;
  existingPullRequests?: Record<string, unknown>[];
  listStatus?: number;
  listResponseBody?: unknown;
  createRequestBody?: Record<string, unknown>;
  createStatus?: number;
  createResponseBody?: Record<string, unknown>;
}) {
  const head = options.head;
  const base = options.base ?? 'main';
  const scope = nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get('/repos/throw-if-null/orfe/pulls')
    .query({ state: 'open', head: `throw-if-null:${head}`, base, per_page: 100 })
    .reply(options.listStatus ?? 200, options.listResponseBody ?? options.existingPullRequests ?? []);

  if (options.createStatus !== undefined || options.createResponseBody !== undefined || options.createRequestBody !== undefined) {
    scope
      .post('/repos/throw-if-null/orfe/pulls', (body: unknown) =>
        JSON.stringify(body) ===
        JSON.stringify(
          options.createRequestBody ?? {
            head,
            base,
            title: 'Design the `orfe` custom tool and CLI contract',
            draft: false,
          },
        ),
      )
      .reply(
        options.createStatus ?? 201,
        options.createResponseBody ?? {
          number: 9,
          title: 'Design the `orfe` custom tool and CLI contract',
          body: 'PR body',
          state: 'open',
          draft: false,
          head: { ref: head },
          base: { ref: base },
          html_url: 'https://github.com/throw-if-null/orfe/pull/9',
        },
      );
  }

  return scope;
}

export function mockPullRequestCommentRequest(options: {
  prNumber: number;
  body: string;
  verifyStatus?: number;
  verifyResponseBody?: Record<string, unknown>;
  status?: number;
  responseBody?: Record<string, unknown>;
}) {
  const prNumber = options.prNumber;
  const verifyStatus = options.verifyStatus ?? 200;
  const status = options.status ?? 201;

  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/pulls/${prNumber}`)
    .reply(
      verifyStatus,
      options.verifyResponseBody ?? {
        number: prNumber,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'PR body',
        state: 'open',
        draft: false,
        head: { ref: 'issues/orfe-13' },
        base: { ref: 'main' },
        html_url: `https://github.com/throw-if-null/orfe/pull/${prNumber}`,
      },
    )
    .post(`/repos/throw-if-null/orfe/issues/${prNumber}/comments`, { body: options.body })
    .reply(
      status,
      options.responseBody ?? {
        id: 123456,
        html_url: `https://github.com/throw-if-null/orfe/pull/${prNumber}#issuecomment-123456`,
      },
    );
}

export function mockPullRequestReplyRequest(options: {
  prNumber: number;
  commentId: number;
  body: string;
  verifyStatus?: number;
  verifyResponseBody?: Record<string, unknown>;
  status?: number;
  responseBody?: Record<string, unknown>;
}) {
  const prNumber = options.prNumber;
  const commentId = options.commentId;
  const verifyStatus = options.verifyStatus ?? 200;
  const status = options.status ?? 201;

  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/pulls/${prNumber}`)
    .reply(
      verifyStatus,
      options.verifyResponseBody ?? {
        number: prNumber,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'PR body',
        state: 'open',
        draft: false,
        head: { ref: 'issues/orfe-13' },
        base: { ref: 'main' },
        html_url: `https://github.com/throw-if-null/orfe/pull/${prNumber}`,
      },
    )
    .post(`/repos/throw-if-null/orfe/pulls/${prNumber}/comments/${commentId}/replies`, { body: options.body })
    .reply(
      status,
      options.responseBody ?? {
        id: 123999,
        in_reply_to_id: commentId,
      },
    );
}

export function mockPullRequestSubmitReviewRequest(options: {
  prNumber: number;
  body: string;
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  verifyStatus?: number;
  verifyResponseBody?: Record<string, unknown>;
  status?: number;
  responseBody?: Record<string, unknown>;
}) {
  const prNumber = options.prNumber;
  const verifyStatus = options.verifyStatus ?? 200;
  const status = options.status ?? 200;

  return nock('https://api.github.com')
    .get('/repos/throw-if-null/orfe/installation')
    .reply(200, { id: 42 })
    .post('/app/installations/42/access_tokens')
    .reply(201, { token: 'ghs_123', expires_at: '2026-04-06T12:00:00Z' })
    .get(`/repos/throw-if-null/orfe/pulls/${prNumber}`)
    .reply(
      verifyStatus,
      options.verifyResponseBody ?? {
        number: prNumber,
        title: 'Design the `orfe` custom tool and CLI contract',
        body: 'PR body',
        state: 'open',
        draft: false,
        head: { ref: 'issues/orfe-13' },
        base: { ref: 'main' },
        html_url: `https://github.com/throw-if-null/orfe/pull/${prNumber}`,
      },
    )
    .post(`/repos/throw-if-null/orfe/pulls/${prNumber}/reviews`, {
      body: options.body,
      event: options.event,
    })
    .reply(
      status,
      options.responseBody ?? {
        id: 555,
      },
    );
}
