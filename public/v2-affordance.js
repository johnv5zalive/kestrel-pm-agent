// v2 chips — wires every [data-v2-open="ID"] click to <dialog id="v2-ID">.show().
// One handler, no per-chip wiring. Dialogs are pre-rendered server-side; this
// file just opens/closes them. Tailwind doesn't see this file (no class
// construction), so no purge concerns.

(function () {
  function open(id) {
    const dlg = document.getElementById('v2-' + id)
    if (dlg && typeof dlg.showModal === 'function') {
      dlg.showModal()
    }
  }

  function closeOpen() {
    document.querySelectorAll('dialog[open]').forEach(function (d) {
      if (typeof d.close === 'function') d.close()
    })
  }

  document.addEventListener('click', function (e) {
    var t = e.target
    while (t && t !== document.body) {
      if (t.dataset && t.dataset.v2Open) {
        e.preventDefault()
        open(t.dataset.v2Open)
        return
      }
      if (t.dataset && t.dataset.v2Close !== undefined) {
        e.preventDefault()
        closeOpen()
        return
      }
      t = t.parentElement
    }
  })

  // Click outside dialog content closes it — uses the fact that <dialog> root
  // has the backdrop as its own area; if click target is the dialog itself
  // (not a child), close.
  document.addEventListener('click', function (e) {
    if (e.target && e.target.tagName === 'DIALOG') {
      var rect = e.target.getBoundingClientRect()
      var inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      if (!inside) e.target.close()
    }
  })

  // Esc to close (default browser behavior, but ensure it works on all pages).
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeOpen()
  })
})()
