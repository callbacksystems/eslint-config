import { EvaluatedExpressions } from "#helpers/flow/evaluated_expressions"
import { IfOutcomes } from "#helpers/flow/if_outcomes"
import { isFixedPrimitive } from "#helpers/syntax/literals"
import { PossibleOutcomes } from "#helpers/flow/possible_outcomes"
import { ResourceDisposal } from "#helpers/flow/resource_disposal"
import { StaticCondition } from "#helpers/syntax/static_condition"
import { SwitchSelection } from "#helpers/flow/switch_selection"

const NORMAL = 1
const RETURN = 2
const THROW = 4
const BREAK = 8
const CONTINUE = 16
const FUNCTION_ABRUPT = RETURN | THROW
const LOOP_TYPES = new Set([ "WhileStatement", "DoWhileStatement", "ForStatement", "ForInStatement", "ForOfStatement" ])
const BODY_TYPES = new Set([ "LabeledStatement", "WithStatement" ])
const SIMPLE_OUTCOMES = {
  ReturnStatement: () => new PossibleOutcomes(RETURN),
  ThrowStatement: () => new PossibleOutcomes(THROW),
  BreakStatement: (statement) => statement.label
    ? new PossibleOutcomes(0, { breakLabels: new Set([ statement.label.name ]) })
    : new PossibleOutcomes(BREAK),
  ContinueStatement: (statement) => statement.label
    ? new PossibleOutcomes(0, { continueLabels: new Set([ statement.label.name ]) })
    : new PossibleOutcomes(CONTINUE)
}
const DIRECT_EXPRESSIONS = {
  ExpressionStatement: (statement) => [ statement.expression ],
  ReturnStatement: (statement) => [ statement.argument ],
  IfStatement: (statement) => [ statement.test ],
  SwitchStatement: (statement) => [ statement.discriminant, ...SwitchSelection.for(statement).evaluatedTests ],
  WhileStatement: (statement) => [ statement.test ],
  DoWhileStatement: (statement) => [ statement.test ],
  ForStatement: expressionsInForStatement,
  ForInStatement: (statement) => [ ...expressionsIn(statement.left), statement.right ],
  ForOfStatement: (statement) => [ ...expressionsIn(statement.left), statement.right ],
  WithStatement: (statement) => [ statement.object ],
  VariableDeclaration: expressionsInDeclaration,
  ClassDeclaration: (statement) => [ statement ]
}
const INTRINSICALLY_THROWING = new Set([ "ForOfStatement" ])
const SAFE_EXPRESSION_NODES = new Set([
  "ArrayExpression", "ArrowFunctionExpression", "ChainExpression", "ConditionalExpression", "FunctionExpression",
  "Literal", "LogicalExpression", "MetaProperty", "ObjectExpression", "ParenthesizedExpression", "Property",
  "SequenceExpression", "TemplateElement"
])
const COMPLETIONS = new WeakMap()

export function canFallThrough(functionNode) {
  return completionFor(functionNode).canFallThrough
}

export function hasReachableReturn(functionNode) {
  return completionFor(functionNode).hasReachableReturn
}

export function canFallThroughSequence(statements) {
  return new CompletionAnalysis().canFallThroughSequence(statements)
}

export function completionAnalysis(options) {
  return new CompletionAnalysis(options)
}

function expressionsInForStatement(statement) {
  const update = new StaticCondition(statement.test).value === false ? null : statement.update
  return [ ...expressionsIn(statement.init), statement.test, update ]
}

function expressionsIn(node) {
  return node?.type === "VariableDeclaration" ? expressionsInDeclaration(node) : [ node ].filter(Boolean)
}

function expressionsInDeclaration(statement) {
  return statement.declarations.flatMap(({ id, init }) => id.type === "Identifier" ? [ init ] : [ id, init ])
}

function completionFor(functionNode) {
  if (!COMPLETIONS.has(functionNode)) COMPLETIONS.set(functionNode, new FunctionCompletion(functionNode))
  return COMPLETIONS.get(functionNode)
}

class FunctionCompletion {
  #functionNode
  #cachedOutcomes

  constructor(functionNode) {
    this.#functionNode = functionNode
  }

  get canFallThrough() {
    return this.#outcomes.hasAny(NORMAL | BREAK | CONTINUE) || this.#outcomes.hasLabeledControl
  }

  get hasReachableReturn() {
    return this.#outcomes.hasAny(RETURN)
  }

  get #outcomes() {
    return this.#cachedOutcomes ??= this.#functionNode.body.type === "BlockStatement"
      ? new StatementOutcomes(this.#functionNode.body).value
      : new PossibleOutcomes(RETURN)
  }
}

