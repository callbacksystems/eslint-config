// A statement is a manual accumulation when it fills an array, object or `Map` declared empty earlier in the same
// statement list: a loop or a `forEach` whose body reaches nothing but that mutation, possibly under `if`/`else` or
// `switch` branches, and never leaves through `break`, `continue`, `return` or `throw`. Shared by
// `no-manual-accumulation`, which reports it, and `prefer-for-each`, which leaves such a loop to that rule.

import { pushReversed } from "#helpers/syntax/ast"
import { AccumulationFlow } from "#helpers/arrays/accumulation_flow"
import { ArrayIndex } from "#helpers/arrays/array_index"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { staticMemberKeyOf } from "#helpers/syntax/classes"
import { isFunctionLike } from "#helpers/syntax/functions"
import { isWithin } from "#helpers/syntax/ranges"

const LOOP_TYPES = new Set([ "ForOfStatement", "ForInStatement", "ForStatement" ])
const BRANCHES_OF = {
  BlockStatement: (node) => node.body,
  IfStatement: (node) => [ node.consequent, node.alternate ].filter(Boolean),
  SwitchStatement: (node) => node.cases.flatMap((switchCase) => switchCase.consequent)
}
const bindingsBySourceCode = new WeakMap()
const candidatesBySourceCode = new WeakMap()

export class Accumulation {
  #statement
  #bindings
  #candidateIndex
  #flowIndex
  #cachedLeaves
  #cachedMutationTargets

  constructor(statement, sourceCode = null) {
    this.#statement = statement
    this.#bindings = sourceCode ? bindingsFor(sourceCode) : null
    this.#candidateIndex = sourceCode ? candidateIndexFor(sourceCode) : null
    this.#flowIndex = AccumulationFlow.for(sourceCode?.ast ?? statement)
  }

  get isPresent() {
    return Boolean(this.kind)
  }

  get kind() {
    return this.#accumulator?.kind ?? null
  }

  get #accumulator() {
    return this.#body ? this.#accumulatorInBody : null
  }

  get #body() {
    return LOOP_TYPES.has(this.#statement.type) ? this.#statement.body : forEachCallbackBodyOf(this.#statement)
  }

  get #accumulatorInBody() {
    return this.#candidates.length > 0 && this.#keepsFlow
      ? this.#candidates.find((declaration) => this.#fills(declaration))
      : null
  }

  get #candidates() {
    const declarations = this.#candidateIndex
      ? this.#candidateIndex.before(this.#statement, this.#mutationTargets)
      : siblingsOf(this.#statement).slice(0, siblingsOf(this.#statement).indexOf(this.#statement))
        .flatMap((statement) => accumulatorDeclarationsIn(statement, this.#bindings))
    return declarations.filter((declaration) => this.#startsEmpty(declaration))
  }

  get #mutationTargets() {
    return this.#cachedMutationTargets ??= this.#leaves.map(mutationTargetOf).filter(Boolean)
  }

  get #leaves() {
    return this.#cachedLeaves ??= new BranchLeaves(this.#body).values
  }

  #startsEmpty(declaration) {
    return !declaration.variable || declaration.variable.references.every((reference) =>
      reference.identifier === declaration.identifier
      || reference.identifier.range[0] < declaration.identifier.range[0]
      || reference.identifier.range[0] >= this.#statement.range[0])
  }

  get #keepsFlow() {
    return this.#flowIndex.keepsFlowIn(this.#body)
  }

  #fills(declaration) {
    const mutations = this.#leaves.map((leaf) => new Mutation(leaf, declaration, this.#bindings))
    return mutations.length > 0 && mutations.every((mutation) => mutation.isPresent)
      && this.#usesOnlyMutationTargets(declaration, mutations)
  }

  #usesOnlyMutationTargets(declaration, mutations) {
    const targets = new Set(mutations.map((mutation) => mutation.target))
    return !declaration.variable || declaration.variable.references
      .filter((reference) => this.#contains(reference.identifier))
      .every((reference) => targets.has(reference.identifier))
  }

  #contains(identifier) {
    return isWithin(identifier, this.#statement.range)
  }
}

function bindingsFor(sourceCode) {
  if (!bindingsBySourceCode.has(sourceCode)) bindingsBySourceCode.set(sourceCode, BindingResolver.for(sourceCode))
  return bindingsBySourceCode.get(sourceCode)
}

function candidateIndexFor(sourceCode) {
  if (!candidatesBySourceCode.has(sourceCode)) {
    candidatesBySourceCode.set(sourceCode, new CandidateIndex(bindingsFor(sourceCode)))
  }
  return candidatesBySourceCode.get(sourceCode)
}

class CandidateIndex {
  #bindings
  #lists = new WeakMap()

  constructor(bindings) {
    this.#bindings = bindings
  }

  before(statement, targets) {
    const siblings = siblingsOf(statement)
    if (siblings.length === 0) return []

    const { parent } = statement
    if (!this.#lists.has(parent)) this.#lists.set(parent, new StatementListCandidates(siblings, this.#bindings))
    return this.#lists.get(parent).before(statement, targets)
  }
}

// A loop that is a branch of its own (`if (ok) for (...) ...`) has no statement list to declare the accumulator in.
function siblingsOf(statement) {
  const { parent } = statement
  if (parent.type === "SwitchCase") return parent.consequent
  return Array.isArray(parent.body) ? parent.body : []
}

class StatementListCandidates {
  #positions
  #byVariable = new Map()
  #bindings

