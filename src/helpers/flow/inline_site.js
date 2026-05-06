import { enclosingFunction } from "#helpers/syntax/functions"
import { isWithin } from "#helpers/syntax/ranges"

const FUNCTION_TYPES = new Set([ "FunctionDeclaration", "FunctionExpression" ])
const STEP_SAFETY = {
  ArrayExpression: "isArrayElement",
  AssignmentExpression: "isAssignmentPart",
  AwaitExpression: "isAwaitedValue",
  BinaryExpression: "isLeftOperand",
  CallExpression: "isCallPart",
  ConditionalExpression: "isCondition",
  LogicalExpression: "isLeftOperand",
  MemberExpression: "isMemberObject",
  NewExpression: "isCallPart",
  ObjectExpression: "isObjectProperty",
  Property: "isPropertyValue",
  SequenceExpression: "isSequenceElement",
  UnaryExpression: "isUnaryOperand",
  VariableDeclarator: "isDeclaratorValue"
}
const STATEMENT_ENTRY_SAFETY = {
  ExpressionStatement: "isExpression",
  IfStatement: "isCondition",
  ReturnStatement: "isArgument",
  SwitchStatement: "isDiscriminant",
  ThrowStatement: "isArgument",
  VariableDeclaration: "isDeclaration"
}
const TRIVIAL_TYPES = new Set([ "Literal" ])

export class InlineSite {
  #read
  #statement
  #value
  #bindings

  constructor({ read, statement, value, bindings }) {
    this.#read = read
    this.#statement = statement
    this.#value = value
    this.#bindings = bindings
  }

  get isSafe() {
    return !this.#isLosingUnboundCall && this.#isEvaluationOrderPreserved
  }

  get #isLosingUnboundCall() {
    const { parent } = this.#read
    return this.#value.type === "MemberExpression"
      && ((parent.type === "CallExpression" && parent.callee === this.#read)
        || (parent.type === "TaggedTemplateExpression" && parent.tag === this.#read))
  }

  get #isEvaluationOrderPreserved() {
    return new EvaluationPath(this.#read, this.#statement, this.#bindings).isSafe
      && this.#statementEntry.isSafe
  }

  get #statementEntry() {
    return new StatementEntry(this.#read, this.#statement, this.#bindings)
  }
}

class EvaluationPath {
  #child
  #boundary
  #bindings

  constructor(child, boundary, bindings) {
    this.#child = child
    this.#boundary = boundary
    this.#bindings = bindings
  }

  get isSafe() {
    for (let current = this.#child; current.parent && current.parent !== this.#boundary; current = current.parent) {
      if (!new EvaluationStep(current, current.parent, this.#bindings).isSafe) return false
    }
    return true
  }
}

class EvaluationStep {
  #child
  #parent
  #bindings

  constructor(child, parent, bindings) {
    this.#child = child
    this.#parent = parent
    this.#bindings = bindings
  }

  get isSafe() {
    const predicate = STEP_SAFETY[this.#parent.type]
    return predicate ? this[predicate] : false
  }

  get isArrayElement() {
    return hasOnlyTrivialBefore(this.#parent.elements, this.#child, this.#bindings)
  }

  get isAssignmentPart() {
    return this.#isAssignmentTarget || this.#isSafeAssignmentValue
  }

  get isAwaitedValue() {
    return this.#parent.argument === this.#child
  }

  get isLeftOperand() {
    return this.#parent.left === this.#child
  }

  get isCallPart() {
    return this.#isCallee || this.#isSafeArgument
  }

  get isCondition() {
    return this.#parent.test === this.#child
  }

  get isMemberObject() {
    return this.#parent.object === this.#child
  }

  get isObjectProperty() {
    return this.#parent.properties.includes(this.#property)
      && hasOnlyTrivialBefore(this.#parent.properties, this.#property, this.#bindings)
  }

  get isPropertyValue() {
    return !this.#parent.computed && this.#parent.value === this.#child
  }

  get isSequenceElement() {
    return hasOnlyTrivialBefore(this.#parent.expressions, this.#child, this.#bindings)
  }

  get isUnaryOperand() {
    return this.#parent.argument === this.#child
  }

  get isDeclaratorValue() {
    return this.#parent.init === this.#child
  }

  get #isAssignmentTarget() {
    return this.#parent.left === this.#child
  }

  get #isSafeAssignmentValue() {
    return this.#parent.right === this.#child
      && this.#parent.operator === "="
      && new SyntaxNode(this.#parent.left, this.#bindings).isTrivialTarget
  }

  get #isCallee() {
    return this.#parent.callee === this.#child
  }

  get #isSafeArgument() {
    return this.#isArgument && this.#hasSafeCallPrefix
  }

  get #isArgument() {
    return this.#parent.arguments.includes(this.#child)
  }

  get #hasSafeCallPrefix() {
    return new SyntaxNode(this.#parent.callee, this.#bindings).isTrivialCallee
      && hasOnlyTrivialBefore(this.#parent.arguments, this.#child, this.#bindings)
  }

  get #property() {
    return this.#child.type === "Property" ? this.#child : this.#child.parent
  }
}

function hasOnlyTrivialBefore(items, child, bindings) {
  return items.slice(0, items.indexOf(child)).every((node) => new SyntaxNode(node, bindings).isTrivialEvaluation)
}

class SyntaxNode {
  #node
  #bindings

  constructor(node, bindings) {
    this.#node = node
    this.#bindings = bindings
  }

  get isTrivialCallee() {
    return this.#node.type === "Identifier" && this.#hasStableBinding
  }

  get isTrivialEvaluation() {
    return !this.#node || TRIVIAL_TYPES.has(this.#node.type)
      || (this.#node.type === "ThisExpression" && new ThisValue(this.#node).isSafeToRead)
      || (this.#node.type === "Identifier" && this.#hasStableBinding)
      || this.#isTrivialContainer
  }

  get isTrivialTarget() {
    return this.#node.type === "Identifier" && this.#hasLocalBinding
  }

  childUnder(ancestor) {
    let child = this.#node
    while (child.parent && child.parent !== ancestor) child = child.parent
    return child.parent === ancestor ? child : null
  }

  get #hasStableBinding() {
    return this.#hasLocalBinding
      && this.#binding.defs.every((definition) => new DefinitionAvailability(definition, this.#node).isAvailable)
      && this.#bindings.isUnmodified(this.#node)
  }

  get #hasLocalBinding() {
    return Boolean(this.#binding?.defs.length)
      && this.#binding.defs.every((definition) => definition.type !== "ImportBinding")
  }

  get #binding() {
    return this.#bindings.variableFor(this.#node)
  }

  get #isTrivialContainer() {
    return this.#isTrivialProperty || this.#isTrivialDeclarator
  }

  get #isTrivialProperty() {
    return this.#node.type === "Property"
      && !this.#node.computed
      && new SyntaxNode(this.#node.value, this.#bindings).isTrivialEvaluation
  }

  get #isTrivialDeclarator() {
    return this.#node.type === "VariableDeclarator"
      && this.#node.id.type === "Identifier"
      && new SyntaxNode(this.#node.init, this.#bindings).isTrivialEvaluation
  }
}

class ThisValue {
  #node

  constructor(node) {
    this.#node = node
  }

  get isSafeToRead() {
    return !this.#isInDerivedConstructor
  }

  get #isInDerivedConstructor() {
    const owner = this.#owner
    return owner?.parent.type === "MethodDefinition"
      && owner.parent.kind === "constructor"
      && Boolean(owner.parent.parent.parent.superClass)
  }

  get #owner() {
    for (let current = this.#node.parent; current; current = current.parent) {
      if (current.type !== "ArrowFunctionExpression" && FUNCTION_TYPES.has(current.type)) return current
    }
    return null
  }
}

class DefinitionAvailability {
  #definition
  #reference

