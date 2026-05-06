import rule from "#rules/no-extra-bind-after-arrow-field"
import { dedent, tester } from "#test/support"

tester.run("no-extra-bind-after-arrow-field", rule, {
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
      errors: [ { messageId: "redundantBind" } ]
    }
  ]
})
