// A data clump is a set of argument names that travel together across a module's
// functions, regardless of the order they appear in, or how many arguments any
// one function takes. We find them as connected components in the co-occurrence
// graph of shared parameter names: names used by two or more functions, linked
// whenever they share a function. A component that reaches enough functions is
// the object those functions should hold as state instead of passing the values
// around. A lone name that spreads far enough counts too. Public surface is left
// out: exported functions and public class methods answer to an interface, not
// internal threading, so only non-exported functions and private (`#`) methods are
// analyzed. The recursion subject (`walk(node[key], node)`) is exempt too, as it
// changes at every step.

import { walk } from "#helpers/ast"
import { reportProblems } from "#helpers/report"

const DEFAULT_MIN_FUNCTIONS = 3
const DEFAULT_MIN_FUNCTIONS_FOR_SINGLE_PARAM = 6
const MIN_SHARING_FUNCTIONS = 2

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Detect argument names that travel together across functions; prefer a class holding them" },
    schema: [ {
      type: "object",
      properties: {
        minFunctions: { type: "integer", minimum: 2 },
        minFunctionsForSingleParam: { type: "integer", minimum: 2 }
      },
      additionalProperties: false
    } ],
    messages: {
      parameterClump: "{{count}} functions pass [{{parameters}}] around. Make them a class holding these as state."
    }
  },
  create(context) {
    return { "Program:exit": (node) => reportProblems(context, new ModuleClumps(node, limitsFrom(context.options[0]))) }
  }
}

class ModuleClumps {
  #programNode
  #limits

  constructor(programNode, limits) {
    this.#programNode = programNode
    this.#limits = limits
  }

  get problems() {
    const sourceModule = new SourceModule(this.#programNode)
    const exempt = sourceModule.exemptNames
    return sourceModule.functionGroups.flatMap((functions) => this.#problemFor(functions, exempt))
  }

  #problemFor(functions, exempt) {
    const { clump } = new ClumpSearch(internalFunctions(functions), exempt, this.#limits)
    return clump
      ? [ {
        node: clump.node,
        messageId: "parameterClump",
        data: { count: clump.count, parameters: clump.parameters.join(", ") }
      } ]
      : []
  }
}

class SourceModule {
  #ast
  #cachedNodes

  constructor(ast) {
    this.#ast = ast
  }

  get functionGroups() {
    return [ this.#topLevelFunctions, ...this.#methodGroups ]
  }

  get exemptNames() {
    return new Set(this.#nodes.flatMap(callSubjectsIn))
  }

  get #topLevelFunctions() {
    return this.#ast.body.map(unwrapFunction).filter(Boolean)
  }

  get #methodGroups() {
    return this.#nodes.filter(isClassBody).map(methodsOf)
  }

  get #nodes() {
    return this.#cachedNodes ??= Array.from(walk(this.#ast))
  }
}

function callSubjectsIn(node) {
  if (node.type !== "CallExpression") return []

  const identifiers = new Set(node.arguments.filter(isIdentifier).map((argument) => argument.name))
  return node.arguments
    .filter(isMemberOfIdentifier)
    .map((argument) => argument.object.name)
    .filter((name) => identifiers.has(name))
}

function isIdentifier(node) {
  return node.type === "Identifier"
}

function isMemberOfIdentifier(node) {
  return node.type === "MemberExpression" && node.object.type === "Identifier"
}

function unwrapFunction(statement) {
  const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement
  return declaration?.type === "FunctionDeclaration" ? declaration : null
}

function isClassBody(node) {
  return node.type === "ClassBody"
}

function methodsOf(classBody) {
  return classBody.body.filter(isPrivateMethod).map((member) => member.value)
}

function isPrivateMethod(member) {
  return isMethodFunction(member) && member.key.type === "PrivateIdentifier"
}

function isMethodFunction(member) {
  return member.type === "MethodDefinition" && member.kind !== "constructor"
}

class ClumpSearch {
  #functions
  #exempt
  #limits
  #cachedSignatures

  constructor(functions, exempt, limits) {
    this.#functions = functions
    this.#exempt = exempt
    this.#limits = limits
  }

