import '../../modules/breeze-adapter'; // needed to be imported before we can use BreezWallet
import '../../modules/messenger-adapter'; // needed to be imported before we can use Messenger
import { handleMessage } from '../../modules/background-message-controller';

console.log('LZ background script running...');
chrome.runtime.onMessage.addListener(handleMessage);
