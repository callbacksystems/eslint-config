import assert from "node:assert/strict"
import { test } from "node:test"
import { nodesIn } from "#helpers/syntax/ast"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { isMutableBinding } from "#helpers/scope/binding_mutability"
import { isReassignment } from "#helpers/scope/references"
import { ParsedCode } from "#support"

test("variableFor chooses the module binding of a class declaration", () => {
  const parsed = new ParsedCode("class Entry {}; new Entry()")
  const [ declaration, construction ] = identifiersNamed(parsed, "Entry")
  const resolver = new BindingResolver(parsed.sourceCode)
  assert.equal(resolver.variableFor(declaration), resolver.variableFor(construction))
})

test("functionFor rejects a function binding whose value is reassigned", () => {
  const parsed = new ParsedCode("let run = () => 1; run = replacement; run()")
  const resolver = new BindingResolver(parsed.sourceCode)
  assert.equal(resolver.functionFor(identifiersNamed(parsed, "run").at(-1)), null)
})

test("isReassignment distinguishes initialization and reads from later writes", () => {
  assert.ok(!isReassignment({ init: true, isWrite: () => true }))
  assert.ok(!isReassignment({ init: false, isWrite: () => false }))
  assert.ok(isReassignment({ init: false, isWrite: () => true }))
})

test("using declarations create immutable bindings", () => {
  assert.ok(!isResourceMutableIn("using resource = open(); use(resource)"))
  assert.ok(!isResourceMutableIn("async function run() { await using resource = open(); use(resource) }"))
})

test("classFor resolves a class expression held by a stable binding", () => {
  const parsed = new ParsedCode("const Entry = class {}; new Entry()")
  assert.equal(new BindingResolver(parsed.sourceCode).classFor(identifiersNamed(parsed, "Entry").at(-1)),
    parsed.firstNodeOfType("ClassExpression"))
})

test("classFor and functionFor follow stable identifier aliases without looping on cycles", () => {
  const parsed = new ParsedCode("class Entry {}; const PublicEntry = Entry; function run() {}; const execute = run; "
    + "const first = second; const second = first; use(PublicEntry, execute, first)")
  const resolver = new BindingResolver(parsed.sourceCode)
  assert.equal(resolver.classFor(identifiersNamed(parsed, "PublicEntry").at(-1)),
    parsed.firstNodeOfType("ClassDeclaration"))
  assert.equal(resolver.functionFor(identifiersNamed(parsed, "execute").at(-1)),
    parsed.firstNodeOfType("FunctionDeclaration"))
  assert.equal(resolver.functionFor(identifiersNamed(parsed, "first").at(-1)), null)
})

test("constantInitializerFor follows stable const aliases without looping on cycles", () => {
  const parsed = new ParsedCode('const actual = "user"; const key = actual; const a = b; const b = a; key; a')
  const resolver = new BindingResolver(parsed.sourceCode)
  const references = parsed.nodesOfType("ExpressionStatement").map((statement) => statement.expression)

  assert.equal(resolver.constantInitializerFor(references[0]).value, "user")
  assert.equal(resolver.constantInitializerFor(references[1]), null)
})

test("globalNameFor follows stable aliases without trusting shadows", () => {
  const stable = parsedBindingIn("const NativeSet = Set; const Collection = NativeSet; use(Collection)", "Collection")
  const shadowed = parsedBindingIn("function f(Set) { const NativeSet = Set; use(NativeSet) }", "NativeSet")
  const destructured = parsedBindingIn("const { NativeSet } = Set; use(NativeSet)", "NativeSet")
  assert.equal(stable.resolver.globalNameFor(stable.identifier), "Set")
  assert.equal(shadowed.resolver.globalNameFor(shadowed.identifier), null)
  assert.equal(destructured.resolver.globalNameFor(destructured.identifier), null)
})

test("globalNameFor follows a pointwise alias to a configured global", () => {
  const parsed = new ParsedCode("let NativeSet = Set; use(NativeSet); NativeSet = CustomSet")

  assert.equal(new BindingResolver(parsed.sourceCode).globalNameFor(
    identifiersNamed(parsed, "NativeSet").find((candidate) => candidate.parent.type === "CallExpression")
  ), "Set")
})

test("globalNameFor does not mistake implicit arguments for a global", () => {
  const parsed = parsedBindingIn("function run() { use(arguments) }", "arguments")

  assert.equal(parsed.resolver.globalNameFor(parsed.identifier), null)
})

