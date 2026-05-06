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

import { isComparison, nodesIn } from "#helpers/ast"
import { enclosingClass, propertyNameOf } from "#helpers/classes"
import { extendsElementNamedBase } from "#helpers/dom"
import { hasBareReturn, ownReturnArguments } from "#helpers/functions"
import { CalleeResolver } from "#helpers/callee_resolver"
import { MemberSubject } from "#helpers/member_subject"
import { capitalize, isBooleanName, isPredicateName } from "#helpers/naming"
import { reportProblem } from "#helpers/report"

const BOOLEAN_METHODS = new Set([
  "includes", "has", "test", "every", "some", "startsWith", "endsWith", "isArray", "isInteger", "matches"
])
const ATTRIBUTE_READERS = new Set([ "getAttribute", "hasAttribute" ])
const BOOLEAN_BY_TYPE = {
  Literal: (node) => typeof node.value === "boolean",
  UnaryExpression: (node) => node.operator === "!",
  BinaryExpression: isComparison,
  LogicalExpression: (node, check) => new Operands([ node.left, node.right ], check).isAnyBoolean,
  ConditionalExpression: (node, check) => new Operands([ node.consequent, node.alternate ], check).areAllBoolean,
  CallExpression: (node, check) => check.isBooleanCall(node),
  MemberExpression: (node) => isPredicateName(propertyNameOf(node)),
  Identifier: (node) => isPredicateName(node.name)
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Require boolean-returning methods to read as predicates (is/has prefix or a verb)" },
    schema: [],
    messages: { booleanName: "`{{name}}` returns a boolean; name it as a predicate (e.g. `is{{pascal}}`)." }
  },
  create(context) {
    const resolver = new CalleeResolver(context.sourceCode)
    return {
      MethodDefinition(node) {
        if (node.kind !== "set") reportProblem(context, new NamedFunction(node, resolver))
      },
      PropertyDefinition: (node) => reportProblem(context, new NamedFunction(node, resolver)),
      FunctionDeclaration: (node) => reportProblem(context, new NamedFunction(node, resolver))
    }
  }
}

class Operands {
  #nodes
  #check

  constructor(nodes, check) {
    this.#nodes = nodes
    this.#check = check
  }

  get isAnyBoolean() {
    return this.#nodes.some((node) => this.#check.isBoolean(node))
  }

  get areAllBoolean() {
    return this.#nodes.every((node) => this.#check.isBoolean(node))
  }
}

class NamedFunction {
  #node
  #resolver
  #subject

  constructor(node, resolver) {
    this.#node = node
    this.#resolver = resolver
    this.#subject = new MemberSubject(node)
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
    return new BooleanCheck(this.#resolver).returnsBooleanFrom(this.#subject.functionNode)
  }

  get #reflectsAttribute() {
    return this.#isGetter && this.#isInsideElementClass && this.#readsAttribute
  }

  get #isGetter() {
    return this.#node.type === "MethodDefinition" && this.#node.kind === "get"
  }

  get #isInsideElementClass() {
    return extendsElementNamedBase(enclosingClass(this.#node))
  }

  get #readsAttribute() {
    return nodesIn(this.#subject.functionNode.body).some(isAttributeRead)
  }
}

// Calls are followed into their own body, so a predicate delegating to a helper is judged by what that helper returns.
class BooleanCheck {
  #resolver
  #visited

  constructor(resolver, visited = new Set()) {
    this.#resolver = resolver
    this.#visited = visited
  }

  isBooleanCall(call) {
    return hasBooleanName(call.callee) || this.#resolvesToBooleanFunction(call)
  }

  // A method that acts and then reports (`commit()` ending in `return true`) reads as a command, not a question.
  returnsBooleanFrom(functionNode) {
    const returned = ownReturnArguments(functionNode)
    return returned.length > 0 && !hasBareReturn(functionNode) && returned.every((node) => this.isBoolean(node))
  }

  isBoolean(node) {
    return Boolean(node) && Boolean(BOOLEAN_BY_TYPE[node.type]?.(node, this))
  }

  #resolvesToBooleanFunction(call) {
    const functionNode = this.#resolver.functionFor(call.callee)
    return Boolean(functionNode) && !this.#visited.has(functionNode)
      && this.#afterVisiting(functionNode).returnsBooleanFrom(functionNode)
  }

  #afterVisiting(functionNode) {
    return new BooleanCheck(this.#resolver, new Set([ ...this.#visited, functionNode ]))
  }
}

function hasBooleanName(callee) {
  const name = calleeNameOf(callee)
  return name === "Boolean" || isPredicateName(name) || BOOLEAN_METHODS.has(name)
}

function calleeNameOf(callee) {
  return callee.type === "Identifier" ? callee.name : memberNameOf(callee)
}

function memberNameOf(callee) {
  return callee.type === "MemberExpression" ? propertyNameOf(callee) : ""
}

function isAttributeRead(node) {
  return node.type === "CallExpression"
    && node.callee.type === "MemberExpression"
    && ATTRIBUTE_READERS.has(propertyNameOf(node.callee))
}
