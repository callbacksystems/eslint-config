import rule from "#rules/react/max-consecutive-fieldset-defs"
import { dedent, tester } from "#test/support"

tester.run("max-consecutive-fieldset-defs", rule, {
  valid: [
    dedent`
      function A() {}
      function B() {}
      function C() {}
    `,
    dedent`
      function A() {}
      const data = 1
      function B() {}
      function C() {}
    `
  ],
  invalid: [
    {
      code: dedent`
        function NameFieldset() {}
        function EmailFieldset() {}
        function AddressFieldset() {}
        function PhoneFieldset() {}
      `,
      errors: [ { messageId: "tooManyConsecutive" } ]
    },
    {
      code: dedent`
        const A = () => null
        const B = () => null
        const C = () => null
        const D = () => null
      `,
      errors: [ { messageId: "tooManyConsecutive" } ]
    }
  ]
})
