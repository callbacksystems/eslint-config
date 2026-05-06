import { orderMembers } from "#order"

export default [
  ...orderMembers({
    files: [ "**/*.js" ],
    groups: [
      { name: "started", pattern: "^started$" },
      { name: "stopped", pattern: "^stopped$" }
    ],
    after: "disconnected-callback"
  })
]
