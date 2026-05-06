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
// `#helpers/functions/recursion` for the two shapes that say so.

import { nodesIn } from "#helpers/syntax/ast"
import { staticMemberKeyOf } from "#helpers/syntax/classes"
import { functionNameOf, isFunction } from "#helpers/syntax/functions"
import { ModuleView } from "#helpers/flow/module_view"
import { reportProblems } from "#helpers/eslint/report"
import { alphabetically, byNodePosition } from "#helpers/syntax/sorting"
import { RecursiveExemptions } from "#helpers/functions/recursive_exemptions"

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
    defaultOptions: [ { minFunctions: 3, minFunctionsForRepeatedSignature: 2, minFunctionsForSingleParam: 6 } ],
    messages: {
      parameterClump: "{{functions}} all take [{{parameters}}]. Those values are one concept: "
        + "give it a class and let these become its methods.",
      parameterCluster: "{{functions}} thread [{{parameters}}] between them. Those values are one concept: "
        + "give it a class and let these become its methods."
    }
  },
  create(context) {
    return {
      "Program:exit": () => reportProblems(context,
        new ModuleClumps(context.sourceCode, new Limits(context.options[0])))
    }
  }
}

class ModuleClumps {
  #sourceCode
  #limits

  constructor(sourceCode, limits) {
    this.#sourceCode = sourceCode
    this.#limits = limits
  }

  get problems() {
    const sourceModule = new SourceModule(this.#sourceCode)
    return sourceModule.internalFunctionGroups
      .flatMap((functions) => this.#problemFor(functions, sourceModule.exemptions))
  }

  #problemFor(functions, exemptions) {
    return new ClumpSearch(functions, exemptions, this.#limits).clumps.map(problemIn)
  }
}

class SourceModule {
  #sourceCode
  #view
  #cachedNodes
  #cachedExemptions

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
    this.#view = new ModuleView(this.#sourceCode)
  }

  get internalFunctionGroups() {
    return [ this.#internalTopLevelFunctions, ...this.#methodGroups ]
  }

  get exemptions() {
    return this.#cachedExemptions ??= new RecursiveExemptions(this.#functions, this.#sourceCode)
  }

  get #internalTopLevelFunctions() {
    return this.#topLevelFunctions.filter((node) => !this.#view.isExportedDeclaration(node))
  }

  get #topLevelFunctions() {
    return this.#sourceCode.ast.body.flatMap(functionsInStatement)
  }

  get #methodGroups() {
    return this.#nodes.filter(isClassBody).map(methodsOf)
  }

  get #nodes() {
    return this.#cachedNodes ??= Array.from(nodesIn(this.#sourceCode))
  }

  get #functions() {
    return this.internalFunctionGroups.flat()
  }
}

function functionsInStatement(statement) {
  const declaration = statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration"
    ? statement.declaration
    : statement
  if (declaration?.type === "FunctionDeclaration") return [ declaration ]
  if (declaration?.type !== "VariableDeclaration") return []

  return declaration.declarations.map((declarator) => declarator.init).filter(isFunction)
}

function isClassBody(node) {
  return node.type === "ClassBody"
}

function methodsOf(classBody) {
  return classBody.body.filter(isPrivateFunctionMember).map((member) => member.value)
}

function isPrivateFunctionMember(member) {
  return member.key?.type === "PrivateIdentifier" && isFunction(member.value)
}

class ClumpSearch {
  #functions
  #exemptions
  #limits
  #cachedIndex
  #cachedSignatures

  constructor(functions, exemptions, limits) {
    this.#functions = functions
    this.#exemptions = exemptions
    this.#limits = limits
  }

  // Each graph component is its own hidden object, so a module holding two clumps gets two reports.
  get clumps() {
    return this.#candidates.filter((clump) => this.#limits.isReachedBy(clump)).sort(byNodePosition)
  }

