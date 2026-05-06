import rule from "#rules/step_down_methods"
import { dedent, tester } from "#support"

const STABLE_ACCESSOR_ORDER = dedent`
  class C {
    run() { return this.value }
    get value() { return this.first() }
    set value(next) { this.second() }
    first() {}
    second() {}
  }
`

tester.run("step-down-methods", rule, {
  valid: [
    dedent`
      const log = []
      class C {
        [(log.push("a"), "a")]() { return 1 }
        [(log.push("b"), "b")]() { return this.a() }
      }
    `,
    // A public getter read only by a private helper stays among the public members.
    dedent`
      class C {
        get problem() { return this.#isReady ? 1 : null }
        get name() { return this.value }
        get #isReady() { return this.name === "ready" }
      }
    `,
    {
      code: dedent`
        class C {
          toggle() {
            return this.isOpen
          }

          reset() {}

          get isOpen() {
            return true
          }
        }
      `,
      options: [ { separateAccessors: true } ]
    },
    // Name-grouped members keep their order among themselves: the rule that drew the group owns it.
    {
      code: dedent`
        class C {
          disconnectedCallback() {
            this.connectedCallback()
          }

          connectedCallback() {}
        }
      `,
      options: [ { nameGroups: [ "Callback$" ] } ]
    },
    {
      code: dedent`
        class C {
          connectedCallback() {
            this.close()
          }

          formResetCallback() {
            this.close()
          }

          close() {}
        }
      `,
      options: [ { nameGroups: [ "^(connected|disconnected)Callback$", "^form.+Callback$" ] } ]
    },
    // Reordering two members of one name would drop one of them, so the group is left alone.
    dedent`
      class C {
        run() {
          this.helper()
        }

        other() {}

        helper() { return 1 }

        helper() { return 2 }
      }
    `,
    // A computed access names no member, so it seeds nothing.
    dedent`
      class C {
        run() {
          this[action]()
        }

        helper() {}
      }
    `,
    // A computed key is unknowable here, and it evaluates in source order.
    dedent`
      class C {
        run() {
          this.helper()
        }

        [key]() { return 1 }

        helper() {}
      }
    `,
    // Replacing Symbol makes its apparent well-known members runtime-computed, so they are not reordered.
    dedent`
      globalThis.Symbol = Fake
      class C {
        [Symbol.iterator]() { this[Symbol.toStringTag]() }
        plain() {}
        [Symbol.toStringTag]() {}
      }
    `,
    dedent`
      class C {
        run() {
          this.#step()
        }

        #step() {
          this.#detail()
        }

        #detail() {}
      }
    `,
    dedent`
      class C {
        zebra() {}
        apple() {}
      }
    `,
    dedent`
      class C {
        only() {
          this.#helper()
        }

        #helper() {}
      }
    `,
    dedent`
      class C {
        act() {
          return this.ready
        }

        get ready() {
          return true
        }
      }
    `,
    dedent`
      class C {
        static get primary() {
          return this.secondary
        }

        static get secondary() {
          return true
        }
      }
    `,
    dedent`
      class C {
        first() {
          return this.value
        }

        get value() {
          return 1
        }

        set value(next) {
          this.stored = next
        }

        second() {}
      }
    `,
    // The canonical getter-before-setter dependency order is stable on the next lint pass.
    STABLE_ACCESSOR_ORDER,
    // A regular nested function owns its `this`; it does not call a sibling method on the class instance.
    dedent`
      class C {
        helper() {}

        run() {
          return function nested() { return this.helper() }
        }
      }
    `,
    dedent`
      class C {
        helper() {}

        run() {
          return class Nested {
            field = () => this.helper()

            method() {
              return this.helper()
            }

            static {
              this.helper()
            }
          }
        }
      }
    `,
    // A static call only reaches a static sibling, even when an instance method has the same name.
    dedent`
      class C {
        static run() { this.helper() }
        static helper() {}
        first() {}
        helper() {}
      }
    `,
    { name: "classifies each member once across many configured name groups", ...classWithDistinctNameGroups(400) },
    { name: "groups many same-named accessors without repeated array copying", code: classWithRepeatedGetters(400) },
    { name: "indexes references once across deeply nested methods", code: nestedMethodClasses(400) }
  ],
  invalid: [
    {
      code: dedent`
        class C {
          helper() {}
          run() { this.helper() }
        }
      `,
      options: [ { nameGroups: [ "(" ] } ],
      output: null,
      errors: [ { messageId: "invalidNameGroup", data: { pattern: '"("' } } ]
    },
    {
      // A nested class's computed keys evaluate in the surrounding method's `this` context.
      code: dedent`
        class C {
          helper() {}

          run() {
            return class Nested { [this.helper()]() {} }
          }
        }
      `,
      output: dedent`
        class C {
          run() {
            return class Nested { [this.helper()]() {} }
          }

          helper() {}
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "run", before: "helper" } } ]
    },
    {
      code: dedent`
        class C {
          first() { this.second() } // about first
          third() {} // about third
          second() {} // about second
        }
      `,
      output: dedent`
        class C {
          first() { this.second() } // about first
          second() {} // about second
          third() {} // about third
        }
      `,
      errors: [ { messageId: "outOfOrder" } ]
    },
    {
      name: "preserves well-known symbol identity without colliding with string names",
      code: dedent`
        class C {
          [Symbol.iterator]() { this[Symbol.toStringTag]() }
          plain() {}
          [Symbol.toStringTag]() {}
        }
      `,
      output: dedent`
        class C {
          [Symbol.iterator]() { this[Symbol.toStringTag]() }
          [Symbol.toStringTag]() {}
          plain() {}
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "Symbol.toStringTag", before: "plain" } } ]
    },
    {
      code: dedent`
        class C {
          run() {
            this.#step()
          }

          #detail() {}

          #step() {
            this.#detail()
          }
        }
      `,
      output: dedent`
        class C {
          run() {
            this.#step()
          }

          #step() {
            this.#detail()
          }

          #detail() {}
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "#step", before: "#detail" } } ]
    },
    {
      code: dedent`
        class C {
          constructor() {
            this.#first()
            this.#second()
          }

          #second() {}

          #first() {}
        }
      `,
      output: dedent`
        class C {
          constructor() {
            this.#first()
            this.#second()
          }

          #first() {}

          #second() {}
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "#first", before: "#second" } } ]
    },
    {
      code: dedent`
        class C {
          static get secondary() {
            return true
          }

          static get primary() {
            return this.secondary
          }
        }
      `,
      output: dedent`
        class C {
          static get primary() {
            return this.secondary
          }

          static get secondary() {
            return true
          }
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "primary", before: "secondary" } } ]
    },
    {
      code: dedent`
        class C {
          get ready() {
            return true
          }

          act() {
            return this.ready
          }
        }
      `,
      output: dedent`
        class C {
          act() {
            return this.ready
          }

          get ready() {
            return true
          }
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "act", before: "ready" } } ]
    },
    {
      code: dedent`
        class C {
          first() {
            return this.value
          }

          second() {}

          get value() {
            return 1
          }

          set value(next) {
            this.stored = next
          }
        }
      `,
      output: dedent`
        class C {
          first() {
            return this.value
          }

          get value() {
            return 1
          }

          set value(next) {
            this.stored = next
          }

          second() {}
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "value", before: "second" } } ]
    },
    {
      code: dedent`
        class C {
          get value() {
            return 1
          }

          first() {
            return this.value
          }

          set value(next) {
            this.stored = next
          }
        }
      `,
      output: dedent`
        class C {
          first() {
            return this.value
          }

          get value() {
            return 1
          }

          set value(next) {
            this.stored = next
          }
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "first", before: "value" } } ]
    },
    {
      code: dedent`
        class C {
          ["helper"]() {}

          run() {
            this["helper"]()
          }
        }
      `,
      output: dedent`
        class C {
          run() {
            this["helper"]()
          }

          ["helper"]() {}
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "run", before: "helper" } } ]
    },
    {
      // A public computed name beginning with `#` is not the private accessor with the same display name.
      code: dedent`
        class C {
          get ["#value"]() { return 1 }

          other() {}

          run() { return this["#value"] }

          get #value() { return 2 }
        }
      `,
      output: dedent`
        class C {
          other() {}

          run() { return this["#value"] }

          get ["#value"]() { return 1 }

          get #value() { return 2 }
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "other", before: "#value" } } ]
    },
    {
      // Moving a same-named accessor group preserves the source order of duplicate getters.
      code: dedent`
        class C {
          get value() { return 1 }

          other() {}

          get value() { return 2 }

          run() { return this.value }
        }
      `,
      output: dedent`
        class C {
          other() {}

          run() { return this.value }

          get value() { return 1 }

          get value() { return 2 }
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "other", before: "value" } } ]
    },
    {
      // Accessor references follow the same canonical getter-before-setter order as the fixer.
      code: dedent`
        class C {
          second() {}
          first() {}
          set value(next) { this.second() }
          get value() { return this.first() }
          run() { return this.value }
        }
      `,
      output: STABLE_ACCESSOR_ORDER,
      errors: [ { messageId: "outOfOrder", data: { name: "run", before: "second" } } ]
    },
    {
      code: dedent`
        class C {
          get value() {
            return 1
          }

          set value(next) {
            this.stored = next
          }

          first() {
            this.value = 2
          }
        }
      `,
      output: dedent`
        class C {
          first() {
            this.value = 2
          }

          get value() {
            return 1
          }

          set value(next) {
            this.stored = next
          }
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "first", before: "value" } } ]
    },
    {
      code: dedent`
        class C {
          connectedCallback() {
            this.close()
          }

          formResetCallback() {
            this.close()
          }

          close() {}
        }
      `,
      output: dedent`
        class C {
          connectedCallback() {
            this.close()
          }

          close() {}

          formResetCallback() {
            this.close()
          }
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "close", before: "formResetCallback" } } ]
    },
    {
      code: dedent`
        class C {
          connectedCallback() {
            this.open()
          }

          close() {}

          open() {}
        }
      `,
      options: [ { nameGroups: [ "Callback$" ] } ],
      output: dedent`
        class C {
          connectedCallback() {
            this.open()
          }

          open() {}

          close() {}
        }
      `,
      errors: [ { messageId: "outOfOrder", data: { name: "open", before: "close" } } ]
    },
    {
      code: "class C { helper() {} run() { return () => this.helper() } }",
      output: "class C { run() { return () => this.helper() }\nhelper() {} }",
      errors: [ { messageId: "outOfOrder", data: { name: "run", before: "helper" } } ]
    },
    {
      code: "class C { helper() {} field = 1; run() { return this.helper() } }",
      output: null,
      errors: [ { messageId: "outOfOrder", data: { name: "run", before: "helper" } } ]
    },
    {
      code: "class C { helper() {} run(value = this.helper()) {} }",
      output: "class C { run(value = this.helper()) {}\nhelper() {} }",
      errors: [ { messageId: "outOfOrder", data: { name: "run", before: "helper" } } ]
    },
    {
      code: "class C { helper() {} run() { return class extends (this.helper(), Base) {} } }",
      output: "class C { run() { return class extends (this.helper(), Base) {} }\nhelper() {} }",
      errors: [ { messageId: "outOfOrder", data: { name: "run", before: "helper" } } ]
    }
  ]
})

function classWithDistinctNameGroups(count) {
  const names = Array.from({ length: count }, (_, index) => `group${index}`)
  return {
    code: `class C { ${names.map(emptyMethodNamed).join("\n")} }`,
    options: [ { nameGroups: names.map((name) => `^${name}$`) } ]
  }
}

function emptyMethodNamed(name) {
  return `${name}() {}`
}

function classWithRepeatedGetters(count) {
  return `class C { ${Array.from({ length: count }, () => "get value() { return 1 }").join("\n")} }`
}

function nestedMethodClasses(count) {
  return Array.from({ length: count }, (_, index) => count - index - 1).reduce(
    (inner, index) => `class C${index} { first() { ${inner} } second() {} }`, ""
  )
}
