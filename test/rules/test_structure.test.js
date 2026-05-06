import rule from "#rules/test_structure"
import { dedent, tester } from "#support"

tester.run("test-structure", rule, {
  valid: [
    "teardown(); setup()",
    "after(() => {}); before(() => {})",
    "before(() => {}); beforeEach(() => {}); afterEach(() => {}); after(() => {}); test('works', () => {})",
    "beforeAll(() => {}); beforeEach(() => {}); afterEach(() => {}); afterAll(() => {}); test('works', () => {})",
    "suiteSetup(() => {}); setup(() => {}); teardown(() => {}); suiteTeardown(() => {}); test('works', () => {})",
    dedent`
      test.beforeAll(() => {})
      test.beforeEach(() => {})
      test.afterEach(() => {})
      test.afterAll(() => {})
      test('works', () => {})
    `,
    "beforeEach(() => {}); beforeEach(() => {}); test('works', () => {})",
    "test('works', () => { beforeEach(() => {}) })",
    "test('works', () => {}); function anotherScope() { beforeEach(() => {}); test('also works', () => {}) }",
    "test('works', () => {}); service.beforeEach(() => {})",
    "test.use({}); beforeEach(() => {}); test('works', () => {})",
    "test.setTimeout(100); beforeEach(() => {}); test('works', () => {})",
    "test.extend({}); beforeEach(() => {}); test('works', () => {})",
    "afterEach(() => {}); const options = {}; afterAll(() => {})",
    "test('the parser keeps a trailing comment', () => {})",
    "test.only('the parser keeps a trailing comment', () => {})",
    "context.report({ node, messageId: 'testBlock' })",
    "suites.forEach((suite) => test(suite.name, suite.body))",
    "const it = pronounFor(subject)",
    // A block is called on nothing, so a like-named method is not one.
    "hours.describe()",
    "report.it({ subject })",
    "schedule.suite.describe()",
    "class C { run() { this.describe() } }",
    "suiteFor(name).describe()",
    "describe[mode]('the parser', () => {})",
    "describe[mode].only('the parser', () => {})",
    "element.dispatchEvent(event)",
    dedent`
      test('a fixture parses', async () => {
        await lintFixture({ subdir: 'astro' })
      })
    `
  ],
  invalid: [
    {
      code: "test('works', () => {}); beforeEach(() => {}); test('also works', () => {})",
      errors: [ { messageId: "hooksFirst", data: { name: "beforeEach" } } ]
    },
    {
      code: "test('works', () => {}); afterEach(() => {}); after(() => {})",
      errors: [ { messageId: "hooksFirst" }, { messageId: "hooksFirst" } ]
    },
    {
      code: "test.only('works', () => {}); test.beforeAll(() => {})",
      errors: [ { messageId: "hooksFirst", data: { name: "beforeAll" } } ]
    },
    { code: "await test('works', async () => {}); beforeEach(() => {})", errors: [ { messageId: "hooksFirst" } ] },
    {
      code: "test.each([1, 2])('works with %s', () => {}); beforeEach(() => {})",
      errors: [ { messageId: "hooksFirst" } ]
    },
    {
      code: "test.concurrent.each([1, 2])('works with %s', () => {}); beforeEach(() => {})",
      errors: [ { messageId: "hooksFirst" } ]
    },
    {
      code: "test.each`value | expected`('works', () => {}); beforeEach(() => {})",
      errors: [ { messageId: "hooksFirst" } ]
    },
    { code: "test['skip']('works', () => {}); test['afterEach'](() => {})", errors: [ { messageId: "hooksFirst" } ] },
    {
      code: "afterEach(() => {}); beforeEach(() => {}); test('works', () => {})",
      errors: [ { messageId: "hookOrder", data: { name: "beforeEach", previous: "afterEach" } } ]
    },
    {
      code: "beforeEach(() => {}); before(() => {}); test('works', () => {})",
      errors: [ { messageId: "hookOrder", data: { name: "before", previous: "beforeEach" } } ]
    },
    {
      code: "afterAll(() => {}); afterEach(() => {}); beforeEach(() => {}); test('works', () => {})",
      errors: [ { messageId: "hookOrder" }, { messageId: "hookOrder" } ]
    },
    {
      code: "test.afterAll(() => {}); test.beforeAll(() => {}); test('works', () => {})",
      errors: [ { messageId: "hookOrder", data: { name: "beforeAll", previous: "afterAll" } } ]
    },
    {
      code: "suiteTeardown(() => {}); setup(() => {}); test('works', () => {})",
      errors: [ { messageId: "hookOrder" } ]
    },
    {
      code: "function register() { test('works', () => {}); afterEach(() => {}) }",
      errors: [ { messageId: "hooksFirst" } ]
    },
    { code: "it.each([1, 2])('works', () => {})", errors: [ { messageId: "testBlock", data: { name: "it" } } ] },
    { code: "describe('the parser', () => {})", errors: [ { messageId: "testBlock", data: { name: "describe" } } ] },
    { code: "it('keeps a trailing comment', () => {})", errors: [ { messageId: "testBlock" } ] },
    { code: "suite('the parser', () => {})", errors: [ { messageId: "testBlock" } ] },
    { code: "specify('it keeps a comment', () => {})", errors: [ { messageId: "testBlock" } ] },
    { code: "describe.only('the parser', () => {})", errors: [ { messageId: "testBlock" } ] },
    { code: "it.skip('keeps a comment', () => {})", errors: [ { messageId: "testBlock" } ] },
    { code: "test.describe('the parser', () => {})", errors: [ { messageId: "testBlock" } ] },
    { code: "test['describe']('the parser', () => {})", errors: [ { messageId: "testBlock" } ] },
    { code: "test[`describe`]('the parser', () => {})", errors: [ { messageId: "testBlock" } ] },
    { code: "describe['only']('the parser', () => {})", errors: [ { messageId: "testBlock" } ] },
    { code: "test.describe.serial('the parser', () => {})", errors: [ { messageId: "testBlock" } ] },
    {
      code: dedent`
        describe('the parser', () => {
          it('keeps a trailing comment', () => {})
        })
      `,
      errors: [ { messageId: "testBlock" }, { messageId: "testBlock" } ]
    }
  ]
})
