import assert from "node:assert/strict"
import { test } from "node:test"
import { ModuleView } from "#helpers/flow/module_view"
import { ParsedCode } from "#support"

test("keepsInstancesOf rejects an instance held by a directly or indirectly exported variable", () => {
  assert.ok(!keepsFirstClass("class Entry {}; export const entry = new Entry()"))
  assert.ok(!keepsFirstClass("class Entry {}; const entry = new Entry(); export { entry }"))
})

test("keepsInstancesOf supports a local anonymous class expression held by a stable binding", () => {
  assert.ok(keepsClassOfType("const Entry = class { value = this }; new Entry().value", "ClassExpression"))
  assert.ok(!keepsClassOfType("consume(class Entry { value = this })", "ClassExpression"))
})

test("keepsInstancesOf follows conditional carriers and rejects untracked destructuring", () => {
  assert.ok(keepsFirstClass("class Entry {}; const entry = flag ? new Entry() : null; entry"))
  assert.ok(!keepsFirstClass("class Entry {}; const entry = flag && new Entry(); consume(entry)"))
  assert.ok(!keepsFirstClass("class Entry {}; const [entry] = [new Entry()]; consume(entry)"))
  assert.ok(!keepsFirstClass("class Entry {}; [new Entry()].forEach((...items) => consume(items))"))
  assert.ok(!keepsFirstClass("class Entry {}; [new Entry()].sort((left, ...right) => consume(right))"))
})

test("keepsInstancesOf tracks class this but ignores this rebound by a nested regular function", () => {
  assert.ok(!keepsFirstClass("class Entry { static { consume(this) } }; new Entry()"))
  assert.ok(keepsFirstClass("class Entry { method() { return function () { consume(this) } } }; new Entry()"))
})

test("keepsInstancesOf knows array length and callback results that cannot carry an item", () => {
  assert.ok(keepsFirstClass("class Entry {}; const entries = [ new Entry() ]; entries.length"))
  assert.ok(keepsFirstClass("class Entry {}; [ new Entry() ].findIndex((entry) => entry)"))
  assert.ok(keepsFirstClass("class Entry {}; [ new Entry() ].sort()"))
})

test("keepsInstancesOf preserves an empty but statically known field name", () => {
  assert.ok(keepsFirstClass(`
    class Entry {}
    class Holder { [""] = new Entry(); get value() { return this[""] } }
    new Holder().value
  `))
})

test("keepsInstancesOf follows a parameter with an identifier default", () => {
  assert.ok(keepsFirstClass(`
    class Entry {}
    function inspect(entry = fallback) { entry }
    inspect(new Entry())
  `))
})

test("keepsInstancesOf follows arguments through known local base constructors", () => {
  assert.ok(keepsFirstClass("class Entry {}; class Holder {}; new Holder(new Entry())"))
  assert.ok(keepsFirstClass(`
    class Entry {}
    class Holder { constructor(entry) { entry } }
    new Holder(new Entry())
  `))
  assert.ok(!keepsFirstClass(`
    class Entry {}
    class Holder { constructor(entry) { consume(entry) } }
    new Holder(new Entry())
  `))
  assert.ok(!keepsFirstClass("class Entry {}; class Holder extends Base {}; new Holder(new Entry())"))
  assert.ok(!keepsFirstClass("class Entry {}; new registry.Holder(new Entry())"))
  assert.ok(!keepsFirstClass("class Entry {}; class Holder {}; new Holder(...args, new Entry())"))
})

test("keepsInstancesOf follows an array callback parameter with an identifier default", () => {
  assert.ok(keepsFirstClass("class Entry {}; [ new Entry() ].forEach((entry = fallback) => entry)"))
})

test("keepsInstancesOf resolves a named callback when an evident array carries the instance", () => {
  assert.ok(keepsFirstClass(`
    class Entry {}
    function inspect(entry) { entry }
    [ new Entry() ].forEach(inspect)
  `))
})

