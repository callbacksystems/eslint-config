import bounds from "binary-search-bounds"
import { repeatedAncestorsOf } from "#helpers/flow/repeated_ancestors"

export class BindingAssignments {
  #assignmentCandidates
  #assignments
  #dominance
  #lifetime
  #ownerExecution
  #writeIndex

  constructor(variable, writes, dominance) {
    this.#dominance = dominance
    this.#ownerExecution = variable.scope.variableScope
    this.#writeIndex = new BindingWriteIndex(writes, this.#ownerExecution)
    this.#assignments = this.#writeIndex.values
      .map((reference) => new SimpleAssignment(reference, dominance))
      .filter((assignment) => assignment.isPresent)
    this.#assignmentCandidates = new AssignmentCandidates(this.#assignments)
    this.#lifetime = new AssignmentLifetime(variable)
  }

  valueAt(identifier, reference) {
    return this.#canResolve(identifier, reference) ? this.#resolvedValueAt(identifier) : null
  }

  #canResolve(identifier, reference) {
    return Boolean(reference) && reference.isRead() && !reference.isWrite()
      && reference.from.variableScope === this.#ownerExecution
      && this.#dominance.isReachable(identifier)
  }

  #resolvedValueAt(identifier) {
    const assignment = this.#assignmentBefore(identifier)
    return assignment && this.#isUncontested(assignment, identifier) ? assignment.value : null
  }

  #assignmentBefore(identifier) {
    const assignment = this.#assignmentCandidates.before(identifier)
    return assignment?.dominates(identifier) && this.#lifetime.includes(assignment) ? assignment : null
  }

  #isUncontested(assignment, identifier) {
    return this.#writeIndex.isUncontested(assignment.reference, identifier)
  }
}

class BindingWriteIndex {
  #containment
  #hasForeignWrite
  #indexesByIdentifier = new WeakMap()
  #positionsByLoop = new WeakMap()

  constructor(writes, ownerExecution) {
    this.values = writes.toSorted(bySourcePosition)
    this.#containment = new WriteContainmentIndex(this.values, referenceOf)
    this.#hasForeignWrite = this.values.some((write) => write.from.variableScope !== ownerExecution)
    this.values.forEach((write, index) => {
      this.#indexesByIdentifier.set(write.identifier, index)
      this.#indexLoopsOf(write)
    })
  }

  isUncontested(assignment, identifier) {
    const interval = new AssignmentInterval(assignment.identifier, identifier)
    return !this.#hasForeignWrite && this.#isOnlyWriteIn(interval)
      && !this.#hasCarriedWriteAfter(interval)
  }

  #indexLoopsOf(write) {
    repeatedAncestorsOf(write.identifier).forEach((loop) => this.#add(loop, write.identifier.range[0]))
  }

  #add(loop, position) {
    if (!this.#positionsByLoop.has(loop)) this.#positionsByLoop.set(loop, [])
    this.#positionsByLoop.get(loop).push(position)
  }

  #isOnlyWriteIn(interval) {
    const assignment = this.#indexesByIdentifier.get(interval.assignment)
    return this.#containment.containsAll(interval.identifier, {
      from: this.#firstIndexAtOrAfter(interval.start), to: assignment
    }) && this.#containment.containsAll(interval.identifier, {
      from: assignment + 1, to: this.#firstIndexAtOrAfter(interval.end)
    })
  }

  #firstIndexAtOrAfter(position) {
    return bounds.ge(this.values, position, byReferencePosition)
  }

  #hasCarriedWriteAfter(interval) {
    return interval.carriedLoops.some((loop) =>
      this.#positionsByLoop.get(loop)?.at(-1) >= interval.end)
  }
}

function bySourcePosition(first, second) {
  return first.identifier.range[0] - second.identifier.range[0]
}

class WriteContainmentIndex {
  #root

  constructor(values, referenceOfValue) {
    this.#root = new WriteContainmentNode(values.map(referenceOfValue), { from: 0, to: treeSizeFor(values.length) })
  }

  indexOutside(identifier, { before }) {
    return this.#root.indexOutside(identifier, { before })
  }

  containsAll(identifier, range) {
    return this.#root.containsAll(identifier, range)
  }
}

class WriteContainmentNode {
  maximumStart = -Infinity
  minimumEnd = Infinity

  #from
  #left
  #right
  #to

