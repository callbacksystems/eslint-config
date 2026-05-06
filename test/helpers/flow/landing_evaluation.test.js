import assert from "node:assert/strict"
import { test } from "node:test"
import { LandingEvaluation } from "#helpers/flow/landing_evaluation"

test("evaluates recursively scheduled facts without recursive descent", () => {
  const evaluation = new LandingEvaluation()
  const child = new LandingFact(true)
  const root = new LandingFact(true, { inspect: () => evaluation.keeps(child) })

  assert.ok(evaluation.keeps(root))
  assert.equal(root.inspections, 1)
  assert.equal(child.inspections, 1)
})

test("deduplicates matching states while preserving distinct container kinds", () => {
  const facts = new DeduplicatedLandingFacts()

  assert.ok(!facts.result)
  assert.equal(facts.arrayInspections, 1)
  assert.equal(facts.duplicateInspections, 0)
})

test("reuses a completed result for an already evaluated state", () => {
  const evaluation = new LandingEvaluation()
  const fact = new LandingFact(true)

  assert.ok(evaluation.keeps(fact))
  assert.ok(evaluation.keeps(fact))
  assert.equal(fact.inspections, 1)
})

class LandingFact {
  inspections = 0

  #result
  #inspect

  constructor(result, { node = {}, containerKind = null, inspect = null } = {}) {
    this.node = node
    this.containerKind = containerKind
    this.#result = result
    this.#inspect = inspect
  }

  get isImmediatelyKept() {
    this.inspections += 1
    this.#inspect?.()
    return this.#result
  }
}

class DeduplicatedLandingFacts {
  #evaluation = new LandingEvaluation()
  #array
  #duplicate
  #root

  constructor() {
    const node = {}
    this.#array = new LandingFact(false, { node, containerKind: "array" })
    this.#duplicate = new LandingFact(true, { node, containerKind: "array" })
    this.#root = new LandingFact(true, { node, inspect: () => this.#scheduleChildren() })
  }

  get result() {
    return this.#evaluation.keeps(this.#root)
  }

  get arrayInspections() {
    return this.#array.inspections
  }

  get duplicateInspections() {
    return this.#duplicate.inspections
  }

  #scheduleChildren() {
    this.#evaluation.keeps(this.#array)
    this.#evaluation.keeps(this.#duplicate)
  }
}
