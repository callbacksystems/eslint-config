import assert from "node:assert/strict"
import { test } from "node:test"
import { WrittenPropertyValues } from "#helpers/objects/written_property_values"
import { ParsedCode } from "#support"

test("written values select the latest dominating exact or indeterminate write", () => {
  const fixture = new WrittenValuesFixture("const subject = {}; subject.value = first; consume(subject.value); "
    + "subject[key] = unknown; consume(subject.value); subject.value = last; consume(subject.value)")
  fixture.add({ index: 0, name: "value" })
  fixture.add({ index: 1, name: null, value: null })
  fixture.add({ index: 2, name: "value" })

  assert.equal(fixture.valueBefore("value", 0).name, "first")
  assert.equal(fixture.valueBefore("value", 1), null)
  assert.equal(fixture.valueBefore("value", 2).name, "last")
  assert.equal(fixture.valueBefore("missing", 1), null)
})

test("written values retain no-write, dominance, and late additions", () => {
  const fixture = new WrittenValuesFixture("const subject = {}; consume(subject.value); "
    + "if (condition) subject.value = maybe; consume(subject.value); subject.value = certain; "
    + "consume(subject.value)")
  fixture.add({ index: 0, name: "value" })

  assert.ok(fixture.isNoWrite(fixture.valueBefore("value", 0)))
  assert.ok(fixture.isNoWrite(fixture.valueBefore("value", 1)))
  assert.ok(!fixture.hasAnyBefore(1))
  fixture.add({ index: 1, name: "value" })
  assert.equal(fixture.valueBefore("value", 2).name, "certain")
  assert.ok(fixture.hasAnyBefore(2))
})

test("written values preserve insertion order for writes from one operation", () => {
  const fixture = new WrittenValuesFixture("const subject = {}; subject.value = first; consume(subject.value)")
  fixture.add({ index: 0, name: "value" })
  assert.equal(fixture.valueBefore("value", 0).name, "first")
  fixture.add({ index: 0, name: "value", value: null })
  assert.equal(fixture.valueBefore("value", 0), null)
})

test("written values order registrations by execution position", () => {
  const fixture = new WrittenValuesFixture("const subject = {}; subject.value = first; consume(subject.value); "
    + "subject.value = last; consume(subject.value)")
  fixture.add({ index: 1, name: "value" })
  fixture.add({ index: 0, name: "value" })

  assert.equal(fixture.valueBefore("value", 0).name, "first")
  assert.equal(fixture.valueBefore("value", 1).name, "last")
  assert.ok(fixture.isNoWrite(fixture.valueBefore(null, 1)))
})

test("written value lookups do not rescan all earlier writes", () => {
  const count = 1_000
  const fixture = new WrittenValuesFixture(wideWritesAndReads(count))
  fixture.addEvery("value")

  assert.ok(fixture.valuesBeforeEvery("value").every((value) => value.value === count - 1))
})

class WrittenValuesFixture {
  #object
  #operations
  #uses
  #values

  constructor(code) {
    const parsed = new ParsedCode(code)
    this.#object = parsed.firstNodeOfType("ObjectExpression")
    this.#operations = parsed.nodesOfType("AssignmentExpression")
    this.#uses = parsed.nodesOfType("CallExpression")
    this.#values = new WrittenPropertyValues(parsed.sourceCode.ast)
  }

  addEvery(name) {
    this.#operations.forEach((_operation, index) => this.add({ index, name }))
  }

  add({ index, name, value = this.#operations[index].right }) {
    this.#values.add(this.#object, { operation: this.#operations[index], name, value })
  }

  valuesBeforeEvery(name) {
    return this.#uses.map((_use, index) => this.valueBefore(name, index))
  }

  valueBefore(name, useIndex) {
    return this.#values.valueBefore(this.#object, name, this.#uses[useIndex])
  }

  isNoWrite(value) {
    return this.#values.isNoWrite(value)
  }

  hasAnyBefore(useIndex) {
    return this.#values.hasAnyBefore(this.#object, this.#uses[useIndex])
  }
}

function wideWritesAndReads(count) {
  return `const subject = {}; ${Array.from({ length: count }, (_value, index) =>
    `subject.value = ${index}`).join(";")}; ${Array.from({ length: count }, () =>
    "consume(subject.value)").join(";")}`
}
