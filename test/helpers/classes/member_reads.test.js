import assert from "node:assert/strict"
import { test } from "node:test"
import { ModuleView } from "#helpers/flow/module_view"
import { ParsedCode } from "#support"

test("scopes named static receivers to their local inheritance family", () => {
  const reads = new StaticMemberReadCounts(`
    class First { static entry = source; static inspect() { return First.entry } }
    class Second { static entry = source; static inspect() { return Second.entry } }
  `)

  assert.deepEqual(reads.values, [ 1, 1 ])
})

test("resolves a stable class alias used as a static receiver", () => {
  const reads = new StaticMemberReadCounts(`
    class Box { static entry = source }
    class Other { static entry = source }
    const Alias = Box
    consume(Alias.entry)
  `)

  assert.deepEqual(reads.values, [ 1, 0 ])
})

test("indexes thousands of homonymous named static reads by class", () => {
  const count = 1_200
  assert.ok(new StaticMemberReadCounts(homonymousStaticReadsOf(count)).values
    .every((value) => value === 1))
})

test("static read indexes retain dynamic keys and uncertain inheritance", () => {
  assert.deepEqual(new StaticMemberReadCounts("class Box { static [key] = source; "
    + "static inspect() { return this[dynamic] } }").values, [ 1 ])
  assert.deepEqual(new StaticMemberReadCounts("class Box extends External { static entry = source; "
    + "static inspect() { return Box.entry } }").values, [ 1 ])
  assert.deepEqual(new StaticMemberReadCounts("class Box extends Other { static entry = source; "
    + "static inspect() { return Box.entry } }; class Other extends Box {}").values, [ 1 ])
})

class StaticMemberReadCounts {
  #fields
  #view

  constructor(code) {
    const parsed = new ParsedCode(code)
    this.#fields = parsed.nodesOfType("PropertyDefinition")
    this.#view = new ModuleView(parsed.sourceCode)
  }

  get values() {
    return this.#fields.map((field) => this.#view.memberReadsFor(field, {
      owner: field.parent.parent,
      isStatic: true
    }).length)
  }
}

function homonymousStaticReadsOf(count) {
  return Array.from({ length: count }, (_, index) =>
    `class Box${index} { static entry = source; static inspect() { return Box${index}.entry } }`).join(";")
}
