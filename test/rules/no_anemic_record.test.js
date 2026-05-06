import rule from "#rules/no_anemic_record"
import { dedent, tester } from "#support"

tester.run("no-anemic-record", rule, {
  valid: [
    // Another object's record, not this class's.
    dedent`
      class Report {
        get isWide() {
          return other.options.width > 10
        }

        get isTall() {
          return other.options.height > 10
        }
      }
    `,
    // Consumed where it is built: a return value, not a concept.
    dedent`
      function report(member) {
        const descriptor = { node: member.key, message: "x", severity: 1 }
        return send(descriptor.node, descriptor.message, descriptor.severity)
      }
    `,
    // Read by a single function, however many fields it reaches for.
    dedent`
      function describe(method) {
        return { name: method.name, kind: method.kind, size: method.size }
      }

      function render(entry) {
        return entry.name + entry.kind + entry.size
      }
    `,
    // Already an object: it answers for itself.
    dedent`
      function describe(method) {
        return { name: method.name, kind: method.kind, get label() { return this.name } }
      }

      function order(entry) { return entry.name }
      function group(entry) { return entry.kind }
    `,
    // Below the field threshold.
    dedent`
      function describe(method) {
        return { name: method.name, kind: method.kind }
      }

      function order(entry) { return entry.name }
      function group(entry) { return entry.kind }
    `,
    // A single shared field name is a coincidence of vocabulary, not the record: `node.name` here is an AST node, not
    // the described member.
    dedent`
      function describe(method) {
        return { name: method.name, kind: method.kind, size: method.size }
      }

      function labelOf(node) { return node.name }
      function typeOf(node) { return node.type }
      function rangeOf(node) { return node.range }
    `
  ],
  invalid: [
    // A record kept in a field is reached through `this`, which is where an OO codebase puts one.
    {
      code: dedent`
        class Report {
          #options

          constructor() {
            this.#options = { width: 1, height: 2, depth: 3 }
          }

          get isWide() {
            return this.#options.width > 10
          }

          get isTall() {
            return this.#options.height > 10
          }
        }
      `,
      errors: [ { messageId: "anemicRecord" } ]
    },
    {
      code: dedent`
        class Report {
          get options() {
            return { width: 1, height: 2, depth: 3 }
          }

          get isWide() {
            return this.options.width > 10
          }

          get isTall() {
            return this.options.height > 10
          }
        }
      `,
      errors: [ { messageId: "anemicRecord" } ]
    },
    // Built in one place, reached into from several others.
    {
      code: dedent`
        function describe(method) {
          return { name: method.name, kind: method.kind, size: method.size }
        }

        function order(entry) { return entry.name + entry.kind }
        function group(entry) { return entry.kind }
        function measure(entry) { return entry.size }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "kind, name, size", count: 3 } } ]
    },
    // Destructuring reaches for the fields just the same.
    {
      code: dedent`
        function describe(method) {
          return { name: method.name, kind: method.kind, size: method.size }
        }

        function order(entry) {
          const { name, kind } = entry
          return name + kind
        }

        function measure(entry) { return entry.size + entry.name }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "kind, name, size", count: 2 } } ]
    },
    // A record bound to a name travels as readily as one returned.
    {
      code: dedent`
        const settings = { host: base.host, port: base.port, scheme: base.scheme }

        function connect(config) { return config.host + config.port }
        function describe(config) { return config.scheme + config.host }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "host, port, scheme", count: 2 } } ]
    },
    // A narrow record next door keeps its own reads: the wide one is left with the single reader that actually holds
    // it.
    {
      code: dedent`
        function pair(method) {
          return { member: method.key, group: method.kind, weight: method.size }
        }

        function order(entry) { return entry.member + entry.group + entry.weight }
        function rank(entry) { return entry.group }
        function pick(entry) { return entry.member }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "group, member, weight", count: 3 } } ]
    }
  ]
})
