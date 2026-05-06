// A memoization that just delegates to another no-argument method (`this.#positions ??= this.#computePositions()`) adds
// a hop for nothing. Inline the computation into the memoization. Calls that take arguments genuinely parameterize, and
// calls on another object are not own delegation; both are left alone.

import {
  classElementHolding, enclosingClass, isLexicalThisOf, isMemoization, isThisMember
} from "#helpers/syntax/classes"
import { PrivateMemberReads } from "#helpers/classes/private_member_reads"
import { reportProblems } from "#helpers/eslint/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow memoization that delegates to another no-argument private method" },
    schema: [],
    messages: { inlineComputation: "Inline the computation from `{{target}}` instead of delegating." }
  },
  create(context) {
    const module = new MemoizedComputations(context.sourceCode.ast)
    return {
      MethodDefinition: (node) => module.addMethod(node),
      AssignmentExpression: (node) => module.addCandidate(node),
      "Program:exit": () => reportProblems(context, module)
    }
  }
}

class MemoizedComputations {
  #candidates = []
  #methods

  constructor(root) {
    this.#methods = new PrivateMethodIndex(new PrivateMemberReads(root))
  }

  get problems() {
    return this.#candidates.map((node) => new MemoizedComputation(node, this.#methods).problem).filter(Boolean)
  }

  addMethod(node) {
    this.#methods.addMethod(node)
  }

  addCandidate(node) {
    this.#candidates.push(node)
  }
}

class PrivateMethodIndex {
  #classes = new WeakMap()
  #reads

  constructor(reads) {
    this.#reads = reads
  }

  inlineableTargetFor({ name, reference }) {
    const classNode = enclosingClass(reference)
    const owner = classElementHolding(reference)
    return classNode && owner
      ? this.#methodsFor(classNode).inlineableTargetFor(name, {
        isStatic: owner.static, readCount: this.#reads.countOf(classNode, name)
      })
      : null
  }

  addMethod(member) {
    if (isPrivateMethod(member)) this.#methodsFor(member.parent.parent).addMethod(member)
  }

  #methodsFor(classNode) {
    if (!this.#classes.has(classNode)) this.#classes.set(classNode, new PrivateMethods())
    return this.#classes.get(classNode)
  }
}

function isPrivateMethod(member) {
  return member.type === "MethodDefinition" && member.kind === "method"
    && member.key.type === "PrivateIdentifier"
}

class PrivateMethods {
  #methodsByName = new Map()

  inlineableTargetFor(name, { isStatic, readCount }) {
    return (this.#methodsByName.get(name) ?? [])
      .find((method) => new PrivateMethod(method, { isStatic, readCount }).isInlineable) ?? null
  }

  addMethod(member) {
    if (!this.#methodsByName.has(member.key.name)) this.#methodsByName.set(member.key.name, [])
    this.#methodsByName.get(member.key.name).push(member)
  }
}

class PrivateMethod {
  #isStatic
  #method
  #readCount

  constructor(method, { isStatic, readCount }) {
    this.#isStatic = isStatic
    this.#method = method
    this.#readCount = readCount
  }

  get isInlineable() {
    return this.#hasMatchingContext && this.#method.value.params.length === 0
      && !this.#method.value.async && !this.#method.value.generator && this.#readCount === 1
  }

  get #hasMatchingContext() {
    return this.#method.static === this.#isStatic
  }
}

class MemoizedComputation {
  #methods
  #node

  constructor(node, methods) {
    this.#methods = methods
    this.#node = node
  }

  get problem() {
    return this.#delegates
      ? { node: this.#node, messageId: "inlineComputation", data: { target: this.#target } }
      : null
  }

  get #delegates() {
    return isMemoization(this.#node) && this.#delegatesToOwnMethod && Boolean(this.#targetMethod)
  }

  get #delegatesToOwnMethod() {
    return this.#computation.type === "CallExpression"
      && !this.#computation.optional
      && this.#computation.arguments.length === 0
      && isPrivateMethodCall(this.#computation.callee)
      && this.#belongsToClassContext
  }

  get #computation() {
    return this.#node.right
  }

  get #belongsToClassContext() {
    const owner = classElementHolding(this.#node)
    return Boolean(owner) && Boolean(owner.value) && isLexicalThisOf(this.#computation.callee, owner.value)
  }

  get #targetMethod() {
    return this.#methods.inlineableTargetFor({ name: this.#computation.callee.property.name, reference: this.#node })
  }

  get #target() {
    return `#${this.#computation.callee.property.name}`
  }
}

function isPrivateMethodCall(callee) {
  return isThisMember(callee) && !callee.optional && callee.property.type === "PrivateIdentifier"
}
