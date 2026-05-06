<script>
  let count = $state(0)
  const doubled = $derived(count * 2)

  function increment() {
    count += 1
  }
</script>

<button onclick={increment}>
  {count} → {doubled}
</button>
