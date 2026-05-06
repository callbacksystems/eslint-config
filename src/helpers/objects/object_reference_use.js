import { directMemberOf } from "#helpers/syntax/classes"
import { memberWriteOperationOf } from "#helpers/classes/member_write_targets"
import { StandardPropertyWrites } from "#helpers/objects/standard_property_writes"

export class ObjectReferenceUse {
  #bindings
  #identifier
  #outerMember

  constructor(identifier, bindings) {
    this.#identifier = identifier
    this.#bindings = bindings
  }

  get hasTrackedWrite() {
    return Boolean(this.#writeOperation) || this.#isStandardWriteTarget
  }

  get #writeOperation() {
    return this.#outermostMember ? memberWriteOperationOf(this.#outermostMember) : null
  }

  get #outermostMember() {
    if (this.#outerMember === undefined) {
      this.#outerMember = this.#directMember
      while (this.#hasOuterMember) this.#outerMember = this.#outerMember.parent
    }
    return this.#outerMember
  }

  get #directMember() {
    return directMemberOf(this.#identifier)
  }

  get #hasOuterMember() {
    const { parent } = this.#outerMember ?? {}
    return parent?.type === "MemberExpression" && parent.object === this.#outerMember
  }

  get #isStandardWriteTarget() {
    return this.#argumentCall
      ? new StandardPropertyWrites(this.#argumentCall, this.#bindings).hasTarget(this.#identifier)
      : false
  }

  get #argumentCall() {
    return this.#directArgumentCall ?? this.#appliedArgumentCall
  }

  get #directArgumentCall() {
    return this.#identifier.parent?.type === "CallExpression" ? this.#identifier.parent : null
  }

  get #appliedArgumentCall() {
    const array = this.#identifier.parent
    return array?.type === "ArrayExpression" && array.parent?.type === "CallExpression" ? array.parent : null
  }
}
