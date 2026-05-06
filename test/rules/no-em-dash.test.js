import rule from "#rules/no-em-dash"
import { tester } from "#test/helpers"

tester.run("no-em-dash", rule, {
  valid: [
    "const x = 'hyphen-here'",
    "const y = `template with hyphen`",
    "// regular comment",
    "/* block comment */"
  ],
  invalid: [
    { code: "const x = 'em—dash'", errors: [ { messageId: "noEmDash" } ] },
    { code: "const y = `tmpl—here`", errors: [ { messageId: "noEmDash" } ] },
    { code: "// note—here", errors: [ { messageId: "noEmDash" } ] },
    { code: "/* block—here */", errors: [ { messageId: "noEmDash" } ] }
  ]
})
