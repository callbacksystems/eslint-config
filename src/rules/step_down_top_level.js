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

import { childNodesOf } from "#helpers/ast"
import { reportProblem } from "#helpers/report"
import { firstDivergenceBetween, reorderFix } from "#helpers/reorder"

const ORDERABLE_TYPES = new Set([ "FunctionDeclaration", "ClassDeclaration" ])
const DECLARATION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ClassDeclaration",
  "VariableDeclarator"
])

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
  #cachedNames
  #cachedByName

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
  }

  get problem() {
    return this.#helperPlacementProblem ?? this.#orderProblem
  }

  get #helperPlacementProblem() {
    const helper = this.#misplacedHelper
    return helper
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
    return this.#cachedEntries ??= entriesIn(this.#sourceCode.ast.body)
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
    return this.#entries.findLast((entry) => isFunctionDeclaration(entry.statement))
  }

  #floatedOrderOf(span) {
    return [ ...span.filter(isExecutableStatement), ...this.#helpersByCanonicalOrder(span) ]
  }

  #helpersByCanonicalOrder(span) {
    return span.filter(isFunctionDeclaration).sort(byNameRankIn(this.#canonicalOrder))
  }

  get #canonicalOrder() {
    return [ ...this.#namesByDfs(isExported), ...this.#namesByDfs(isPrivate) ]
  }

  #namesByDfs(predicate) {
    const state = { visited: new Set(), collected: [] }
    this.#seedNames.forEach((name) => this.#visit(name, predicate, state))
    return state.collected
  }

  // DFS seeds in reading priority, all in source order: names referenced from non-function statements, then exported
  // functions, then roots (functions nothing else calls), then every function as a fallback for pure cycles.
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

  #referencesIn(node) {
    return new ReferenceWalk(this.#names).namesIn(node)
  }

  get #names() {
    return this.#cachedNames ??= new Set(this.#entries.map(toName))
  }

  get #rootNames() {
    const indegree = indegreesOf(this.#entries)
    return this.#entries.filter((entry) => indegree.get(entry.name) === 0).map(toName)
  }

  #visit(name, predicate, state) {
    if (state.visited.has(name)) return

    state.visited.add(name)
    const entry = this.#byName.get(name)
    if (predicate(entry)) state.collected.push(name)
    entry.references.forEach((reference) => this.#visit(reference, predicate, state))
  }

  get #byName() {
    return this.#cachedByName ??= new Map(this.#entries.map((entry) => [ entry.name, entry ]))
  }

  get #orderProblem() {
    const divergence = firstDivergenceBetween(this.#actualOrder, this.#canonicalOrder)
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
    const run = this.#runBlocks
    if (run) {
      const byName = new Map(run.blocks.map((block) => [ block.name, block.text ]))
      const ordered = this.#canonicalOrder.map((name) => byName.get(name)).join("\n\n")
      return (fixer) => fixer.replaceTextRange(run.range, ordered)
    } else {
      return null
    }
  }

  get #runBlocks() {
    const run = this.#functionRunStatements
    if (run) {
      const blocks = run.map((statement) => this.#functionBlockOf(statement))
      return { range: [ blocks[0].range[0], blocks.at(-1).range[1] ], blocks }
    } else {
      return null
    }
  }

  get #functionRunStatements() {
    const { body } = this.#sourceCode.ast
    const statements = this.#entries.map((entry) => entry.statement)
    const run = body.slice(body.indexOf(statements[0]), body.indexOf(statements.at(-1)) + 1)
    return run.every((statement) => declarationOf(statement)) ? run : null
  }

  #functionBlockOf(statement) {
    const comments = this.#leadingCommentsOf(statement)
    const start = comments.length > 0 ? comments[0].range[0] : statement.range[0]
    const range = [ start, statement.range[1] ]
    return { name: declarationOf(statement).id.name, text: this.#sourceCode.text.slice(...range), range }
  }

  // The file's first statement is skipped: a comment there is the file header, which belongs to no function.
  #leadingCommentsOf(statement) {
    return statement === this.#sourceCode.ast.body[0]
      ? []
      : this.#sourceCode.getCommentsBefore(statement).filter((comment) => this.#isOnOwnLine(comment))
  }

  #isOnOwnLine(comment) {
    const before = this.#sourceCode.getTokenBefore(comment, { includeComments: true })
    return !before || before.loc.end.line < comment.loc.start.line
  }
}

