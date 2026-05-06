// A file that exports a class is named after it, the way Zeitwerk pairs `billing/invoice.rb` with `Billing::Invoice`.
// JavaScript has no namespaces, so the folder often ends up inside the name itself: the file name has to appear in the
// class name and the words around it are free, which takes both `Invoice` and `BillingInvoice`. A file called `index`
// is named after the folder it indexes. A platform suffix names which build takes the file rather than what the file
// is, so `native_action.ios.jsx` is read as `native_action`. Only classes are checked, since a function carries a verb
// the file name has no reason to repeat.

import path from "node:path"
import { exportedBindingsIn } from "#helpers/scope/exports"
import { reportProblem } from "#helpers/eslint/report"

const PLATFORM_SUFFIXES = new Set([ "android", "ios", "native", "web" ])

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Require a file that exports a class to be named after it" },
    schema: [],
    messages: {
      classFileMismatch: "`{{name}}` does not match the file name `{{file}}`. Name the file after the class it exports."
    }
  },
  create(context) {
    return { "Program:exit": () => reportProblem(context, new ExportedClass(context.sourceCode, context.filename)) }
  }
}

class ExportedClass {
  #sourceCode
  #filename
  #cache

  constructor(sourceCode, filename) {
    this.#sourceCode = sourceCode
    this.#filename = filename
  }

  get problem() {
    if (this.#isCheckable) {
      return this.#isNamedAfterFile ? null : this.#mismatch
    } else {
      return null
    }
  }

  get #isCheckable() {
    return !isVirtualFilename(this.#filename) && Boolean(this.#className) && wordsIn(this.#basename).length > 0
  }

  get #className() {
    return this.#exportedClass.localName ?? this.#exportedClass.name
  }

  get #exportedClass() {
    return this.#cache ??= exportedBindingsIn(this.#sourceCode).find((binding) => binding.kind === "class") ?? {}
  }

  get #basename() {
    const name = withoutPlatform(path.basename(this.#filename, path.extname(this.#filename)))
    return name === "index" ? path.basename(path.dirname(this.#filename)) : name
  }

  get #isNamedAfterFile() {
    return containsSequence(wordsIn(this.#className), wordsIn(this.#basename))
  }

  get #mismatch() {
    return {
      node: this.#exportedClass.node,
      messageId: "classFileMismatch",
      data: { name: this.#className, file: this.#basename }
    }
  }
}

function isVirtualFilename(filename) {
  return filename.startsWith("<") && filename.endsWith(">")
}

function wordsIn(name) {
  return name
    .replaceAll(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean)
}

function withoutPlatform(name) {
  const suffix = path.extname(name)
  return PLATFORM_SUFFIXES.has(suffix.slice(1)) ? path.basename(name, suffix) : name
}

function containsSequence(words, sequence) {
  return words.some((word, index) => sequence.every((expected, offset) => words[index + offset] === expected))
}
