// Module-level `const` declarations belong together at the top of the file, after the imports and before the functions
// and classes that use them. A `const` wedged between functions reads as an afterthought and breaks the top-down flow.
// Only `const` moves, and only above function/class declarations; a `let`/`var` is already banned by
// `no-mutable-module-scope`, and a const is never reordered past an expression statement, import, or directive, so
// evaluation order is preserved. Functions hoist, but classes do not: when a class shares the run and a const
// initializer reaches into it, moving would evaluate the initializer before the class binding exists, so the fix stands
// down. Grouping the consts also unblocks `step-down-top-level`, whose autofix bails while a const interrupts the run
// of functions.

import { isFunctionOrClass, pushAll, unwrapExport } from "#helpers/syntax/ast"
import { isFixedPrimitive } from "#helpers/syntax/literals"
import { reportProblem } from "#helpers/eslint/report"
import { reorderFix } from "#helpers/source/reorder"

// A function body does not count as running, since moving the declaration does not call it.
const INERT_LEAF_TYPES = new Set([ "ArrowFunctionExpression", "FunctionExpression", "Literal" ])
const NON_COERCING_UNARY_OPERATORS = new Set([ "!", "delete", "typeof", "void" ])

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
    return this.#isFixable ? reorderFix(this.#sourceCode, { from: this.#run, to: this.#ordered }) : null
  }

  get #isFixable() {
    return this.#isPartitionable && this.#isHoistSafe
  }

  // An expression statement or import inside the run carries effects, so that case is left to a human.
  get #isPartitionable() {
    return this.#run.every((statement) => isConstStatement(statement) || isFunctionOrClass(statement))
  }

  get #run() {
    return this.#body.slice(this.#firstFunctionIndex, this.#lastConstIndex + 1)
  }

  get #lastConstIndex() {
    return this.#body.lastIndexOf(this.#consts.at(-1))
  }

  get #isHoistSafe() {
    return !this.#hasClass || (this.#hasSimpleBindings
      && this.#initializers.every((node) => new InertExpression(node).isPresent)
      && this.#classes.every(isDefinitionInert))
  }

  get #hasClass() {
    return this.#run.some((statement) => unwrapExport(statement).type === "ClassDeclaration")
  }

  get #hasSimpleBindings() {
    return this.#declarators.every((declarator) => declarator.id.type === "Identifier")
  }

  get #declarators() {
    return this.#run
      .filter(isConstStatement)
      .flatMap((statement) => unwrapExport(statement).declarations)
  }

  get #initializers() {
    return this.#declarators.map((declarator) => declarator.init)
  }

  get #classes() {
    return this.#run.filter((statement) => unwrapExport(statement).type === "ClassDeclaration")
  }

  // The blocks keep the gaps the run had, and `vertical-spacing` then tightens the consts that belong together.
  get #ordered() {
    return [ ...this.#run.filter(isConstStatement), ...this.#run.filter(isFunctionOrClass) ]
  }
}

function isConstStatement(statement) {
  const declaration = unwrapExport(statement)
  return declaration.type === "VariableDeclaration" && declaration.kind === "const"
}

class InertExpression {
  #pending

  constructor(node) {
    this.#pending = [ node ]
  }

  get isPresent() {
    while (this.#pending.length > 0) {
      const { operands } = new InertPart(this.#pending.pop())
      if (!operands) return false

      pushAll(this.#pending, operands)
    }
    return true
  }
}

class InertPart {
  #node

  constructor(node) {
    this.#node = node
  }

  get operands() {
    if (!this.#node) return null
    if (INERT_LEAF_TYPES.has(this.#node.type)) return []
    if (this.#node.type === "TemplateLiteral") return this.#templateOperands
    if (this.#node.type === "UnaryExpression") return this.#unaryOperands
    if (this.#node.type === "ArrayExpression") return this.#arrayOperands
    return this.#node.type === "ObjectExpression" ? this.#objectOperands : null
  }

  get #templateOperands() {
    return this.#node.expressions.length === 0 ? [] : null
  }

  get #unaryOperands() {
    if (NON_COERCING_UNARY_OPERATORS.has(this.#node.operator)) return [ this.#node.argument ]
    return isFixedPrimitive(this.#node) ? [] : null
  }

  get #arrayOperands() {
    return this.#node.elements.filter(Boolean)
  }

  get #objectOperands() {
    return this.#node.properties.every(isPlainProperty)
      ? this.#node.properties.map(propertyValue)
      : null
  }
}

function isPlainProperty(property) {
  return property.type === "Property" && !property.computed
}

function propertyValue(property) {
  return property.value
}

function isDefinitionInert(statement) {
  const declaration = unwrapExport(statement)
  return !declaration.superClass && declaration.body.body.every(isDefinitionInertMember)
}

function isDefinitionInertMember(member) {
  if (member.computed || member.type === "StaticBlock") return false
  if (member.type !== "PropertyDefinition" || !member.static) return true

  return !member.value || new InertExpression(member.value).isPresent
}
