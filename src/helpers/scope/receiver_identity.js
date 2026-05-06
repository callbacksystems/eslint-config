import { ReceiverMutationIndex } from "#helpers/scope/receiver_mutation_index"
import { StableAliasGroups } from "#helpers/scope/stable_alias_groups"
import { StandardPropertyWrites } from "#helpers/objects/standard_property_writes"
import { PointwiseAliasConfinement } from "#helpers/scope/pointwise_alias_confinement"

const RECEIVER_POLICY = {}

export class ReceiverIdentity {
  #aliases
  #bindings
  #mutations = new WeakMap()
  #pointwise
  #root

  constructor(sourceCode, bindings) {
    this.#aliases = StableAliasGroups.for(sourceCode, bindings)
    this.#bindings = bindings
    this.#root = sourceCode.ast
    this.#pointwise = new PointwiseReceiverIdentity(sourceCode, bindings)
  }

  hasUnmodifiedMemberAt(identifier, name, target) {
    const group = this.#aliases.groupFor(identifier)
    return group
      ? this.#hasStableIdentityAt(group, { reference: this.#aliases.referenceFor(identifier), name, target })
      : this.#pointwise.hasUnmodifiedMemberAt(identifier, name, target)
  }

  #hasStableIdentityAt(group, { name, reference, target }) {
    return group.isConfinedAt({
      ignoredReference: reference,
      isSafeReference: (candidate) => new SafeReceiverReference(candidate, this.#bindings).isPresent,
      policy: RECEIVER_POLICY,
      reference,
      target
    }) && !this.#mutationIndexFor(group).hasPropertyMutationBefore({ name, reference, target })
  }

  #mutationIndexFor(group) {
    if (!this.#mutations.has(group)) {
      this.#mutations.set(group, new ReceiverMutationIndex(group.variables, {
        bindings: this.#bindings,
        root: this.#root,
        rootScope: group.rootScope
      }))
    }
    return this.#mutations.get(group)
  }
}

class PointwiseReceiverIdentity {
  #bindings
  #confinements = new WeakMap()
  #mutations = new WeakMap()
  #root
  #sourceCode

  constructor(sourceCode, bindings) {
    this.#sourceCode = sourceCode
    this.#bindings = bindings
    this.#root = sourceCode.ast
  }

  hasUnmodifiedMemberAt(identifier, name, target) {
    const variable = this.#bindings.variableFor(identifier)
    const reference = variable?.references.find((candidate) => candidate.identifier === identifier)
    return Boolean(reference) && !this.#bindings.isDynamicallyResolved(identifier)
      && this.#confinementFor(variable).isSafeAt(target, reference, { ignoredReference: reference })
      && !this.#mutationIndexFor(variable).hasPropertyMutationBefore({ name, reference, target })
  }

  #confinementFor(variable) {
    if (!this.#confinements.has(variable)) {
      this.#confinements.set(variable, new PointwiseAliasConfinement(
        variable.references.filter((reference) => !reference.init), {
          isSafeReference: (reference) => new SafeReceiverReference(reference, this.#bindings).isPresent,
          rootScope: variable.scope.variableScope,
          sourceCode: this.#sourceCode
        }))
    }
    return this.#confinements.get(variable)
  }

  #mutationIndexFor(variable) {
    if (!this.#mutations.has(variable)) {
      this.#mutations.set(variable, new ReceiverMutationIndex(new Set([ variable ]), {
        bindings: this.#bindings,
        root: this.#root,
        rootScope: variable.scope.variableScope
      }))
    }
    return this.#mutations.get(variable)
  }
}

class SafeReceiverReference {
  #bindings
  #reference

  constructor(reference, bindings) {
    this.#reference = reference
    this.#bindings = bindings
  }

  get isPresent() {
    return this.#member ? !this.#isMemberInvocation : this.#isStandardPropertyWrite
  }

  get #member() {
    const { parent } = this.#reference.identifier
    return parent?.type === "MemberExpression" && parent.object === this.#reference.identifier ? parent : null
  }

  get #isMemberInvocation() {
    const { parent } = this.#member
    return (parent?.type === "CallExpression" && parent.callee === this.#member)
      || (parent?.type === "TaggedTemplateExpression" && parent.tag === this.#member)
  }

  get #isStandardPropertyWrite() {
    const call = this.#reference.identifier.parent
    return call?.type === "CallExpression"
      && new StandardPropertyWrites(call, this.#bindings).hasTarget(this.#reference.identifier)
  }
}
