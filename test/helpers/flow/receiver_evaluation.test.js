import assert from "node:assert/strict"
import { test } from "node:test"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { dedent, ParsedCode } from "#support"
import { ReceiverEvaluation } from "#helpers/flow/receiver_evaluation"

test("receiver evaluation rejects effects that precede the native method lookup", () => {
  assert.equal(isReceiverSafe(`
    const x = { toString() { String.prototype.includes = () => 1; return "x" } }
    function ready() { return String(x).includes("x") }
  `, "includes"), false)
  assert.equal(isReceiverSafe(`
    const it = { *[Symbol.iterator]() { Set.prototype.has = () => 1; yield 1 } }
    function ready() { return new Set(it).has(1) }
  `, "has"), false)
  assert.equal(isReceiverSafe(`
    function ready() {
      return [ 1 ].map(() => { Array.prototype.some = () => 1; return 1 }).some(Boolean)
    }
  `, "some"), false)
  assert.equal(isReceiverSafe(`
    function ready() {
      return [ undefined ].map((value = (Array.prototype.some = () => 1)) => value).some(Boolean)
    }
  `, "some"), false)
})

test("receiver evaluation recognizes only implicit inert local construction", () => {
  assert.equal(isReceiverSafe(`
    class Entry {}
    function ready() { return [ new Entry() ].some(Boolean) }
  `, "some"), true)
  assert.equal(isReceiverSafe(`
    class Entry { value = (Array.prototype.some = () => 1) }
    function ready() { return [ new Entry() ].some(Boolean) }
  `, "some"), false)
  assert.equal(isReceiverSafe(`
    class Entry { constructor() { Array.prototype.some = () => 1 } }
    function ready() { return [ new Entry() ].some(Boolean) }
  `, "some"), false)
  assert.equal(isReceiverSafe(`
    function ready() { return [ new External() ].some(Boolean) }
  `, "some"), false)
})

test("receiver evaluation covers coercive, iterative, proxy, and pattern analogues", () => {
  assert.equal(isReceiverSafe(`
    const pattern = { toString() { RegExp.prototype.test = () => 1; return "x" } }
    function ready() { return new RegExp(pattern).test("x") }
  `, "test"), false)
  assert.equal(isReceiverSafe(`
    const source = { *[Symbol.iterator]() { Array.prototype.includes = () => 1; yield 1 } }
    function ready() { return Array.from(source).includes(1) }
  `, "includes"), false)
  assert.equal(isReceiverSafe(`
    const source = { *[Symbol.iterator]() { Uint8Array.prototype.some = () => 1; yield 1 } }
    function ready() { return Uint8Array.from(source).some(Boolean) }
  `, "some"), false)
  assert.equal(isReceiverSafe(`
    const input = { get pathname() { URLPattern.prototype.test = () => 1; return "*" } }
    function ready() { return new URLPattern(input).test("https://example.test") }
  `, "test"), false)
  assert.equal(isReceiverSafe(`
    const source = new Proxy({}, { ownKeys() { Array.prototype.includes = () => 1; return [] } })
    function ready() { return Object.keys(source).includes("key") }
  `, "includes"), false)
})

test("object and Web IDL conversion effects precede the native lookup", () => {
  assert.equal(isReceiverSafe(`
    const key = { toString() { Array.prototype.includes = () => 1; return "key" } }
    function ready() { return Object.values({ [key]: 1 }).includes(1) }
  `, "includes"), false)
  assert.equal(isReceiverSafe(`
    function ready() {
      return Object.values({ get key() { Array.prototype.includes = () => 1; return 1 } }).includes(1)
    }
  `, "includes"), false)
  assert.equal(isReceiverSafe(`
    function ready() {
      return new Headers({ get key() { Headers.prototype.has = () => 1; return "value" } }).has("key")
    }
  `, "has"), false)
  assert.equal(isReceiverSafe(`
    const value = { toString() { URLSearchParams.prototype.has = () => 1; return "value" } }
    function ready() { return new URLSearchParams([ [ "key", value ] ]).has("key") }
  `, "has"), false)
})

