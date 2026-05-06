import rule from "#rules/react/max-internal-hooks-composed"
import { dedent, tester } from "#test/support"

tester.run("max-internal-hooks-composed", rule, {
  valid: [
    dedent`
      import { useState } from "react"
      function Foo() {
        const [count, setCount] = useState(0)
        return null
      }
    `,
    dedent`
      import { useA } from "./a"
      import { useB } from "./b"
      import { useC } from "./c"
      function Foo() {
        useA(); useB(); useC()
        return null
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        import { useA } from "./a"
        import { useB } from "./b"
        import { useC } from "./c"
        import { useD } from "./d"
        import { useE } from "./e"
        function Listbox() {
          useA(); useB(); useC(); useD(); useE()
          return null
        }
      `,
      errors: [ { messageId: "tooManyInternalHooks" } ]
    }
  ]
})
