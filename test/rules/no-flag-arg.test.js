import rule from "#rules/no-flag-arg"
import { tester } from "#test/support"

tester.run("no-flag-arg", rule, {
  valid: [ "setOpen(true)", "fn(false)", "doStuff('value', someVar)", "config({ open: true, autoFocus: false })" ],
  invalid: [
    { code: "render('foo', true)", errors: [ { messageId: "flagArg" } ] },
    { code: "configure(target, true, false)", errors: [ { messageId: "flagArg" }, { messageId: "flagArg" } ] }
  ]
})
