import assert from "node:assert/strict"
import { test } from "node:test"
import { ClassMemberResolver } from "#helpers/classes/class_member_resolver"
import { resolvedMemberKeyOf } from "#helpers/classes/resolved_member_key"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ParsedCode } from "#support"

test("class member resolution rejects dynamic definitions and lookups", () => {
  [
    "class Subject { static [key]() {} }; Subject.work()",
    "class Subject { static work() {} }; Subject[key]()",
    "globalThis.Symbol = Fake; class Subject { static [Symbol.iterator]() {} }; Subject[Symbol.iterator]()"
  ].forEach((code) => {
    const resolution = new MemberResolutionIn(code)
    assert.ok(resolution.own.isUnknown, code)
    assert.ok(resolution.inherited.isUnknown, code)
  })
})

class MemberResolutionIn {
  #bindings
  #parsed
  #resolver

  constructor(code) {
    this.#parsed = new ParsedCode(code)
    this.#bindings = new BindingResolver(this.#parsed.sourceCode)
    this.#resolver = new ClassMemberResolver(this.#bindings)
  }

  get own() {
    return this.#resolver.ownResolutionFor(this.#class, this.#property, { isStatic: true, kind: "function" })
  }

  get inherited() {
    return this.#resolver.resolutionInHierarchy(this.#class, this.#property,
      { isStatic: true, kind: "function", superclassOf: () => null })
  }

  get #class() {
    return this.#parsed.firstNodeOfType("ClassDeclaration")
  }

  get #property() {
    return resolvedMemberKeyOf(this.#parsed.sourceCode.ast.body.at(-1).expression.callee, this.#bindings)
  }
}
