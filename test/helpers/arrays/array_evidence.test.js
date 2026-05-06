import assert from "node:assert/strict"
import { test } from "node:test"
import { ArrayEvidence } from "#helpers/arrays/array_evidence"
import { ParsedCode } from "#support"

test("direct and evident array queries stay independent across repeated queries and analyses", () => {
  const parsed = new ParsedCode("const items = []; for (const item of items) use(item)")
  const { right } = parsed.firstNodeOfType("ForOfStatement")
  for (const evidence of [ new ArrayEvidence(parsed.sourceCode), new ArrayEvidence(parsed.sourceCode) ]) {
    assert.ok(!evidence.isDirect(right))
    assert.ok(evidence.isEvident(right))
    assert.ok(!evidence.isDirect(right))
  }
})

test("array literals are evident while only literals without holes are dense", () => {
  const dense = new EvidenceIn("for (const item of [ 1, 2 ]) consume(item)")
  assert.ok(dense.isEvident)
  assert.ok(dense.isFreshAndDense)
  assert.ok(dense.canUseForEach)

  const sparse = new EvidenceIn("for (const item of [ 1, , 2 ]) consume(item)")
  assert.ok(sparse.isEvident)
  assert.ok(!sparse.isFreshAndDense)
  assert.ok(!sparse.canUseForEach)
})

test("known methods follow array evidence without treating sparse-preserving calls as dense", () => {
  assert.ok(!new EvidenceIn("for (const item of [][method]()) consume(item)").isEvident)
  const map = new EvidenceIn("for (const item of [].map(transform)) consume(item)")
  assert.ok(map.isEvident)
  assert.ok(!map.isFreshAndDense)

  const filter = new EvidenceIn("for (const item of [].filter(keep)) consume(item)")
  assert.ok(filter.isEvident)
  assert.ok(filter.isFreshAndDense)

  assert.ok(!new EvidenceIn("for (const item of [].unknown()) consume(item)").isEvident)
  assert.ok(!new EvidenceIn(
    "class C { #filter() {} run() { for (const item of [].#filter(keep)) consume(item) } }"
  ).isEvident)
  assert.ok(!new EvidenceIn(
    "Array.prototype.filter = fake; for (const item of [].filter(keep)) consume(item)"
  ).isFreshAndDense)
})

test("array static methods require the exact global binding", () => {
  const global = new EvidenceIn("for (const item of Array.of(1)) consume(item)")
  assert.ok(global.isEvident)
  assert.ok(global.isFreshAndDense)

  const shadowed = new EvidenceIn("function run(Array) { for (const item of Array.of(1)) consume(item) }")
  assert.ok(!shadowed.isEvident)

  assert.ok(new EvidenceIn("for (const item of Object.keys(value)) consume(item)").isEvident)

  assert.ok(!new EvidenceIn("Array = FakeArray; for (const item of Array.of(1)) consume(item)").isEvident)
  assert.ok(!new EvidenceIn("Object = FakeObject; for (const item of Object.keys(value)) consume(item)").isEvident)
})

test("array static methods must retain their native member identity", () => {
  assert.ok(!new EvidenceIn("Array.from = fake; for (const item of Array.from(value)) consume(item)").isEvident)
  assert.ok(!new EvidenceIn("Object.keys = fake; for (const item of Object.keys(value)) consume(item)").isEvident)
  assert.ok(!new EvidenceIn(
    "const Native = Array; Native.of = fake; for (const item of Array.of(value)) consume(item)"
  ).isEvident)
  assert.ok(!new EvidenceIn(
    "Object.defineProperty(globalThis, 'Array', { value: Fake }); "
    + "for (const item of new Array(value)) consume(item)"
  ).isEvident)
})

