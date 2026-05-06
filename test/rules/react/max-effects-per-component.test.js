import rule from "#rules/react/max-effects-per-component"
import { dedent, tester } from "#test/support"

tester.run("max-effects-per-component", rule, {
  valid: [
    dedent`
      function Foo() {
        useEffect(() => {}, [])
        return null
      }
    `,
    dedent`
      function Bar() {
        useEffect(() => {}, [])
        useEffect(() => {}, [])
        return null
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        function Listbox() {
          useEffect(() => {}, [])
          useEffect(() => {}, [])
          useEffect(() => {}, [])
          return null
        }
      `,
      errors: [ { messageId: "tooManyEffects" } ]
    }
  ]
})
