import assert from "node:assert/strict"
import { test } from "node:test"
import { ResolutionCache } from "#helpers/scope/resolution_cache"

test("remembers false, null, and undefined resolutions without evaluating them again", () => {
  [ false, null, undefined ].forEach((value) => {
    const variable = {}
    const steps = {
      calls: 0,
      stepFrom() {
        steps.calls += 1
        return ResolutionCache.final(value)
      }
    }
    const cache = new ResolutionCache(steps, "unknown")

    assert.equal(cache.valueFrom(variable), value)
    assert.equal(cache.valueFrom(variable), value)
    assert.equal(steps.calls, 1)
  })
})

test("remembers a cycle fallback for every binding reached before the cycle closes", () => {
  const variables = [ {}, {} ]
  const steps = {
    calls: 0,
    stepFrom(variable) {
      steps.calls += 1
      return ResolutionCache.following(variable === variables[0] ? variables[1] : variables[0])
    }
  }
  const cache = new ResolutionCache(steps, false)

  assert.equal(cache.valueFrom(variables[0]), false)
  assert.equal(cache.valueFrom(variables[1]), false)
  assert.equal(cache.valueFrom(null), false)
  assert.equal(steps.calls, 2)
})
