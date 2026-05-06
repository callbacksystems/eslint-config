import assert from "node:assert/strict"
import { test } from "node:test"
import { ThisDispatch } from "#helpers/flow/this_dispatch"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ParsedCode } from "#support"

const EXACT_RECEIVER = { isFreshReceiverDispatchExactFor: () => true }

test("this dispatch preserves distinct well-known symbol identities", () => {
  assert.ok(new DispatchFixture(
    "class C { run() { this[Symbol.toStringTag] = custom; this[Symbol.iterator]() } }").isExact)
  assert.ok(!new DispatchFixture(
    "class C { run() { this[Symbol.iterator] = custom; this[Symbol.iterator]() } }").isExact)
})

test("this dispatch treats invalid symbolic provenance as an unknown property", () => {
  assert.ok(!new DispatchFixture(
    "globalThis.Symbol = Fake; class C { "
    + "run() { this[Symbol.toStringTag] = custom; this[Symbol.iterator]() } }").isExact)
})

test("this dispatch observes direct and indirect prototype rewrites", () => {
  const rewrites = [
    "class C { read() {} run() { this.read() } } C.prototype.read = replacement",
    "class C { read() {} run() { this.read() } } const prototype = C.prototype; prototype.read = replacement",
    "class C { read() {} run() { this.read() } } "
    + "Object.defineProperty(C.prototype, 'read', { value: replacement })",
    "class C { read() {} run() { this.read() } } Object.assign(C.prototype, { read: replacement })",
    "class C { read() {} run() { this.read() } } Reflect.set(C.prototype, 'read', replacement)"
  ]

  rewrites.forEach((code) => assert.ok(!new DispatchFixture(code).isExact, code))
})

test("this dispatch preserves unrelated structural member identities", () => {
  assert.ok(new DispatchFixture("class C { read() {} run() { this.read() } } C.prototype.write = replacement").isExact)
  assert.ok(new DispatchFixture(
    "class C { iterator() {} run() { this.iterator() } } C.prototype[Symbol.iterator] = replacement").isExact)
  assert.ok(new DispatchFixture(
    "class C { [Symbol.iterator]() {} run() { this[Symbol.iterator]() } } "
    + "C.prototype[Symbol.toStringTag] = replacement").isExact)
  assert.ok(!new DispatchFixture(
    "class C { [Symbol.iterator]() {} run() { this[Symbol.iterator]() } } "
    + "C.prototype[Symbol.iterator] = replacement").isExact)
})

test("this dispatch keeps private names separate from public string keys", () => {
  assert.ok(new DispatchFixture(
    "class C { #read() {} run() { this.#read() } } C.prototype['#read'] = replacement").isExact)
})

test("this dispatch separates static and instance mutations", () => {
  assert.ok(new DispatchFixture(
    "class C { static read() {} static run() { this.read() } } C.prototype.read = replacement").isExact)
  assert.ok(!new DispatchFixture(
    "class C { static read() {} static run() { this.read() } } C.read = replacement").isExact)
  assert.ok(new DispatchFixture("class C { read() {} run() { this.read() } } C.read = replacement").isExact)
})

test("this dispatch observes mutations of inherited implementations", () => {
  assert.ok(!new DispatchFixture(
    "class Base { read() {} } class C extends Base { run() { this.read() } } "
    + "Base.prototype.read = replacement").isExact)
})

test("this dispatch skips only unrelated inherited mutations", () => {
  const classes = "class Base { read() {} }; class Middle extends Base {}; "
    + "class C extends Middle { run() { this.read() } }; Middle.prototype.other = replacement; "
  assert.ok(!new DispatchFixture(`${classes}Base.prototype.read = replacement`).isExact)
  assert.ok(!new DispatchFixture(`${classes}Middle.prototype[key] = replacement`).isExact)
})

test("this dispatch ignores descriptor edits that retain the callable value", () => {
  assert.ok(new DispatchFixture(
    "class C { read() {} run() { this.read() } } "
    + "Object.defineProperty(C.prototype, 'read', { enumerable: true })").isExact)
})

