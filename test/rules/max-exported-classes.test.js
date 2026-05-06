import rule from "#rules/max-exported-classes"
import { dedent, tester } from "#test/support"

tester.run("max-exported-classes", rule, {
  valid: [
    "export default class Foo {}",
    "export class Foo {}",
    // Internal classes are unlimited; only Foo is exported.
    dedent`
      class Collaborator {}
      class Helper {}
      export default class Foo {}
    `,
    "class Foo {}\nexport { Foo }",
    // No exported class at all (the file presents an object).
    "class Helper {}\nexport default { value: 1 }"
  ],
  invalid: [
    {
      code: "export default class A {}\nexport class B {}",
      errors: [ { messageId: "extraExportedClass", data: { name: "B" } } ]
    },
    {
      code: "export class A {}\nexport class B {}",
      errors: [ { messageId: "extraExportedClass", data: { name: "B" } } ]
    },
    {
      code: "class A {}\nclass B {}\nexport { A, B }",
      errors: [ { messageId: "extraExportedClass", data: { name: "B" } } ]
    }
  ]
})
