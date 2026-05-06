// Outside components/**: `internal` import, prompt(), setTimeout() are all unrestricted here.
import x from "internal"
prompt("name?")
setTimeout(() => {}, 100)
