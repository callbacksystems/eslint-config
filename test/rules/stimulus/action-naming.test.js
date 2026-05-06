import rule from "#rules/stimulus/action-naming"
import { dedent, tester } from "#test/support"

tester.run("stimulus-action-naming", rule, {
  valid: [
    dedent`
      class Other extends Whatever {
        handleClick() {}
        onSubmit() {}
      }
    `,
    dedent`
      class Foo extends Controller {
        connect() {}
        submit() {}
        change() {}
        click() {}
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        class Foo extends Controller {
          handleClick() {}
        }
      `,
      errors: [ { messageId: "handlerPrefix" } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          onSubmit() {}
          handleChange() {}
        }
      `,
      errors: [ { messageId: "handlerPrefix" }, { messageId: "handlerPrefix" } ]
    }
  ]
})
