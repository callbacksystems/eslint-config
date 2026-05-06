// A value threaded through many functions is instance state in disguise: whether built once (`const x = build(); a(x);
// b(x)`) or received as a parameter and passed down a pipeline (`f(node) { g(node) }; g(node) { h(node) }`), it reads
// better as a class holding it as a field, with the functions becoming methods. We follow each binding by VALUE: every
// function it is passed to as an explicit argument, then (through that callee's matching parameter) wherever it flows
// next. Following the value (not the name) keeps a genuinely threaded value apart from an unrelated parameter that
// merely shares its name. What is counted is the functions that *receive* the value, not the one that first held it. A
// value used only as a callback (`list.map(handle)`), as a receiver (`x.run()`), or returned never counts. The flow is
// not followed through a recursive function: there the value is a moving cursor over a structure, not one value held as
// state.

import { BindingResolver } from "#helpers/scope/binding_resolver"
import { CallArguments } from "#helpers/functions/call_arguments"
import { ExecutedCalls } from "#helpers/functions/executed_calls"
import { isFunction, parameterIdentifier, positionalParameterAt } from "#helpers/syntax/functions"
import { recursiveSubjectsIn } from "#helpers/functions/recursion"
import { isReassignment } from "#helpers/scope/references"
import { reportProblem } from "#helpers/eslint/report"
import { ThreadedReachIndex } from "#helpers/functions/threaded_reach_index"

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
    defaultOptions: [ { minFunctions: 4 } ],
    messages: {
      threadedState: "`{{name}}` is threaded through at least {{count}} functions. Make it the state of a class."
    }
  },
  create(context) {
    const { minFunctions } = context.options[0]
    const index = new FunctionIndex(context.sourceCode)
    return {
      "Program:exit"() {
        index.rootsIn(subjectVariablesIn(context.sourceCode)).forEach((variable) =>
          reportProblem(context, new ThreadedValue(variable, index, minFunctions)))
      }
    }
  }
}

class FunctionIndex {
  #bindings
  #recursive
  #recursiveSubjects
  #flows = new WeakMap()
  #reaches = new Map()

  constructor(sourceCode) {
    this.#bindings = new BindingResolver(sourceCode)
    this.#recursive = new CallCycles(sourceCode, this.#bindings).recursive
    this.#recursiveSubjects = recursiveVariablesIn(this.#recursive, sourceCode, this.#bindings)
  }

  rootsIn(variables) {
    const received = new Set(variables.flatMap((variable) => variable.references)
      .map((reference) => this.flowOf(reference))
      .map((flow) => this.parameterAt(flow?.functionNode, flow?.position))
      .filter(Boolean))
    return variables.filter((variable) => !received.has(variable))
  }

  flowOf(reference) {
    if (!this.#flows.has(reference)) this.#flows.set(reference, this.#flowFrom(reference))
    return this.#flows.get(reference)
  }

  parameterAt(functionNode, position) {
    if (!functionNode || this.#recursive.has(functionNode)) return null

    const parameter = positionalParameterAt(functionNode, position)
    const variable = parameter ? this.#bindings.variableFor(parameter) : null
    return isStableVariable(variable) ? variable : null
  }

  isRecursiveSubject(variable) {
    return this.#recursiveSubjects.has(variable)
  }

  calleesFrom(variable, { limit }) {
    if (!this.#reaches.has(limit)) this.#reaches.set(limit, new ThreadedReachIndex(this, limit))
    return this.#reaches.get(limit).calleesFrom(variable)
  }

  #flowFrom(reference) {
    const argument = reference.identifier
    const call = argument.parent
    return call?.type === "CallExpression" && call.callee.type === "Identifier"
      ? this.#flowThrough(call, argument)
      : null
  }

  #flowThrough(call, argument) {
    const functionNode = this.#bindings.functionFor(call.callee)
    const callee = functionNode ?? this.#bindings.variableFor(call.callee) ?? call.callee.name
    return { functionNode, callee, position: new CallArguments(call).stablePositionOf(argument) }
  }
}

class CallCycles {
  #calls

