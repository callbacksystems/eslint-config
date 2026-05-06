import { stableExpressionFor } from "#helpers/flow/stable_expression"
import { pushReversed } from "#helpers/syntax/ast"
import { evaluatedChildNodesOf } from "#helpers/flow/evaluated_child_nodes"
import { isClassNode } from "#helpers/syntax/classes"
import { isFunction } from "#helpers/syntax/functions"
import { NativeEvaluationInput } from "#helpers/flow/native_evaluation_input"
import { NativeReceiverEvaluation } from "#helpers/flow/native_receiver_evaluation"
import { StandardPureCall } from "#helpers/flow/standard_pure_call"

const ANALYSES_BY_SOURCE = new WeakMap()
const IMMEDIATE_SAFE_TYPES = new Set([
  "Identifier", "Literal", "MetaProperty", "PrivateIdentifier", "Super", "ThisExpression"
])
const IMMEDIATE_UNSAFE_TYPES = new Set([
  "AssignmentExpression", "AwaitExpression", "ImportExpression", "JSXElement", "JSXFragment", "UpdateExpression",
  "YieldExpression"
])
const COERCING_BINARY_OPERATORS = new Set([
  "!=", "<", "<=", "==", ">", ">=", "+", "-", "*", "/", "%", "**", "<<", ">>", ">>>", "&", "|", "^",
  "in", "instanceof"
])
const STEP_BY_TYPE = {
  BinaryExpression: "binaryStep",
  CallExpression: "invocationStep",
  NewExpression: "invocationStep",
  Property: "propertyStep",
  TaggedTemplateExpression: "taggedTemplateStep",
  TemplateLiteral: "templateStep",
  UnaryExpression: "unaryStep"
}

// A native method is looked up only after its receiver has been evaluated. This proves that evaluation cannot run an
// observable effect which replaces the method between the source-level identity check and the lookup.
export class ReceiverEvaluation {
  #analysis
  #node

  constructor(node, bindings) {
    this.#node = stableExpressionFor(node, bindings)
    this.#analysis = analysisFor(bindings)
  }

  get isSafe() {
    return this.#analysis.isSafe(this.#node)
  }
}

function analysisFor(bindings) {
  const { sourceCode } = bindings
  if (!ANALYSES_BY_SOURCE.has(sourceCode)) {
    ANALYSES_BY_SOURCE.set(sourceCode, new ReceiverEvaluationAnalysis(bindings))
  }
  return ANALYSES_BY_SOURCE.get(sourceCode)
}

class ReceiverEvaluationAnalysis {
  #bindings
  #facts = new WeakMap()

  constructor(bindings) {
    this.#bindings = bindings
  }

  isSafe(node) {
    if (!this.#facts.has(node)) this.#facts.set(node, new EvaluationWalk(node, this).isSafe)
    return this.#facts.get(node)
  }

  stepFor(node) {
    return new EvaluatedNode(node, this.#bindings).step
  }
}

class EvaluationWalk {
  #analysis
  #pending
  #seen = new WeakSet()

  constructor(node, analysis) {
    this.#analysis = analysis
    this.#pending = [ node ]
  }

  get isSafe() {
    while (this.#pending.length > 0) {
      const node = this.#pending.pop()
      if (!this.#seen.has(node)) {
        this.#seen.add(node)
        const step = this.#analysis.stepFor(node)
        if (!step.isSafe) return false

        pushReversed(this.#pending, step.children)
      }
    }
    return true
  }
}

class EvaluatedNode {
  #bindings
  #node

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
  }

  get step() {
    if (IMMEDIATE_SAFE_TYPES.has(this.#node.type) || isFunction(this.#node)) return EvaluationStep.safe()
    if (this.#isImmediatelyUnsafe) return EvaluationStep.unsafe()

    const step = STEP_BY_TYPE[this.#node.type]
    return step ? this[step] : EvaluationStep.following(evaluatedChildNodesOf(this.#node))
  }

  get invocationStep() {
    const isSafe = new NativeReceiverEvaluation(this.#node, this.#bindings).isSafe
      ?? this.#isInertLocalConstruction
      ?? this.#isStandardPureCall
    return isSafe ? EvaluationStep.following(invocationPartsOf(this.#node)) : EvaluationStep.unsafe()
  }

  get taggedTemplateStep() {
    return EvaluationStep.unsafe()
  }

  get binaryStep() {
    const isSafe = !COERCING_BINARY_OPERATORS.has(this.#node.operator)
      || new PrimitivePair(this.#node, this.#bindings).isPresent
    return isSafe ? EvaluationStep.following([ this.#node.left, this.#node.right ]) : EvaluationStep.unsafe()
  }

  get unaryStep() {
    if (this.#node.operator === "delete") return EvaluationStep.unsafe()

    const isSafe = [ "!", "typeof", "void" ].includes(this.#node.operator)
      || new NativeEvaluationInput(this.#node.argument, this.#bindings).isSafe
    return isSafe ? EvaluationStep.following([ this.#node.argument ]) : EvaluationStep.unsafe()
  }

  get templateStep() {
    return this.#node.expressions.every((expression) =>
      new NativeEvaluationInput(expression, this.#bindings).isSafe)
      ? EvaluationStep.following(this.#node.expressions)
      : EvaluationStep.unsafe()
  }

  get propertyStep() {
    return this.#hasSafePropertyKey
      ? EvaluationStep.following(evaluatedChildNodesOf(this.#node))
      : EvaluationStep.unsafe()
  }

  get #isImmediatelyUnsafe() {
    return IMMEDIATE_UNSAFE_TYPES.has(this.#node.type) || this.#node.type === "MemberExpression"
      || this.#node.type === "SpreadElement" || isClassNode(this.#node)
  }

  get #isInertLocalConstruction() {
    return this.#node.type === "NewExpression"
      ? new InertLocalConstruction(this.#node, this.#bindings).isPresent
      : null
  }

  get #isStandardPureCall() {
    return this.#node.type === "CallExpression" && new StandardPureCall(this.#node, this.#bindings).isPure
  }

  get #hasSafePropertyKey() {
    return !this.#node.computed || new NativeEvaluationInput(this.#node.key, this.#bindings).isSafe
  }
}

class EvaluationStep {
  static safe() {
    return new EvaluationStep(true)
  }

  static unsafe() {
    return new EvaluationStep(false)
  }

  static following(children) {
    return new EvaluationStep(true, children)
  }

  constructor(isSafe, children = []) {
    this.children = children
    this.isSafe = isSafe
  }
}

function invocationPartsOf({ arguments: arguments_, callee }) {
  const calleeParts = callee.type === "MemberExpression"
    ? [ callee.object, callee.computed ? callee.property : null ]
    : [ callee ]
  return [ ...calleeParts, ...arguments_ ].filter(Boolean)
}

class PrimitivePair {
  #bindings
  #node

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
  }

  get isPresent() {
    return [ this.#node.left, this.#node.right ].every((node) =>
      new NativeEvaluationInput(node, this.#bindings).isSafe)
  }
}

class InertLocalConstruction {
  #bindings
  #node

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
  }

  get isPresent() {
    const classNode = this.#class
    return Boolean(classNode) && !classNode.superClass && !classNode.body.body.some(isExecutedInstanceElement)
  }

  get #class() {
    return this.#node.callee.type === "Identifier" ? this.#bindings.classFor(this.#node.callee) : null
  }
}

function isExecutedInstanceElement(member) {
  return !member.static && ((member.type === "PropertyDefinition" && Boolean(member.value))
    || (member.type === "MethodDefinition" && member.kind === "constructor"))
}
