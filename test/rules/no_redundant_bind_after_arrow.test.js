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
      output: dedent`
        class Foo {
          onClick = (event) => {}
          connect() {
            el.addEventListener("click", this.onClick)
          }
        }
      `,
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
      output: dedent`
        class Foo {
          onClick = () => {}
          onSubmit = () => {}
          connect() {
            a.addEventListener("click", this.onClick)
            b.addEventListener("submit", this.onSubmit)
          }
        }
      `,
      errors: [ { messageId: "redundantBind" }, { messageId: "redundantBind" } ]
    }
  ]
})
