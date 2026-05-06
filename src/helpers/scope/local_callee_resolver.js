import { LocalReceiverGroups } from "#helpers/scope/local_receiver_groups"
import { ReceiverMembers } from "#helpers/scope/receiver_members"
import { resolvedMemberKeyOf } from "#helpers/classes/resolved_member_key"

export class LocalCalleeResolver {
  #bindings
  #groups
  #members

  constructor(sourceCode, { bindings, classMemberResolution }) {
    this.#bindings = bindings
    this.#groups = LocalReceiverGroups.for(sourceCode, bindings)
    this.#members = new ReceiverMembers(bindings, classMemberResolution)
  }

  functionFor(member) {
    const property = resolvedMemberKeyOf(member, this.#bindings)
    if (!property) return null
    if (member.object.type === "ObjectExpression") {
      return this.#members.functionAt({ property, receiver: member.object })
    }
    if (member.object.type !== "Identifier") return null

    const group = this.#groups.groupFor(member.object)
    return group && new GroupMemberCall(group, {
      groups: this.#groups,
      members: this.#members,
      member,
      property
    }).functionNode
  }
}

class GroupMemberCall {
  #group
  #groups
  #member
  #members
  #property

  constructor(group, { groups, member, members, property }) {
    this.#group = group
    this.#groups = groups
    this.#member = member
    this.#members = members
    this.#property = property
  }

  get functionNode() {
    return this.#isResolvable
      ? this.#members.safeFunctionAt({ property: this.#property, receiver: this.#group.root })
      : null
  }

  get #isResolvable() {
    return this.#group.isConfinedFor(this.#members)
      && this.#members.hasSafeInitialization(this.#group.root)
      && !this.#group.hasCallableMutationBefore({ groups: this.#groups, member: this.#member, members: this.#members })
  }
}
