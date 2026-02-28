/**
 * MAIN world entry point for the reel ID extractor.
 *
 * This script is declared with "world": "MAIN" in manifest.json so it runs
 * inside the page's JavaScript context alongside Instagram's React code.
 * That is required because the React fiber key (__reactFiber$...) is an
 * expando property written by the page's JS — it is invisible to scripts
 * running in Chrome's default isolated content-script world.
 *
 * chrome.* APIs are NOT available here. Results are reported via console.log
 * and can later be forwarded to the isolated world via window.postMessage.
 */

import { startDebugPoller } from './reel-id-extractor'

startDebugPoller()