test("keepsInstancesOf requires array evidence before trusting an inline callback", () => {
  assert.ok(!keepsFirstClass(`
    class Entry {}
    const custom = { map(callback) { globalThis.entry = callback() } }
    custom.map(() => new Entry())
  `))
  assert.ok(!keepsFirstClass(`
    class Entry {}
    const custom = { forEach(callback) { globalThis.entry = callback() } }
    custom.forEach(() => new Entry())
  `))
  assert.ok(!keepsFirstClass(`
    class Entry {}
    const custom = { reduce(callback) { globalThis.entry = callback() } }
    custom.reduce(() => new Entry())
  `))

  assert.ok(keepsFirstClass("class Entry {}; [ 1 ].map(() => new Entry())"))
  assert.ok(keepsFirstClass("class Entry {}; [ 1 ].forEach(() => new Entry())"))
  assert.ok(keepsFirstClass("class Entry {}; [ 1 ].reduce(() => new Entry(), null)"))
})

test("keepsInstancesOf follows the possible item result of an unseeded reduction", () => {
  assert.ok(!keepsFirstClass("class Entry {}; globalThis.entry = [ new Entry() ].reduce(() => 0)"))
  assert.ok(!keepsFirstClass("class Entry {}; globalThis.entry = [ new Entry() ].reduceRight(() => 0)"))
  assert.ok(keepsFirstClass("class Entry {}; [ new Entry() ].reduce(() => 0, null)"))
})

test("keepsInstancesOf follows the value produced by an assignment to a local field", () => {
  assert.ok(keepsFirstClass(`
    class Entry {}
    class Holder { store() { this.entry = new Entry() } }
    new Holder().store()
  `))
  assert.ok(!keepsFirstClass(`
    class Entry {}
    class Holder { store() { consume(this.entry = new Entry()) } }
    new Holder().store()
  `))
})

test("keepsInstancesOf follows returns from local functions and class members", () => {
  assert.ok(keepsFirstClass("class Entry {}; function make() { return new Entry() }; make()"))
  assert.ok(keepsFirstClass(`
    class Entry {}
    const make = () => new Entry()
    const alias = make
    const next = alias
    next()
  `))
  assert.ok(!keepsFirstClass("class Entry {}; function make() { return new Entry() }; consume(make)"))
  assert.ok(keepsFirstClass(`
    class Entry {}
    class Holder { entry() { return new Entry() } }
    new Holder().entry()
  `))
  assert.ok(!keepsFirstClass(`
    class Entry {}
    class Holder { entry() { return new Entry() } }
    consume(new Holder().entry)
  `))
})

test("keepsInstancesOf stops following function aliases that may leave or change", () => {
  assert.ok(!keepsFirstClass(`
    class Entry {}
    const make = () => new Entry()
    const alias = make
    consume(alias())
  `))
  assert.ok(!keepsFirstClass(`
    class Entry {}
    const make = () => new Entry()
    const alias = make
    export { alias }
    alias()
  `))
  assert.ok(!keepsFirstClass(`
    class Entry {}
    const make = () => new Entry()
    let alias = make
    alias = replacement
    alias()
  `))
  assert.ok(!keepsFirstClass(`
    class Entry {}
    const make = () => new Entry()
    consume({ make })
  `))
})

test("keepsInstancesOf treats a class used only as a static receiver as confined", () => {
  assert.ok(keepsFirstClass("class Entry {}; class Box { static entry = new Entry() }; Box.entry"))
  assert.ok(!keepsFirstClass("class Entry {}; class Box { static entry = new Entry() }; consume(Box.entry)"))
})

test("keepsInstancesOf separates same-named this storage in unrelated classes", () => {
  assert.ok(keepsFirstClass(`
    class Entry {}
    class SafeBox { entry = new Entry(); inspect() { this.entry } }
    class LeakingBox { entry = source; leak() { globalThis.leak = this.entry } }
    new SafeBox().inspect()
    new LeakingBox().leak()
  `))
})

test("keepsInstancesOf treats an unknown receiver as a possible read from every class", () => {
  assert.ok(!keepsFirstClass(`
    class Entry {}
    class Box { entry = new Entry() }
    const box = new Box()
    globalThis.leak = box.entry
  `))
})

