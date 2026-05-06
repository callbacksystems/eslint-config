import assert from "node:assert/strict"
import { test } from "node:test"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ModuleView } from "#helpers/flow/module_view"
import { PrivateMemberIntrospection } from "#helpers/classes/private_member_introspection"
import { ParsedCode } from "#support"

test("dynamic access and deletion preserve public member semantics", () => {
  const dynamic = new IntrospectionIn("inspect(name) { return this[name] }")
  assert.ok(dynamic.readsMethod("anything"))

  const deleted = new IntrospectionIn("clear() { return delete this.value }")
  assert.ok(deleted.readsMethod("value"))
  assert.ok(!deleted.readsMethod("other"))

  const optionalDelete = new IntrospectionIn("clear() { return delete this?.value }")
  assert.ok(optionalDelete.readsMethod("value"))
})

test("receiver reflection distinguishes own fields from prototype methods", () => {
  const own = new IntrospectionIn('inspect() { return this.hasOwnProperty("value") }')
  assert.ok(own.readsField("value"))
  assert.ok(!own.readsMethod("value"))
  assert.ok(!own.readsField("other"))

  const inherited = new IntrospectionIn('inspect() { return this.__lookupGetter__("value") }')
  assert.ok(inherited.readsField("value"))
  assert.ok(inherited.readsMethod("value"))
})

test("the `in` operator distinguishes named and dynamic observations", () => {
  const named = new IntrospectionIn('inspect() { return "value" in this }')
  assert.ok(named.readsMethod("value"))
  assert.ok(!named.readsMethod("other"))

  const dynamic = new IntrospectionIn("inspect(name) { return name in this }")
  assert.ok(dynamic.readsMethod("anything"))
})

test("language enumeration observes fields without exposing prototype methods", () => {
  const enumeration = new IntrospectionIn("inspect() { for (const name in this) consume(name) }")
  assert.ok(enumeration.readsField("value"))
  assert.ok(!enumeration.readsMethod("value"))

  const spread = new IntrospectionIn("inspect() { return { ...this } }")
  assert.ok(spread.readsField("value"))
  assert.ok(!spread.readsMethod("value"))

  const arraySpread = new IntrospectionIn("inspect() { return [ ...this ] }")
  assert.ok(!arraySpread.readsField("value"))
  assert.ok(!arraySpread.readsMethod("value"))
})

test("named global reflection calls retain their exact own or inherited scope", () => {
  const ownNamed = new IntrospectionIn('inspect() { return Object.hasOwn(this, "value") }')
  assert.ok(ownNamed.readsField("value"))
  assert.ok(!ownNamed.readsMethod("value"))

  const allNamed = new IntrospectionIn('inspect() { return Reflect.get(this, "value") }')
  assert.ok(allNamed.readsMethod("value"))
  assert.ok(!allNamed.readsMethod("other"))

  const missingName = new IntrospectionIn("inspect() { return Object.hasOwn(this) }")
  assert.ok(missingName.readsField("undefined"))
  assert.ok(!missingName.readsField("other"))
})

test("global enumeration distinguishes fields from prototype members", () => {
  const ownEnumeration = new IntrospectionIn("inspect() { return Object.keys(this) }")
  assert.ok(ownEnumeration.readsField("anything"))
  assert.ok(!ownEnumeration.readsMethod("anything"))

  const allIntrospection = new IntrospectionIn("inspect() { return Object.getPrototypeOf(this) }")
  assert.ok(allIntrospection.readsMethod("anything"))
})

test("Object.assign treats the target as inherited access and sources as own enumeration", () => {
  const target = new IntrospectionIn("inspect(source) { return Object.assign(this, source) }")
  assert.ok(target.readsMethod("anything"))

  const source = new IntrospectionIn("inspect(target) { return Object.assign(target, this) }")
  assert.ok(source.readsField("anything"))
  assert.ok(!source.readsMethod("anything"))
})

test("unknown names are conservative while shadowed globals and rebound this are ignored", () => {
  const spreadName = new IntrospectionIn("inspect(names) { return Object.hasOwn(this, ...names) }")
  assert.ok(spreadName.readsField("anything"))

  const shadowed = new IntrospectionIn('inspect(Object) { return Object.hasOwn(this, "value") }')
  assert.ok(!shadowed.readsField("value"))

  const rebound = new IntrospectionIn("inspect() { return function () { return this[name] } }")
  assert.ok(!rebound.readsMethod("anything"))
})

test("an ordinary comparison does not introspect this", () => {
  assert.ok(!new IntrospectionIn("inspect(other) { return this === other }").readsMethod("anything"))
})

class IntrospectionIn {
  #value

  constructor(memberSource) {
    const parsed = new ParsedCode(`class Subject { ${memberSource} }`)
    const classNode = parsed.firstNodeOfType("ClassDeclaration")
    const view = new ModuleView(parsed.sourceCode)
    this.#value = new PrivateMemberIntrospection(view.thisExpressionsOf(classNode), {
      view, classNode, bindings: BindingResolver.for(parsed.sourceCode)
    })
  }

  readsField(name) {
    return this.#value.reads(name, { hasOwnDefinition: true })
  }

  readsMethod(name) {
    return this.#value.reads(name, { hasOwnDefinition: false })
  }
}
