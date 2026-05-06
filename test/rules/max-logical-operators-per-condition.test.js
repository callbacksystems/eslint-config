import rule from "#rules/max-logical-operators-per-condition"
import { tester } from "#support"

tester.run("max-logical-operators-per-condition", rule, {
  valid: [
    "if (a) {}",
    "if (a && b) {}",
    "if (a || b) {}",
    "while (a ?? b) {}",
    "const z = a ? 1 : 2",
    "const w = (a && b) ? 1 : 2",
    // A higher `max` allows more operators.
    { code: "if (a && b && c) {}", options: [ { max: 2 } ] }
  ],
  invalid: [
    { code: "if (a && b && c) {}", errors: [ { messageId: "tooManyOperators" } ] },
    { code: "while (a || b || c) {}", errors: [ { messageId: "tooManyOperators" } ] },
    { code: "for (; a && b || c;);", errors: [ { messageId: "tooManyOperators" } ] },
    { code: "const z = (a && b && c) ? 1 : 2", errors: [ { messageId: "tooManyOperators" } ] },
    // A lower `max` flags any operator.
    { code: "if (a && b) {}", options: [ { max: 0 } ], errors: [ { messageId: "tooManyOperators" } ] }
  ]
})
