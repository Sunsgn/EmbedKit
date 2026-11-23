import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createForwardProxy } from './forward-proxy.js';

const response = () => ({
  headersSent: false, status: 0, body: null,
  writeHead(status) { this.status = status; this.headersSent = true; },
  end(value) { this.body = value; },
  destroy(error) { this.destroyedWith = error; },
});
const jsonResponse = (res, status, body) => { res.status = status; res.body = body; res.headersSent = true; };

test('forward proxy rejects a target before reading or opening a request', async () => {
  let bodyRead = false, opened = false;
  const forward = createForwardProxy({
    validateTarget: () => { throw new Error('not allowed'); },
    readRequestBody: async () => { bodyRead = true; return Buffer.alloc(0); },
    jsonResponse,
    httpClient: { request: () => { opened = true; } },
  });
  const res = response();
  await forward({ headers: {}, method: 'GET' }, res, 'http://blocked.invalid');
  assert.deepEqual({ status: res.status, body: res.body, bodyRead, opened }, {
    status: 403, body: { error: 'not allowed' }, bodyRead: false, opened: false,
  });
});

test('forward proxy bounds the request body before opening the upstream connection', async () => {
  let opened = false;
  const forward = createForwardProxy({
    validateTarget: value => new URL(value),
    readRequestBody: async () => { throw new Error('body too large'); },
    jsonResponse,
    httpClient: { request: () => { opened = true; } },
  });
  const res = response();
  await forward({ headers: {}, method: 'POST' }, res, 'http://localhost:9999');
  assert.equal(res.status, 413);
  assert.equal(opened, false);
});

test('forward proxy allowlists request headers and strips upstream CORS headers', async () => {
  let requestOptions, sentBody;
  const upstreamResponse = Object.assign(new EventEmitter(), {
    statusCode: 201,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    pipe(res) { res.end('proxied'); },
  });
  const client = {
    request(options, callback) {
      requestOptions = options;
      const upstream = new EventEmitter();
      upstream.end = body => { sentBody = body; callback(upstreamResponse); };
      return upstream;
    },
  };
  const forward = createForwardProxy({
    validateTarget: value => new URL(value), readRequestBody: async () => Buffer.from('payload'), jsonResponse,
    httpClient: client,
  });
  const res = response();
  await forward({ method: 'POST', headers: { accept: 'application/json', authorization: 'secret', host: 'unsafe', cookie: 'unsafe' } }, res, 'http://localhost:9999/chat?q=1');
  assert.equal(requestOptions.path, '/chat?q=1');
  assert.deepEqual(requestOptions.headers, { accept: 'application/json', authorization: 'secret', 'content-length': '7' });
  assert.equal(requestOptions.headers.cookie, undefined);
  assert.equal(res.status, 201);
  assert.equal(res.body, 'proxied');
  assert.equal(sentBody.toString(), 'payload');
});
