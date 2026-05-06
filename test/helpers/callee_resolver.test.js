import assert from "node:assert/strict"
import { test } from "node:test"
import { CalleeResolver } from "#helpers/callee_resolver"
import { dedent, ParsedCode } from "#support"

test("functionFor resolves a member call to a field holding a function", () => {
  const parsed = new ParsedCode(dedent`
    class Counter {
      #count = 0
      reset = () => { this.#count = 0 }

      clear() {
        this.reset()
      }
    }
  `)
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)).type, "ArrowFunctionExpression")
})

test("functionFor is null for a member the class does not define", () => {
  const parsed = new ParsedCode(dedent`
    class Counter {
      clear() {
        this.reset()
      }
    }
  `)
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)), null)
})

test("functionFor is null for a this member outside any class", () => {
  const parsed = new ParsedCode("function clear() { this.reset() }")
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)), null)
})

function calleeIn(parsed) {
  return parsed.firstNodeOfType("CallExpression").callee
}
