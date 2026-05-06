import assert from "node:assert/strict"
import { test } from "node:test"
import { CalleeResolver } from "#helpers/scope/callee_resolver"
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

test("functionFor follows the callee binding instead of a same-named declaration", () => {
  const parsed = new ParsedCode(dedent`
    function save(value) { return value }
    function run(save) { return save(1) }
  `)
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)), null)
})

test("functionFor resolves a function held by a local variable", () => {
  const parsed = new ParsedCode("const save = (value) => value; save(1)")
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)).type, "ArrowFunctionExpression")
})

test("functionFor does not attribute a nested regular function's this to its surrounding class", () => {
  const parsed = new ParsedCode(dedent`
    class Store {
      save() {}
      run() { return function () { this.save() } }
    }
  `)
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)), null)
})

test("functionFor follows lexical this through an arrow", () => {
  const parsed = new ParsedCode(dedent`
    class Store {
      save() {}
      run() { return () => this.save() }
    }
  `)
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)),
    parsed.firstNodeOfType("MethodDefinition").value)
})

test("functionFor follows outer this through a nested class computed key", () => {
  const parsed = new ParsedCode(dedent`
    class Store {
      save() {}
      run() { return class Nested { [this.save()]() {} } }
    }
  `)
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)),
    parsed.firstNodeOfType("MethodDefinition").value)
})

test("functionFor binds a nested class field value to the nested class", () => {
  const parsed = new ParsedCode(dedent`
    class Store {
      save() {}
      run() { return class Nested { save() {}; field = this.save() } }
    }
  `)
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)),
    parsed.nodesOfType("MethodDefinition").at(-1).value)
})

test("functionFor resolves a statically computed member", () => {
  const parsed = new ParsedCode(dedent`
    class Sorter {
      ["compare"](left, right) { return left - right }
      run() { return this["compare"](2, 1) }
    }
  `)
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)),
    parsed.firstNodeOfType("MethodDefinition").value)
})

test("functionFor resolves stable constant-computed definitions and calls", () => {
  const parsed = new ParsedCode(dedent`
    const implementation = "persist"
    const invocation = implementation
    class Store {
      [implementation]() { this.saved = true }
      save() { return this[invocation]() }
    }
  `)

  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)),
    parsed.firstNodeOfType("MethodDefinition").value)
})

test("functionFor does not resolve a with-tainted constant-computed member", () => {
  const parsed = new ParsedCode(dedent`
    const implementation = "persist"
    with ({ implementation: "other" }) {
      class Store {
        [implementation]() { this.saved = true }
        save() { return this.persist() }
      }
    }
  `, { sourceType: "script" })

  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)), null)
})

test("functionFor keeps static and instance computed members separate", () => {
  const parsed = new ParsedCode(dedent`
    class Sorter {
      static ["compare"]() { return 1 }
      ["compare"]() { return 2 }
      static run() { return this["compare"]() }
    }
  `)
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)),
    parsed.firstNodeOfType("MethodDefinition").value)
})

test("functionFor keeps public and private members with the same name separate", () => {
  const parsed = new ParsedCode(dedent`
    class Sorter {
      compare() { return 1 }
      #compare() { return 2 }
      run() { return this.compare() }
    }
  `)
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)),
    parsed.firstNodeOfType("MethodDefinition").value)
})

test("functionFor keeps symbolic and string member identities separate", () => {
  const parsed = new ParsedCode(dedent`
    class Iterable {
      [Symbol.iterator]() { return 1 }
      [Symbol.toStringTag]() { return 2 }
      ["null"]() { return 3 }
      iterator() { return this[Symbol.iterator]() }
      tag() { return this[Symbol.toStringTag]() }
      named() { return this["null"]() }
    }
  `)
  const resolver = new CalleeResolver(parsed.sourceCode)

  assert.deepEqual(parsed.nodesOfType("CallExpression").map(({ callee }) => resolver.functionFor(callee)),
    parsed.nodesOfType("MethodDefinition").slice(0, 3).map(({ value }) => value))
})

