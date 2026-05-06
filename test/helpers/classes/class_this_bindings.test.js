import assert from "node:assert/strict"
import { test } from "node:test"
import { ClassThisBindings } from "#helpers/classes/class_this_bindings"
import { ParsedCode } from "#support"

test("shares one class-this index between consumers of the same tree", () => {
  const parsed = new ParsedCode("class Entry { value() { return this } }")
  const classNode = parsed.firstNodeOfType("ClassDeclaration")
  const bindings = [ new ClassThisBindings(parsed.sourceCode.ast), new ClassThisBindings(parsed.sourceCode.ast) ]

  assert.equal(bindings[0].instanceClassOf(parsed.firstNodeOfType("ThisExpression")), classNode)
  assert.equal(bindings[1].instanceClassOf(parsed.firstNodeOfType("ThisExpression")), classNode)
  assert.equal(bindings[0].expressionsOf(classNode), bindings[1].expressionsOf(classNode))
})

test("classOf distinguishes class-bound this from a regular function's dynamic this", () => {
  const parsed = new ParsedCode(`
    class Entry {
      static inspect() { return this }
      inspect() { function nested() { return this }; return [ this, nested() ] }
    }
  `)
  const [ staticThis, dynamicThis, instanceThis ] = parsed.nodesOfType("ThisExpression")
  const bindings = new ClassThisBindings(parsed.sourceCode.ast)

  assert.equal(bindings.classOf(staticThis), parsed.firstNodeOfType("ClassDeclaration"))
  assert.equal(bindings.classOf(instanceThis), parsed.firstNodeOfType("ClassDeclaration"))
  assert.equal(bindings.classOf(dynamicThis), null)
})
