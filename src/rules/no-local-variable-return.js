// `const result = ...; return result` is a local variable standing in for the expression. Return the expression
// directly, or build it declaratively (`reduce`, `Object.fromEntries`, a memoized getter) instead of assigning to a
// local just to hand it back.

import { readReferences } from "#helpers/ast"
import { onFunctions } from "#helpers/functions"
import { reportProblem } from "#helpers/report"

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Disallow returning a local variable as a function's last statement" },
    schema: [],
    messages: { noLocalReturn: "Return the expression directly instead of assigning it to `{{name}}` first." }
  },
  create(context) {
    return onFunctions((node) => reportProblem(context, new FunctionBody(node.body, context.sourceCode)))
  }
}

class FunctionBody {
  #body
  #sourceCode

  constructor(body, sourceCode) {
    this.#body = body
    this.#sourceCode = sourceCode
  }

  get problem() {
    if (this.#returnsLocal) {
      const { argument } = this.#lastStatement
      return { node: this.#lastStatement, messageId: "noLocalReturn", data: { name: argument.name }, fix: this.#fix }
    } else {
      return null
    }
  }

  #declaresLocal(name) {
    return this.#body.body.some((statement) => isDeclarationOf(statement, name))
  }

  get #returnsLocal() {
    const last = this.#lastStatement
    return Boolean(last)
      && last.type === "ReturnStatement"
      && last.argument?.type === "Identifier"
      && this.#declaresLocal(last.argument.name)
  }

  get #lastStatement() {
    return this.#body.type === "BlockStatement" ? this.#body.body.at(-1) : null
  }

  // Anything between the declaration and the return, another reader, or a multi-declarator statement could change
  // evaluation order or drop a use.
  get #fix() {
    if (this.#isInlineable) {
      const replacement = `return ${this.#sourceCode.getText(this.#declaration.declarations[0].init)}`
      const range = [ this.#declaration.range[0], this.#lastStatement.range[1] ]
      return (fixer) => fixer.replaceTextRange(range, replacement)
    } else {
      return null
    }
  }

  get #isInlineable() {
    return this.#hasAdjacentDeclaration && this.#isReadOnce
  }

  get #hasAdjacentDeclaration() {
    const declaration = this.#declaration
    return Boolean(declaration) && declaration.declarations.length === 1 && Boolean(declaration.declarations[0].init)
  }

  get #declaration() {
    const candidate = this.#body.body.at(-2)
    return isDeclarationOf(candidate, this.#lastStatement.argument.name) ? candidate : null
  }

  get #isReadOnce() {
    return readReferences(this.#sourceCode, this.#declaration.declarations[0]).length === 1
  }
}

function isDeclarationOf(statement, name) {
  return statement?.type === "VariableDeclaration"
    && statement.declarations.some((declarator) => declarator.id.type === "Identifier" && declarator.id.name === name)
}