test("RegExp protocol getters on a bound literal make conversion and split unsafe", () => {
  assert.equal(isReceiverSafe(`
    const pattern = /x/
    Object.defineProperty(pattern, Symbol.match, {
      get() { RegExp.prototype.test = () => 1; return true }
    })
    function ready() { return new RegExp(pattern).test("x") }
  `, "test"), false)
  assert.equal(isReceiverSafe(`
    const separator = /x/
    Object.defineProperty(separator, Symbol.split, {
      get() { Array.prototype.some = () => 1; return RegExp.prototype[Symbol.split] }
    })
    function ready() { return "x".split(separator).some(Boolean) }
  `, "some"), false)
  assert.equal(isReceiverSafe(`
    const pattern = /x/
    Object.defineProperty(pattern, "source", {
      get() { RegExp.prototype.test = () => 1; return "x" }
    })
    function ready() { return new RegExp(pattern).test("x") }
  `, "test"), false)
  assert.equal(isReceiverSafe(`
    const pattern = /x/
    Object.defineProperty(pattern, "flags", {
      get() { RegExp.prototype.test = () => 1; return "" }
    })
    function ready() { return new RegExp(pattern).test("x") }
  `, "test"), false)
})

test("weak collection keys must be objects before they can produce a boolean receiver", () => {
  assert.equal(isReceiverSafe("function ready() { return new WeakSet('x').has(value) }", "has"), false)
  assert.equal(isReceiverSafe("function ready() { return new WeakSet([ 1 ]).has(value) }", "has"), false)
  assert.equal(isReceiverSafe("function ready() { return new WeakSet([ {} ]).has(value) }", "has"), true)
  assert.equal(isReceiverSafe("function ready() { return new WeakMap([ [ 1, 2 ] ]).has(value) }", "has"), false)
  assert.equal(isReceiverSafe("function ready() { return new WeakMap([ [ {}, 2 ] ]).has(value) }", "has"), true)
})

test("typed array element conversion respects the Number and BigInt domains", () => {
  const unsafeCases = [
    "new Uint8Array(1n)",
    "Uint8Array.of(1n)",
    "Uint8Array.from([ 1n ])",
    "new BigInt64Array(1n)",
    "new BigInt64Array([ 1 ])",
    "BigInt64Array.of(1)",
    "BigInt64Array.of(undefined)",
    "BigUint64Array.from([ null ])",
    "BigInt64Array.from('x')",
    "BigInt64Array.of(value)"
  ]
  unsafeCases.forEach((receiver) => assert.equal(isReceiverSafe(
    `function ready() { return ${receiver}.some(Boolean) }`, "some"
  ), false))

  const safeCases = [
    "new Uint8Array([ 1, undefined, 'x' ])",
    "Uint8Array.of(1, undefined, true)",
    "new BigInt64Array([ 1n, true, '2' ])",
    "BigInt64Array.of(-1n, false, `2`)",
    "BigUint64Array.from([ 1n, '2' ])",
    "BigInt64Array.from('12')"
  ]
  safeCases.forEach((receiver) => assert.equal(isReceiverSafe(
    `function ready() { return ${receiver}.some(Boolean) }`, "some"
  ), true))
})

test("nullable Web constructors must produce a receiver", () => {
  assert.equal(isReceiverSafe("function ready() { return new Headers(null).has('key') }", "has"), false)
  assert.equal(isReceiverSafe("function ready() { return new FormData(null).has('key') }", "has"), false)
  assert.equal(isReceiverSafe("function ready() { return new URLSearchParams(null).has('key') }", "has"), true)
})

test("exact native inputs preserve diagnostics without trusting dynamic inputs", () => {
  const safeCases = [
    [ "function ready() { return String('x').includes('x') }", "includes" ],
    [ "function ready() { return new Set([ 1 ]).has(1) }", "has" ],
    [ "function ready() { return new Map([ [ 'key', 1 ] ]).has('key') }", "has" ],
    [ "function ready() { return Array.from([ 1 ]).some(Boolean) }", "some" ],
    [ "function ready() { return [ 1 ].map((value) => value).some(Boolean) }", "some" ],
    [ "function ready() { return Array.from([ 1 ], undefined).some(Boolean) }", "some" ],
    [ "const mapper = undefined; function ready() { return Array.from([ 1 ], mapper).some(Boolean) }", "some" ],
    [ "function ready() { return Uint8Array.from([ 1 ]).some(Boolean) }", "some" ],
    [ "const mapper = undefined; function ready() { return Uint8Array.from([ 1 ], mapper).some(Boolean) }", "some" ],
    [ "const pattern = /x/; function ready() { return new RegExp(pattern).test('x') }", "test" ],
    [ "function ready() { return RegExp(/x/).test('x') }", "test" ],
    [ "function ready() { return Object.keys({ key: 1 }).includes('key') }", "includes" ],
    [ "function ready() { return Object.keys([ , 1 ]).includes('1') }", "includes" ],
    [ "const key = 'key'; function ready() { return Object.values({ [key]: 1 }).includes(1) }", "includes" ],
    [ "function ready() { return Object.keys({ get key() { throw 1 } }).includes('key') }", "includes" ],
    [ "function ready() { return new Headers({ key: 'value' }).has('key') }", "has" ],
    [ "function ready() { return new Headers([ [ 'key', 'value' ] ]).has('key') }", "has" ],
    [ "function ready() { return new URLSearchParams('key=1').has('key') }", "has" ],
    [ "function ready() { return new URLSearchParams({ key: 'value' }).has('key') }", "has" ],
    [ "function ready() { return new URLSearchParams([ [ 'key', 'value' ] ]).has('key') }", "has" ],
    [ "function ready() { return new URLPattern('*').test('https://example.test') }", "test" ],
    [ "function ready() { return 'x'.split(/x/).some(Boolean) }", "some" ]
  ]
  safeCases.forEach(([ code, method ]) => assert.equal(isReceiverSafe(code, method), true))
})

