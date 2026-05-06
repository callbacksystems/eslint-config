import assert from "node:assert/strict"
import { test } from "node:test"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"
import { ParsedCode } from "#support"

test("matches global paths and their stable aliases", () => {
  const direct = identityAt("use(Array.from)", "MemberExpression")
  const alias = identityAt("const prototype = Array.prototype; use(prototype.some)", "MemberExpression", -1)
  const globalAccess = identityAt("use(globalThis.Array.from)", "MemberExpression")

  assert.ok(direct.identity.matches(direct.node, "Array", [ "from" ]))
  assert.ok(alias.identity.matches(alias.node, "Array", [ "prototype", "some" ]))
  assert.ok(globalAccess.identity.matches(globalAccess.node, "Array", [ "from" ]))
})

test("matches optional global paths because standard globals are present", () => {
  const { identity, node } = identityAt("use(Object?.defineProperty)", "MemberExpression")

  assert.ok(identity.matches(node, "Object", [ "defineProperty" ]))
})

test("follows object destructuring aliases without guessing property names", () => {
  [
    "const { prototype } = Array; use(prototype.some)",
    "const { prototype: alias } = Array; use(alias.some)",
    "const key = 'prototype'; const { [key]: alias } = Array; use(alias.some)"
  ].forEach((code) => {
    const { identity, node } = identityAtArgument(code)
    assert.ok(identity.matches(node, "Array", [ "prototype", "some" ]), code)
  })
})

test("rejects unsupported or unavailable destructuring aliases", () => {
  [
    "const { prototype: alias = fallback } = Array; use(alias.some)",
    "const { ...alias } = Array; use(alias.some)",
    "const { [key]: alias } = Array; use(alias.some)",
    "let alias; use(alias.some); ({ prototype: alias } = Array)"
  ].forEach((code) => {
    const { identity, node } = identityAt(code, "MemberExpression", -1)
    assert.ok(!identity.matches(node, "Array", [ "prototype", "some" ]), code)
  })
})

test("rejects shadows and writes that can replace a path prefix", () => {
  [
    "function run(Array) { use(Array.from) }",
    "Array.from = replacement; use(Array.from)",
    "Array[member] = replacement; use(Array.from)",
    "Array.prototype = replacement; use(Array.prototype.some)",
    "const prototype = Array.prototype; prototype.some = replacement; use(Array.prototype.some)",
    "const { prototype } = Array; prototype.some = replacement; use(Array.prototype.some)",
    "Object.defineProperty(Array, 'from', descriptor); use(Array.from)",
    "Reflect.set(Array.prototype, 'some', replacement); use(Array.prototype.some)",
    "Object.assign(Array, source); use(Array.from)"
  ].forEach((code) => {
    const { identity, node } = identityAtArgument(code)
    const members = node.property.name === "some" ? [ "prototype", "some" ] : [ "from" ]
    assert.ok(!identity.matches(node, "Array", members), code)
  })
})

test("applies logical assignments according to the expected intrinsic value", () => {
  [
    "Array.prototype.every ||= custom; use(Array.prototype.every)",
    "Array.prototype.every ??= custom; use(Array.prototype.every)"
  ].forEach((code) => {
    const { identity, node } = identityAtArgument(code)
    assert.ok(identity.matches(node, "Array", [ "prototype", "every" ]), code)
  })

  const changed = identityAtArgument("Array.prototype.every &&= custom; use(Array.prototype.every)")
  assert.ok(!changed.identity.matches(changed.node, "Array", [ "prototype", "every" ]))
})

test("applies logical assignments to an expected absent descriptor property", () => {
  const replacement = identityAtArgument(
    "Object.prototype.value ||= custom; Object.defineProperty(Array.prototype, 'every', {}); "
    + "use(Array.prototype.every)")
  const noOp = identityAtArgument(
    "Object.prototype.value &&= custom; Object.defineProperty(Array.prototype, 'every', {}); "
    + "use(Array.prototype.every)")

  assert.ok(!replacement.identity.matches(replacement.node, "Array", [ "prototype", "every" ]))
  assert.ok(noOp.identity.matches(noOp.node, "Array", [ "prototype", "every" ]))
})