  constructor(references, { from, to }) {
    this.#from = from
    this.#to = to
    if (this.#isLeaf) this.#setReference(references[from])
    else this.#setChildren(references)
  }

  indexOutside(identifier, { before }) {
    if (this.#from >= before || this.#contains(identifier)) return -1
    if (this.#isLeaf) return this.#from

    const right = this.#right.indexOutside(identifier, { before })
    return right >= 0 ? right : this.#left.indexOutside(identifier, { before })
  }

  containsAll(identifier, { from, to }) {
    if (to <= this.#from || from >= this.#to) return true
    if (from <= this.#from && this.#to <= to) return this.#contains(identifier)
    return this.#left.containsAll(identifier, { from, to })
      && this.#right.containsAll(identifier, { from, to })
  }

  get #isLeaf() {
    return this.#to - this.#from === 1
  }

  #setReference(reference) {
    this.maximumStart = reference ? reference.writeExpr?.range[0] ?? Infinity : -Infinity
    this.minimumEnd = reference ? reference.writeExpr?.range[1] ?? -Infinity : Infinity
  }

  #setChildren(references) {
    const middle = (this.#from + this.#to) / 2
    this.#left = new WriteContainmentNode(references, { from: this.#from, to: middle })
    this.#right = new WriteContainmentNode(references, { from: middle, to: this.#to })
    this.#setBoundsFromChildren()
  }

  #setBoundsFromChildren() {
    this.maximumStart = Math.max(this.#left.maximumStart, this.#right.maximumStart)
    this.minimumEnd = Math.min(this.#left.minimumEnd, this.#right.minimumEnd)
  }

  #contains(identifier) {
    return this.maximumStart <= identifier.range[0] && this.minimumEnd >= identifier.range[1]
  }
}

function treeSizeFor(length) {
  return 2 ** Math.ceil(Math.log2(Math.max(length, 1)))
}

function referenceOf(reference) {
  return reference
}

class AssignmentInterval {
  constructor(assignment, identifier) {
    this.assignment = assignment
    this.identifier = identifier
  }

  get start() {
    return this.assignment.range[0]
  }

  get end() {
    return this.identifier.range[0]
  }

  get carriedLoops() {
    return new RepetitionCarry(this.identifier, this.assignment).loops
  }
}

class RepetitionCarry {
  #assignmentLoops
  #identifierLoops

  constructor(identifier, assignment) {
    this.#identifierLoops = repeatedAncestorsOf(identifier)
    this.#assignmentLoops = repeatedAncestorsOf(assignment)
  }

  get loops() {
    return this.#identifierLoops.filter((loop) => !this.#assignmentLoops.includes(loop))
  }
}

function byReferencePosition(reference, position) {
  return referencePosition(reference) - position
}

function referencePosition(reference) {
  return reference.identifier.range[0]
}

class SimpleAssignment {
  #dominance
  #positions

  constructor(reference, dominance) {
    this.reference = reference
    this.#dominance = dominance
  }

  get isPresent() {
    return Boolean(this.value) && this.#isDirectSimpleWrite
      && this.#dominance.hasPositionAfter(this.operation)
  }

  get value() {
    return this.reference.writeExpr ?? null
  }

  get operation() {
    return this.reference.identifier.parent
  }

  dominates(node) {
    return this.#writePositions.hasBefore(node)
  }

  get #isDirectSimpleWrite() {
    return this.operation?.type === "AssignmentExpression" && this.operation.operator === "="
      && this.operation.left === this.reference.identifier && !this.reference.partial
      && this.reference.isWrite() && !this.reference.isRead()
  }

  get #writePositions() {
    if (!this.#positions) {
      this.#positions = this.#dominance.positions
      this.#positions.add(this.operation)
    }
    return this.#positions
  }
}

class AssignmentCandidates {
  #assignments
  #containment

  constructor(assignments) {
    this.#assignments = assignments
    this.#containment = new WriteContainmentIndex(assignments, assignmentReferenceOf)
  }

  before(identifier) {
    return this.#assignments[this.#containment.indexOutside(identifier, {
      before: bounds.ge(this.#assignments, identifier.range[0], byAssignmentPosition)
    })] ?? null
  }
}

function assignmentReferenceOf(assignment) {
  return assignment.reference
}

function byAssignmentPosition(assignment, position) {
  return byReferencePosition(assignment.reference, position)
}

class AssignmentLifetime {
  #definition
  #ownerExecution

  constructor(variable) {
    this.#definition = variable.defs.length === 1 ? variable.defs[0] : null
    this.#ownerExecution = variable.scope.variableScope
  }

  includes(assignment) {
    return Boolean(this.#definition) && assignment.reference.from.variableScope === this.#ownerExecution
      && (this.#isInitializedAtEntry || this.#isAfterLexicalInitialization(assignment.operation))
  }

  get #isInitializedAtEntry() {
    if ([ "CatchClause", "Parameter" ].includes(this.#definition.type)) return true
    if (this.#definition.type === "FunctionName") return this.#definition.node.type === "FunctionDeclaration"
    return this.#definition.type === "Variable" && this.#definition.parent.kind === "var"
  }

  #isAfterLexicalInitialization(operation) {
    if (this.#definition.type === "ClassName") {
      return this.#definition.node.type === "ClassDeclaration"
        && this.#definition.node.range[1] < operation.range[0]
    }
    return this.#definition.type === "Variable" && this.#definition.parent.kind === "let"
      && this.#definition.node.range[1] < operation.range[0]
  }
}
