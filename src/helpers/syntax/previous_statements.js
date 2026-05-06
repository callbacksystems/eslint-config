// Index statement-list neighbors once for rules that ask about many siblings in the same block.

export class PreviousStatements {
  #byStatement = new WeakMap()

  before(statement) {
    if (!this.#byStatement.has(statement)) this.#indexSiblingsOf(statement)
    return this.#byStatement.get(statement)
  }

  #indexSiblingsOf(statement) {
    const siblings = statementListIn(statement.parent)
    siblings.forEach((sibling, index) => {
      this.#byStatement.set(sibling, siblings[index - 1] ?? null)
    })
    if (!this.#byStatement.has(statement)) this.#byStatement.set(statement, null)
  }
}

function statementListIn(parent) {
  if (Array.isArray(parent.body)) return parent.body
  return Array.isArray(parent.consequent) ? parent.consequent : []
}
