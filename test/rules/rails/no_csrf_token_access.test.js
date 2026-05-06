import rule from "#rules/rails/no_csrf_token_access"
import { dedent, tester } from "#support"

const ADVERSARIAL_SELECTOR = `document.querySelector(${JSON.stringify("meta:not( ".repeat(800))})`
const UNRELATED_ADVERSARIAL_TEXT = `const text = ${JSON.stringify("meta:not( ".repeat(800))}`
const DEEPLY_NESTED_SELECTOR = `document.querySelector(${JSON.stringify(
  `${":is(".repeat(5_000)}meta[name="csrf-token"]${")".repeat(5_000)}`
)})`
const HEADER_LOOKUP_STRESS_SIZE = 1_000
const HEADER_LOOKUP_STRESS_PROPERTIES = Array.from({ length: HEADER_LOOKUP_STRESS_SIZE },
  (_, index) => `value${index}: ${index}`).join(", ")
const HEADER_LOOKUP_STRESS = [
  `const options = { headers: {}, ${HEADER_LOOKUP_STRESS_PROPERTIES} }`,
  ...Array.from({ length: HEADER_LOOKUP_STRESS_SIZE }, (_, index) => `options.headers["X-Trace-${index}"] = token`),
  "fetch(url, options)"
].join("\n")
const HEADER_HELPER_CHAIN_SIZE = 1_000
const HEADER_HELPER_CHAIN = [
  "const headers = {}",
  "function addHeader0(value) { value['X-CSRF-Token'] = token }",
  ...Array.from({ length: HEADER_HELPER_CHAIN_SIZE }, (_value, index) =>
    `function addHeader${index + 1}(value) { addHeader${index}(value) }`),
  `addHeader${HEADER_HELPER_CHAIN_SIZE}(headers)`,
  "fetch(url, { headers })"
].join("\n")
const HEADER_HELPER_WIDTH = 1_000
const WIDE_HEADER_HELPER = [
  "function assign(value) {",
  ...Array.from({ length: HEADER_HELPER_WIDTH }, (_value, index) => `value.trace${index} = ${index}`),
  "value['X-CSRF-Token'] = token",
  "}",
  "const headers = {}",
  "assign(headers)",
  "fetch(url, { headers })"
].join("\n")
const STANDARD_WRITE_STRESS_SIZE = 1_000
const STANDARD_WRITE_STRESS = [
  "const options = { headers: { 'X-CSRF-Token': token } }",
  ...Array.from({ length: STANDARD_WRITE_STRESS_SIZE }, (_value, index) =>
    `Object.assign(options, { trace${index}: ${index} })`),
  "Object.assign(options, { headers: {} })",
  "fetch(url, options)"
].join("\n")
const STABLE_SPREAD_READS = [
  "const defaults = { headers: { 'X-CSRF-Token': token } }",
  ...Array.from({ length: 1_000 }, () => "consume({ ...defaults })"),
  "fetch(url, { ...defaults })"
].join("\n")

