import rule from "#rules/max_field_assignments"
import { tester } from "#support"

tester.run("max-field-assignments", rule, {
  valid: [
    "class C { #a; #b; #c; setup() { this.#a = 1; this.#b = 2; this.#c = 3 } }",
    "class C { #a; #b; #c; constructor() { this.#a = 1; this.#b = 2; this.#c = 3 } }",
    "class C { #a; #b; #setup() { this.#a = 1; this.#b = 2 } }",
    "class C { #cache; get #value() { return this.#cache ??= compute() } }",
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
