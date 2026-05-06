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
    // Also caught in non-constructor methods (e.g. Stimulus initialize).
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
    }
  ]
})
