import rule from "#rules/boolean_naming"
import { dedent, tester } from "#support"

tester.run("boolean-naming", rule, {
  valid: [
    // A bare return next to `return true` marks a command, not a predicate.
    dedent`
      class C {
        commit(event) {
          event?.preventDefault()
          if (!this.combobox.commit()) return

          this.dispatch("commit", {})
          return true
        }
      }
    `,
    "class C { get isValid() { return this.x === 1 } }",
    "function isReady() { return state === \"ready\" }",
    "function crossesCurrentStreet() { return currentStreet === nextStreet }",
    "function transmogrifiesInput() { return input !== output }",
    "function includesItem() { return items.includes(item) }",
    "function forwardsMessage() { return target !== null }",
    "class C { forwardsAll() { return this.items.every(Boolean) } }",
    "class C { has(key) { return this.set.has(key) } }",
    "class C { get name() { return this.value } }",
    "class C { count() { return this.items.length } }",
    "class C { isValid = () => this.x === 1 }",
    "class FooElement extends HTMLElement { get disabled() { return this.hasAttribute(\"disabled\") } }",
    "class FooElement extends HTMLElement { get expanded() { return this.getAttribute(\"x\") === \"y\" } }",
    "class FooElement extends HTMLElement { get disabled() {"
    + " (() => this.hasAttribute(\"disabled\"))(); return true } }",
    "class FooElement extends HTMLElement { get disabled() {"
    + " consume(() => this.hasAttribute(\"disabled\")); return true } }",
    "class FooElement extends HTMLElement { get disabled() {"
    + " class Inner extends (this.hasAttribute(\"disabled\"), Object) {}; return true } }",
    "class FooElement extends HTMLElement { get disabled() {"
    + " class Inner { [this.getAttribute(\"disabled\")]() {} }; return true } }",
    "class FooElement extends HTMLElement { get disabled() { return this[`hasAttribute`](\"disabled\") } }",
    "class FooElement extends BaseElement { get open() { return this.hasAttribute(\"open\") } }",
    "class C { get total() { return this.sum() } sum() { return this.a + this.b } }",
    "class C { get label() { return this.title || this.name } }",
    "class C { get label() { return this.x ? true : this.name } }",
    "class C { get status() { return this.isReady && this.value } }",
    "class C { get ready() { return this.loaded && this.isVisible } }",
    "function ready() { return service.test() }",
    "const predicates = { matches() { return true } }; consume(predicates); "
    + "function ready() { return predicates.matches() }",
    "function ready() { return collection.includes(value) }",
    "function ready(pattern) { return pattern.test(value) }",
    "function ready(text) { return text.startsWith(prefix) }",
    "function ready(items) { return items.some(predicate) }",
    "let text = 'value'; function ready() { return text.includes(value) }; text = value",
    "const pattern = /x/; consume(pattern); function ready() { return pattern.test(value) }",
    "const pattern = /x/; pattern.test = value; function ready() { return pattern.test(value) }",
    "let pattern = /x/; function ready() { return pattern.test(value) }; pattern = value",
    "function ready() { return pattern.test(value); var pattern = /x/ }",
    "function ready(condition) { if (condition) var pattern = /x/; return pattern.test(value) }",
    "function ready() { return values.some(predicate); var values = [] }",
    "export const pattern = /x/; function ready() { return pattern.test(value) }",
    {
      name: "does not assume ownership of a script-global RegExp",
      code: "const pattern = /x/; function ready() { return pattern.test(value) }",
      languageOptions: { sourceType: "script" }
    },
    "const values = []; consume(values); function ready() { return values.some(predicate) }",
    "const values = []; values.some = value; function ready() { return values.some(predicate) }",
    "function ready() { const values = []; consume(values); return values.some(predicate) }",
    "function ready() { const values = []; const alias = values; consume(alias); return values.some(predicate) }",
    "function ready() { const values = []; eval(code); return values.some(predicate) }",
    "function ready() { const values = []; while (condition) consume(values); return values.some(predicate) }",
    "function ready() { const values = []; const leak = () => consume(values); leak(); "
    + "return values.some(predicate) }",
    "function ready() { const pattern = /x/; consume(pattern); return RegExp(pattern).test(input) }",
    "function ready() { const pattern = /x/; const alias = pattern; "
    + "while (condition) alias.test = custom; return RegExp(pattern).test(input) }",
    "function ready() { const pattern = /x/; const leak = () => consume(pattern); leak(); "
    + "return RegExp(pattern).test(input) }",
    "const values = []; values.map = () => ({ some: () => 1 }); "
    + "function ready() { return values.map(transform).some(predicate) }",
    "const values = []; Object.assign(values, { map: () => ({ some: () => 1 }) }); "
    + "function ready() { return values.map(transform).some(predicate) }",
    "function ready() { const values = []; consume(values); "
    + "return values.map(transform).some(predicate) }",
    "function ready() { const values = []; const alias = values; consume(alias); "
    + "return values.map(transform).some(predicate) }",
    "function ready() { const values = []; "
    + "return values.map((consume(values), transform)).some(predicate) }",
    "function ready() { const values = []; "
    + "return values.map((values.constructor = custom, transform)).some(predicate) }",
    "const separator = { [Symbol.split]() { return { some: () => 1 } } }; "
    + "function ready() { return 'x'.split(separator).some(predicate) }",
    "RegExp.prototype[Symbol.split] = custom; "
    + "function ready() { return 'x'.split(/x/).some(predicate) }",
    "String.prototype[Symbol.split] = custom; "
    + "function ready() { return 'x'.split('x').some(predicate) }",
    "const values = []; values.constructor = { [Symbol.species]: class { "
    + "constructor() { return { some: () => 1 } } } }; "
    + "function ready() { return values.map(transform).some(predicate) }",
    "Object.defineProperty(Array, Symbol.species, { value: class { "
    + "constructor() { return { some: () => 1 } } } }); "
    + "function ready() { return [].map(transform).some(predicate) }",
    "function ready(Set) { return new Set().has(value) }",
    "const Set = class { has() { return value } }; function ready() { return new Set().has(value) }",
    "Set = CustomSet; function ready() { return new Set().has(value) }",
    "function ready(RegExp) { return RegExp('x').test(value) }",
    "function ready(value) { return RegExp(value).test(input) }",
    "function ready(value) { return RegExp(value, undefined).test(input) }",
    "const pattern = /x/; pattern.test = () => 1; function ready() { return RegExp(pattern).test(input) }",
    "const pattern = /x/; consume(pattern); function ready() { return RegExp(pattern).test(input) }",
    "function ready(String) { return new String(value).includes(part) }",
    "function ready(Array) { return Array.of(value).some(predicate) }",
    "function ready(Object) { return Object.keys(value).includes(key) }",
    "const pattern = new RegExp('x'); consume(pattern); function ready() { return pattern.test(value) }",
    "const items = Array.of(value); items.some = custom; function ready() { return items.some(predicate) }",
    "const method = 'test'; function ready(method) { return /x/[method](value) }",
    "const method = 'test'; function ready() { return ({ test: () => value })[method]() }",
    "function ready() { return /x/.includes(value) }",
    "function ready() { return /x/?.test }",
    "function ready(pattern) { return pattern?.test(value) }",
    "RegExp.prototype.test = custom; function ready() { return /x/.test(value) }",
    "Array.prototype.some = custom; function ready() { return [ value ].some(predicate) }",
    "function result() { const values = [ 1 ]; values.some((_value, _index, self) => { "
    + "self.includes = () => 'not boolean'; return false }); return values.includes(1) }",
    "function result() { const values = new Uint8Array(1); values.every((_value, _index, self) => { "
    + "self.includes = () => 'not boolean'; return true }); return values.includes(1) }",
    "Array.prototype.some = function() { this.includes = () => 'not boolean'; return false }; "
    + "function result() { const values = []; values.some(predicate); return values.includes(1) }",
    "RegExp.prototype.exec = function() { this.test = () => 'not boolean'; return null }; "
    + "function result() { const pattern = /x/; pattern.test(''); return pattern.test('') }",
    "RegExp.prototype.exec = function() { this.test = () => 1; return null }; "
    + "function ready() { const pattern = /x/; pattern.test(''); return RegExp(pattern).test('') }",
    "String.prototype.includes = custom; function ready() { return 'value'.includes(part) }",
    "Set.prototype.has = custom; function ready() { return new Set().has(value) }",
    "Uint8Array.prototype.some = custom; function ready() { return new Uint8Array().some(predicate) }",
    "Object.getPrototypeOf(Uint8Array.prototype).some = custom; "
    + "function ready() { return new Uint8Array().some(predicate) }",
    "Reflect.getPrototypeOf(Uint8Array).from = custom; "
    + "function ready() { return Uint8Array.from(values).some(predicate) }",
    "Headers.prototype.has = custom; function ready() { return new Headers().has(name) }",
    "URLPattern.prototype.test = custom; function ready() { return new URLPattern(value).test(input) }",
    "Reflect.has = custom; function ready() { return Reflect.has(object, key) }",
    "function ready() { return `value$" + "{suffix}`.includes(part) }",
    "function ready(value) { return RegExp(value, 'g').test(input) }",
    "function ready() { return new String(value).includes(part) }",
    "function ready() { return String(value).startsWith(prefix) }",
    "function ready() { return Array.from(values).includes(value) }",
    "function ready() { return Object.keys(value).includes(key) }",
    "function ready() { return new URLSearchParams(value).has(name) }",
    "function ready() { return new FormData(form).has(name) }",
    "function ready() { return new Uint8Array(values).some(predicate) }",
    "function ready() { return Float64Array.from(values).includes(value) }",
    "const values = new Int16Array(size); function ready() { return values.every(predicate) }",
    "function ready() { return new URLPattern(pattern).test(input) }",
    "function ready() { const values = []; use(values.length); "
    + "return values.map(transform).some(predicate) }",
    "function ready() { const values = []; const result = values.map(transform); "
    + "consume(values); return result.some(predicate) }",
    "function ready() { const values = []; "
    + "return values.toReversed((consume(values), option)).some(predicate) }",
    "const x = { toString() { String.prototype.includes = () => 1; return 'x' } }; "
    + "function ready() { return String(x).includes('x') }",
    "const it = { *[Symbol.iterator]() { Set.prototype.has = () => 1; yield 1 } }; "
    + "function ready() { return new Set(it).has(1) }",
    "function ready() { return [ 1 ].map(() => { Array.prototype.some = () => 1; return 1 }).some(Boolean) }",
    "function ready() { return new WeakSet('x').has(value) }",
    "function ready() { return new WeakSet([ 1 ]).has(value) }",
    "function ready() { return new WeakMap([ [ 1, 2 ] ]).has(value) }",
    "function ready() { return new Uint8Array(1n).some(Boolean) }",
    "function ready() { return Uint8Array.of(1n).some(Boolean) }",
    "function ready() { return Uint8Array.from([ 1n ]).some(Boolean) }",
    "function ready() { return new BigInt64Array(1n).some(Boolean) }",
    "function ready() { return new BigInt64Array([ 1 ]).some(Boolean) }",
    "function ready() { return BigInt64Array.of(1).some(Boolean) }",
    "function ready() { return BigInt64Array.of(undefined).some(Boolean) }",
    "function ready() { return BigUint64Array.from([ null ]).some(Boolean) }",
    "function ready() { return BigInt64Array.of(value).some(Boolean) }",
    "function ready(undefined) { return Array.from([ 1 ], undefined).some(Boolean) }",
    "function ready(undefined) { return Uint8Array.from([ 1 ], undefined).some(Boolean) }",
    "const pattern = /x/; Object.defineProperty(pattern, Symbol.match, { get() { "
    + "RegExp.prototype.test = () => 1; return true } }); "
    + "function ready() { return new RegExp(pattern).test('x') }",
    "function ready() { return Object.values({ get key() { "
    + "Array.prototype.includes = () => 1; return 1 } }).includes(1) }",
    "function ready() { return new Headers({ get key() { "
    + "Headers.prototype.has = () => 1; return 'value' } }).has('key') }",
    "const value = { toString() { URLSearchParams.prototype.has = () => 1; return 'value' } }; "
    + "function ready() { return new URLSearchParams([ [ 'key', value ] ]).has('key') }",
    "function ready(Boolean) { return Boolean(value) }",
    "Boolean = String; function status() { return Boolean(value) }",
    "function* status() { return true }",
    "function status(ready) { if (ready) return true }",
    "class C { value() { if (false) return true; throw new Error() } }",
    "class C { value() { while (false) return true; throw new Error() } }",
    "class C { value() { switch (1) { case 1: throw Error(); default: return true } } }",
    "function status() { throw Error(); return true }",
    "async function isReady() { return true } function result() { return isReady() }",
    // A recursive call alone is not evidence that the function returns booleans.
    "function ready() { return ready() }",
    "function ready() { return result; const result = true }",
    "function ready(condition) { if (condition) var result = true; return result }",
    "function ready() { let result = true; result = value; return result }",
    "function ready(condition) { let result = true; if (condition) result = value; return result }",
    "function ready() { const result = result; return result }",
    "function ready() { const first = second; const second = first; return first }",
    "function first() { const result = second(); return result } "
    + "function second() { const result = first(); return result }",
    // These are also valid third-person verb forms. Spelling alone cannot prove that the author intended plural nouns.
    "function bindings() { return true } function settings() { return true } "
    + "function prices() { return true } function items() { return true }",
    // A predicate-shaped local name does not overrule a body whose value is known not to be boolean.
    "function isReady() { return 1 } function status() { return isReady() }",
    "class C { isReady() { return 1 } status() { return this.isReady() } }",
    // A reference to a predicate function is still a function value; only calling it produces a boolean.
    "function isReady() { return true } function result() { return isReady }",
    "class C { isReady() { return true } result() { return this.isReady } }",
    // A cycle cannot make a non-boolean return in another member of the cycle disappear.
    dedent`
      function first(value) {
        if (value) return second(value)
        return 1
      }
      function second(value) { return value ? true : first(value) }
    `,
    // A curried call has no name to read, so what it returns is unknown.
    "function ready() { return compose(a)(b) }",
    dedent`
      function size() { return list.length }
      class C { get count() { return size() } }
    `,
    // An anonymous default export has no name to index, and resolving past it must not crash.
    dedent`
      export default function () { return 1 }
      function size() { return list.length }
      function count() { return size() }
    `,
    { name: "indexes 300 nested reflected getters once", code: nestedReflectedGetters(300) },
    { name: "indexes 400 nested reflected getters once", code: nestedReflectedGetters(400) },
    { name: "does not rescan a shared escaping literal", code: sharedRegexAliases(1_000) }
  ],
  invalid: [
    {
      code: "class C { value() { switch (1) { case 1: return true; case 2: break } } }",
      errors: [ { messageId: "booleanName", data: { name: "value", pascal: "Value" } } ]
    },
    {
      name: "follows a stable local boolean result",
      code: "function status() { const result = true; return result }",
      errors: [ { messageId: "booleanName", data: { name: "status", pascal: "Status" } } ]
    },
    {
      name: "preserves predicate-name evidence when a stable local value remains unknown",
      code: "function status() { const isResult = value; return isResult }",
      errors: [ { messageId: "booleanName", data: { name: "status", pascal: "Status" } } ]
    },
    {
      name: "follows the exact value of a prior local reassignment",
      code: "function status() { let result = value; result = false; return result }",
      errors: [ { messageId: "booleanName", data: { name: "status", pascal: "Status" } } ]
    },
    {
      name: "preserves await while following a stable local result",
      code: "async function status() { const result = await isReady(); return result } "
        + "async function isReady() { return true }",
      errors: [ { messageId: "booleanName", data: { name: "status", pascal: "Status" } } ]
    },
    {
      name: "ignores an unreachable reassignment after a returned local",
      code: "function status() { let result = true; return result; result = value }",
      errors: [ { messageId: "booleanName", data: { name: "status", pascal: "Status" } } ]
    },
    {
      name: "follows a native boolean captured before a receiver write",
      code: "function ready() { const values = []; const result = values.some(predicate); "
        + "values.some = custom; return result }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "follows stable aliases of a captured native boolean",
      code: "function ready() { const values = []; const result = values.some(predicate); "
        + "const alias = result; consume(values); return alias }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "keeps an array receiver confined through a non-callback native call",
      code: "function ready() { const values = []; values.includes(first); return values.some(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "keeps a RegExp receiver confined while its native exec remains intact",
      code: "function ready() { const pattern = /x/; pattern.test(first); return pattern.test(second) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "tracks dependencies through stable local results regardless of declaration order",
      code: "function ready() { const result = isReady(); return result } function isReady() { return true }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const text = 'value'; function ready() { return text.includes(input) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "follows a confined local object predicate",
      code: "const predicates = { matches() { return true } }; "
        + "function ready() { return predicates.matches() }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const text = `value`; const alias = text; function ready() { return alias.startsWith(input) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const suffix = ''; function ready() { return `value$" + "{suffix}`.includes(part) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "keeps Array literal intrinsics after the global constructor is replaced",
      code: "globalThis.Array = Fake; function ready() { return [].some(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "keeps string literal intrinsics after the global constructor is replaced",
      code: "globalThis.String = Fake; function ready() { return 'value'.includes(part) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "keeps RegExp literal intrinsics after the global constructor is replaced",
      code: "globalThis.RegExp = Fake; function ready() { return /x/.test(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const values = []; use(values.length); function ready() { return values.some(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "keeps a bound array producer after safe receiver reads",
      code: "function ready() { return [ 1 ].map((value) => value).some(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "keeps a produced array after its source escapes",
      code: "function ready() { const result = [ 1 ].map((value) => value); return result.some(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "recognizes native split results for fresh RegExp separators",
      code: "function ready() { return 'x'.split(/x/).some(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "recognizes native split results for fresh RegExp constructions",
      code: "function ready() { return 'x'.split(new RegExp('x')).some(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "keeps a non-species producer when its receiver escapes after lookup",
      code: "function ready() { return [ 1 ].toReversed().some(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const pattern = /x/; function ready() { return pattern.test(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const pattern = /x/; const alias = pattern; function ready() { return alias.test(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "allows every confined read instead of imposing a reference-count cutoff",
      code: "const pattern = /x/; function ready() { return pattern.test(first) }; "
        + "function done() { return pattern.test(second) }",
      errors: [
        { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } },
        { messageId: "booleanName", data: { name: "done", pascal: "Done" } }
      ]
    },
    {
      name: "ignores native receiver escapes after the boolean lookup",
      code: "function ready() { const values = []; return values.some((consume(values), predicate)) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "ignores native receiver writes and unsupported reads after the boolean lookup",
      code: "function ready() { const values = []; "
        + "return values.some((values.some = custom, use(values.some), predicate)) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "ignores unreachable native receiver escapes",
      code: "function ready() { const values = []; if (false) consume(values); return values.some(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "applies native receiver timing through aliases",
      code: "function ready() { const values = []; const alias = values; "
        + "return alias.some((consume(values), predicate)) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "ignores RegExp pattern escapes and writes after conversion",
      code: "function ready() { const pattern = /x/; const alias = pattern; "
        + "return RegExp(alias).test((consume(pattern), alias.test = custom, input)) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "ignores unreachable RegExp pattern escapes",
      code: "function ready() { const pattern = /x/; if (false) consume(pattern); "
        + "return RegExp(pattern).test(input) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "ignores direct eval after the native lookup",
      code: "function ready() { const values = []; return values.some((eval(code), predicate)) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      name: "indexes many safe lookups and later escapes once",
      code: nativeCallsBeforeEscape(1_000),
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const values = [ value ]; function ready() { return values.some(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const values = [ value ]; const alias = values; function ready() { return alias.includes(input) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new Set().has(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const values = new Set(); function ready() { return values.has(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new Map()[`has`](value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const Native = WeakSet; function ready() { return new Native().has(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const method = 'has'; function ready() { return new WeakMap()[method](value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return /value/.test(input) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return /value/[`test`](input) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const method = 'test'; function ready() { return /value/[method](input) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return 'value'.includes(input) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return `value`.startsWith(input) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return 'value'[\"endsWith\"](input) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return [ value ].includes(input) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return [ value ].every(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const method = 'some'; function ready() { return [ value ][method](predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new RegExp('x').test(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return RegExp('x').test(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return RegExp().test(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const pattern = /x/; function ready() { return RegExp(pattern).test(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const pattern = 'x'; function ready() { return RegExp(pattern).test(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return RegExp('value', 'g').test(input) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new String('value').includes(part) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return String('value').startsWith(prefix) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return Array.of(value).some(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return Array.from([ value ]).includes(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return Array.from([ value ], undefined).includes(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const mapper = undefined; function ready() { return Array.from([ value ], mapper).includes(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new Array(value).every(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return Object.keys({ key: value }).includes(key) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return Object.keys([ , value ]).includes(key) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const key = 'key'; function ready() { return Object.values({ [key]: value }).includes(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new Headers().has(name) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new Headers({ key: 'value' }).has(name) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new Headers([ [ 'key', 'value' ] ]).has(name) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new URLSearchParams('key=value').has(name) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new URLSearchParams({ key: 'value' }).has(name) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new FormData().has(name) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new Uint8Array([ 1 ]).some(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return Float64Array.from([ 1 ]).includes(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return Uint8Array.of(1, undefined, true).some(Boolean) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new BigInt64Array([ 1n, true, '2' ]).some(Boolean) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return BigUint64Array.from([ 1n, '2' ]).some(Boolean) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const mapper = undefined; function ready() { "
        + "return Float64Array.from([ 1 ], mapper).includes(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const values = new Int16Array(1); function ready() { return values.every(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new URLPattern('*').test(input) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new WeakSet([ {} ]).has(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new Map([ [ 'key', value ] ]).has('key') }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return new WeakMap([ [ {}, value ] ]).has(key) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return Reflect.has(object, key) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return Array.isArray(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const NativeNumber = Number; function ready() { return NativeNumber.isInteger(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return /value/?.test(input) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return 'value'?.includes(input) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return [ value ]?.some(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return /x/.test?.(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return 'value'.includes?.(part) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready() { return [ value ].some?.(predicate) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "const key = 'ready'; class C { [key]() { return true } }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "class Toggle extends HTMLElement { #hasAttribute() { return true } "
        + "get disabled() { return this.#hasAttribute(\"disabled\") } }",
      errors: [ { messageId: "booleanName", data: { name: "disabled", pascal: "Disabled" } } ]
    },
    {
      code: "class Toggle extends HTMLElement { get disabled() { return other.hasAttribute(\"disabled\") } }",
      errors: [ { messageId: "booleanName", data: { name: "disabled", pascal: "Disabled" } } ]
    },
    {
      code: "class Toggle extends HTMLElement { get disabled() {"
        + " function isRead() { return this.hasAttribute(\"disabled\") }; return true } }",
      errors: [ { messageId: "booleanName", data: { name: "disabled", pascal: "Disabled" } } ]
    },
    {
      code: "class Toggle extends HTMLElement { get disabled() {"
        + " (function () { this.hasAttribute(\"disabled\") })(); return true } }",
      errors: [ { messageId: "booleanName", data: { name: "disabled", pascal: "Disabled" } } ]
    },
    {
      code: "class Toggle extends HTMLElement { get disabled() {"
        + " const read = () => this.hasAttribute(\"disabled\"); return true } }",
      errors: [ { messageId: "booleanName", data: { name: "disabled", pascal: "Disabled" } } ]
    },
    {
      code: "class Toggle extends HTMLElement { get disabled() {"
        + " class Inner { value = this.hasAttribute(\"disabled\") }; return true } }",
      errors: [ { messageId: "booleanName", data: { name: "disabled", pascal: "Disabled" } } ]
    },
    {
      code: "class Toggle extends HTMLElement { get disabled() {"
        + " class Inner { get isValue() { return this.hasAttribute(\"disabled\") } }; return true } }",
      errors: [ { messageId: "booleanName", data: { name: "disabled", pascal: "Disabled" } } ]
    },
    {
      code: "class Toggle extends HTMLElement { get disabled() { this[reader](\"disabled\"); return true } }",
      errors: [ { messageId: "booleanName", data: { name: "disabled", pascal: "Disabled" } } ]
    },
    {
      code: "class C { get redundant() { return this.a === this.b } }",
      errors: [ { messageId: "booleanName", data: { name: "redundant", pascal: "Redundant" } } ]
    },
    {
      code: "class C { empty() { return this.items.length === 0 } }",
      errors: [ { messageId: "booleanName", data: { name: "empty", pascal: "Empty" } } ]
    },
    {
      code: "function ready() { return Boolean(value) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function status() { return true }",
      errors: [ { messageId: "booleanName", data: { name: "status", pascal: "Status" } } ]
    },
    {
      code: "function address() { return true }",
      errors: [ { messageId: "booleanName", data: { name: "address", pascal: "Address" } } ]
    },
    {
      code: "function analysisComplete() { return true }",
      errors: [ { messageId: "booleanName", data: { name: "analysisComplete", pascal: "AnalysisComplete" } } ]
    },
    {
      code: "/* global Boolean */ function status() { return Boolean(value) }",
      errors: [ { messageId: "booleanName", data: { name: "status", pascal: "Status" } } ]
    },
    {
      code: "/* global Boolean:off */ function status() { return Boolean(value) }",
      errors: [ { messageId: "booleanName", data: { name: "status", pascal: "Status" } } ]
    },
    {
      code: "async function ready() { return true } function result() { return ready() }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "function ready(count) { return count === 0 ? true : ready(count - 1) }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "class C { get enabled() { return true } }",
      errors: [ { messageId: "booleanName", data: { name: "enabled", pascal: "Enabled" } } ]
    },
    {
      code: "class C { get open() { return this.locked ? false : this.isVisible } }",
      errors: [ { messageId: "booleanName", data: { name: "open", pascal: "Open" } } ]
    },
    {
      code: "function ready() { return isConnected }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: "class C { closed() { return !this.open } }",
      errors: [ { messageId: "booleanName", data: { name: "closed", pascal: "Closed" } } ]
    },
    {
      code: "class C { valid = () => this.a === this.b }",
      errors: [ { messageId: "booleanName", data: { name: "valid", pascal: "Valid" } } ]
    },
    {
      code: "class C extends Controller { get expanded() { return this.getAttribute(\"x\") === \"y\" } }",
      errors: [ { messageId: "booleanName", data: { name: "expanded", pascal: "Expanded" } } ]
    },
    {
      code: "class FooElement extends HTMLElement { disabled() { return this.hasAttribute(\"disabled\") } }",
      errors: [ { messageId: "booleanName", data: { name: "disabled", pascal: "Disabled" } } ]
    },
    {
      code: "class FooElement extends HTMLElement { get empty() { return this.children.length === 0 } }",
      errors: [ { messageId: "booleanName", data: { name: "empty", pascal: "Empty" } } ]
    },
    {
      code: "class C { get ready() { return this.matchesInput() } matchesInput() { return this.x === 1 } }",
      errors: [ { messageId: "booleanName", data: { name: "ready", pascal: "Ready" } } ]
    },
    {
      code: dedent`
        function matchesState() { return state === "on" }
        class C { get active() { return matchesState() } }
      `,
      errors: [ { messageId: "booleanName", data: { name: "active", pascal: "Active" } } ]
    }
  ]
})

function nestedReflectedGetters(depth) {
  return Array.from({ length: depth }, (_, index) => depth - index - 1).reduce(
    (body, index) => `class C${index} extends HTMLElement { get ready${index}() { ${body};`
      + " return this.hasAttribute(\"ready\") } }",
    "return this.hasAttribute(\"ready\")"
  )
}

function sharedRegexAliases(count) {
  return [ "const shared = /x/; consume(shared); ", Array.from({ length: count }, regexAliasAt).join(";") ].join("")
}

function regexAliasAt(_value, index) {
  return `const pattern${index} = shared; function value${index}() { return pattern${index}.test(input) }`
}

function nativeCallsBeforeEscape(count) {
  return `function ready() { const values = []; return ${nativeCalls(count).join(" && ")} }`
}

function nativeCalls(count) {
  return [
    ...Array.from({ length: count - 1 }, () => "values.some(predicate)"),
    "values.some((consume(values), predicate))"
  ]
}
