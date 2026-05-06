# Callback ESLint Config

Guide for working in this repo. The plugin lints itself, so the source code must embody the rules it teaches.

## What this is

`@callbacksystems/eslint-config` is a shared ESLint configuration (flat config, ESLint 10) for Callback Systems stacks: Rails/Hotwire (Stimulus, Turbo, importmap), React, React Native, Svelte, Astro, Node, Cloudflare Workers.

It does two things: it composes per-stack presets the consumer combines, and it ships a plugin whose rules encode the team's taste.

## Commands

```bash
npm run lint                   # the plugin on itself, config included
npm test                       # node --test 'test/**/*.test.js'
npm run test:update-snapshots  # regenerate config snapshots
npm run docs                   # regenerate the rule reference
```

Never run ESLint in parallel, several processes at once. It is type-checked and saturates low-RAM machines, so run one serial pass.

After any change, both `npm test` and `npm run lint` must be green. Both are non-negotiable.

## Layout

`src/` has one file per exported subpath, plus three directories: the internals those presets share, the custom rules, and the helpers the rules reuse. A rule is one file whose kebab-case name is the rule id, registered in the rules index, and a namespaced rule lives in a directory named after its namespace.

`test/` mirrors that: one test file per rule driven by `RuleTester`, preset tests driven by snapshots, shared test helpers under `support/`, and fixtures that exist to violate rules and are exempt from the self-lint.

`scripts/` holds generators you run by hand rather than from the test suite.

Internal imports go through the `package.json` map, never relative paths, and a rule enforces it.

## Anatomy of a rule

Two shapes are legitimate. Choose by complexity, not by taste.

An analysis class, when there is memoizable state or logic. The class delivers the problem and reporting stays outside it, mirroring a RuboCop cop:

```js
import { reportProblem } from "#helpers/report"   // or reportProblems (plural)

export default {
  meta: { type: "suggestion", docs: { description: "…" }, schema: [], messages: { … } },
  create(context) {
    return { MethodDefinition: (node) => reportProblem(context, new Thing(node)) }
  }
}

class Thing {
  #node

  constructor(node) {
    this.#node = node
  }

  get problem() {                                  // descriptor or null
    return this.#isOffense ? { node: …, messageId: "…", data: … } : null
  }

  get #isOffense() {                               // small private getters
    return …
  }
}
```

A free function with inline `context.report`, for trivial single-predicate checks. Don't wrap a one-line boolean in a class, that's ceremony.

Both shapes coexist on purpose. Do not "unify" one into the other, it was evaluated and rejected as churn.

### Rule config (inside the presets)

- Turn on bare-error rules with the `enableRules` helper, not inline objects.
- Read options always via `context.options[0]`.
- Destructure `sourceCode` from `context` only when used twice or more, otherwise use `context.sourceCode` directly.

## Shared helpers (anti-duplication)

Before writing an AST predicate or extractor, check `src/helpers/` and reuse what's there.

If two rules do the same thing, lift the common primitive into the shared helpers (the primitive only, not each rule's policy). If three or more arguments travel together, it is usually an internal class, not a loose object.

## Code style

- Aggressive OO: small internal classes, private `#x` fields, private getters memoized with `this.#cache ??= …`.
- Top-down ordering: define high-level methods and functions before the ones they use. Enforced (with autofix) by the step-down rules.
- One exported class per file. Internal (non-exported) classes are unlimited and encouraged.

### Naming, code reads like prose

- Declarative, not imperative, for things you get: name by the value, not the action. `computeTotal()` becomes `total`. A producer-verb method that only delivers a value gets flagged.
- Preposition connectors on getters that take an argument, so the call reads on its own: `childrenOf(node)`, `namesIn(scope)`, `prefixOf(glob)`. The connector depends on how it reads (`of`, `in`, `at`, `from`, `for`, `before`, `after`, `inside`, `by`). Don't force it on obvious one-argument functions or hot paths.
- Boolean predicates take an `is`/`has`/`can`/`should` prefix or a third-person verb (`includes`, `forwards`).
- Named arguments (a destructured object) when positional order is ambiguous at the call site, such as two arguments of the same type or a boolean flag: `reindent(text, { from, to })`, `fn(node, { withBreak: true })`. Not as a blanket policy.
- No `handle` or `on` prefixes for handlers, rules veto them.

### Comments are the exception, not the norm

Naming carries the meaning. A comment is justified only when it explains a non-obvious why or a rule's semantics (the header comments on rule files are intentional and stay). If a better name makes the comment unnecessary, that is the path. No comments that narrate the next line.

## The plugin lints itself

`eslint.config.js` applies the base and node presets over the repo's own code. Consequences:

- The source code must pass the custom rules. If a refactor fights a rule, fix the code, do not weaken the rule.
- No bypass: no convenience `eslint-disable` in the repo's own config. If a rule gets in the way, it is a signal, not an obstacle.
- Verify empirically: run the lint and see what actually fires before assuming.

## Tests

- Each rule has its own test file using `RuleTester`, with `valid` and `invalid` cases, plus `output` for fixers.
- Presets are validated through snapshots. Regenerate them with `npm run test:update-snapshots`, then review the diff.
- Fixtures exist to violate rules, so they are exempt from the self-lint.

## Quality bar

When touching code: zero duplication (reuse or lift helpers), naming that reads naturally, comments only where they earn their place, clean OO, and everything green (tests and self-lint). Don't commit unless asked.