test("observes standard writes through an optional global receiver", () => {
  [
    "Object?.defineProperty(Array.prototype, 'some', descriptor); use(Array.prototype.some)",
    "Reflect?.set(Array.prototype, 'some', replacement); use(Array.prototype.some)",
    "Object?.assign(Array.prototype, source); use(Array.prototype.some)"
  ].forEach((code) => {
    const { identity, node } = identityAtArgument(code)
    assert.ok(!identity.matches(node, "Array", [ "prototype", "some" ]), code)
  })
})

test("observes standard writes forwarded through Function.prototype.call", () => {
  [
    "Object.defineProperty.call(null, Array.prototype, 'some', descriptor); use(Array.prototype.some)",
    "const { defineProperty } = Object; defineProperty.call(null, Array.prototype, 'some', descriptor); "
    + "use(Array.prototype.some)"
  ].forEach((code) => {
    const { identity, node } = identityAtArgument(code)
    assert.ok(!identity.matches(node, "Array", [ "prototype", "some" ]), code)
  })
})

test("observes standard writes forwarded through Function.prototype.apply", () => {
  const code = "Object.defineProperty.apply(null, [Array.prototype, 'some', descriptor]); "
    + "use(Array.prototype.some)"
  const { identity, node } = identityAtArgument(code)

  assert.ok(!identity.matches(node, "Array", [ "prototype", "some" ]))
})

test("does not trust replaced standard call forwarders", () => {
  [
    "Object.defineProperty.call = forward; "
    + "Object.defineProperty.call(null, Array.prototype, 'some', descriptor); use(Array.prototype.some)",
    "Object.defineProperty.apply = forward; "
    + "Object.defineProperty.apply(null, [Array.prototype, 'some', descriptor]); use(Array.prototype.some)",
    "Function.prototype.apply = forward; "
    + "Object.defineProperty.apply(null, [Array.prototype, 'some', descriptor]); use(Array.prototype.some)"
  ].forEach((code) => {
    const { identity, node } = identityAtArgument(code)
    assert.ok(identity.matches(node, "Array", [ "prototype", "some" ]), code)
  })
})

test("observes standard writes forwarded through Reflect.apply with an explicit argument array", () => {
  const code = "Reflect.apply(Object.defineProperty, null, [Array.prototype, 'some', descriptor]); "
    + "use(Array.prototype.some)"
  const { identity, node } = identityAtArgument(code)

  assert.ok(!identity.matches(node, "Array", [ "prototype", "some" ]))
})

test("does not trust a replaced Reflect.apply forwarder", () => {
  const code = "Reflect.apply = forward; "
    + "Reflect.apply(Object.defineProperty, null, [Array.prototype, 'some', descriptor]); "
    + "use(Array.prototype.some)"
  const { identity, node } = identityAtArgument(code)

  assert.ok(identity.matches(node, "Array", [ "prototype", "some" ]))
})

test("normalizes indirect writes through globalThis", () => {
  [
    "Object.defineProperty(globalThis, 'Array', { value: Replacement }); use(Array)",
    "Reflect.set(globalThis, 'Array', Replacement); use(Array)",
    "Object.assign(globalThis, replacements); use(Array)"
  ].forEach((code) => {
    const { identity, node } = identityAt(code, "Identifier", -1)
    assert.ok(!identity.matches(node, "Array"), code)
  })
})

test("keeps a top-level use before a later write", () => {
  const { identity, node } = identityAt("use(Array.from); Array.from = replacement", "MemberExpression")

  assert.ok(identity.matches(node, "Array", [ "from" ]))
})

