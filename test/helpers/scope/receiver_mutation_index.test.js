import assert from "node:assert/strict"
import { test } from "node:test"
import { ClassMemberResolver } from "#helpers/classes/class_member_resolver"
import { resolvedMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ReceiverMutationIndex } from "#helpers/scope/receiver_mutation_index"
import { ReceiverMembers } from "#helpers/scope/receiver_members"
import { ParsedCode } from "#support"

test("receiver mutations preserve well-known symbol identity", () => {
  const same = new ReceiverMutationFixture(
    "const items = []; items[Symbol.iterator] = custom; items[Symbol.iterator]()")
  const distinct = new ReceiverMutationFixture(
    "const items = []; items[Symbol.toStringTag] = custom; items[Symbol.iterator]()")

  assert.ok(same.hasMutationBefore(Symbol.iterator))
  assert.ok(!distinct.hasMutationBefore(Symbol.iterator))
})

test("receiver mutations become uncertain when Symbol provenance was replaced", () => {
  const direct = new ReceiverMutationFixture(
    "globalThis.Symbol = Fake; const items = []; items[Symbol.toStringTag] = custom; "
    + "items[Symbol.iterator]()")
  const defined = new ReceiverMutationFixture(
    "globalThis.Symbol = Fake; const items = []; "
    + "Object.defineProperty(items, Symbol.toStringTag, { value: custom }); items[Symbol.iterator]()")
  const assigned = new ReceiverMutationFixture(
    "globalThis.Symbol = Fake; const items = []; "
    + "Object.assign(items, { [Symbol.toStringTag]: custom }); items[Symbol.iterator]()")

  assert.ok(direct.hasMutationBefore(Symbol.iterator))
  assert.ok(defined.hasMutationBefore(Symbol.iterator))
  assert.ok(assigned.hasMutationBefore(Symbol.iterator))
})

test("indirect writes retain symbols captured before their global is replaced", () => {
  const defined = new ReceiverMutationFixture(
    "const tag = Symbol.toStringTag; globalThis.Symbol = Fake; const items = []; "
    + "Object.defineProperty(items, tag, { value: custom }); items[Symbol.iterator]()")
  const assigned = new ReceiverMutationFixture(
    "const tag = Symbol.toStringTag; globalThis.Symbol = Fake; const items = []; "
    + "Object.assign(items, { [tag]: custom }); items[Symbol.iterator]()")

  assert.ok(!defined.hasMutationBefore(Symbol.iterator))
  assert.ok(!assigned.hasMutationBefore(Symbol.iterator))
})

test("descriptor keys validate symbolic provenance", () => {
  const unknown = new ReceiverMutationFixture(
    "globalThis.Symbol = Fake; const items = {}; "
    + "Object.defineProperty(items, 'tag', { [Symbol.toStringTag]: custom }); items.tag()")
  const captured = new ReceiverMutationFixture(
    "const symbol = Symbol.toStringTag; globalThis.Symbol = Fake; const items = {}; "
    + "Object.defineProperty(items, 'tag', { [symbol]: custom }); items.tag()")

  assert.ok(unknown.hasMutationBefore("tag"))
  assert.ok(!captured.hasMutationBefore("tag"))
})

test("indirect and dynamic receiver writes retain their exact uncertainty", () => {
  const indirect = new ReceiverMutationFixture(
    "const items = []; Object.defineProperty(items, Symbol.iterator, { value: custom }); "
    + "items[Symbol.iterator]()")
  const dynamic = new ReceiverMutationFixture("const items = []; items[key] = custom; items[Symbol.iterator]()")

  assert.ok(indirect.hasMutationBefore(Symbol.iterator))
  assert.ok(dynamic.hasMutationBefore(Symbol.iterator))
})

test("receiver mutation positions distinguish writes before and after the read", () => {
  [
    [ "const items = []; items.work = replacement; items.work()", true ],
    [ "const items = []; items.work(); items.work = replacement", false ],
    [ "const items = []; items[key] = replacement; items.work()", true ],
    [ "const items = []; items.work(); items[key] = replacement", false ]
  ].forEach(([ code, expected ]) => {
    assert.equal(new ReceiverMutationFixture(code).hasMutationBefore("work"), expected)
  })
})

test("receiver mutation lookups do not rescan unrelated property writes", () => {
  const count = 1_000
  const fixture = new ReceiverMutationFixture(`const items = []; ${
    Array.from({ length: count }, (_value, index) => `items.write${index} = ${index}`).join("; ")
  }; items.done()`)

  assert.ok(Array.from({ length: count }, (_value, index) => `read${index}`)
    .every((name) => !fixture.hasMutationBefore(name)))
})

test("standard writes use a complete public property shape during callable analysis", () => {
  const object = new CallableMutationFixture(
    "const subject = { work() {} }; Object.defineProperty(subject, 'work', { value: replacement }); subject.work()")
  const classValue = new CallableMutationFixture(
    "class Subject { static work() {} }; "
    + "Object.defineProperty(Subject, 'work', { value: replacement }); Subject.work()")

  assert.ok(object.hasCallableMutation)
  assert.ok(classValue.hasCallableMutation)
})

