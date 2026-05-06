// A branch that does work and then bails with a bare `return` (`doThing()` then `return`) buries its exit at the
// bottom, past the effect. Lift the guard above the work as an inline `if (cond) return`, invert into `if/else`, or
// extract a helper. A single-statement guard block is collapsed elsewhere, and a function's own trailing bare return is
// handled by its own rule, so this targets the multi-statement branch that ends in a lone return.

import { BindingResolver } from "#helpers/scope/binding_resolver"
import { EvaluatedExpressions } from "#helpers/flow/evaluated_expressions"
import { completionAnalysis } from "#helpers/flow/function_completion"
import { isBareReturn } from "#helpers/syntax/functions"
import { isDeclarativeGlobalDefinition } from "#helpers/scope/global_definitions"
import { isFixedPrimitive } from "#helpers/syntax/literals"
import { NearestAncestor } from "#helpers/syntax/nearest_ancestor"
import { reportProblems } from "#helpers/eslint/report"

const EFFECT_FREE_STATEMENTS = new Set([
  "BlockStatement", "BreakStatement", "ContinueStatement", "EmptyStatement", "FunctionDeclaration",
  "LabeledStatement", "TryStatement"
])
const EFFECT_EXPRESSIONS = {
  ExpressionStatement: (statement) => [ statement.expression ],
  ReturnStatement: (statement) => [ statement.argument ],
  ThrowStatement: (statement) => [ statement.argument ],
  IfStatement: (statement) => [ statement.test ],
  SwitchStatement: (statement) => [ statement.discriminant, ...statement.cases.map((branch) => branch.test) ],
  WhileStatement: (statement) => [ statement.test ],
  DoWhileStatement: (statement) => [ statement.test ],
  ForStatement: (statement) => [ statement.init, statement.test, statement.update ]
}
const EFFECT_FREE_EXPRESSION_NODES = new Set([
  "ArrayExpression", "ArrowFunctionExpression", "ChainExpression", "ConditionalExpression", "FunctionExpression",
  "Identifier", "Literal", "LogicalExpression", "MetaProperty", "ObjectExpression", "ParenthesizedExpression",
  "Property", "SequenceExpression", "TemplateElement", "ThisExpression"
])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow a bare `return` at the end of a branch that first does other work" },
    schema: [],
    messages: {
      effectfulBareReturn:
        "Don't do work then `return`. Lift the exit to an inline guard, invert into if/else, or extract a helper."
    }
  },
  create(context) {
    const effects = new ObservableEffects(context.sourceCode)
    const completions = completionAnalysis({ isEffectful: (statement) => effects.includes(statement) })
    return { IfStatement: (node) => reportProblems(context, new Branches(node, completions)) }
  }
}

class ObservableEffects {
  #bindings
  #withScopes = new WithScopes()

  constructor(sourceCode) {
    this.#bindings = new BindingResolver(sourceCode)
  }

  includes(statement) {
    if (EFFECT_FREE_STATEMENTS.has(statement.type)) return false

    const expressions = EFFECT_EXPRESSIONS[statement.type]
    return expressions
      ? new EvaluatedExpressions(expressions(statement)).includes((node) => this.#isExpressionEffectful(node))
      : true
  }

  #isExpressionEffectful(node) {
    if (node.type === "Identifier") return this.#isObservableIdentifier(node)
    if (node.type === "TemplateLiteral") return !isFixedPrimitive(node)
    if (node.type === "UnaryExpression") return ![ "!", "typeof", "void" ].includes(node.operator)
    return !EFFECT_FREE_EXPRESSION_NODES.has(node.type)
  }

  #isObservableIdentifier(identifier) {
    if (this.#withScopes.includes(identifier)) return true

    const variable = this.#bindings.variableFor(identifier)
    if (!variable && isTypeofOperand(identifier)) return false
    return !variable || (variable.scope.type === "global"
      && (variable.defs.length === 0 || !variable.defs.every(isDeclarativeGlobalDefinition)))
  }
}

class WithScopes {
  #bodies = new NearestAncestor(isWithBody)

  includes(node) {
    return Boolean(this.#bodies.of(node))
  }
}

function isWithBody(node) {
  return node.parent?.type === "WithStatement" && node.parent.body === node
}

function isTypeofOperand(identifier) {
  return identifier.parent.type === "UnaryExpression" && identifier.parent.operator === "typeof"
}

class Branches {
  #completions
  #node

  constructor(node, completions) {
    this.#node = node
    this.#completions = completions
  }

  get problems() {
    return [ this.#node.consequent, this.#node.alternate ]
      .map((branch) => trailingBareReturnOf(branch, this.#completions))
      .filter(Boolean)
      .map((statement) => ({ node: statement, messageId: "effectfulBareReturn" }))
  }
}

function trailingBareReturnOf(branch, completions) {
  if (branch?.type !== "BlockStatement" || branch.body.length < 2) return null

  const last = branch.body.at(-1)
  return isBareReturn(last) && completions.canFallThroughAfterEffect(branch.body.slice(0, -1)) ? last : null
}
