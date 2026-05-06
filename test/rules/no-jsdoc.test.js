import rule from "#rules/no-jsdoc"
import { dedent, tester } from "#test/support"

tester.run("no-jsdoc", rule, {
  valid: [
    "// regular line comment",
    "/* regular block comment */",
    dedent`
      /* multi
         line
         block */
      const x = 1
    `,
    "// TODO: explain why"
  ],
  invalid: [
    { code: "/** JSDoc block */\nfunction f() {}", errors: [ { messageId: "noJsdoc" } ] },
    {
      code: dedent`
        /**
         * @param {string} x
         * @returns {number}
         */
        function f(x) {}
      `,
      errors: [ { messageId: "noJsdoc" } ]
    }
  ]
})