test("functionFor inherits public names containing the private delimiter text", () => {
  const parsed = new ParsedCode(dedent`
    class Base {
      ["foo:private:bar"]() { return true }
    }
    class Child extends Base {
      run() { return this["foo:private:bar"]() }
    }
  `)

  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)),
    parsed.firstNodeOfType("MethodDefinition").value)
})

test("functionFor does not resolve a getter as the function returned by that getter", () => {
  const parsed = new ParsedCode(dedent`
    class Sorter {
      get compare() { return () => 1 }
      run() { return this.compare() }
    }
  `)
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)), null)
})

test("getterFor resolves an own getter read", () => {
  const parsed = new ParsedCode("class C { get source() { return external }; value() { return this.source } }")

  assert.equal(new CalleeResolver(parsed.sourceCode).getterFor(parsed.firstNodeOfType("MemberExpression")),
    getterFunctionIn(parsed))
})

test("member resolution follows a local superclass", () => {
  const parsed = new ParsedCode("class Base { check() {}; get source() { return external } } "
    + "class C extends Base { run() { this.check(); return this.source } }")
  const resolver = new CalleeResolver(parsed.sourceCode)

  assert.equal(resolver.functionFor(parsed.firstNodeOfType("CallExpression").callee),
    parsed.nodesOfType("MethodDefinition")[0].value)
  assert.equal(resolver.getterFor(parsed.nodesOfType("MemberExpression").at(-1)), getterFunctionIn(parsed))
})

test("setterResolutionFor distinguishes setters, shadows, and opaque heritage", () => {
  const inherited = new ParsedCode("class Base { set value(value) { external = value } } "
    + "class C extends Base { run() { this.value = 1 } }")
  const shadowed = new ParsedCode("class Base { set value(value) { external = value } } "
    + "class C extends Base { value() {}; run() { this.value = 1 } }")
  const opaque = new ParsedCode("class C extends External { run() { this.value = 1 } }")

  assert.equal(new CalleeResolver(inherited.sourceCode)
    .setterResolutionFor(inherited.nodesOfType("AssignmentExpression").at(-1).left).functionNode,
  inherited.firstNodeOfType("MethodDefinition").value)
  assert.equal(new CalleeResolver(shadowed.sourceCode)
    .setterResolutionFor(shadowed.nodesOfType("AssignmentExpression").at(-1).left).functionNode, null)
  assert.equal(new CalleeResolver(opaque.sourceCode)
    .setterResolutionFor(opaque.firstNodeOfType("AssignmentExpression").left).isUnknown, true)
})

test("setterResolutionFor stops at a field that shadows an inherited setter", () => {
  const parsed = new ParsedCode("class Base { set value(value) { external = value } } "
    + "class C extends Base { value = 0; run() { this.value = 1 } }")

  assert.equal(new CalleeResolver(parsed.sourceCode)
    .setterResolutionFor(parsed.firstNodeOfType("AssignmentExpression").left).functionNode, null)
})

test("fresh receiver dispatch is exact only for private or confined leaf members", () => {
  assert.equal(isFreshDispatchExactIn("class C { helper() {}; run() { this.helper() } }; new C().run()"), true)
  assert.equal(isFreshDispatchExactIn(
    "class Base { helper() {}; run() { this.helper() } } class C extends Base {}"), false)
  assert.equal(isFreshDispatchExactIn("export class C { helper() {}; run() { this.helper() } }"), false)
  assert.equal(isFreshDispatchExactIn("class C { helper() {}; run() { this.helper() } }; consume(C)"), false)
  assert.equal(isFreshDispatchExactIn(
    "export class Base { #helper() {}; run() { this.#helper() } } class C extends Base {}"), true)
})

