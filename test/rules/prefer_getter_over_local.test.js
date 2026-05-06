import rule from "#rules/prefer_getter_over_local"
import { tester } from "#support"

tester.run("prefer-getter-over-local", rule, {
  valid: [
    // Read once is unnecessary-local-variable's domain, not this rule's.
    "class C { m() { const user = findUser(); return user.name } }",
    "function f() { const user = findUser(); return user.name + user.id }",
    "class C { m() { const admin = findUser(); return admin.name + admin.id } }",
    "class C { m() { const total = compute(); return total + total } }",
    "class C { m() { const account = this.user.account; return account.id } }",
    "class C { m() { const account = user.account; return account.id + account.name } }"
  ],
  invalid: [
    {
      code: "class C { m() { const user = findUser(); return user.name + user.id } }",
      errors: [ { messageId: "preferGetter", data: { name: "user" } } ]
    },
    {
      code: "class C { m() { const user = User.find(this.id); log(user); return user.name } }",
      errors: [ { messageId: "preferGetter", data: { name: "user" } } ]
    },
    {
      code: "class C { m() { const config = getConfig(); return config.a + config.b } }",
      errors: [ { messageId: "preferGetter", data: { name: "config" } } ]
    },
    {
      code: "class C { m() { const account = this.user.account; return account.id + account.name } }",
      errors: [ { messageId: "preferGetter", data: { name: "account" } } ]
    }
  ]
})