  get clump() {
    return this.#candidates.sort(byReach).at(0) ?? null
  }

  #clumpFor(names) {
    const reached = this.#functionsReaching(names)
    return reached.length >= this.#minReach(names) ? [ clumpOf(reached, names) ] : []
  }

  #functionsReaching(names) {
    const wanted = new Set(names)
    return this.#signatures.filter((signature) => signature.sharesAny(wanted)).map((signature) => signature.node)
  }

  #minReach(names) {
    return names.length > 1 ? this.#limits.minFunctions : this.#limits.minFunctionsForSingleParam
  }

  get #candidates() {
    return new Graph(this.#sharedNames, this.#signatures).components.flatMap((names) => this.#clumpFor(names))
  }

  get #sharedNames() {
    return [ ...nameCountsIn(this.#signatures) ].filter(isShared).map(nameOf)
  }

  get #signatures() {
    return this.#cachedSignatures ??= this.#functions.map((node) => new Signature(node, this.#exempt))
  }
}

function byReach(first, second) {
  return second.count - first.count || second.parameters.length - first.parameters.length
}

function clumpOf(functions, names) {
  return { node: functions[0], count: functions.length, parameters: [ ...names ].sort() }
}

class Graph {
  #adjacency

  constructor(sharedNames, signatures) {
    this.#adjacency = new Map(sharedNames.map((name) => [ name, new Set() ]))
    signatures.forEach((signature) => this.#link(signature.names))
  }

  get components() {
    const seen = new Set()
    return [ ...this.#adjacency.keys() ].flatMap((name) => seen.has(name) ? [] : [ this.#componentFrom(name, seen) ])
  }

  #link(names) {
    const shared = names.filter((name) => this.#adjacency.has(name))
    shared.forEach((name) => shared.forEach((other) => this.#connect(name, other)))
  }

  #connect(name, other) {
    if (name !== other) this.#adjacency.get(name).add(other)
  }

  #componentFrom(name, seen) {
    if (seen.has(name)) return []

    seen.add(name)
    return [ name, ...[ ...this.#adjacency.get(name) ].flatMap((other) => this.#componentFrom(other, seen)) ]
  }
}

function nameCountsIn(signatures) {
  return signatures.flatMap((signature) => signature.names).reduce(tally, new Map())
}

function tally(counts, name) {
  return counts.set(name, (counts.get(name) ?? 0) + 1)
}

function isShared([ , count ]) {
  return count >= MIN_SHARING_FUNCTIONS
}

function nameOf([ name ]) {
  return name
}

class Signature {
  #function
  #exempt

  constructor(functionNode, exempt) {
    this.#function = functionNode
    this.#exempt = exempt
  }

  sharesAny(names) {
    return this.names.some((name) => names.has(name))
  }

  get names() {
    return [ ...new Set(this.#parameterNames) ].filter((name) => !this.#exempt.has(name))
  }

  get node() {
    return this.#function
  }

  get #parameterNames() {
    return this.#function.params.flatMap(namesInPattern).filter(isSignificant)
  }
}

function namesInPattern(pattern) {
  if (pattern.type === "Identifier") return [ pattern.name ]
  if (pattern.type === "AssignmentPattern") return namesInPattern(pattern.left)
  if (pattern.type === "ObjectPattern") return objectPatternNames(pattern)
  if (pattern.type === "RestElement") return namesInPattern(pattern.argument)
  return []
}

function objectPatternNames(pattern) {
  return pattern.properties.filter(isIdentifierProperty).map((property) => property.key.name)
}

function isIdentifierProperty(property) {
  return property.type === "Property" && property.key.type === "Identifier"
}

function isSignificant(name) {
  return name.length > 1
}

function internalFunctions(functions) {
  return functions.filter((node) => node.parent?.type !== "ExportNamedDeclaration")
}

function limitsFrom(options) {
  const {
    minFunctions = DEFAULT_MIN_FUNCTIONS,
    minFunctionsForSingleParam = DEFAULT_MIN_FUNCTIONS_FOR_SINGLE_PARAM
  } = options ?? {}
  return { minFunctions, minFunctionsForSingleParam }
}
