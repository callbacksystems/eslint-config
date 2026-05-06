import rule from "#rules/class_matches_file"
import { tester } from "#support"

tester.run("class-matches-file", rule, {
  valid: [
    { code: "export default class User {}", filename: "app/models/user.js" },
    { code: "export class CalleeResolver {}", filename: "src/helpers/callee_resolver.js" },
    { code: "export default class BillingInvoice {}", filename: "app/models/billing/invoice.js" },
    { code: "export default class Invoice {}", filename: "app/models/billing/invoice.js" },
    { code: "export default class Button {}", filename: "app/components/Button/index.js" },
    { code: "export class NativeAction {}", filename: "src/components/native_action.ios.jsx" },
    { code: "export class NativeAction {}", filename: "src/components/native_action.android.jsx" },
    { code: "export default class Button {}", filename: "app/components/button/index.web.js" },
    { code: "export default class {}", filename: "app/models/user.js" },
    { code: "export function user() {}", filename: "app/models/session.js" },
    { code: "export const USER = 1", filename: "app/models/session.js" },
    { code: "class User {}", filename: "app/models/session.js" },
    { code: "class Invoice {}\nexport { Invoice as Charge }", filename: "app/models/invoice.js" },
    { code: "export class Account {}" }
  ],
  invalid: [
    {
      code: "export default class Charge {}",
      filename: "app/models/billing/invoice.js",
      errors: [ { messageId: "classFileMismatch", data: { name: "Charge", file: "invoice" } } ]
    },
    {
      code: "export class UserSession {}",
      filename: "app/models/account.js",
      errors: [ { messageId: "classFileMismatch", data: { name: "UserSession", file: "account" } } ]
    },
    {
      code: "class Invoice {}\nexport { Invoice }",
      filename: "app/models/charge.js",
      errors: [ { messageId: "classFileMismatch", data: { name: "Invoice", file: "charge" } } ]
    },
    {
      code: "export default class Session {}",
      filename: "app/models/user/index.js",
      errors: [ { messageId: "classFileMismatch", data: { name: "Session", file: "user" } } ]
    },
    {
      code: "export class Thing {}",
      filename: "src/components/native_action.ios.jsx",
      errors: [ { messageId: "classFileMismatch", data: { name: "Thing", file: "native_action" } } ]
    }
  ]
})