test("getterFor preserves a getter paired with a setter in either order", () => {
  [
    "get source() { return external }; set source(value) {}",
    "set source(value) {}; get source() { return external }"
  ].forEach((members) => {
    const parsed = new ParsedCode(`class C { ${members}; value() { return this.source } }`)

    assert.equal(new CalleeResolver(parsed.sourceCode).getterFor(parsed.firstNodeOfType("MemberExpression")),
      getterFunctionIn(parsed))
  })
})

test("getterFor rejects ordinary methods and fields that shadow getters", () => {
  [
    "get source() { return external }; source = 1",
    "source = 1; get source() { return external }",
    "source() { return external }"
  ].forEach((members) => {
    const parsed = new ParsedCode(`class C { ${members}; value() { return this.source } }`)
    assert.equal(new CalleeResolver(parsed.sourceCode).getterFor(parsed.firstNodeOfType("MemberExpression")), null)
  })
})

test("getterFor resolves stable computed and private getters without guessing runtime keys", () => {
  const computed = new ParsedCode(
    'const key = "source"; class C { get [key]() { return external }; value() { return this[key] } }')
  const privateMember = new ParsedCode("class C { get #source() { return external }; value() { return this.#source } }")
  const ambiguous = new ParsedCode(
    "class C { get source() { return external }; get [key]() { return other }; value() { return this.source } }")

  Array.of(computed, privateMember).forEach((parsed) => {
    assert.ok(new CalleeResolver(parsed.sourceCode).getterFor(parsed.firstNodeOfType("MemberExpression")))
  })
  assert.equal(new CalleeResolver(ambiguous.sourceCode).getterFor(ambiguous.firstNodeOfType("MemberExpression")), null)
})

test("functionFor does not bind this inside a computed field key to the class instance", () => {
  const parsed = new ParsedCode("class Sorter { [this.compare()] = 1 }")
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)), null)
})

test("functionFor does not bind a regular function field's dynamic this to the class", () => {
  const parsed = new ParsedCode("class C { helper = function () { return this.check() }; check() {} }")
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)), null)
})

test("functionFor respects a field that shadows a prototype method regardless of source order", () => {
  [ "check() {}; check = 1", "check = 1; check() {}" ].forEach((members) => {
    const parsed = new ParsedCode(`class C { ${members}; status() { return this.check() } }`)
    assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)), null)
  })
})

test("functionFor uses the last callable field with the same name", () => {
  const parsed = new ParsedCode("class C { check = () => 1; check = () => 2; status() { return this.check() } }")
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)),
    parsed.nodesOfType("ArrowFunctionExpression").at(-1))
})

test("functionFor does not guess past a runtime-computed member", () => {
  const parsed = new ParsedCode("class C { check() {}; [name]() {}; status() { return this.check() } }")
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)), null)
})

test("functionFor preserves an empty but statically known member name", () => {
  const parsed = new ParsedCode('class C { [""]() { return true }; status() { return this[""]() } }')
  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)),
    parsed.firstNodeOfType("MethodDefinition").value)
})

test("functionFor resolves confined object literal methods through stable aliases", () => {
  const parsed = new ParsedCode(dedent`
    const operations = { check() { return true } }
    const first = operations
    const second = first
    second.check()
  `)

  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)),
    parsed.firstNodeOfType("FunctionExpression"))
})

test("functionFor resolves all callable object property forms", () => {
  [
    "const o = { run: () => true }; o.run()",
    "const o = { run: function () { return true } }; o.run()",
    "function work() { return true }; const o = { run: work }; o.run()",
    "function work() { return true }; const o = { work }; o.work()"
  ].forEach((code) => {
    const parsed = new ParsedCode(code)
    assert.ok(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)))
  })
})

