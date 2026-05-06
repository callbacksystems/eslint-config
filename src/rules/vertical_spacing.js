// Vertical rhythm at the top level and inside classes: code breathes, data groups. A function, class, method,
// getter/setter, or function-valued field (exported or not) is "code" and stands surrounded by blank lines (a leading
// header comment stays attached, the blank going above it). Data declarations group tight when same-category and
// single-line: two of them sit with no blank, but once one spans several lines the blank is optional. A const and an
// exported const are different categories, as are a field's `(static, private)` pairs, and two categories meeting take
// the blank that says they are different things. Anything else (imports, expression statements, re-exports) is left
// alone.

import { isFunctionOrClass, isSingleLine, onTypes, unwrapExport } from "#helpers/ast"
import { isFunction } from "#helpers/functions"
import { collapseBlankLines, hasBlankBetween, isOnOwnLine } from "#helpers/source"
import { reportProblems } from "#helpers/report"

const EXPORTED_CONST = "exported const"

export default {
  meta: {
    type: "layout",
    fixable: "whitespace",
    docs: { description: "Surround code with blank lines; group same-category data without them" },
    schema: [],
    messages: {
      missingBlank: "Surround a function, class, or method with blank lines.",
      mixedCategories: "Separate declarations of different kinds with a blank line.",
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
    if (this.#wantsBlank) return this.#blankProblemFor("missingBlank")
    if (this.#mixesCategories) return this.#blankProblemFor("mixedCategories")
    if (this.#wantsTight) return this.#unexpectedProblem

    return null
  }

  get #wantsBlank() {
    return isCode(this.#first) || isCode(this.#second)
  }

  // It lands at end of line, above any header comment, leaving the second member's indent intact.
  #blankProblemFor(messageId) {
    return this.#hasBlank
      ? null
      : { messageId, node: this.#second, fix: (fixer) => fixer.insertTextAfter(this.#firstEnd, "\n") }
  }

  get #hasBlank() {
    return hasBlankBetween(this.#firstEnd, this.#secondStart)
  }

  get #firstEnd() {
    return this.#sourceCode.getLastToken(this.#first)
  }

  // A header comment stays attached to its member, so the blank goes above it.
  get #secondStart() {
    return this.#headerComment ?? this.#second
  }

  get #headerComment() {
    return this.#sourceCode.getCommentsBefore(this.#second).find((comment) => isOnOwnLine(this.#sourceCode, comment))
  }

  get #mixesCategories() {
    return this.#isDataPair && !isSameCategory(this.#first, this.#second)
  }

  get #isDataPair() {
    return isData(this.#first) && isData(this.#second)
  }

  get #wantsTight() {
    return this.#isTightCategory && isSingleLine(this.#first) && isSingleLine(this.#second)
  }

  // A run of exported consts is the module's surface rather than its working data, so it is never forced together.
  get #isTightCategory() {
    return this.#isDataPair && categoryOf(this.#first) !== EXPORTED_CONST
  }

  get #unexpectedProblem() {
    return this.#hasBlank
      ? { node: this.#second, messageId: "unexpectedBlank", fix: (fixer) => this.#collapse(fixer) }
      : null
  }

  #collapse(fixer) {
    return fixer.replaceTextRange(this.#gapRange, collapseBlankLines(this.#sourceCode.text.slice(...this.#gapRange)))
  }

  get #gapRange() {
    return [ this.#firstEnd.range[1], this.#secondStart.range[0] ]
  }
}

function isCode(node) {
  if (node.type === "MethodDefinition") return true
  if (node.type === "PropertyDefinition") return isFunction(node.value)

  return isFunctionOrFunctionValue(node)
}

function isFunctionOrFunctionValue(node) {
  return isFunctionOrClass(node) || isFunctionDeclarator(unwrapExport(node))
}

function isFunctionDeclarator(declaration) {
  return declaration.type === "VariableDeclaration" && declaration.declarations.some((entry) => isFunction(entry.init))
}

function isSameCategory(first, second) {
  return categoryOf(first) === categoryOf(second)
}

function categoryOf(node) {
  if (node.type === "PropertyDefinition") return `field:${node.static}:${node.key.type === "PrivateIdentifier"}`

  return node.type === "VariableDeclaration" ? "const" : EXPORTED_CONST
}

function isData(node) {
  return node.type === "PropertyDefinition" ? !isFunction(node.value) : isDataDeclaration(unwrapExport(node))
}

function isDataDeclaration(declaration) {
  return declaration.type === "VariableDeclaration" && !isFunctionDeclarator(declaration)
}
