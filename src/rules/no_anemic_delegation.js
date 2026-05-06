// A function or private method whose body just builds an object and forwards to it (`return new
// ScopeBody(body).eagerLoading()`), threading its own parameters straight into the constructor, adds indirection
// without value: inline the call. Exported functions and public methods are an API and are left alone; a method
// predicate (`isValid`) is a semantic facade on its object and is left alone too, but a free predicate function is just
// callback plumbing.

import { propertyNameOf } from "#helpers/syntax/classes"
import { FunctionSubject } from "#helpers/functions/function_subject"
import { identifierParameterNames, soleStatementOf } from "#helpers/syntax/functions"
import { MethodSubject } from "#helpers/classes/method_subject"
import { ModuleView } from "#helpers/flow/module_view"
import { isPascalCase } from "#helpers/strings/naming"
import { reportProblem } from "#helpers/eslint/report"
import { PredicateFunctions } from "#helpers/flow/predicate_functions"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow functions or private methods that only delegate to a freshly built object" },
    schema: [],
    messages: { anemicDelegation: "`{{name}}` only delegates to a new `{{className}}`. Inline the call." }
  },
  create(context) {
    const view = new ModuleView(context.sourceCode)
    const predicates = new PredicateFunctions(context.sourceCode)
    return {
      MethodDefinition: (node) => reportProblem(context, new Delegation(new DelegatingMethodSubject(node, predicates))),
      FunctionDeclaration: (node) => reportProblem(context, new Delegation(new FunctionSubject(node, view)))
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

  get #isAnemic() {
    return this.#subject.isEligible && this.#isDelegationToNewInstance && this.#isConstructedFromParameters
  }

  get #isDelegationToNewInstance() {
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

  #isParameter(argument) {
    return argument.type === "Identifier" && this.#parameterNames.has(argument.name)
  }

  get #parameterNames() {
    return this.#cachedParameterNames ??= identifierParameterNames(this.#subject.params)
  }

  get #data() {
    return { name: this.#subject.name, className: this.#instantiation.callee.name }
  }
}

function memberAccessIn(expression) {
  const member = expression?.type === "CallExpression" ? expression.callee : expression
  return isNamedMember(member) ? member : null
}

function isNamedMember(node) {
  return node?.type === "MemberExpression" && Boolean(propertyNameOf(node))
}

class DelegatingMethodSubject extends MethodSubject {
  #predicates

  constructor(node, predicates) {
    super(node)
    this.#predicates = predicates
  }

  get isEligible() {
    return this.kind === "method" && this.isPrivate && !this.isAsync && !this.isGenerator
      && !this.#predicates.includes(this.functionNode, this.nameNode.name)
  }
}
