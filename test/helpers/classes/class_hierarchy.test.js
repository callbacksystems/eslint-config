import assert from "node:assert/strict"
import { test } from "node:test"
import { ClassHierarchy } from "#helpers/classes/class_hierarchy"
import { ParsedCode } from "#support"

test("indexes identifier and inline class inheritance as local trees", () => {
  const parsed = new ParsedCode(`
    const Base = class NamedBase {}
    class Child extends Base {}
    class InlineChild extends class InlineBase {} {}
  `)
  const classes = classesByNameIn(parsed)
  const hierarchy = new ClassHierarchy(parsed.sourceCode)

  assert.equal(hierarchy.parentOf(classes.get("Child")), classes.get("NamedBase"))
  assert.deepEqual(hierarchy.ancestorsOf(classes.get("Child")), [ classes.get("NamedBase") ])
  assert.deepEqual(hierarchy.childrenOf(classes.get("NamedBase")), [ classes.get("Child") ])
  assert.deepEqual(hierarchy.rangeOf(classes.get("NamedBase")), { start: 0, end: 2 })
  assert.equal(hierarchy.parentOf(classes.get("InlineChild")), classes.get("InlineBase"))
})

test("marks an external inheritance branch and all its descendants ambiguous", () => {
  const parsed = new ParsedCode(`
    class ExternalChild extends FrameworkBase {}
    class Descendant extends ExternalChild {}
    class Safe {}
  `)
  const classes = classesByNameIn(parsed)
  const hierarchy = new ClassHierarchy(parsed.sourceCode)

  assert.ok(hierarchy.isAmbiguous(classes.get("ExternalChild")))
  assert.ok(hierarchy.isAmbiguous(classes.get("Descendant")))
  assert.equal(hierarchy.rangeOf(classes.get("Descendant")), null)
  assert.ok(!hierarchy.isAmbiguous(classes.get("Safe")))
})

test("terminates ancestor traversal for a cyclic inheritance graph", () => {
  const parsed = new ParsedCode("class Left extends Right {}; class Right extends Left {}")
  const classes = classesByNameIn(parsed)
  const hierarchy = new ClassHierarchy(parsed.sourceCode)

  assert.ok(hierarchy.isAmbiguous(classes.get("Left")))
  assert.ok(hierarchy.isAmbiguous(classes.get("Right")))
  assert.deepEqual(hierarchy.ancestorsOf(classes.get("Left")), [ classes.get("Right") ])
  assert.deepEqual(hierarchy.ancestorsOf(classes.get("Right")), [ classes.get("Left") ])
})

test("propagates ambiguity through a cycle without affecting a separate local tree", () => {
  const parsed = new ParsedCode(`
    class Left extends Right {}
    class Right extends Left {}
    class Descendant extends Left {}
    class Root {}
    class Child extends Root {}
  `)
  const classes = classesByNameIn(parsed)
  const hierarchy = new ClassHierarchy(parsed.sourceCode)

  assert.ok(hierarchy.isAmbiguous(classes.get("Descendant")))
  assert.ok(hierarchy.isAmbiguous(null))
  assert.equal(hierarchy.rangeOf(classes.get("Descendant")), null)
  assert.ok(!hierarchy.isAmbiguous(classes.get("Child")))
  assert.deepEqual(hierarchy.rangeOf(classes.get("Root")), { start: 0, end: 2 })
})

function classesByNameIn(parsed) {
  return new Map([ ...parsed.nodesOfType("ClassDeclaration"), ...parsed.nodesOfType("ClassExpression") ]
    .map((classNode) => [ classNode.id.name, classNode ]))
}