test("keepsInstancesOf treats a dynamic key as any member in the receiver family", () => {
  assert.ok(!keepsFirstClass(`
    class Entry {}
    class Box { entry = new Entry(); leak(key) { globalThis.leak = this[key] } }
    new Box().leak("entry")
  `))
  assert.ok(!keepsFirstClass(`
    class Entry {}
    class Box { entry = new Entry() }
    const box = new Box()
    globalThis.leak = box[key]
  `))
  assert.ok(keepsFirstClass(`
    class Entry {}
    class SafeBox { entry = new Entry(); inspect() { this.entry } }
    class DynamicBox { leak(key) { globalThis.leak = this[key] } }
    new SafeBox().inspect()
    new DynamicBox().leak("other")
  `))
})

test("keepsInstancesOf shares member reads across a local inheritance family", () => {
  assert.ok(!keepsFirstClass(`
    class Entry {}
    class Base { entry = new Entry() }
    class Child extends Base { leak() { globalThis.leak = this.entry } }
    new Child().leak()
  `))
  assert.ok(!keepsFirstClass(`
    class Entry {}
    class Base { leak() { globalThis.leak = this.entry } }
    class Child extends Base { entry = new Entry() }
    new Child().leak()
  `))
})

test("keepsInstancesOf conservatively shares ambiguous inherited reads by static kind", () => {
  assert.ok(!keepsFirstClass(`
    class Entry {}
    class Box { entry = new Entry(); inspect() { this.entry } }
    class Foreign extends External { leak() { consume(this.entry) } }
    new Box().inspect()
  `))
  assert.ok(keepsFirstClass(`
    class Entry {}
    class Box { entry = new Entry(); inspect() { this.entry } }
    class Foreign extends External { static leak() { consume(this.entry) } }
    new Box().inspect()
  `))
  assert.ok(!keepsFirstClass(`
    class Entry {}
    class Box { static entry = new Entry() }
    class Foreign extends External { static leak() { consume(this.entry) } }
    new Box()
  `))
})

test("keepsInstancesOf keeps homonymous private slots lexically separate", () => {
  assert.ok(keepsFirstClass(`
    class Entry {}
    class Base { #entry = new Entry(); inspect() { this.#entry } }
    class Child extends Base { #entry = source; leak() { globalThis.leak = this.#entry } }
    new Child().inspect()
    new Child().leak()
  `))
  assert.ok(keepsFirstClass(`
    class Entry {}
    class Base { #entry = source; leak() { globalThis.leak = this.#entry } }
    class Child extends Base { #entry = new Entry(); inspect() { this.#entry } }
    new Child().inspect()
    new Child().leak()
  `))
})

test("keepsInstancesOf separates private names from equal public string keys", () => {
  assert.ok(keepsFirstClass(`
    class Entry {}
    class PrivateBox { #entry = new Entry(); inspect() { this.#entry } }
    class PublicBox { ["#entry"] = source; leak() { globalThis.leak = this["#entry"] } }
    new PrivateBox().inspect()
    new PublicBox().leak()
  `))
})

test("memberReadsFor separates static and instance private slots", () => {
  assert.deepEqual(new PrivateMemberReadKinds().counts, [ 1, 0, 1, 0 ])
})

test("keepsInstancesOf distinguishes lexical and rebound this storage", () => {
  assert.ok(keepsFirstClass(`
    class Entry {}
    class Holder { store() { (() => { this.entry = new Entry() })() } }
    new Holder().store()
  `))
  assert.ok(!keepsFirstClass(`
    class Entry {}
    class Holder { store(target) {
      function release() { this.entry = new Entry() }
      release.call(target)
    } }
    new Holder().store(globalThis)
  `))
})

test("keepsInstancesOf does not assume await preserves an instance", () => {
  assert.ok(!keepsFirstClass("async function run() { class Entry {}; await new Entry() }"))
})

test("keepsInstancesOf stands down when direct eval can expose a lexical instance", () => {
  assert.ok(!keepsFirstClass(`
    class Entry {}
    const entry = new Entry()
    eval("globalThis.entry = entry")
  `))
})

test("keepsInstancesOf does not consume the call stack on a deep value flow", () => {
  const aliasCount = 3_000
  assert.ok(keepsFirstClass(aliasFlowOf(aliasCount)))
})

test("keepsInstancesOf does not consume the call stack on deep inheritance", () => {
  const classCount = 2_000
  assert.ok(keepsFirstClass(inheritanceFlowOf(classCount)))
})

