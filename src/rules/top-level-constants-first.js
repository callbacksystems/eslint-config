// Module-level `const` declarations belong together at the top of the file,
// after the imports and before the functions and classes that use them. A `const`
// wedged between functions reads as an afterthought and breaks the top-down flow.
// Only `const` moves, and only above function/class declarations (which carry no
// ordering side effects); a `let`/`var` is already banned by
// `no-mutable-module-scope`, and a const is never reordered past an expression
// statement, import, or directive, so evaluation order is preserved. Grouping the
// consts also unblocks `step-down-top-level`, whose autofix bails while a const
// interrupts the run of functions.

import { unwrapExport } from "#helpers/ast"
import { reportProblem } from "#helpers/report"
import { blockStartOf, blockTextOf } from "#helpers/reorder"

const CODE_TYPES = new Set([ "FunctionDeclaration", "ClassDeclaration" ])

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

  #nameOf(statement) {
    const { id } = unwrapExport(statement).declarations[0]
    return id.type === "Identifier" ? id.name : this.#sourceCode.getText(id)
  }

  #hasLeadingComment(node) {
    return this.#sourceCode.getCommentsBefore(node).length > 0
  }

  // The first const declared after a function or class; null when every const
  // already leads them.
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
    return { name: this.#nameOf(this.#misplaced) }
  }

  get #fix() {
    return this.#isFixable ? (fixer) => fixer.replaceTextRange(this.#runRange, this.#orderedText) : null
  }

  get #isFixable() {
    return this.#isPartitionable && this.#isHeaderSafe
  }

  // Only consts and functions/classes may be reordered; an expression statement
  // or import inside the run carries effects, so leave that case to a human.
  get #isPartitionable() {
    return this.#run.every((statement) => isConstStatement(statement) || isFunctionOrClass(statement))
  }

  // Reorder the slice from the first function/class through the last const: its
  // consts rise above its functions, each keeping source order.
  get #run() {
    return this.#body.slice(this.#firstFunctionIndex, this.#lastConstIndex + 1)
  }

  get #lastConstIndex() {
    return this.#body.lastIndexOf(this.#consts.at(-1))
  }

  // A leading comment on the file's first statement is the file header; moving
  // that statement would drag the header down, so do not autofix it.
  get #isHeaderSafe() {
    return this.#run[0] !== this.#body[0] || !this.#hasLeadingComment(this.#run[0])
  }

  get #runRange() {
    return [ blockStartOf(this.#sourceCode, this.#run[0]), this.#run.at(-1).range[1] ]
  }

  // Each block (const or function, with its leading comments) is re-joined by a
  // blank line; `vertical-spacing` then tightens the consts that belong together.
  get #orderedText() {
    return this.#ordered.map((statement) => blockTextOf(this.#sourceCode, statement)).join("\n\n")
  }

  get #ordered() {
    return [ ...this.#run.filter(isConstStatement), ...this.#run.filter(isFunctionOrClass) ]
  }
}

function isFunctionOrClass(statement) {
  return CODE_TYPES.has(unwrapExport(statement).type)
}

function isConstStatement(statement) {
  const declaration = unwrapExport(statement)
  return declaration.type === "VariableDeclaration" && declaration.kind === "const"
}
