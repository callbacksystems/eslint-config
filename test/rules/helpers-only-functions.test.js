import rule from "#rules/helpers-only-functions"
import { tester } from "#test/support"

tester.run("helpers-only-functions", rule, {
  valid: [
    { code: "export function format() {}", filename: "/project/app/javascript/helpers/format.js" },
    { code: "export const format = () => {}", filename: "/project/app/javascript/helpers/sub/nested.js" },
    { code: "export function fmt() {}", filename: "/project/app/javascript/form_helpers.js" },
    { code: "export function fmt() {}", filename: "/project/app/javascript/string-helpers.js" },
    { code: "export function fmt() {}", filename: "/project/app/javascript/helpers.js" },
    {
      code: "const PI = 3.14; export function area(r) { return PI * r * r }",
      filename: "/project/app/javascript/helpers/math.js"
    },
    // Outside helpers/, anything goes.
    { code: "export default class Foo {}", filename: "/project/app/javascript/controllers/foo_controller.js" },
    // Filename contains "helpers" but not at boundary — not a helpers file.
    { code: "export default class Myhelpers {}", filename: "/project/app/javascript/myhelpers.js" }
  ],
  invalid: [
    {
      code: "export default function format() {}",
      filename: "/project/app/javascript/helpers/format.js",
      errors: [ { messageId: "noDefault" } ]
    },
    {
      code: "export class Foo {}",
      filename: "/project/app/javascript/form_helpers.js",
      errors: [ { messageId: "noClass" } ]
    },
    {
      code: "let counter = 0",
      filename: "/project/app/javascript/helpers/state.js",
      errors: [ { messageId: "noMutableState" } ]
    },
    {
      code: "export const TIMEOUT_MS = 5000",
      filename: "/project/app/javascript/helpers/config.js",
      errors: [ { messageId: "nonFunctionExport" } ]
    },
    {
      code: "export const ITEMS = [1, 2, 3]",
      filename: "/project/app/javascript/dom_helpers.js",
      errors: [ { messageId: "nonFunctionExport" } ]
    }
  ]
})
