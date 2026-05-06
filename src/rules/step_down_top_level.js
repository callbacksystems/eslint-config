// Top-down reading (Clean Code's step-down rule): a file should read from its high-level entry points down to its
// low-level leaves. Top-level functions and classes are ordered in two tiers:
//   1. exported functions (the public API), then non-exported helpers
//   2. within each tier, a caller before its callees, and a caller's callees in
//      the order it first invokes them (depth-first, first-invocation order)
// Mutual cycles fall back to the order in which they are first reached from the top.
//
// Top-level executable statements are the high-level readers: a `test(...)`, a `main()`, a registration call reads
// above the helper functions, so a helper sitting above any of them is out of order and floats below all of them, to
// the bottom. Only function declarations float (they hoist, so moving them is safe); classes stay put, and a
// non-function statement inside the span (a const, an export) keeps the report but blocks the autofix.

import { reportProblem } from "#helpers/eslint/report"
import { NearestAncestor } from "#helpers/syntax/nearest_ancestor"
import { firstDivergenceBetween, reorderFix } from "#helpers/source/reorder"
import { byPosition } from "#helpers/syntax/sorting"
import { DependencyGraph } from "#helpers/flow/dependency_graph"

const ORDERABLE_TYPES = new Set([ "FunctionDeclaration", "ClassDeclaration" ])
const topLevelStatements = new NearestAncestor((node) => node.parent?.type === "Program")

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Order top-level functions and classes top-down: callers before callees, exported first" },
    schema: [],
    messages: {
      outOfOrder: "Define `{{name}}` before `{{before}}` (top-down: exported API first, then helpers in use order).",
      helperAboveUse: "Move `{{name}}` below the top-level statements (top-down: helpers come last)."
    }
  },
  create(context) {
    return {
      "Program:exit"() {
        reportProblem(context, new FunctionOrder(context.sourceCode))
      }
    }
  }
}

class FunctionOrder {
  #sourceCode
  #cachedEntries
  #cachedByName
  #cachedReferences
  #cachedGraph

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
  }

  get problem() {
    return this.#helperPlacementProblem ?? this.#orderProblem
  }

  get #helperPlacementProblem() {
    const helper = this.#misplacedHelper
    return helper && this.#hasDistinctNames
      ? { node: helper.idNode, messageId: "helperAboveUse", data: { name: helper.name }, fix: this.#floatFix() }
      : null
  }

  get #misplacedHelper() {
    const boundary = this.#lastExecutableStatement
    return boundary && this.#entries.find((entry) => isHelperAbove(entry, boundary))
  }

  get #lastExecutableStatement() {
    return this.#sourceCode.ast.body.findLast(isExecutableStatement)
  }

  get #entries() {
    return this.#cachedEntries ??= entriesIn(this.#sourceCode)
  }

  get #hasDistinctNames() {
    const names = this.#entries.map(toName)
    return new Set(names).size === names.length
  }

  #floatFix() {
    const span = this.#helperSpan
    return isFloatableSpan(span)
      ? reorderFix(this.#sourceCode, { from: span, to: this.#floatedOrderOf(span) })
      : null
  }

  get #helperSpan() {
    const { body } = this.#sourceCode.ast
    return body.slice(body.indexOf(this.#misplacedHelper.statement), this.#spanEndOf(body) + 1)
  }

  #spanEndOf(body) {
    return Math.max(body.indexOf(this.#lastExecutableStatement), body.indexOf(this.#lastHelper.statement))
  }

  get #lastHelper() {
    return this.#entries.findLast((entry) => isFunctionStatement(entry.statement))
  }

  #floatedOrderOf(span) {
    return [ ...span.filter(isExecutableStatement), ...this.#helpersByCanonicalOrder(span) ]
  }

  #helpersByCanonicalOrder(span) {
    return span.filter(isFunctionStatement).sort(byNameRankIn(this.#canonicalOrder))
  }

  get #canonicalOrder() {
    return [ ...this.#namesByDfs(isExported), ...this.#namesByDfs(isPrivate) ]
  }

  #namesByDfs(predicate) {
    return this.#graph.namesFrom(this.#seedNames, { select: (name) => predicate(this.#byName.get(name)) })
  }

  get #graph() {
    return this.#cachedGraph ??= new DependencyGraph(this.#entries.map((entry) => ({
      name: entry.name,
      references: this.#referencesIn(entry.statement)
    })))
  }

  #referencesIn(node) {
    return this.#references.namesIn(node)
  }

  get #references() {
    return this.#cachedReferences ??= new BindingReferences(this.#entries)
  }

  // Seeds in reading priority, with every function last as a fallback for pure cycles.
  get #seedNames() {
    return [
      ...this.#statementReferences,
      ...this.#entries.filter(isExported).map(toName),
      ...this.#rootNames,
      ...this.#entries.map(toName)
    ]
  }

  get #statementReferences() {
    return this.#sourceCode.ast.body
      .filter((statement) => !declarationOf(statement))
      .flatMap((statement) => this.#referencesIn(statement))
  }

  get #rootNames() {
    return this.#graph.roots
  }

  get #byName() {
    return this.#cachedByName ??= new Map(this.#entries.map((entry) => [ entry.name, entry ]))
  }

  get #orderProblem() {
    const divergence = this.#hasDistinctNames
      ? firstDivergenceBetween(this.#actualOrder, this.#canonicalOrder)
      : null
    return divergence
      ? {
        node: this.#byName.get(divergence.expected).idNode,
        messageId: "outOfOrder",
        data: { name: divergence.expected, before: divergence.actual },
        fix: this.#reorderFix()
      }
      : null
  }

  get #actualOrder() {
    return this.#entries.map(toName)
  }

  #reorderFix() {
    const run = this.#functionRun
    return run ? reorderFix(this.#sourceCode, { from: run, to: this.#canonicalStatements }) : null
  }

  get #functionRun() {
    const { body } = this.#sourceCode.ast
    const statements = this.#entries.map((entry) => entry.statement)
    const run = body.slice(body.indexOf(statements[0]), body.indexOf(statements.at(-1)) + 1)
    return run.every(isFunctionStatement) ? run : null
  }

  get #canonicalStatements() {
    return this.#canonicalOrder.map((name) => this.#byName.get(name).statement)
  }
}

