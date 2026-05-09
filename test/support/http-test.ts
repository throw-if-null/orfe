import nock from 'nock';

export async function withNock(testBody: () => Promise<void>): Promise<void> {
  nock.disableNetConnect();

  try {
    await testBody();
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
}
