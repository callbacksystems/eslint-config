// A value that differs at every step of a recursion cannot be a field, so the rules that would advise one leave it
// alone. Both shapes are read off calls proven to resolve to the function being analyzed.

import { BindingResolver } from "#helpers/scope/binding_resolver"
import { CalleeResolver } from "#helpers/scope/callee_resolver"
import { ExecutedCalls } from "#helpers/functions/executed_calls"
import { parameterIdentifier } from "#helpers/syntax/functions"

export function recursiveSubjectsIn(functionNode, sourceCode) {
  return new Recursion(functionNode, sourceCode).names
}

class Recursion {
  #function
  #bindings
  #resolver
  #calls
  #cachedParameters
  #cachedSelfCalls

  constructor(functionNode, sourceCode) {
    this.#function = functionNode
    this.#bindings = new BindingResolver(sourceCode)
    this.#resolver = new CalleeResolver(sourceCode)
    this.#calls = new ExecutedCalls(sourceCode)
  }

  get names() {
    return [ ...this.#directNames, ...this.#shiftedNames ]
  }

  get #directNames() {
    return this.#selfCalls.flatMap((call) => this.#directNamesIn(call))
  }

  get #selfCalls() {
    return this.#cachedSelfCalls ??= this.#calls.callsIn(this.#function).filter((node) => this.#isSelfCall(node))
  }

  #isSelfCall(node) {
    return this.#resolver.functionFor(node.callee) === this.#function
  }

  #directNamesIn(call) {
    return call.arguments.map(rootIdentifierOfMember).filter(Boolean)
      .map((identifier) => this.#parameterFor(identifier)).filter(Boolean)
      .map((parameter) => parameter.name)
  }

  #parameterFor(identifier) {
    return this.#parameters.get(this.#bindings.variableFor(identifier)) ?? null
  }

  // Only a plain identifier can shift, since a destructured parameter has no single name to move.
  get #parameters() {
    return this.#cachedParameters ??= new Map(this.#function.params.flatMap((pattern, position) => {
      const parameter = parameterIdentifier(pattern)
      const variable = parameter ? this.#bindings.variableFor(parameter) : null
      return variable ? [ [ variable, { name: variable.name, variable, position } ] ] : []
    }))
  }

  get #shiftedNames() {
    return this.#selfCalls.flatMap((call) => this.#shiftedIn(call))
  }

  #shiftedIn(call) {
    const spreadPosition = call.arguments.findIndex((argument) => argument.type === "SpreadElement")
    const fixedArguments = spreadPosition === -1 ? call.arguments : call.arguments.slice(0, spreadPosition)
    return fixedArguments.flatMap((argument, index) => {
      const parameter = isIdentifier(argument) ? this.#parameterFor(argument) : null
      return parameter && parameter.position !== index ? [ parameter.name ] : []
    })
  }
}

function rootIdentifierOfMember(node) {
  let current = node.type === "ChainExpression" ? node.expression : node
  while (current.type === "MemberExpression") {
    if (current.object.type === "Identifier") return current.object

    current = current.object.type === "ChainExpression" ? current.object.expression : current.object
  }

  return null
}

function isIdentifier(node) {
  return node.type === "Identifier"
}
