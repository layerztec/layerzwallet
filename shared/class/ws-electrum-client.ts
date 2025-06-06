import assert from 'assert';

type RawRPCRequest = {
  id: string | number;
  jsonrpc: '2.0';
  method: string;
  params: any[];
};

type RawRPCResponse = {
  id: string | number;
  result?: any;
  error?: any;
  param?: any; // optional, added in batched requests so user can find which exact request this result relates to
};

// eslint-disable-next-line no-control-regex
const regExpNewLine = new RegExp('\r|\n', 'g');

/**
 * Low-level, simple wrapper over secure Websocket, with basic electrum protocol methods implemented.
 * Does not handle reconnect/persistence, it should be handled externally.
 * Implies that `WebSocket` is available in runtime (browsers, nodejs 22+)
 */
export class WsElectrumClient {
  public host: string;
  public port: number;
  public path: string;
  public isConnected: boolean = false;
  public timeLastCall: number = 0;
  public timeout: number = 30000;

  private socket: WebSocket;
  private requestId: number = 0;
  private callbackMessageQueue: Record<any, [(result: any) => void, (error: any) => void, ReturnType<typeof setTimeout>]> = {}; // element 0 - success callback, element 1 - error callback
  private buffer: string = '';

  /**
   *  tries to connect to WSS on the spot
   */
  constructor(host: string, port: number, path: string = '') {
    this.host = host;
    this.port = port;
    this.path = path;

    this.socket = new WebSocket(`wss://${host}:${port}${path}`);

    this.socket.addEventListener('open', (event) => {
      console.log(`Electrum connected to wss://${host}:${port}${path}`);
      this.isConnected = true;
    });

    this.socket.addEventListener('message', (event) => {
      const data = event.data.replaceAll('} {', '}\n{'); // esplora uses Space for separation
      this.buffer += data;

      // a very naive approach to parse a buffer:
      let weShouldCleanup = true;
      const chunks = this.buffer.split(regExpNewLine);
      for (const chunk of chunks) {
        try {
          let parsed: RawRPCResponse | RawRPCResponse[] = JSON.parse(chunk);
          if (Array.isArray(parsed)) {
            // batched response
            let maxId = -1;
            parsed.map((result) => (maxId = Math.max(maxId, +result.id)));
            parsed = parsed.filter((result) => !result.error);
            const [resolve, , timeout] = this.callbackMessageQueue[maxId];
            resolve(parsed);
            clearTimeout(timeout);
            // basically, never firing 'reject', always returning the array
            delete this.callbackMessageQueue[maxId];
          } else {
            // not array, its just plain response
            if (parsed.error && parsed.id && this.callbackMessageQueue[+parsed.id]) {
              // error
              const [, reject, timeout] = this.callbackMessageQueue[+parsed.id];
              reject(new Error(parsed.error?.message ?? parsed.error));
              clearTimeout(timeout);
              delete this.callbackMessageQueue[+parsed.id];
            }

            if ('result' in parsed && parsed.id && this.callbackMessageQueue[+parsed.id]) {
              // success
              const [resolve, , timeout] = this.callbackMessageQueue[+parsed.id];
              resolve(parsed.result);
              clearTimeout(timeout);
              delete this.callbackMessageQueue[+parsed.id];
            }
          }
        } catch (_) {
          weShouldCleanup = false;
        }
      }

      if (weShouldCleanup) {
        // the idea is that if at least one chunk of multiple messages fails to parse because its incomplete -  we
        // retain everything. and next time we again parse all chunks, and if this time no failures - we clean up.
        // old messages will still be parsed, but we removed callbacks so they wont be extra triggered.
        this.buffer = '';
      }
    });
  }

  /**
   * simple loop with sleeps that checks if we connected already or not and
   * returns true if success, throws exception if failure
   */
  async waitTillConnected(defaultTimeoutMs: number = 9_000): Promise<true> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for Electrum connection')), defaultTimeoutMs);

