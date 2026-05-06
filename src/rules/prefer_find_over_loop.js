// A `for...of` that conditionally returns a value is a search written long-hand: `array.find((x) => condition)` (or
// `.some()`) says it declaratively. The signal is a `return <value>` guarded by an `if` inside the loop's own body.
// `prefer-for-each` deliberately leaves these alone (a `forEach` callback cannot return out of the function), so this
// rule points them at `find`/`some` instead.

import { isResourceDeclaration } from "#helpers/syntax/ast"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { CalleeResolver } from "#helpers/scope/callee_resolver"
import { BreakEscapes } from "#helpers/flow/break_escapes"
import { RangedEvents } from "#helpers/syntax/ranged_events"
import { reportProblems } from "#helpers/eslint/report"

const COLLECTIONS_WITHOUT_SEARCH = new Set([ "FormData", "Headers", "Map", "Set", "String", "URLSearchParams" ])
const EMPTY_EVENTS = new RangedEvents()

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Prefer `.find()`/`.some()` over a `for...of` that conditionally returns a value" },
    schema: [],
    messages: { preferFind: "This `for...of` conditionally returns a value. Prefer `.find()` or `.some()`." }
  },
  create(context) {
    const searches = new SearchLoops(context.sourceCode)
    return {
      FunctionDeclaration: (node) => searches.enterFunction(node),
      FunctionExpression: (node) => searches.enterFunction(node),
      ArrowFunctionExpression: (node) => searches.enterFunction(node),
      "FunctionDeclaration:exit": () => searches.leaveFunction(),
      "FunctionExpression:exit": () => searches.leaveFunction(),
      "ArrowFunctionExpression:exit": () => searches.leaveFunction(),
      IfStatement: () => searches.enterIf(),
      "IfStatement:exit": () => searches.leaveIf(),
      ForOfStatement: (node) => searches.enterLoop(node),
      "ForOfStatement:exit": () => searches.leaveLoop(),
      AwaitExpression: (node) => searches.addAwait(node),
      BreakStatement: (node) => searches.addBreak(node),
      ReturnStatement: (node) => searches.addReturn(node),
      "Program:exit": () => reportProblems(context, searches)
    }
  }
}

class SearchLoops {
  #bindings
  #candidates = []
  #contexts
  #sources
  #sourceEnd

  constructor(sourceCode) {
    this.#bindings = new BindingResolver(sourceCode)
    this.#sourceEnd = sourceCode.ast.range[1]
    this.#contexts = [ new FunctionSearches(null, this.#bindings, this.#sourceEnd) ]
    this.#sources = new SearchSources(sourceCode, this.#bindings)
  }

  get problems() {
    return this.#candidates.map((candidate) => candidate.problem).filter(Boolean)
  }

  enterFunction(node) {
    this.#contexts.push(new FunctionSearches(node, this.#bindings, this.#sourceEnd))
  }

  leaveFunction() {
    this.#contexts.pop()
  }

  enterIf() {
    this.#current.enterIf()
  }

  leaveIf() {
    this.#current.leaveIf()
  }

  enterLoop(node) {
    this.#current.enterLoop(node, this.#sources)
  }

  leaveLoop() {
    this.#candidates.push(this.#current.leaveLoop())
  }

  addAwait(node) {
    this.#current.addAwait(node)
  }

  addBreak(node) {
    this.#current.addBreak(node)
  }

  addReturn(node) {
    this.#current.addReturn(node)
  }

  get #current() {
    return this.#contexts.at(-1)
  }
}

class FunctionSearches {
  #awaits = new RangedEvents()
  #bindings
  #breaks
  #functionNode
  #ifDepth = 0
  #loops = []
  #trueReturns = new RangedEvents()
  #valueReturns = new WeakMap()

  constructor(functionNode, bindings, sourceEnd) {
    this.#functionNode = functionNode
    this.#bindings = bindings
    this.#breaks = new BreakEscapes(sourceEnd)
  }

  enterIf() {
    this.#ifDepth += 1
  }

  leaveIf() {
    this.#ifDepth -= 1
  }