test("keeps a one-shot loop iterable lookup before a later write", () => {
  const { identity, node } = identityAt(
    "for (const value of Array.from(source)) use(value); Array.from = replacement", "MemberExpression")

  assert.ok(identity.matches(node, "Array", [ "from" ]))
})

test("separates intrinsic members from replaceable global roots", () => {
  const rootWrite = identityAtArgument("globalThis.Array = Fake; use(Array.prototype.some)")
  const memberWrite = identityAtArgument("Array.prototype.some = fake; use(Array.prototype.some)")

  assert.ok(rootWrite.identity.isIntrinsicUnmodifiedAt(rootWrite.node, "Array", [ "prototype", "some" ]))
  assert.ok(!memberWrite.identity.isIntrinsicUnmodifiedAt(memberWrite.node, "Array", [ "prototype", "some" ]))
})

test("keeps string and well-known Symbol property identities distinct", () => {
  const stringWrite = identityAtArgument("RegExp.prototype['split'] = fake; use(RegExp.prototype[Symbol.split])")
  const symbolWrite = identityAtArgument("RegExp.prototype[Symbol.split] = fake; use(RegExp.prototype['split'])")

  assert.ok(stringWrite.identity.matches(stringWrite.node, "RegExp", [ "prototype", Symbol.split ]))
  assert.ok(symbolWrite.identity.matches(symbolWrite.node, "RegExp", [ "prototype", "split" ]))
})

test("retains the temporal provenance of a well-known Symbol key", () => {
  const replaced = identityAtArgument("globalThis.Symbol = Fake; use(RegExp.prototype[Symbol.split])")
  const captured = identityAtArgument(
    "const split = Symbol.split; globalThis.Symbol = Fake; use(RegExp.prototype[split])")

  assert.ok(!replaced.identity.matches(replaced.node, "RegExp", [ "prototype", Symbol.split ]))
  assert.ok(captured.identity.matches(captured.node, "RegExp", [ "prototype", Symbol.split ]))
})

test("keeps well-known Symbol properties reached through destructuring distinct", () => {
  const { identity, node } = identityAtArgument(
    "const { replace } = Symbol; Object.defineProperty(RegExp.prototype, replace, { value: fake }); "
    + "use(RegExp.prototype[Symbol.split])")

  assert.ok(identity.matches(node, "RegExp", [ "prototype", Symbol.split ]))
})

test("does not promote symbol keys on globalThis into global names", () => {
  const { identity, node } = identityAtArgument("use(globalThis[Symbol.iterator])")

  assert.ok(identity.matches(node, "globalThis", [ Symbol.iterator ]))
})

test("tracks exact well-known Symbol keys through standard property writes", () => {
  const replaced = identityAtArgument(
    "Object.defineProperty(RegExp.prototype, Symbol.split, { value: fake }); "
    + "use(RegExp.prototype[Symbol.split])")
  const unrelated = identityAtArgument(
    "Object.assign(RegExp.prototype, { [Symbol.replace]: fake }); use(RegExp.prototype[Symbol.split])")

  assert.ok(!replaced.identity.matches(replaced.node, "RegExp", [ "prototype", Symbol.split ]))
  assert.ok(unrelated.identity.matches(unrelated.node, "RegExp", [ "prototype", Symbol.split ]))
})

test("ignores standard mutation calls that cannot write a property", () => {
  [
    "Object.assign(Array.prototype); use(Array.prototype.some)",
    "Object.assign(Array.prototype, { other: replacement }); use(Array.prototype.some)",
    "Object.assign(Array.prototype, /source/); use(Array.prototype.some)",
    "Object.assign(Array.prototype, { __proto__: replacement }); use(Array.prototype.some)",
    "Object.defineProperties(Array.prototype, {}); use(Array.prototype.some)",
    "Object.defineProperties(Array.prototype, /descriptors/); use(Array.prototype.some)",
    "Object.defineProperties(Array.prototype, { other: { value: replacement } }); use(Array.prototype.some)",
    "Object.defineProperty(Array.prototype, 'some', { enumerable: false }); use(Array.prototype.some)",
    "Object.defineProperty(Array.prototype, 'some', { __proto__: null, enumerable: false }); "
    + "use(Array.prototype.some)",
    "Reflect.set(Array.prototype, 'some', replacement, receiver); use(Array.prototype.some)"
  ].forEach((code) => {
    const { identity, node } = identityAtArgument(code)
    assert.ok(identity.matches(node, "Array", [ "prototype", "some" ]), code)
  })
})