  constructor(sourceCode, bindings) {
    const functions = functionNodesIn(sourceCode)
    const calls = new ExecutedCalls(sourceCode)
    this.#calls = new Map(Array.from(functions,
      (node) => [ node, calleesAmong(calls.callsIn(node), functions, bindings) ]))
  }

  get recursive() {
    return new StrongComponents(this.#calls).cyclicNodes
  }
}

function functionNodesIn(sourceCode) {
  return new Set(sourceCode.scopeManager.scopes.flatMap((scope) => scope.variables)
    .flatMap((variable) => variable.defs)
    .map(functionNodeOf)
    .filter(Boolean))
}

function functionNodeOf(definition) {
  if (definition.type === "FunctionName") return definition.node
  if (definition.type === "Variable" && isFunction(definition.node.init)) return definition.node.init

  return null
}

function calleesAmong(calls, functions, bindings) {
  return new Set(calls.filter((call) => call.callee.type === "Identifier")
    .map((call) => bindings.functionFor(call.callee))
    .filter((callee) => functions.has(callee)))
}

class StrongComponents {
  #edges
  #reverse
  #visited = new Set()
  #finishOrder = []
  #cyclic = new Set()

  constructor(edges) {
    this.#edges = edges
    this.#reverse = new Map(Array.from(edges.keys(), (node) => [ node, new Set() ]))
    edges.forEach((callees, caller) => callees.forEach((callee) => this.#reverse.get(callee).add(caller)))
  }

  get cyclicNodes() {
    this.#edges.keys().forEach((node) => this.#finishFrom(node))
    this.#visited.clear()
    this.#finishOrder.toReversed().forEach((node) => this.#collectComponentFrom(node))
    return this.#cyclic
  }

  #finishFrom(start) {
    if (this.#visited.has(start)) return

    const pending = [ { node: start, isFinished: false } ]
    while (pending.length > 0) this.#visitFinishFrame(pending.pop(), pending)
  }

  #visitFinishFrame(frame, pending) {
    if (frame.isFinished) {
      this.#finishOrder.push(frame.node)
    } else if (!this.#visited.has(frame.node)) {
      this.#visited.add(frame.node)
      pending.push({ node: frame.node, isFinished: true })
      Array.from(this.#edges.get(frame.node)).toReversed()
        .forEach((callee) => {
          pending.push({ node: callee, isFinished: false })
        })
    }
  }

  #collectComponentFrom(start) {
    if (this.#visited.has(start)) return

    const component = new Set()
    this.#fillComponent(start, component)
    if (component.size > 1 || this.#edges.get(start).has(start)) {
      component.forEach((node) => this.#cyclic.add(node))
    }
  }

  #fillComponent(start, component) {
    const pending = [ start ]
    while (pending.length > 0) {
      const node = pending.pop()
      if (!this.#visited.has(node)) {
        this.#visited.add(node)
        component.add(node)
        this.#reverse.get(node).forEach((caller) => {
          pending.push(caller)
        })
      }
    }
  }
}

function recursiveVariablesIn(functions, sourceCode, bindings) {
  return new Set([ ...functions ].flatMap((node) => {
    const names = new Set(recursiveSubjectsIn(node, sourceCode))
    return node.params.map(parameterIdentifier).filter((parameter) => parameter && names.has(parameter.name))
      .map((parameter) => bindings.variableFor(parameter))
  }))
}

function isStableVariable(variable) {
  return variable?.defs.length === 1 && !variable.references.some(isReassignment)
}

function subjectVariablesIn(sourceCode) {
  return sourceCode.scopeManager.scopes.flatMap((scope) => scope.variables).filter(isSubjectVariable)
}

function isSubjectVariable(variable) {
  return isStableVariable(variable) && SUBJECT_DEF_TYPES.has(variable.defs[0].type)
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
    if (this.#index.isRecursiveSubject(this.#variable)) return null

    const reached = this.#index.calleesFrom(this.#variable, { limit: this.#minFunctions })
    return reached.size >= this.#minFunctions
      ? { node: this.#definition, messageId: "threadedState", data: { name: this.#variable.name, count: reached.size } }
      : null
  }

  get #definition() {
    return this.#variable.defs[0].name
  }
}