test("constantInitializerFor does not treat a destructuring source as the bound value", () => {
  const parsed = parsedBindingIn("const { length: hook } = 'connect'; use(hook)", "hook")

  assert.equal(parsed.resolver.constantInitializerFor(parsed.identifier), null)
  assert.equal(parsed.resolver.isImmutableValue(parsed.identifier), false)
})

test("definitionFor exposes an available destructuring definition without treating its source as the value", () => {
  const parsed = parsedBindingIn("const { prototype } = Array; use(prototype)", "prototype")

  assert.equal(parsed.resolver.definitionFor(parsed.identifier).node.id.type, "ObjectPattern")
  assert.equal(parsed.resolver.stableValueFor(parsed.identifier), null)
})

test("globalNameFor follows current assignment values while rejecting global writes and cycles", () => {
  const parsed = new ParsedCode("Set = CustomSet; let Reassigned = Map; Reassigned = CustomMap; "
    + "const first = second; const second = first; use(Set, Reassigned, first)")
  const resolver = new BindingResolver(parsed.sourceCode)

  assert.equal(resolver.globalNameFor(identifiersNamed(parsed, "Set").at(-1)), null)
  assert.equal(resolver.globalNameFor(identifiersNamed(parsed, "Reassigned").at(-1)), "CustomMap")
  assert.equal(resolver.globalNameFor(identifiersNamed(parsed, "first").at(-1)), null)
})

test("stableValueFor resolves values on both sides of a reassignment in the same execution", () => {
  const parsed = new ParsedCode("let value = original; use(value); value = replacement; use(value)")
  const resolver = new BindingResolver(parsed.sourceCode)
  const uses = identifiersNamed(parsed, "value").filter((identifier) => identifier.parent.type === "CallExpression")

  assert.equal(resolver.stableValueFor(uses[0]).name, "original")
  assert.equal(resolver.stableValueFor(uses[1]).name, "replacement")
})

test("stableValueFor resolves the latest dominating simple assignment pointwise", () => {
  const parsed = new ParsedCode(
    "let value; value = original; use(value); value = replacement; use(value); value = final; use(value)")
  const resolver = new BindingResolver(parsed.sourceCode)

  assert.deepEqual(valuesPassedToUseIn(parsed).map((identifier) =>
    resolver.stableValueFor(identifier)?.name), [ "original", "replacement", "final" ])
})

test("stableValueFor keeps reads before and conditional paths outside an assignment unknown", () => {
  [
    "let value; use(value); value = original",
    "let value; if (condition) value = original; use(value)",
    "let value; condition && (value = original); use(value)",
    "let value; try { value = original } catch {}; use(value)"
  ].forEach((code) => {
    const parsed = new ParsedCode(code)
    assert.equal(new BindingResolver(parsed.sourceCode).stableValueFor(identifierPassedToUseIn(parsed)), null)
  })
})

test("stableValueFor accepts an assignment that dominates a lookup inside its branch", () => {
  const parsed = new ParsedCode("let value; if (condition) { value = original; use(value) }")

  assert.equal(new BindingResolver(parsed.sourceCode)
    .stableValueFor(identifierPassedToUseIn(parsed)).name, "original")
})

test("stableValueFor rejects competing writes between an assignment and lookup", () => {
  [
    "let value; value = original; if (condition) value = replacement; use(value)",
    "let value; value = original; value ||= replacement; use(value)",
    "let value; value = original; value++; use(value)",
    "let value; value = original; [value] = replacements; use(value)",
    "let value; value = original; ({ value } = replacements); use(value)"
  ].forEach((code) => {
    const parsed = new ParsedCode(code)
    assert.equal(new BindingResolver(parsed.sourceCode).stableValueFor(identifierPassedToUseIn(parsed)), null)
  })
})

test("stableValueFor ignores writes definitely before the assignment or after the lookup", () => {
  const parsed = new ParsedCode(
    "let value; if (condition) value = stale; value = original; use(value); if (condition) value = later")

  assert.equal(new BindingResolver(parsed.sourceCode)
    .stableValueFor(identifierPassedToUseIn(parsed)).name, "original")
})

test("stableValueFor ignores statically unreachable competing writes", () => {
  const parsed = new ParsedCode("let value; value = original; if (false) value = replacement; use(value)")

  assert.equal(new BindingResolver(parsed.sourceCode)
    .stableValueFor(identifierPassedToUseIn(parsed)).name, "original")
})

