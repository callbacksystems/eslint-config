import assert from "node:assert/strict"
import { test } from "node:test"
import { Accumulation } from "#helpers/accumulation"
import { dedent, ParsedCode } from "#support"

test("kind names what an empty declaration above the loop collects", () => {
  assert.equal(accumulationIn(dedent`
    const names = []
    for (const item of items) names.push(item.name)
  `, "ForOfStatement").kind, "array")
  assert.equal(accumulationIn(dedent`
    const byId = {}
    for (const item of items) byId[item.id] = item
  `, "ForOfStatement").kind, "object")
  assert.equal(accumulationIn(dedent`
    const byId = new Map()
    items.forEach((item) => byId.set(item.id, item))
  `, "ExpressionStatement").kind, "map")
})

test("kind is null for a declaration that starts with content", () => {
  assert.equal(accumulationIn(dedent`
    const names = [ "root" ]
    for (const item of items) names.push(item.name)
  `, "ForOfStatement").kind, null)
})

test("kind is null for a forEach whose callback is not written inline", () => {
  assert.equal(accumulationIn(dedent`
    const names = []
    items.forEach(collect)
  `, "ExpressionStatement").kind, null)
})

test("kind skips a destructuring declaration above the loop", () => {
  assert.equal(accumulationIn(dedent`
    const { items } = options
    const names = []
    for (const item of items) names.push(item.name)
  `, "ForOfStatement").kind, "array")
})

test("kind is null for a loop with no statement list of its own", () => {
  assert.equal(accumulationIn(dedent`
    const names = []
    if (ready) for (const item of items) names.push(item.name)
  `, "ForOfStatement").kind, null)
})

test("kind is null when the body leaves the loop or does something else", () => {
  assert.equal(accumulationIn(dedent`
    const names = []
    for (const item of items) {
      if (item.hidden) continue
      names.push(item.name)
    }
  `, "ForOfStatement").kind, null)
  assert.equal(accumulationIn(dedent`
    const names = []
    items.forEach((item) => { log(item); names.push(item.name) })
  `, "ExpressionStatement").kind, null)
})

test("isPresent says whether there is a kind", () => {
  assert.equal(accumulationIn(dedent`
    const names = []
    for (const item of items) names.push(item.name)
  `, "ForOfStatement").isPresent, true)
  assert.equal(accumulationIn("for (const item of items) log(item)", "ForOfStatement").isPresent, false)
})

// The first statement of the type, which for `forEach` is the call rather than a statement inside its callback.
function accumulationIn(code, type) {
  return new Accumulation(new ParsedCode(code).firstNodeOfType(type))
}
