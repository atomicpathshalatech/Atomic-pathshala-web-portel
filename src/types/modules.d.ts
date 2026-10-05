declare module 'pngjs' {
  export class PNG {
    constructor(options?: { width?: number; height?: number });
    static sync: {
      read(buffer: Buffer): {
        width: number;
        height: number;
        data: Buffer | Uint8Array;
      };
      write(png: { width: number; height: number; data: Buffer | Uint8Array }): Buffer;
    };
    width: number;
    height: number;
    data: Buffer | Uint8Array;
  }
}

declare module 'jpeg-js' {
  export function decode(
    jpegBuffer: Buffer,
    opts?: { useTArray?: boolean; formatAsRGBA?: boolean; maxMemoryUsageInMB?: number }
  ): {
    width: number;
    height: number;
    data: Uint8Array | Buffer;
  };
}

declare module 'puppeteer-core';
declare module '@sparticuz/chromium';