test("stableValueFor follows assignments in guaranteed evaluation sequences", () => {
  [
    "let value; (value = original, sideEffect()); use(value)",
    "let value; for (value = original; condition; update()) use(value)"
  ].forEach((code) => {
    const parsed = new ParsedCode(code)
    assert.equal(new BindingResolver(parsed.sourceCode)
      .stableValueFor(identifierPassedToUseIn(parsed)).name, "original")
  })
})

test("stableValueFor stays conservative across a call containing the assignment", () => {
  const parsed = new ParsedCode("let value; consume(value = original); use(value)")

  assert.equal(new BindingResolver(parsed.sourceCode).stableValueFor(identifierPassedToUseIn(parsed)), null)
})

test("stableValueFor resolves assignments repeated before each loop lookup", () => {
  const parsed = new ParsedCode("let value; while (condition) { value = original; use(value); value = replacement }")

  assert.equal(new BindingResolver(parsed.sourceCode)
    .stableValueFor(identifierPassedToUseIn(parsed)).name, "original")
})

test("stableValueFor rejects a write carried into a later loop lookup", () => {
  [
    "let value; value = original; while (condition) { use(value); value = replacement }",
    "let value; while (outer) { value = original; while (inner) { use(value); value = replacement } }"
  ].forEach((code) => {
    const parsed = new ParsedCode(code)
    assert.equal(new BindingResolver(parsed.sourceCode).stableValueFor(identifierPassedToUseIn(parsed)), null)
  })
})

test("stableValueFor stays conservative across captured writes and values", () => {
  const capturedWrite = new ParsedCode(
    "let value; function replace() { value = replacement }; value = original; use(value)")
  const capturedValue = new ParsedCode("let value; value = original; function later() { use(value) }")

  assert.equal(new BindingResolver(capturedWrite.sourceCode)
    .stableValueFor(identifierPassedToUseIn(capturedWrite)), null)
  assert.equal(new BindingResolver(capturedValue.sourceCode)
    .stableValueFor(identifierPassedToUseIn(capturedValue)), null)
})

test("stableValueFor rejects pointwise assignments exposed to direct eval", () => {
  const parsed = new ParsedCode(
    "function run() { let value; value = original; eval(source); use(value) }", { sourceType: "script" })

  assert.equal(new BindingResolver(parsed.sourceCode).stableValueFor(identifierPassedToUseIn(parsed)), null)
})

test("stableValueFor follows assignment aliases at their own evaluation points", () => {
  const parsed = new ParsedCode("let first, second; first = Array; second = first; first = second; use(first)")

  assert.equal(new BindingResolver(parsed.sourceCode)
    .stableValueFor(identifierPassedToUseIn(parsed)).name, "Array")
})

test("stableValueFor reads the previous value while a later assignment evaluates", () => {
  const parsed = new ParsedCode("let value; value = Array; value = (use(value), String)")

  assert.equal(new BindingResolver(parsed.sourceCode)
    .stableValueFor(identifierPassedToUseIn(parsed)).name, "Array")
})

test("stableValueFor indexes nested pending assignments across many lookups", () => {
  const parsed = new ParsedCode(nestedPendingAssignments(1_000))
  const resolver = new BindingResolver(parsed.sourceCode)
  const values = valuesPassedToUseIn(parsed).map((identifier) => resolver.stableValueFor(identifier)?.name)

  assert.equal(values.length, 1_000)
  assert.ok(values.every((name) => name === "Array"))
})

test("stableValueFor follows temporally descending self-assignment chains", () => {
  const parsed = new ParsedCode("let value; value = Array; value = value; value = value; use(value)")

  assert.equal(new BindingResolver(parsed.sourceCode)
    .stableValueFor(identifierPassedToUseIn(parsed)).name, "Array")
})

test("stableValueFor rejects cyclic and not-yet-assigned alias values", () => {
  [
    "let first, second; first = second; second = first; use(first)",
    "let first, second; first = second; second = Array; use(first)"
  ].forEach((code) => {
    const parsed = new ParsedCode(code)
    assert.equal(new BindingResolver(parsed.sourceCode).stableValueFor(identifierPassedToUseIn(parsed)), null)
  })
})