test("functionFor applies object literal overwrite order", () => {
  const resolvable = [
    "const o = { run: null, run() {} }; o.run()",
    "const o = { ...source, run() {} }; o.run()",
    "const o = { [key]() {}, run() {} }; o.run()"
  ]
  const ambiguous = [
    "const o = { run() {}, run: null }; o.run()",
    "const o = { run() {}, ...source }; o.run()",
    "const o = { run() {}, [key]() {} }; o.run()",
    "const o = { get run() { return () => true } }; o.run()"
  ]

  resolvable.forEach((code) => assert.ok(functionForLastCallIn(code)))
  ambiguous.forEach((code) => assert.equal(functionForLastCallIn(code), null))
})

test("functionFor resolves statically computed object definitions and calls", () => {
  const parsed = new ParsedCode(dedent`
    const definition = "check"
    const invocation = definition
    const operations = { [definition]() { return true } }
    operations[invocation]()
  `)

  assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(calleeIn(parsed)),
    parsed.firstNodeOfType("FunctionExpression"))
})

test("functionFor rejects escaped object receivers and every alias", () => {
  [
    "const o = { run() {} }; consume(o); o.run()",
    "const o = { run() {} }; const a = o; consume(a); o.run()",
    "const o = { run() {} }; function value() { return o }; o.run()",
    "const o = { run() {} }; external.value = o; o.run()",
    "const o = { run() {} }; const box = { o }; o.run()",
    "const o = { run() {} }; Object.freeze(o); o.run()",
    "export const o = { run() {} }; o.run()",
    "const o = { run() {} }; export { o }; o.run()"
  ].forEach((code) => assert.equal(functionForLastCallIn(code), null))
})

test("functionFor keeps shadowed receivers separate and rejects reassigned bindings", () => {
  const shadowed = new ParsedCode(dedent`
    const o = { run() { return 1 } }
    function use(o) { return o.run() }
    o.run()
  `)
  const calls = shadowed.nodesOfType("CallExpression")
  const resolver = new CalleeResolver(shadowed.sourceCode)

  assert.equal(resolver.functionFor(calls[0].callee), null)
  assert.equal(resolver.functionFor(calls[1].callee), shadowed.firstNodeOfType("FunctionExpression"))
  assert.equal(functionForLastCallIn("let o = { run() {} }; o = other; o.run()"), null)
  assert.equal(functionForLastCallIn("const o = { run() {} }; let alias = o; alias = other; alias.run()"), null)
})

test("functionFor retains a stable alias after the original binding changes", () => {
  const retained = new ParsedCode(
    "let original = { run() {} }; const held = original; original = other; held.run(); held.run = other")
  assert.equal(new CalleeResolver(retained.sourceCode).functionFor(calleeIn(retained)),
    retained.firstNodeOfType("FunctionExpression"))
})

test("functionFor requires the receiver initializer to dominate the call", () => {
  [
    "o.run(); const o = { run() {} }",
    "C.run(); class C { static run() {} }"
  ].forEach((code) => assert.equal(functionForFirstCallIn(code), null))
})

test("functionFor does not trust a receiver resolved dynamically through with", () => {
  const code = "const o = { run() {} }; with ({ o: other }) { o.run() }"

  assert.equal(functionForLastCallIn(code, { sourceType: "script" }), null)
})

test("functionFor observes possible member overwrites but ignores proven later or unreachable ones", () => {
  Array.of(
    "const o = { run() {} }; o[key] = other; o.run()",
    "const o = { run() {} }; if (condition) o.run = other; o.run()",
    "const o = { run() {} }; delete o.run; o.run()"
  ).forEach((code) => assert.equal(functionForLastCallIn(code), null))
  Array.of(
    "const o = { run() {} }; o.run(); o.run = other",
    "const o = { run() {} }; if (false) o.run = other; o.run()"
  ).forEach((code) => assert.ok(functionForFirstCallIn(code)))
})

test("functionFor observes overwrites of callable receiver dependencies", () => {
  const object = "const o = { helper() {}, run() { return this.helper() } }; "
    + "o.helper = external; o.run()"
  const classNode = "class C { static helper() {}; static run() { return this.helper() } }; "
    + "C.helper = external; C.run()"
  const state = "const o = { count: 0, run() { return true } }; o.count = 1; o.run()"

  Array.of(object, classNode).forEach((code) => assert.equal(functionForLastCallIn(code), null))
  assert.ok(functionForLastCallIn(state))
})

