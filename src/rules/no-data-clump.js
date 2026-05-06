// A data clump is a set of argument names that travel together across a module's functions, regardless of the order
// they appear in, or how many arguments any one function takes. We find them as connected components in the
// co-occurrence graph of shared parameter names: names used by two or more functions, linked whenever they share a
// function. A component that reaches enough functions is the object those functions should hold as state instead of
// passing the values around. A lone name that spreads far enough counts too.
//
// Only functions carrying two or more of the names count toward a set: one name is a value arriving, not a concept
// being passed, and counting those bystanders would let a lone name clear the set threshold instead of its own higher
// one.
//
// How far a set has to spread depends on how much its shape already tells us. A signature repeated verbatim counts from
// two functions: nothing in those parameter lists explains the co-occurrence except the concept itself. Names that come
// with extras of their own might merely have met, so those need a third function, and a lone name has to spread further
// still.
//
// This sees parameter lists only. The same concept bagged into an object literal and reached into is the identical
// smell in another syntax, and belongs to `no-anemic-record`. Public surface is left out: exported functions and public
// class methods answer to an interface, not internal threading, so only non-exported functions and private (`#`)
// methods are analyzed. What a recursion moves is exempt too, since it is a different value at every step: see
// `#helpers/recursion` for the two shapes that say so.

import { walk } from "#helpers/ast"
import { functionNameOf } from "#helpers/functions"
import { callSubjectsIn, shiftedSubjectsIn } from "#helpers/recursion"
import { reportProblems } from "#helpers/report"

const DEFAULT_MIN_FUNCTIONS = 3
const DEFAULT_MIN_FUNCTIONS_FOR_REPEATED_SIGNATURE = 2
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
        minFunctionsForRepeatedSignature: { type: "integer", minimum: 2 },
        minFunctionsForSingleParam: { type: "integer", minimum: 2 }
      },
      additionalProperties: false
    } ],
    messages: {
      parameterClump: "{{functions}} all take [{{parameters}}]. Those values are one concept: "
        + "give it a class and let these become its methods.",
      parameterCluster: "{{functions}} thread [{{parameters}}] between them. Those values are one concept: "
        + "give it a class and let these become its methods."
    }
  },
  create(context) {
    return { "Program:exit": (node) => reportProblems(context, new ModuleClumps(node, new Limits(context.options[0]))) }
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
    return new ClumpSearch(internalFunctions(functions), exempt, this.#limits).clumps.map(problemIn)
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
    return new Set([ ...this.#nodes.flatMap(callSubjectsIn), ...this.#functions.flatMap(shiftedSubjectsIn) ])
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

  get #functions() {
    return this.functionGroups.flat()
  }
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

  // Components partition the shared names, so a module holding two of them is hiding two objects and each one is its
  // own report.
  get clumps() {
    return this.#candidates.filter((clump) => this.#limits.isReachedBy(clump)).sort(byPosition)
  }

  // Carrying exactly one is a value arriving, not a concept being passed around, and counting it would clear the wrong
  // threshold.
  #signaturesReaching(names) {
    const wanted = new Set(names)
    const enough = names.length > 1 ? 2 : 1
    return this.#signatures.filter((signature) => signature.sharedCountIn(wanted) >= enough)
  }

  get #candidates() {
    return new Graph(this.#sharedNames, this.#signatures).components
      .map((names) => new Clump(this.#signaturesReaching(names), names))
  }

  get #sharedNames() {
    return [ ...nameCountsIn(this.#signatures) ].filter(isShared).map(nameOf)
  }

  get #signatures() {
    return this.#cachedSignatures ??= this.#functions.map((node) => new Signature(node, this.#exempt))
  }
}

function byPosition(first, second) {
  return first.node.range[0] - second.node.range[0]
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

class Clump {
  #signatures
  #names

  constructor(signatures, names) {
    this.#signatures = signatures
    this.#names = names
  }

  get problem() {
    return {
      node: this.node,
      messageId: this.#isTight ? "parameterClump" : "parameterCluster",
      data: { functions: this.#functionList, parameters: this.parameters.join(", ") }
    }
  }

  get node() {
    return this.#signatures[0].node
  }

  get parameters() {
    return [ ...this.#names ].sort()
  }

  get count() {
    return this.#signatures.length
  }

  // Stronger than tight: the functions take the set and nothing besides.
  get isRepeated() {
    return new Set(this.#signatures.map(sortedNamesOf)).size === 1
  }

  // Every function takes the whole set rather than overlapping subsets. Same refactor either way, but the report should
  // not claim the wrong one.
  get #isTight() {
    const wanted = new Set(this.#names)
    return this.#signatures.every((signature) => signature.sharedCountIn(wanted) === wanted.size)
  }

  get #functionList() {
    return this.#signatures.map(nameOfSignature).join(", ")
  }
}

function sortedNamesOf(signature) {
  return signature.names.toSorted().join(",")
}

function nameOfSignature(signature) {
  return signature.name
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

  sharedCountIn(names) {
    return this.names.filter((name) => names.has(name)).length
  }

  get names() {
    return [ ...new Set(this.#parameterNames) ].filter((name) => !this.#exempt.has(name))
  }

  get name() {
    return functionNameOf(this.#function)
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

function problemIn(clump) {
  return clump.problem
}

class Limits {
  #sharedCore
  #repeatedSignature
  #loneName

  constructor(options) {
    const {
      minFunctions = DEFAULT_MIN_FUNCTIONS,
      minFunctionsForRepeatedSignature = DEFAULT_MIN_FUNCTIONS_FOR_REPEATED_SIGNATURE,
      minFunctionsForSingleParam = DEFAULT_MIN_FUNCTIONS_FOR_SINGLE_PARAM
    } = options ?? {}
    this.#sharedCore = minFunctions
    this.#repeatedSignature = minFunctionsForRepeatedSignature
    this.#loneName = minFunctionsForSingleParam
  }

  isReachedBy(clump) {
    return clump.count >= this.#reachFor(clump)
  }

  #reachFor(clump) {
    return clump.parameters.length === 1 ? this.#loneName : this.#setReachFor(clump)
  }

  #setReachFor(clump) {
    return clump.isRepeated ? this.#repeatedSignature : this.#sharedCore
  }
}