  get #candidates() {
    return new Graph(this.#signatureIndex.sharedNames, this.#signatures).components
      .map((names) => new Clump(this.#signatureIndex.signaturesReaching(names), names))
  }

  get #signatureIndex() {
    return this.#cachedIndex ??= new SignatureIndex(this.#signatures)
  }

  get #signatures() {
    return this.#cachedSignatures ??= this.#functions
      .map((node) => new Signature(node, this.#exemptions.namesFor(node)))
  }
}

class Graph {
  #adjacency

  constructor(sharedNames, signatures) {
    this.#adjacency = new Map(sharedNames.map((name) => [ name, new Set() ]))
    signatures.forEach((signature) => this.#link(signature.names))
  }

  get components() {
    const seen = new Set()
    return this.#adjacency.keys()
      .flatMap((name) => seen.has(name) ? [] : [ new Component(this.#adjacency, seen).from(name) ]).toArray()
  }

  #link(names) {
    const shared = names.filter((name) => this.#adjacency.has(name))
    shared.slice(1).forEach((name) => this.#connect(shared[0], name))
  }

  #connect(first, second) {
    this.#adjacency.get(first).add(second)
    this.#adjacency.get(second).add(first)
  }
}

class Component {
  #adjacency
  #seen
  #members = []

  constructor(adjacency, seen) {
    this.#adjacency = adjacency
    this.#seen = seen
  }

  from(name) {
    const pending = [ name ]
    while (pending.length > 0) this.#visit(pending.pop(), pending)
    return this.#members
  }

  #visit(name, pending) {
    if (this.#seen.has(name)) return

    this.#seen.add(name)
    this.#members.push(name)
    this.#adjacency.get(name).forEach((other) => {
      pending.push(other)
    })
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
    return [ ...this.#names ].sort(alphabetically)
  }

  get count() {
    return this.#signatures.length
  }

  // Stronger than tight, since the functions take the set and nothing besides.
  get isRepeated() {
    return new Set(this.#signatures.map(sortedNamesOf)).size === 1
  }

  // Overlapping subsets get the same refactor, but the report should not claim the wrong one.
  get #isTight() {
    const wanted = new Set(this.#names)
    return this.#signatures.every((signature) => signature.sharedCountIn(wanted) === wanted.size)
  }

  get #functionList() {
    return this.#signatures.map(nameOfSignature).join(", ")
  }
}

function sortedNamesOf(signature) {
  return signature.names.toSorted(alphabetically).join(",")
}

function nameOfSignature(signature) {
  return signature.name
}

class SignatureIndex {
  #byName = new Map()

  constructor(signatures) {
    signatures.forEach((signature) => this.#add(signature))
  }

  get sharedNames() {
    return this.#byName.entries()
      .filter(([ , signatures ]) => signatures.length >= MIN_SHARING_FUNCTIONS)
      .map(([ name ]) => name).toArray()
  }

  signaturesReaching(names) {
    const minimum = names.length > 1 ? 2 : 1
    return names.flatMap((name) => this.#byName.get(name) ?? []).reduce(tallySignatures, new Map()).entries()
      .filter(([ , count ]) => count >= minimum).map(([ signature ]) => signature).toArray().sort(byNodePosition)
  }

  #add(signature) {
    signature.names.forEach((name) => this.#addName(signature, name))
  }

  #addName(signature, name) {
    const signatures = this.#byName.get(name) ?? []
    signatures.push(signature)
    this.#byName.set(name, signatures)
  }
}

function tallySignatures(counts, signature) {
  return counts.set(signature, (counts.get(signature) ?? 0) + 1)
}

class Signature {
  #cachedNames
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
    return this.#cachedNames ??= [ ...new Set(this.#parameterNames) ].filter((name) => !this.#exempt.has(name))
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
  let binding = pattern
  while (binding.type === "AssignmentPattern" || binding.type === "RestElement") {
    binding = binding.type === "AssignmentPattern" ? binding.left : binding.argument
  }

  return binding.type === "Identifier" ? [ binding.name ] : objectPatternNames(binding)
}

function objectPatternNames(pattern) {
  return pattern.type === "ObjectPattern"
    ? pattern.properties.map((property) => staticMemberKeyOf(property)?.name).filter(Boolean)
    : []
}

function isSignificant(name) {
  return name.length > 1
}

function problemIn(clump) {
  return clump.problem
}

class Limits {
  #sharedCore
  #repeatedSignature
  #loneName

  constructor({ minFunctions, minFunctionsForRepeatedSignature, minFunctionsForSingleParam }) {
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
