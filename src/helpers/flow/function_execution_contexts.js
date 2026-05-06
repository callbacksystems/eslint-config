import { childNodesOf, pushReversed } from "#helpers/syntax/ast"
import { completionAnalysis } from "#helpers/flow/function_completion"
import { evaluatedChildNodesOf } from "#helpers/flow/evaluated_child_nodes"
import { isFunction } from "#helpers/syntax/functions"
import { StaticCondition } from "#helpers/syntax/static_condition"
import { SwitchSelection } from "#helpers/flow/switch_selection"

const SEQUENCE_TYPES = new Set([ "BlockStatement", "Program", "StaticBlock", "SwitchCase" ])
const CONTEXTS_BY_ROOT = new WeakMap()

export class FunctionExecutionContexts {
  #values

  constructor(root) {
    if (!CONTEXTS_BY_ROOT.has(root)) CONTEXTS_BY_ROOT.set(root, new ContextSequence(root).values)
    this.#values = CONTEXTS_BY_ROOT.get(root)
  }

  forEach(inspect) {
    this.#values.forEach(inspect)
  }
}

class ContextSequence {
  #completions = completionAnalysis()
  #pending
  #values = []

  constructor(root) {
    this.#pending = [ new FunctionContext(root, null, this.#completions) ]
  }

  get values() {
    while (this.#pending.length > 0) {
      const context = Object.freeze(this.#pending.pop())
      this.#values.push(context)
      pushReversed(this.#pending, context.children)
    }
    return Object.freeze(this.#values)
  }
}

class FunctionContext {
  #completions
  #executionFunction

  constructor(node, executionFunction, completions) {
    this.node = node
    this.#executionFunction = executionFunction
    this.#completions = completions
  }

  get functionNode() {
    return isFunction(this.node) ? this.node : this.#executionFunction
  }

  get children() {
    return this.#childNodes.map((child) => new FunctionContext(child, this.#functionFor(child), this.#completions))
  }

  get #childNodes() {
    return this.#statementChildren ?? this.#expressionChildren
  }

  get #statementChildren() {
    if (SEQUENCE_TYPES.has(this.node.type)) return this.#sequenceChildren
    if (this.node.type === "SwitchStatement") return this.#switchChildren
    return this.#branchingStatementChildren
  }

  get #sequenceChildren() {
    const prefix = this.node.type === "SwitchCase" && this.node.test ? [ this.node.test ] : []
    const statements = this.node.type === "SwitchCase" ? this.node.consequent : childNodesOf(this.node)
    return [ ...prefix, ...reachableStatementsIn(statements, this.#completions) ]
  }

  get #switchChildren() {
    return new SwitchExecution(this.node, this.#completions).children
  }

  get #branchingStatementChildren() {
    if (this.node.type === "IfStatement") return this.#ifChildren
    if (this.node.type === "WhileStatement") return this.#whileChildren
    if (this.node.type === "DoWhileStatement") return this.#doWhileChildren
    if (this.node.type === "ForStatement") return this.#forChildren
    if (this.node.type === "TryStatement") return this.#tryChildren
    return null
  }

  get #ifChildren() {
    const { test, consequent, alternate } = this.node
    const condition = new StaticCondition(test).value
    if (condition === true) return [ test, consequent ]
    if (condition === false) return [ test, alternate ].filter(Boolean)
    return [ test, consequent, alternate ].filter(Boolean)
  }

  get #whileChildren() {
    return new StaticCondition(this.node.test).value === false
      ? [ this.node.test ]
      : childNodesOf(this.node)
  }

  get #doWhileChildren() {
    const { body, test } = this.node
    return this.#completions.canReachLoopUpdateAfter(body, { loop: this.node }) ? [ body, test ] : [ body ]
  }

  get #forChildren() {
    const { init, test, update, body } = this.node
    if (new StaticCondition(test).value === false) return [ init, test ].filter(Boolean)

    const reachedUpdate = this.#completions.canReachLoopUpdateAfter(body, { loop: this.node }) ? update : null
    return [ init, test, body, reachedUpdate ].filter(Boolean)
  }

  get #tryChildren() {
    const { block, handler, finalizer } = this.node
    const reachedHandler = handler && this.#completions.canThrowSequence([ block ]) ? handler : null
    return [ block, reachedHandler, finalizer ].filter(Boolean)
  }

  get #expressionChildren() {
    return this.node.type === "LogicalExpression" || this.node.type === "ConditionalExpression"
      ? evaluatedChildNodesOf(this.node)
      : childNodesOf(this.node)
  }

  #functionFor(child) {
    if (this.#isDeferredInstanceFieldValue(child)) return null
    return isFunction(child) ? child : this.functionNode
  }

  #isDeferredInstanceFieldValue(child) {
    return this.#isInstanceField && child === this.node.value
  }

  get #isInstanceField() {
    return this.node.type === "PropertyDefinition" && !this.node.static
  }
}

function reachableStatementsIn(statements, completions) {
  let canContinue = true
  return statements.reduce((reachable, statement) => {
    if (canContinue || statement.type === "FunctionDeclaration") reachable.push(statement)
    if (canContinue) canContinue = completions.canFallThroughSequence([ statement ])
    return reachable
  }, [])
}

class SwitchExecution {
  #completions
  #selection
  #statement

  constructor(statement, completions) {
    this.#statement = statement
    this.#completions = completions
    this.#selection = SwitchSelection.for(statement)
  }

  get children() {
    return Array.from(new Set([
      this.#statement.discriminant,
      ...this.#selection.evaluatedTests,
      ...this.#reachableStatements,
      ...this.#hoistedFunctions
    ]))
  }

  get #reachableStatements() {
    let canExecute = false
    return this.#statement.cases.flatMap((switchCase) => {
      const isReached = canExecute || this.#selection.canEnter(switchCase)
      canExecute = isReached && this.#completions.canFallThroughSequence(switchCase.consequent)
      return isReached ? reachableStatementsIn(switchCase.consequent, this.#completions) : []
    })
  }

  get #hoistedFunctions() {
    return this.#statement.cases
      .flatMap((switchCase) => switchCase.consequent)
      .filter((statement) => statement.type === "FunctionDeclaration")
  }
}
