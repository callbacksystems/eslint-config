import rule from "#rules/no_anemic_record"
import { dedent, tester } from "#support"

tester.run("no-anemic-record", rule, {
  valid: [
    // Module-level reads are one consumer, the module.
    dedent`
      const settings = { host: base.host, port: base.port, scheme: base.scheme }

      export const address = settings.host
      export const origin = settings.scheme + settings.port
    `,
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
    dedent`
      function report(member) {
        const descriptor = { node: member.key, message: "x", severity: 1 }
        return send(descriptor.node, descriptor.message, descriptor.severity)
      }
    `,
    dedent`
      function describe(method) {
        return { name: method.name, kind: method.kind, size: method.size }
      }

      function render(entry) {
        return entry.name + entry.kind + entry.size
      }
    `,
    dedent`
      function describe(method) {
        return { name: method.name, kind: method.kind, get label() { return this.name } }
      }

      function order(entry) { return entry.name }
      function group(entry) { return entry.kind }
    `,
    dedent`
      function describe(method) {
        return { name: method.name, kind: method.kind }
      }

      function order(entry) { return entry.name }
      function group(entry) { return entry.kind }
    `,
    // `node` is a parameter with no tie to `describe`, so a shared field name is a coincidence of vocabulary.
    dedent`
      function describe(method) {
        return { name: method.name, kind: method.kind, size: method.size }
      }

      function labelOf(node) { return node.name }
      function typeOf(node) { return node.type }
      function rangeOf(node) { return node.range }
    `,
    // Two shared field names with a parameter are still no tie.
    dedent`
      function describe(method) {
        return { name: method.name, kind: method.kind, size: method.size }
      }

      function order(entry) { return entry.name + entry.kind }
      function group(entry) { return entry.kind }
      function measure(entry) { return entry.size }
    `,
    // A `for...of` destructuring has no initializer, so there is no home to reach.
    dedent`
      function describe(method) {
        return { name: method.name, kind: method.kind, size: method.size }
      }

      function render(methods) {
        for (const { name, kind } of methods) log(name, kind)
      }

      function measure(methods) {
        for (const { size } of methods) log(size)
      }
    `,
    // Handed straight to a call, the literal has no name to be reached by.
    dedent`
      connect({ host: base.host, port: base.port, scheme: base.scheme })

      function describe(settings) { return settings.host + settings.port }
      function label(settings) { return settings.scheme }
    `,
    // Serialization output and form input share a vocabulary, not a concept.
    dedent`
      class Plan {
        toJSON() {
          return { id: this.id, name: this.name, description: this.description, priceAmount: this.priceAmount,
            ctaText: this.ctaText, rules: this.rules }
        }
      }

      function validate(entry) { return entry.id && entry.rules.length > 0 }
      function label(entry) { return entry.name + entry.rules.length }
    `,
    dedent`
      class Plan {
        toJSON() {
          return { id: this.id, name: this.name, rules: this.rules }
        }

        get isValid() {
          return this.toJSON().rules.length > 0
        }

        get label() {
          return this.toJSON().name + this.toJSON().id
        }
      }
    `
  ],
  invalid: [
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
          #options = { width: 1, height: 2, depth: 3 }

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
    {
      code: dedent`
        function settings() {
          return { width: 1, height: 2, depth: 3 }
        }

        function isWide() { return settings().width > 10 }
        function isTall() { return settings().height > 10 }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "depth, height, width", count: 2 } } ]
    },
    {
      code: dedent`
        function settings() {
          return { width: 1, height: 2, depth: 3 }
        }

        function isWide() {
          const config = settings()
          return config.width > 10
        }

        function isTall() {
          const config = settings()
          return config.height > 10
        }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "depth, height, width", count: 2 } } ]
    },
    {
      code: dedent`
        function describe(method) {
          return { name: method.name, kind: method.kind, size: method.size }
        }

        function order(method) {
          const { name, kind } = describe(method)
          return name + kind
        }

        function measure(method) {
          const entry = describe(method)
          return entry.size + entry.name
        }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "kind, name, size", count: 2 } } ]
    },
    {
      code: dedent`
        const settings = { host: base.host, port: base.port, scheme: base.scheme }

        function connect() { return settings.host + settings.port }
        function describe() { return settings.scheme + settings.host }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "host, port, scheme", count: 2 } } ]
    },
    // Two literals under one home, and each read goes to the one whose shape fits what is reached.
    {
      code: dedent`
        function shape(mode) {
          if (mode === "flat") return { width: 1, height: 2, depth: 0 }
          return { width: 1, height: 2, depth: 3, weight: 4 }
        }

        function isWide() { return shape().width > 10 }
        function isTall() { return shape().height > 10 }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "depth, height, width", count: 2 } } ]
    },
    // A read at module level is a consumer of its own.
    {
      code: dedent`
        const settings = { host: base.host, port: base.port, scheme: base.scheme }

        export const address = settings.host
        function describe() { return settings.scheme + settings.port }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "host, port, scheme", count: 2 } } ]
    },
    {
      code: dedent`
        function pair(method) {
          return { member: method.key, group: method.kind, weight: method.size }
        }

        function order(method) { return pair(method).member + pair(method).group + pair(method).weight }
        function rank(method) { return pair(method).group }
        function pick(method) { return pair(method).member }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "group, member, weight", count: 3 } } ]
    }
  ]
})
