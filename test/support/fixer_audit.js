// Runs every fixable rule over the shapes its own tests declare, with a comment placed above each line and then
// trailing each line in turn, and reports the fixers that eat the comment, leave the source unparseable, or stand
// down: a rule that cannot carry a comment is the finding, and a marker that makes the offense itself go away is not.

import { readdir } from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import { Linter } from "eslint"
import { tester } from "#support/tester"

const TEST = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "..")
const RULES_DIR = path.join(TEST, "rules")
// The survival check looks for the text, not the whole line: `reflow-comments` legitimately merges a comment into the
// one above it, and what must never happen is the text going missing.
const MARKER_TEXT = "fixer-safety-marker"
const MARKER = `// ${MARKER_TEXT}`

export function ruleSuites() {
  return new SuiteCollector().collected
}

export function failuresIn(suites) {
  return suites.filter(isFixable).flatMap((suite) => new RuleAudit(suite).failures)
}

// Standing in for `tester.run` collects the real rule and cases instead of re-parsing the files. The stand-in stays,
// since this file is its own test process and those suites are the only thing in it that runs.
class SuiteCollector {
  #suites = []

  get collected() {
    tester.run = (name, rule, cases) => void this.#suites.push({ name, rule, cases })
    return this.#importAll()
  }

  async #importAll() {
    const files = await testFilesIn(RULES_DIR)
    for (const file of files) await import(url.pathToFileURL(file).href)

    return this.#suites
  }
}

async function testFilesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.filter(isDirectory).map((entry) => testFilesIn(joined(directory, entry))))
  return [ ...entries.filter(isTestFile).map((entry) => joined(directory, entry)), ...nested.flat() ]
}

function isDirectory(entry) {
  return entry.isDirectory()
}

function joined(directory, entry) {
  return path.join(directory, entry.name)
}

function isTestFile(entry) {
  return entry.isFile() && entry.name.endsWith(".test.js")
}

function isFixable(suite) {
  return Boolean(suite.rule.meta?.fixable)
}

class RuleAudit {
  #suite

  constructor(suite) {
    this.#suite = suite
  }

  get failures() {
    return this.#probes.flatMap((probe) => probe.failures)
  }

  // Valid cases are probe material too, since one the rule rewrites under an injected comment is the surprise to catch.
  get #probes() {
    return this.#cases.map((entry) => new Probe(this.#suite.name, this.#suite.rule, entry))
  }

  get #cases() {
    const { valid = [], invalid = [] } = this.#suite.cases
    return [ ...valid, ...invalid ].map(asCase).filter((entry) => typeof entry.code === "string")
  }
}

class Probe {
  #name
  #rule
  #case
  #linter = new Linter()

  constructor(name, rule, testCase) {
    this.#name = name
    this.#rule = rule
    this.#case = testCase
  }

  get failures() {
    return this.#isFixed ? this.#variants.map((variant) => this.#failureFor(variant)).filter(Boolean) : []
  }

  get #isFixed() {
    return this.#fixed(this.#code) !== this.#code
  }

  #fixed(code) {
    return this.#linter.verifyAndFix(code, this.#config, this.#options).output
  }

  get #config() {
    return {
      plugins: { local: { rules: { [this.#name]: this.#rule } } },
      languageOptions: { ecmaVersion: "latest", sourceType: "module" },
      linterOptions: { reportUnusedDisableDirectives: "off" },
      rules: { [`local/${this.#name}`]: this.#severity }
    }
  }

  get #severity() {
    return this.#case.options ? [ "error", ...this.#case.options ] : "error"
  }

  get #options() {
    return this.#case.filename ? { filename: this.#case.filename } : undefined
  }

  get #code() {
    return this.#case.code
  }

  // A marker above each line and one trailing it, so a fixer that moves code is seen dropping the comment on either
  // side. A marker that breaks the variant itself says nothing about the fixer.
  get #variants() {
    const lines = this.#code.split("\n")
    return lines.flatMap((line, index) => new Marking(lines, index).variants).filter((variant) => this.#parses(variant))
  }

  #parses(code) {
    return this.#linter.verify(code, this.#config, this.#options).every((message) => !message.fatal)
  }

  #failureFor(variant) {
    const output = this.#fixed(variant)
    return this.#survives(output) && this.#isOffered(variant, output) ? null : new Failure(this.#name, variant, output)
  }

  #survives(output) {
    return output.includes(MARKER_TEXT) && this.#parses(output)
  }

  #isOffered(variant, output) {
    return output !== variant || this.#linter.verify(variant, this.#config, this.#options).length === 0
  }
}

class Marking {
  #lines
  #index

  constructor(lines, index) {
    this.#lines = lines
    this.#index = index
  }

  get variants() {
    return [ this.#above, this.#trailing ]
  }

  get #above() {
    return this.#withLines([ `${this.#line.match(/^ */u)[0]}${MARKER}`, this.#line ])
  }

  #withLines(replacement) {
    return [ ...this.#lines.slice(0, this.#index), ...replacement, ...this.#lines.slice(this.#index + 1) ].join("\n")
  }

  get #line() {
    return this.#lines[this.#index]
  }

  get #trailing() {
    return this.#withLines([ `${this.#line} ${MARKER}` ])
  }
}

class Failure {
  #name
  #input
  #output

  constructor(name, input, output) {
    this.#name = name
    this.#input = input
    this.#output = output
  }

  toString() {
    return `${this.#name}\n--- given ---\n${this.#input}\n--- produced ---\n${this.#output}`
  }
}

function asCase(entry) {
  return typeof entry === "string" ? { code: entry } : entry
}