tester.run("rails/no-csrf-token-access", rule, {
  valid: [
    dedent`document.querySelector(".menu")`,
    dedent`const headers = { "Content-Type": "application/json" }`,
    dedent`fetch("/posts", { method: "post" })`,
    dedent`const name = "csrf"`,
    dedent`const label = "X-CSRF-Token"`,
    dedent`log('meta[name="csrf-token"]')`,
    dedent`document.querySelector(".safe", 'meta[name="csrf-token"]')`,
    dedent`const metadata = { tokenName: "X-CSRF-Token" }`,
    dedent`cache.set("X-CSRF-Token", token)`,
    dedent`document.querySelector('meta[data-label="csrf-token"]')`,
    dedent`document.querySelector('meta [name="csrf-token"]')`,
    dedent`document.querySelector('meta||[name="csrf-token"]')`,
    dedent`document.querySelector('metadata[name="csrf-token"]')`,
    dedent`document.querySelector('meta[name~="csrf-token"]')`,
    dedent`document.querySelector('meta[name="csrf-token" x]')`,
    dedent`document.querySelector('meta[name="CSRF-TOKEN"]')`,
    dedent`document.querySelector('meta[name="CSRF-TOKEN" s]')`,
    dedent`document.querySelector('meta[name="csrf-toKen" i]')`,
    dedent`document.querySelector('meta[name="csrf-token"] + .notice')`,
    dedent`document.querySelector(':is(meta, [name="csrf-token"])')`,
    dedent`document.querySelector('div:not(meta[name="csrf-token"])')`,
    dedent`document.querySelector('section:has(meta[name="csrf-token"])')`,
    dedent`document.querySelector('meta|section[name="csrf-token"]')`,
    dedent`document.querySelector('implicit|meta[name="csrf-token"]')`,
    dedent`document.querySelector('|meta[name="csrf-token"]')`,
    dedent`document.querySelector('*|meta[rails|name="csrf-token"]')`,
    dedent`document.querySelector('*|meta[none|name="csrf-token"]')`,
    dedent`document.querySelector('meta[averyverylongnamespace|name="csrf-token"]')`,
    dedent`document.querySelector('div[name=x][title=" meta[name=csrf-token]"]')`,
    dedent`document.querySelector('div/* meta[name="csrf-token"] */.safe')`,
    dedent`document.querySelector('meta[name="csrf-token"]::before')`,
    dedent`document.querySelector('meta[name="csrf-token"]:before')`,
    dedent`document.querySelector(':is(meta[name="csrf-token"]::before, div)')`,
    dedent`document.querySelector('meta[name="csrf-token"]:is()')`,
    dedent`document.querySelector(':nth-child(1 of meta[name="csrf-token"]) + div')`,
    dedent`document.querySelector('meta:nth-child(1 of [name="other"])')`,
    dedent`document.querySelector(':nth-child(1 of div[name="csrf-token"])')`,
    String.raw`document.querySelector('div.meta\\[name\\=csrf-token\\]')`,
    { name: "scans an adversarial selector in linear time", code: ADVERSARIAL_SELECTOR },
    { name: "does not scan unrelated adversarial text as CSS", code: UNRELATED_ADVERSARIAL_TEXT },
    { name: "indexes repeated header object lookups", code: HEADER_LOOKUP_STRESS },
    dedent`let selector = 'meta[name="csrf-token"]'; selector = ".safe"; document.querySelector(selector)`,
    dedent`const HEADER = "X-CSRF-Token"; const headers = { HEADER }`,
    dedent`headers.set("X-CSRF-ToKen", token)`,
    dedent`headers.set("X-CSRF-Token", token)`,
    dedent`requestHeaders.append("X-XSRF-Token", token)`,
    dedent`request.setRequestHeader("X-CSRF-Token", token)`,
    dedent`const headers = { "X-XSRF-Token": token }`,
    dedent`headers["X-CSRF-Token"] = token`,
    dedent`({ token: headers["X-CSRF-Token"] } = source)`,
    dedent`for (headers["X-CSRF-Token"] of values) consume(headers)`,
    dedent`request.headers["X-XSRF-Token"] = token`,
    dedent`const requestHeaders = { "X-CSRF-Token": token }`,
    dedent`fetch(url, { requestHeaders: { "X-CSRF-Token": token } })`,
    "headers[`set`](`X-CSRF-Token`, token)",
    dedent`const header = "X-CSRF-Token"; headers.set(header, token)`,
    dedent`const header = "X-CSRF-Token"; const headers = { [header]: token }`,
    dedent`function send(fetch) { fetch(url, { headers: { "X-CSRF-Token": token } }) }`,
    dedent`function build(Request) { return new Request(url, { headers: { "X-CSRF-Token": token } }) }`,
    dedent`
      function build(Request) {
            const NativeRequest = Request
            return new NativeRequest(url, { headers: { "X-CSRF-Token": token } })
          }
    `,
    "function send(XMLHttpRequest) { const request = new XMLHttpRequest(); "
    + "request.setRequestHeader(\"X-CSRF-Token\", token) }",
    "function send(XMLHttpRequest) { const XHR = XMLHttpRequest; const request = new XHR(); "
    + "request.setRequestHeader(\"X-CSRF-Token\", token) }",
    dedent`fetch = localFetch; fetch(url, { headers: { "X-CSRF-Token": token } })`,
    dedent`Request = LocalRequest; new Request(url, { headers: { "X-CSRF-Token": token } })`,
    "XMLHttpRequest = LocalXHR; const request = new XMLHttpRequest(); "
    + "request.setRequestHeader(\"X-CSRF-Token\", token)",
    dedent`Headers = class FakeHeaders {}; new Headers({ "X-CSRF-Token": token })`,
    {
      name: "does not trust an overwritten own Headers method",
      code: dedent`
        const headers = new Headers()
        headers.set = custom
        headers.set("X-CSRF-Token", token)
      `
    },
    {
      name: "does not trust an overwritten Headers prototype method",
      code: dedent`
        Headers.prototype.set = custom
        new Headers().set("X-CSRF-Token", token)
      `
    },
    {
      name: "does not trust an overwritten own XMLHttpRequest method",
      code: dedent`
        const request = new XMLHttpRequest()
        request.setRequestHeader = custom
        request.setRequestHeader("X-CSRF-Token", token)
      `
    },
    {
      name: "does not trust an overwritten XMLHttpRequest prototype method",
      code: dedent`
        XMLHttpRequest.prototype.setRequestHeader = custom
        new XMLHttpRequest().setRequestHeader("X-CSRF-Token", token)
      `
    },
    {
      name: "does not trust a Headers helper parameter after its method is overwritten",
      code: dedent`
        function assign(value) {
          value.set = custom
          value.set("X-CSRF-Token", token)
        }
        assign(new Headers())
      `
    },
    dedent`globalThis.fetch = localFetch; fetch(url, { headers: { "X-CSRF-Token": token } })`,
    dedent`globalThis.Request = LocalRequest; new Request(url, { headers: { "X-CSRF-Token": token } })`,
    "globalThis.XMLHttpRequest = LocalXHR; const request = new XMLHttpRequest(); "
    + "request.setRequestHeader(\"X-CSRF-Token\", token)",
    dedent`globalThis.Headers = FakeHeaders; new Headers({ "X-CSRF-Token": token })`,
    dedent`globalThis.Headers &&= FakeHeaders; new Headers({ "X-CSRF-Token": token })`,
    dedent`function build(Headers) { return new Headers({ "X-CSRF-Token": token }) }`,
    dedent`function build(Headers) { return new Headers([[ "X-CSRF-Token", token ]]) }`,
    dedent`function build(Headers) { return new Headers().set("X-CSRF-Token", token) }`,
    dedent`function build(Headers) { const h = new Headers(); h.set("X-CSRF-Token", token) }`,
    dedent`Headers = FakeHeaders; const h = new Headers(); h.set("X-CSRF-Token", token)`,
    dedent`const h = makeHeaders(); h.set("X-CSRF-Token", token)`,
    dedent`new Headers().set("Accept", "application/json").set("X-CSRF-Token", token)`,
    dedent`const h = new Headers(); h["X-CSRF-Token"] = token`,
    dedent`
      let headers = {}
            headers = replacement
            headers["X-CSRF-Token"] = token
            fetch(url, { headers })
    `,
    dedent`
      const headers = {}
            let alias = headers
            alias = replacement
            alias["X-CSRF-Token"] = token
            fetch(url, { headers })
    `,
    dedent`
      let options = { headers: {} }
            options = replacement
            options.headers["X-CSRF-Token"] = token
            fetch(url, options)
    `,
    dedent`
      const options = { headers: {}, ...defaults }
            options.headers["X-CSRF-Token"] = token
            fetch(url, options)
    `,
    dedent`fetch(url, { headers: { "X-CSRF-Token": token }, ...defaults })`,
    dedent`fetch(url, { headers: { "X-CSRF-Token": token }, headers: {} })`,
    dedent`
      const option = dynamicOption()
            fetch(url, { headers: { "X-CSRF-Token": token }, [option]: value })
    `,
    dedent`
      const options = { headers: {} }
            options.headers = replacement
            options.headers["X-CSRF-Token"] = token
            fetch(url, options)
    `,
    dedent`
      const options = { headers: { "X-CSRF-Token": token } }
            options.headers = replacement
            fetch(url, options)
    `,
    dedent`
      const options = { headers: { "X-CSRF-Token": token } }
            if (true) options.headers = replacement
            fetch(url, options)
    `,
    dedent`
      const headers = {}
            function assign(headers) { headers["X-CSRF-Token"] = token }
            fetch(url, { headers })
    `,
    dedent`
      function assign(value) { value = {}; value["X-CSRF-Token"] = token }
            const headers = {}
            assign(headers)
            fetch(url, { headers })
    `,
    dedent`
      function assign(value) {
        while (condition) {
          value["X-CSRF-Token"] = token
          value = replacement
        }
      }
      const headers = {}
      assign(headers)
      fetch(url, { headers })
    `,
    dedent`
      function assign(value) {
        register(() => { value = replacement })
        value["X-CSRF-Token"] = token
      }
      const headers = {}
      assign(headers)
      fetch(url, { headers })
    `,
    {
      code: dedent`
        function assign(value) {
          eval("value = replacement")
          value["X-CSRF-Token"] = token
        }
        const headers = {}
        assign(headers)
        fetch(url, { headers })
      `,
      languageOptions: { sourceType: "script" }
    },
    dedent`
      function* assign(value) { value["X-CSRF-Token"] = token }
      const headers = {}
      assign(headers)
      fetch(url, { headers })
    `,
    dedent`
      function assign(value) { value["X-CSRF-Token"] = token }
            const headers = {}
            assign(...[ headers ])
            fetch(url, { headers })
    `,
    dedent`
      function assign(value) { value["X-CSRF-Token"] = token }
            const headers = {}
            if (false) assign(headers)
            fetch(url, { headers })
    `,
    dedent`
      function assign(value) { value["X-CSRF-Token"] = token }
            assign(headers)
            var headers = {}
            fetch(url, { headers })
    `,
    dedent`
      function assign(value) { value["X-CSRF-Token"] = token }
            if (condition) var headers = {}
            assign(headers)
            fetch(url, { headers })
    `,
    dedent`
      function first(value) { second(value) }
            function second(value) { first(value); value["X-CSRF-Token"] = token }
    `,
    dedent`
      function assign(value) { value["X-CSRF-Token"] = token }
            const headers = {}
            register(assign, headers)
            fetch(url, { headers })
    `,
    {
      code: dedent`
        const NativeFetch = fetch
                function send() {
                  "use strict"
                  let headers = {}
                  eval("headers = replacement")
                  headers["X-CSRF-Token"] = token
                  NativeFetch(url, { headers })
                }
      `,
      languageOptions: { sourceType: "script" }
    },
    dedent`
      const { headers } = options
            headers["X-CSRF-Token"] = token
            fetch(url, { headers })
    `,
    dedent`const headers = {}; delete headers["X-CSRF-Token"]; fetch(url, { headers })`,
    dedent`
      const options = { headers: { "X-CSRF-Token": token } }
      options.headers &&= {}
      fetch(url, options)
    `,
    dedent`request.headers.set("X-CSRF-Token", token)`,
    dedent`function build(Request) { new Request(url).headers.set("X-CSRF-Token", token) }`,
    dedent`let request = new Request(url); request = replacement; request.headers.set("X-CSRF-Token", token)`,
    dedent`delete headers["X-CSRF-Token"]`,
    dedent`const { headers: { "X-CSRF-Token": token } } = options`,
    dedent`class View { #querySelector(value) {} run() { this.#querySelector('meta[name="csrf-token"]') } }`,
    dedent`class Request { #set(value) {} run() { headers.#set("X-CSRF-Token", token) } }`,
    dedent`class Request { #headers = store; run() { this.#headers.set("X-CSRF-Token", token) } }`,
    {
      name: "recognizes an Object.assign replacement before fetch",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        Object.assign(options, { headers: {} })
        fetch(url, options)
      `
    },
    {
      name: "does not attach headers written after fetch",
      code: dedent`
        const options = {}
        const headers = { "X-CSRF-Token": token }
        fetch(url, options)
        options.headers = headers
      `
    },
    {
      name: "does not attach headers through a conditional write",
      code: dedent`
        const options = {}
        const headers = { "X-CSRF-Token": token }
        if (condition) options.headers = headers
        fetch(url, options)
      `
    },
    {
      name: "does not guess that a dynamic property write attaches headers",
      code: dedent`
        const options = {}
        const headers = { "X-CSRF-Token": token }
        options[property] = headers
        fetch(url, options)
      `
    },
    {
      name: "does not guess that a dynamic Object.assign key attaches headers",
      code: dedent`
        const options = {}
        const headers = { "X-CSRF-Token": token }
        Object.assign(options, { [property]: headers })
        fetch(url, options)
      `
    },
    {
      name: "does not assume a stable spread source is deeply immutable",
      code: dedent`
        const defaults = { headers: { "X-CSRF-Token": token } }
        defaults.headers = {}
        fetch(url, { ...defaults })
      `
    },
    {
      name: "does not assume a stable Object.assign source is deeply immutable",
      code: dedent`
        const options = {}
        const patch = { headers: { "X-CSRF-Token": token } }
        patch.headers = {}
        Object.assign(options, patch)
        fetch(url, options)
      `
    },
    {
      name: "does not assume a stable property descriptor is deeply immutable",
      code: dedent`
        const options = {}
        const descriptor = { value: { "X-CSRF-Token": token } }
        descriptor.value = {}
        Object.defineProperty(options, "headers", descriptor)
        fetch(url, options)
      `
    },
    {
      name: "does not follow a header initializer through an unknown escape",
      code: dedent`
        const init = { "X-CSRF-Token": token }
        consume(init)
        new Headers(init)
      `
    },
    {
      name: "does not follow request options through an unknown escape",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        mutate(options)
        fetch(url, options)
      `
    },
    {
      name: "does not follow a local parameter alias through an unknown escape",
      code: dedent`
        function send(options) {
          const alias = options
          mutate(alias)
          fetch(url, alias)
        }
        send({ headers: { "X-CSRF-Token": token } })
      `
    },
    {
      name: "does not treat a spread that invokes an own getter as non-exposing",
      code: dedent`
        const options = {
          headers: { "X-CSRF-Token": token },
          get reset() {
            this.headers = {}
            return true
          }
        }
        consume({ ...options })
        fetch(url, options)
      `
    },
    {
      name: "does not follow a helper parameter through a spread that invokes an own getter",
      code: dedent`
        function send(options) {
          consume({ ...options })
          fetch(url, options)
        }
        send({
          headers: { "X-CSRF-Token": token },
          get reset() {
            this.headers = {}
            return true
          }
        })
      `
    },
    {
      name: "does not treat a fourth Object.assign source as a Reflect.set receiver",
      code: dedent`
        function send(options) {
          Object.assign({}, {}, {}, options)
          fetch(url, options)
        }
        send({
          headers: { "X-CSRF-Token": token },
          get reset() {
            this.headers = {}
            return true
          }
        })
      `
    },
    {
      name: "does not trust a shadowed Object mutator to preserve request options",
      code: dedent`
        function send(Object) {
          const options = { headers: { "X-CSRF-Token": token } }
          Object.assign(options, { headers: {} })
          fetch(url, options)
        }
      `
    },
    {
      name: "does not trust a reassigned mutator alias to preserve request options",
      code: dedent`
        let replace = Object.assign
        replace = customAssign
        const options = { headers: { "X-CSRF-Token": token } }
        replace(options, { headers: {} })
        fetch(url, options)
      `
    },
    {
      name: "does not trust a replaced call forwarder to preserve request options",
      code: dedent`
        Object.defineProperty.call = forward
        const options = { headers: { "X-CSRF-Token": token } }
        Object.defineProperty.call(null, options, "headers", { value: {} })
        fetch(url, options)
      `
    },
    {
      name: "does not trust a replaced apply forwarder to preserve request options",
      code: dedent`
        Object.defineProperty.apply = forward
        const options = { headers: { "X-CSRF-Token": token } }
        Object.defineProperty.apply(null, [ options, "headers", { value: {} } ])
        fetch(url, options)
      `
    },
    {
      name: "does not trust a shadowed Reflect.apply to preserve request options",
      code: dedent`
        function send(Reflect) {
          const options = { headers: { "X-CSRF-Token": token } }
          Reflect.apply(Object.defineProperty, null, [ options, "headers", { value: {} } ])
          fetch(url, options)
        }
      `
    },
    {
      name: "keeps the last Object.assign source",
      code: dedent`
        const options = {}
        const headers = { "X-CSRF-Token": token }
        Object.assign(options, { headers }, { headers: {} })
        fetch(url, options)
      `
    },
    {
      name: "follows stable Object.assign and target aliases",
      code: dedent`
        const replace = Object.assign
        const options = { headers: { "X-CSRF-Token": token } }
        const target = options
        replace(target, { headers: {} })
        fetch(url, options)
      `
    },
    {
      name: "recognizes an Object.defineProperty replacement before fetch",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        Object.defineProperty(options, "headers", { value: {} })
        fetch(url, options)
      `
    },
    {
      name: "recognizes a standard replacement forwarded through call",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        Object.defineProperty.call(null, options, "headers", { value: {} })
        fetch(url, options)
      `
    },
    {
      name: "recognizes a standard replacement forwarded through Reflect.apply",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        Reflect.apply(Object.defineProperty, null, [ options, "headers", { value: {} } ])
        fetch(url, options)
      `
    },
    {
      name: "recognizes an Object.defineProperties replacement before fetch",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        Object.defineProperties(options, { headers: { value: {} } })
        fetch(url, options)
      `
    },
    {
      name: "recognizes Reflect.set through a stable key",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        const key = "headers"
        Reflect.set(options, key, {})
        fetch(url, options)
      `
    },
    {
      name: "recognizes Reflect.defineProperty before fetch",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        Reflect.defineProperty(options, "headers", { value: {} })
        fetch(url, options)
      `
    },
    {
      name: "recognizes Reflect.deleteProperty before fetch",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        Reflect.deleteProperty(options, "headers")
        fetch(url, options)
      `
    },
    {
      name: "degrades conservatively for a dynamic Reflect key",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        Reflect.set(options, dynamicKey(), {})
        fetch(url, options)
      `
    },
    { name: "indexes standard property writes once", code: STANDARD_WRITE_STRESS }
  ],
  invalid: [
    { code: dedent`document.querySelector('meta[name="csrf-token"]')`, errors: [ { messageId: "metaTag" } ] },
    {
      code: dedent`document.head.querySelector("meta[name=csrf-token]").content`,
      errors: [ { messageId: "metaTag" } ]
    },
    { code: "document.querySelector(`head > meta.notice[name='csrf-token']`)", errors: [ { messageId: "metaTag" } ] },
    {
      code: dedent`document.querySelector('div/* decoy */ meta[name="csrf-token"]')`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: String.raw`document.querySelector('div[title="\\"meta[name=csrf-token]"] meta[name=csrf-token]')`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: dedent`document.querySelectorAll('main + META.notice[NAME="CSRF-TOKEN" i]')`,
      errors: [ { messageId: "metaTag" } ]
    },
    { code: dedent`document.querySelector('main > meta[name="CSRF-TOKEN" I]')`, errors: [ { messageId: "metaTag" } ] },
    { code: dedent`document.querySelector('meta[name="CSRF-TOKEN"i]')`, errors: [ { messageId: "metaTag" } ] },
    { code: dedent`document.querySelector('meta[name="CSRF-TOKEN"/**/i]')`, errors: [ { messageId: "metaTag" } ] },
    { code: dedent`document.querySelector('meta[name=CSRF-TOKEN/**/i]')`, errors: [ { messageId: "metaTag" } ] },
    {
      code: dedent`document.querySelector('meta/**/[/**/name/**/=/**/"csrf-token" i/**/]')`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: String.raw`document.querySelector('m\\65 ta[n\\61 me=csrf\\2d token]')`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: dedent`document.querySelector('meta:is(.form, .token)[name="csrf-token" s]')`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: dedent`document.querySelector(':is(meta[name="csrf-token"], .fallback)')`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: dedent`document.querySelector(':is(meta[name="csrf-token"]::before, meta[name="csrf-token"])')`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: dedent`document.querySelector('meta[name="csrf-token"]::before, meta[name="csrf-token"]')`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: dedent`document.querySelector(':nth-child(1 of meta[name="csrf-token"])')`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: dedent`document.querySelector('meta:nth-last-child(2n + 1 of [name=csrf-token])')`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: dedent`document.querySelector(':nth-child(odd/**/of/**/meta[name=csrf-token])')`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      name: "handles deeply nested selector lists without consuming the JavaScript call stack",
      code: DEEPLY_NESTED_SELECTOR,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: dedent`document.querySelector('meta:is([name="csrf-token"], .fallback)')`,
      errors: [ { messageId: "metaTag" } ]
    },
    { code: dedent`document.querySelector(':where(meta)[name="csrf-token"]')`, errors: [ { messageId: "metaTag" } ] },
    {
      code: dedent`document.querySelector('.token:is(meta[name="csrf-token"])')`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: String.raw`document.querySelector('meta:not([title=")"]/* ) */.x\\))[name=csrf-token]')`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: dedent`document.querySelector('form, head ~ meta[name=csrf-token]')`,
      errors: [ { messageId: "metaTag" } ]
    },
    { code: dedent`document.querySelector('*|meta[*|name=csrf-token]')`, errors: [ { messageId: "metaTag" } ] },
    { code: dedent`document.querySelector('*|meta[|name=csrf-token]')`, errors: [ { messageId: "metaTag" } ] },
    {
      code: dedent`const target = 'meta[name="csrf-token"]'; const selector = target; document.querySelector(selector)`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: dedent`let selector = 'meta[name="csrf-token"]'; document.querySelector(selector)`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: dedent`var selector = 'meta[name="csrf-token"]'; document.querySelector(selector)`,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: dedent`
        let selector = 'meta[name="csrf-token"]'
                document.querySelector(selector)
                selector = ".safe"
      `,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: dedent`const request = new XMLHttpRequest(); request.setRequestHeader("X-CSRF-Token", token)`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "keeps an XMLHttpRequest captured before the global is replaced",
      code: dedent`
        const NativeXHR = XMLHttpRequest
        globalThis.XMLHttpRequest = LocalXHR
        const request = new NativeXHR()
        request.setRequestHeader("X-CSRF-Token", token)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        let request = new XMLHttpRequest()
                request.setRequestHeader("X-CSRF-Token", token)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        var request = new XMLHttpRequest()
                request.setRequestHeader("X-CSRF-Token", token)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const NativeXHR = XMLHttpRequest
                const request = new NativeXHR()
                request.setRequestHeader("X-CSRF-Token", token)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const method = "setRequestHeader"
                const request = new XMLHttpRequest()
                request[method]("X-CSRF-Token", token)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`fetch("/posts", { headers: { "X-CSRF-Token": token } })`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "keeps fetch captured before the global is replaced",
      code: dedent`
        const send = fetch
        globalThis.fetch = localFetch
        send(url, { headers: { "X-CSRF-Token": token } })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        fetch("/posts", { headers: { "X-CSRF-Token": token } })
                fetch = localFetch
      `,
      languageOptions: { sourceType: "script" },
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`fetch(url, { headers: {}, headers: { "X-CSRF-Token": token } })`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`fetch(url, { ...defaults, headers: { "X-CSRF-Token": token } })`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const option = dynamicOption()
                fetch(url, { [option]: value, headers: { "X-CSRF-Token": token } })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`new Headers({ "X-CSRF-Token": token })`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "keeps the native Headers identity through an OR assignment no-op",
      code: dedent`globalThis.Headers ||= FakeHeaders; new Headers({ "X-CSRF-Token": token })`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "keeps the native Headers identity through a nullish assignment no-op",
      code: dedent`globalThis.Headers ??= FakeHeaders; new Headers({ "X-CSRF-Token": token })`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "recognizes an explicit global Headers construction",
      code: dedent`new globalThis.Headers({ "X-CSRF-Token": token })`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "keeps Headers captured before the global is replaced",
      code: dedent`
        const NativeHeaders = Headers
        globalThis.Headers = FakeHeaders
        new NativeHeaders({ "X-CSRF-Token": token })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`new Request(url, { headers: { "X-CSRF-Token": token } })`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "keeps Request captured before the global is replaced",
      code: dedent`
        const NativeRequest = Request
        globalThis.Request = LocalRequest
        new NativeRequest(url, { headers: { "X-CSRF-Token": token } })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const NativeRequest = Request
                new NativeRequest(url, { headers: { "X-CSRF-Token": token } })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`const send = fetch; send(url, { headers: { "X-CSRF-Token": token } })`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`const NativeHeaders = Headers; new NativeHeaders({ "X-CSRF-Token": token })`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`new Headers().set("X-CSRF-Token", token)`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        let name = "X-CSRF-Token"
                new Headers().set(name, token)
                name = "Accept"
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const method = "set"
                new Headers()[method]("X-CSRF-Token", token)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`const h = new Headers(); h.set("X-CSRF-Token", token)`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        let headers = new Headers()
                headers.set("X-CSRF-Token", token)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        let headers = new Headers()
                headers.set("X-CSRF-Token", token)
                headers = replacement
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        var headers = new Headers()
                headers.set("X-CSRF-Token", token)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`const headers = new Headers(); const h = headers; h.set("X-CSRF-Token", token)`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`new Headers([[ "X-CSRF-Token", token ], [ "Accept", "application/json" ]])`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`fetch(url, { headers: [[ "X-CSRF-Token", token ]] })`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`new Request(url, { headers: [[ "X-XSRF-Token", token ]] })`,
      errors: [ { messageId: "header", data: { name: "X-XSRF-Token" } } ]
    },
    {
      code: dedent`
        const headers = { "X-CSRF-Token": token }
                fetch(url, { headers })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
                fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "keeps header evidence through a truthy OR assignment no-op",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        options.headers ||= {}
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "keeps header evidence through a non-nullish assignment no-op",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        options.headers ??= {}
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
                fetch(url, options)
                options.headers = replacement
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
                function replaceHeaders() { options.headers = replacement }
                fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
                if (false) options.headers = replacement
                fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
                if (shouldReplace) options.headers = replacement
                fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const init = { "X-CSRF-Token": token }
                new Headers(init)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const headers = {}
                headers["X-CSRF-Token"] = token
                fetch(url, { headers })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        let headers = {}
                headers["X-CSRF-Token"] = token
                fetch(url, { headers })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        var headers = {}
                headers["X-CSRF-Token"] = token
                fetch(url, { headers })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const headers = {}
                let alias = headers
                alias["X-CSRF-Token"] = token
                fetch(url, { headers })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const headers = {}
                const alias = headers
                const name = "X-XSRF-Token"
                alias[name] = token
                fetch(url, { headers })
      `,
      errors: [ { messageId: "header", data: { name: "X-XSRF-Token" } } ]
    },
    {
      code: dedent`
        const options = { headers: {} }
                options.headers["X-CSRF-Token"] = token
                fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows headers attached by direct assignment",
      code: dedent`
        const options = {}
        const headers = {}
        headers["X-CSRF-Token"] = token
        options.headers = headers
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows headers attached by Object.assign",
      code: dedent`
        const options = {}
        const headers = { "X-CSRF-Token": token }
        Object.assign(options, { headers })
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows headers through an exact request-options spread",
      code: dedent`
        fetch(url, { ...{ headers: { "X-CSRF-Token": token } } })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows an exact header-initializer spread",
      code: dedent`
        new Headers({ ...{ "X-CSRF-Token": token } })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows the effective unsafe value after a safe property",
      code: dedent`
        new Headers({ "X-CSRF-Token": "safe", ...{ "X-CSRF-Token": token } })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "reports only the effective direct header property",
      code: dedent`
        fetch(url, { headers: { ...{ "X-CSRF-Token": token }, "X-CSRF-Token": "safe" } })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "reports only the effective spread header property",
      code: dedent`
        new Headers({ "X-CSRF-Token": token, ...{ "X-CSRF-Token": "safe" } })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows an exact header-entry spread",
      code: dedent`
        new Headers([ ...[[ "X-CSRF-Token", token ]] ])
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows a single-use stable Object.assign source",
      code: dedent`
        const options = {}
        const headers = { "X-CSRF-Token": token }
        const patch = { headers }
        Object.assign(options, patch)
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows a stable spread source after unlimited non-exposing reads",
      code: STABLE_SPREAD_READS,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows an exact spread in an Object.assign source",
      code: dedent`
        const options = {}
        const headers = { "X-CSRF-Token": token }
        Object.assign(options, { ...{ headers } })
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows headers attached through Function.prototype.apply",
      code: dedent`
        const options = {}
        const headers = { "X-CSRF-Token": token }
        Object.assign.apply(null, [ options, { headers } ])
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows Reflect.set through Function.prototype.apply",
      code: dedent`
        const options = {}
        const headers = { "X-CSRF-Token": token }
        Reflect.set.apply(null, [ options, "headers", headers ])
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows Reflect.set when a mutable parameter is its exact receiver",
      code: dedent`
        function attach(options, headers) {
          Reflect.set(options, "headers", headers, options)
          fetch(url, options)
        }
        attach({}, { "X-CSRF-Token": token })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows a direct request-options parameter write in the consuming helper",
      code: dedent`
        function attach(options, headers) {
          options.headers = headers
          fetch(url, options)
        }
        attach({}, { "X-CSRF-Token": token })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows headers attached by Object.defineProperty",
      code: dedent`
        const options = {}
        const headers = { "X-CSRF-Token": token }
        Object.defineProperty(options, "headers", { value: headers })
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows a single-use stable property descriptor",
      code: dedent`
        const options = {}
        const headers = { "X-CSRF-Token": token }
        const descriptor = { value: headers }
        Object.defineProperty(options, "headers", descriptor)
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows an exact spread in a property descriptor",
      code: dedent`
        const options = {}
        const headers = { "X-CSRF-Token": token }
        Object.defineProperty(options, "headers", { ...{ value: headers } })
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows headers attached by Object.defineProperties",
      code: dedent`
        const options = {}
        Object.defineProperties(options, {
          headers: { value: { "X-CSRF-Token": token } }
        })
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows a single-use stable descriptor map",
      code: dedent`
        const options = {}
        const headers = { "X-CSRF-Token": token }
        const descriptors = { headers: { value: headers } }
        Object.defineProperties(options, descriptors)
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows a request header object through a local helper parameter",
      code: dedent`
        function assign(value) { value["X-CSRF-Token"] = token }
                const headers = {}
                assign(headers)
                fetch(url, { headers })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows a request header object through a confined helper alias",
      code: dedent`
        function assign(value) {
          const alias = value
          alias["X-CSRF-Token"] = token
        }
        const headers = {}
        assign(headers)
        fetch(url, { headers })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows a helper parameter before a later reassignment",
      code: dedent`
        function assign(value) {
          value["X-CSRF-Token"] = token
          value = replacement
        }
        const headers = {}
        assign(headers)
        fetch(url, { headers })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows a Headers receiver through a local helper parameter",
      code: dedent`
        function assign(value) { value.set("X-CSRF-Token", token) }
                const headers = new Headers()
                assign(headers)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows a Headers receiver through a local helper alias",
      code: dedent`
        function assign(value) {
          const alias = value
          alias.set("X-CSRF-Token", token)
        }
        assign(new Headers())
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows an XMLHttpRequest receiver through a local helper parameter",
      code: dedent`
        function assign(value) { value.setRequestHeader("X-CSRF-Token", token) }
                const request = new XMLHttpRequest()
                assign(request)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows request options into a local fetch wrapper",
      code: dedent`
        function send(options) { fetch(url, options) }
                send({ headers: { "X-CSRF-Token": token } })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows request options after a side-effect-free helper spread",
      code: dedent`
        function send(options) {
          consume({ ...options })
          fetch(url, options)
        }
        send({ headers: { "X-CSRF-Token": token } })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows request options through a confined wrapper alias",
      code: dedent`
        function send(options) {
          const alias = options
          fetch(url, alias)
        }
        send({ headers: { "X-CSRF-Token": token } })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "follows a deeply forwarded helper parameter iteratively",
      code: HEADER_HELPER_CHAIN,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "indexes a wide helper parameter once",
      code: WIDE_HEADER_HELPER,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        let options = { headers: {} }
                options.headers["X-CSRF-Token"] = token
                fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const headers = {}
                const options = { headers }
                const alias = options
                alias.headers["X-CSRF-Token"] = token
                fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`new Request(url).headers.set("X-CSRF-Token", token)`,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const request = new Request(url)
                const headers = request.headers
                headers.set("X-CSRF-Token", token)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const NativeRequest = Request
                const request = new NativeRequest(url)
                const alias = request
                const headers = alias.headers
                headers.set("X-CSRF-Token", token)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      code: dedent`
        const method = "querySelector"
                document[method]('meta[name="csrf-token"]')
      `,
      errors: [ { messageId: "metaTag" } ]
    },
    {
      code: "fetch(url, { [`headers`]: { [`X-XSRF-Token`]: token } })",
      errors: [ { messageId: "header", data: { name: "X-XSRF-Token" } } ]
    },
    {
      name: "does not treat an Object.assign after fetch as a prior replacement",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        fetch(url, options)
        Object.assign(options, { headers: {} })
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "does not treat a loop write as guaranteed before fetch",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        while (condition) Object.assign(options, { headers: {} })
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "does not treat a deferred write as guaranteed before fetch",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        function replaceHeaders() { Object.assign(options, { headers: {} }) }
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "preserves evidence for an Object.assign no-op",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        Object.assign(options)
        Object.assign(options, {})
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "preserves evidence when Object.assign writes another property",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        Object.assign(options, { method: "post" })
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "preserves evidence when defineProperty leaves the value intact",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        Object.defineProperty(options, "headers", { enumerable: false })
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    },
    {
      name: "rejects a different Reflect.set receiver",
      code: dedent`
        const options = { headers: { "X-CSRF-Token": token } }
        Reflect.set(options, "headers", {}, receiver)
        fetch(url, options)
      `,
      errors: [ { messageId: "header", data: { name: "X-CSRF-Token" } } ]
    }
  ]
})
