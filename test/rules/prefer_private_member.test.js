import rule from "#rules/prefer_private_member"
import { dedent, tester } from "#support"

tester.run("prefer-private-member", rule, {
  valid: [
    dedent`
      class Day {
        constructor(selection) { this.selection = selection }
        get attributes() { return this.selection.startsOn }
      }
      class Selection {
        get startsOn() { return this.start }
        get days() { return new Day(this).attributes }
      }
      new Selection().days
    `,
    dedent`
      class Tag {
        get continuation() { return this.line }
      }
      class Rule {
        offenseFor(tag) {
          const { continuation } = tag
          return continuation
        }
        get tags() { return new Tag() }
      }
      const rule = new Rule()
      rule.offenseFor(rule.tags)
    `,
    dedent`
      class Base {
        get label() { return "base" }
      }
      class Child extends Base {
        get title() { return super.label }
      }
    `,
    dedent`
      export default class Thing {
        get value() { return this.value }
      }
    `,
    dedent`
      export class Thing {
        get value() { return this.value }
      }
    `,
    dedent`
      class Thing {
        get value() { return this.value }
      }
      export { Thing }
    `,
    dedent`
      class Thing {
        get value() { return this.value }
      }
      export default Thing
    `,
    // A subclass overrides hooks its parent calls.
    dedent`
      class Visitor extends BaseVisitor {
        visitNode(node) { return node }
      }
    `,
    dedent`
      import { report } from "#helpers/report"
      class Analysis {
        get problem() { return null }
      }
      report(new Analysis())
    `,
    dedent`
      import { report } from "#helpers/report"
      class Analysis {
        get problem() { return null }
      }
      const analysis = new Analysis()
      report(analysis)
    `,
    dedent`
      class Analysis {
        get problem() { return null }
      }
      export function analyze() { return new Analysis() }
    `,
    dedent`
      class Analysis {
        get problem() { return null }
      }
      export default class Rule {
        get analysis() { return new Analysis() }
      }
    `,
    dedent`
      class Analysis {
        get problem() { return null }
      }
      export default class Rule {
        get analyses() { return [ new Analysis() ] }
      }
    `,
    dedent`
      class Analysis {
        get problem() { return null }
      }
      export default class Rule {
        get analyses() { return items.map((item) => new Analysis(item)) }
      }
    `,
    dedent`
      class Analysis {
        get problem() { return null }
      }
      registry.push(new Analysis())
    `,
    dedent`
      class Analysis {
        get problem() { return null }
      }
      window.analysis = new Analysis()
    `,
    // A parameter default is out of view, as is a constructor reached through a property.
    dedent`
      class Analysis {
        get problem() { return null }
      }
      const run = (analysis = new Analysis()) => use(analysis)
    `,
    dedent`
      class Analysis {
        get problem() { return null }
      }
      new registry.Holder(new Analysis())
    `,
    dedent`
      class Analysis {
        get problem() { return null }
      }
      export function last(items) { return items.reduce((found, item) => new Analysis(item), null) }
    `,
    // The class itself passed as a value could be constructed anywhere.
    dedent`
      class Analysis {
        get problem() { return null }
      }
      register(Analysis)
    `,
    dedent`
      class Money {
        toString() { return this.amount }
        toJSON() { return this.amount }
      }
      new Money()
    `,
    dedent`
      class Money {
        static zero() { return new Money() }
      }
      Money.zero()
    `,
    // A dynamic `this[key]` can reach any member by name.
    dedent`
      class Config {
        get limit() { return this.read("limit") }
        read(key) { return this[key] }
      }
      new Config()
    `,
    dedent`
      class Widget {
        get size() { return 1 }
        measure() {
          return items.map(function () { return this.size })
        }
      }
      new Widget().measure()
    `,
    dedent`
      class Widget {
        get size() { return 1 }
        static describe() { return this.size }
      }
      new Widget()
    `,
    dedent`
      class Widget {
        static { this.size }
        get size() { return 1 }
      }
      new Widget()
    `,
    dedent`
      import { Registry } from "#registry"
      class Analysis {
        get problem() { return null }
      }
      new Registry(new Analysis())
    `,
    dedent`
      class Item {
        get value() { return 1 }
      }
      class List {
        get values() { return this.#items.map((item) => item.value) }
        get #items() { return [ new Item() ] }
      }
      new List().values
    `,
    dedent`
      class Widget {
        get #size() { return 1 }
        get area() { return this.#size * this.#size }
      }
      new Widget().area
    `,
    dedent`
      class Widget {
        get size() { return 1 }
      }
      const widget = new Widget()
      widget["size"]
    `
  ],
  invalid: [
    {
      code: dedent`
        class Widget {
          get area() { return this.size * this.size }
          get size() { return 1 }
        }
        new Widget().area
      `,
      output: dedent`
        class Widget {
          get area() { return this.#size * this.#size }
          get #size() { return 1 }
        }
        new Widget().area
      `,
      errors: [ { messageId: "preferPrivate", data: { name: "size", className: "Widget" } } ]
    },
    {
      code: dedent`
        class Widget {
          render() { this.prepare() }
          prepare() { this.ready = true }
        }
        new Widget().render()
      `,
      output: dedent`
        class Widget {
          render() { this.#prepare() }
          #prepare() { this.ready = true }
        }
        new Widget().render()
      `,
      errors: [ { messageId: "preferPrivate", data: { name: "prepare", className: "Widget" } } ]
    },
    {
      code: dedent`
        class Counter {
          count = 0
          increment() { this.count += 1 }
        }
        new Counter().increment()
      `,
      output: dedent`
        class Counter {
          #count = 0
          increment() { this.#count += 1 }
        }
        new Counter().increment()
      `,
      errors: [ { messageId: "preferPrivate", data: { name: "count", className: "Counter" } } ]
    },
    {
      code: dedent`
        class Counter {
          get total() { return this.sum }
          set total(value) { this.sum = value }
          reset() { this.total = 0 }
        }
        new Counter().reset()
      `,
      output: dedent`
        class Counter {
          get #total() { return this.sum }
          set #total(value) { this.sum = value }
          reset() { this.#total = 0 }
        }
        new Counter().reset()
      `,
      errors: [ { messageId: "preferPrivate", data: { name: "total", className: "Counter" } } ]
    },
    {
      code: dedent`
        class List {
          get total() { return this.items.reduce((sum, item) => sum + this.weight, 0) }
          get weight() { return 2 }
        }
        new List().total
      `,
      output: dedent`
        class List {
          get total() { return this.items.reduce((sum, item) => sum + this.#weight, 0) }
          get #weight() { return 2 }
        }
        new List().total
      `,
      errors: [ { messageId: "preferPrivate", data: { name: "weight", className: "List" } } ]
    },
    {
      code: dedent`
        class Day {
          constructor(selection) { this.selection = selection }
          get attributes() { return this.selection.startsOn }
        }
        class Selection {
          get startsOn() { return this.start }
          get days() { return new Day(this).attributes }
          get isEmpty() { return !this.startsOn }
        }
        new Selection().days
      `,
      output: dedent`
        class Day {
          constructor(selection) { this.selection = selection }
          get attributes() { return this.selection.startsOn }
        }
        class Selection {
          get startsOn() { return this.start }
          get days() { return new Day(this).attributes }
          get #isEmpty() { return !this.startsOn }
        }
        new Selection().days
      `,
      errors: [ { messageId: "preferPrivate", data: { name: "isEmpty", className: "Selection" } } ]
    },
    {
      code: dedent`
        class Day {
          constructor(selection) { this.selection = selection }
          get attributes() { return this.selection.startsOn }
        }
        class Selection {
          get startsOn() { return this.start }
          get isEmpty() { return !this.startsOn }
        }
        const selection = new Selection()
        new Day(selection).attributes
      `,
      output: dedent`
        class Day {
          constructor(selection) { this.selection = selection }
          get attributes() { return this.selection.startsOn }
        }
        class Selection {
          get startsOn() { return this.start }
          get #isEmpty() { return !this.startsOn }
        }
        const selection = new Selection()
        new Day(selection).attributes
      `,
      errors: [ { messageId: "preferPrivate", data: { name: "isEmpty", className: "Selection" } } ]
    },
    {
      code: dedent`
        class Drag {
          get offset() { return this.left }
          get left() { return 1 }
        }
        class Controller {
          #drag = new Drag()
          move() { return this.#drag.offset }
        }
        new Controller().move()
      `,
      output: dedent`
        class Drag {
          get offset() { return this.#left }
          get #left() { return 1 }
        }
        class Controller {
          #drag = new Drag()
          move() { return this.#drag.offset }
        }
        new Controller().move()
      `,
      errors: [ { messageId: "preferPrivate", data: { name: "left", className: "Drag" } } ]
    },
    {
      code: dedent`
        class Line {
          constructor(text) { this.text = text }
          get isBlank() { return this.text.trim() === "" }
          get indent() { return this.width }
          get width() { return this.text.length }
        }
        class Template {
          get lines() { return this.source.split("\\n").map((text) => new Line(text)) }
          get blank() { return this.lines.filter((line) => line.isBlank) }
        }
        new Template().blank
      `,
      output: dedent`
        class Line {
          constructor(text) { this.text = text }
          get isBlank() { return this.text.trim() === "" }
          get #indent() { return this.#width }
          get #width() { return this.text.length }
        }
        class Template {
          get #lines() { return this.source.split("\\n").map((text) => new Line(text)) }
          get blank() { return this.#lines.filter((line) => line.isBlank) }
        }
        new Template().blank
      `,
      errors: [
        { messageId: "preferPrivate", data: { name: "indent", className: "Line" } },
        { messageId: "preferPrivate", data: { name: "width", className: "Line" } },
        { messageId: "preferPrivate", data: { name: "lines", className: "Template" } }
      ]
    },
    {
      code: dedent`
        class Line {
          get width() { return 1 }
          get indent() { return this.width }
        }
        function lineOf(text) { return new Line(text) }
        lineOf("x").indent
      `,
      output: dedent`
        class Line {
          get #width() { return 1 }
          get indent() { return this.#width }
        }
        function lineOf(text) { return new Line(text) }
        lineOf("x").indent
      `,
      errors: [ { messageId: "preferPrivate", data: { name: "width", className: "Line" } } ]
    },
    {
      code: dedent`
        class Widget {
          get #size() { return 1 }
          get size() { return this.#size }
          get area() { return this.size * this.size }
        }
        new Widget().area
      `,
      output: null,
      errors: [ { messageId: "preferPrivate", data: { name: "size", className: "Widget" } } ]
    }
  ]
})
