import { ExecutionPosition } from "#helpers/flow/execution_position"
import { isFunction } from "#helpers/syntax/functions"
import { StaticCondition } from "#helpers/syntax/static_condition"
import { ClassSelfReference } from "#helpers/classes/class_self_reference"

const SEQUENCE_TYPES = new Set([ "BlockStatement", "Program", "StaticBlock", "SwitchCase" ])
const CONDITIONAL_BODY_TYPES = new Set([
  "DoWhileStatement", "ForInStatement", "ForOfStatement", "ForStatement", "LabeledStatement", "WhileStatement"
])

export class BindingState {
  #availability
  #definition
  #definitionWindow
  #globalWindow
  #writes

  constructor(definitions, references, { dominance, scope = null }) {
    this.#definition = definitions.length === 1 ? definitions[0] : null
    this.#writes = references
    this.#availability = new DefinitionAvailability(this.#definition, { dominance, scope })
    this.#definitionWindow = this.#windowAfterDefinition
    this.#globalWindow = this.#writes.length > 0 ? ExecutionWindow.before(this.#writes) : null
  }

  definitionAt(identifier, scope) {
    return this.#isDefinitionStableAt(identifier, scope) || this.#definitionWindow?.includes(identifier)
      ? this.#definition
      : null
  }

  isOriginalAt(identifier) {
    return this.#writes.length === 0 || Boolean(this.#globalWindow?.includes(identifier))
  }

  get #windowAfterDefinition() {
    return this.#availability.start && this.#writes.length > 0
      ? ExecutionWindow.after(this.#availability.start, this.#writes)
      : null
  }

  #isDefinitionStableAt(identifier, scope) {
    return this.#writes.length === 0 && this.#availability.isAvailableAt(identifier, scope)
  }
}

class DefinitionAvailability {
  #definition
  #dominance
  #initialization
  #scope
  #cachedDominatingInitialization

  constructor(definition, { dominance, scope }) {
    this.#definition = definition
    this.#dominance = dominance
    this.#scope = scope
    this.#initialization = new DefinitionInitialization(definition).node
  }

  get start() {
    if (this.#isInitializedAtEntry) return SequencePoint.atStartOf(this.#scope)
    return this.#isClassSelfBinding ? null : SequencePoint.dominating(this.#initialization)
  }

  isAvailableAt(node, scope) {
    return this.#isClassSelfBinding
      ? new ClassSelfReference(node, this.#definition.node).isAfterInitialization
      : this.#isInitializedAtEntry || this.#dominatingInitialization.isBefore(node, scope)
  }

  get #isInitializedAtEntry() {
    return this.#definition?.type === "FunctionName"
  }

  get #isClassSelfBinding() {
    return this.#definition?.type === "ClassName" && this.#scope?.type === "class"
      && this.#scope.block === this.#definition.node
  }

  get #dominatingInitialization() {
    return this.#cachedDominatingInitialization ??=
      new DominatingInitialization(this.#initialization, {
        allowDeferred: new DefinitionInitialization(this.#definition).isLexical,
        dominance: this.#dominance,
        scope: this.#scope
      })
  }
}

class DefinitionInitialization {
  #definition

  constructor(definition) {
    this.#definition = definition
  }

  get node() {
    if (this.#isInitializedVariable) return this.#definition.node.init
    return this.#isClassDeclaration ? this.#definition.node : null
  }

  get isLexical() {
    return (this.#definition?.type === "Variable" && this.#definition.parent.kind !== "var")
      || this.#isClassDeclaration
  }

  get #isInitializedVariable() {
    return this.#definition?.type === "Variable" && Boolean(this.#definition.node.init)
  }

  get #isClassDeclaration() {
    return this.#definition?.type === "ClassName" && this.#definition.node.type === "ClassDeclaration"
  }
}

class SequencePoint {
  static atStartOf(scope) {
    const sequence = executionSequenceOf(scope)
    return sequence ? new SequencePoint(sequence, -Infinity) : null
  }

  static dominating(node) {
    return sequencePointFor(node, true)
  }

  static of(node) {
    return sequencePointFor(node, false)
  }

  constructor(sequence, position) {
    this.sequence = sequence
    this.position = position
  }
}

function executionSequenceOf(scope) {
  const block = scope?.block
  if (isFunction(block)) return block.body
  return SEQUENCE_TYPES.has(block?.type) ? block : null
}

function sequencePointFor(node, onlyDominating) {
  return node ? new SequencePointWalk(node, onlyDominating).value : null
}

class SequencePointWalk {
  #current
  #declarator = null
  #onlyDominating

  constructor(node, onlyDominating) {
    this.#current = node
    this.#onlyDominating = onlyDominating
  }

