import rule from "#rules/compact-object-pattern"
import { dedent, tester } from "#test/helpers"

tester.run("compact-object-pattern", rule, {
  valid: [
    "const { a, b } = obj",
    "const {} = obj",
    dedent`
      const {
        /* preserve comments */
        a,
        b
      } = obj
    `
  ],
  invalid: [
    {
      code: dedent`
        const {
          a,
          b,
          c
        } = obj
      `,
      output: "const { a, b, c } = obj",
      errors: [ { messageId: "compactObjectPattern" } ]
    }
  ]
})
