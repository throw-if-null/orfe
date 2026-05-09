import nock from 'nock';
export async function withNock(testBody) {
    nock.disableNetConnect();
    try {
        await testBody();
    }
    finally {
        nock.cleanAll();
        nock.enableNetConnect();
    }
}
//# sourceMappingURL=http-test.js.map