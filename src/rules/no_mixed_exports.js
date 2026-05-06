// A file exports one kind of thing: a single class, or any number of functions, constants or re-exports as long as they
// are all the same. A class is never one of several, since a constant sitting next to it is either a static field of
// that class or a module of its own, and a second class is a file of its own. Internal (non-exported) classes and
// helpers are unlimited: this only counts what a file presents to its consumers.

import { exportedBindingsIn } from "#helpers/scope/exports"
import { reportProblems } from "#helpers/eslint/report"

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Require a file's exports to be one kind of thing, with an exported class standing alone" },
    schema: [],
    messages: {
      soloClass: "A file that exports a class exports nothing else. Move `{{name}}` to its own file.",
      mixedKinds: "A file exports one kind of thing. `{{name}}` is a {{kind}} among {{expected}} exports."
    }
  },
  create(context) {
    return { "Program:exit": () => reportProblems(context, new ModuleSurface(context.sourceCode)) }
  }
}

class ModuleSurface {
  #sourceCode
  #cachedBindings
  #cachedClasses
  #cachedCountByKind
  #cachedDominantKind
  #cachedKindsByFrequency

  constructor(sourceCode) {
    this.#sourceCode = sourceCode
  }

  get problems() {
    return this.#extras.map((binding) => this.#problemFor(binding))
  }

  get #extras() {
    if (this.#bindings.length < 2) return []

    return this.#exportedClass
      ? this.#bindings.filter((binding) => binding !== this.#exportedClass)
      : this.#bindings.filter((binding) => binding.kind !== this.#dominantKind)
  }

  get #bindings() {
    return this.#cachedBindings ??= new ExportedEntities(exportedBindingsIn(this.#sourceCode)).bindings
  }

  get #exportedClass() {
    return this.#exportedClasses[0]
  }

  get #exportedClasses() {
    return this.#cachedClasses ??= this.#bindings.filter((binding) => binding.kind === "class")
  }

  // A stable sort, so the first kind declared wins a tie.
  get #dominantKind() {
    return this.#cachedDominantKind ??= this.#kindsByFrequency[0]
  }

  get #kindsByFrequency() {
    return this.#cachedKindsByFrequency ??= [ ...this.#countByKind ].sort(byHigherCount).map(([ kind ]) => kind)
  }

  get #countByKind() {
    return this.#cachedCountByKind ??= this.#bindings.reduce(countKind, new Map())
  }

  #problemFor(binding) {
    return {
      node: binding.node,
      messageId: this.#exportedClass ? "soloClass" : "mixedKinds",
      data: { name: binding.name ?? "default", kind: binding.kind, expected: this.#dominantKind }
    }
  }
}

class ExportedEntities {
  #bindings

  constructor(bindings) {
    this.#bindings = bindings
  }

  get bindings() {
    const variables = new Set()
    return this.#bindings.filter((binding) => !binding.variable || isAddedOnce(variables, binding.variable))
  }
}

function isAddedOnce(values, value) {
  if (values.has(value)) return false

  values.add(value)
  return true
}

function byHigherCount([ , count ], [ , otherCount ]) {
  return otherCount - count
}

function countKind(counts, binding) {
  return counts.set(binding.kind, (counts.get(binding.kind) ?? 0) + 1)
}