test("stableValueFor observes lexical initialization before assignments", () => {
  const lexical = new ParsedCode("let value; value = original; use(value)")
  const temporalDeadZone = new ParsedCode("value = original; let value; use(value)")
  const constant = new ParsedCode("const value = initial; value = original; use(value)")

  assert.equal(new BindingResolver(lexical.sourceCode)
    .stableValueFor(identifierPassedToUseIn(lexical)).name, "original")
  assert.equal(new BindingResolver(temporalDeadZone.sourceCode)
    .stableValueFor(identifierPassedToUseIn(temporalDeadZone)), null)
  assert.equal(new BindingResolver(constant.sourceCode)
    .stableValueFor(identifierPassedToUseIn(constant)), null)
})

test("stableValueFor resolves assignments to entry-initialized bindings", () => {
  const parameter = new ParsedCode("function run(value) { value = original; use(value) }")
  const variable = new ParsedCode("function run() { value = original; use(value); var value }")
  const caught = new ParsedCode("try { operation() } catch (value) { value = original; use(value) }")

  Array.of(parameter, variable, caught).forEach((parsed) =>
    assert.equal(new BindingResolver(parsed.sourceCode)
      .stableValueFor(identifierPassedToUseIn(parsed)).name, "original"))
})

test("stableValueFor resolves an assignment after class initialization", () => {
  const parsed = new ParsedCode("class Value {}; Value = class Replacement {}; use(Value)")

  assert.equal(new BindingResolver(parsed.sourceCode)
    .classFor(identifierPassedToUseIn(parsed)), parsed.nodesOfType("ClassExpression")[0])
})

test("stableValueFor rejects immutable names and ambiguous declarations", () => {
  [
    "const holder = function value() { value = Array; use(value) }",
    "var value; var value; value = Array; use(value)"
  ].forEach((code) => {
    const parsed = new ParsedCode(code)
    assert.equal(new BindingResolver(parsed.sourceCode).stableValueFor(identifierPassedToUseIn(parsed)), null)
  })
})

test("stableValueFor accounts for each repeating statement form", () => {
  [
    "let value; value = original; do { use(value); value = replacement } while (condition)",
    "let value; value = original; for (; condition;) { use(value); value = replacement }",
    "let value; value = original; for (const item of items) { use(value); value = replacement }",
    "let value; value = original; for (const key in object) { use(value); value = replacement }"
  ].forEach((code) => {
    const parsed = new ParsedCode(code)
    assert.equal(new BindingResolver(parsed.sourceCode).stableValueFor(identifierPassedToUseIn(parsed)), null)
  })
})

test("stableValueFor does not treat a for initializer as repeating", () => {
  const parsed = new ParsedCode("let value; value = original; for (value = replacement; condition;) use(value)")

  assert.equal(new BindingResolver(parsed.sourceCode)
    .stableValueFor(identifierPassedToUseIn(parsed)).name, "replacement")
})

test("globalNameFor preserves the global value captured by an assignment", () => {
  const parsed = new ParsedCode("let NativeSet; NativeSet = Set; Set = CustomSet; use(NativeSet)",
    { sourceType: "script" })

  assert.equal(new BindingResolver(parsed.sourceCode)
    .globalNameFor(identifierPassedToUseIn(parsed)), "Set")
})

test("stableValueFor follows long assignment alias chains without a fixed cap", () => {
  const parsed = new ParsedCode(longAssignmentChain(1_000))

  assert.equal(new BindingResolver(parsed.sourceCode)
    .stableValueFor(identifierPassedToUseIn(parsed)).name, "Array")
})

test("stableValueFor follows earlier declarators before a later reassignment", () => {
  const parsed = new ParsedCode(
    "let NativeFetch = fetch, CurrentFetch = NativeFetch; use(CurrentFetch); NativeFetch = replacement")
  const resolver = new BindingResolver(parsed.sourceCode)

  assert.equal(resolver.globalNameFor(identifiersNamed(parsed, "CurrentFetch").at(-1)), "fetch")
})

test("stableValueFor rejects initializers that do not dominate the lookup", () => {
  [
    "use(NativeFetch); return; var NativeFetch = fetch",
    "use(NativeFetch); if (false) var NativeFetch = fetch",
    "use(NativeFetch); if (condition) var NativeFetch = fetch",
    "use(NativeFetch); let NativeFetch = fetch",
    "use(NativeFetch); const NativeFetch = fetch"
  ].forEach((body) => {
    const parsed = new ParsedCode(`function run() { ${body} }`)
    const resolver = new BindingResolver(parsed.sourceCode)

    assert.equal(resolver.stableValueFor(identifierPassedToUseIn(parsed)), null)
    assert.equal(resolver.globalNameFor(identifierPassedToUseIn(parsed)), null)
  })
})

