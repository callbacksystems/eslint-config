// `let acc = []; for (...) acc.push(...)` and `const acc = []; items.forEach((x)
// => acc.push(...))` and similar manual-build patterns should be expressed
// declaratively with map/filter/Object.fromEntries or new Map. Skipped when a
// loop has break/continue/return/throw, where the declarative form would lose
// control flow.

import { isFunctionLike } from "#helpers/ast"
import { reportProblems } from "#helpers/report"

const SUGGESTIONS = {
  array: "`map`/`filter`/`flatMap`",
  object: "`Object.fromEntries(items.map(...))`",
  map: "`new Map(items.map(...))`"
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer declarative array/object/Map building over manual loop or forEach accumulation" },
    schema: [],
    messages: { manualAccumulation: "Replace this manual accumulation with {{suggestion}}." }
  },
  create(context) {
    return {
      Program: (node) => reportProblems(context, new Statements(node.body)),
      BlockStatement: (node) => reportProblems(context, new Statements(node.body)),
      SwitchCase: (node) => reportProblems(context, new Statements(node.consequent))
    }
  }
}

class Statements {
  #body

  constructor(body) {
    this.#body = body
  }

  get problems() {
    return this.#body.slice(0, -1).flatMap((current, index) => problemFor(current, this.#body[index + 1]))
  }
}

function problemFor(current, next) {
  const declaration = accumulatorDeclarationIn(current)
  return declaration && new Accumulation(declaration, next).isPresent
    ? [ { node: next, messageId: "manualAccumulation", data: { suggestion: SUGGESTIONS[declaration.kind] } } ]
    : []
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

class Accumulation {
  #declaration
  #node

  constructor(declaration, node) {
    this.#declaration = declaration
    this.#node = node
  }

  get isPresent() {
    return Boolean(this.#effect) && this.#mutatesAccumulator
  }

  #isMethodCall(method) {
    const { callee } = this.#effect
    return this.#effect.type === "CallExpression"
      && callee.type === "MemberExpression"
      && this.#targetsAccumulator(callee.object)
      && callee.property.type === "Identifier"
      && callee.property.name === method
  }

  #targetsAccumulator(node) {
    return node.type === "Identifier" && node.name === this.#declaration.name
  }

  #isAssignment() {
    const { left, operator } = this.#effect
    return this.#effect.type === "AssignmentExpression"
      && operator === "="
      && left.type === "MemberExpression"
      && this.#targetsAccumulator(left.object)
  }

  get #effect() {
    return this.#body ? soleEffectOf(this.#body) : null
  }

  get #body() {
    return isLoop(this.#node) ? this.#node.body : forEachCallbackBodyOf(this.#node)
  }

  get #mutatesAccumulator() {
    if (this.#kind === "array") return this.#isMethodCall("push")
    if (this.#kind === "object") return this.#isAssignment()
    if (this.#kind === "map") return this.#isMethodCall("set")
    return false
  }

  get #kind() {
    return this.#declaration.kind
  }
}

function soleEffectOf(body) {
  if (body.type === "ExpressionStatement") return body.expression
  if (isEffectExpression(body)) return body
  if (body.type === "BlockStatement" && body.body.length === 1) return statementEffectOf(body.body[0])
  return null
}

function isEffectExpression(node) {
  return node.type === "CallExpression" || node.type === "AssignmentExpression"
}

function statementEffectOf(statement) {
  if (statement.type === "ExpressionStatement") return statement.expression
  if (statement.type === "IfStatement" && !statement.alternate) return soleEffectOf(statement.consequent)
  return null
}

function isLoop(node) {
  return node.type === "ForOfStatement" || node.type === "ForInStatement" || node.type === "ForStatement"
}

function forEachCallbackBodyOf(statement) {
  const callback = forEachCallbackIn(statement)
  return callback ? callback.body : null
}

function forEachCallbackIn(statement) {
  const call = statement.type === "ExpressionStatement" ? statement.expression : null
  return isForEachCall(call) ? lastFunctionArgumentOf(call) : null
}

function isForEachCall(call) {
  return Boolean(call)
    && call.type === "CallExpression"
    && call.callee.type === "MemberExpression"
    && call.callee.property.type === "Identifier"
    && call.callee.property.name === "forEach"
}

function lastFunctionArgumentOf(call) {
  const candidate = call.arguments.at(-1)
  return isFunctionLike(candidate) ? candidate : null
}