      for (let c = 0; c <= defaultTimeoutMs / 1_000; c++) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // sleep
        if (this.isConnected) {
          clearTimeout(timeout);
          resolve(true);
          break;
        }
      }
    });
  }

  /**
   * generic method that forms an RPC request to electrum server, and returns the response in
   * an async/await fashion
   */
  private async request(method: string, params: any[]) {
    assert(this.isConnected, 'Electrum is not connected');
    this.timeLastCall = new Date().getTime();
    const id = ++this.requestId;
    const content: RawRPCRequest = { jsonrpc: '2.0', method, params, id };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        delete this.callbackMessageQueue[id];
        reject(new Error(`Electrum request timeout. request ID: ${id} (${method})`));
      }, this.timeout);
      this.callbackMessageQueue[id] = [resolve, reject, timeout];

      // promise shall be actually resolved or rejected later, in a handler of receive buffer

      this.socket.send(JSON.stringify(content) + '\n');
    });
  }

  /**
   * generic method that forms an RPC request to electrum server, BATCHED, and returns the response in
   * an async/await fashion
   */
  protected async requestBatch(method: string, params: string[], secondParam?: any) {
    assert(this.isConnected, 'Electrum is not connected');
    this.timeLastCall = new Date().getTime();

    const contents: RawRPCRequest[] = [];
    let argumentsForCalls: Record<number, any> = {};
    for (const param of params) {
      const id = ++this.requestId;
      contents.push({ jsonrpc: '2.0', method, params: secondParam !== undefined ? [param, secondParam] : [param], id });
      argumentsForCalls[id] = param;
    }
    const content = JSON.stringify(contents);

    return new Promise((resolve, reject) => {
      const resolveWrapper = (results: RawRPCResponse[]) => {
        // about to return results back, need to attach original params to individual responses
        if (results && results[0] && results[0].id) {
          // this is indeed a batch request response
          for (let r of results) {
            r.param = argumentsForCalls[+r.id];
          }
        }

        resolve(results);
      };

      // callback will exist only for last (max) id
      const id = this.requestId;
      const timeout = setTimeout(() => {
        delete this.callbackMessageQueue[id];
        reject(new Error(`Electrum request timeout. request ID: ${id} (${method})`));
      }, this.timeout);
      this.callbackMessageQueue[id] = [resolveWrapper, reject, timeout];
      // promise shall be actually resolved or rejected later, in a handler of receive buffer

      this.socket.send(content + '\n');
    });
  }

  async server_version(client: string, version: string): Promise<any> {
    return this.request('server.version', [client, version]);
  }

  async server_ping(): Promise<any> {
    return this.request('server.ping', []);
  }

  async blockchainEstimatefee(number: number): Promise<number> {
    return this.request('blockchain.estimatefee', [number]) as any;
  }

  async blockchainScripthash_getBalance(scripthash: string): Promise<any> {
    return this.request('blockchain.scripthash.get_balance', [scripthash]);
  }

  async blockchainScripthash_getHistory(scripthash: string): Promise<any> {
    return this.request('blockchain.scripthash.get_history', [scripthash]);
  }

  async blockchainTransaction_get(tx_hash: string, verbose: boolean): Promise<any> {
    return this.request('blockchain.transaction.get', [tx_hash, verbose || false]);
  }

  async blockchainTransaction_broadcast(hex: string): Promise<any> {
    return this.request('blockchain.transaction.broadcast', [hex]);
  }

  async mempool_getFeeHistogram(): Promise<any> {
    return this.request('mempool.get_fee_histogram', []);
  }

  async blockchainScripthash_getMempool(scripthash: string): Promise<any> {
    throw new Error('Not implemented'); // TODO: Implement method
  }

  async blockchainScripthash_listunspentBatch(scripthashes: string[]): Promise<any> {
    return this.requestBatch('blockchain.scripthash.listunspent', scripthashes);
  }

  async blockchainScripthash_getBalanceBatch(scripthashes: string[]): Promise<any> {
    return this.requestBatch('blockchain.scripthash.get_balance', scripthashes);
  }

  async blockchainTransaction_getBatch(tx_hash: string[], verbose: boolean): Promise<any> {
    return this.requestBatch('blockchain.transaction.get', tx_hash, verbose);
  }

  async blockchainHeaders_subscribe(): Promise<any> {
    return this.request('blockchain.headers.subscribe', []);
  }

  async server_features(): Promise<any> {
    return this.request('server.features', []);
  }

  // for testing purposes, should throw an error
  async methodDoesNotExist(): Promise<any> {
    return this.request('do.not.exist', []);
  }

  close(): void {
    this.socket.close();
    this.isConnected = false;
  }

  onError(callback: (error: any) => void): void {
    this.socket.addEventListener('error', callback);
  }

  onClose(callback: (error: any) => void): void {
    this.socket.addEventListener('close', callback);
  }

  async initElectrum(client: string, version: string) {
    this.timeLastCall = 0;
    return await this.server_version(client, version);
  }

  async blockchainScripthash_getHistoryBatch(scripthashes: any[]): Promise<any[]> {
    return (await this.requestBatch('blockchain.scripthash.get_history', scripthashes)) as any[];
  }
}
