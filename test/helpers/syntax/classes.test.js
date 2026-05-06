import assert from "node:assert/strict"
import { test } from "node:test"
import {
  boundThisMemberKeyOf, calleeMemberName, classDeclaringPrivate, classElementHolding, enclosingClass, isAccessor,
  isClassMember, isClassNode, isInstanceContext, isLexicalThisOf, memberName, privateNamesIn, propertyNameOf,
  staticAccessKeyOf, staticMemberKeyOf, thisMemberKeyOf
} from "#helpers/syntax/classes"
import { ParsedCode } from "#support"

test("enclosingClass is null outside any class", () => {
  const functionNode = new ParsedCode("function clear() {}").firstNodeOfType("FunctionDeclaration")
  assert.equal(enclosingClass(functionNode), null)
  assert.equal(classElementHolding(functionNode), null)
  assert.equal(classDeclaringPrivate(functionNode), null)
})

test("lexical this follows heritage and computed keys but stops at field values", () => {
  const parsed = new ParsedCode(
    "function outer() { return class extends this.Base { [this.key]() {}; field = this.value } }"
  )
  const functionNode = parsed.firstNodeOfType("FunctionDeclaration")
  const values = parsed.nodesOfType("ThisExpression")

  assert.equal(isLexicalThisOf(values[0], functionNode), true)
  assert.equal(isLexicalThisOf(values[1], functionNode), true)
  assert.equal(isLexicalThisOf(values[2], functionNode), false)
  assert.equal(isLexicalThisOf(new ParsedCode("this").firstNodeOfType("ThisExpression"), functionNode), false)
})

test("class node and member predicates share the exact ESTree taxonomies", () => {
  assert.ok(isClassNode({ type: "ClassDeclaration" }))
  assert.ok(isClassNode({ type: "ClassExpression" }))
  assert.ok(isClassMember({ type: "MethodDefinition" }))
  assert.ok(isClassMember({ type: "PropertyDefinition" }))
  assert.ok(!isClassNode(null))
  assert.ok(!isClassMember({ type: "Property" }))
})

test("isAccessor recognizes only getter and setter kinds", () => {
  assert.ok(isAccessor({ kind: "get" }))
  assert.ok(isAccessor({ kind: "set" }))
  assert.ok(!isAccessor({ kind: "method" }))
})

test("isInstanceContext recognizes syntax tied to a class instance", () => {
  assert.ok(isInstanceContext({ type: "PrivateIdentifier" }))
  assert.ok(isInstanceContext({ type: "Super" }))
  assert.ok(isInstanceContext({ type: "ThisExpression" }))
  assert.ok(!isInstanceContext({ type: "Identifier" }))
})

test("staticMemberKeyOf distinguishes static spellings from a runtime-computed key", () => {
  assert.deepEqual(keyIn("class C { ready() {} }"), { name: "ready", type: "Identifier" })
  assert.deepEqual(keyIn("class C { #ready() {} }"), { name: "ready", type: "PrivateIdentifier" })
  assert.deepEqual(keyIn('class C { ["ready"]() {} }'), { name: "ready", type: "Literal" })
  assert.deepEqual(keyIn("class C { [`ready`]() {} }"), { name: "ready", type: "TemplateLiteral" })
  assert.deepEqual(keyIn('class C { [""]() {} }'), { name: "", type: "Literal" })
  assert.equal(keyIn("class C { [ready]() {} }"), null)
  assert.equal(keyIn("class C { [/ready/]() {} }"), null)
})

test("memberName preserves private syntax and reads quoted static names", () => {
  assert.equal(memberName(new ParsedCode("class C { #ready() {} }").firstNodeOfType("MethodDefinition")), "#ready")
  assert.equal(memberName(new ParsedCode('class C { ["ready"]() {} }').firstNodeOfType("MethodDefinition")), "ready")
  assert.equal(memberName(new ParsedCode('class C { [""]() {} }').firstNodeOfType("MethodDefinition")), "")
})

test("propertyNameOf reads statically known properties without mistaking expressions for names", () => {
  assert.equal(propertyNameOf(new ParsedCode("this.reset()").firstNodeOfType("MemberExpression")), "reset")
  assert.equal(propertyNameOf(new ParsedCode("this[\"reset\"]()").firstNodeOfType("MemberExpression")), "reset")
  assert.equal(propertyNameOf(new ParsedCode("this[`reset`]()").firstNodeOfType("MemberExpression")), "reset")
  assert.equal(propertyNameOf(new ParsedCode("this[reset]()").firstNodeOfType("MemberExpression")), "")
})

test("calleeMemberName preserves private syntax for API-name comparisons", () => {
  const call = new ParsedCode("class C { #bind() {} run() { this.reset.#bind(this) } }")
    .firstNodeOfType("CallExpression")

  assert.equal(calleeMemberName(call.callee), "#bind")
  assert.equal(boundThisMemberKeyOf(call), null)
})

test("privateNamesIn caches the direct declarations of a class", () => {
  const classNode = new ParsedCode("class Entry { #value; #read() {}; public() {} }")
    .firstNodeOfType("ClassDeclaration")
  const names = privateNamesIn(classNode)

  assert.deepEqual([ ...names ], [ "value", "read" ])
  assert.equal(privateNamesIn(classNode), names)
})

test("staticAccessKeyOf accepts only member accesses with statically known keys", () => {
  assert.equal(staticAccessKeyOf(memberIn('subject["ready"]')).name, "ready")
  assert.equal(staticAccessKeyOf(memberIn("subject[ready]")), null)
  assert.equal(staticAccessKeyOf(null), null)
})

test("this member helpers accept only direct, static, non-optional bind calls", () => {
  assert.equal(thisNameIn("this.reset"), "reset")
  assert.equal(thisNameIn('this["reset"]'), "reset")
  assert.equal(thisNameIn('this[""]'), "")
  assert.equal(thisNameIn("this[reset]"), null)
  assert.equal(boundNameIn("this.reset.bind(this)"), "reset")
  assert.equal(boundNameIn('this["reset"]["bind"](this)'), "reset")
  assert.equal(boundNameIn('this[""].bind(this)'), "")
  assert.equal(boundNameIn("this.reset.bind(other)"), null)
  assert.equal(boundNameIn("this[reset].bind(this)"), null)
})

test("this member helpers reject another receiver and optional access", () => {
  assert.equal(thisMemberKeyOf(memberIn("other.reset")), null)
  assert.equal(thisMemberKeyOf(new ParsedCode("this?.reset").firstNodeOfType("MemberExpression")), null)
})

function keyIn(code) {
  const key = staticMemberKeyOf(new ParsedCode(code).firstNodeOfType("MethodDefinition"))
  return key ? { name: key.name, type: key.node.type } : null
}

function memberIn(code) {
  return new ParsedCode(code).firstNodeOfType("ExpressionStatement").expression
}

function thisNameIn(code) {
  return nameOf(thisMemberKeyOf(memberIn(code)))
}

function nameOf(key) {
  return key?.name ?? null
}

function boundNameIn(code) {
  return nameOf(boundThisMemberKeyOf(memberIn(code)))
}