test("stableValueFor rejects initializers that only run on one control-flow path", () => {
  [
    "switch (kind) { case 'native': var NativeFetch = fetch }; use(NativeFetch)",
    "try { operation(); var NativeFetch = fetch } catch {}; use(NativeFetch)",
    "label: { if (skip) break label; var NativeFetch = fetch }; use(NativeFetch)",
    "do { if (skip) continue; var NativeFetch = fetch } while (again); use(NativeFetch)"
  ].forEach((body) => {
    const parsed = new ParsedCode(`function run() { ${body} }`)
    const identifier = identifierPassedToUseIn(parsed)
    const resolver = new BindingResolver(parsed.sourceCode)

    assert.equal(resolver.stableValueFor(identifier), null)
    assert.equal(resolver.globalNameFor(identifier), null)
  })
})

test("stableValueFor does not treat a captured conditional var initializer as stable", () => {
  const parsed = new ParsedCode(
    "function run(flag) { if (flag) var NativeFetch = fetch; return () => use(NativeFetch) }")
  const resolver = new BindingResolver(parsed.sourceCode)

  assert.equal(resolver.stableValueFor(identifierPassedToUseIn(parsed)), null)
})

test("classFor observes a class declaration's temporal dead zone", () => {
  const parsed = new ParsedCode("use(Entry); class Entry {}")
  const resolver = new BindingResolver(parsed.sourceCode)

  assert.equal(resolver.classFor(identifierPassedToUseIn(parsed)), null)
})

test("classFor resolves a class's inner name only after class-name initialization", () => {
  [
    "class C { static value = C }",
    "class C { value = () => C }",
    "class C { method() { return C } }",
    "class C { static { use(C) } }",
    "const Value = class C { static value = C }"
  ].forEach((code) => {
    const parsed = new ParsedCode(code)
    const resolver = new BindingResolver(parsed.sourceCode)

    assert.equal(resolver.classFor(identifiersNamed(parsed, "C").at(-1)), parsed.firstNodeOfType("ClassDeclaration")
    ?? parsed.firstNodeOfType("ClassExpression"))
  })
})

test("classFor keeps a class's inner name in TDZ for heritage and computed keys", () => {
  [
    "class C extends C {}",
    "class C { [C]() {} }",
    "const Value = class C extends C {}",
    "const Value = class C { [C]() {} }"
  ].forEach((code) => {
    const parsed = new ParsedCode(code)
    const resolver = new BindingResolver(parsed.sourceCode)

    assert.equal(resolver.classFor(identifiersNamed(parsed, "C").at(-1)), null)
  })
})

test("stableValueFor validates every initializer in an alias chain", () => {
  const parsed = new ParsedCode("const CurrentFetch = NativeFetch; use(CurrentFetch); const NativeFetch = fetch")
  const resolver = new BindingResolver(parsed.sourceCode)

  assert.equal(resolver.stableValueFor(identifiersNamed(parsed, "CurrentFetch").at(-1)), null)
  assert.equal(resolver.globalNameFor(identifiersNamed(parsed, "CurrentFetch").at(-1)), null)
})

test("functionFor keeps hoisted declarations and stable deferred values", () => {
  const hoisted = new ParsedCode("use(run); function run() {}; ")
  const deferred = new ParsedCode("const key = 'value'; function later() { use(key) }")

  assert.equal(new BindingResolver(hoisted.sourceCode).functionFor(identifierPassedToUseIn(hoisted)).type,
    "FunctionDeclaration")
  assert.equal(new BindingResolver(deferred.sourceCode).stableValueFor(identifierPassedToUseIn(deferred)).value,
    "value")
})

test("stableValueFor does not move outer initializers into deferred executions", () => {
  const parsed = new ParsedCode("let value = original; function later() { use(value) }; value = replacement")
  const resolver = new BindingResolver(parsed.sourceCode)

  assert.equal(resolver.stableValueFor(identifiersNamed(parsed, "value").at(-2)), null)
})

test("globalNameFor keeps an earlier top-level reference before a later global write", () => {
  const parsed = new ParsedCode("use(fetch); fetch = replacement; use(fetch)", { sourceType: "script" })
  const resolver = new BindingResolver(parsed.sourceCode)
  const fetches = identifiersNamed(parsed, "fetch")

  assert.equal(resolver.globalNameFor(fetches[0]), "fetch")
  assert.equal(resolver.globalNameFor(fetches.at(-1)), null)
})

