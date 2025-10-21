import '../../modules/breeze-adapter';
import { handleMessage } from '../../modules/background-message-controller';

console.log('LZ background script running...');
chrome.runtime.onMessage.addListener(handleMessage);
