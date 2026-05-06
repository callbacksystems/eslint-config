import rule from "#rules/prefer-getter-over-local"
import { tester } from "#test/support"

tester.run("prefer-getter-over-local", rule, {
  valid: [
    // Read once is unnecessary-local-variable's domain, not this rule's.
    "class C { m() { const user = findUser(); return user.name } }",
    // Outside a class there is no getter to extract to.
    "function f() { const user = findUser(); return user.name + user.id }",
    // Name does not match the finder, so it is a real transformation.
    "class C { m() { const admin = findUser(); return admin.name + admin.id } }",
    // Not a finder call.
    "class C { m() { const total = compute(); return total + total } }",
    // Same-name member alias, but read once is unnecessary-local-variable's domain.
    "class C { m() { const account = this.user.account; return account.id } }",
    // Same-name member alias whose receiver is not `this`: no getter can hold it.
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
    // Aliasing a `this`-based member of the same name, reused.
    {
      code: "class C { m() { const account = this.user.account; return account.id + account.name } }",
      errors: [ { messageId: "preferGetter", data: { name: "account" } } ]
    }
  ]
})