test("globalNameFor does not trust function-local ordering for persistent globals", () => {
  const parsed = new ParsedCode("function run() { use(fetch); fetch = replacement }", { sourceType: "script" })
  const resolver = new BindingResolver(parsed.sourceCode)

  assert.equal(resolver.globalNameFor(identifiersNamed(parsed, "fetch")[0]), null)
})

test("global identity rejects with and direct-eval interception", () => {
  const withScope = new ParsedCode("with ({ Set: CustomSet }) { use(Set) }", { sourceType: "script" })
  const evalScope = new ParsedCode("function run() { eval(source); use(Set) }", { sourceType: "script" })

  Array.of(withScope, evalScope).forEach((parsed) => {
    const identifier = identifiersNamed(parsed, "Set").at(-1)
    const resolver = new BindingResolver(parsed.sourceCode)
    assert.ok(resolver.isDynamicallyResolved(identifier))
    assert.ok(!resolver.isUnmodifiedGlobal(identifier))
    assert.equal(resolver.globalNameFor(identifier), null)
  })
})

test("constant resolution rejects only outer bindings intercepted by sloppy eval", () => {
  const local = parsedBindingIn("function run() { eval(source); const hook = 'connect'; use(hook) }", "hook",
    { sourceType: "script" })
  const outer = parsedBindingIn("const hook = 'connect'; function run() { eval(source); use(hook) }", "hook",
    { sourceType: "script" })
  const strict = parsedBindingIn(
    "const hook = 'connect'; function run() { 'use strict'; eval(source); use(hook) }", "hook")

  assert.equal(local.resolver.constantInitializerFor(local.identifier).value, "connect")
  assert.equal(outer.resolver.constantInitializerFor(outer.identifier), null)
  assert.equal(strict.resolver.constantInitializerFor(strict.identifier).value, "connect")
})

test("direct eval invalidates accessible mutable bindings throughout their scope", () => {
  const sloppy = parsedBindingIn(
    "let hook = () => 1; function mutate() { eval(source) }; use(hook)", "hook", { sourceType: "script" })
  const strict = parsedBindingIn(
    "let hook = () => 1; function mutate() { 'use strict'; eval(source) }; use(hook)", "hook")
  const constant = parsedBindingIn(
    "const hook = () => 1; function mutate() { eval(source) }; use(hook)", "hook", { sourceType: "script" })

  assert.equal(sloppy.resolver.functionFor(sloppy.identifier), null)
  assert.equal(strict.resolver.functionFor(strict.identifier), null)
  assert.ok(sloppy.resolver.isDynamicallyResolved(sloppy.identifier))
  assert.ok(strict.resolver.isDynamicallyResolved(strict.identifier))
  assert.ok(!constant.resolver.isDynamicallyResolved(constant.identifier))
  assert.ok(constant.resolver.functionFor(constant.identifier))
})

test("a strict eval cannot hide a sloppy eval in the same arguments environment", () => {
  const parsed = parsedBindingIn(directEvalsWithMixedStrictness(), "hook", { sourceType: "script" })

  assert.ok(parsed.resolver.isDynamicallyResolved(parsed.identifier))
  assert.equal(parsed.resolver.functionFor(parsed.identifier), null)
})

test("a top-level eval cannot intercept a binding local to a nested function", () => {
  const parsed = parsedBindingIn(
    "eval(source); function clean() { let hook = () => 1; use(hook) }", "hook", { sourceType: "script" })

  assert.ok(!parsed.resolver.isDynamicallyResolved(parsed.identifier))
  assert.ok(parsed.resolver.functionFor(parsed.identifier))
})

test("pointwise resolution requires the initializer to dominate the use", () => {
  const parsed = new ParsedCode(
    "function run(flag) { if (flag) var NativeFetch = fetch; use(NativeFetch); NativeFetch = replacement }")
  const resolver = new BindingResolver(parsed.sourceCode)
  const identifier = identifiersNamed(parsed, "NativeFetch")
    .find((candidate) => candidate.parent.type === "CallExpression")

  assert.equal(resolver.stableValueFor(identifier), null)
  assert.equal(resolver.globalNameFor(identifier), null)
})

