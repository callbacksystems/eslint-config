// Runs every fixable rule over the shapes its own tests declare, with a comment
// inserted before each line in turn, and reports the ones whose fixer drops the
// comment or leaves the source unparseable. Each rule's suite proves the fix it
// means to make; this proves it takes nothing else with it.

import { readdir } from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import { Linter } from "eslint"
import { tester } from "#test/support"

const HERE = path.dirname(url.fileURLToPath(import.meta.url))
const RULES_DIR = path.join(HERE, "rules")
const MARKER = "// fixer-safety-marker"

export function ruleSuites() {
  return new SuiteCollector().collected
}

export function failuresIn(suites) {
  return suites.filter(isFixable).flatMap((suite) => new RuleAudit(suite).failures)
}

export function unaudited(suites) {
  return suites.filter(isFixable).filter((suite) => new RuleAudit(suite).probes.length === 0).map(nameOf)
}

// The suites register themselves through `tester.run`, so standing in for it
// collects the real rule and the real cases instead of re-parsing the files.
// The stand-in is not put back: this file is its own test process, and those
// suites are the only thing in it that calls `run`.
class SuiteCollector {
  #suites = []

  get collected() {
    tester.run = (name, rule, cases) => this.#suites.push({ name, rule, cases })
    return this.#importAll()
  }

  async #importAll() {
    for (const file of await testFilesIn(RULES_DIR)) await import(url.pathToFileURL(file).href)

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
    return this.probes.flatMap((probe) => probe.failures)
  }

  // Both lists are probe material: a valid case the rule happens to rewrite under
  // an injected comment is exactly the kind of surprise worth catching.
  get probes() {
    return this.#cases.map((entry) => new Probe(this.#suite.name, this.#suite.rule, entry))
  }

  get #cases() {
    const { valid = [], invalid = [] } = this.#suite.cases
    return [ ...valid, ...invalid ].map(asCase).filter((entry) => typeof entry.code === "string")
  }
}

// One source a rule claims to handle, checked against the comment it must not
// eat and the syntax it must not break.
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

  // A source the rule leaves alone has no fix to go wrong, so only the ones it
  // rewrites are worth the variants.
  get failures() {
    return this.#isFixed ? this.#variants.map((variant) => this.#failureFor(variant)).filter(Boolean) : []
  }

  #failureFor(variant) {
    const output = this.#fixed(variant)
    return this.#survives(output) ? null : new Failure(this.#name, variant, output)
  }

  #fixed(code) {
    return this.#linter.verifyAndFix(code, this.#config, this.#options).output
  }

  #survives(output) {
    return output.includes(MARKER) && this.#parses(output)
  }

  #parses(code) {
    return !this.#linter.verify(code, this.#config, this.#options).some((message) => message.fatal)
  }

  get #isFixed() {
    return this.#fixed(this.#code) !== this.#code
  }

  get #code() {
    return this.#case.code
  }

  // A comment line inserted mid-expression can leave the variant itself broken,
  // which says nothing about the fixer, so those are dropped before probing.
  get #variants() {
    const lines = this.#code.split("\n")
    return lines.map((line, index) => variantAt(lines, index, line)).filter((variant) => this.#parses(variant))
  }

  get #config() {
    return {
      plugins: { local: { rules: { [this.#name]: this.#rule } } },
      languageOptions: { ecmaVersion: "latest", sourceType: "module" },
      rules: { [`local/${this.#name}`]: this.#severity }
    }
  }

  get #severity() {
    return this.#case.options ? [ "error", ...this.#case.options ] : "error"
  }

  get #options() {
    return this.#case.filename ? { filename: this.#case.filename } : undefined
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

function variantAt(lines, index, line) {
  return [ ...lines.slice(0, index), `${line.match(/^ */u)[0]}${MARKER}`, ...lines.slice(index) ].join("\n")
}

function asCase(entry) {
  return typeof entry === "string" ? { code: entry } : entry
}

function nameOf(suite) {
  return suite.name
}
