// A value derived at every recursive step is a cursor, not object state. Follow that cursor through local calls so
// downstream parameters are exempt too, without exempting unrelated parameters that merely share its name.

import { BindingResolver } from "#helpers/scope/binding_resolver"
import { CalleeResolver } from "#helpers/scope/callee_resolver"
import { CallArguments } from "#helpers/functions/call_arguments"
import { parameterIdentifier, positionalParameterAt } from "#helpers/syntax/functions"
import { recursiveSubjectsIn } from "#helpers/functions/recursion"

export class RecursiveExemptions {
  #functions
  #sourceCode
  #bindings
  #resolver
  #argumentSites = new ArgumentSites()
  #cachedVariables
  #pending = []

  constructor(functions, sourceCode) {
    this.#functions = new Set(functions)
    this.#sourceCode = sourceCode
    this.#bindings = new BindingResolver(sourceCode)
    this.#resolver = new CalleeResolver(sourceCode)
  }

  namesFor(functionNode) {
    return new Set(parameterIdentifiersIn(functionNode)
      .filter((identifier) => this.#variables.has(this.#bindings.variableFor(identifier)))
      .map((identifier) => identifier.name))
  }

  get #variables() {
    if (!this.#cachedVariables) {
      this.#cachedVariables = this.#seedVariables
      this.#spreadVariables()
    }
    return this.#cachedVariables
  }

  get #seedVariables() {
    return new Set(Array.from(this.#functions).flatMap((functionNode) => {
      const recursiveNames = new Set(recursiveSubjectsIn(functionNode, this.#sourceCode))
      return parameterIdentifiersIn(functionNode)
        .filter((identifier) => recursiveNames.has(identifier.name))
        .map((identifier) => this.#bindings.variableFor(identifier))
        .filter(Boolean)
    }))
  }

  #spreadVariables() {
    this.#pending = Array.from(this.#cachedVariables)
    while (this.#pending.length > 0) this.#spreadFrom(this.#pending.pop())
  }

  #spreadFrom(variable) {
    variable.references.map((reference) => this.#nextVariableFor(reference.identifier)).filter(Boolean)
      .forEach((next) => this.#remember(next))
  }

  #nextVariableFor(identifier) {
    const site = this.#argumentSites.siteFor(identifier)
    return site ? this.#variableAt(site) : null
  }

  #variableAt(site) {
    const functionNode = this.#resolver.functionFor(site.call.callee)
    return this.#functions.has(functionNode) ? this.#parameterVariableAt(functionNode, site.position) : null
  }

  #parameterVariableAt(functionNode, position) {
    const parameter = positionalParameterAt(functionNode, position)
    return parameter ? this.#bindings.variableFor(parameter) : null
  }

  #remember(variable) {
    if (!this.#cachedVariables.has(variable)) {
      this.#cachedVariables.add(variable)
      this.#pending.push(variable)
    }
  }
}

class ArgumentSites {
  siteFor(identifier) {
    const argument = enclosingArgumentOf(identifier)
    const call = argument.parent
    if (call?.type !== "CallExpression") return null

    const position = new CallArguments(call).stablePositionOf(argument)
    return position === -1 ? null : { call, position }
  }
}

function enclosingArgumentOf(identifier) {
  let argument = identifier
  while (argument.parent?.type === "MemberExpression" && argument.parent.object === argument) argument = argument.parent
  return argument.parent?.type === "ChainExpression" ? argument.parent : argument
}

function parameterIdentifiersIn(functionNode) {
  return functionNode.params.map(parameterIdentifier).filter(Boolean)
}
