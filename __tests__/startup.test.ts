describe('native startup compatibility', () => {
  const readableStreamDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'ReadableStream'
  );

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    if (readableStreamDescriptor) {
      Object.defineProperty(
        globalThis,
        'ReadableStream',
        readableStreamDescriptor
      );
    } else {
      delete (globalThis as { ReadableStream?: unknown }).ReadableStream;
    }
  });

  it('installs ReadableStream before app dependencies load the Gemini SDK', () => {
    jest.resetModules();
    delete (globalThis as { ReadableStream?: unknown }).ReadableStream;

    let readableStreamSeenByApp: unknown;
    jest.doMock('expo', () => ({
      registerRootComponent: jest.fn(),
    }));
    jest.doMock('../App', () => {
      readableStreamSeenByApp = globalThis.ReadableStream;
      jest.requireActual('@google/genai');
      return {
        __esModule: true,
        default: function App() {
          return null;
        },
      };
    });

    expect(() => require('../index')).not.toThrow();
    expect(readableStreamSeenByApp).toBeDefined();
  });
});
