// When two consecutive returns both produce values, the function is computing one of two outcomes; express it as a
// single expression. Skipped for chained guards where the same pattern is the natural happy-path style, and for returns
// of multi-line expressions or non-trivial object/array literals where a ternary would hurt readability.

import { isProvablyBoolean, isSingleLine } from "#helpers/syntax/ast"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { hasToolDirectiveIn } from "#helpers/source/comment_directives"
import { innerStatementOf, isIfWithoutAlternate, isReturnWithValue } from "#helpers/syntax/functions"
import { isGlobalBooleanCallee } from "#helpers/functions/global_boolean_callee"
import { commentPreservingReplacementFix, conditionSource, negated, operandText } from "#helpers/source/source"
import { reportProblem } from "#helpers/eslint/report"

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
    const bindings = new BindingResolver(context.sourceCode)
    return {
      BlockStatement: (node) => reportProblem(context, new TailReturns(node.body, context.sourceCode, bindings))
    }
  }
}

class TailReturns {
  #body
  #sourceCode
  #bindings

  constructor(body, sourceCode, bindings) {
    this.#body = body
    this.#sourceCode = sourceCode
    this.#bindings = bindings
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
    return this.#matchesPattern && this.#valuesFit && !this.#buildsNestedTernary
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

  get #valuesFit() {
    return new Value(this.#consequentValue).fitsInTernary && new Value(this.#fallbackValue).fitsInTernary
  }

  get #consequentValue() {
    return returnArgumentOf(this.#ifStatement.consequent)
  }

  get #fallbackValue() {
    return this.#lastReturn.argument
  }

  // A ternary branch that is itself a ternary reads worse than the two returns it replaced, and
  // `sonarjs/no-nested-conditional` rejects it. The `&&` and `||` shorthands build no ternary, so they still apply.
  get #buildsNestedTernary() {
    return !this.#returnsFalse && !this.#returnsTrue && this.#hasConditionalBranch
  }

  get #returnsFalse() {
    return new Value(this.#consequentValue).isFalseLiteral
  }

  // `condition || Y` only preserves the value when the condition is itself a boolean: a truthy `condition` would return
  // `condition` where the original returned `true`. Otherwise the ternary carries the `true` through intact.
  get #returnsTrue() {
    return new Value(this.#consequentValue).isTrueLiteral
      && isProvablyBoolean(this.#ifStatement.test, {
        isBooleanCall: (call) => isGlobalBooleanCallee(call.callee, this.#bindings)
      })
  }

  get #hasConditionalBranch() {
    return [ this.#consequentValue, this.#fallbackValue ].some((node) => new Value(node).isConditional)
  }

  get #suggestion() {
    if (this.#returnsFalse) return "`return !condition && Y`"
    if (this.#returnsTrue) return "`return condition || Y`"
    return "`return condition ? X : Y`"
  }

  // The two returns collapse into one expression, and a comment written between them stands above it or trails it.
  get #fix() {
    return this.#hasToolDirective
      ? null
      : commentPreservingReplacementFix(this.#sourceCode, this.#range, {
        text: this.#replacement,
        preserving: [ this.#condition, this.#consequentValue, this.#fallbackValue ]
      })
  }

  get #hasToolDirective() {
    return hasToolDirectiveIn({ sourceCode: this.#sourceCode, node: this.#ifStatement, range: this.#range })
  }

  get #range() {
    return [ this.#ifStatement.range[0], this.#lastReturn.range[1] ]
  }

  get #replacement() {
    if (this.#returnsFalse) return `return ${this.#negatedTest} && ${this.#fallbackOperand}`
    if (this.#returnsTrue) return `return ${this.#testOperand} || ${this.#fallbackOperand}`
    return `return ${this.#ternaryTest} ? ${this.#ternaryConsequent} : ${this.#ternaryFallback}`
  }

  get #negatedTest() {
    return negated(this.#sourceCode, this.#ifStatement.test, { text: this.#condition.text })
  }

  get #condition() {
    return conditionSource(this.#sourceCode, this.#ifStatement)
  }

  get #fallbackOperand() {
    return operandText(this.#sourceCode, this.#fallbackValue, LOGICAL_OPERAND_PARENS)
  }

  get #testOperand() {
    return operandText(this.#sourceCode, this.#ifStatement.test, {
      looserTypes: LOGICAL_OPERAND_PARENS,
      text: this.#condition.text
    })
  }

  get #ternaryTest() {
    return operandText(this.#sourceCode, this.#ifStatement.test, {
      looserTypes: TERNARY_CONDITION_PARENS,
      text: this.#condition.text
    })
  }

  get #ternaryConsequent() {
    return operandText(this.#sourceCode, this.#consequentValue, SEQUENCE_PARENS)
  }

  get #ternaryFallback() {
    return operandText(this.#sourceCode, this.#fallbackValue, SEQUENCE_PARENS)
  }
}

function isIfReturnWithoutAlternate(node) {
  return isIfWithoutAlternate(node) && Boolean(returnArgumentOf(node.consequent))
}

function returnArgumentOf(consequent) {
  const inner = innerStatementOf(consequent)
  return inner?.type === "ReturnStatement" ? inner.argument : undefined
}

class Value {
  #node

  constructor(node) {
    this.#node = node
  }

  get fitsInTernary() {
    return Boolean(this.#node) && isSingleLine(this.#node) && !this.#isComplexLiteral
  }

  get isConditional() {
    return this.#node.type === "ConditionalExpression"
  }

  get isFalseLiteral() {
    return this.#node.type === "Literal" && this.#node.value === false
  }

  get isTrueLiteral() {
    return this.#node.type === "Literal" && this.#node.value === true
  }

  get #isComplexLiteral() {
    return (this.#node.type === "ObjectExpression" && this.#node.properties.length > 1)
      || (this.#node.type === "ArrayExpression" && this.#node.elements.length > 1)
  }
}