test("functionFor rejects member writes that can invoke a setter", () => {
  [
    "const o = { set state(value) { this.run = value }, run() {} }; o.state = other; o.run()",
    "class C { static set state(value) { this.run = value }; static run() {} }; C.state = other; C.run()",
    "class Base { static set state(value) { this.run = value } }; "
    + "class C extends Base { static run() {} }; C.state = other; C.run()",
    "class C extends External { static run() {} }; C.state += 1; C.run()"
  ].forEach((code) => assert.equal(functionForLastCallIn(code), null))
})

test("functionFor does not treat a later write in a repeating sequence as later execution", () => {
  const loop = "const o = { run() {} }; while (condition) { o.run(); o.run = other }"
  const closure = "const o = { run() {} }; function repeat() { o.run(); o.run = other }; repeat()"

  assert.equal(functionForFirstCallIn(loop), null)
  assert.equal(functionForFirstCallIn(closure), null)
})

test("functionFor resolves confined static methods, fields, aliases, and computed keys", () => {
  [
    "class C { static run() {} }; C.run()",
    "const C = class { static run() {} }; C.run()",
    "class C { static run() {} }; const Alias = C; Alias.run()",
    "function work() {}; class C { static run = work }; C.run()",
    "const key = 'run'; class C { static [key]() {} }; C[key]()"
  ].forEach((code) => assert.ok(functionForLastCallIn(code)))
})

test("functionFor applies class static field and duplicate semantics", () => {
  const resolvable = [
    "class C { static run = () => 1; static run() { return 2 } }; C.run()",
    "class C { static run() { return 1 }; static run() { return 2 } }; C.run()",
    "class C { static run = null; static run = () => 1 }; C.run()"
  ]
  const absent = [
    "class C { static run() {}; static run = null }; C.run()",
    "class C { static get run() { return () => 1 } }; C.run()",
    "class C { run() {} }; C.run()",
    "class C { static run() {}; static [key]() {} }; C.run()"
  ]

  resolvable.forEach((code) => assert.ok(functionForLastCallIn(code)))
  absent.forEach((code) => assert.equal(functionForLastCallIn(code), null))
})

test("functionFor returns the exact final static definition", () => {
  const fieldOverMethod = new ParsedCode("class C { static run = () => 1; static run() { return 2 } }; C.run()")
  const duplicateMethods = new ParsedCode("class C { static run() { return 1 }; static run() { return 2 } }; C.run()")

  assert.equal(new CalleeResolver(fieldOverMethod.sourceCode).functionFor(calleeIn(fieldOverMethod)),
    fieldOverMethod.firstNodeOfType("ArrowFunctionExpression"))
  assert.equal(new CalleeResolver(duplicateMethods.sourceCode).functionFor(calleeIn(duplicateMethods)),
    duplicateMethods.nodesOfType("MethodDefinition").at(-1).value)
})

test("functionFor rejects escaped and dynamically exposed classes", () => {
  [
    "class C { static run() {} }; consume(C); C.run()",
    "class C { static run() {} }; new C(); C.run()",
    "class C { static run() {} }; class Child extends C {}; C.run()",
    "class C { static run() {} }; C.prototype.value = 1; C.run()",
    "export class C { static run() {} }; C.run()",
    "class C { static run() {} }; function change() { eval(source) }; C.run()"
  ].forEach((code) => assert.equal(functionForLastCallIn(code), null))
})

test("functionFor rejects static initialization that can replace a callable", () => {
  const staticBlock = "class C { static run() {}; static { this.run = other } }; C.run()"
  const staticField = "class C { static run() {}; static value = (this.run = other) }; C.run()"
  const indirect = "class C { static helper() { this.run = other }; static run() { this.helper() }; "
    + "static { C.run() }; static helper = () => true }; C.run()"

  Array.of(staticBlock, staticField, indirect)
    .forEach((code) => assert.equal(functionForLastCallIn(code), null))
  assert.ok(functionForLastCallIn("class C { static count = 0; "
    + "static run() { this.count++; return true } }; C.run()"))
})

