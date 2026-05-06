import rule from "#rules/max-field-assignments"
import { tester } from "#test/support"

tester.run("max-field-assignments", rule, {
  valid: [
    // Public method may wire up several fields.
    "class C { #a; #b; #c; setup() { this.#a = 1; this.#b = 2; this.#c = 3 } }",
    // Constructor may wire up several fields.
    "class C { #a; #b; #c; constructor() { this.#a = 1; this.#b = 2; this.#c = 3 } }",
    // Private method within the limit.
    "class C { #a; #b; #setup() { this.#a = 1; this.#b = 2 } }",
    // Memoization is not a plain assignment.
    "class C { #cache; get #value() { return this.#cache ??= compute() } }",
    // Setter with a single assignment.
    "class C { #value; set #x(value) { this.#value = value } }"
  ],
  invalid: [
    {
      code: "class C { #a; #b; #c; #setup() { this.#a = 1; this.#b = 2; this.#c = 3 } }",
      errors: [ { messageId: "tooManyAssignments", data: { name: "#setup", count: "3", max: "2" } } ]
    },
    {
      code: "class C { #a; #b; #setup() { this.#a = 1; this.#b = 2 } }",
      options: [ { max: 1 } ],
      errors: [ { messageId: "tooManyAssignments", data: { name: "#setup", count: "2", max: "1" } } ]
    }
  ]
})