  get value() {
    while (new ParentRelation(this.#current).canAscend) {
      const point = this.#nextPoint
      if (point || this.#isBlocked) return point

      this.#advance()
    }
    return null
  }

  get #nextPoint() {
    return SEQUENCE_TYPES.has(this.#current.parent.type)
      ? new SequencePoint(this.#current.parent, (this.#declarator ?? this.#current).range[0])
      : null
  }

  get #isBlocked() {
    return this.#onlyDominating && !new ParentRelation(this.#current).isGuaranteed
  }

  #advance() {
    if (this.#current.type === "VariableDeclarator") this.#declarator = this.#current
    this.#current = this.#current.parent
  }
}

class ParentRelation {
  #node

  constructor(node) {
    this.#node = node
  }

  get canAscend() {
    return Boolean(this.#node.parent) && !isFunction(this.#node.parent) && !this.#isDeferredFieldValue
  }

  get isGuaranteed() {
    if (this.#node.parent?.type !== "IfStatement") return !this.#isConditionalControlChild

    const condition = new StaticCondition(this.#node.parent.test).value
    return (condition === true && this.#node.parent.consequent === this.#node)
      || (condition === false && this.#node.parent.alternate === this.#node)
  }

  get #isDeferredFieldValue() {
    return this.#node.parent?.type === "PropertyDefinition" && this.#node.parent.value === this.#node
  }

  get #isConditionalControlChild() {
    const { parent } = this.#node
    if (CONDITIONAL_BODY_TYPES.has(parent?.type)) return parent.body === this.#node
    if (parent?.type === "SwitchStatement") return parent.cases.includes(this.#node)
    return parent?.type === "TryStatement"
  }
}

class DominatingInitialization {
  #allowDeferred
  #dominance
  #initialization
  #nearestWindow
  #scope
  #cachedPosition

  constructor(initialization, { allowDeferred, dominance, scope }) {
    this.#allowDeferred = allowDeferred
    this.#initialization = initialization
    this.#dominance = dominance
    this.#scope = scope
    this.#nearestWindow = initialization
      ? ExecutionWindow.after(SequencePoint.dominating(initialization), [])
      : null
  }

  isBefore(node, scope) {
    if (this.#isReachable) {
      const position = ExecutionPosition.of(node, scope)
      return this.#isDeferredFrom(position) || this.#nearestWindow?.includes(node)
        || this.#isBeforeInExecution(position)
    } else {
      return false
    }
  }

  get #isReachable() {
    return Boolean(this.#initialization) && this.#dominance.isReachable(this.#initialization)
  }

  #isDeferredFrom(position) {
    return this.#allowDeferred && Boolean(this.#position) && Boolean(position)
      && this.#position.executionScope !== position.executionScope
  }

  get #position() {
    return this.#cachedPosition ??= ExecutionPosition.of(this.#initialization, this.#scope)
  }

  #isBeforeInExecution(position) {
    return Boolean(this.#position) && Boolean(position)
      && new GuaranteedExecution(this.#initialization, this.#scope).reachesScope
      && this.#position.sequence === position.sequence && this.#position.position < position.position
  }
}

class ExecutionWindow {
  #end = Infinity
  #isValid = true
  #sequence
  #start = -Infinity

  static after(initialization, writes) {
    return new ExecutionWindow(initialization, writes, false)
  }

  static before(writes) {
    return new ExecutionWindow(null, writes, true)
  }

  constructor(start, writes, oneShot) {
    this.#initializeStart(start, oneShot)
    writes.forEach((write) => this.#include(SequencePoint.of(write.identifier)))
    if (oneShot) this.#validateOneShot()
  }

  includes(node) {
    return this.#isValid && this.#isIncludedPoint(SequencePoint.of(node))
  }

  #initializeStart(start, oneShot) {
    this.#initializePoint(start)
    this.#isValid = Boolean(start) || oneShot
  }

  #initializePoint(start) {
    this.#sequence = start?.sequence ?? null
    this.#start = start?.position ?? -Infinity
  }

  #include(point) {
    if (this.#canInclude(point)) this.#includeValid(point)
    else this.#isValid = false
  }

  #canInclude(point) {
    return Boolean(point) && (!this.#sequence || point.sequence === this.#sequence)
  }

  #includeValid(point) {
    if (!this.#sequence) this.#sequence = point.sequence
    this.#end = Math.min(this.#end, point.position)
  }

  #validateOneShot() {
    this.#isValid &&= this.#sequence?.type === "Program"
  }

  #isIncludedPoint(point) {
    return Boolean(point) && this.#includesPoint(point)
  }

  #includesPoint(point) {
    return point.sequence === this.#sequence && this.#includesPosition(point.position)
  }

  #includesPosition(position) {
    return this.#start < position && position < this.#end
  }
}

class GuaranteedExecution {
  #current
  #target

  constructor(node, scope) {
    this.#current = node
    this.#target = scope?.variableScope.block
  }

  get reachesScope() {
    while (this.#canAdvance) this.#current = this.#current.parent
    return this.#current === this.#target
  }

  get #canAdvance() {
    return Boolean(this.#current) && this.#current !== this.#target ? this.#isGuaranteedStep : false
  }

  get #isGuaranteedStep() {
    return !isFunction(this.#current) && !this.#isDeferredFieldValue
      && new ParentRelation(this.#current).isGuaranteed
  }

  get #isDeferredFieldValue() {
    const { parent } = this.#current
    return parent?.type === "PropertyDefinition" && !parent.static && parent.value === this.#current
  }
}
