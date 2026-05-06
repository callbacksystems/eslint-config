import rule from "#rules/no-deep-optional-chain"
import { tester } from "#test/support"

tester.run("no-deep-optional-chain", rule, {
  valid: [ "const x = a?.b", "const y = a?.b?.c", "const z = a?.b?.c?.d", "const m = a.b.c.d.e", "const n = a?.b().c" ],
  invalid: [
    { code: "const w = a?.b?.c?.d?.e", errors: [ { messageId: "deepOptionalChain" } ] },
    { code: "const v = obj?.foo?.bar?.baz?.qux?.quux", errors: [ { messageId: "deepOptionalChain" } ] }
  ]
})
