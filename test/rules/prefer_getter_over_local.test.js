import rule from "#rules/prefer_getter_over_local"
import { dedent, tester } from "#support"

tester.run("prefer-getter-over-local", rule, {
  valid: [
    // Read once is unnecessary-local-variable's domain, not this rule's.
    "class C { m() { const user = findUser(); return user.name } }",
    "function f() { const user = findUser(); return user.name + user.id }",
    "class C { m() { const admin = findUser(); return admin.name + admin.id } }",
    "class C { m() { const total = compute(); return total + total } }",
    "class C { m() { const account = this.user.account; return account.id } }",
    "class C { m() { const account = user.account; return account.id + account.name } }",
    "class C { m() { const account = this.account; return account.id + account.name } }",
    "class C { m() { let user = findUser(); user = replacement; return user.name + user.id } }",
    "class C { m() { const user = User[find](this.id); return user.name + user.id } }",
    "class C { #find() {} m() { const user = User.#find(this.id); return user.name + user.id } }",
    "class C { m() { const account = this.user[key]; return account.id + account.name } }",
    "class C { get user() { return this.currentUser } m() { const user = findUser(); return user.name + user.id } }",
    "class C { user = null; m() { const user = findUser(); return user.name + user.id } }",
    "class C { static user() {} static m() { const user = findUser(); return user.name + user.id } }",
    "class C { [\"user\"]() {} m() { const user = findUser(); return user.name + user.id } }",
    "class C { m() { const constructor = findConstructor(); return constructor.name + constructor.id } }",
    "class C { static m() { const prototype = findPrototype(); return prototype.name + prototype.id } }",
    'const userKey = "user"; class C { [userKey]() {} m() { const user = findUser(); '
    + "return user.id + user.name } }",
    'const actual = "user"; const userKey = actual; class C { [userKey]() {} '
    + "m() { const user = findUser(); return user.id + user.name } }",
    "class C { m(userId) { const user = findUser(userId); return user.name + user.id } }",
    "class C { m() { const user = findUser(arguments[0]); return user.name + user.id } }",
    "class C { constructor(userId) { const user = findUser(new.target, userId); return user.name + user.id } }",
    "class C { m() { let id = this.id; const user = findUser(id); return user.name + user.id } }",
    "class C { async m() { const user = findUser(await id()); return user.name + user.id } }",
    'class C { m() { const user = findUser(); eval("user = replacement"); return user.name + user.id } }',
    'class C { m() { const user = findUser(); eval("use(user)"); return user.name + user.id } }'
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
    },
    {
      code: "class C { m() { const user = User[\"find\"](this.id); return user.name + user.id } }",
      errors: [ { messageId: "preferGetter", data: { name: "user" } } ]
    },
    {
      code: "class C { m() { const account = this.user[`account`]; return account.id + account.name } }",
      errors: [ { messageId: "preferGetter", data: { name: "account" } } ]
    },
    {
      code: "class C { m() { const user = findUser(async () => await remote()); return user.id + user.name } }",
      errors: [ { messageId: "preferGetter", data: { name: "user" } } ]
    },
    {
      code: "class C { static user = null; m() { const user = findUser(); return user.name + user.id } }",
      errors: [ { messageId: "preferGetter", data: { name: "user" } } ]
    },
    {
      code: "class C { #user = null; m() { const user = findUser(); return user.name + user.id } }",
      errors: [ { messageId: "preferGetter", data: { name: "user" } } ]
    },
    {
      code: "class C { [userKey] = null; m() { const user = findUser(); return user.name + user.id } }",
      errors: [ { messageId: "preferGetter", data: { name: "user" } } ]
    },
    {
      code: "class C { set user(value) {} m() { const user = findUser(); return user.name + user.id } }",
      errors: [ { messageId: "preferGetter", data: { name: "user" } } ]
    },
    {
      code: dedent`
        class C {
          user = null
          m() { const user = findUser(); return user.id + user.name }
          n() { const account = findAccount(); return account.id + account.name }
        }
      `,
      errors: [ { messageId: "preferGetter", data: { name: "account" } } ]
    },
    {
      name: "checks ownership only for method-only syntax in a deep initializer",
      code: deepFinderInitializerAt(300),
      errors: [ { messageId: "preferGetter", data: { name: "user" } } ]
    }
  ]
})

function deepFinderInitializerAt(depth) {
  return `class C { m() { const user = findUser(${"[".repeat(depth)}globalValue${"]".repeat(depth)}); `
    + "return user.name + user.id } }"
}
