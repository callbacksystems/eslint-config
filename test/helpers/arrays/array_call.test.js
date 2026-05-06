import assert from "node:assert/strict"
import { test } from "node:test"
import { ArrayCall } from "#helpers/arrays/array_call"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ParsedCode } from "#support"

test("standard array callbacks preserve their value and array parameter kinds", () => {
  const fixture = new ArrayCallIn("[].map((item, index, array) => item)")

  assert.ok(fixture.staysHere)
  assert.deepEqual(fixture.parameterKinds, [ null, "array" ])
})

test("named callbacks resolve locally while dynamic arguments remain unsafe", () => {
  const named = new ArrayCallIn("function visit(item) { return item }; [].map(visit)")
  assert.ok(named.staysHere)

  const dynamic = new ArrayCallIn("[].map(function () { return arguments[0] })")
  assert.ok(!dynamic.staysHere)

  const omitted = new ArrayCallIn("[].map()")
  assert.ok(!omitted.staysHere)
})

test("comparators may be omitted or receive two ordinary values", () => {
  const omitted = new ArrayCallIn("[].sort()")
  assert.ok(omitted.staysHere)
  assert.deepEqual(omitted.resultKinds, [ "array" ])

  const provided = new ArrayCallIn("[].toSorted((left, right) => left - right)")
  assert.ok(provided.staysHere)
  assert.deepEqual(provided.parameterKinds, [ null, null ])
})

test("reducers distinguish accumulator, item, and source array parameters", () => {
  const fixture = new ArrayCallIn("[].reduce((result, item, index, array) => result, null)")

  assert.ok(fixture.staysHere)
  assert.deepEqual(fixture.parameterKinds, [ null, null, "array" ])
  assert.deepEqual(fixture.resultKinds, [])
})

test("unseeded reducers keep their possible receiver element result", () => {
  const reduce = new ArrayCallIn("[].reduce((result, item) => result)")
  assert.ok(reduce.staysHere)
  assert.deepEqual(reduce.resultKinds, [ null ])

  const reduceRight = new ArrayCallIn("[].reduceRight((result, item) => result)")
  assert.ok(reduceRight.staysHere)
  assert.deepEqual(reduceRight.resultKinds, [ null ])

  const spreadInitial = new ArrayCallIn("[].reduce((result, item) => result, ...initial)")
  assert.ok(spreadInitial.staysHere)
  assert.deepEqual(spreadInitial.resultKinds, [ null ])
})

test("container, item, and consuming results carry the expected evidence", () => {
  const container = new ArrayCallIn("[].slice()")
  assert.ok(container.staysHere)
  assert.deepEqual(container.resultKinds, [ "array" ])

  const item = new ArrayCallIn("[].pop()")
  assert.ok(item.staysHere)
  assert.deepEqual(item.resultKinds, [ null ])

  assert.ok(new ArrayCallIn("[].some(() => true)").staysHere)
})

test("unknown methods and rejected flow facts do not keep a value confined", () => {
  assert.ok(!new ArrayCallIn("[][method]()").staysHere)
  assert.ok(!new ArrayCallIn("[].unknown()").staysHere)
  assert.ok(!new ArrayCallIn("class C { #map() {} run() { return this.#map((item) => item) } }").staysHere)
  assert.ok(!new ArrayCallIn("[].filter((item) => item)", { keepsParameter: false }).staysHere)
  assert.ok(!new ArrayCallIn("[].slice()", { keepsResult: false }).staysHere)
})

class ArrayCallIn {
  #call
  #flow

  constructor(code, options = {}) {
    const parsed = new ParsedCode(code)
    this.#call = parsed.firstNodeOfType("CallExpression")
    this.#flow = new RecordingFlow(parsed.sourceCode, options)
  }

  get staysHere() {
    return new ArrayCall(this.#call, this.#flow).staysHere
  }

  get parameterKinds() {
    return this.#flow.parameterKinds
  }

  get resultKinds() {
    return this.#flow.resultKinds
  }
}

class RecordingFlow {
  parameterKinds = []
  resultKinds = []

  #bindings
  #keepsParameter
  #keepsResult

  constructor(sourceCode, { keepsParameter = true, keepsResult = true }) {
    this.sourceCode = sourceCode
    this.#bindings = BindingResolver.for(sourceCode)
    this.#keepsParameter = keepsParameter
    this.#keepsResult = keepsResult
  }

  functionFor(identifier) {
    return this.#bindings.functionFor(identifier)
  }

  keepsParameter(_callback, { containerKind }) {
    this.parameterKinds.push(containerKind)
    return this.#keepsParameter
  }

  keepsResult(_call, containerKind) {
    this.resultKinds.push(containerKind)
    return this.#keepsResult
  }
}