test("exact Array constructions and global aliases provide array evidence", () => {
  assert.ok(new EvidenceIn("for (const item of new Array(size)) consume(item)").isEvident)
  assert.ok(!new EvidenceIn("for (const item of new Array(size)) consume(item)").isFreshAndDense)
  assert.ok(new EvidenceIn("for (const item of Array(value)) consume(item)").isEvident)
  assert.ok(new EvidenceIn("const Native = Array; for (const item of Native.from(values)) consume(item)").isEvident)

  assert.ok(!new EvidenceIn("function run(Array) { for (const item of new Array(size)) consume(item) }").isEvident)
})

test("array aliases require an available initializer", () => {
  assert.ok(!new EvidenceIn("function run() { for (const item of values) consume(item); const values = [] }").isEvident)
  assert.ok(!new EvidenceIn(
    "function run(flag) { if (flag) var values = []; for (const item of values) consume(item) }"
  ).isEvident)
})

test("split requires direct or immutable string evidence", () => {
  assert.ok(new EvidenceIn('for (const item of "a,b".split(",")) consume(item)').isFreshAndDense)
  assert.ok(new EvidenceIn("for (const item of 'a,b'.split(/,/)) consume(item)").isFreshAndDense)
  assert.ok(new EvidenceIn("for (const item of 'a,b'.split(new RegExp(','))) consume(item)").isFreshAndDense)
  assert.ok(new EvidenceIn('const csv = "a,b"; for (const item of csv.split(",")) consume(item)').isEvident)
  assert.ok(!new EvidenceIn('let csv = "a,b"; for (const item of csv.split(",")) consume(item)').isEvident)
  assert.ok(!new EvidenceIn(
    "const separator = { [Symbol.split]() { return custom } }; "
    + "for (const item of 'a,b'.split(separator)) consume(item)"
  ).isEvident)
})

test("split accounts for exact Symbol.split hooks at the time of invocation", () => {
  const customHooks = [
    "String.prototype[Symbol.split] = custom; for (const item of 'a,b'.split(',')) consume(item)",
    "Object.prototype[Symbol.split] = custom; for (const item of 'a,b'.split(1)) consume(item)",
    "RegExp.prototype[Symbol.split] = custom; for (const item of 'a,b'.split(/,/)) consume(item)",
    "Object.defineProperty(RegExp.prototype, Symbol.split, { value: custom }); "
    + "for (const item of 'a,b'.split(/,/)) consume(item)",
    "for (const item of 'a,b'.split(',', (String.prototype[Symbol.split] = custom, 1))) consume(item)"
  ]
  customHooks.forEach((code) => assert.ok(!new EvidenceIn(code).isEvident))

  const unrelatedOrLaterWrites = [
    "RegExp.prototype.split = custom; for (const item of 'a,b'.split(/,/)) consume(item)",
    "globalThis.RegExp = Fake; for (const item of 'a,b'.split(/,/)) consume(item)",
    "Object.prototype[Symbol.split] = custom; for (const item of 'a,b'.split(/,/)) consume(item)",
    "Object.defineProperty(Array, 'species', { value: custom }); "
    + "for (const item of 'a,b'.split(',')) consume(item)",
    "for (const item of 'a,b'.split(',', (String.prototype.split = custom, 1))) consume(item)",
    "for (const item of 'a,b'.split(',')) consume(item); String.prototype[Symbol.split] = custom"
  ]
  unrelatedOrLaterWrites.forEach((code) => assert.ok(new EvidenceIn(code).isFreshAndDense))
})

test("split accepts primitive separators only while their split hooks stay native", () => {
  [ "", "null", "undefined", "void value", "true", "1n", "`x`", "!value", "typeof value", "+value", "-1", "~1n",
    "delete box.key" ].forEach((separator) => {
    const code = `for (const item of 'a,b'.split(${separator})) consume(item)`
    assert.ok(new EvidenceIn(code).isFreshAndDense, separator)
  })
})

