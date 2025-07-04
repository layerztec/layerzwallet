/**
 * @fileoverview This is the OUTER content script that gets injected into webpages. Due to Chrome's security model,
 * content scripts cannot directly modify webpage variables like `window.ethereum`. Instead, we need to inject an INNER
 * content script that can modify the webpage, but cannot communicate with the extension's popup or background scripts.
 * This OUTER script acts as a message relay between the INNER script and the extension's popup/background scripts.
 *
 * @see https://stackoverflow.com/questions/9515704/access-variables-and-functions-defined-in-page-context-from-an-extension
 */
import { processRPC } from '@shared/modules/rpc-controller';
import { Eip1193CustomEventResponse } from '@shared/types/eip1193-custom-event';

import { LayerzStorage } from '../../class/layerz-storage';
import { BackgroundCaller } from '../../modules/background-caller';
import { Messenger } from '../../modules/messenger';

console.log('Injecting LZ...');

var s = document.createElement('script');
s.src = chrome.runtime.getURL('lz.contentScript.bundle.js');
// Note: lz.contentScript.bundle.js must be listed in manifest.json's web_accessible_resources
// to allow the webpage to load it as a script
s.onload = function () {
  // @ts-ignore
  this.remove();
};
(document.head || document.documentElement).appendChild(s);

// ####################################################################################################3
// ####################################################################################################3
// ####################################################################################################3

// Listen for messages from the inner content script that was injected into the webpage.
// Process the message, execute any required actions, and send back a response
// with the same ID to the inner content script (webpage).
document.addEventListener('LayerzWalletExtension', async function (e) {
  // @ts-ignore
  const args = JSON.parse(e.detail) as Eip1193CustomEventRequest;

  if (args.for !== 'contentScript') {
    // Ignore messages intended for the webpage
    return;
  }

  console.log('handling the event from webpage', args, '....');

  // Process event via RPC controller which handles it directly or forwards to background script
  // Background script can open popup UI when needed (not possible from content script)
  await processRPC(LayerzStorage, BackgroundCaller, args.method, args.params, args.id, args.from, Messenger);
});

chrome.runtime.onMessage.addListener(function (msg: Eip1193CustomEventResponse, sender, sendResponse) {
  // Relay message from extension (popup/background) to webpage script, since extension messages
  // cannot reach the webpage directly due to Chrome's security model
  document.dispatchEvent(
    new CustomEvent('LayerzWalletExtension', {
      // Serialize message to JSON string to prevent Firefox security violations when passing complex objects
      detail: JSON.stringify(msg),
    })
  );
});

export {};
