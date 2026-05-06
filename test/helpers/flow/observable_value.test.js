import assert from "node:assert/strict"
import { test } from "node:test"
import { ObservableValue } from "#helpers/flow/observable_value"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ParsedCode } from "#support"

test("fresh member values preserve well-known symbol identity", () => {
  assert.equal(statusOf("function subject() { const box = { [Symbol.iterator]: {} }; "
    + "box[Symbol.iterator].used = true }"), "none")
  assert.equal(statusOf("function subject(input) { const box = { [Symbol.iterator]: input }; "
    + "box[Symbol.iterator].used = true }"), "effect")
})

test("member overwrite paths distinguish well-known symbols", () => {
  assert.equal(statusOf("function subject() { const box = { [Symbol.iterator]: {}, [Symbol.toStringTag]: {} }; "
    + "box[Symbol.iterator] = external; box[Symbol.toStringTag].used = true }"), "none")
  assert.equal(statusOf("function subject() { const box = { [Symbol.iterator]: {} }; "
    + "box[Symbol.iterator] = external; box[Symbol.iterator].used = true }"), "unknown")
})

test("symbolic member provenance is validated at its evaluation point", () => {
  assert.equal(statusOf("globalThis.Symbol = Fake; function subject() { "
    + "const box = { [Symbol.iterator]: {} }; box[Symbol.iterator].used = true }"), "unknown")
  assert.equal(statusOf("const iterator = Symbol.iterator; globalThis.Symbol = Fake; function subject() { "
    + "const box = { [iterator]: {} }; box[iterator].used = true }"), "none")
})

test("writes through argument containers distinguish the container from its contents", () => {
  [
    [ "arguments.used = true", "none" ],
    [ "arguments[0].used = true", "effect" ],
    [ "const [...items] = arguments; items.used = true", "none" ],
    [ "const [...items] = arguments; items[0].used = true", "effect" ],
    [ "const { ...items } = input; items.used = true", "none" ],
    [ "const { ...items } = input; items.first.used = true", "effect" ]
  ].forEach(([ body, expected ]) => {
    assert.equal(statusOf(`function subject(input) { ${body} }`), expected, body)
  })
  assert.equal(statusOf("function subject(...items) { items.used = true }"), "none")
  assert.equal(statusOf("function subject(...items) { items[0].used = true }"), "effect")
})

test("destructuring follows fresh array elements and preserves uncertainty", () => {
  [
    [ "const [box] = [{}]; box.used = true", "none" ],
    [ "const [, box] = [{}, input]; box.used = true", "effect" ],
    [ "const [box] = []; box.used = true", "unknown" ],
    [ "const [box = {}] = input; box.used = true", "unknown" ],
    [ "const [...boxes] = [{}]; boxes[0].used = true", "unknown" ],
    [ "const { ...boxes } = { first: {} }; boxes.first.used = true", "unknown" ],
    [ "const box = []; box[key].used = true", "unknown" ],
    [ "const box = [,...input]; box[1].used = true", "unknown" ],
    [ "const box = [,...input]; box[0].used = true", "unknown" ],
    [ "const box = { first: {}, ...input }; box.first.used = true", "unknown" ],
    [ "const box = { get first() { return {} } }; box.first.used = true", "unknown" ],
    [ "const box = () => {}; box.first.used = true", "unknown" ],
    [ "function box() {}; box.used = true", "unknown" ],
    [ "let box; box.used = true", "unknown" ],
    [ "const box = input; box.used = true", "effect" ],
    [ "external.used = true", "effect" ]
  ].forEach(([ body, expected ]) => {
    assert.equal(statusOf(`function subject(input) { ${body} }`), expected, body)
  })
})

test("dynamic local lookup cannot prove a write stays local", () => {
  assert.equal(statusOf("function subject() { const box = {}; "
    + "with (external) { box.used = true } }", { sourceType: "script" }), "unknown")
})

test("optional member deletion cannot prove the receiver is a fresh local value", () => {
  assert.equal(statusOf("function subject() { const box = {}; delete box?.first.used }"), "unknown")
})

test("updates and dynamic member paths invalidate earlier fresh values", () => {
  [
    "const box = { first: {} }; box.first++; box.first.used = true",
    "const box = { first: {}, other: {} }; box.first = external; box[key].used = true",
    "const box = { first: { next: {} } }; box.first.next = external; box.first[key].used = true"
  ].forEach((body) => assert.equal(statusOf(`function subject() { ${body} }`), "unknown", body))
})

function statusOf(code, options) {
  const parsed = new ParsedCode(code, options)
  return new ObservableValue(
    parsed.nodesOfType("MemberExpression").find((node) => node.property.name === "used"),
    parsed.firstNodeOfType("FunctionDeclaration"),
    BindingResolver.for(parsed.sourceCode)
  ).status
}
