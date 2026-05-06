// Vertical rhythm at the top level and inside classes: code breathes, data groups. A function, class, method,
// getter/setter, or function-valued field (exported or not) is "code" and stands surrounded by blank lines (a leading
// header comment stays attached, the blank going above it). Internal const declarations and data fields group tight
// when same-category and single-line: two of them sit with no blank, but once one spans several lines the blank is
// optional. A field's category is its `(static, private)` pair. Exported consts are left to the author, never forced
// together or apart, so a run of small related ones can group while a standalone one can breathe. Anything else
// (imports, expression statements, re-exports) is left alone.

import { isSingleLine, onTypes, unwrapExport } from "#helpers/ast"
import { isFunction } from "#helpers/functions"
import { collapseBlankLines, hasBlankBetween, isOnOwnLine } from "#helpers/source"
import { reportProblems } from "#helpers/report"

const CODE_TYPES = new Set([ "FunctionDeclaration", "ClassDeclaration" ])

export default {
  meta: {
    type: "layout",
    fixable: "whitespace",
    docs: { description: "Surround code with blank lines; group same-category data without them" },
    schema: [],
    messages: {
      missingBlank: "Surround a function, class, or method with blank lines.",
      unexpectedBlank: "Remove the blank line; group these declarations together."
    }
  },
  create(context) {
    return onTypes(
      [ "Program", "ClassBody" ],
      (node) => reportProblems(context, new Spacing(node.body, context.sourceCode))
    )
  }
}

class Spacing {
  #members
  #sourceCode

  constructor(members, sourceCode) {
    this.#members = members
    this.#sourceCode = sourceCode
  }

  get problems() {
    return this.#pairs.map((pair) => pair.problem).filter(Boolean)
  }

  get #pairs() {
    return this.#members
      .slice(0, -1)
      .map((member, index) => new Pair(member, this.#members[index + 1], this.#sourceCode))
  }
}

class Pair {
  #first
  #second
  #sourceCode

  constructor(first, second, sourceCode) {
    this.#first = first
    this.#second = second
    this.#sourceCode = sourceCode
  }

  get problem() {
    if (this.#wantsBlank) return this.#missingProblem
    if (this.#wantsTight) return this.#unexpectedProblem

    return null
  }

  #collapse(fixer) {
    return fixer.replaceTextRange(this.#gapRange, collapseBlankLines(this.#sourceCode.text.slice(...this.#gapRange)))
  }

  get #wantsBlank() {
    return isCode(this.#first) || isCode(this.#second)
  }

  // It lands at end of line, above any header comment, leaving the second member's indent intact.
  get #missingProblem() {
    return this.#hasBlank
      ? null
      : { node: this.#second, messageId: "missingBlank", fix: (fixer) => fixer.insertTextAfter(this.#firstEnd, "\n") }
  }

  get #hasBlank() {
    return hasBlankBetween(this.#firstEnd, this.#secondStart)
  }

  get #firstEnd() {
    return this.#sourceCode.getLastToken(this.#first)
  }

  // So the blank lands above the comment and the comment stays attached.
  get #secondStart() {
    return this.#headerComment ?? this.#second
  }

  get #headerComment() {
    return this.#sourceCode.getCommentsBefore(this.#second).find((comment) => isOnOwnLine(this.#sourceCode, comment))
  }

  // Two single-line data declarations of the same category belong tight together; once one spans several lines the
  // blank is optional, so leave it alone.
  get #wantsTight() {
    return isData(this.#first) && isData(this.#second)
      && isSameCategory(this.#first, this.#second)
      && isSingleLine(this.#first) && isSingleLine(this.#second)
  }

  get #unexpectedProblem() {
    return this.#hasBlank
      ? { node: this.#second, messageId: "unexpectedBlank", fix: (fixer) => this.#collapse(fixer) }
      : null
  }

  get #gapRange() {
    return [ this.#firstEnd.range[1], this.#secondStart.range[0] ]
  }
}

function isCode(node) {
  if (node.type === "MethodDefinition") return true
  if (node.type === "PropertyDefinition") return isFunction(node.value)

  return isFunctionOrClass(node)
}

function isFunctionOrClass(node) {
  const declaration = unwrapExport(node)
  return CODE_TYPES.has(declaration.type) || isFunctionDeclarator(declaration)
}

function isFunctionDeclarator(declaration) {
  return declaration.type === "VariableDeclaration" && declaration.declarations.some((entry) => isFunction(entry.init))
}

function isData(node) {
  return node.type === "PropertyDefinition" ? !isFunction(node.value) : isDataDeclaration(node)
}

// An exported const is deliberately not "data": its grouping is left to the author, never forced tight or apart, so it
// drops out of the tight-grouping pass.
function isDataDeclaration(node) {
  return node.type === "VariableDeclaration" && !isFunctionDeclarator(node)
}

function isSameCategory(first, second) {
  return categoryOf(first) === categoryOf(second)
}

function categoryOf(node) {
  return node.type === "PropertyDefinition" ? `field:${node.static}:${node.key.type === "PrivateIdentifier"}` : "const"
}
