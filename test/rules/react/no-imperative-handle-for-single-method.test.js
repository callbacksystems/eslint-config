import rule from "#rules/react/no-imperative-handle-for-single-method"
import { dedent, tester } from "#test/support"

tester.run("no-imperative-handle-for-single-method", rule, {
  valid: [
    dedent`
      useImperativeHandle(ref, () => ({
        focus() {},
        blur() {}
      }))
    `,
    dedent`
      useImperativeHandle(ref, () => {
        return { focus() {}, blur() {}, scroll() {} }
      })
    `,
    "doSomething(ref, () => ({ only: true }))"
  ],
  invalid: [
    { code: "useImperativeHandle(ref, () => ({ focus() {} }))", errors: [ { messageId: "singleMethod" } ] },
    {
      code: dedent`
        useImperativeHandle(ref, () => {
          return { focusItem(selector) {} }
        })
      `,
      errors: [ { messageId: "singleMethod" } ]
    }
  ]
})