test("this dispatch ignores rewrites in inactive local functions", () => {
  assert.ok(new DispatchFixture(
    "class C { read() {} run() { this.read() } } "
    + "function unused() { C.prototype.read = replacement }").isExact)
})

test("this dispatch ignores rewrites reachable only through inactive local callers", () => {
  assert.ok(new DispatchFixture(
    "class C { read() {} run() { this.read() } } "
    + "function rewrite() { C.prototype.read = replacement } function unused() { rewrite() }").isExact)
})

test("this dispatch observes transitively active local rewrites", () => {
  assert.ok(!new DispatchFixture(
    "class C { read() {} run() { this.read() } } "
    + "function rewrite() { C.prototype.read = replacement } function patch() { rewrite() }; patch()").isExact)
})

test("this dispatch observes loop-carried writes only for matching properties", () => {
  assert.ok(!new DispatchFixture(
    "class C { run() { while (condition) { this.read(); this.read = replacement } } }").isExact)
  assert.ok(new DispatchFixture(
    "class C { run() { while (condition) { this.read(); this.write = replacement } } }").isExact)
})

test("this dispatch deduplicates destructuring writes and retains distinct loop writes", () => {
  assert.ok(!new DispatchFixture("class C { run() { "
    + "({ first: this.read, second: this.read } = source); this.read() } }").isExact)
  assert.ok(!new DispatchFixture("class C { run() { while (condition) { "
    + "this.read = this.read(); this.read = replacement } } }").isExact)
})

test("this dispatch indexes wide unrelated writes across many members", () => {
  assert.ok(new DispatchFixture(wideThisDispatch(1_000)).areExact)
})

test("this dispatch preserves inherited mutation checks across class cycles", () => {
  const stable = "class Left extends Right { read() {} }; class Right extends Left { run() { this.read() } }"
  const mutated = `${stable}; Left.prototype.read = replacement`

  assert.ok(new DispatchFixture(stable).isExact)
  assert.ok(!new DispatchFixture(mutated).isExact)
})

test("this dispatch compresses mutation-free inheritance paths", () => {
  assert.ok(new DispatchFixture(deepInheritanceDispatch(1_000)).areExact)
})

test("this dispatch compresses inheritance paths with unrelated mutations", () => {
  assert.ok(new DispatchFixture(deepInheritanceDispatchWithUnrelatedMutations(1_000)).areExact)
})

class DispatchFixture {
  #bindings
  #dispatchValue
  #parsed

  constructor(code) {
    this.#parsed = new ParsedCode(code)
    this.#bindings = new BindingResolver(this.#parsed.sourceCode)
  }

  get isExact() {
    return this.#dispatch.isExactFor(this.#callees[0])
  }

  get areExact() {
    return this.#callees.every((callee) => this.#dispatch.isExactFor(callee))
  }

  get #dispatch() {
    return this.#dispatchValue ??= new ThisDispatch(this.#parsed.sourceCode, {
      bindings: this.#bindings, resolver: EXACT_RECEIVER
    })
  }

  get #callees() {
    return this.#parsed.nodesOfType("CallExpression")
      .filter((call) => call.callee.type === "MemberExpression" && call.callee.object.type === "ThisExpression")
      .map((call) => call.callee)
  }
}

function wideThisDispatch(length) {
  return `class C { run() { ${indexedThisMembers({ length, prefix: "this.w", suffix: " = replacement" })};`
    + `${indexedThisMembers({ length, prefix: "this.m", suffix: "()" })} } }`
}

function indexedThisMembers({ length, prefix, suffix }) {
  return Array.from({ length }, (_value, index) => `${prefix}${index}${suffix}`).join(";")
}

function deepInheritanceDispatch(length) {
  return [ "class C0 { read() {} }", ...Array.from({ length }, (_value, index) =>
    `class C${index + 1} extends C${index} { run() { this.read() } }`) ].join(";")
}

function deepInheritanceDispatchWithUnrelatedMutations(length) {
  return [ "class C0 { read() {} }", ...Array.from({ length }, (_value, index) =>
    `class C${index + 1} extends C${index} { run() { this.read() } }; `
    + `C${index + 1}.prototype.other = replacement`) ].join(";")
}
