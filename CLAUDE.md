# Callback ESLint Config

Guide for working in this repo. The plugin lints itself, so the source code must embody the rules it teaches.

## What this is

`@callbacksystems/eslint-config` is a shared ESLint configuration (flat config, ESLint 10) for Callback Systems stacks: Rails/Hotwire (Stimulus, Turbo, importmap), React, React Native, Svelte, Astro, Node, Cloudflare Workers.

Two things live here:
1. **Config composition**: per-stack presets the consumer combines.
2. **Custom rules**: an ESLint plugin whose rules encode the team's taste (declarative naming, OO, top-down ordering, anti-duplication).

## Commands

```bash
npm run lint                   # eslint src/ test/  (the plugin on itself)
npm test                       # node --test 'test/**/*.test.js'
npm run test:update-snapshots  # regenerate config snapshots
```

⚠️ **Do not run ESLint in parallel** (several processes at once). It is type-checked and saturates low-RAM machines. Run one serial pass.

The lint runs uncached on purpose. ESLint keys its cache on the plugin's `name@version`, which does not move when a rule is edited in place, so `--cache` here reports the previous run's result for every file you did not touch, which in this repo is most of them. A cold pass is a few seconds.

After any change, both `npm test` and `npm run lint` must be green. Both are non-negotiable.

## Layout

| Path | What's there |
|---|---|
| `src/base.js`, `node.js`, `react.js`, `stimulus.js`, … | Exported presets (subpaths). Each is an overlay: only what is unique to its stack. |
| `src/internal/` | Non-exported internals: per-plugin rule-to-severity maps, ignores, and shared preset fragments. |
| `src/rules/` | The custom rules. One per file, kebab-case filename equals the rule id. Registered in `src/rules/index.js`. |
| `src/rules/stimulus/`, `src/rules/browser/` | Namespaced rules (`stimulus/...`, `browser/...`). |
| `src/helpers/` | Utilities shared across rules. Look here before writing any AST predicate. |
| `src/restrictions.js` | Helpers for a project to enforce its own boundaries (imports, globals, syntax). |
| `test/rules/` | One test per rule (`RuleTester`). `test/configs/` validates presets via snapshots. `test/fixtures/` is exempt from the self-lint. |

Internal imports use the `package.json` map (`#helpers/...`, `#rules`, `#internal/*`, and `#base`/`#node` in the repo's own `eslint.config.js`). Never relative paths (`../`), a rule forbids it.

## Anatomy of a rule

There are two legitimate shapes. Choose by complexity, not by taste.

**a) Analysis class**, when there is memoizable state or logic. The class *delivers* the problem and reporting stays outside it (mirrors a RuboCop cop):

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

**b) Free function with inline `context.report`**, for trivial single-predicate checks. Don't wrap a one-line boolean in a class, that's ceremony.

Both shapes coexist on purpose. Do not "unify" one into the other, it was evaluated and rejected as churn.

### Rule config (inside the presets)
- Turn on bare-error rules with the `enableRules` helper, not inline objects.
- Read options always via `context.options[0]`.
- Destructure `sourceCode` from `context` only when used twice or more, otherwise use `context.sourceCode` directly.

## Shared helpers (anti-duplication)

Before writing an AST predicate or extractor, check `src/helpers/` and reuse what's there. Each module owns one vocabulary:

| Module | Holds |
|---|---|
| `ast` | Generic predicates and traversal (`walk`, `onTypes`, `unwrapExport`, …). Depends on nothing. |
| `functions` | Functions, returns, exits, guard clauses. |
| `classes` | Classes and members: `enclosingClass`, `memberName`, `isThisMember`. |
| `recursion` | The parameters a recursion moves, so the rules that would advise making them state can skip them. |
| `dom` | Custom elements: does this class extend a DOM element base. |
| `stimulus` | Controllers and their static config keys. |
| `source` | Source text in and out: comment trivia, and rendering a node for a fixer (`negated`, `operandText`). |
| `naming`, `member-subject`, `callee-resolver`, `reorder`, `report`, `config` | Naming predicates, the uniform wrapper over a method/getter/field/function, callee resolution, sibling reordering, the reporter bridge, `enableRules`. |

The dependency direction is one-way: `ast` at the bottom, `stimulus` on `classes`, nothing circular.

If two rules do the same thing, lift the common primitive into the shared AST helpers (the primitive only, not each rule's policy). If three or more arguments travel together, it is usually an internal class, not a loose object.

## Code style

- Aggressive OO: small internal classes, private `#x` fields, private getters memoized with `this.#cache ??= …`.
- **Top-down ordering**: define high-level methods and functions before the ones they use. Enforced (with autofix) by the step-down rules.
- One exported class per file. Internal (non-exported) classes are unlimited and encouraged.

### Naming, code reads like prose
- **Declarative, not imperative**, for things you *get*: name by the value, not the action. `computeTotal()` becomes `total`. A producer-verb method that only delivers a value gets flagged.
- **Preposition connectors** on getters that take an argument, so the call reads on its own: `childrenOf(node)`, `namesIn(scope)`, `prefixOf(glob)`. The connector depends on how it reads (`of`, `in`, `at`, `from`, `for`, `before`, `after`, `inside`, `by`). Don't force it on obvious one-argument functions or hot paths.
- **Boolean predicates**: an `is`/`has`/`can`/`should` prefix or a third-person verb (`includes`, `forwards`).
- **Named arguments** (a destructured object) when positional order is ambiguous at the call site, such as two arguments of the same type or a boolean flag: `reindent(text, { from, to })`, `fn(node, { withBreak: true })`. Not as a blanket policy.
- No `handle` or `on` prefixes for handlers, rules veto them.

### Comments are the exception, not the norm
Naming carries the meaning. A comment is justified only when it explains a non-obvious *why* or a rule's semantics (the header comments on rule files are intentional and stay). If a better name makes the comment unnecessary, that is the path. No comments that narrate the next line.

## The plugin lints itself

`eslint.config.js` applies the base and node presets over `src/` and `test/`. Consequences:
- The source code must pass the custom rules. If a refactor fights a rule, fix the code, do not weaken the rule.
- No bypass: no convenience `eslint-disable` in the repo's own config. If a rule gets in the way, it is a signal, not an obstacle.
- Verify empirically: run the lint and see what actually fires before assuming.

## Tests

- Each rule has `test/rules/<rule>.test.js` using `RuleTester` (`valid` and `invalid` cases, plus `output` for fixers).
- Presets are validated in `test/configs/` via snapshots. Use `npm run test:update-snapshots` to regenerate, then review the diff.
- `test/fixtures/**` exists to *violate* rules and is exempt from the self-lint.

## Quality bar

When touching code: zero duplication (reuse or lift helpers), naming that reads naturally, comments only where they earn their place, clean OO, and everything green (tests and self-lint). Don't commit unless asked.