test("treats call spreads after an exact mutation target as indeterminate writes", () => {
  [
    "Object.assign(Array.prototype, ...sources); use(Array.prototype.some)",
    "Object.defineProperty(Array.prototype, ...definition); use(Array.prototype.some)",
    "Object.defineProperties(Array.prototype, ...definitions); use(Array.prototype.some)",
    "Object.setPrototypeOf(Array.prototype, ...prototypes); use(Array.prototype.some)",
    "Reflect.set(Array.prototype, ...write); use(Array.prototype.some)"
  ].forEach((code) => {
    const { identity, node } = identityAtArgument(code)
    assert.ok(!identity.matches(node, "Array", [ "prototype", "some" ]), code)
  })
})

test("preserves exact mutation arguments before a call spread", () => {
  const descriptor = identityAtArgument(
    "Object.defineProperty(Array.prototype, 'some', ...descriptors); use(Array.prototype.some)")
  const unrelated = identityAtArgument(
    "Object.defineProperty(Array.prototype, 'other', { value: replacement }, ...extra); "
    + "use(Array.prototype.some)")

  assert.ok(!descriptor.identity.matches(descriptor.node, "Array", [ "prototype", "some" ]))
  assert.ok(unrelated.identity.matches(unrelated.node, "Array", [ "prototype", "some" ]))
})

test("observes mutation argument spreads through supported forwarders", () => {
  [
    "Object.defineProperty.call(null, Array.prototype, ...definition); use(Array.prototype.some)",
    "Reflect.apply(Object.defineProperty, null, [ Array.prototype, ...definition ]); "
    + "use(Array.prototype.some)"
  ].forEach((code) => {
    const { identity, node } = identityAtArgument(code)
    assert.ok(!identity.matches(node, "Array", [ "prototype", "some" ]), code)
  })
})

test("does not treat a RegExp literal as a primitive property descriptor", () => {
  const plain = identityAtArgument(
    "Object.defineProperty(Array.prototype, 'some', /descriptor/); use(Array.prototype.some)")
  const inherited = identityAtArgument(
    "RegExp.prototype.value = replacement; "
    + "Object.defineProperty(Array.prototype, 'some', /descriptor/); use(Array.prototype.some)")

  assert.ok(plain.identity.matches(plain.node, "Array", [ "prototype", "some" ]))
  assert.ok(!inherited.identity.matches(inherited.node, "Array", [ "prototype", "some" ]))
})

test("observes each exact property written by standard mutation APIs", () => {
  [
    "Object.assign(Array.prototype, { other: 1 }, { some: replacement }); use(Array.prototype.some)",
    "Object.assign(Array.prototype, { ...{ some: replacement } }); use(Array.prototype.some)",
    "Object.defineProperties(Array.prototype, { some: { value: replacement } }); use(Array.prototype.some)",
    "Object.setPrototypeOf(Array.prototype, replacement); use(Array.prototype.some)",
    "Reflect.setPrototypeOf(Array.prototype, replacement); use(Array.prototype.some)",
    "const target = Array.prototype; Reflect.set(target, 'some', replacement, target); use(Array.prototype.some)",
    "Object.prototype.value = replacement; Object.defineProperty(Array.prototype, 'some', {}); "
    + "use(Array.prototype.some)",
    "Object.defineProperty(Array.prototype, 'some', { __proto__: descriptor }); use(Array.prototype.some)"
  ].forEach((code) => {
    const { identity, node } = identityAtArgument(code)
    assert.ok(!identity.matches(node, "Array", [ "prototype", "some" ]), code)
  })
})

