import rule from "#rules/prefer-switch-over-if-chain"
import { dedent, tester } from "#test/support"

tester.run("prefer-switch-over-if-chain", rule, {
  valid: [
    "if (x === 1) doA(); else doB()",
    dedent`
      if (x === 1) doA()
      else if (y === 2) doB()
    `,
    dedent`
      if (x === 1) doA()
      else doB()
    `
  ],
  invalid: [
    {
      code: dedent`
        if (kind === "a") doA()
        else if (kind === "b") doB()
        else if (kind === "c") doC()
      `,
      errors: [ { messageId: "preferSwitch" } ]
    },
    {
      code: dedent`
        if (action === 1) handle1()
        else if (action === 2) handle2()
        else if (action === 3) handle3()
        else handleDefault()
      `,
      errors: [ { messageId: "preferSwitch" } ]
    }
  ]
})
