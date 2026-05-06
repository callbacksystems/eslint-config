import assert from "node:assert/strict"
import { test } from "node:test"
import { NearestAncestor } from "#helpers/syntax/nearest_ancestor"

test("of includes the node and compresses shared paths", () => {
  const fixture = new MatchingFixture()

  assert.equal(fixture.ancestors.of(fixture.wanted), fixture.wanted)
  assert.equal(fixture.ancestors.of(fixture.first), fixture.wanted)
  assert.equal(fixture.ancestors.of(fixture.second), fixture.wanted)
  assert.equal(fixture.inspections, 4)
})

test("above excludes the node and caches a missing ancestor", () => {
  const fixture = new MissingFixture()

  assert.equal(fixture.ancestors.above(fixture.child), null)
  assert.equal(fixture.ancestors.of(fixture.child), null)
  assert.equal(fixture.ancestors.above(null), null)
  assert.equal(fixture.inspections, 2)
})

class MatchingFixture {
  inspections = 0

  constructor() {
    const root = { kind: "root", parent: null }
    this.wanted = { kind: "wanted", parent: root }
    const branch = { kind: "branch", parent: this.wanted }
    this.first = { kind: "leaf", parent: branch }
    this.second = { kind: "leaf", parent: branch }
    this.ancestors = new NearestAncestor((node) => this.#matches(node))
  }

  #matches(node) {
    this.inspections += 1
    return node.kind === "wanted"
  }
}

class MissingFixture {
  inspections = 0

  constructor() {
    this.child = { parent: { parent: null } }
    this.ancestors = new NearestAncestor(() => this.#isMissing)
  }

  get #isMissing() {
    this.inspections += 1
    return false
  }
}
