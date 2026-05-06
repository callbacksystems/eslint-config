// A file may export at most one class: the single public type it represents.
// Internal helper classes (not exported) are unlimited: small collaborator
// classes are encouraged, so this replaces the blunt one-class-per-file limit
// with one that only counts what a file presents to its consumers.

import { reportProblems } from "#helpers/report"

const CLASS_TYPES = new Set([ "ClassDeclaration", "ClassExpression" ])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Allow at most one exported class per file; internal classes are unlimited" },
    schema: [],
    messages: { extraExportedClass: "A file may export at most one class. `{{name}}` is an extra exported class." }
  },
  create(context) {
    return { "Program:exit": (node) => reportProblems(context, new ExportedClasses(node)) }
  }
}

class ExportedClasses {
  #program

  constructor(program) {
    this.#program = program
  }

  get problems() {
    return this.#extras.map((classNode) =>
      ({ node: classNode, messageId: "extraExportedClass", data: { name: classNameOf(classNode) } }))
  }

  #classesExportedBy(statement) {
    return this.#defaultClassOf(statement) ?? this.#namedClassesOf(statement) ?? []
  }

  #defaultClassOf(statement) {
    return statement.type === "ExportDefaultDeclaration" ? asClass(statement.declaration) : null
  }

  #namedClassesOf(statement) {
    return statement.type === "ExportNamedDeclaration" ? this.#namedExportsOf(statement) : null
  }

  #namedExportsOf(statement) {
    return statement.declaration
      ? asClass(statement.declaration)
      : statement.specifiers.flatMap((specifier) => this.#localClassesNamed(specifier.local.name))
  }

  #localClassesNamed(name) {
    return this.#declaredClasses.filter((declaration) => declaration.id?.name === name)
  }

  get #extras() {
    return this.#exported.slice(1)
  }

  get #exported() {
    return this.#program.body.flatMap((statement) => this.#classesExportedBy(statement))
  }

  get #declaredClasses() {
    return this.#program.body.flatMap(asClass)
  }
}

function classNameOf(node) {
  return node.id?.name ?? "default"
}

function asClass(node) {
  return CLASS_TYPES.has(node?.type) ? [ node ] : []
}