test("recognizes equivalent global paths as an effective Reflect receiver", () => {
  const { identity, node } = identityAtArgument(
    "Reflect.set(RegExp.prototype, Symbol.split, fake, RegExp.prototype); "
    + "use(RegExp.prototype[Symbol.split])")

  assert.ok(!identity.matches(node, "RegExp", [ "prototype", Symbol.split ]))
})

test("follows intrinsic mutation targets through local parameters", () => {
  const { identity, node } = identityAtArgument(`
    function forward(target) { patch(target) }
    function patch(target) { Object.defineProperty(target, Symbol.split, { value: fake }) }
    forward(RegExp.prototype)
    use(RegExp.prototype[Symbol.split])
  `)

  assert.ok(!identity.matches(node, "RegExp", [ "prototype", Symbol.split ]))
})

test("observes a write evaluated inside the receiver before its member lookup", () => {
  const { identity, node } = identityAt(
    "use(`$" + "{(Array.from = replacement, 'value')}`.length, Array.from)", "MemberExpression", -1)

  assert.ok(!identity.matches(node, "Array", [ "from" ]))
})

test("rejects a later write when the containing function can run again", () => {
  const { identity, node } = identityAt(
    "function run() { use(Array.from); Array.from = replacement }; run()", "MemberExpression")

  assert.ok(!identity.matches(node, "Array", [ "from" ]))
})

test("ignores writes enclosed by local functions that cannot execute", () => {
  [
    "function patch() { Array.from = replacement }; use(Array.from)",
    "const patch = () => { Array.from = replacement }; use(Array.from)"
  ].forEach((code) => {
    const { identity, node } = identityAt(code, "MemberExpression", -1)
    assert.ok(identity.matches(node, "Array", [ "from" ]), code)
  })
})

test("ignores writes reachable only through inactive local callers", () => {
  const { identity, node } = identityAt(`
    function patch() { Array.from = replacement }
    function unused() { patch() }
    use(Array.from)
  `, "MemberExpression", -1)

  assert.ok(identity.matches(node, "Array", [ "from" ]))
})

test("follows stable function aliases before deciding whether a write can execute", () => {
  const unused = identityAt(
    "const patch = () => { Array.from = replacement }; const alias = patch; use(Array.from)",
    "MemberExpression", -1)
  const called = identityAt(
    "const patch = () => { Array.from = replacement }; const alias = patch; alias(); use(Array.from)",
    "MemberExpression", -1)

  assert.ok(unused.identity.matches(unused.node, "Array", [ "from" ]))
  assert.ok(!called.identity.matches(called.node, "Array", [ "from" ]))
})

test("observes transitively called writes once a local caller is active", () => {
  const { identity, node } = identityAt(`
    function patch() { Array.from = replacement }
    function run() { patch() }
    run()
    use(Array.from)
  `, "MemberExpression", -1)

  assert.ok(!identity.matches(node, "Array", [ "from" ]))
})

test("observes an earlier write at a use inside the same inactive local function", () => {
  [
    "function inspect() { Array.from = replacement; use(Array.from) }",
    "const inspect = () => { Object.defineProperty(Array, 'from', descriptor); use(Array.from) }"
  ].forEach((code) => {
    const { identity, node } = identityAt(code, "MemberExpression", -1)
    assert.ok(!identity.matches(node, "Array", [ "from" ]), code)
  })
})

test("uses inactive local writes while classifying later descriptor writes", () => {
  const poisoned = identityAtArgument(`
    function inspect() {
      Object.prototype.value = replacement
      Object.defineProperty(Array, "from", {})
      use(Array.from)
    }
  `)
  const laterPoison = identityAtArgument(`
    function inspect() {
      Object.defineProperty(Array, "from", {})
      Object.prototype.value = replacement
      use(Array.from)
    }
  `)

  assert.ok(!poisoned.identity.matches(poisoned.node, "Array", [ "from" ]))
  assert.ok(laterPoison.identity.matches(laterPoison.node, "Array", [ "from" ]))
})

