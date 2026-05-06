const UNKNOWN_SWITCH_VALUE = Symbol("unknown switch value")

export class SwitchSelection {
  static #byStatement = new WeakMap()

  evaluatedTests = []

  #discriminant
  #entryCases = new Set()
  #hasCertainEntry = false
  #hasDefaultEntry = false
  #statement

  static for(statement) {
    if (!this.#byStatement.has(statement)) this.#byStatement.set(statement, new SwitchSelection(statement))
    return this.#byStatement.get(statement)
  }

  constructor(statement) {
    this.#statement = statement
    this.#discriminant = new StaticSwitchValue(statement.discriminant)
    this.#selectEntries()
  }

  get canSkipBody() {
    return !this.#hasCertainEntry && !this.#hasDefaultEntry
  }

  canEnter(switchCase) {
    return this.#entryCases.has(switchCase)
  }

  forEachCaseReversed(inspect) {
    this.#statement.cases.toReversed().forEach(inspect)
  }

  #selectEntries() {
    let index = 0
    while (!this.#hasCertainEntry && index < this.#statement.cases.length) {
      const switchCase = this.#statement.cases[index]
      if (switchCase.test) this.#addTestedCase(switchCase)
      index += 1
    }

    if (!this.#hasCertainEntry) this.#addDefaultEntry()
  }

  #addTestedCase(switchCase) {
    this.evaluatedTests.push(switchCase.test)
    const match = new SwitchMatch(this.#discriminant, new StaticSwitchValue(switchCase.test))
    if (match.isPossible) this.#entryCases.add(switchCase)
    this.#hasCertainEntry = match.isCertain
  }

  #addDefaultEntry() {
    const switchCase = this.#statement.cases.find((candidate) => !candidate.test)
    this.#hasDefaultEntry = Boolean(switchCase)
    if (switchCase) this.#entryCases.add(switchCase)
  }
}

class StaticSwitchValue {
  constructor(node) {
    this.value = staticSwitchValueOf(node)
  }

  get isKnown() {
    return this.value !== UNKNOWN_SWITCH_VALUE
  }
}

function staticSwitchValueOf(node) {
  if (node.type === "Literal" && !node.regex) return node.value
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked
  return UNKNOWN_SWITCH_VALUE
}

class SwitchMatch {
  #caseValue
  #discriminant

  constructor(discriminant, caseValue) {
    this.#discriminant = discriminant
    this.#caseValue = caseValue
  }

  get isPossible() {
    return !this.#isKnown || this.#isEqual
  }

  get isCertain() {
    return this.#isKnown && this.#isEqual
  }

  get #isKnown() {
    return this.#discriminant.isKnown && this.#caseValue.isKnown
  }

  get #isEqual() {
    return this.#discriminant.value === this.#caseValue.value
  }
}
