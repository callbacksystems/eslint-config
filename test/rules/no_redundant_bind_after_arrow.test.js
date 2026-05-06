import rule from "#rules/no_redundant_bind_after_arrow"
import { dedent, tester } from "#support"

tester.run("no-redundant-bind-after-arrow", rule, {
  valid: [
    dedent`
      class Foo {
        method() {}
        connect() {
          el.addEventListener("click", this.method.bind(this))
        }
      }
    `,
    dedent`
      class Foo {
        onClick = () => {}
        connect() {
          el.addEventListener("click", this.onClick)
        }
      }
    `,
    dedent`
      class Foo {
        onClick = () => {}
        connect() {
          el.addEventListener("click", this.onClick.bind(other))
        }
      }
    `,
    dedent`
      class Foo {
        connect() {
          el.addEventListener("click", helper.bind(this))
        }
      }
    `,
    dedent`
      const handlers = {
        method() {},
        connect() {
          el.addEventListener("click", this.method.bind(this))
        }
      }
    `,
    dedent`
      class Foo {
        onClick = () => {}
        connect() {
          function register() {
            el.addEventListener("click", this.onClick.bind(this))
          }
        }
      }
    `,
    dedent`
      class Foo {
        onClick = () => {}
        static connect() {
          el.addEventListener("click", this.onClick.bind(this))
        }
      }
    `,
    dedent`
      class Foo {
        static onClick = () => {}
        connect() {
          el.addEventListener("click", this.onClick.bind(this))
        }
      }
    `,
    dedent`
      class Foo {
        onClick = () => {}
        connect(name) {
          el.addEventListener("click", this[name].bind(this))
        }
      }
    `,
    dedent`
      class Foo {
        onClick = () => {}
        [this.onClick.bind(this)] = true
      }
    `,
    dedent`
      class Foo {
        onClick = () => {}
        connect() {
          this.onClick.bind?.(this)
          this.onClick[bind](this)
        }
      }
    `,
    dedent`
      class Foo {
        onClick = () => {}
        onClick = function () {}

        connect() {
          this.onClick.bind(this)
        }
      }
    `,
    dedent`
      class Foo {
        onClick = () => {}
        [fieldName] = function () {}

        connect() {
          this.onClick.bind(this)
        }
      }
    `,
    dedent`
      class Foo {
        ["#handler"] = function () {}
        #handler = () => {}

        connect() {
          this["#handler"].bind(this)
        }
      }
    `,
    dedent`
      class Foo {
        #handler = function () {}
        ["#handler"] = () => {}

        connect() {
          this.#handler.bind(this)
        }
      }
    `,
    dedent`
      class Foo {
        assigned = () => {}
        updated = () => {}
        deleted = () => {}
        destructured = () => {}
        arrayTarget = () => {}
        valueTarget = () => {}
        keyTarget = () => {}

        replace(source, values) {
          this.assigned = function () {}
          this.updated++
          delete this.deleted
          ;({ handler: this.destructured } = source)
          ;[ this.arrayTarget ] = source
          for (this.valueTarget of values) consume()
          for (this.keyTarget in source) consume()
        }

        connect() {
          this.assigned.bind(this)
          this.updated.bind(this)
          this.deleted.bind(this)
          this.destructured.bind(this)
          this.arrayTarget.bind(this)
          this.valueTarget.bind(this)
          this.keyTarget.bind(this)
        }
      }
    `,
    dedent`
      class Foo {
        onClick = () => {}

        replace(name) {
          this[name] = function () {}
        }

        connect() {
          this.onClick.bind(this)
        }
      }
    `,
    dedent`
      class Foo {
        #handler = () => {}

        replace() {
          this.#handler = function () {}
        }

        connect() {
          this.#handler.bind(this)
        }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        class Foo {
          onClick = (event) => {}
          connect() {
            el.addEventListener("click", this.onClick.bind(this))
          }
        }
      `,
      output: null,
      errors: [ { messageId: "redundantBind" } ]
    },
    {
      code: dedent`
        class Foo {
          onClick = () => {}
          onSubmit = () => {}
          connect() {
            a.addEventListener("click", this.onClick.bind(this))
            b.addEventListener("submit", this.onSubmit.bind(this))
          }
        }
      `,
      output: null,
      errors: [ { messageId: "redundantBind" }, { messageId: "redundantBind" } ]
    },
    {
      code: dedent`
        class Foo {
          onClick = () => {}
          connect() {
            run(() => this.onClick.bind(this))
          }
        }
      `,
      output: null,
      errors: [ { messageId: "redundantBind" } ]
    },
    {
      code: dedent`
        class Foo {
          #onClick = () => {}

          connect() {
            this.#onClick.bind(this)
          }
        }
      `,
      output: null,
      errors: [ { messageId: "redundantBind", data: { member: "this.#onClick" } } ]
    },
    {
      code: dedent`
        class Foo {
          ["onClick"] = () => {}

          connect() {
            this["onClick"]["bind"](this)
          }
        }
      `,
      output: null,
      errors: [ { messageId: "redundantBind", data: { member: "this[\"onClick\"]" } } ]
    },
    {
      code: dedent`
        class Foo {
          onClick = () => {}

          connect() {
            this.onClick.bind(/* binding is intentionally visible */ this)
          }
        }
      `,
      output: null,
      errors: [ { messageId: "redundantBind" } ]
    },
    {
      code: dedent`
        class Foo {
          onClick = () => {}

          connect() {
            this.onClick.bind = () => replacement
            return this.onClick.bind(this)
          }
        }
      `,
      output: null,
      errors: [ { messageId: "redundantBind" } ]
    },
    {
      code: dedent`
        class Foo {
          [""] = () => {}

          connect() {
            this[""].bind(this)
          }
        }
      `,
      output: null,
      errors: [ { messageId: "redundantBind", data: { member: "this[\"\"]" } } ]
    },
    {
      code: dedent`
        class Foo {
          ["#handler"] = () => {}
          #handler = function () {}

          connect() {
            this["#handler"].bind(this)
          }
        }
      `,
      output: null,
      errors: [ { messageId: "redundantBind", data: { member: "this[\"#handler\"]" } } ]
    },
    {
      code: dedent`
        class Foo {
          #handler = () => {}
          ["#handler"] = function () {}

          connect() {
            this.#handler.bind(this)
          }
        }
      `,
      output: null,
      errors: [ { messageId: "redundantBind", data: { member: "this.#handler" } } ]
    },
    {
      code: dedent`
        class Foo {
          [fieldName] = function () {}
          onClick = () => {}

          connect() {
            this.onClick.bind(this)
          }
        }
      `,
      output: null,
      errors: [ { messageId: "redundantBind" } ]
    },
    {
      code: dedent`
        class Outer {
          onClick = () => {}

          connect() {
            class Inner {
              [this.onClick.bind(this)]() {}
            }
          }
        }
      `,
      output: null,
      errors: [ { messageId: "redundantBind", data: { member: "this.onClick" } } ]
    },
    {
      code: dedent`
        class Foo {
          #handler = () => {}

          replace(name) {
            this[name] = function () {}
          }

          connect() {
            this.#handler.bind(this)
          }
        }
      `,
      output: null,
      errors: [ { messageId: "redundantBind", data: { member: "this.#handler" } } ]
    },
    {
      code: dedent`
        class Foo {
          onClick = () => {}

          static replace() {
            this.onClick = function () {}
          }

          connect() {
            this.onClick.bind(this)
          }
        }
      `,
      output: null,
      errors: [ { messageId: "redundantBind" } ]
    }
  ]
})