class StatementOutcomes {
  #root
  #byNode = new WeakMap()
  #isEffectful

  constructor(root, { isEffectful = () => false } = {}) {
    this.#root = root
    this.#isEffectful = isEffectful
  }

  get value() {
    return this.outcomesFor(this.#root)
  }

  outcomesFor(statement) {
    const pending = [ { node: statement, isReady: false } ]
    while (pending.length > 0) this.#visit(pending.pop(), pending)
    return this.#byNode.get(statement)
  }

  outcomesOfSequence(statements, following = new PossibleOutcomes(NORMAL)) {
    const own = statements.reduce((outcomes, statement) => outcomes.hasAny(NORMAL)
      ? outcomes.followedBy(this.outcomesFor(statement))
      : outcomes, new PossibleOutcomes(NORMAL))
    return own.hasAny(NORMAL) ? own.followedBy(following) : own
  }

  isEffectful(statement) {
    return this.#isEffectful(statement)
  }

  #visit({ node, isReady }, pending) {
    if (this.#byNode.has(node)) return

    if (isReady) {
      this.#byNode.set(node, new StatementOutcome(node, this).value)
    } else {
      pending.push({ node, isReady: true })
      for (const child of reversedChildrenOf(node)) {
        pending.push({ node: child, isReady: false })
      }
    }
  }
}

class StatementOutcome {
  #statement
  #outcomes

  constructor(statement, outcomes) {
    this.#statement = statement
    this.#outcomes = outcomes
  }

  get value() {
    const outcomes = SIMPLE_OUTCOMES[this.#statement.type]?.(this.#statement) ?? this.#structuredValue
    const withThrows = canThrowDirectly(this.#statement) ? outcomes.withTypes(THROW) : outcomes
    return this.#outcomes.isEffectful(this.#statement) ? withThrows.possiblyEffectful : withThrows
  }

  get #structuredValue() {
    if (this.#statement.type === "BlockStatement") return this.#blockValue
    if (this.#statement.type === "IfStatement") return this.#ifValue
    if (this.#statement.type === "SwitchStatement") return new SwitchOutcomes(this.#statement, this.#outcomes).value
    if (this.#statement.type === "TryStatement") return new TryOutcomes(this.#statement, this.#outcomes).value
    if (BODY_TYPES.has(this.#statement.type)) return this.#bodyValue
    return LOOP_TYPES.has(this.#statement.type) ? this.#loopValue : new PossibleOutcomes(NORMAL)
  }

  get #blockValue() {
    return this.#outcomes.outcomesOfSequence(this.#statement.body)
  }

  get #ifValue() {
    return new IfOutcomes(this.#statement, this.#outcomes).value
  }

  get #bodyValue() {
    return this.#statement.type === "LabeledStatement"
      ? this.#labeledValue
      : this.#outcomes.outcomesFor(this.#statement.body)
  }

  get #labeledValue() {
    const loop = this.#labeledLoop
    return this.#outcomes.outcomesFor(this.#statement.body)
      .afterLabel(this.#statement.label.name, {
        consumesContinue: Boolean(loop), continueCanComplete: Boolean(loop) && !isDefinitelyInfinite(loop)
      })
  }

  get #labeledLoop() {
    let { body } = this.#statement
    while (body.type === "LabeledStatement") ({ body } = body)
    return LOOP_TYPES.has(body.type) ? body : null
  }

  get #loopValue() {
    if (new StaticCondition(this.#statement.test).value === false
      && this.#statement.type !== "DoWhileStatement") return new PossibleOutcomes(NORMAL)

    const body = this.#outcomes.outcomesFor(this.#statement.body)
    const abrupt = body.onlyTypes(FUNCTION_ABRUPT)
    if (isDefinitelyInfinite(this.#statement)) return abrupt.union(body.normalFrom(BREAK))
    if (this.#statement.type !== "DoWhileStatement") {
      return abrupt.withTypes(NORMAL).union(body.normalFrom(NORMAL | BREAK | CONTINUE))
    }

    return abrupt.union(body.normalFrom(NORMAL | BREAK | CONTINUE))
  }
}

function canThrowDirectly(statement) {
  return new ResourceDisposal(statement).canCallUserCode || INTRINSICALLY_THROWING.has(statement.type)
    || new EvaluatedExpressions(DIRECT_EXPRESSIONS[statement.type]?.(statement) ?? []).includes(isRiskyExpression)
}

function isRiskyExpression(node) {
  if (node.type === "TemplateLiteral") return !isFixedPrimitive(node)
  if (node.type === "UnaryExpression") return ![ "!", "typeof", "void" ].includes(node.operator)
  return !SAFE_EXPRESSION_NODES.has(node.type)
}

class SwitchOutcomes {
  #outcomes
  #possible
  #selection
  #suffix = new PossibleOutcomes(NORMAL)

  constructor(statement, outcomes) {
    this.#outcomes = outcomes
    this.#selection = SwitchSelection.for(statement)
    this.#possible = new PossibleOutcomes(this.#selection.canSkipBody ? NORMAL : 0)
  }

  get value() {
    this.#selection.forEachCaseReversed((switchCase) => this.#prepend(switchCase))
    return this.#possible
  }

  #prepend(switchCase) {
    this.#suffix = this.#outcomes.outcomesOfSequence(switchCase.consequent, this.#suffix)
    const entry = this.#selection.canEnter(switchCase) ? consumingBreakIn(this.#suffix) : new PossibleOutcomes(0)
    this.#possible = this.#possible.union(entry)
  }
}

function consumingBreakIn(outcomes) {
  return outcomes.withoutTypes(BREAK).union(outcomes.normalFrom(BREAK))
}

class TryOutcomes {
  #statement
  #outcomes
  #cachedPrimary

  constructor(statement, outcomes) {
    this.#statement = statement
    this.#outcomes = outcomes
  }

  get value() {
    return !this.#statement.finalizer || this.#primary.isEmpty ? this.#primary : this.#finalized
  }

  get #primary() {
    return this.#cachedPrimary ??= this.#statement.handler
      ? this.#handled
      : this.#block
  }

  get #handled() {
    const handled = this.#outcomes.outcomesFor(this.#statement.handler.body)
    return this.#block.caughtBy(this.#canBindingThrow ? handled.withTypes(THROW).possiblyEffectful : handled)
  }

  get #block() {
    return this.#outcomes.outcomesFor(this.#statement.block)
  }

  get #canBindingThrow() {
    return Boolean(this.#statement.handler.param) && this.#statement.handler.param.type !== "Identifier"
  }

  get #finalized() {
    return this.#primary.finalizedBy(this.#finalizer)
  }

  get #finalizer() {
    return this.#outcomes.outcomesFor(this.#statement.finalizer)
  }
}

function isDefinitelyInfinite(statement) {
  if (statement.type === "ForStatement" && !statement.test) return true
  return statement.type !== "ForInStatement" && statement.type !== "ForOfStatement"
    && new StaticCondition(statement.test).value === true
}

function reversedChildrenOf(node) {
  return new StatementChildren(node).values.toReversed()
}

class StatementChildren {
  #statement