test("functionFor rejects receiver leaks and callable replacement through this", () => {
  [
    "const o = { run() { consume(this); return true } }; o.run()",
    "const o = { run() { this.run = other; return true } }; o.run()",
    "class C { static run() { return this } }; C.run()",
    "class C { static run() { this.run = other; return true } }; C.run()"
  ].forEach((code) => assert.equal(functionForLastCallIn(code), null))
})

test("functionFor follows receiver methods invoked as template tags", () => {
  [
    "const o = { change() { this.run = other }, run() { this.change`` } }; o.run()",
    "class C { static change() { this.run = other }; static run() { this.change`` } }; C.run()",
    "class C { static run() {}; static change() { this.run = other }; static { this.change`` } }; C.run()"
  ].forEach((code) => assert.equal(functionForLastCallIn(code), null))
})

test("functionFor rejects script globals but keeps function-local receivers", () => {
  [ "var", "const" ].forEach((kind) => assert.equal(functionForLastCallIn(
    `${kind} o = { run() {} }; o.run()`, { sourceType: "script" }), null))
  assert.ok(functionForLastCallIn(
    "function outer() { const o = { run() {} }; return o.run() }", { sourceType: "script" }))
})

test("functionFor distinguishes direct eval from a local function named eval", () => {
  const local = "function outer() { function eval() {}; "
    + "const o = { run() { eval(); return true } }; return o.run() }"
  const direct = "const o = { run() { eval(source); return true } }; o.run()"

  assert.ok(functionForLastCallIn(local, { sourceType: "script" }))
  assert.equal(functionForLastCallIn(direct), null)
})

test("functionFor verifies the lexical identity of private static names", () => {
  const exact = new ParsedCode("class A { static #run() {}; static call() { A.#run() } }; A.call()")
  const mismatched = new ParsedCode(
    "class A { static #run() {} }; class B { static #run() {}; static call() { A.#run() } }; B.call()")

  assert.ok(new CalleeResolver(exact.sourceCode).functionFor(privateCalleeIn(exact)))
  assert.equal(new CalleeResolver(mismatched.sourceCode).functionFor(privateCalleeIn(mismatched)), null)
})

test("functionFor observes class field initialization order", () => {
  [
    "class C { static { C.run() }; static run = () => 1 }",
    "class C { static { this.run() }; static run = () => 1 }"
  ].forEach((code) => assert.equal(functionForFirstCallIn(code), null))

  const staticMethod = new ParsedCode("class C { static run() { return 1 }; static { C.run() }; static run = () => 2 }")
  assert.equal(new CalleeResolver(staticMethod.sourceCode).functionFor(calleeIn(staticMethod)),
    staticMethod.firstNodeOfType("MethodDefinition").value)

  const instanceMethod = new ParsedCode("class C { run() { return 1 }; first = this.run(); run = () => 2 }")
  assert.equal(new CalleeResolver(instanceMethod.sourceCode).functionFor(calleeIn(instanceMethod)),
    instanceMethod.firstNodeOfType("MethodDefinition").value)
})

test("functionFor stays unknown when a field-initializer closure can run before or after later fields", () => {
  const code = "class C { static run() { return 1 }; static call = () => C.run(); static run = () => 2 }"

  assert.equal(functionForFirstCallIn(code), null)
})

test("hierarchy caches preserve temporal resolution across inheritance cycles", () => {
  const parsed = new ParsedCode("class Left extends Right { first = this.value(); value = () => 1 }; "
    + "class Right extends Left { later() { return this.value() } }")
  const resolver = new CalleeResolver(parsed.sourceCode)
  const calls = parsed.nodesOfType("CallExpression")

  assert.equal(resolver.functionFor(calls[1].callee), parsed.firstNodeOfType("ArrowFunctionExpression"))
  assert.equal(resolver.functionFor(calls[0].callee), null)
})

