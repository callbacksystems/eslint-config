// Vertical rhythm at the top level and inside classes: code breathes, data
// groups. A function, class, method, getter/setter, or function-valued field is
// "code" and stands surrounded by blank lines (a leading header comment stays
// attached, the blank going above it). Plain data (const declarations and data
// fields) groups tight: no blank line between two of the same category. A
// field's category is its `(static, private)` pair, so `static` fields cluster,
// privates cluster, and a public field next to a private one may keep a blank or
// not. Anything else (imports, expression statements, re-exports) is left alone.

import { isFunction, onTypes, unwrapExport } from "#helpers/ast"
import { reportProblems } from "#helpers/report"
import { collapseBlankLines, hasBlankBetween, isOnOwnLine } from "#helpers/source"

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

  // Code (a function, class, method, or function-valued field) on either side
  // stands apart.
  get #wantsBlank() {
    return isCode(this.#first) || isCode(this.#second)
  }

  // Insert the blank after the first member's last token: it lands at end of
  // line, above any header comment, leaving the second member's indent intact.
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

  // The second member's block begins at its own-line header comment, if any, so
  // the blank line lands above the comment and the comment stays attached.
  get #secondStart() {
    return this.#headerComment ?? this.#second
  }

  get #headerComment() {
    return this.#sourceCode.getCommentsBefore(this.#second).find((comment) => isOnOwnLine(this.#sourceCode, comment))
  }

  // Two data declarations of the same category belong tight together.
  get #wantsTight() {
    return isData(this.#first) && isData(this.#second) && isSameCategory(this.#first, this.#second)
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

function isDataDeclaration(node) {
  const declaration = unwrapExport(node)
  return declaration.type === "VariableDeclaration" && !isFunctionDeclarator(declaration)
}

function isSameCategory(first, second) {
  return categoryOf(first) === categoryOf(second)
}

function categoryOf(node) {
  return node.type === "PropertyDefinition" ? `field:${node.static}:${node.key.type === "PrivateIdentifier"}` : "const"
}
