import rule from "#rules/restrictions/exports"
import { tester } from "#support"

tester.run("restrictions/exports", rule, {
  valid: [
    { code: "export default class Foo {}", options: [ { kinds: [ "class" ] } ] },
    { code: "export const VALUE = 1", options: [ { kinds: [ "constant" ] } ] },
    { code: "export function first() {}\nexport const second = () => {}", options: [ { kinds: [ "function" ] } ] },
    { code: "export * from \"./first\"", options: [ { kinds: [ "reexport" ] } ] },
    { code: "class Internal {}\nexport const VALUE = 1", options: [ { kinds: [ "constant" ] } ] },
    { code: "export default class Foo {}\nexport const VALUE = 1", options: [ { kinds: [ "class", "constant" ] } ] }
  ],
  invalid: [
    {
      code: "export function build() {}",
      options: [ { kinds: [ "constant" ] } ],
      errors: [ { messageId: "forbiddenExportKind", data: { allowed: "`constant`", name: "build", kind: "function" } } ]
    },
    {
      code: "export default new Thing()",
      options: [ { kinds: [ "class" ] } ],
      errors: [ { messageId: "forbiddenExportKind", data: { allowed: "`class`", name: "default", kind: "constant" } } ]
    },
    {
      code: "export class Foo {}\nexport const helper = () => {}",
      options: [ { kinds: [ "class", "constant" ] } ],
      errors: [ {
        messageId: "forbiddenExportKind",
        data: { allowed: "`class` or `constant`", name: "helper", kind: "function" }
      } ]
    },
    {
      code: "export * from \"./first\"\nexport const VALUE = 1",
      options: [ { kinds: [ "reexport" ] } ],
      errors: [ { messageId: "forbiddenExportKind", data: { allowed: "`reexport`", name: "VALUE", kind: "constant" } } ]
    }
  ]
})
