// A statement is a manual accumulation when it fills an array, object or `Map` declared empty earlier in the same
// statement list: a loop or a `forEach` whose body reaches nothing but that mutation, possibly under `if`/`else` or
// `switch` branches, and never leaves through `break`, `continue`, `return` or `throw`. Shared by
// `no-manual-accumulation`, which reports it, and `prefer-for-each`, which leaves such a loop to that rule.

import { nodesIn } from "#helpers/ast"
import { isFunctionLike } from "#helpers/functions"

const LOOP_TYPES = new Set([ "ForOfStatement", "ForInStatement", "ForStatement" ])
const EXIT_TYPES = new Set([ "ContinueStatement", "ReturnStatement", "ThrowStatement" ])
const BRANCHES_OF = {
  BlockStatement: (node) => node.body,
  IfStatement: (node) => [ node.consequent, node.alternate ].filter(Boolean),
  SwitchStatement: (node) => node.cases.flatMap((switchCase) => switchCase.consequent)
}

export class Accumulation {
  #statement
  #cachedLeaves

  constructor(statement) {
    this.#statement = statement
  }

  get isPresent() {
    return Boolean(this.kind)
  }

  get kind() {
    return this.#accumulator?.kind ?? null
  }

  get #accumulator() {
    return this.#body && this.#keepsFlow ? this.#candidates.find((declaration) => this.#fills(declaration)) : null
  }

  get #body() {
    return isLoop(this.#statement) ? this.#statement.body : forEachCallbackBodyOf(this.#statement)
  }

  get #keepsFlow() {
    return nodesIn(this.#body).every((node) => new Flow(node, this.#body).staysInLoop)
  }

  get #candidates() {
    const siblings = siblingsOf(this.#statement)
    return siblings.slice(0, siblings.indexOf(this.#statement)).map(accumulatorDeclarationIn).filter(Boolean)
  }

  #fills(declaration) {
    return this.#leaves.length > 0
      && this.#leaves.every((leaf) => new Mutation(leaf, declaration).isPresent)
  }

  get #leaves() {
    return this.#cachedLeaves ??= leavesOf(this.#body)
  }
}

function isLoop(node) {
  return LOOP_TYPES.has(node.type)
}

function forEachCallbackBodyOf(statement) {
  const callback = forEachCallbackIn(statement)
  return callback ? callback.body : null
}

function forEachCallbackIn(statement) {
  const call = statement.expression
  return isForEachCall(call) ? lastFunctionArgumentOf(call) : null
}

function isForEachCall(call) {
  return call.type === "CallExpression"
    && call.callee.type === "MemberExpression"
    && call.callee.property.type === "Identifier"
    && call.callee.property.name === "forEach"
}

function lastFunctionArgumentOf(call) {
  const candidate = call.arguments.at(-1)
  return isFunctionLike(candidate) ? candidate : null
}

// An unlabeled `break` under a `switch` ends its case rather than the loop, which `map` keeps as a `return`.
class Flow {
  #node
  #body

  constructor(node, body) {
    this.#node = node
    this.#body = body
  }

  get staysInLoop() {
    return this.#node.type === "BreakStatement" ? this.#isCaseBreak : !EXIT_TYPES.has(this.#node.type)
  }

  get #isCaseBreak() {
    return !this.#node.label && this.#isUnderSwitch
  }

  get #isUnderSwitch() {
    for (let current = this.#node.parent; current && current !== this.#body; current = current.parent) {
      if (current.type === "SwitchStatement") return true
    }
    return false
  }
}

// A loop that is a branch of its own (`if (ok) for (...) ...`) has no statement list to declare the accumulator in.
function siblingsOf(statement) {
  const { parent } = statement
  if (parent.type === "SwitchCase") return parent.consequent
  return Array.isArray(parent.body) ? parent.body : []
}

function accumulatorDeclarationIn(statement) {
  if (statement.type !== "VariableDeclaration" || statement.declarations.length !== 1) return null

  const [ declarator ] = statement.declarations
  if (declarator.id.type !== "Identifier") return null

  const kind = new Initializer(declarator.init).accumulatorKind
  return kind ? { name: declarator.id.name, kind } : null
}

class Initializer {
  #init

  constructor(init) {
    this.#init = init
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
      && this.#init.arguments.length === 0
  }
}

class Mutation {
  #node
  #declaration

  constructor(node, declaration) {
    this.#node = node
    this.#declaration = declaration
  }

  get isPresent() {
    return this.#fillsArray || this.#fillsObject || this.#fillsMap
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
      && this.#targetsAccumulator(callee.object)
      && callee.property.type === "Identifier"
      && callee.property.name === method
  }

  #targetsAccumulator(node) {
    return node.type === "Identifier" && node.name === this.#declaration.name
  }

  get #isIndexAssignment() {
    return this.#isMemberAssignment && this.#node.left.computed
  }

  get #isMemberAssignment() {
    const { left, operator } = this.#node
    return this.#node.type === "AssignmentExpression"
      && operator === "="
      && left.type === "MemberExpression"
      && this.#targetsAccumulator(left.object)
  }

  get #fillsObject() {
    return this.#kind === "object" && this.#isMemberAssignment
  }

  get #fillsMap() {
    return this.#kind === "map" && this.#isMethodCall("set")
  }
}

function leavesOf(node) {
  if (node.type === "ExpressionStatement") return [ node.expression ]
  if (closesSwitchCase(node)) return []
  return Object.hasOwn(BRANCHES_OF, node.type) ? BRANCHES_OF[node.type](node).flatMap(leavesOf) : [ node ]
}

function closesSwitchCase(node) {
  return node.type === "BreakStatement"
}
