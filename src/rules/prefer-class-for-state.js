// A value threaded through many functions is instance state in disguise: whether built once
// (`const x = build(); a(x); b(x)`) or received as a parameter and passed down a pipeline
// (`f(node) { g(node) }; g(node) { h(node) }`), it reads better as a class holding it as a field, with the functions
// becoming methods. We follow each binding by VALUE: every function it is passed to as an explicit argument, then
// (through that callee's matching parameter) wherever it flows next. Following the value (not the name) keeps a
// genuinely threaded value apart from an unrelated parameter that merely shares its name. What is counted is the
// functions that *receive* the value, not the one that first held it. A value used only as a callback
// (`list.map(handle)`), as a receiver (`x.run()`), or returned never counts. The flow is not followed through a
// recursive function: there the value is a moving cursor over a structure, not one value held as state.

import { walk } from "#helpers/ast"
import { reportProblem } from "#helpers/report"

const DEFAULT_MIN_FUNCTIONS = 4
const SUBJECT_DEF_TYPES = new Set([ "Parameter", "Variable" ])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Detect a value threaded through many functions; prefer a class holding it as state" },
    schema: [ {
      type: "object",
      properties: { minFunctions: { type: "integer", minimum: 2 } },
      additionalProperties: false
    } ],
    messages: { threadedState: "`{{name}}` is threaded through {{count}} functions. Make it the state of a class." }
  },
  create(context) {
    const minFunctions = context.options[0]?.minFunctions ?? DEFAULT_MIN_FUNCTIONS
    const index = new FunctionIndex(context.sourceCode)
    return {
      "Program:exit"() {
        subjectVariablesIn(context.sourceCode).forEach((variable) =>
          reportProblem(context, new ThreadedValue(variable, index, minFunctions)))
      }
    }
  }
}

class FunctionIndex {
  #byName
  #scopeManager
  #recursive

  constructor(sourceCode) {
    this.#byName = new Map(functionDeclarationsIn(sourceCode).map((node) => [ node.id.name, node ]))
    this.#scopeManager = sourceCode.scopeManager
    this.#recursive = new CallCycles(this.#byName).recursive
  }

  parameterAt(name, position) {
    if (this.#recursive.has(name)) return null

    const node = this.#byName.get(name)
    const parameter = node?.params[position]
    return parameter?.type === "Identifier" ? this.#variableOf(node, parameter) : null
  }

  #variableOf(node, parameter) {
    return this.#scopeManager.acquire(node)?.variables.find((variable) => variable.name === parameter.name) ?? null
  }
}

function functionDeclarationsIn(sourceCode) {
  return sourceCode.scopeManager.scopes
    .map((scope) => scope.block)
    .filter((block) => block.type === "FunctionDeclaration" && block.id)
}

class CallCycles {
  #calls

  constructor(byName) {
    this.#calls = new Map([ ...byName ].map(([ name, node ]) => [ name, calleesIn(node, byName) ]))
  }

  get recursive() {
    return new Set([ ...this.#calls.keys() ].filter((name) => this.#reaches(name, name, new Set())))
  }

  #reaches(from, target, seen) {
    if (seen.has(from)) return false

    seen.add(from)
    return [ ...this.#calls.get(from) ].some((callee) => callee === target || this.#reaches(callee, target, seen))
  }
}

function calleesIn(node, byName) {
  return new Set(Array.from(walk(node.body))
    .filter((inner) => inner.type === "CallExpression" && inner.callee.type === "Identifier")
    .map((inner) => inner.callee.name)
    .filter((name) => byName.has(name)))
}

function subjectVariablesIn(sourceCode) {
  return sourceCode.scopeManager.scopes.flatMap((scope) => scope.variables).filter(isSubjectVariable)
}

function isSubjectVariable(variable) {
  return variable.defs.length > 0 && SUBJECT_DEF_TYPES.has(variable.defs[0].type)
}

class ThreadedValue {
  #variable
  #index
  #minFunctions

  constructor(variable, index, minFunctions) {
    this.#variable = variable
    this.#index = index
    this.#minFunctions = minFunctions
  }

  get problem() {
    const reached = this.#reach(this.#variable, new Set())
    return reached.size >= this.#minFunctions
      ? { node: this.#definition, messageId: "threadedState", data: { name: this.#variable.name, count: reached.size } }
      : null
  }

  #reach(variable, callees) {
    variable.references.forEach((reference) => this.#follow(reference, callees))
    return callees
  }

  #follow(reference, callees) {
    const flow = threadingFlowOf(reference)
    if (flow && !callees.has(flow.callee)) {
      callees.add(flow.callee)
      const parameter = this.#index.parameterAt(flow.callee, flow.position)
      if (parameter) this.#reach(parameter, callees)
    }
  }

  get #definition() {
    return this.#variable.defs[0].name
  }
}

function threadingFlowOf(reference) {
  const argument = reference.identifier
  const call = argument.parent
  if (call?.type !== "CallExpression" || call.callee.type !== "Identifier") return null

  const position = call.arguments.indexOf(argument)
  return position === -1 ? null : { callee: call.callee.name, position }
}
