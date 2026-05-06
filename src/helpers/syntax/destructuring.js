export function sourceOfDestructuringPattern(pattern) {
  return new DestructuringPattern(pattern).source
}

class DestructuringPattern {
  #pattern
  #owner

  constructor(pattern) {
    this.#pattern = pattern
    this.#owner = pattern?.parent
  }

  get source() {
    return this.#declarationSource ?? this.#assignmentSource
  }

  get #declarationSource() {
    return this.#owner?.type === "VariableDeclarator" && this.#owner.id === this.#pattern ? this.#owner.init : null
  }

  get #assignmentSource() {
    return this.#owner?.type === "AssignmentExpression" && this.#owner.left === this.#pattern
      ? this.#owner.right
      : null
  }
}