test("split rejects primitive separators with replaced native hooks", () => {
  [ [ "Boolean", "true" ], [ "BigInt", "1n" ], [ "Number", "+value" ], [ "BigInt", "-1n" ] ]
    .forEach(([ globalName, separator ]) => {
      assert.ok(!new EvidenceIn(`${globalName}.prototype[Symbol.split] = custom; `
        + `for (const item of 'a,b'.split(${separator})) consume(item)`).isEvident)
    })
  assert.ok(!new EvidenceIn("for (const item of 'a,b'.split(new Custom())) consume(item)").isEvident)
  assert.ok(!new EvidenceIn("for (const item of 'a,b'.split(separator)) consume(item)").isEvident)
  assert.ok(!new EvidenceIn("const separator = /,/; separator[Symbol.split] = custom; "
    + "for (const item of 'a,b'.split(separator)) consume(item)").isEvident)
})

test("species-producing methods require the default Array constructor", () => {
  assert.ok(!new EvidenceIn(
    "const items = []; items.constructor = custom; for (const item of items.map(transform)) consume(item)"
  ).isEvident)

  const customSpecies = [
    "Array.prototype.constructor = custom; for (const item of [].filter(keep)) consume(item)",
    "Object.defineProperty(Array, Symbol.species, { value: custom }); "
    + "for (const item of [].filter(keep)) consume(item)",
    "Object.defineProperty(Array.prototype.constructor, Symbol.species, { value: custom }); "
    + "for (const item of [].filter(keep)) consume(item)",
    "const Constructor = [].constructor; Object.defineProperty(Constructor, Symbol.species, { value: custom }); "
    + "for (const item of [].filter(keep)) consume(item)",
    "for (const item of [].filter((Array.prototype.constructor = custom, keep))) consume(item)",
    "function patch(Constructor) { Constructor[Symbol.species] = custom } patch(Array); "
    + "for (const item of [].filter(keep)) consume(item)"
  ]
  customSpecies.forEach((code) => assert.ok(!new EvidenceIn(code).isFreshAndDense))

  assert.ok(new EvidenceIn(
    "Object.defineProperty(Array, 'species', { value: custom }); "
    + "for (const item of [].filter(keep)) consume(item)"
  ).isFreshAndDense)
})

test("array-producing calls retain their native method identity", () => {
  assert.ok(!new EvidenceIn(
    "Array.prototype.map = fake; for (const item of [].map(transform)) consume(item)"
  ).isEvident)
  assert.ok(!new EvidenceIn(
    "String.prototype.split = fake; for (const item of 'a,b'.split(',')) consume(item)"
  ).isEvident)
  assert.ok(!new EvidenceIn(
    "const items = []; items.map = fake; for (const item of items.map(transform)) consume(item)"
  ).isEvident)
  assert.ok(!new EvidenceIn(
    "const items = []; const alias = items; alias.map = fake; "
    + "for (const item of items.map(transform)) consume(item)"
  ).isEvident)
  assert.ok(!new EvidenceIn(
    "const items = []; Object.assign(items, { map: fake }); "
    + "for (const item of items.map(transform)) consume(item)"
  ).isEvident)
  assert.ok(!new EvidenceIn(
    "const items = []; Object.defineProperty(items, 'map', { value: fake }); "
    + "for (const item of items.map(transform)) consume(item)"
  ).isEvident)
  assert.ok(!new EvidenceIn(
    "const items = []; Reflect.set(items, 'map', fake); "
    + "for (const item of items.map(transform)) consume(item)"
  ).isEvident)

  assert.ok(new EvidenceIn(
    "const items = []; for (const item of items.map(transform)) consume(item); items.map = fake"
  ).isEvident)
})

