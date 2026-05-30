/**
 * ESM replacement for randomfill/browser.js.
 * Rollup's CJS transform leaves bare `exports.*` in the browser build and breaks WebKit.
 */
import { Buffer } from 'buffer';

const kBufferMaxLength = Buffer.kMaxLength;
const crypto = globalThis.crypto || globalThis.msCrypto;
const kMaxUint32 = Math.pow(2, 32) - 1;

function oldBrowser() {
	throw new Error('secure random number generation not supported by this browser\nuse chrome, FireFox or Internet Explorer 11');
}

function assertOffset(offset, length) {
	if (typeof offset !== 'number' || offset !== offset) {
		throw new TypeError('offset must be a number');
	}
	if (offset > kMaxUint32 || offset < 0) {
		throw new TypeError('offset must be a uint32');
	}
	if (offset > kBufferMaxLength || offset > length) {
		throw new RangeError('offset out of range');
	}
}

function assertSize(size, offset, length) {
	if (typeof size !== 'number' || size !== size) {
		throw new TypeError('size must be a number');
	}
	if (size > kMaxUint32 || size < 0) {
		throw new TypeError('size must be a uint32');
	}
	if (size + offset > length || size > kBufferMaxLength) {
		throw new RangeError('buffer too small');
	}
}

function actualFill(buf, offset, size, cb) {
	if (!crypto?.getRandomValues) {
		oldBrowser();
	}
	const ourBuf = buf.buffer;
	const uint = new Uint8Array(ourBuf, offset, size);
	crypto.getRandomValues(uint);
	if (cb) {
		queueMicrotask(() => cb(null, buf));
		return;
	}
	return buf;
}

export function randomFill(buf, offset, size, cb) {
	if (!Buffer.isBuffer(buf) && !(buf instanceof Uint8Array)) {
		throw new TypeError('"buf" argument must be a Buffer or Uint8Array');
	}
	if (typeof offset === 'function') {
		cb = offset;
		offset = 0;
		size = buf.length;
	} else if (typeof size === 'function') {
		cb = size;
		size = buf.length - offset;
	} else if (typeof cb !== 'function') {
		throw new TypeError('"cb" argument must be a function');
	}
	assertOffset(offset, buf.length);
	assertSize(size, offset, buf.length);
	return actualFill(buf, offset, size, cb);
}

export function randomFillSync(buf, offset, size) {
	if (typeof offset === 'undefined') {
		offset = 0;
	}
	if (!Buffer.isBuffer(buf) && !(buf instanceof Uint8Array)) {
		throw new TypeError('"buf" argument must be a Buffer or Uint8Array');
	}
	assertOffset(offset, buf.length);
	if (size === undefined) size = buf.length - offset;
	assertSize(size, offset, buf.length);
	return actualFill(buf, offset, size);
}

export default { randomFill, randomFillSync };