test("an undefined mapper is resolved by binding rather than spelling", () => {
  assert.equal(isReceiverSafe(`
    function ready(undefined) { return Array.from([ 1 ], undefined).some(Boolean) }
  `, "some"), false)
  assert.equal(isReceiverSafe(`
    function ready(undefined) { return Uint8Array.from([ 1 ], undefined).some(Boolean) }
  `, "some"), false)
})

test("receiver expressions reject coercion hooks and retain inert operators", () => {
  [
    [ "1 + 2", true ],
    [ "input + 2", false ],
    [ "input === other", true ],
    [ "-1", true ],
    [ "-input", false ],
    [ "!input", true ],
    [ "typeof input", true ],
    [ "void input", true ],
    [ "delete input.key", false ],
    [ "tag`text`", false ],
    [ dedent`${"`"}text${"$"}{1}${"`"}`, true ],
    [ dedent`${"`"}text${"$"}{input}${"`"}`, false ],
    [ "input.key", false ],
    [ "[...input]", false ],
    [ "({ [input]: 1 })", false ],
    [ "({ [1]: 1 })", true ],
    [ "(class {})", false ],
    [ "new (factory())()", false ],
    [ "String['raw']`text`", false ],
    [ "unknown()", false ]
  ].forEach(([ expression, expected ]) => {
    assert.equal(isReceiverSafe(`function ready(input) { return [${expression}].some(Boolean) }`, "some"),
      expected, expression)
  })
})

test("local construction accounts for inheritance and nonexecuting members", () => {
  assert.equal(isReceiverSafe("class Base {} class Entry extends Base {} "
    + "function ready() { return [new Entry()].some(Boolean) }", "some"), false)
  assert.equal(isReceiverSafe("class Entry { static value = external(); field; method() {} } "
    + "function ready() { return [new Entry()].some(Boolean) }", "some"), true)
})

test("receiver evaluation validates RegExp protocol replacements and explicit flags", () => {
  [
    [ "RegExp.prototype[Symbol.match] = custom; RegExp(/x/)", false ],
    [ "RegExp(/x/, undefined)", true ],
    [ "RegExp(/x/, void value)", true ],
    [ "RegExp(/x/, 'g')", true ],
    [ "RegExp(/x/, flags)", false ],
    [ "const flags = undefined; RegExp(/x/, flags)", true ]
  ].forEach(([ receiver, expected ]) => {
    assert.equal(isReceiverSafe(`${receiver}.test('x')`, "test"), expected, receiver)
  })
  assert.equal(isReceiverSafe("const separator = new RegExp('x'); 'x'.split(separator).some(Boolean)", "some"), true)
  assert.equal(isReceiverSafe("'x'.split(separator).some(Boolean)", "some"), false)
  assert.equal(isReceiverSafe("'x'.split(',', limit).some(Boolean)", "some"), false)
  assert.equal(isReceiverSafe("Set.prototype.add = custom; new Set([1]).has(1)", "has"), false)
  assert.equal(isReceiverSafe("const key = {}; new WeakMap([[key, 2]]).has(key)", "has"), true)
  assert.equal(isReceiverSafe("new WeakMap([[key, 2]]).has(key)", "has"), false)
})

function isReceiverSafe(code, method) {
  const parsed = new ParsedCode(code)
  return new ReceiverEvaluation(receiverFor(parsed, method), BindingResolver.for(parsed.sourceCode)).isSafe
}

function receiverFor(parsed, method) {
  return parsed.nodesOfType("CallExpression").find((candidate) =>
    candidate.callee.type === "MemberExpression" && candidate.callee.property.name === method).callee.object
}
