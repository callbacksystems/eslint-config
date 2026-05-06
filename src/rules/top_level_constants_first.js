// Module-level `const` declarations belong together at the top of the file, after the imports and before the functions
// and classes that use them. A `const` wedged between functions reads as an afterthought and breaks the top-down flow.
// Only `const` moves, and only above function/class declarations; a `let`/`var` is already banned by
// `no-mutable-module-scope`, and a const is never reordered past an expression statement, import, or directive, so
// evaluation order is preserved. Functions hoist, but classes do not: when a class shares the run and a const
// initializer reaches into it, moving would evaluate the initializer before the class binding exists, so the fix stands
// down. Grouping the consts also unblocks `step-down-top-level`, whose autofix bails while a const interrupts the run
// of functions.

import { isFunctionOrClass, unwrapExport } from "#helpers/ast"
import { reportProblem } from "#helpers/report"
import { blockEndOf, blockStartOf, blockTextOf } from "#helpers/reorder"

// An initializer that evaluates to a value without running anything: nothing it touches can be in its temporal dead
// zone. A function body does not count as running, since moving the declaration does not call it.
const INERT_BY_TYPE = {
  Literal: () => true,
  TemplateLiteral: (node) => node.expressions.length === 0,
  ArrowFunctionExpression: () => true,
  FunctionExpression: () => true,
  UnaryExpression: (node) => isInert(node.argument),
  ArrayExpression: (node) => node.elements.every((element) => !element || isInert(element)),
  ObjectExpression: (node) => node.properties.every(isInertProperty)
}

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Group module-level const declarations at the top, before functions and classes" },
    schema: [],
    messages: {
      constAfterCode: "Declare `{{name}}` with the other constants at the top, before functions and classes."
    }
  },
  create(context) {
    return {
      "Program:exit"() {
        reportProblem(context, new ConstantOrder(context.sourceCode))
      }
    }
  }
}

function isInert(node) {
  return Boolean(node) && Boolean(INERT_BY_TYPE[node.type]?.(node))
}

function isInertProperty(property) {
  return property.type === "Property" && !property.computed && isInert(property.value)
}

class ConstantOrder {
  #sourceCode

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
  }

  get problem() {
    return this.#misplaced
      ? { node: this.#misplaced, messageId: "constAfterCode", data: this.#data, fix: this.#fix }
      : null
  }

  get #misplaced() {
    return this.#hasFunctions ? this.#consts.find((node) => node.range[0] > this.#firstFunctionStart) : null
  }

  get #hasFunctions() {
    return this.#firstFunctionIndex !== -1
  }

  get #firstFunctionIndex() {
    return this.#body.findIndex(isFunctionOrClass)
  }

  get #body() {
    return this.#sourceCode.ast.body
  }

  get #consts() {
    return this.#body.filter(isConstStatement)
  }

  get #firstFunctionStart() {
    return this.#body[this.#firstFunctionIndex].range[0]
  }

  get #data() {
    return { name: this.#declaredNameOf(this.#misplaced) }
  }

  #declaredNameOf(statement) {
    const { id } = unwrapExport(statement).declarations[0]
    return id.type === "Identifier" ? id.name : this.#sourceCode.getText(id)
  }

  get #fix() {
    return this.#isFixable ? (fixer) => fixer.replaceTextRange(this.#runRange, this.#orderedText) : null
  }

  get #isFixable() {
    return this.#isPartitionable && this.#isHeaderSafe && this.#isHoistSafe
  }

  // Only consts and functions/classes may be reordered; an expression statement or import inside the run carries
  // effects, so leave that case to a human.
  get #isPartitionable() {
    return this.#run.every((statement) => isConstStatement(statement) || isFunctionOrClass(statement))
  }

  get #run() {
    return this.#body.slice(this.#firstFunctionIndex, this.#lastConstIndex + 1)
  }

  get #lastConstIndex() {
    return this.#body.lastIndexOf(this.#consts.at(-1))
  }

  // A leading comment on the file's first statement is the file header; moving that statement would drag the header
  // down, so do not autofix it.
  get #isHeaderSafe() {
    return this.#run[0] !== this.#body[0] || !this.#hasLeadingComment(this.#run[0])
  }

  #hasLeadingComment(node) {
    return this.#sourceCode.getCommentsBefore(node).length > 0
  }

  get #isHoistSafe() {
    return !this.#hasClass || this.#initializers.every(isInert)
  }

  get #hasClass() {
    return this.#run.some((statement) => unwrapExport(statement).type === "ClassDeclaration")
  }

  get #initializers() {
    return this.#run
      .filter(isConstStatement)
      .flatMap((statement) => unwrapExport(statement).declarations)
      .map((declarator) => declarator.init)
  }

  get #runRange() {
    return [ blockStartOf(this.#sourceCode, this.#run[0]), blockEndOf(this.#sourceCode, this.#run.at(-1)) ]
  }

  // Each block (const or function, with its leading comments) is re-joined by a blank line; `vertical-spacing` then
  // tightens the consts that belong together.
  get #orderedText() {
    return this.#ordered.map((statement) => blockTextOf(this.#sourceCode, statement)).join("\n\n")
  }

  get #ordered() {
    return [ ...this.#run.filter(isConstStatement), ...this.#run.filter(isFunctionOrClass) ]
  }
}

function isConstStatement(statement) {
  const declaration = unwrapExport(statement)
  return declaration.type === "VariableDeclaration" && declaration.kind === "const"
}
