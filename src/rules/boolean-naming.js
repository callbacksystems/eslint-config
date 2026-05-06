// A method, getter, or function that returns a boolean should read as a
// predicate: an `is`/`has`/`can`/`should`/... prefix for state, or a
// third-person verb (`includes`, `forwards`) for an action or relation. A bare
// adjective or noun (`valid`, `redundant`) reads as a value, not a question.

import { enclosingFunction, isReturnWithValue, walk } from "#helpers/ast"
import { MemberSubject } from "#helpers/member-subject"
import { capitalize, isBooleanName, isPredicateName } from "#helpers/naming"
import { reportProblem } from "#helpers/report"

const COMPARISON_OPERATORS = new Set([ "===", "!==", "==", "!=", "<", "<=", ">", ">=", "instanceof", "in" ])
const BOOLEAN_METHODS = new Set([
  "includes", "has", "test", "every", "some", "startsWith", "endsWith", "isArray", "isInteger", "matches"
])
const BOOLEAN_BY_TYPE = {
  Literal: (node) => typeof node.value === "boolean",
  UnaryExpression: (node) => node.operator === "!",
  BinaryExpression: (node) => COMPARISON_OPERATORS.has(node.operator),
  LogicalExpression: (node) => [ node.left, node.right ].some(isBooleanExpression),
  ConditionalExpression: (node) => [ node.consequent, node.alternate ].every(isBooleanExpression),
  CallExpression: (node) => isBooleanCall(node.callee),
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
    return {
      MethodDefinition(node) {
        if (node.kind !== "set") reportProblem(context, new NamedFunction(node))
      },
      PropertyDefinition: (node) => reportProblem(context, new NamedFunction(node)),
      FunctionDeclaration: (node) => reportProblem(context, new NamedFunction(node))
    }
  }
}

function isBooleanExpression(node) {
  return Boolean(node) && Boolean(BOOLEAN_BY_TYPE[node.type]?.(node))
}

function isBooleanCall(callee) {
  const called = nameOf(callee)
  return called === "Boolean" || isPredicateName(called) || BOOLEAN_METHODS.has(called)
}

function nameOf(callee) {
  return callee.type === "Identifier" ? callee.name : memberNameOf(callee)
}

function memberNameOf(callee) {
  return callee.type === "MemberExpression" ? propertyNameOf(callee) : ""
}

function propertyNameOf(node) {
  return node.property.type === "Identifier" || node.property.type === "PrivateIdentifier" ? node.property.name : ""
}

class NamedFunction {
  #subject

  constructor(node) {
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
    return this.#subject.isEligible && Boolean(this.#name) && !isBooleanName(this.#name) && this.#returnsBoolean
  }

  get #name() {
    return this.#subject.name
  }

  get #returnsBoolean() {
    const returned = this.#returnedValues
    return returned.length > 0 && returned.every(isBooleanExpression)
  }

  get #returnedValues() {
    const { body } = this.#subject.functionNode
    return body.type === "BlockStatement" ? this.#ownReturnArguments : [ body ]
  }

  get #ownReturnArguments() {
    const { functionNode } = this.#subject
    return Array.from(walk(functionNode.body))
      .filter((node) => isReturnWithValue(node) && enclosingFunction(node) === functionNode)
      .map((node) => node.argument)
  }
}
