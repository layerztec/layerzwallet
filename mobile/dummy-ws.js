class WebSocket {
  constructor() {
    this.readyState = 3; // CLOSED
  }

  send() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {}
}

WebSocket.CONNECTING = 0;
WebSocket.OPEN = 1;
WebSocket.CLOSING = 2;
WebSocket.CLOSED = 3;

module.exports = WebSocket;