test("sloppy eval preserves destructured constants declared in its function", () => {
  const parsed = parsedBindingIn(
    "function run() { const { hook } = source; eval(code); use(hook) }", "hook", { sourceType: "script" })

  assert.ok(!parsed.resolver.isDynamicallyResolved(parsed.identifier))
})

test("direct eval invalidates unresolved globals throughout the source", () => {
  const parsed = new ParsedCode("function mutate() { eval(source) }; use(Set)", { sourceType: "script" })
  const resolver = new BindingResolver(parsed.sourceCode)
  const identifier = identifiersNamed(parsed, "Set").at(-1)

  assert.ok(resolver.isDynamicallyResolved(identifier))
  assert.equal(resolver.globalNameFor(identifier), null)
})

test("direct eval does not invalidate names shadowed from its scope", () => {
  const parsed = new ParsedCode("function mutate(Set) { eval(source) }; use(Set)", { sourceType: "script" })
  const resolver = new BindingResolver(parsed.sourceCode)
  const identifier = identifiersNamed(parsed, "Set").at(-1)

  assert.ok(!resolver.isDynamicallyResolved(identifier))
  assert.equal(resolver.globalNameFor(identifier), "Set")
})

test("direct eval keeps an outer mutable binding hidden by a nearer binding", () => {
  const parsed = parsedBindingIn(
    "let hook = () => 1; function mutate(hook) { eval(source) }; use(hook)", "hook", { sourceType: "script" })

  assert.ok(!parsed.resolver.isDynamicallyResolved(parsed.identifier))
  assert.ok(parsed.resolver.functionFor(parsed.identifier))
})

test("an unresolved global stays safe only when every eval scope shadows it", () => {
  const safe = parsedBindingIn(
    "function first(Set) { eval(a) }; function second(Set) { eval(b) }; use(Set)", "Set", { sourceType: "script" })
  const unsafe = parsedBindingIn(
    "function first(Set) { eval(a) }; function second(Map) { eval(b) }; use(Set)", "Set", { sourceType: "script" })

  assert.equal(safe.resolver.globalNameFor(safe.identifier), "Set")
  assert.equal(unsafe.resolver.globalNameFor(unsafe.identifier), null)
})

test("strict direct eval preserves immutable named-expression bindings", () => {
  const strict = parsedBindingIn(
    "const f = function self() { 'use strict'; eval(source); return self() }; use(f)", "self")
  const sloppy = parsedBindingIn(
    "const f = function self() { eval(source); return self() }; use(f)", "self", { sourceType: "script" })

  assert.equal(strict.resolver.functionFor(strict.identifier).type, "FunctionExpression")
  assert.equal(sloppy.resolver.functionFor(sloppy.identifier), null)
})

test("isUnmodifiedGlobal rejects lexical shadows and writes to unresolved globals", () => {
  const unmodified = parsedBindingIn("function value() { return Boolean(input) }", "Boolean")
  const shadowed = parsedBindingIn("function value(Boolean) { return Boolean(input) }", "Boolean")
  const reassigned = parsedBindingIn("Boolean = String; function value() { return Boolean(input) }", "Boolean")

  assert.ok(unmodified.resolver.isUnmodifiedGlobal(unmodified.identifier))
  assert.ok(!shadowed.resolver.isUnmodifiedGlobal(shadowed.identifier))
  assert.ok(!reassigned.resolver.isUnmodifiedGlobal(reassigned.identifier))
})

test("isUnmodifiedGlobal indexes writes to otherwise unresolved names", () => {
  const parsed = new ParsedCode("written = replacement; use(written, untouched)")
  const resolver = new BindingResolver(parsed.sourceCode)

  assert.ok(!resolver.isUnmodifiedGlobal(identifiersNamed(parsed, "written").at(-1)))
  assert.ok(resolver.isUnmodifiedGlobal(identifiersNamed(parsed, "untouched").at(-1)))
})

test("sharesBinding follows resolved lexical identities", () => {
  const parsed = new ParsedCode("const literal = 1; const alias = literal; use(alias, alias, literal)")
  const resolver = new BindingResolver(parsed.sourceCode)
  const aliasIdentifiers = identifiersNamed(parsed, "alias")

  assert.ok(resolver.sharesBinding(aliasIdentifiers[0], aliasIdentifiers[1]))
  assert.ok(!resolver.sharesBinding(aliasIdentifiers[0], identifiersNamed(parsed, "literal").at(-1)))
})