  constructor(statements, bindings) {
    this.#bindings = bindings
    this.#positions = new Map(statements.map((statement, position) => [ statement, position ]))
    statements.forEach((statement, position) => {
      accumulatorDeclarationsIn(statement, bindings).forEach((declaration) => {
        if (declaration.variable) this.#byVariable.set(declaration.variable, { declaration, position })
      })
    })
  }

  before(statement, targets) {
    const position = this.#positions.get(statement)
    const candidates = new Set(targets
      .map((target) => this.#byVariable.get(this.#bindings.variableFor(target)))
      .filter((candidate) => candidate?.position < position)
      .map((candidate) => candidate.declaration))
    return [ ...candidates ]
  }
}

function accumulatorDeclarationsIn(statement, bindings) {
  return statement.type === "VariableDeclaration"
    ? statement.declarations.filter((declarator) => declarator.id.type === "Identifier")
      .map((declarator) => accumulatorDeclarationOf(declarator, bindings)).filter(Boolean)
    : []
}

function accumulatorDeclarationOf(declarator, bindings) {
  const kind = new Initializer(declarator.init, bindings).accumulatorKind
  return kind
    ? {
      kind,
      identifier: declarator.id,
      name: declarator.id.name,
      variable: bindings?.variableFor(declarator.id) ?? null
    }
    : null
}

class Initializer {
  #init
  #bindings

  constructor(init, bindings) {
    this.#init = init
    this.#bindings = bindings
  }

  get accumulatorKind() {
    if (this.#isEmptyArrayLiteral) return "array"
    if (this.#isEmptyObjectLiteral) return "object"
    if (this.#isEmptyMapConstruction) return "map"
    return null
  }

  get #isEmptyArrayLiteral() {
    return Boolean(this.#init) && this.#init.type === "ArrayExpression" && this.#init.elements.length === 0
  }

  get #isEmptyObjectLiteral() {
    return Boolean(this.#init) && this.#init.type === "ObjectExpression" && this.#init.properties.length === 0
  }

  get #isEmptyMapConstruction() {
    return Boolean(this.#init)
      && this.#init.type === "NewExpression"
      && this.#init.callee.type === "Identifier"
      && this.#init.callee.name === "Map"
      && (!this.#bindings || this.#bindings.isUnmodifiedGlobal(this.#init.callee))
      && this.#init.arguments.length === 0
  }
}

function forEachCallbackBodyOf(statement) {
  const callback = forEachCallbackIn(statement)
  return callback ? callback.body : null
}

function forEachCallbackIn(statement) {
  const call = statement.expression
  return isForEachCall(call) ? firstFunctionArgumentOf(call) : null
}

function isForEachCall(call) {
  return call?.type === "CallExpression" && !call.optional ? isForEachMember(call.callee) : false
}

function isForEachMember(callee) {
  return callee.type === "MemberExpression" && !callee.optional && staticMemberKeyOf(callee)?.name === "forEach"
}

function firstFunctionArgumentOf(call) {
  const [ candidate ] = call.arguments
  return isFunctionLike(candidate) ? candidate : null
}

function mutationTargetOf(node) {
  if (node.type === "CallExpression" && node.callee.type === "MemberExpression") return node.callee.object
  if (node.type === "AssignmentExpression" && node.left.type === "MemberExpression") return node.left.object
  return null
}

class BranchLeaves {
  #pending
  #values = []

  constructor(node) {
    this.#pending = [ node ]
  }

  get values() {
    while (this.#pending.length > 0) this.#add(this.#pending.pop())
    return this.#values
  }

  #add(node) {
    const branches = BRANCHES_OF[node.type]?.(node)
    if (node.type === "ExpressionStatement") this.#values.push(node.expression)
    else if (branches) pushReversed(this.#pending, branches)
    else if (node.type !== "BreakStatement") this.#values.push(node)
  }
}

class Mutation {
  #node
  #declaration
  #bindings

  constructor(node, declaration, bindings) {
    this.#node = node
    this.#declaration = declaration
    this.#bindings = bindings
  }

  get isPresent() {
    return this.#fillsArray || this.#fillsObject || this.#fillsMap
  }

  get target() {
    return this.#node.type === "CallExpression" ? this.#node.callee.object : this.#node.left.object
  }

  get #fillsArray() {
    return this.#kind === "array" && (this.#isMethodCall("push") || this.#isIndexAssignment)
  }

  get #kind() {
    return this.#declaration.kind
  }

  #isMethodCall(method) {
    const { callee } = this.#node
    return this.#node.type === "CallExpression"
      && callee.type === "MemberExpression"
      && this.#isAccumulatorTarget(callee.object)
      && staticMemberKeyOf(callee)?.name === method
  }

  #isAccumulatorTarget(node) {
    return node.type === "Identifier" && node.name === this.#declaration.name
      ? !this.#declaration.variable || this.#bindings.variableFor(node) === this.#declaration.variable
      : false
  }

  get #isIndexAssignment() {
    return this.#isMemberAssignment && new ArrayIndex(this.#node.left).isPossible
  }

  get #isMemberAssignment() {
    const { left, operator } = this.#node
    return this.#node.type === "AssignmentExpression"
      && operator === "="
      && left.type === "MemberExpression"
      && this.#isAccumulatorTarget(left.object)
  }

  get #fillsObject() {
    return this.#kind === "object" && this.#isMemberAssignment
      && staticMemberKeyOf(this.#node.left)?.name !== "__proto__"
  }

  get #fillsMap() {
    return this.#kind === "map" && this.#isMethodCall("set")
  }
}
