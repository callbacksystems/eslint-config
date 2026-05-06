import rule from "#rules/max_field_assignments"
import { nestedPrivateMethods, tester } from "#support"

tester.run("max-field-assignments", rule, {
  valid: [
    "class C { #a; #b; #c; setup() { this.#a = 1; this.#b = 2; this.#c = 3 } }",
    "class C { #a; #b; #c; constructor() { this.#a = 1; this.#b = 2; this.#c = 3 } }",
    "class C { #a; #b; #setup() { this.#a = 1; this.#b = 2 } }",
    "class C { #cache; get #value() { return this.#cache ??= compute() } }",
    "class C { #value; set #x(value) { this.#value = value } }",
    "class C { #setup() { return class Nested { run() { this.a = 1; this.b = 2; this.c = 3 } } } }",
    "class C { #setup() { return class Nested { a = (this.x = 1); b = (this.y = 2); c = (this.z = 3) } } }",
    "class C { #setup() { return class Nested { static { this.x = 1; this.y = 2; this.z = 3 } } } }",
    "class C { #setup() { function nested() { this.a = 1; this.b = 2; this.c = 3 } nested() } }",
    "class C { #a; #b; #c; #setup() { return () => { this.#a = 1; this.#b = 2; this.#c = 3 } } }",
    { name: "indexes deeply nested methods once", code: nestedPrivateMethods(400) }
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
    },
    {
      code: "class C { #a; #b; #c; #setup() { items.forEach(() => { this.#a = 1; this.#b = 2; this.#c = 3 }) } }",
      errors: [ { messageId: "tooManyAssignments", data: { name: "#setup", count: "3", max: "2" } } ]
    },
    {
      code: "class C { #a; #b; #c; #setup() { [ this.#a, this.#b, this.#c ] = values } }",
      errors: [ { messageId: "tooManyAssignments", data: { name: "#setup", count: "3", max: "2" } } ]
    },
    {
      code: "class C { #a; #b; #c; #setup() { ({ a: this.#a, b: this.#b, c: this.#c } = value) } }",
      errors: [ { messageId: "tooManyAssignments", data: { name: "#setup", count: "3", max: "2" } } ]
    },
    {
      code: "class C { #setup() { return class Nested { [this.a = 1]() {} [this.b = 2]() {} "
        + "[this.c = 3]() {} } } }",
      errors: [ { messageId: "tooManyAssignments", data: { name: "#setup", count: "3", max: "2" } } ]
    },
    {
      code: "class C { #setup() { return class extends ((this.a = 1), (this.b = 2), (this.c = 3), Base) {} } }",
      errors: [ { messageId: "tooManyAssignments", data: { name: "#setup", count: "3", max: "2" } } ]
    },
    {
      code: "class C { #a; #b; #setup() { [ , value = (this.#a = 1), ...this.#b ] = values } }",
      options: [ { max: 1 } ],
      errors: [ { messageId: "tooManyAssignments", data: { name: "#setup", count: "2", max: "1" } } ]
    },
    {
      code: "class C { #a; #b; #setup() { ({ value: this.#a, ...this.#b } = source) } }",
      options: [ { max: 1 } ],
      errors: [ { messageId: "tooManyAssignments", data: { name: "#setup", count: "2", max: "1" } } ]
    },
    {
      code: "class C { #setup(first = (this.a = 1), second = (this.b = 2)) {} }",
      options: [ { max: 1 } ],
      errors: [ { messageId: "tooManyAssignments", data: { name: "#setup", count: "2", max: "1" } } ]
    }
  ]
})
