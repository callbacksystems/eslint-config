import assert from "node:assert/strict"
import { test } from "node:test"
import {
  booleanOperandsOf, childNodesOf, isProvablyBoolean, isResourceDeclaration, nodesIn,
  statementInsideLabels, stringValuesOf
} from "#helpers/syntax/ast"
import { dedent, ParsedCode } from "#support"

test("isProvablyBoolean accepts a boolean literal and a negation", () => {
  assert.ok(isProvablyBoolean(expressionIn("true")))
  assert.ok(isProvablyBoolean(expressionIn("!ready")))
  assert.ok(!isProvablyBoolean(expressionIn("1")))
  assert.ok(!isProvablyBoolean(expressionIn("-count")))
})

test("isProvablyBoolean accepts a comparison and delegates call certainty", () => {
  const booleanCall = expressionIn("Boolean(value)")
  assert.ok(isProvablyBoolean(expressionIn("count > 1")))
  assert.ok(!isProvablyBoolean(booleanCall))
  assert.ok(isProvablyBoolean(booleanCall, { isBooleanCall: (node) => node === booleanCall }))
  assert.ok(!isProvablyBoolean(expressionIn("count + 1")))
  assert.ok(!isProvablyBoolean(expressionIn("String(value)")))
})

test("isProvablyBoolean accepts a logical or conditional expression whose branches all are", () => {
  assert.ok(isProvablyBoolean(expressionIn("count > 1 && !ready")))
  assert.ok(isProvablyBoolean(expressionIn("ready ? count > 1 : !done")))
  assert.ok(!isProvablyBoolean(expressionIn("ready && count")))
  assert.ok(!isProvablyBoolean(expressionIn("ready ? count : !done")))
})

test("isProvablyBoolean follows expressions that preserve their final value", () => {
  assert.ok(isProvablyBoolean(expressionIn("(sideEffect(), count > 1)")))
  assert.ok(isProvablyBoolean(expressionIn("ready = count > 1")))
  assert.ok(isProvablyBoolean(expressionIn("await (count > 1)")))
  assert.ok(!isProvablyBoolean(expressionIn("ready += count > 1")))
})

test("boolean operand decomposition preserves logical and conditional result operands", () => {
  const logical = expressionIn("left && right")
  const conditional = expressionIn("test ? yes : no")

  assert.deepEqual(booleanOperandsOf(logical), [ logical.left, logical.right ])
  assert.deepEqual(booleanOperandsOf(conditional), [ conditional.consequent, conditional.alternate ])
})

test("boolean operand decomposition preserves sequence and plain-assignment results", () => {
  const sequence = expressionIn("(effect(), result)")
  const assignment = expressionIn("target = result")

  assert.deepEqual(booleanOperandsOf(sequence), [ sequence.expressions.at(-1) ])
  assert.deepEqual(booleanOperandsOf(assignment), [ assignment.right ])
  assert.equal(booleanOperandsOf(expressionIn("target += result")), null)
  assert.equal(booleanOperandsOf(expressionIn("leaf")), null)
})

test("isProvablyBoolean rejects a bare reference and no node at all", () => {
  assert.ok(!isProvablyBoolean(expressionIn("ready")))
  assert.ok(!isProvablyBoolean(null))
})

test("isProvablyBoolean does not consume the call stack on deeply nested boolean expressions", () => {
  let expression = { type: "Literal", value: true }
  for (let depth = 0; depth < 20_000; depth += 1) {
    expression = { type: "LogicalExpression", left: expression, right: { type: "Literal", value: false } }
  }

  assert.ok(isProvablyBoolean(expression))
})

test("isResourceDeclaration recognizes both resource declaration kinds", () => {
  assert.ok(!isResourceDeclaration(new ParsedCode("const value = acquire()").firstNodeOfType("VariableDeclaration")))
  assert.ok(isResourceDeclaration(new ParsedCode("using value = acquire()").firstNodeOfType("VariableDeclaration")))
  const parsed = new ParsedCode("await using value = acquire()")
  assert.ok(isResourceDeclaration(parsed.firstNodeOfType("VariableDeclaration")))
})

test("AST traversal excludes tokens and comments attached by the parser", () => {
  const parsed = new ParsedCode("// reason\nconst result = source.value")

  assert.deepEqual(childNodesOf(parsed.sourceCode.ast).map(({ type }) => type), [ "VariableDeclaration" ])
  assert.equal(Array.from(nodesIn(parsed.sourceCode.ast)).length,
    parsed.nodesOfType("Program").length + parsed.nodesOfType("VariableDeclaration").length
    + parsed.nodesOfType("VariableDeclarator").length + parsed.nodesOfType("Identifier").length
    + parsed.nodesOfType("MemberExpression").length)
})

test("AST traversal does not consume the call stack on a deeply nested tree", () => {
  let root = { type: "Identifier" }
  for (let depth = 0; depth < 20_000; depth += 1) {
    const parent = { type: "UnaryExpression", argument: root }
    root.parent = parent
    root = parent
  }

  assert.equal(Array.from(nodesIn(root)).length, 20_001)
})

test("statementInsideLabels unwraps deeply nested labels iteratively", () => {
  const inner = { type: "ExpressionStatement" }
  let statement = inner
  for (let depth = 0; depth < 20_000; depth += 1) statement = { type: "LabeledStatement", body: statement }

  assert.equal(statementInsideLabels(statement), inner)
})

test("string values preserve the static fragments of interpolated templates", () => {
  assert.deepEqual(stringValuesOf(expressionIn(dedent`${"`"}first${"$"}{value}last${"`"}`)), [ "first", "last" ])
  assert.deepEqual(Array.from(nodesIn(null)), [])
})

function expressionIn(code) {
  return new ParsedCode(code).firstNodeOfType("ExpressionStatement").expression
}
