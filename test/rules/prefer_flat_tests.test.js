import rule from "#rules/prefer_flat_tests"
import { dedent, tester } from "#support"

tester.run("prefer-flat-tests", rule, {
  valid: [
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
    "element.dispatchEvent(event)",
    dedent`
      test('a fixture parses', async () => {
        await lintFixture({ subdir: 'astro' })
      })
    `
  ],
  invalid: [
    { code: "describe('the parser', () => {})", errors: [ { messageId: "testBlock", data: { name: "describe" } } ] },
    { code: "it('keeps a trailing comment', () => {})", errors: [ { messageId: "testBlock" } ] },
    { code: "suite('the parser', () => {})", errors: [ { messageId: "testBlock" } ] },
    { code: "specify('it keeps a comment', () => {})", errors: [ { messageId: "testBlock" } ] },
    { code: "describe.only('the parser', () => {})", errors: [ { messageId: "testBlock" } ] },
    { code: "it.skip('keeps a comment', () => {})", errors: [ { messageId: "testBlock" } ] },
    { code: "test.describe('the parser', () => {})", errors: [ { messageId: "testBlock" } ] },
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