function isHelperAbove(entry, boundary) {
  return isFunctionDeclaration(entry.statement) && entry.statement.range[0] < boundary.range[0]
}

function isFunctionDeclaration(node) {
  return node.type === "FunctionDeclaration"
}

function isExecutableStatement(node) {
  return node.type === "ExpressionStatement"
}

function entriesIn(body) {
  const names = new Set(body.map(declarationOf).filter(Boolean).map((declaration) => declaration.id.name))
  return body.filter(declarationOf).map((statement) => new Entry(statement, names))
}

// A class is a high-level entry point, so it leads the module helpers it calls.
function declarationOf(statement) {
  const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement
  return ORDERABLE_TYPES.has(declaration?.type) ? declaration : null
}

class Entry {
  #statement
  #names
  #cachedRefs

  constructor(statement, names) {
    this.#statement = statement
    this.#names = names
  }

  get name() {
    return declarationOf(this.#statement).id.name
  }

  get idNode() {
    return declarationOf(this.#statement).id
  }

  // The statement, not the declaration: an exported one carries its `export`.
  get statement() {
    return this.#statement
  }

  get isExported() {
    return this.#statement !== declarationOf(this.#statement)
  }

  get references() {
    return this.#cachedRefs ??= new ReferenceWalk(this.#names).namesIn(this.#statement)
  }
}

function isExported(entry) {
  return entry.isExported
}

class ReferenceWalk {
  #names
  #found = []

  constructor(names) {
    this.#names = names
  }

  namesIn(node) {
    this.#walk(node, null)
    return orderedUnique(this.#found)
  }

  #walk(node, parent) {
    if (this.#isReference(node, parent)) this.#found.push(node)
    childNodesOf(node).forEach((child) => this.#walk(child, node))
  }

  #isReference(node, parent) {
    return new Reference(node, parent).isValue && this.#names.has(node.name)
  }
}

function orderedUnique(identifiers) {
  return dedupe([ ...identifiers ].sort(bySourceOrder).map((identifier) => identifier.name))
}

function dedupe(values) {
  return [ ...new Set(values) ]
}

function bySourceOrder(left, right) {
  return left.range[0] - right.range[0]
}

class Reference {
  #node
  #parent

  constructor(node, parent) {
    this.#node = node
    this.#parent = parent
  }

  get isValue() {
    return this.#isIdentifier && !this.#isNonReferencePosition
  }

  get #isIdentifier() {
    return this.#node.type === "Identifier" && Boolean(this.#parent)
  }

  get #isNonReferencePosition() {
    return this.#isMemberProperty || this.#isObjectKey || this.#isDeclarationName
  }

  get #isMemberProperty() {
    return this.#parent.type === "MemberExpression" && this.#isUncomputedSlot("property")
  }

  #isUncomputedSlot(slot) {
    return this.#parent[slot] === this.#node && !this.#parent.computed
  }

  get #isObjectKey() {
    return this.#parent.type === "Property" && this.#isUncomputedSlot("key")
  }

  get #isDeclarationName() {
    return DECLARATION_TYPES.has(this.#parent.type) && this.#parent.id === this.#node
  }
}

// The span floats only when every node in it is a helper function or an executable statement. A class can't move (no
// hoisting), and a const or export in the middle would be reordered unsafely, so those keep the report without a fix.
function isFloatableSpan(span) {
  return span.every((node) => isFunctionDeclaration(node) || isExecutableStatement(node))
}

function byNameRankIn(order) {
  return (left, right) => order.indexOf(left.id.name) - order.indexOf(right.id.name)
}

function isPrivate(entry) {
  return !entry.isExported
}

function toName(entry) {
  return entry.name
}

function indegreesOf(entries) {
  const references = entries.flatMap((entry) => entry.references)
  return new Map(entries.map((entry) => [ entry.name, occurrencesOf(entry.name, references) ]))
}

function occurrencesOf(target, values) {
  return values.filter((value) => value === target).length
}
