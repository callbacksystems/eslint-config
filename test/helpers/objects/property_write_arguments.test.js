import assert from "node:assert/strict"
import { test } from "node:test"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ParsedCode } from "#support"
import { StandardPropertyWrites } from "#helpers/objects/standard_property_writes"

test("recognizes an unresolved binding as the exact Reflect.set receiver", () => {
  const writes = standardWritesIn("function attach(target, value) { Reflect.set(target, 'headers', value, target) }")

  assert.equal(writes.length, 1)
  assert.equal(writes[0].name, "headers")
})

test("rejects receiver equality when an intervening argument may rebind it", () => {
  [
    "Reflect.set(target, (target = other, 'headers'), value, target)",
    "Reflect.set(target, 'headers', (target = other, value), target)"
  ].forEach((call) => {
    assert.deepEqual(standardWritesIn(`function attach(target, value) { ${call} }`), [], call)
  })
})

test("descriptor maps distinguish missing, primitive, spread, and dynamic entries", () => {
  [
    [ "Object.defineProperties(target)", [] ],
    [ "Object.defineProperties(target, ...descriptors)", [ null ] ],
    [ "Object.defineProperties(target, /x/)", [] ],
    [ "Object.defineProperties(target, 1)", [] ],
    [ "Object.defineProperties(target, unknown)", [ null ] ],
    [ "Object.defineProperties(target, { __proto__: null })", [] ],
    [ "Object.defineProperties(target, { [key]: {} })", [ null ] ],
    [ "Object.defineProperties(target, { key: { enumerable: true } })", [] ],
    [ "Object.defineProperties(target, { key: { value: 1 } })", [ "key" ] ],
    [ "Object.defineProperties(target, { ...{ key: { value: 1 } } })", [ "key" ] ],
    [ "Object.defineProperties(target, { get key() { return descriptor } })", [ "key" ] ],
    [ "Object.defineProperty(target, 'key', 1)", [] ],
    [ "Object.defineProperty(target, 'key', unknown)", [ "key" ] ],
    [ "Object.setPrototypeOf(target)", [] ],
    [ "Object.setPrototypeOf(target, ...sources)", [ null ] ],
    [ "Reflect.set(target, 'key', value, globalThis.Object)", [] ],
    [ "Reflect.set(globalThis.Object, 'key', value, globalThis.Object)", [ "key" ] ],
    [ "Reflect.set(globalThis.Object, 'key', value, globalThis.Array)", [] ]
  ].forEach(([ code, names ]) => {
    assert.deepEqual(standardWritesIn(code).map((write) => write.name), names, code)
  })
})

test("descriptor spreads preserve exact values only through inert sources", () => {
  [
    [ "{ value: 1, ...null }", 1 ],
    [ "{ value: 1, .../x/ }", 1 ],
    [ "{ value: 1, ...unknown }", null ],
    [ "{ value: 1, ...{ enumerable: true } }", 1 ],
    [ "{ value: 1, ...{ value: 2 } }", 2 ],
    [ "{ value: 1, ...{ [key]: 2 } }", null ],
    [ "{ value: 1, get value() { return 2 } }", null ]
  ].forEach(([ descriptor, expected ]) => {
    const writes = standardWritesIn(`Object.defineProperty(target, 'key', ${descriptor})`)
    assert.equal(writes.length, 1, descriptor)
    assert.equal(writes[0].value?.value ?? null, expected, descriptor)
  })
})

function standardWritesIn(code) {
  const parsed = new ParsedCode(code)
  return new StandardPropertyWrites(
    parsed.nodesOfType("CallExpression").find((node) => node.callee.type === "MemberExpression"),
    BindingResolver.for(parsed.sourceCode)
  ).values
}
