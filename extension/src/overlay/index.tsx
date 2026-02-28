// Injects React root via Shadow DOM into the Instagram reel player
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const HOST_ID = 'reelcheck-overlay-host'

export function mountOverlay() {
  if (document.getElementById(HOST_ID)) return

  const host = document.createElement('div')
  host.id = HOST_ID
  host.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;pointer-events:none;'
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })

  // Inject styles into shadow root
  const style = document.createElement('link')
  style.rel = 'stylesheet'
  style.href = chrome.runtime.getURL('overlay.css')
  shadow.appendChild(style)

  const root = document.createElement('div')
  shadow.appendChild(root)

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

mountOverlay()
