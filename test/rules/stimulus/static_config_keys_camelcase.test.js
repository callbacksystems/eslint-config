import rule from "#rules/stimulus/static_config_keys_camelcase"
import { dedent, tester } from "#support"

tester.run("stimulus/static-config-keys-camelcase", rule, {
  valid: [
    dedent`
      class Foo extends Controller {
        static targets = [ "input", "submitButton" ]
      }
    `,
    dedent`
      class Foo extends Controller {
        static values = { isOpen: Boolean, maxItems: Number }
      }
    `,
    dedent`
      class Foo extends Controller {
        static classes = [ "active", "loadingState" ]
      }
    `,
    dedent`
      class Foo extends Controller {
        static outlets = [ "modal", "user-status", "admin--user-status", "v2--user2-status3" ]
      }
    `,
    dedent`
      class Other {
        static targets = [ "snake_case", "kebab-case" ]
      }
    `,
    // Keys declared elsewhere are checked where they are declared.
    dedent`
      class Foo extends Controller {
        static targets = SHARED_TARGETS
      }
    `,
    "class Foo extends Controller { static values = { 1: Number, [dynamic]: String } }",
    "class Foo extends Controller { static [configName] = [ 'snake_case' ] }"
  ],
  invalid: [
    {
      code: dedent`
        class Foo extends Controller {
          static targets = [ "submit_button" ]
        }
      `,
      errors: [ { messageId: "notCamelCase" } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          static classes = [ "active-state" ]
        }
      `,
      errors: [ { messageId: "notCamelCase" } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          static values = { "max_items": Number }
        }
      `,
      errors: [ { messageId: "notCamelCase", data: { name: "max_items", owner: "values" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          static "values" = { "max-items": Number }
        }
      `,
      errors: [ { messageId: "notCamelCase", data: { name: "max-items", owner: "values" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          static ["targets"] = [ "line_item" ]
        }
      `,
      errors: [ { messageId: "notCamelCase", data: { name: "line_item", owner: "targets" } } ]
    },
    {
      code: "class Foo extends Controller { static [`targets`] = [ `line_item` ] }",
      errors: [ { messageId: "notCamelCase", data: { name: "line_item", owner: "targets" } } ]
    },
    {
      code: "const config = 'targets'; class Foo extends Controller { static [config] = [ 'line_item' ] }",
      errors: [ { messageId: "notCamelCase", data: { name: "line_item", owner: "targets" } } ]
    },
    {
      code: "const value = 'max-items'; class Foo extends Controller { static values = { [value]: Number } }",
      errors: [ { messageId: "notCamelCase", data: { name: "max-items", owner: "values" } } ]
    },
    {
      code: "class Foo extends Controller { static values = { [`max-items`]: Number } }",
      errors: [ { messageId: "notCamelCase", data: { name: "max-items", owner: "values" } } ]
    },
    {
      code: "class Foo extends Controller { static targets = [ 'fine' ]; static targets = [ 'bad_key' ] }",
      errors: [ { messageId: "notCamelCase", data: { name: "bad_key", owner: "targets" } } ]
    },
    {
      code: dedent`
        class Foo extends Controller {
          static outlets = [ "userStatus", "admin__user_status", "admin---user-status", "admin--" ]
        }
      `,
      errors: [
        { messageId: "invalidOutlet", data: { name: "userStatus" } },
        { messageId: "invalidOutlet", data: { name: "admin__user_status" } },
        { messageId: "invalidOutlet", data: { name: "admin---user-status" } },
        { messageId: "invalidOutlet", data: { name: "admin--" } }
      ]
    }
  ]
})