  constructor(statement) {
    this.#statement = statement
  }

  get values() {
    if (this.#statement.type === "BlockStatement") return this.#statement.body
    if (this.#statement.type === "IfStatement") return this.#ifBranches
    if (this.#statement.type === "SwitchStatement") return this.#switchStatements
    if (this.#statement.type === "TryStatement") return this.#tryBlocks
    return LOOP_TYPES.has(this.#statement.type) || BODY_TYPES.has(this.#statement.type)
      ? [ this.#statement.body ]
      : []
  }

  get #ifBranches() {
    return [ this.#statement.consequent, this.#statement.alternate ].filter(Boolean)
  }

  get #switchStatements() {
    return this.#statement.cases.flatMap((switchCase) => switchCase.consequent)
  }

  get #tryBlocks() {
    return [ this.#statement.block, this.#statement.handler?.body, this.#statement.finalizer ].filter(Boolean)
  }
}

class CompletionAnalysis {
  #outcomes

  constructor({ isEffectful = () => false } = {}) {
    this.#outcomes = new StatementOutcomes(null, { isEffectful })
  }

  canFallThroughSequence(statements) {
    return this.#outcomes.outcomesOfSequence(statements).hasAny(NORMAL)
  }

  canFallThroughAfterEffect(statements) {
    return this.#outcomes.outcomesOfSequence(statements).hasEffectfulAny(NORMAL)
  }

  canReachLoopUpdateAfter(statement, { loop }) {
    const outcomes = this.#outcomes.outcomesOfSequence([ statement ])
    return outcomes.hasAny(NORMAL | CONTINUE)
      || outcomes.hasLabeledContinueFor(loop)
  }

  canThrowSequence(statements) {
    return this.#outcomes.outcomesOfSequence(statements)
      .hasAny(THROW)
  }
}