function isHelperAbove(entry, boundary) {
  return isPrivate(entry) && isFunctionStatement(entry.statement) && entry.statement.range[0] < boundary.range[0]
}

function isPrivate(entry) {
  return !entry.isExported
}

function isFunctionStatement(statement) {
  const declaration = declarationOf(statement)
  return isFunctionDeclaration(declaration) && Boolean(declaration.id)
}

function declarationOf(statement) {
  const declaration = statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration"
    ? statement.declaration
    : statement
  return ORDERABLE_TYPES.has(declaration?.type) ? declaration : null
}

function isFunctionDeclaration(node) {
  return node?.type === "FunctionDeclaration"
}

function isExecutableStatement(node) {
  return node.type === "ExpressionStatement"
}

function entriesIn(sourceCode) {
  const exportedNames = new ExportedNames(sourceCode.ast.body)
  return sourceCode.ast.body
    .filter((statement) => declarationOf(statement)?.id)
    .map((statement) => new Entry(statement, sourceCode, exportedNames))
}

class ExportedNames {
  #body
  #cachedNames

  constructor(body) {
    this.#body = body
  }

  has(name) {
    return this.#names.has(name)
  }

  get #names() {
    return this.#cachedNames ??= new Set(this.#body.flatMap(localExportNamesOf))
  }
}

function localExportNamesOf(statement) {
  if (statement.type === "ExportDefaultDeclaration") return nameOfDefaultExport(statement)
  if (statement.type !== "ExportNamedDeclaration" || statement.source) return []
  if (statement.declaration) return [ statement.declaration.id?.name ].filter(Boolean)

  return statement.specifiers.map((specifier) => specifier.local.name)
}

function nameOfDefaultExport(statement) {
  const { declaration } = statement
  return [ declaration.id?.name ?? (declaration.type === "Identifier" ? declaration.name : null) ].filter(Boolean)
}

class Entry {
  #sourceCode
  #exportedNames
  #cachedVariable

  constructor(statement, sourceCode, exportedNames) {
    this.statement = statement
    this.#sourceCode = sourceCode
    this.#exportedNames = exportedNames
  }

  get idNode() {
    return declarationOf(this.statement).id
  }

  get isExported() {
    return this.#exportedNames.has(this.name)
  }

  get name() {
    return declarationOf(this.statement).id.name
  }

  get variable() {
    return this.#cachedVariable ??= this.#sourceCode.getDeclaredVariables(declarationOf(this.statement))
      .find((variable) => variable.name === this.name && variable.scope.type !== "class")
  }
}

function toName(entry) {
  return entry.name
}

function isFloatableSpan(span) {
  return span.every((node) => new FloatableStatement(node).isPresent)
}

class FloatableStatement {
  #node

  constructor(node) {
    this.#node = node
  }

  get isPresent() {
    return isFunctionStatement(this.#node) || (isExecutableStatement(this.#node) && !this.#isStringExpression)
  }

  get #isStringExpression() {
    return typeof this.#node.expression.value === "string"
  }
}

function byNameRankIn(order) {
  const rankByName = new Map(order.map((name, rank) => [ name, rank ]))
  return (left, right) => rankByName.get(declarationOf(left).id.name) - rankByName.get(declarationOf(right).id.name)
}

function isExported(entry) {
  return entry.isExported
}

class BindingReferences {
  #cache = new WeakMap()
  #byStatement = new WeakMap()

  constructor(entries) {
    this.#index(entries)
  }

  namesIn(node) {
    if (!this.#cache.has(node)) this.#cache.set(node, this.#namesIn(node))
    return this.#cache.get(node)
  }

  #index(entries) {
    entries.forEach((entry) => entry.variable.references.forEach((reference) => {
      const statement = topLevelStatementOf(reference.identifier)
      const found = this.#byStatement.get(statement) ?? []
      found.push({ name: entry.name, range: reference.identifier.range })
      this.#byStatement.set(statement, found)
    }))
  }

  #namesIn(node) {
    return dedupe((this.#byStatement.get(node) ?? [])
      .sort(byPosition)
      .map((reference) => reference.name))
  }
}

function topLevelStatementOf(node) {
  return topLevelStatements.of(node)
}

function dedupe(values) {
  return [ ...new Set(values) ]
}
