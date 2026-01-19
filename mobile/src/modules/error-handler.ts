/**
 * PORTED FROM  https://github.com/krakenfx/wallet
 * LICENSE: MIT
 */
import { File, Paths } from 'expo-file-system';
// @ts-ignore no types for this
import { serializeError } from 'serialize-error';
// @ts-ignore no types for this
import type { ErrorObject } from 'serialize-error';

const applogFile = new File(Paths.document, 'app.log');
export const applogFilePath = applogFile.uri;

export const recentErrors: { timestamp: Date; error: ErrorObject; context: string }[] = [];

const logfileSizeCutoff = 100 * 1024 * 1024;

let loggingTofileEnabled = false;
export function enableLoggingToFile() {
  loggingTofileEnabled = true;
  return Promise.resolve().then(() => {
    applogFile.write('', { encoding: 'utf8' });
  });
}

export function disableLoggingToFile() {
  loggingTofileEnabled = false;
  return Promise.resolve().then(() => {
    if (applogFile.exists) {
      applogFile.delete();
    }
  });
}

export function isLoggingToFileEnabled() {
  return loggingTofileEnabled;
}

try {
  // initial load:
  // presence of a logfile is a flag that logging is enabled!
  const info = applogFile.info();
  if (!info.exists) {
    loggingTofileEnabled = false;
  } else {
    loggingTofileEnabled = true;
    console.log('applogFile.info():', info);
    if (info.size && info.size >= logfileSizeCutoff) {
      applogFile.write('', { encoding: 'utf8' });
    }
  }
} catch (_: unknown) {
  loggingTofileEnabled = false;
}

export function appendLog(contents: string | unknown[], context: string = 'unknown') {
  if (!loggingTofileEnabled) {
    return;
  }
  try {
    const contents2write = typeof contents === 'string' ? contents : JSON.stringify(contents);
    const line = `${new Date()} context=${context} ${contents2write}\n`;
    const handle = applogFile.open();
    try {
      handle.offset = handle.size ?? 0;
      handle.writeBytes(new TextEncoder().encode(line));
    } finally {
      handle.close();
    }
  } catch (_: unknown) {}
}

export function createErrorHandlerWithContext(context: string) {
  return (reason: unknown) => handleError(reason, context);
}

export const handleError = async function (error: unknown, context: string = 'unknown'): Promise<void> {
  console.log('exception caught:', context, error);
  recentErrors.push({
    error: serializeError(error),
    context,
    timestamp: new Date(),
  });

  appendLog(JSON.stringify(serializeError(error)), context);
};

const cleanHTMLTags = (str: string) => {
  return str
    .replace('<title>Error</title>', '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/(\\n)+/g, '')
    .trim();
};

export const getErrorMessage = async (err: any): Promise<string> => {
  if (err?.cause?.message) {
    return (err?.message ? `${err.message}: ` : '') + String(err?.cause?.message);
  }
  if (err?.response?.json) {
    try {
      const resolved = jsonToPretty(await err?.response.json());
      return (err?.message ? `${err.message}: ` : '') + String(resolved);
    } catch (_: unknown) {}
  } else if (err?.response?.text) {
    const resolved = jsonToPretty(await err?.response.text());
    return (err?.message ? `${err.message}: ` : '') + String(resolved);
  }

  if (err?.message) {
    return cleanHTMLTags(err.message);
  }
  return String(err ?? '(no message)');
};

function jsonToPretty(json: any): string {
  if (typeof json === 'string') {
    return json;
  }

  let ret = '';

  for (const key of Object.keys(json)) {
    let val = json[key];

    if (typeof val === 'string') {
      ret += `${key}: ${val}\n`;
    } else {
      val = jsonToPretty(val);
      ret += `\t${key}: ${val}\n`;
    }
  }

  return ret;
}
