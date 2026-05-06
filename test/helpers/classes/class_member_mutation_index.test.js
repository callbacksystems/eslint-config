import assert from "node:assert/strict"
import { test } from "node:test"
import { ClassMemberMutationIndex } from "#helpers/classes/class_member_mutation_index"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { ParsedCode } from "#support"

test("class mutations follow prototype aliases and exact property identities", () => {
  [
    [ "const { prototype } = Subject; prototype.work = replacement", true ],
    [ "const { prototype: alias } = Subject; alias.work = replacement", true ],
    [ "const { prototype } = Subject; prototype.other = replacement", false ],
    [ "const { prototype } = Subject.prototype; prototype.work = replacement", false ],
    [ "const { other } = Subject; other.work = replacement", false ],
    [ "Subject.prototype.__proto__ = replacement", true ],
    [ "Subject.prototype[key] = replacement", true ],
    [ "Object.assign(Subject.prototype, { work: replacement })", true ],
    [ "Object.assign(Subject.prototype, source)", true ],
    [ "Subject.other.work = replacement", false ],
    [ "Subject.prototype.prototype.work = replacement", false ],
    [ "const alias = Subject?.prototype; alias.work = replacement", true ]
  ].forEach(([ mutation, expected ]) => {
    assert.equal(hasMutationIn(`class Subject { work() {} } ${mutation}; Subject.prototype.work()`), expected, mutation)
  })
})

test("class mutations preserve static, inherited, and temporal boundaries", () => {
  assert.ok(hasMutationIn("const Subject = class { static work() {} }; Subject.work = replacement; Subject.work()",
    { isStatic: true }))
  assert.ok(!hasMutationIn("class Subject { static work() {} }; Subject.work(); Subject.work = replacement",
    { isStatic: true }))
  assert.ok(hasMutationIn("class Base { work() {} }; class Subject extends Base {}; "
    + "Base.prototype.work = replacement; Subject.prototype.work()"))
  assert.ok(!hasMutationIn("class Subject extends (class {}) {}; Subject.prototype.work()"))
  assert.ok(!hasMutationIn("class Subject extends external.Base {}; Subject.prototype.work()"))
  assert.ok(hasMutationIn("class Subject {}; Subject.prototype[key] = replacement; Subject.prototype[key]()"))
})

test("class mutations include anonymous class expressions without a binding", () => {
  const parsed = new ParsedCode("Object.assign(class {}, { work: replacement }).work()")
  assert.ok(ClassMemberMutationIndex.for(parsed.sourceCode, BindingResolver.for(parsed.sourceCode))
    .hasBefore(parsed.sourceCode.ast.body[0].expression.callee,
      { classNode: parsed.firstNodeOfType("ClassExpression"), isStatic: true }))
})

function hasMutationIn(code, { isStatic = false } = {}) {
  const parsed = new ParsedCode(code)
  const classNode = parsed.nodesOfType("ClassDeclaration").find((node) => node.id.name === "Subject")
    ?? parsed.firstNodeOfType("ClassExpression")
  return ClassMemberMutationIndex.for(parsed.sourceCode, BindingResolver.for(parsed.sourceCode))
    .hasBefore(parsed.nodesOfType("CallExpression").at(-1).callee, { classNode, isStatic })
}
