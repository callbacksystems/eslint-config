// A function or private method whose body just builds an object and forwards to it
// (`return new ScopeBody(body).eagerLoading()`), threading its own parameters straight into the constructor, adds
// indirection without value: inline the call. Exported functions and public methods are an API and are left alone; a
// method predicate (`isValid`) is a semantic facade on its object and is left alone too, but a free predicate function
// is just callback plumbing.

import { memberName } from "#helpers/classes"
import { identifierParameterNames, soleStatementOf } from "#helpers/functions"
import { isBooleanName, isPascalCase } from "#helpers/naming"
import { reportProblem } from "#helpers/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow functions or private methods that only delegate to a freshly built object" },
    schema: [],
    messages: { anemicDelegation: "`{{name}}` only delegates to a new `{{className}}`. Inline the call." }
  },
  create(context) {
    return {
      MethodDefinition: (node) => reportProblem(context, new Delegation(new MethodSubject(node))),
      FunctionDeclaration: (node) => reportProblem(context, new Delegation(new FunctionSubject(node)))
    }
  }
}

class Delegation {
  #subject
  #cachedParameterNames

  constructor(subject) {
    this.#subject = subject
  }

  get problem() {
    return this.#isAnemic
      ? { node: this.#subject.nameNode, messageId: "anemicDelegation", data: this.#data }
      : null
  }

  #isParameter(argument) {
    return argument.type === "Identifier" && this.#parameterNames.has(argument.name)
  }

  get #isAnemic() {
    return this.#subject.isEligible && this.#delegatesToNewInstance && this.#isConstructedFromParameters
  }

  get #delegatesToNewInstance() {
    return isPascalCase(this.#instantiation?.callee.name)
  }

  get #instantiation() {
    const member = memberAccessIn(this.#returnedExpression)
    return member?.object.type === "NewExpression" ? member.object : null
  }

  get #returnedExpression() {
    const statement = this.#soleStatement
    return statement?.type === "ReturnStatement" ? statement.argument : null
  }

  get #soleStatement() {
    return soleStatementOf(this.#subject.body)
  }

  get #isConstructedFromParameters() {
    return this.#instantiation.arguments.every((argument) => this.#isParameter(argument))
  }

  get #data() {
    return { name: this.#subject.name, className: this.#instantiation.callee.name }
  }

  get #parameterNames() {
    return this.#cachedParameterNames ??= identifierParameterNames(this.#subject.params)
  }
}

function memberAccessIn(expression) {
  const member = expression?.type === "CallExpression" ? expression.callee : expression
  return isNamedMember(member) ? member : null
}

function isNamedMember(node) {
  return node?.type === "MemberExpression" && node.property.type === "Identifier"
}

class MethodSubject {
  #node

  constructor(node) {
    this.#node = node
  }

  get nameNode() {
    return this.#node.key
  }

  get name() {
    return memberName(this.#node)
  }

  get params() {
    return this.#node.value.params
  }

  get body() {
    return this.#node.value.body
  }

  // A predicate names a question on the object and earns its keep even as a one-line facade.
  get isEligible() {
    const { key, kind } = this.#node
    return kind === "method" && key.type === "PrivateIdentifier" && !isBooleanName(key.name)
  }
}

class FunctionSubject {
  #node

  constructor(node) {
    this.#node = node
  }

  get nameNode() {
    return this.#node.id
  }

  get name() {
    return this.#node.id.name
  }

  get params() {
    return this.#node.params
  }

  get body() {
    return this.#node.body
  }

  // Module-internal only: an exported function is public API.
  get isEligible() {
    return this.#node.parent?.type !== "ExportNamedDeclaration"
  }
}
