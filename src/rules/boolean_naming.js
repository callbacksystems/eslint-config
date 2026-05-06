// A method, getter, or function that returns a boolean should read as a predicate: an `is`/`has`/`can`/`should`/...
// prefix for state, or a third-person verb (`includes`, `forwards`) for an action or relation. A bare adjective or noun
// (`valid`, `redundant`) reads as a value, not a question.
//
// A return is taken as boolean when it is a comparison, a negation, a boolean literal, a logical/ternary combination of
// booleans, a predicate-named member read, or a call that either has a predicate name or resolves to a same-file
// function or same-class method whose own body returns a boolean. The transitive resolution stays within the file: an
// imported call's return type is unknowable without type information.
//
// Exempt: a getter on a custom element (an `HTMLElement` subclass) that reads an attribute. There `get disabled()`
// mirrors the reflected attribute name on purpose, and forcing `isDisabled` would break the platform convention.

import { nodesIn } from "#helpers/syntax/ast"
import { ClassThisBindings } from "#helpers/classes/class_this_bindings"
import { calleeMemberName } from "#helpers/syntax/classes"
import { extendsElementNamedBase } from "#helpers/classes/dom"
import { MemberSubject } from "#helpers/classes/member_subject"
import { capitalize, isBooleanName } from "#helpers/strings/naming"
import { reportProblem } from "#helpers/eslint/report"
import { BooleanReturnAnalysis } from "#helpers/flow/boolean_return_analysis"
import { BindingResolver } from "#helpers/scope/binding_resolver"

const ATTRIBUTE_READERS = new Set([ "getAttribute", "hasAttribute" ])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Require boolean-returning methods to read as predicates (is/has prefix or a verb)" },
    schema: [],
    messages: { booleanName: "`{{name}}` returns a boolean; name it as a predicate (e.g. `is{{pascal}}`)." }
  },
  create(context) {
    const facts = new FunctionFacts(context.sourceCode)
    return {
      MethodDefinition(node) {
        if (node.kind !== "set") reportProblem(context, new NamedFunction(node, facts))
      },
      PropertyDefinition: (node) => reportProblem(context, new NamedFunction(node, facts)),
      FunctionDeclaration: (node) => reportProblem(context, new NamedFunction(node, facts))
    }
  }
}

class FunctionFacts {
  #root
  #booleanReturns
  #bindings
  #cachedAttributeReads

  constructor(sourceCode) {
    this.#root = sourceCode.ast
    this.#booleanReturns = new BooleanReturnAnalysis(sourceCode)
    this.#bindings = new BindingResolver(sourceCode)
  }

  subjectOf(node) {
    return new MemberSubject(node, this.#bindings)
  }

  returnsBooleanFrom(functionNode) {
    return this.#booleanReturns.returnsBooleanFrom(functionNode)
  }

  readsAttributeIn(functionNode) {
    return this.#attributeReads.includes(functionNode)
  }

  get #attributeReads() {
    return this.#cachedAttributeReads ??= new ExecutedAttributeReads(this.#root)
  }
}

class ExecutedAttributeReads {
  #bindings
  #functions = new WeakSet()

  constructor(root) {
    this.#bindings = new ClassThisBindings(root)
    for (const node of nodesIn(root)) this.#index(node)
  }

  includes(functionNode) {
    return this.#functions.has(functionNode)
  }

  #index(node) {
    const receiver = attributeReceiverOf(node)
    const functionNode = receiver && this.#bindings.methodFunctionOf(receiver)
    if (functionNode && this.#bindings.isExecutedBy(receiver, functionNode)) this.#functions.add(functionNode)
  }
}

function attributeReceiverOf(node) {
  if (node.type !== "CallExpression" || node.callee.type !== "MemberExpression") return null
  return isThisAttributeReader(node.callee) ? node.callee.object : null
}

function isThisAttributeReader(member) {
  return member.object.type === "ThisExpression" && ATTRIBUTE_READERS.has(calleeMemberName(member))
}

class NamedFunction {
  #node
  #facts
  #subject

  constructor(node, facts) {
    this.#node = node
    this.#facts = facts
    this.#subject = facts.subjectOf(node)
  }

  get problem() {
    if (this.#isMisnamedBoolean) {
      return {
        node: this.#subject.nameNode,
        messageId: "booleanName",
        data: { name: this.#name, pascal: capitalize(this.#name) }
      }
    } else {
      return null
    }
  }

  get #isMisnamedBoolean() {
    return this.#subject.isEligible && Boolean(this.#name) && !isBooleanName(this.#name)
      && this.#returnsBoolean && !this.#reflectsAttribute
  }

  get #name() {
    return this.#subject.name
  }

  get #returnsBoolean() {
    return this.#facts.returnsBooleanFrom(this.#subject.functionNode)
  }

  get #reflectsAttribute() {
    return this.#isGetter && this.#isInsideElementClass && this.#readsAttribute
  }

  get #isGetter() {
    return this.#node.type === "MethodDefinition" && this.#node.kind === "get"
  }

  get #isInsideElementClass() {
    return extendsElementNamedBase(this.#node.parent.parent)
  }

  get #readsAttribute() {
    return this.#facts.readsAttributeIn(this.#subject.functionNode)
  }
}
