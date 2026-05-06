import rule from "#rules/no_mixed_exports"
import { dedent, tester } from "#support"

tester.run("no-mixed-exports", rule, {
  valid: [
    "export default class Foo {}",
    "export class Foo {}",
    dedent`
      class Collaborator {}
      class Helper {}
      export default class Foo {}
    `,
    "class Foo {}\nexport { Foo }",
    "export function first() {}\nexport function second() {}",
    "export const first = () => {}\nexport function second() {}",
    "export const FIRST = 1\nexport const SECOND = 2",
    "export const FILES = []\nexport default [ FILES ]",
    "export * from \"./first\"\nexport { second } from \"./second\"",
    "class Helper {}\nexport default { value: 1 }",
    "export default new Thing()",
    'export function load() {}\neval("load = 1")\nexport const VALUE = 1',
    'export class Model {}\neval("Model = 1")\nexport const VALUE = 1',
    "class Foo {}\nexport { Foo }\nexport default Foo",
    "class Foo {}\nexport { Foo, Foo as Bar }"
  ],
  invalid: [
    {
      code: "export default class A {}\nexport class B {}",
      errors: [ { messageId: "soloClass", data: { name: "B" } } ]
    },
    { code: "export class A {}\nexport class B {}", errors: [ { messageId: "soloClass", data: { name: "B" } } ] },
    { code: "class A {}\nclass B {}\nexport { A, B }", errors: [ { messageId: "soloClass", data: { name: "B" } } ] },
    {
      code: "export default class A {}\nexport const VALUE = 1",
      errors: [ { messageId: "soloClass", data: { name: "VALUE" } } ]
    },
    {
      code: "export const first = 1\nexport const second = 2\nexport function third() {}",
      errors: [ { messageId: "mixedKinds", data: { name: "third", kind: "function", expected: "constant" } } ]
    },
    {
      code: "export default new Thing()\nexport function first() {}",
      errors: [ { messageId: "mixedKinds", data: { name: "first", kind: "function", expected: "constant" } } ]
    },
    {
      code: "export function first() {}\nexport function second() {}\nexport default new Thing()",
      errors: [ { messageId: "mixedKinds", data: { name: "default", kind: "constant", expected: "function" } } ]
    },
    {
      code: "export * from \"./first\"\nexport const VALUE = 1",
      errors: [ { messageId: "mixedKinds", data: { name: "VALUE", kind: "constant", expected: "reexport" } } ]
    },
    {
      code: "import { helper } from \"./helper\"\nexport { helper }\nexport const VALUE = 1",
      errors: [ { messageId: "mixedKinds", data: { name: "VALUE", kind: "constant", expected: "reexport" } } ]
    },
    {
      code: 'export const handler = () => {}\nexport const VALUE = 1\neval("unrelated")',
      errors: [ { messageId: "mixedKinds", data: { name: "VALUE", kind: "constant", expected: "function" } } ]
    },
    {
      code: 'export const Model = class {}\nexport const VALUE = 1\neval("unrelated")',
      errors: [ { messageId: "soloClass", data: { name: "VALUE" } } ]
    },
    {
      code: "function execute() {}\nconst handler = execute\nexport { handler }\nexport const VALUE = 1",
      errors: [ { messageId: "mixedKinds", data: { name: "VALUE", kind: "constant", expected: "function" } } ]
    },
    {
      code: "class Model {}\nconst PublicModel = Model\nexport { PublicModel }\nexport const VALUE = 1",
      errors: [ { messageId: "soloClass", data: { name: "VALUE" } } ]
    }
  ]
})
