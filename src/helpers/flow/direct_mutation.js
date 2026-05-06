import { enclosingFunction, isFunction } from "#helpers/syntax/functions"
import { ObservableMemberWrites } from "#helpers/flow/observable_member_writes"
import { isThisMember } from "#helpers/syntax/classes"
import { memberWriteOperationTypes, memberWriteTargetsOf } from "#helpers/classes/member_write_targets"

const MEMBER_WRITE_TYPES = memberWriteOperationTypes()

export class DirectMutation {
  #cachedFreshMemberWriteTargets
  #cachedFreshObservableMemberWrites
  #cachedMemberWriteTargets
  #cachedObservableMemberWrites
  #context
  #bindings
  #policy

  constructor(context, { bindings, policy }) {
    this.#context = context
    this.#bindings = bindings
    this.#policy = policy
  }

  get exists() {
    return this.#isMemberWrite
      || Boolean(this.#policy.isAdditionalEffect?.(this.#context.node))
  }

  get bindingMutation() {
    const { functionNode } = this.#context
    if (!this.#bindingIdentifier || this.#isUnknownBindingWrite) return null

    const boundary = bindingBoundaryOf(this.#bindings.variableFor(this.#bindingIdentifier))
    return boundary === functionNode ? null : { boundary }
  }

  get freshReceiverResult() {
    return new DirectMutationResult({
      exists: this.#freshMemberWriteExists
        || Boolean(this.#policy.isAdditionalEffect?.(this.#context.node)),
      isUnknown: this.#policy.memberWrites !== "all"
        && ((this.#freshMemberWriteTargets.length > 0 && this.#freshObservableMemberWrites.isUnknown)
          || this.#isUnknownBindingWrite)
    })
  }

  get isUnknown() {
    return this.#policy.memberWrites !== "all"
      && ((this.#hasMemberWriteTargets && this.#observableMemberWrites.isUnknown) || this.#isUnknownBindingWrite)
  }

  get receiverWriteTargets() {
    return this.#memberWriteTargets.filter(isThisMember)
  }

  get #isMemberWrite() {
    return this.#hasMemberWriteTargets && this.#memberWriteExists
  }

  get #hasMemberWriteTargets() {
    return this.#memberWriteTargets.length > 0
  }

  get #memberWriteTargets() {
    if (!this.#cachedMemberWriteTargets) {
      this.#cachedMemberWriteTargets = MEMBER_WRITE_TYPES.has(this.#context.node.type)
        ? memberWriteTargetsOf(this.#context.node)
        : []
    }
    return this.#cachedMemberWriteTargets
  }

  get #memberWriteExists() {
    return this.#hasMemberWriteTargets
      && (this.#policy.memberWrites === "all" || this.#observableMemberWrites.exists)
  }

  get #observableMemberWrites() {
    return this.#cachedObservableMemberWrites ??= this.#observableMemberWritesFor(this.#memberWriteTargets)
  }

  #observableMemberWritesFor(targets) {
    return new ObservableMemberWrites(targets, { functionNode: this.#context.functionNode, bindings: this.#bindings })
  }

  get #bindingIdentifier() {
    const { node } = this.#context
    return node.type === "Identifier" && this.#bindings.isReassignment(node) ? node : null
  }

  get #isUnknownBindingWrite() {
    const { node } = this.#context
    return this.#policy.memberWrites !== "all" && node.type === "Identifier"
      && this.#bindings.isReassignment(node) && this.#bindings.isDynamicallyResolved(node)
  }

  get #freshMemberWriteExists() {
    return this.#freshMemberWriteTargets.length > 0
      && (this.#policy.memberWrites === "all" || this.#freshObservableMemberWrites.exists)
  }

  get #freshMemberWriteTargets() {
    return this.#cachedFreshMemberWriteTargets ??= this.#memberWriteTargets.filter((target) => !isThisMember(target))
  }

  get #freshObservableMemberWrites() {
    return this.#cachedFreshObservableMemberWrites ??= this.#observableMemberWritesFor(this.#freshMemberWriteTargets)
  }
}

function bindingBoundaryOf(variable) {
  const scopeNode = variable?.scope.block
  if (!scopeNode || scopeNode.type === "Program") return null

  return isFunction(scopeNode) ? scopeNode : enclosingFunction(scopeNode)
}

class DirectMutationResult {
  constructor({ exists, isUnknown }) {
    this.exists = exists
    this.isUnknown = isUnknown
  }
}
