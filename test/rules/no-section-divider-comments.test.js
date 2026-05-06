import rule from "#rules/no-section-divider-comments"
import { dedent, tester } from "#test/helpers"

tester.run("no-section-divider-comments", rule, {
  valid: [
    "// regular comment",
    "/* block comment */",
    "// TODO: fix this",
    dedent`
      function f() {
        // helper
        return 1
      }
    `
  ],
  invalid: [
    {
      code: "// =============",
      output: "",
      errors: [ { messageId: "pureDivider" } ]
    },
    {
      code: "// -------",
      output: "",
      errors: [ { messageId: "pureDivider" } ]
    },
    {
      code: "// ===== Section ======",
      output: "// Section",
      errors: [ { messageId: "wrappedDivider" } ]
    },
    {
      code: "/* === Title === */",
      output: "/* Title */",
      errors: [ { messageId: "wrappedDivider" } ]
    }
  ]
})
