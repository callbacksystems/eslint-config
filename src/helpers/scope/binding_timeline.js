import { ExecutionDominance } from "#helpers/flow/execution_dominance"
import { isReassignment, referencesIn } from "#helpers/scope/references"
import { BindingAssignments } from "#helpers/scope/binding_assignments"
import { BindingState } from "#helpers/scope/binding_state"

export class BindingTimeline {
  #assignmentsByVariable = new WeakMap()
  #dominance
  #reachableWrites
  #references
  #statesByVariable = new WeakMap()
  #unresolvedWrites

  constructor(scopeManager) {
    this.#dominance = new ExecutionDominance(scopeManager.globalScope.block)
    this.#reachableWrites = new ReachableWrites(this.#dominance)
    this.#references = referencesIn(scopeManager)
    this.#unresolvedWrites = new UnresolvedWrites(
      this.#reachableWrites.writesIn(scopeManager.globalScope.through), this.#dominance)
  }

  definitionAt(identifier, variable) {
    return variable
      ? this.#stateOf(variable).definitionAt(identifier, this.#references.get(identifier)?.from ?? null)
      : null
  }

  assignmentAt(identifier, variable) {
    return variable
      ? this.#assignmentsOf(variable).valueAt(identifier, this.#references.get(identifier) ?? null)
      : null
  }

  isOriginalGlobalAt(identifier, variable) {
    return variable
      ? this.isGlobalBinding(variable) && this.#stateOf(variable).isOriginalAt(identifier)
      : this.#unresolvedWrites.isOriginalAt(identifier)
  }

  isGlobalBinding(variable) {
    return Boolean(variable) && variable.scope.type === "global" && variable.defs.length === 0
  }

  #stateOf(variable) {
    if (!this.#statesByVariable.has(variable)) {
      this.#statesByVariable.set(variable,
        new BindingState(variable.defs, this.#reachableWrites.writesIn(variable.references), {
          dominance: this.#dominance,
          scope: variable.scope
        }))
    }
    return this.#statesByVariable.get(variable)
  }

  #assignmentsOf(variable) {
    if (!this.#assignmentsByVariable.has(variable)) {
      this.#assignmentsByVariable.set(variable, new BindingAssignments(variable,
        this.#reachableWrites.writesIn(variable.references), this.#dominance))
    }
    return this.#assignmentsByVariable.get(variable)
  }
}

class ReachableWrites {
  #dominance

  constructor(dominance) {
    this.#dominance = dominance
  }

  writesIn(references) {
    return references.filter((reference) =>
      isReassignment(reference) && this.#dominance.isReachable(reference.identifier))
  }
}

class UnresolvedWrites {
  #dominance
  #referencesByName = new Map()
  #statesByName = new Map()

  constructor(writes, dominance) {
    this.#dominance = dominance
    writes.forEach((reference) => this.#add(reference))
  }

  isOriginalAt(identifier) {
    return this.#stateFor(identifier.name).isOriginalAt(identifier)
  }

  #add(reference) {
    const { name } = reference.identifier
    if (!this.#referencesByName.has(name)) this.#referencesByName.set(name, [])
    this.#referencesByName.get(name).push(reference)
  }

  #stateFor(name) {
    if (!this.#statesByName.has(name)) {
      this.#statesByName.set(name, new BindingState([], this.#referencesByName.get(name) ?? [], {
        dominance: this.#dominance
      }))
    }
    return this.#statesByName.get(name)
  }
}
