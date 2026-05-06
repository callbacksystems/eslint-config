import rule from "#rules/prefer-arrow-class-field-for-handler"
import { dedent, tester } from "#test/support"

tester.run("prefer-arrow-class-field-for-handler", rule, {
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
    }
  ]
})