test("functionFor reuses inherited member resolutions across a deep class chain", () => {
  const parsed = new ParsedCode(inheritedMemberCallsAt(1_000))
  const resolver = new CalleeResolver(parsed.sourceCode)
  const target = parsed.firstNodeOfType("MethodDefinition").value

  parsed.nodesOfType("CallExpression")
    .forEach((call) => assert.equal(resolver.functionFor(call.callee), target))
})

test("functionFor shares local receiver indexes across a wide alias graph", () => {
  const parsed = new ParsedCode(new WideObjectProgram(500).code)
  const resolver = new CalleeResolver(parsed.sourceCode)
  const calls = parsed.nodesOfType("CallExpression")

  assert.equal(calls.length, 500)
  calls.forEach((call) => assert.ok(resolver.functionFor(call.callee)))
})

test("functionFor shares compressed this paths across many deep member calls", () => {
  const parsed = new ParsedCode(deepMemberCallsAt(300))
  const target = parsed.firstNodeOfType("MethodDefinition").value
  assert.ok(target)
  for (const call of parsed.nodesOfType("CallExpression")) {
    assert.equal(new CalleeResolver(parsed.sourceCode).functionFor(call.callee), target)
  }
})

test("functionFor follows inline class heritage and rejects opaque heritage", () => {
  assert.ok(functionForLastCallIn("class Subject extends (class { work() {} }) { run() { this.work() } }"))
  assert.equal(functionForLastCallIn("class Subject extends External { run() { this.work() } }"), null)
  assert.equal(functionForLastCallIn("class Subject extends external.Base { run() { this.work() } }"), null)
})

function calleeIn(parsed) {
  return parsed.firstNodeOfType("CallExpression").callee
}

function getterFunctionIn(parsed) {
  return parsed.nodesOfType("MethodDefinition").find((member) => member.kind === "get").value
}

function isFreshDispatchExactIn(code) {
  const parsed = new ParsedCode(code)
  return new CalleeResolver(parsed.sourceCode).isFreshReceiverDispatchExactFor(calleeIn(parsed))
}

function functionForLastCallIn(code, options) {
  const parsed = new ParsedCode(code, options)
  return new CalleeResolver(parsed.sourceCode).functionFor(parsed.nodesOfType("CallExpression").at(-1).callee)
}

function functionForFirstCallIn(code) {
  const parsed = new ParsedCode(code)
  return new CalleeResolver(parsed.sourceCode).functionFor(parsed.firstNodeOfType("CallExpression").callee)
}

function privateCalleeIn(parsed) {
  return parsed.nodesOfType("CallExpression")
    .find((call) => call.callee.property?.type === "PrivateIdentifier").callee
}

function inheritedMemberCallsAt(count) {
  return [ "class C0 { work() {} }", ...Array.from({ length: count }, (_value, index) =>
    `class C${index + 1} extends C${index} { check() { this.work() } }`) ].join(";")
}

class WideObjectProgram {
  #count

  constructor(count) {
    this.#count = count
  }

  get code() {
    return `const operations = { check() { return true } }; ${this.#aliases};${this.#calls}`
  }

  get #aliases() {
    return this.#linesFor((index) => `const alias${index} = operations`)
  }

  #linesFor(lineAt) {
    return Array.from({ length: this.#count }, (_value, index) => lineAt(index)).join(";")
  }

  get #calls() {
    return this.#linesFor((index) => `alias${index}.check()`)
  }
}

function deepMemberCallsAt(depth) {
  return `class C { #visit() {} run() { ${"{".repeat(depth)} `
    + `${Array.from({ length: depth }, () => "this.#visit()").join(";")} ${"}".repeat(depth)} } }`
}
