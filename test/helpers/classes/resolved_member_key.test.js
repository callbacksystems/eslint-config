import assert from "node:assert/strict"
import { test } from "node:test"
import { resolvedMemberKeyOf, resolvedRuntimeMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { GlobalValueIdentity } from "#helpers/scope/global_value_identity"
import { ParsedCode } from "#support"

test("resolved member keys follow stable local string bindings", () => {
  const parsed = new ParsedCode(`
    const hook = "connect"
    const alias = hook
    let stable = "render"
    let current = "disconnect"
    class Earlier { [current]() {} }
    current = "connect"
    let mutable = "disconnect"
    mutable = "connect"
    class C {
      [hook]() {}
      [alias]() {}
      [stable]() {}
      [mutable]() {}
      [external]() {}
    }
  `)
  const bindings = BindingResolver.for(parsed.sourceCode)

  assert.deepEqual(parsed.nodesOfType("MethodDefinition")
    .map((member) => resolvedMemberKeyOf(member, bindings)?.name ?? null),
  [ "disconnect", "connect", "connect", "render", "connect", null ])
})

test("resolved member keys support member accesses and object properties", () => {
  const parsed = new ParsedCode(`
    const access = "value"
    const option = "once"
    object[access]
    use({ [option]: true })
  `)
  const bindings = BindingResolver.for(parsed.sourceCode)

  assert.equal(resolvedMemberKeyOf(parsed.firstNodeOfType("MemberExpression"), bindings)?.name, "value")
  assert.equal(resolvedMemberKeyOf(parsed.firstNodeOfType("Property"), bindings)?.name, "once")
})

test("resolved member keys do not infer imported values", () => {
  const parsed = new ParsedCode('import { hook } from "library"; class C { [hook]() {} }')

  assert.equal(resolvedMemberKeyOf(parsed.firstNodeOfType("MethodDefinition"),
    BindingResolver.for(parsed.sourceCode)), null)
})

test("resolved member keys reject unknown and runtime-computed Symbol members", () => {
  [ "target[Symbol.unknown]", "target[Symbol[lookup()]]" ].forEach((code) => {
    const parsed = new ParsedCode(code)
    assert.equal(resolvedMemberKeyOf(parsed.firstNodeOfType("MemberExpression"),
      BindingResolver.for(parsed.sourceCode)), null)
  })
})

test("resolved member keys reject with-tainted constants through alias chains", () => {
  const withScope = new ParsedCode(`
    const hook = "connect"
    with ({ hook: "render" }) { const key = hook; class C { [key]() {} } }
  `, { sourceType: "script" })
  assert.equal(resolvedMemberKeyOf(withScope.firstNodeOfType("MethodDefinition"),
    BindingResolver.for(withScope.sourceCode)), null)
})

test("resolved member keys reject constants intercepted by sloppy eval", () => {
  const parsed = new ParsedCode(`
    const hook = "connect"
    function define() {
      eval(source)
      return () => class C { [hook]() {} }
    }
  `, { sourceType: "script" })

  assert.equal(resolvedMemberKeyOf(parsed.firstNodeOfType("MethodDefinition"),
    BindingResolver.for(parsed.sourceCode)), null)
})

test("resolved member keys retain immutable lexical constants around eval and with", () => {
  const evalScope = new ParsedCode(`
    function define() {
      eval(source)
      const hook = "connect"
      return class C { [hook]() {} }
    }
  `, { sourceType: "script" })
  const withScope = new ParsedCode(`
    with ({ hook: "render" }) {
      const hook = "connect"
      class C { [hook]() {} }
    }
  `, { sourceType: "script" })

  Array.of(withScope, evalScope).forEach((parsed) => {
    assert.equal(resolvedMemberKeyOf(parsed.firstNodeOfType("MethodDefinition"),
      BindingResolver.for(parsed.sourceCode))?.name, "connect")
  })
})

test("resolved member keys give well-known symbols non-colliding path identities", () => {
  const parsed = new ParsedCode(`
    target["split"]
    target[Symbol.split]
  `)
  const [ stringKey, symbolKey ] = targetMemberKeysIn(parsed, BindingResolver.for(parsed.sourceCode))

  assert.equal(stringKey.name, "split")
  assert.equal(stringKey.pathMember, undefined)
  assert.equal(symbolKey.name, null)
  assert.equal(symbolKey.pathMember, Symbol.split)
  assert.notEqual(symbolKey.pathMember, stringKey.name)
})

test("resolved member keys derive every well-known symbol from the runtime", () => {
  const symbols = Object.entries(Object.getOwnPropertyDescriptors(Symbol))
    .filter(([ , descriptor ]) => typeof descriptor.value === "symbol" && !descriptor.writable
      && !descriptor.enumerable && !descriptor.configurable)
  const parsed = new ParsedCode(symbols.map(([ name ]) => `target[Symbol.${name}]`).join("\n"))

  assert.deepEqual(
    targetMemberKeysIn(parsed, BindingResolver.for(parsed.sourceCode)).map(({ pathMember }) => pathMember),
    symbols.map(([ , descriptor ]) => descriptor.value))
})

test("resolved well-known symbol keys follow stable value and property aliases", () => {
  const parsed = new ParsedCode(`
    const SymbolAlias = Symbol
    const property = "replace"
    const replacement = SymbolAlias[property]
    target[replacement]
  `)

  assert.equal(targetMemberKeysIn(parsed, BindingResolver.for(parsed.sourceCode))[0].pathMember, Symbol.replace)
})

test("resolved well-known symbol keys follow deep aliases without recursion", () => {
  const parsed = new ParsedCode(`
    const symbol0 = Symbol
    ${Array.from({ length: 1_200 }, (_, index) =>
      `const symbol${index + 1} = symbol${index}`).join("\n")}
    target[symbol1200.iterator]
  `)

  assert.equal(targetMemberKeysIn(parsed, BindingResolver.for(parsed.sourceCode))[0].pathMember, Symbol.iterator)
})

test("resolved well-known symbol keys accept exact optional member access", () => {
  const parsed = new ParsedCode("target[Symbol?.split]")

  assert.equal(targetMemberKeysIn(parsed, BindingResolver.for(parsed.sourceCode))[0].pathMember, Symbol.split)
})

test("resolved member keys reject shadowed symbols and dynamic computed properties", () => {
  const shadowed = new ParsedCode("function use(Symbol) { target[Symbol.split] }")
  const dynamic = new ParsedCode("target[Symbol[property]]")

  Array.of(shadowed, dynamic).forEach((parsed) => {
    assert.equal(targetMemberKeysIn(parsed, BindingResolver.for(parsed.sourceCode))[0], null)
  })
})

test("runtime member keys validate the temporal provenance of well-known symbols", () => {
  const replaced = new ParsedCode("globalThis.Symbol = Fake; target[Symbol.iterator]; target[Symbol.toStringTag]")
  const later = new ParsedCode("target[Symbol.iterator]; globalThis.Symbol = Fake")
  const captured = new ParsedCode("const iterator = Symbol.iterator; globalThis.Symbol = Fake; target[iterator]")

  assert.deepEqual(runtimeTargetKeysIn(replaced), [ null, null ])
  assert.deepEqual(runtimeTargetKeysIn(later), [ Symbol.iterator ])
  assert.deepEqual(runtimeTargetKeysIn(captured), [ Symbol.iterator ])
})

function targetMemberKeysIn(parsed, bindings) {
  return parsed.nodesOfType("MemberExpression")
    .filter(({ object }) => object.type === "Identifier" && object.name === "target")
    .map((member) => resolvedMemberKeyOf(member, bindings))
}

function runtimeTargetKeysIn(parsed) {
  const bindings = BindingResolver.for(parsed.sourceCode)
  const globals = new GlobalValueIdentity(bindings)
  return parsed.nodesOfType("MemberExpression")
    .filter(({ object }) => object.type === "Identifier" && object.name === "target")
    .map((member) => resolvedRuntimeMemberKeyOf(member, { bindings, globals })?.pathMember ?? null)
}
