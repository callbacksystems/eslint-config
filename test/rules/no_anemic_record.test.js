import rule from "#rules/no_anemic_record"
import { dedent, tester } from "#support"

const BACKTICK = "`"

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
      class Outer {
        store(target) {
          function save() { this.data = { alpha: 1, beta: 2, gamma: 3 } }
          save.call(target)
        }

        alpha(target) {
          function read() { return this.data.alpha }
          return read.call(target)
        }

        beta(target) {
          function read() { return this.data.beta }
          return read.call(target)
        }
      }
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
    `,
    // Same spelling in nested scopes is not the same record home.
    dedent`
      const settings = { width: 1, height: 2, depth: 3 }

      function first() {
        const settings = other
        return settings.width
      }

      function second(settings) { return settings.height }
    `,
    // Writing fields does not count as reaching into a record for data.
    dedent`
      const settings = { width: 1, height: 2, depth: 3 }
      function resize() { settings.width = 10 }
      function deepen() { settings.depth = 10 }
    `,
    dedent`
      const settings = { width: 1, height: 2, depth: 3 }

      function resize(values) {
        for (settings.width of values) useCurrentValue()
      }

      function deepen(values) {
        for (settings.depth in values) useCurrentValue()
      }
    `,
    dedent`
      const settings = { width: 1, height: 2, depth: 3 }

      function resize(other) {
        ;({ width: settings.width } = other)
      }

      function deepen(other) {
        ;({ depth: settings.depth } = other)
      }
    `,
    // A function object and the value returned by calling it are distinct homes.
    dedent`
      function settings() { return { width: 1, height: 2, depth: 3 } }
      function first() { return settings.width }
      function second() { return settings.height }
    `,
    dedent`
      export default function () { return { width: 1, height: 2, depth: 3 } }
      function first() { return value.width }
      function second() { return value.height }
    `,
    dedent`
      const toJSON = () => ({ id: 1, name: "plan", type: "paid" })
      function idOf() { return toJSON().id }
      function nameOf() { return toJSON().name }
    `,
    dedent`
      const serialize = function () { return { id: 1, name: "plan", type: "paid" } }
      function idOf() { return serialize().id }
      function nameOf() { return serialize().name }
    `,
    dedent`
      class Plan {
        toObject = () => ({ id: this.id, name: this.name, type: this.type })
        idOf() { return this.toObject().id }
        nameOf() { return this.toObject().name }
      }
    `,
    dedent`
      class Plan {
        [${BACKTICK}toJSON${BACKTICK}]() { return { id: this.id, name: this.name, type: this.type } }
        idOf() { return this.toJSON().id }
        nameOf() { return this.toJSON().name }
      }
    `,
    dedent`
      class Plan {
        constructor() {
          this.toJSON = () => ({ id: this.id, name: this.name, type: this.type })
        }

        idOf() { return this.toJSON().id }
        nameOf() { return this.toJSON().name }
      }
    `,
    // Async and generator calls return wrappers, not the object literal itself.
    dedent`
      async function settings() { return { width: 1, height: 2, depth: 3 } }
      function first() { return settings().width }
      function second() { return settings().height }
    `,
    dedent`
      function *settings() { return { width: 1, height: 2, depth: 3 } }
      function first() { return settings().width }
      function second() { return settings().height }
    `,
    // Reassignment severs the identity between the literal and subsequent reads.
    dedent`
      let settings = { width: 1, height: 2, depth: 3 }
      settings = other
      function first() { return settings.width }
      function second() { return settings.height }
    `,
    dedent`
      const settings = { __proto__: proto, alpha: 1, beta: 2 }
      function first() { return settings.alpha }
      function second() { return settings.beta }
    `,
    dedent`
      const settings = { "__proto__": proto, alpha: 1, beta: 2 }
      function first() { return settings.alpha }
      function second() { return settings.beta }
    `,
    dedent`
      const settings = { __proto__() {}, alpha: 1, beta: 2 }
      function first() { return settings.alpha }
      function second() { return settings.beta }
    `,
    dedent`
      const provider = { settings() { return { width: 1, height: 2, depth: 3 } } }
      function first() { return provider.settings().width }
      function second() { return provider.settings().height }
    `,
    dedent`
      other.settings = { width: 1, height: 2, depth: 3 }
      function first() { return other.settings.width }
      function second() { return other.settings.height }
    `
  ],
  invalid: [
    {
      code: dedent`
        class Report {
          [0] = { width: 1, height: 2, depth: 3 }
          first() { return this[0].width }
          second() { return this[0].height }
        }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "depth, height, width", count: 2 } } ]
    },
    {
      code: dedent`
        class Report {
          static ["options"] = { width: 1, height: 2, depth: 3 }
          static first() { return this.options.width }
          static second() { return this.options.height }
        }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "depth, height, width", count: 2 } } ]
    },
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
    },
    {
      code: dedent`
        const settings = { "width": 1, "height": 2, "depth": 3 }
        function isWide() { return settings["width"] > 10 }
        function isTall() { return settings["height"] > 10 }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "depth, height, width", count: 2 } } ]
    },
    {
      code: dedent`
        const settings = { ["width"]: 1, ["height"]: 2, 0: 3 }
        function isWide() { return settings.width > 10 }
        function hasOrigin() { return settings[0] > 0 }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "0, height, width", count: 2 } } ]
    },
    {
      code: dedent`
        const settings = { width: 1, height: 2, depth: 3 }

        function width() {
          let width
          ;({ width } = settings)
          return width
        }

        function height() {
          let height
          ;({ height } = settings)
          return height
        }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "depth, height, width", count: 2 } } ]
    },
    {
      code: dedent`
        const settings = { width: 1, height: 2, depth: 3 }
        function resize() { settings.width += 10 }
        function deepen() { settings.depth++ }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "depth, height, width", count: 2 } } ]
    },
    {
      name: "indexes enclosing contexts once across deeply nested reads",
      code: deeplyReadRecord(300),
      errors: [ { messageId: "anemicRecord", data: { fields: "depth, height, width", count: 2 } } ]
    },
    {
      code: dedent`
        const settings = { __proto__: proto, alpha: 1, beta: 2, gamma: 3 }
        function first() { return settings.alpha }
        function second() { return settings.beta }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "alpha, beta, gamma", count: 2 } } ]
    },
    {
      code: dedent`
        const __proto__ = proto
        const settings = { __proto__, alpha: 1, beta: 2 }
        function first() { return settings.alpha }
        function second() { return settings.beta }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "__proto__, alpha, beta", count: 2 } } ]
    },
    {
      code: dedent`
        const settings = { ["__proto__"]: proto, alpha: 1, beta: 2 }
        function first() { return settings.alpha }
        function second() { return settings.beta }
      `,
      errors: [ { messageId: "anemicRecord", data: { fields: "__proto__, alpha, beta", count: 2 } } ]
    },
    {
      code: dedent`
        const settings = { __proto__: proto, alpha: 1, beta: 2 }
        function first() { return settings.alpha }
        function second() { return settings.beta }
      `,
      options: [ { minFields: 2, minReaders: 2 } ],
      errors: [ { messageId: "anemicRecord", data: { fields: "alpha, beta", count: 2 } } ]
    }
  ]
})

function deeplyReadRecord(depth) {
  return "class Report { #settings = { width: 1, height: 2, depth: 3 }; "
    + `first() { ${"{".repeat(depth)} `
    + `${Array.from({ length: depth }, () => "use(this.#settings.width)").join(";")} ${"}".repeat(depth)} } `
    + "second() { return this.#settings.height } }"
}
