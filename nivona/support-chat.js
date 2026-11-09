// The optional chat must not delay parsing, application startup or page load.
// Keep it here once for all routes, including client-side navigation to Service.
(() => {
  function loadSupportChat() {
    if (document.getElementById('nivona-support-chat')) return

    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = 'https://nivona.online/Content/ai/public.css'
    document.head.appendChild(stylesheet)

    const script = document.createElement('script')
    script.id = 'nivona-support-chat'
    script.async = true
    script.src = 'https://nivona.online/Content/ai/public.js'
    script.addEventListener('load', () => {
      // The provider normally initializes on DOMContentLoaded. It has already
      // fired by now, so invoke the existing initializer after the script loads.
      if (typeof window.public_bot?.RunInit === 'function') {
        Promise.resolve(window.public_bot.RunInit()).catch((error) => {
          console.warn('Support chat could not be initialized', error)
        })
      }
    }, { once: true })
    document.head.appendChild(script)
  }

  if (document.readyState === 'complete') {
    loadSupportChat()
  } else {
    window.addEventListener('load', loadSupportChat, { once: true })
  }
})()
