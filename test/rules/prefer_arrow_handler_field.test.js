import rule from "#rules/prefer_arrow_handler_field"
import { dedent, tester } from "#support"

tester.run("prefer-arrow-handler-field", rule, {
  valid: [
    dedent`
      class Foo {
        onClick = (event) => {}
      }
    `,
    dedent`
      class Foo {
        constructor() {
          this.value = 1
        }
      }
    `,
    dedent`
      class Foo {
        connect() {
          this.update += this.update.bind(this)

          function register() {
            this.change = this.change.bind(this)
          }
        }
      }
    `,
    dedent`
      class Controller {
        #bind(value) {
          return value
        }

        connect() {
          this.update = this.update.#bind(this)
        }
      }
    `,
    dedent`
      class Controller {
        #handler

        connect() {
          this.#handler = this["#handler"].bind(this)
          this["#handler"] = this.#handler.bind(this)
        }
      }
    `,
    dedent`
      class Outer {
        connect() {
          class Inner {
            handler = () => {
              this.update = this.update.bind(this)
            }

            static {
              this.change = this.change.bind(this)
            }
          }
        }
      }
    `,
    dedent`
      class Controller {
        handler = () => {
          this.update = this.update.bind(this)
        }

        static handler = () => {
          this.change = this.change.bind(this)
        }

        static {
          this.render = this.render.bind(this)
        }
      }
    `,
    dedent`
      class Outer {
        connect() {
          const object = {
            method() {
              this.update = this.update.bind(this)
            }
          }

          function build() {
            return class Inner extends (this.Base = this.Base.bind(this)) {}
          }

          return [ object, build ]
        }
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        class Foo {
          constructor() {
            this.onClick = this.onClick.bind(this)
          }
          onClick(event) {}
        }
      `,
      errors: [ { messageId: "preferArrowField" } ]
    },
    {
      code: dedent`
        class Controller {
          initialize() {
            this.change = this.change.bind(this)
          }
          change(event) {}
        }
      `,
      errors: [ { messageId: "preferArrowField" } ]
    },
    {
      code: dedent`
        class Controller {
          connect() {
            this.update = this.update.bind(this)
          }
          update() {}
        }
      `,
      errors: [ { messageId: "preferArrowField" } ]
    },
    {
      code: dedent`
        class Controller {
          connect() {
            if (this.element) this.#update = this.#update.bind(this)
          }

          #update() {}
        }
      `,
      errors: [ { messageId: "preferArrowField", data: { name: "#update" } } ]
    },
    {
      code: dedent`
        class Controller {
          connect() {
            queueMicrotask(() => {
              this["update"] = this["update"].bind(this)
            })
          }

          update() {}
        }
      `,
      errors: [ { messageId: "preferArrowField", data: { name: "update" } } ]
    },
    {
      code: dedent`
        class Controller {
          connect(value = (this.update = this.update.bind(this))) {}

          update() {}
        }
      `,
      errors: [ { messageId: "preferArrowField", data: { name: "update" } } ]
    },
    {
      code: dedent`
        class Outer {
          connect() {
            class Inner {
              update() {
                this.handler = this.handler.bind(this)
              }
            }
          }
        }
      `,
      errors: [ { messageId: "preferArrowField", data: { name: "handler" } } ]
    },
    {
      code: dedent`
        class Outer {
          connect() {
            class Inner {
              [this.update = this.update.bind(this)]() {}
            }
          }
        }
      `,
      errors: [ { messageId: "preferArrowField", data: { name: "update" } } ]
    },
    {
      code: dedent`
        class Outer {
          connect() {
            class Inner extends (this.Base = this.Base.bind(this)) {}
          }
        }
      `,
      errors: [ { messageId: "preferArrowField", data: { name: "Base" } } ]
    },
    {
      code: dedent`
        class Controller {
          connect() {
            this[""] = this[""].bind(this)
          }

          [""]() {}
        }
      `,
      errors: [ { messageId: "preferArrowField", data: { name: "[\"\"]" } } ]
    },
    {
      code: dedent`
        class Controller {
          connect() {
            this["on-click"] = this["on-click"].bind(this)
          }

          ["on-click"]() {}
        }
      `,
      errors: [ { messageId: "preferArrowField", data: { name: "[\"on-click\"]" } } ]
    },
    {
      code: dedent`
        class Controller {
          connect() {
            this["#handler"] = this["#handler"].bind(this)
          }

          ["#handler"]() {}
        }
      `,
      errors: [ { messageId: "preferArrowField", data: { name: "[\"#handler\"]" } } ]
    },
    {
      code: dedent`
        class Controller {
          static connect() {
            this.update = this.update.bind(this)
          }

          static update() {}
        }
      `,
      errors: [ { messageId: "preferArrowField", data: { name: "static update" } } ]
    },
    invalidFieldName("constructor", "[\"constructor\"]"),
    invalidFieldName("constructor", "static [\"constructor\"]", { isStatic: true }),
    invalidFieldName("prototype", "static [\"prototype\"]", { isStatic: true }),
    {
      code: "class Controller { connect() { this.π = this.π.bind(this) } π() {} }",
      errors: [ { messageId: "preferArrowField", data: { name: "π" } } ]
    },
    { name: "indexes deeply nested method bindings once", code: nestedHandlers(400), errors: 400 }
  ]
})

function invalidFieldName(name, suggestion, { isStatic = false } = {}) {
  const staticKeyword = isStatic ? "static " : ""
  return {
    code: `class Controller { ${staticKeyword}connect() { this.${name} = this.${name}.bind(this) } }`,
    errors: [ { messageId: "preferArrowField", data: { name: suggestion } } ]
  }
}

function nestedHandlers(depth) {
  return Array.from({ length: depth }, (_, index) => depth - index - 1).reduce(
    (inner, index) => `class C${index} { m() { this.x = this.x.bind(this); ${inner} } }`, ""
  )
}
