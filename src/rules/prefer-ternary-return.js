// When two consecutive returns both produce values, the function is
// computing one of two outcomes; express it as a single expression. Skipped
// for chained guards where the same pattern is the natural happy-path style,
// and for returns of multi-line expressions or non-trivial object/array
// literals where a ternary would hurt readability.

import { innerStatementOf, isIfWithoutAlternate, isReturnWithValue, negated, operandText } from "#helpers/ast"
import { reportProblem } from "#helpers/report"

const TERNARY_CONDITION_PARENS = new Set([
  "ArrowFunctionExpression", "AssignmentExpression", "ConditionalExpression", "SequenceExpression", "YieldExpression"
])
const LOGICAL_OPERAND_PARENS = new Set([
  "ArrowFunctionExpression", "AssignmentExpression", "ConditionalExpression",
  "LogicalExpression", "SequenceExpression", "YieldExpression"
])
const SEQUENCE_PARENS = new Set([ "SequenceExpression" ])

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Prefer a single return expression over `if (condition) return X; return Y`" },
    schema: [],
    messages: { preferTernaryReturn: "Replace `if (condition) return X; return Y` with {{suggestion}}." }
  },
  create(context) {
    return { BlockStatement: (node) => reportProblem(context, new TailReturns(node.body, context.sourceCode)) }
  }
}

class TailReturns {
  #body
  #sourceCode

  constructor(body, sourceCode) {
    this.#body = body
    this.#sourceCode = sourceCode
  }

  get problem() {
    if (this.#isReportable) {
      return {
        node: this.#ifStatement,
        messageId: "preferTernaryReturn",
        data: { suggestion: this.#suggestion },
        fix: this.#fix
      }
    } else {
      return null
    }
  }

  get #isReportable() {
    return this.#matchesPattern && fitsInTernary(this.#consequentValue) && fitsInTernary(this.#fallbackValue)
  }

  get #matchesPattern() {
    return this.#body.length >= 2
      && isReturnWithValue(this.#lastReturn)
      && isIfReturnWithoutAlternate(this.#ifStatement)
      && !isIfReturnWithoutAlternate(this.#body.at(-3))
  }

  get #lastReturn() {
    return this.#body.at(-1)
  }

  get #ifStatement() {
    return this.#body.at(-2)
  }

  get #consequentValue() {
    return returnArgumentOf(this.#ifStatement.consequent)
  }

  get #fallbackValue() {
    return this.#lastReturn.argument
  }

  get #suggestion() {
    if (this.#returnsFalse) return "`return !condition && Y`"
    if (this.#returnsTrue) return "`return condition || Y`"
    return "`return condition ? X : Y`"
  }

  get #returnsFalse() {
    return isFalseLiteral(this.#consequentValue)
  }

  get #returnsTrue() {
    return isTrueLiteral(this.#consequentValue)
  }

  get #fix() {
    const range = [ this.#ifStatement.range[0], this.#lastReturn.range[1] ]
    return (fixer) => fixer.replaceTextRange(range, this.#replacement)
  }

  get #replacement() {
    if (this.#returnsFalse) return `return ${this.#negatedTest} && ${this.#fallbackOperand}`
    if (this.#returnsTrue) return `return ${this.#testOperand} || ${this.#fallbackOperand}`
    return `return ${this.#ternaryTest} ? ${this.#ternaryConsequent} : ${this.#ternaryFallback}`
  }

  get #negatedTest() {
    return negated(this.#sourceCode, this.#ifStatement.test)
  }

  get #fallbackOperand() {
    return operandText(this.#sourceCode, this.#fallbackValue, LOGICAL_OPERAND_PARENS)
  }

  get #testOperand() {
    return operandText(this.#sourceCode, this.#ifStatement.test, LOGICAL_OPERAND_PARENS)
  }

  get #ternaryTest() {
    return operandText(this.#sourceCode, this.#ifStatement.test, TERNARY_CONDITION_PARENS)
  }

  get #ternaryConsequent() {
    return operandText(this.#sourceCode, this.#consequentValue, SEQUENCE_PARENS)
  }

  get #ternaryFallback() {
    return operandText(this.#sourceCode, this.#fallbackValue, SEQUENCE_PARENS)
  }
}

function fitsInTernary(argument) {
  return Boolean(argument) && !isMultiLine(argument) && !isComplexLiteral(argument)
}

function isMultiLine(node) {
  return node.loc.start.line !== node.loc.end.line
}

function isComplexLiteral(node) {
  return (node.type === "ObjectExpression" && node.properties.length > 1)
    || (node.type === "ArrayExpression" && node.elements.length > 1)
}

function isIfReturnWithoutAlternate(node) {
  return isIfWithoutAlternate(node) && Boolean(returnArgumentOf(node.consequent))
}

function returnArgumentOf(consequent) {
  const inner = innerStatementOf(consequent)
  return inner?.type === "ReturnStatement" ? inner.argument : undefined
}

function isFalseLiteral(node) {
  return node && node.type === "Literal" && node.value === false
}

function isTrueLiteral(node) {
  return node && node.type === "Literal" && node.value === true
}
