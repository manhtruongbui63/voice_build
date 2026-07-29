import { ReadableStream as ReadableStreamPolyfill } from 'web-streams-polyfill/ponyfill';

const runtime = globalThis as typeof globalThis & {
  ReadableStream?: typeof globalThis.ReadableStream;
};

if (typeof runtime.ReadableStream === 'undefined') {
  runtime.ReadableStream =
    ReadableStreamPolyfill as unknown as typeof globalThis.ReadableStream;
}
