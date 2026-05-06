import { directMemberOf, isClassNode } from "#helpers/syntax/classes"
import { memberWriteOperationOf } from "#helpers/classes/member_write_targets"
import { ReceiverMutationIndex } from "#helpers/scope/receiver_mutation_index"
import { StableAliasGroups } from "#helpers/scope/stable_alias_groups"

export class LocalReceiverGroups {
  static #bySource = new WeakMap()

  #aliases
  #bindings
  #groups = new WeakMap()
  #sourceCode

  static for(sourceCode, bindings) {
    if (!this.#bySource.has(sourceCode)) {
      this.#bySource.set(sourceCode, new LocalReceiverGroups(sourceCode, bindings))
    }
    return this.#bySource.get(sourceCode)
  }

  constructor(sourceCode, bindings) {
    this.#aliases = StableAliasGroups.for(sourceCode, bindings)
    this.#bindings = bindings
    this.#sourceCode = sourceCode
  }

  groupFor(identifier) {
    const aliases = this.#aliases.groupFor(identifier)
    return isLocalReceiverGroup(aliases) ? this.#groupFor(aliases) : null
  }

  referenceFor(identifier) {
    return this.#aliases.referenceFor(identifier)
  }

  #groupFor(aliases) {
    if (!this.#groups.has(aliases)) {
      this.#groups.set(aliases, new LocalReceiverGroup(aliases, this.#sourceCode, this.#bindings))
    }
    return this.#groups.get(aliases)
  }
}

function isLocalReceiverGroup(group) {
  return Boolean(group) && isLocalReceiverRoot(group.root)
}

function isLocalReceiverRoot(root) {
  return root.type === "ObjectExpression" || isClassNode(root)
}

class LocalReceiverGroup {
  #aliases
  #mutationIndex

  constructor(aliases, sourceCode, bindings) {
    this.#aliases = aliases
    this.#mutationIndex = new ReceiverMutationIndex(aliases.variables, {
      bindings,
      root: sourceCode.ast,
      rootScope: aliases.rootScope
    })
  }

  isConfinedFor(members) {
    return this.#aliases.isConfinedFor(members, (reference) => this.#isSafeReference(reference, members))
  }

  hasCallableMutationBefore({ groups, member, members }) {
    return this.#mutationIndex.hasCallableBefore({
      members,
      receiver: this.root,
      reference: groups.referenceFor(member.object),
      target: member
    })
  }

  get root() {
    return this.#aliases.root
  }

  #isSafeReference(reference, members) {
    const member = directMemberOf(reference.identifier)
    return Boolean(member) && (Boolean(memberWriteOperationOf(member)) || isSafeCallOf(member, this.root, members))
  }
}

function isSafeCallOf(member, receiver, members) {
  return member.parent?.type === "CallExpression" && member.parent.callee === member
    && members.isSafeCall(receiver, member)
}
