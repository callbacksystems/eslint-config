import rule from "#rules/stimulus/controller_shape"
import { dedent, tester } from "#support"

tester.run("stimulus/controller-shape", rule, {
  valid: [
    // Statics, fields and private members are perfectionist's to place.
    dedent`
      export default class extends Controller {
        static get shouldLoad() {
          return true
        }

        static targets = [ "item" ]

        #timer = null

        connect() {
          this.load()
        }

        #cleanup() {}
      }
    `,
    dedent`
      export default class extends Controller {
        select() {
          this.selected = 1
        }

        get selected() {
          return this.value
        }

        set selected(value) {
          this.value = value
        }
      }
    `,
    dedent`
      class Other extends Whatever {
        method() {}
        connect() {}
      }
    `,
    dedent`
      class C extends Controller {
        static targets = [ "item", "panel" ]
        static values = { open: Boolean }
        static outlets = [ "modal" ]

        itemTargetConnected() {}

        itemTargetDisconnected() {}

        panelTargetConnected() {}

        openValueChanged() {}

        modalOutletConnected() {}

        modalOutletDisconnected() {}
      }
    `,
    // A callback the statics never mention keeps its place after the declared ones.
    dedent`
      class C extends Controller {
        static targets = [ "item" ]

        itemTargetConnected() {}

        panelTargetConnected() {}
      }
    `,
    // A constructor is perfectionist's to place too.
    dedent`
      class C extends Controller {
        constructor(...args) {
          super(...args)
        }

        connect() {}

        toggle() {}
      }
    `,
    dedent`
      class Foo extends Controller {
        static targets = [ "input" ]
        static values = { open: Boolean }
        #timer = null
        connect() {}
        inputTargetConnected() {}
        openValueChanged() {}
        submit() {}
        get isOpen() {}
        #cleanup() {}
      }
    `,
    dedent`
      class Bar extends Controller {
        static targets = [ "x" ]
        connect() {}
        click() {}
      }
    `
  ],
  invalid: [
    {
      code: dedent`
        class C extends Controller {
          static targets = [ "item", "panel" ]

          panelTargetConnected() {}

          itemTargetConnected() {}
        }
      `,
      output: dedent`
        class C extends Controller {
          static targets = [ "item", "panel" ]

          itemTargetConnected() {}

          panelTargetConnected() {}
        }
      `,
      errors: [ {
        messageId: "callbackOutOfOrder",
        data: { name: "itemTargetConnected", before: "panelTargetConnected" }
      } ]
    },
    {
      code: dedent`
        class C extends Controller {
          static targets = [ "item", "panel" ]

          itemTargetDisconnected() {}

          itemTargetConnected() {}

          panelTargetConnected() {}
        }
      `,
      output: dedent`
        class C extends Controller {
          static targets = [ "item", "panel" ]

          itemTargetConnected() {}

          itemTargetDisconnected() {}

          panelTargetConnected() {}
        }
      `,
      errors: [ {
        messageId: "callbackOutOfOrder",
        data: { name: "itemTargetConnected", before: "itemTargetDisconnected" }
      } ]
    },
    {
      code: dedent`
        class C extends Controller {
          static targets = [ "item" ]
          static outlets = [ "modal" ]

          modalOutletConnected() {}

          itemTargetConnected() {}
        }
      `,
      output: dedent`
        class C extends Controller {
          static targets = [ "item" ]
          static outlets = [ "modal" ]

          itemTargetConnected() {}

          modalOutletConnected() {}
        }
      `,
      errors: [ {
        messageId: "callbackOutOfOrder",
        data: { name: "itemTargetConnected", before: "modalOutletConnected" }
      } ]
    },
    {
      code: dedent`
        class Bad extends Controller {
          submit() {}
          connect() {}
        }
      `,
      output: dedent`
        class Bad extends Controller {
          connect() {}
          submit() {}
        }
      `,
      errors: [ { messageId: "outOfOrder" } ]
    },
    {
      code: dedent`
        class Bad extends Controller {
          // submits the form
          submit() {}
          // wires up listeners
          connect() {}
        }
      `,
      output: dedent`
        class Bad extends Controller {
          // wires up listeners
          connect() {}
          // submits the form
          submit() {}
        }
      `,
      errors: [ { messageId: "outOfOrder" } ]
    }
  ]
})