test("bound array producers require pointwise receiver ownership", () => {
  const exposed = [
    "const items = []; consume(items); for (const item of items.map(transform)) use(item)",
    "const items = []; const alias = items; consume(alias); for (const item of items.map(transform)) use(item)",
    "const items = []; const leak = () => consume(items); for (const item of items.map(transform)) use(item)",
    "const items = []; while (condition) { "
    + "for (const item of items.map(transform)) use(item); consume(items) }",
    "const items = []; for (const item of items.map((consume(items), transform))) use(item)",
    "const items = []; for (const item of items.map((items.constructor = custom, transform))) use(item)"
  ]
  exposed.forEach((code) => assert.ok(!new EvidenceIn(code).isEvident))

  const confined = [
    "const items = []; use(items.length); for (const item of items.map(transform)) use(item)",
    "const items = []; items.label = 'values'; for (const item of items.map(transform)) use(item)",
    "const items = []; Object.assign(items); Object.assign(items, {}); "
    + "for (const item of items.map(transform)) use(item)",
    "const items = []; Object.assign(items, { label: 'values' }); "
    + "for (const item of items.map(transform)) use(item)",
    "const items = []; Object.defineProperty(items, 'map', { enumerable: false }); "
    + "for (const item of items.map(transform)) use(item)",
    "const items = []; Object.defineProperties(items, {}); "
    + "for (const item of items.map(transform)) use(item)",
    "const items = []; Reflect.set(items, 'map', fake, receiver); "
    + "for (const item of items.map(transform)) use(item)",
    "const items = []; for (const item of items.map(transform)) use(item); consume(items)",
    "const items = []; for (const item of items.toReversed((consume(items), value))) use(item)"
  ]
  confined.forEach((code) => assert.ok(new EvidenceIn(code).isEvident))
})

test("indexes many safe receiver reads without a reference-count cutoff", () => {
  assert.ok(new EvidenceIn(`const items = []; ${receiverReads(1_000)}; `
    + "for (const item of items.map(transform)) use(item)").isEvident)
})

test("constant dense aliases remain usable only before another read can observe mutation", () => {
  const confined = new EvidenceIn("const items = [].filter(keep); for (const item of items) consume(item)")
  assert.ok(confined.isEvident)
  assert.ok(confined.canUseForEach)

  const observed = new EvidenceIn("const items = [].filter(keep); consume(items); for (const item of items) use(item)")
  assert.ok(observed.isEvident)
  assert.ok(!observed.canUseForEach)
})

test("dynamic lookup does not turn a lexical-looking alias into array evidence", () => {
  const array = new EvidenceIn(
    "const items = []; with ({ items: custom }) { for (const item of items) consume(item) }",
    { sourceType: "script" }
  )
  const string = new EvidenceIn(
    "const csv = 'a,b'; with ({ csv: custom }) { for (const item of csv.split(',')) consume(item) }",
    { sourceType: "script" }
  )

  assert.ok(!array.isEvident)
  assert.ok(!array.canUseForEach)
  assert.ok(!string.isEvident)
})

test("mutable, unresolved, optional, and cyclic origins remain unknown", () => {
  assert.ok(!new EvidenceIn("let items = []; for (const item of items) consume(item)").isEvident)
  assert.ok(!new EvidenceIn("for (const item of items) consume(item)").isEvident)
  assert.ok(!new EvidenceIn("for (const item of items?.filter(keep)) consume(item)").isEvident)

  const cyclic = new EvidenceIn("const first = second.map(f); const second = first.map(f); "
    + "for (const item of first) consume(item)")
  assert.ok(!cyclic.isEvident)
})

class EvidenceIn {
  #evidence
  #loop

  constructor(code, options) {
    const parsed = new ParsedCode(code, options)
    this.#loop = parsed.firstNodeOfType("ForOfStatement")
    this.#evidence = new ArrayEvidence(parsed.sourceCode)
  }

  get isEvident() {
    return this.#evidence.isEvident(this.#loop.right)
  }

  get isFreshAndDense() {
    return this.#evidence.valueOf(this.#loop.right).isFreshAndDense
  }

  get canUseForEach() {
    return this.#evidence.valueOf(this.#loop.right).canUseForEachIn(this.#loop)
  }
}

function receiverReads(count) {
  return Array.from({ length: count }, () => "use(items.length)").join(";")
}
