import assert from "node:assert/strict"
import { test } from "node:test"
import { MemberSubject } from "#helpers/classes/member_subject"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ParsedCode } from "#support"

test("a statically computed method keeps its semantic name and report node", () => {
  const method = new ParsedCode('class C { ["ready"]() { return true } }').firstNodeOfType("MethodDefinition")
  const subject = new MemberSubject(method)

  assert.equal(subject.name, "ready")
  assert.equal(subject.nameNode, method.key)
  assert.ok(subject.isEligible)
})

test("a static template field is eligible while a runtime-computed field is not", () => {
  const staticField = subjectIn("class C { [`ready`] = () => true }")
  const dynamicField = subjectIn("class C { [ready] = () => true }")

  assert.equal(staticField.name, "ready")
  assert.ok(staticField.isEligible)
  assert.equal(dynamicField.name, null)
  assert.equal(dynamicField.nameNode.name, "ready")
  assert.ok(!dynamicField.isEligible)
})

test("a stable constant-computed member is eligible when bindings are available", () => {
  const parsed = new ParsedCode("const key = 'ready'; class C { [key]() { return true } }")
  const subject = new MemberSubject(parsed.firstNodeOfType("MethodDefinition"), new BindingResolver(parsed.sourceCode))

  assert.equal(subject.name, "ready")
  assert.ok(subject.isEligible)
})

function subjectIn(code) {
  return new MemberSubject(new ParsedCode(code).firstNodeOfType("PropertyDefinition"))
}
