import { booleanOperandsOf, isComparison, pushAll } from "#helpers/syntax/ast"
import { propertyNameOf } from "#helpers/syntax/classes"
import { isGlobalBooleanCallee } from "#helpers/functions/global_boolean_callee"
import { isPredicateName } from "#helpers/strings/naming"
import { NativeBooleanCall } from "#helpers/flow/native_boolean_call"
import { stableExpressionFor } from "#helpers/flow/stable_expression"

const UNCHECKED_TARGET = Symbol("uncheckedTarget")
const BOOLEAN_LEAF_BY_TYPE = {
  Literal: (node) => typeof node.value === "boolean",
  UnaryExpression: (node) => node.operator === "!",
  BinaryExpression: isComparison,
  ChainExpression: (node, check) => check.isBooleanChain(node),
  CallExpression: (node, check) => check.isBooleanCall(node),
  MemberExpression: (node, check) => check.isBooleanReference(node),
  Identifier: (node, check) => check.isBooleanReference(node)
}
const BOOLEAN_EVIDENCE_LEAF_BY_TYPE = {
  Literal: BOOLEAN_LEAF_BY_TYPE.Literal,
  UnaryExpression: BOOLEAN_LEAF_BY_TYPE.UnaryExpression,
  BinaryExpression: BOOLEAN_LEAF_BY_TYPE.BinaryExpression,
  ChainExpression: BOOLEAN_LEAF_BY_TYPE.ChainExpression,
  CallExpression: (node, check) => check.hasBooleanCallEvidence(node),
  MemberExpression: BOOLEAN_LEAF_BY_TYPE.MemberExpression,
  Identifier: BOOLEAN_LEAF_BY_TYPE.Identifier
}

export class BooleanExpression {
  #node
  #context

  constructor(node, context) {
    this.#node = node
    this.#context = context
  }

  get isBoolean() {
    return new BooleanLeaves(this.#node, this.#context).areAllBoolean
  }

  get hasEvidence() {
    return new BooleanLeaves(this.#node, this.#context).hasEvidence
  }
}

class BooleanLeaves {
  #root
  #context

  constructor(root, context) {
    this.#root = root
    this.#context = context
  }

  get areAllBoolean() {
    return this.#values.every((leaf) => leaf.isBoolean)
  }

  get hasEvidence() {
    return this.#values.some((leaf) => leaf.hasEvidence)
  }

  get #values() {
    return new BooleanLeafTraversal(this.#root, this.#context)[Symbol.iterator]()
  }
}

class BooleanLeafTraversal {
  #pending
  #context

  constructor(root, context) {
    this.#pending = [ new PendingExpression(root) ]
    this.#context = context
  }

  *[Symbol.iterator]() {
    while (this.#pending.length > 0) {
      const expression = this.#resolved(this.#pending.pop())
      if (expression.operands) {
        pushAll(this.#pending, expression.operands)
      } else {
        yield new BooleanLeaf(expression, this.#context)
      }
    }
  }

  #resolved(expression) {
    if (this.#isAlreadyBoolean(expression)) return expression

    const node = stableExpressionFor(expression.node, this.#context.bindings)
    return node === expression.node ? expression : new PendingExpression(node, expression.isAwaited)
  }

  #isAlreadyBoolean(expression) {
    return expression.node.type === "Identifier" && new BooleanLeaf(expression, this.#context).isBoolean
  }
}

class PendingExpression {
  constructor(node, isAwaited = false) {
    this.node = node
    this.isAwaited = isAwaited
  }

  get operands() {
    return booleanOperandsOf(this.node)
      ?.map((node) => new PendingExpression(node, this.#shouldAwaitOperands)) ?? null
  }

  get #shouldAwaitOperands() {
    return this.isAwaited || this.node.type === "AwaitExpression"
  }
}

class BooleanLeaf {
  #expression
  #context

  constructor(expression, context) {
    this.#expression = expression
    this.#context = context
  }

  get isBoolean() {
    return Boolean(BOOLEAN_LEAF_BY_TYPE[this.#node.type]?.(this.#node, this))
  }

  get hasEvidence() {
    return Boolean(BOOLEAN_EVIDENCE_LEAF_BY_TYPE[this.#node.type]?.(this.#node, this))
  }

  isBooleanCall(call) {
    return this.#isCallBoolean(call)
  }

  isBooleanChain(chain) {
    return chain.expression.type === "CallExpression" && this.#isBuiltInBooleanCall(chain.expression)
  }

  hasBooleanCallEvidence(call) {
    return this.#isCallBoolean(call)
  }

  isBooleanReference(node) {
    return isPredicateName(referenceNameOf(node)) && !this.#isKnownFunction(node)
  }

  get #node() {
    return this.#expression.node
  }

  #isCallBoolean(call) {
    return this.#isBuiltInBooleanCall(call)
      || new BooleanCall(call.callee, { ...this.#context, acceptsAsync: this.#expression.isAwaited }).isBoolean
  }

  #isBuiltInBooleanCall(call) {
    return new NativeBooleanCall(call, this.#context).isBoolean
  }

  #isKnownFunction(node) {
    return Boolean(this.#context.resolver.functionFor(node))
  }
}

function referenceNameOf(node) {
  return node.type === "Identifier" ? node.name : propertyNameOf(node)
}

class BooleanCall {
  #callee
  #resolver
  #bindings
  #functions
  #acceptsAsync
  #cachedTarget = UNCHECKED_TARGET

  constructor(callee, { resolver, bindings, functions, acceptsAsync }) {
    this.#callee = callee
    this.#resolver = resolver
    this.#bindings = bindings
    this.#functions = functions
    this.#acceptsAsync = acceptsAsync
  }

  get isBoolean() {
    return this.#isSupportedTarget && (this.#hasBooleanName || this.#isAcceptedTarget)
  }

  get #isSupportedTarget() {
    return !this.#target?.generator && (!this.#target?.async || this.#acceptsAsync)
  }

  get #target() {
    if (this.#cachedTarget === UNCHECKED_TARGET) this.#cachedTarget = this.#resolver.functionFor(this.#callee)
    return this.#cachedTarget
  }

  get #hasBooleanName() {
    return !this.#target && new BooleanCallee(this.#callee, this.#bindings).isKnownBoolean
  }

  get #isAcceptedTarget() {
    return Boolean(this.#target) && this.#functions.has(this.#target)
  }
}

class BooleanCallee {
  #node
  #bindings

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
  }

  get isKnownBoolean() {
    return isGlobalBooleanCallee(this.#node, this.#bindings)
      || isPredicateName(this.#name)
  }

  get #name() {
    return this.#node.type === "Identifier" ? this.#node.name : this.#memberName
  }

  get #memberName() {
    return this.#node.type === "MemberExpression" ? propertyNameOf(this.#node) : ""
  }
}
