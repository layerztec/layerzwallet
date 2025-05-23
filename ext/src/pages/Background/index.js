import '../../modules/breeze-adapter'; // needed to be imported before we can use BreezWallet
import { handleMessage } from '../../modules/background-message-controller';

console.log('LZ background script running...');
chrome.runtime.onMessage.addListener(handleMessage);
