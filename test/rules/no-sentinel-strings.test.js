import rule from "#rules/no-sentinel-strings"
import { tester } from "#test/support"

tester.run("no-sentinel-strings", rule, {
  valid: [
    "const x = 'normal-string'",
    "const y = 'snake_case'",
    "const z = '__only_one_underscore'",
    "const w = 'trailing_only__'"
  ],
  invalid: [
    { code: "const x = '__smart__'", errors: [ { messageId: "sentinelString" } ] },
    { code: "const y = '__lists__'", errors: [ { messageId: "sentinelString" } ] },
    { code: "if (key === '__inbox__') {}", errors: [ { messageId: "sentinelString" } ] }
  ]
})