test("does not project a later inactive local write into an earlier use", () => {
  const { identity, node } = identityAt(
    "function inspect() { use(Array.from); Array.from = replacement }", "MemberExpression")

  assert.ok(identity.matches(node, "Array", [ "from" ]))
})

test("does not project an inactive local write across function executions", () => {
  const { identity, node } = identityAt(`
    function patch() { Array.from = replacement }
    function inspect() { use(Array.from) }
  `, "MemberExpression", -1)

  assert.ok(identity.matches(node, "Array", [ "from" ]))
})

test("observes a later local write when a shared loop can return to the use", () => {
  const { identity, node } = identityAt(
    "function inspect() { while (condition) { use(Array.from); Array.from = replacement } }",
    "MemberExpression")

  assert.ok(!identity.matches(node, "Array", [ "from" ]))
})

test("keeps a read used to compute an inactive local assignment", () => {
  const { identity, node } = identityAt(
    "function inspect() { Array.from = transform(Array.from) }", "MemberExpression", -1)

  assert.ok(identity.matches(node, "Array", [ "from" ]))
})

test("observes function writes when the function can execute or escape", () => {
  [
    "function patch() { Array.from = replacement }; patch(); use(Array.from)",
    "function patch() { Array.from = replacement }; register(patch); use(Array.from)",
    "export function patch() { Array.from = replacement }; use(Array.from)"
  ].forEach((code) => {
    const { identity, node } = identityAt(code, "MemberExpression", -1)
    assert.ok(!identity.matches(node, "Array", [ "from" ]), code)
  })
})

test("indexes active direct writes before classifying indirect descriptor writes", () => {
  const { identity, node } = identityAtArgument(`
    export function define() { Object.defineProperty(Array.prototype, "some", {}) }
    export function poisonDescriptor() { Object.prototype.value = replacement }
    use(Array.prototype.some)
  `)

  assert.ok(!identity.matches(node, "Array", [ "prototype", "some" ]))
})

test("keeps script-global functions externally callable", () => {
  const parsed = new ParsedCode(
    "function patch() { Array.from = replacement }; use(Array.from)", { sourceType: "script" })
  const bindings = new BindingResolver(parsed.sourceCode)

  assert.ok(!new GlobalValueIdentity(bindings).matches(
    parsed.nodesOfType("MemberExpression").at(-1), "Array", [ "from" ]))
})

test("ignores unreachable writes", () => {
  const { identity, node } = identityAt("if (false) Array.from = replacement; use(Array.from)", "MemberExpression", -1)

  assert.ok(identity.matches(node, "Array", [ "from" ]))
})

test("indexes deep non-intrinsic call chains without recursive path resolution", () => {
  const { identity, node } = identityAt(deepArrayAliases(1_200), "MemberExpression", -1)

  assert.ok(identity.matches(node, "Array", [ "from" ]))
})

function identityAt(code, type, index = 0) {
  const parsed = new ParsedCode(code)
  const bindings = new BindingResolver(parsed.sourceCode)
  return { identity: new GlobalValueIdentity(bindings), node: parsed.nodesOfType(type).at(index) }
}

function identityAtArgument(code) {
  const parsed = new ParsedCode(code)
  const bindings = new BindingResolver(parsed.sourceCode)
  return {
    identity: new GlobalValueIdentity(bindings),
    node: parsed.nodesOfType("CallExpression").find(({ callee }) => callee.name === "use").arguments[0]
  }
}

function deepArrayAliases(count) {
  return [ "const a0 = []", ...Array.from({ length: count }, (_, index) =>
    `const a${index + 1} = a${index}.map(transform)`), "use(Array.from)" ].join("\n")
}
