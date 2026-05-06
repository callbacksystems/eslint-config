import assert from "node:assert/strict"
import { test } from "node:test"
import { nodesIn } from "#helpers/syntax/ast"
import { RecordHomes } from "#helpers/classes/record_homes"
import { ParsedCode } from "#support"

test("member homes preserve runtime property identity", () => {
  const subject = new MemberHomeIdentities()

  assert.equal(subject.homeFor("privateField"), subject.homeFor("privateRead"))
  assert.equal(subject.homeFor("publicField"), subject.homeFor("publicRead"))
  assert.notEqual(subject.homeFor("privateField"), subject.homeFor("publicField"))
  assert.equal(subject.homeFor("identifierField"), subject.homeFor("literalRead"))
  assert.equal(subject.homeFor("emptyField"), subject.homeFor("emptyRead"))
  assert.equal(subject.homeFor("iteratorField"), subject.homeFor("iteratorRead"))
  assert.notEqual(subject.homeFor("iteratorField"), subject.homeFor("tagField"))
  assert.notEqual(subject.homeFor("iteratorField"), subject.homeFor("symbolTextField"))
})

test("member homes reject dynamic keys and receivers outside a class", () => {
  assert.equal(new RecordHomeFixture("class Box { [key] = source }").memberHome, null)
  assert.equal(new RecordHomeFixture("target.entry").memberHome, null)
})

test("function results reject assignment to a foreign member", () => {
  assert.equal(new RecordHomeFixture("target.make = function () {}").functionResult, null)
})

class MemberHomeIdentities {
  #homes
  #nodes

  constructor() {
    const parsed = new ParsedCode(`
      class Box {
        #entry = source;
        ["#entry"] = source;
        entry = source;
        [""] = source;
        [Symbol.iterator] = source;
        [Symbol.toStringTag] = source;
        ["Symbol(Symbol.iterator)"] = source;
        inspect() { return [ this.#entry, this["#entry"], this["entry"], this[""],
          this[Symbol.iterator], this[Symbol.toStringTag], this["Symbol(Symbol.iterator)"] ] }
      }
    `)
    this.#homes = new RecordHomes(parsed.sourceCode, Array.from(nodesIn(parsed.sourceCode.ast)))
    this.#nodes = memberNodesIn(parsed)
  }

  homeFor(label) {
    return this.#homes.memberFor(this.#nodes.get(label))
  }
}

function memberNodesIn(parsed) {
  const fields = parsed.nodesOfType("PropertyDefinition")
  const reads = parsed.nodesOfType("MemberExpression")
    .filter((member) => member.object.type === "ThisExpression")
  return new Map([
    [ "privateField", fields[0] ], [ "publicField", fields[1] ],
    [ "identifierField", fields[2] ], [ "emptyField", fields[3] ],
    [ "iteratorField", fields[4] ], [ "tagField", fields[5] ],
    [ "symbolTextField", fields[6] ], [ "privateRead", reads[0] ],
    [ "publicRead", reads[1] ], [ "literalRead", reads[2] ],
    [ "emptyRead", reads[3] ], [ "iteratorRead", reads[4] ]
  ])
}

class RecordHomeFixture {
  #homes
  #parsed

  constructor(code) {
    this.#parsed = new ParsedCode(code)
    this.#homes = new RecordHomes(this.#parsed.sourceCode, Array.from(nodesIn(this.#parsed.sourceCode.ast)))
  }

  get memberHome() {
    const member = this.#parsed.firstNodeOfType("PropertyDefinition")
      ?? this.#parsed.firstNodeOfType("MemberExpression")
    return this.#homes.memberFor(member)
  }

  get functionResult() {
    return this.#homes.resultOf(this.#parsed.firstNodeOfType("FunctionExpression"))
  }
}