test("receiver member lookup preserves symbols on fresh objects", () => {
  const fixture = new FreshObjectMemberFixture(
    "const subject = { [Symbol.iterator]() {}, [Symbol.toStringTag]() {} }; subject[Symbol.iterator]()")

  assert.equal(fixture.functionNode, fixture.expectedFunction)
})

test("safe object methods follow recursive dispatch but reject uncertain receiver uses", () => {
  [
    [ "({ work() { this.work() } })", true ],
    [ "({ work() { this.other() }, other() {} })", true ],
    [ "({ work() { this[key]() } })", false ],
    [ "({ work() { super.work() } })", false ],
    [ "({ work() { with (source) {} } })", false ],
    [ "({ work() { return this.value }, value: 1 })", true ],
    [ "({ work() { this.value = 2 }, value: 1 })", true ],
    [ "({ work() { this.other() }, other: external })", false ]
  ].forEach(([ code, expected ]) => assert.equal(new SafeObjectMethod(code).isSafe, expected, code))
})

class ReceiverMutationFixture {
  #bindings
  #index
  #parsed
  #reference
  #variable

  constructor(code) {
    this.#parsed = new ParsedCode(code)
    this.#bindings = BindingResolver.for(this.#parsed.sourceCode)
    this.#variable = this.#parsed.sourceCode.scopeManager.scopes
      .flatMap((scope) => scope.variables)
      .find((variable) => variable.name === "items")
    this.#reference = this.#variable.references.findLast((reference) => {
      const member = reference.identifier.parent
      return member?.type === "MemberExpression" && member.parent?.type === "CallExpression"
        && member.parent.callee === member
    })
    this.#index = new ReceiverMutationIndex([ this.#variable ], {
      bindings: this.#bindings,
      root: this.#parsed.sourceCode.ast,
      rootScope: this.#variable.scope
    })
  }

  hasMutationBefore(name) {
    return this.#index.hasPropertyMutationBefore({
      name, reference: this.#reference, target: this.#reference.identifier.parent
    })
  }
}

class CallableMutationFixture {
  #bindings
  #parsed
  #receiver
  #reference
  #variable

  constructor(code) {
    this.#parsed = new ParsedCode(code)
    this.#bindings = BindingResolver.for(this.#parsed.sourceCode)
    this.#variable = this.#parsed.sourceCode.scopeManager.scopes
      .flatMap((scope) => scope.variables)
      .find((variable) => [ "subject", "Subject" ].includes(variable.name))
    this.#reference = this.#variable.references.at(-1)
    const definition = this.#variable.defs[0]
    this.#receiver = definition.type === "Variable" ? definition.node.init : definition.node
  }

  get hasCallableMutation() {
    const resolver = new ClassMemberResolver(this.#bindings)
    const members = new ReceiverMembers(this.#bindings, (receiver, property, { before, kind }) =>
      resolver.ownResolutionFor(receiver, property, { before, kind, isStatic: true }))
    return new ReceiverMutationIndex([ this.#variable ], {
      bindings: this.#bindings,
      root: this.#parsed.sourceCode.ast,
      rootScope: this.#variable.scope
    }).hasCallableBefore({
      members,
      receiver: this.#receiver,
      reference: this.#reference,
      target: this.#reference.identifier.parent
    })
  }
}

class FreshObjectMemberFixture {
  #bindings
  #parsed

  constructor(code) {
    this.#parsed = new ParsedCode(code)
    this.#bindings = BindingResolver.for(this.#parsed.sourceCode)
  }

  get functionNode() {
    return new ReceiverMembers(this.#bindings, () => null).functionAt({
      property: resolvedMemberKeyOf(this.#member, this.#bindings), receiver: this.#receiver
    })
  }

  get expectedFunction() {
    return this.#parsed.firstNodeOfType("Property").value
  }

  get #member() {
    return this.#parsed.nodesOfType("MemberExpression")
      .findLast((candidate) => candidate.object.type === "Identifier" && candidate.object.name === "subject")
  }

  get #receiver() {
    return this.#parsed.firstNodeOfType("ObjectExpression")
  }
}

class SafeObjectMethod {
  #bindings
  #members
  #receiver

  constructor(code) {
    const parsed = new ParsedCode(code, { sourceType: "script" })
    this.#bindings = BindingResolver.for(parsed.sourceCode)
    this.#receiver = parsed.firstNodeOfType("ObjectExpression")
    this.#members = new ReceiverMembers(this.#bindings, () => null)
  }

  get isSafe() {
    return Boolean(this.#members.safeFunctionAt({
      receiver: this.#receiver, property: resolvedMemberKeyOf(this.#receiver.properties[0], this.#bindings)
    }))
  }
}
