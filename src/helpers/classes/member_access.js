import { propertyNameOf } from "#helpers/syntax/classes"

export class MemberAccess {
  #member

  constructor(member) {
    this.#member = member
  }

  get isLengthRead() {
    return !this.isCalled && propertyNameOf(this.#member) === "length"
  }

  get isCalled() {
    return this.#member.parent?.type === "CallExpression" && this.#member.parent.callee === this.#member
  }
}
