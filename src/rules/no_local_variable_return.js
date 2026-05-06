// `const result = ...; return result` is a local variable standing in for the expression. Return the expression
// directly, or build it declaratively (`reduce`, `Object.fromEntries`, a memoized getter) instead of assigning to a
// local just to hand it back.

import { isResourceDeclaration, readReferences } from "#helpers/syntax/ast"
import { BindingResolver } from "#helpers/scope/binding_resolver"
import { hasToolDirectiveIn } from "#helpers/source/comment_directives"
import { hasDirectEvalIn } from "#helpers/scope/dynamic_scope"
import { onFunctions } from "#helpers/syntax/functions"
import { reportProblem } from "#helpers/eslint/report"
import { commentPreservingReplacementFix } from "#helpers/source/source"

export default {
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Disallow returning a local variable as a function's last statement" },
    schema: [],
    messages: { noLocalReturn: "Return the expression directly instead of assigning it to `{{name}}` first." }
  },
  create(context) {
    const bindings = BindingResolver.for(context.sourceCode)
    return onFunctions((node) => reportProblem(context, new FunctionBody(node, context.sourceCode, bindings)))
  }
}

class FunctionBody {
  #node
  #body
  #sourceCode
  #bindings

  constructor(node, sourceCode, bindings) {
    this.#node = node
    this.#body = node.body
    this.#sourceCode = sourceCode
    this.#bindings = bindings
  }

  get problem() {
    if (this.#returnsLocal) {
      const { argument } = this.#lastStatement
      return { node: this.#lastStatement, messageId: "noLocalReturn", data: { name: argument.name }, fix: this.#fix }
    } else {
      return null
    }
  }

  get #returnsLocal() {
    const last = this.#lastStatement
    return Boolean(last)
      && last.type === "ReturnStatement"
      && last.argument?.type === "Identifier"
      && this.#returnsLocalVariable
  }

  get #lastStatement() {
    return this.#body.type === "BlockStatement" ? this.#body.body.at(-1) : null
  }

  get #returnsLocalVariable() {
    const variable = this.#bindings.variableFor(this.#lastStatement.argument)
    return variable?.scope.block === this.#node && variable.defs.some((definition) => definition.type === "Variable")
  }

  get #fix() {
    return this.#canFix && !this.#hasToolDirective
      ? new Inlining(this.#declaration, this.#lastStatement, this.#sourceCode).fix
      : null
  }

  get #canFix() {
    return this.#isInlineable && !this.#isResourceDeclaration && !hasDirectEvalIn(this.#sourceCode, this.#node)
  }

  // Anything between the declaration and the return, another reader or a second declarator could change evaluation
  // order or drop a use.
  get #isInlineable() {
    return this.#hasAdjacentDeclaration && this.#isReadOnce
  }

  get #hasAdjacentDeclaration() {
    const candidate = this.#declaration
    return Boolean(candidate) && candidate.declarations.length === 1 && Boolean(candidate.declarations[0].init)
  }

  get #declaration() {
    const candidate = this.#body.body.at(-2)
    return isDeclarationOf(candidate, this.#lastStatement.argument.name) ? candidate : null
  }

  get #isReadOnce() {
    return readReferences(this.#sourceCode, this.#declaration.declarations[0]).length === 1
  }

  get #isResourceDeclaration() {
    return isResourceDeclaration(this.#declaration)
  }

  get #hasToolDirective() {
    const range = [ this.#declaration.range[0], this.#lastStatement.range[1] ]
    return hasToolDirectiveIn({ sourceCode: this.#sourceCode, node: this.#declaration, range })
  }
}

class Inlining {
  #declaration
  #returnStatement
  #sourceCode

  constructor(declaration, returnStatement, sourceCode) {
    this.#declaration = declaration
    this.#returnStatement = returnStatement
    this.#sourceCode = sourceCode
  }

  get fix() {
    return commentPreservingReplacementFix(this.#sourceCode, this.#range, {
      text: `return ${this.#sourceCode.getText(this.#initializer)}`,
      preserving: [ this.#initializer ]
    })
  }

  get #range() {
    return [ this.#declaration.range[0], this.#returnStatement.range[1] ]
  }

  get #initializer() {
    return this.#declaration.declarations[0].init
  }
}

function isDeclarationOf(statement, name) {
  return statement?.type === "VariableDeclaration"
    && statement.declarations.some((declarator) => declarator.id.type === "Identifier" && declarator.id.name === name)
}