  enterLoop(node, sources) {
    this.#loops.push(new SearchLoop(node, {
      functionNode: this.#functionNode,
      ifDepth: this.#ifDepth,
      awaits: this.#awaits,
      breaks: this.#breaks,
      trueReturns: this.#trueReturns,
      valueReturns: this.#valueReturnsFor(node),
      sources
    }))
  }

  leaveLoop() {
    return this.#loops.pop()
  }

  addAwait(node) {
    if (this.#loops.length > 0) this.#awaits.add(node.range[0])
  }

  addBreak(node) {
    if (this.#loops.length > 0) this.#breaks.add(node)
  }

  addReturn(node) {
    if (this.#loops.length === 0 || !node.argument) return

    if (isTrue(node.argument)) this.#trueReturns.add(node.range[0], this.#ifDepth)
    else this.#addValueReturn(node)
  }

  #valueReturnsFor(node) {
    return this.#returnsFor(stableLoopVariableFor(node, this.#bindings))
  }

  #returnsFor(variable) {
    return variable ? this.#knownReturnsFor(variable) : EMPTY_EVENTS
  }

  #knownReturnsFor(variable) {
    if (!this.#valueReturns.has(variable)) this.#valueReturns.set(variable, new RangedEvents())

    return this.#valueReturns.get(variable)
  }

  #addValueReturn(node) {
    if (node.argument.type === "Identifier") {
      const variable = this.#bindings.variableFor(node.argument)
      if (variable) this.#returnsFor(variable).add(node.range[0], this.#ifDepth)
    }
  }
}

class SearchLoop {
  #node
  #functionNode
  #ifDepth
  #awaits
  #breaks
  #trueReturns
  #valueReturns
  #sources

  constructor(node, { functionNode, ifDepth, awaits, breaks, trueReturns, valueReturns, sources }) {
    this.#node = node
    this.#functionNode = functionNode
    this.#ifDepth = ifDepth
    this.#awaits = awaits
    this.#breaks = breaks
    this.#trueReturns = trueReturns
    this.#valueReturns = valueReturns
    this.#sources = sources
  }

  get problem() {
    return this.#isSearch ? { node: this.#node, messageId: "preferFind" } : null
  }

  get #isSearch() {
    return this.#hasSupportedControlFlow
      && !this.#sources.hasNoSearchMethods(this.#node.right)
      && this.#hasConditionalValueReturn
  }

  get #hasSupportedControlFlow() {
    return !this.#node.await && !this.#hasResourceBinding && !this.#functionNode?.generator
      && !this.#hasOwnAwait && !this.#breaks.hasCrossingFor(this.#node)
  }

  get #hasResourceBinding() {
    return isResourceDeclaration(this.#node.left)
  }

  get #hasOwnAwait() {
    return this.#awaits.hasInside(this.#node.body.range)
  }

  get #hasConditionalValueReturn() {
    return this.#trueReturns.maximumInside(this.#node.body.range) > this.#ifDepth
      || this.#valueReturns.maximumInside(this.#node.body.range) > this.#ifDepth
  }
}

function isTrue(node) {
  return node.type === "Literal" && node.value === true
}

function stableLoopVariableFor(loop, bindings) {
  const declaration = loop.left
  if (declaration.type !== "VariableDeclaration") return null
  if (declaration.declarations.length !== 1) return null

  const [ declarator ] = declaration.declarations
  return declarator.id.type === "Identifier" && bindings.isUnmodified(declarator.id)
    ? bindings.variableFor(declarator.id)
    : null
}

class SearchSources {
  #bindings
  #callees

  constructor(sourceCode, bindings) {
    this.#bindings = bindings
    this.#callees = new CalleeResolver(sourceCode)
  }

  hasNoSearchMethods(node) {
    const source = node.type === "Identifier" ? this.#bindings.stableValueFor(node) : node
    return Boolean(source)
      && [ isString(source), this.#isUnsupportedCollection(source), this.#isLocalGeneratorCall(source) ].includes(true)
  }

  #isUnsupportedCollection(node) {
    return node.type === "NewExpression" && node.callee.type === "Identifier"
      && COLLECTIONS_WITHOUT_SEARCH.has(this.#bindings.globalNameFor(node.callee))
  }

  #isLocalGeneratorCall(node) {
    return node.type === "CallExpression" && Boolean(this.#callees.functionFor(node.callee)?.generator)
  }
}

function isString(node) {
  return (node.type === "Literal" && typeof node.value === "string") || node.type === "TemplateLiteral"
}
