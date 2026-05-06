// Moving a loop body into an arrow preserves most lexical behavior, but not dynamic lookup, parameter initialization,
// const writes, function directives, or declarations whose scope would move into the callback.

import { hasDynamicScopeIn } from "#helpers/scope/dynamic_scope"
import { isWithin } from "#helpers/syntax/ranges"

const USE_STRICT_SOURCES = new Set([ "\"use strict\"", "'use strict'" ])

export class ForEachFixSafety {
  #node
  #facts
  #sourceCode
  #cachedReferences

  constructor(node, { facts, sourceCode }) {
    this.#node = node
    this.#facts = facts
    this.#sourceCode = sourceCode
  }

  get isSafe() {
    return this.#keepsDynamicBindings
      && this.#keepsBindingInitialization
      && this.#keepsBindingMutability
      && this.#keepsDirectiveSemantics
      && this.#keepsCallbackScope
  }

  get #keepsDynamicBindings() {
    return !hasDynamicScopeIn(this.#sourceCode, this.#node)
  }

  get #keepsBindingInitialization() {
    return !this.#facts.hasEscapeInside(this.#node.left.range)
      && !this.#hasReferenceIn(this.#node.right.range)
  }

  #hasReferenceIn(range) {
    return this.#references.some((reference) => isWithin(reference.identifier, range))
  }

  get #references() {
    return this.#cachedReferences ??= this.#sourceCode.getDeclaredVariables(this.#node.left)
      .flatMap((variable) => variable.references)
  }

  get #keepsBindingMutability() {
    return this.#node.left.kind !== "const" || !this.#hasWriteReferenceIn(this.#node.range)
  }

  #hasWriteReferenceIn(range) {
    return this.#references.some((reference) => !reference.init
      && reference.isWrite()
      && isWithin(reference.identifier, range))
  }

  get #keepsDirectiveSemantics() {
    return !hasUseStrictDirective(this.#node.body, this.#sourceCode)
  }

  get #keepsCallbackScope() {
    return !this.#facts.hasCallbackScopeChangeInside(this.#node.body.range)
  }
}

function hasUseStrictDirective(body, sourceCode) {
  return body.type === "BlockStatement" && new DirectivePrologue(body.body, sourceCode).hasUseStrict
}

class DirectivePrologue {
  #statements
  #sourceCode

  constructor(statements, sourceCode) {
    this.#statements = statements
    this.#sourceCode = sourceCode
  }

  get hasUseStrict() {
    return this.#statements.slice(0, this.#length)
      .some((statement) => USE_STRICT_SOURCES.has(this.#sourceCode.getText(statement.expression)))
  }

  get #length() {
    const index = this.#statements.findIndex((statement) => !isDirectiveStatement(statement))
    return index === -1 ? this.#statements.length : index
  }
}

function isDirectiveStatement(statement) {
  return statement.type === "ExpressionStatement"
    && statement.expression.type === "Literal"
    && typeof statement.expression.value === "string"
    && statement.range[0] === statement.expression.range[0]
}