  constructor(definition, reference) {
    this.#definition = definition
    this.#reference = reference
  }

  get isAvailable() {
    return this.#isHoistedOrEntered
      || (this.#sharesExecutionContext && !this.#isSkippingCaseInitialization
        && this.#definition.node.range[1] <= this.#reference.range[0])
  }

  get #isHoistedOrEntered() {
    return this.#definition.type === "FunctionName"
      || this.#definition.type === "Parameter"
      || this.#definition.type === "CatchClause"
      || (this.#definition.type === "Variable" && this.#definition.parent.kind === "var")
  }

  get #sharesExecutionContext() {
    return enclosingFunction(this.#definition.node) === enclosingFunction(this.#reference)
  }

  get #isSkippingCaseInitialization() {
    const switchCase = switchCaseOf(this.#definition.node)
    return Boolean(switchCase) && !isWithin(this.#reference, switchCase.range)
  }
}

function switchCaseOf(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === "SwitchCase") return current
  }
  return null
}

class StatementEntry {
  #child
  #statement
  #bindings

  constructor(read, statement, bindings) {
    this.#child = new SyntaxNode(read).childUnder(statement)
    this.#statement = statement
    this.#bindings = bindings
  }

  get isSafe() {
    const predicate = STATEMENT_ENTRY_SAFETY[this.#statement.type]
    return predicate ? this[predicate] : false
  }

  get isExpression() {
    return this.#statement.expression === this.#child
  }

  get isCondition() {
    return this.#statement.test === this.#child
  }

  get isArgument() {
    return this.#statement.argument === this.#child
  }

  get isDiscriminant() {
    return this.#statement.discriminant === this.#child
  }

  get isDeclaration() {
    return hasOnlyTrivialBefore(this.#statement.declarations, this.#child, this.#bindings)
  }
}
