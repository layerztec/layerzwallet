import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';

export const saveBackupKit = async (recoveryPhrase: string): Promise<void> => {
  try {
    if (!recoveryPhrase) {
      Alert.alert('Error', 'No recovery phrase available to save');
      return;
    }

    const backupContent = `LayerZ Wallet Recovery Phrase Backup
Generated: ${new Date().toLocaleDateString()}

IMPORTANT: Keep this recovery phrase safe and secure. Never share it with anyone.

Recovery Phrase:
        ${recoveryPhrase
          .split(' ')
          .map((word, index) => `${index + 1}. ${word}`)
          .join('\n')}

Instructions:
1. Write down these 12 words in order on paper
2. Store the paper in a secure location
3. Never store this digitally or take photos
4. Verify you have written it correctly

WARNING: Anyone with access to this recovery phrase can access your wallet and funds.
`;

    const fileUri = FileSystem.documentDirectory + 'layerz-wallet-backup.txt';
    await FileSystem.writeAsStringAsync(fileUri, backupContent);

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        dialogTitle: 'Save your LayerZ Wallet backup',
        mimeType: 'text/plain',
      });
    } else {
      Alert.alert('Success', 'Backup file saved to device');
    }
  } catch (error) {
    console.error('Error saving backup:', error);
    Alert.alert('Error', 'Failed to save backup file');
  }
};

export const printTemplate = async (recoveryPhrase: string): Promise<void> => {
  try {
    if (!recoveryPhrase) {
      Alert.alert('Error', 'No recovery phrase available to print');
      return;
    }

    const words = recoveryPhrase.split(' ');
    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .subtitle { font-size: 14px; color: #666; }
          .words-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 30px 0; }
          .word-item { border: 1px solid #ddd; padding: 15px; border-radius: 8px; display: flex; align-items: center; }
          .word-number { 
            width: 30px; 
            height: 30px; 
            border-radius: 50%; 
            background: #f0f0f0; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            margin-right: 15px; 
            font-weight: bold; 
          }
          .word-text { font-size: 18px; }
          .instructions { margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; }
          .warning { color: #d32f2f; font-weight: bold; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">LayerZ Wallet Recovery Phrase</div>
          <div class="subtitle">Generated: ${new Date().toLocaleDateString()}</div>
        </div>
        
        <div class="words-grid">
          ${words
            .map(
              (word, index) => `
            <div class="word-item">
              <div class="word-number">${index + 1}</div>
              <div class="word-text">${word}</div>
            </div>
          `
            )
            .join('')}
        </div>
        
        <div class="instructions">
          <h3>Recovery Instructions:</h3>
          <ol>
            <li>Write down these 12 words in the exact order shown above</li>
            <li>Store this paper in a secure location (safe, safety deposit box)</li>
            <li>Never store this recovery phrase digitally or take photos</li>
            <li>Test your backup by attempting to restore your wallet</li>
          </ol>
          
          <div class="warning">
            WARNING: Anyone with access to this recovery phrase can access your wallet and funds. 
            Keep it secure and never share it with anyone.
          </div>
        </div>
      </body>
      </html>
    `;

    const isPrintAvailable = true;
    if (isPrintAvailable) {
      await Print.printAsync({
        html: printHtml,
        printerUrl: undefined,
      });
    } else {
      Alert.alert('Print Unavailable', 'Printing is not available on this device');
    }
  } catch (error) {
    console.error('Error printing template:', error);
    Alert.alert('Error', 'Failed to print backup template');
  }
};
