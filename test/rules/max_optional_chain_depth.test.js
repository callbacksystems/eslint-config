import rule from "#rules/max_optional_chain_depth"
import { tester } from "#support"

tester.run("max-optional-chain-depth", rule, {
  valid: [
    "const x = a?.b",
    "const y = a?.b?.c",
    "const z = a?.b?.c?.d",
    "const m = a.b.c.d.e",
    "const n = a?.b().c",
    // A higher `max` allows deeper chains.
    { code: "const w = a?.b?.c?.d?.e", options: [ { max: 4 } ] }
  ],
  invalid: [
    { code: "const w = a?.b?.c?.d?.e", errors: [ { messageId: "tooDeep" } ] },
    { code: "const v = obj?.foo?.bar?.baz?.qux?.quux", errors: [ { messageId: "tooDeep" } ] },
    // A lower `max` flags shallower chains.
    { code: "const u = a?.b?.c", options: [ { max: 1 } ], errors: [ { messageId: "tooDeep" } ] }
  ]
})