test("sharesBinding rejects unresolved names", () => {
  const parsed = new ParsedCode("use(external, external)")
  const resolver = new BindingResolver(parsed.sourceCode)
  const identifiers = identifiersNamed(parsed, "external")

  assert.ok(!resolver.sharesBinding(identifiers[0], identifiers[1]))
})

test("binding facts distinguish immutable aliases from mutable values and cycles", () => {
  const parsed = new ParsedCode("const literal = 1; const alias = literal; let mutable = 1; mutable = 2; "
    + "const externalAlias = external; const first = second; const second = first; "
    + "use(alias, mutable, externalAlias, first, external)")
  const resolver = new BindingResolver(parsed.sourceCode)

  assert.ok(resolver.isUnmodified(identifiersNamed(parsed, "alias").at(-1)))
  assert.ok(!resolver.isUnmodified(identifiersNamed(parsed, "mutable").at(-1)))
  assert.ok(!resolver.isUnmodified(identifiersNamed(parsed, "external").at(-1)))
  assert.ok(resolver.isImmutableValue(identifiersNamed(parsed, "alias").at(-1)))
  assert.ok(resolver.isImmutableValue(identifiersNamed(parsed, "externalAlias").at(-1)))
  assert.ok(!resolver.isImmutableValue(identifiersNamed(parsed, "mutable").at(-1)))
  assert.ok(!resolver.isImmutableValue(identifiersNamed(parsed, "first").at(-1)))
  assert.equal(resolver.constantInitializerFor(identifiersNamed(parsed, "mutable").at(-1)), null)
})

test("resolved values reuse the source-code index and compressed alias paths", () => {
  const parsed = new ParsedCode("function named() {}; const callable = named; use(callable)")
  const resolver = new BindingResolver(parsed.sourceCode)
  const callable = identifiersNamed(parsed, "callable").at(-1)

  assert.equal(resolver.functionFor(callable), parsed.firstNodeOfType("FunctionDeclaration"))
  assert.equal(resolver.classFor(callable), null)
  assert.equal(new BindingResolver(parsed.sourceCode).functionFor(callable),
    parsed.firstNodeOfType("FunctionDeclaration"))
})

test("stable values remain available inside expression execution scopes", () => {
  const parsed = new ParsedCode(`
    const staticValue = "static"
    const instanceValue = "instance"
    const arrowValue = "arrow"
    class C {
      static config = { [staticValue]: true }
      config = { [instanceValue]: true }
    }
    const read = () => arrowValue
  `)
  const resolver = new BindingResolver(parsed.sourceCode)

  assert.deepEqual([ "staticValue", "instanceValue", "arrowValue" ].map((name) =>
    resolver.stableValueFor(identifiersNamed(parsed, name).at(-1))?.value), [ "static", "instance", "arrow" ])
})

function identifiersNamed(parsed, name) {
  return nodesIn(parsed.sourceCode.ast).filter((node) => node.type === "Identifier" && node.name === name).toArray()
}

function isResourceMutableIn(code) {
  const parsed = new ParsedCode(code)
  const resolver = new BindingResolver(parsed.sourceCode)
  return isMutableBinding(resolver.variableFor(identifiersNamed(parsed, "resource").at(-1)))
}

function parsedBindingIn(code, name, options) {
  const parsed = new ParsedCode(code, options)
  return { identifier: identifiersNamed(parsed, name).at(-1), resolver: new BindingResolver(parsed.sourceCode) }
}

function valuesPassedToUseIn(parsed) {
  return parsed.nodesOfType("CallExpression")
    .filter((call) => call.callee.name === "use")
    .map((call) => call.arguments[0])
}

function identifierPassedToUseIn(parsed) {
  return parsed.nodesOfType("CallExpression").find((call) => call.callee.name === "use").arguments[0]
}

function nestedPendingAssignments(length) {
  return `let value; value = Array; ${"value = ".repeat(length)}(`
    + `${Array.from({ length }, () => "use(value)").join(",")}, String)`
}

function longAssignmentChain(length) {
  const names = Array.from({ length }, (_value, index) => `value${index}`)
  return [
    ...names.map((name) => `let ${name}`),
    ...names.map((name, index) => `${name} = ${names[index - 1] ?? "Array"}`),
    `use(${names.at(-1)})`
  ].join(";")
}

function directEvalsWithMixedStrictness() {
  return "const hook = () => 1; function run() { eval(sloppy); "
    + "const strict = () => { 'use strict'; eval(safe) }; use(hook) }"
}