test("keepsInstancesOf memoizes every class in a failed inheritance chain", () => {
  const classCount = 2_000
  const parsed = new ParsedCode(escapedInheritanceFlowOf(classCount))
  const view = new ModuleView(parsed.sourceCode)
  assert.ok(parsed.nodesOfType("ClassDeclaration").every((classNode) => !view.keepsInstancesOf(classNode)))
})

test("keepsInstancesOf indexes thousands of homonymous this reads by class", () => {
  const parsed = new ParsedCode(homonymousThisStorageOf(3_000))
  const view = new ModuleView(parsed.sourceCode)
  assert.ok(parsed.nodesOfType("ClassDeclaration").every((classNode) => view.keepsInstancesOf(classNode)))
})

test("keepsInstancesOf indexes homonymous sibling branches independently", () => {
  [ 800, 1_600 ].forEach((count) => {
    const parsed = new ParsedCode(homonymousSiblingStorageOf(count))
    const view = new ModuleView(parsed.sourceCode)
    assert.ok(parsed.nodesOfType("ClassDeclaration").every((classNode) => view.keepsInstancesOf(classNode)))
  })
})

test("keepsInstancesOf does not spread a failure into an independent sibling branch", () => {
  assert.deepEqual(new SiblingClassEvaluation().values, [ false, false, true ])
})

function keepsFirstClass(code) {
  return keepsClassOfType(code, "ClassDeclaration")
}

function keepsClassOfType(code, type) {
  const parsed = new ParsedCode(code)
  return new ModuleView(parsed.sourceCode).keepsInstancesOf(parsed.firstNodeOfType(type))
}

class PrivateMemberReadKinds {
  #fields
  #view

  constructor() {
    const parsed = new ParsedCode(`
      class StaticBox { static #entry = source; static inspect() { return this.#entry } }
      class InstanceBox { #entry = source; inspect() { return this.#entry } }
    `)
    this.#fields = parsed.nodesOfType("PropertyDefinition")
    this.#view = new ModuleView(parsed.sourceCode)
  }

  get counts() {
    return this.#fields.flatMap((field) => this.#countsFor(field))
  }

  #countsFor(field) {
    return [ this.#countFor(field, field.static), this.#countFor(field, !field.static) ]
  }

  #countFor(field, isStatic) {
    return this.#view.memberReadsFor(field, { owner: field.parent.parent, isStatic }).length
  }
}

function aliasFlowOf(aliasCount) {
  return `class Entry {}; const value0 = new Entry(); ${aliasesThrough(aliasCount)}; value${aliasCount}`
}

function aliasesThrough(aliasCount) {
  return Array.from({ length: aliasCount }, (_, index) => `const value${index + 1} = value${index}`).join(";")
}

function inheritanceFlowOf(classCount) {
  const classes = [ "class Entry {}", ...Array.from({ length: classCount }, entrySubclassAt) ]
  return `${classes.join(";")}; new Entry${classCount}()`
}

function entrySubclassAt(_, index) {
  return `class Entry${index + 1} extends ${entryNameAt(index)} {}`
}

function entryNameAt(index) {
  return index === 0 ? "Entry" : `Entry${index}`
}

function escapedInheritanceFlowOf(classCount) {
  const classes = [ "class Entry {}", ...Array.from({ length: classCount }, entrySubclassAt) ]
  return `${classes.join(";")}; globalThis.entry = new Entry${classCount}()`
}

function homonymousThisStorageOf(classCount) {
  return Array.from({ length: classCount }, (_, index) =>
    `class Box${index} { entry = this; inspect() { this.entry } }`).join(";")
}

function homonymousSiblingStorageOf(siblingCount) {
  return [ "class Base {}", ...Array.from({ length: siblingCount }, (_, index) =>
    `class Box${index} extends Base { entry = this; inspect() { this.entry } }`) ].join(";")
}

class SiblingClassEvaluation {
  #classes
  #view

  constructor() {
    const parsed = new ParsedCode(`
      class Base {}
      class EscapingChild extends Base {}
      class SafeChild extends Base {}
      globalThis.child = new EscapingChild()
      new SafeChild()
    `)
    this.#classes = parsed.nodesOfType("ClassDeclaration")
    this.#view = new ModuleView(parsed.sourceCode)
  }

  get values() {
    return this.#classes.map((classNode) => this.#view.keepsInstancesOf(classNode))
  }
}
