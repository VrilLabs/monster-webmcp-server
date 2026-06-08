/**
 * MonsterWebMCP - Transport Factory
 * Auto-detects the best available transport and creates the appropriate instance
 */

import type { Transport, TransportConfig, NativeModelContext } from '../core/types';
import { NativeTransport } from './native-transport';
import { PolyfillTransport } from './polyfill-transport';
import { MemoryTransport } from './memory-transport';
import { HTTPTransport } from './http-transport';

export class TransportFactory {
  /**
   * Create the best available transport based on configuration and environment
   *
   * Priority:
   * 1. Native document.modelContext (Chrome 146+)
   * 2. Polyfill implementation (any browser)
   * 3. In-memory fallback (SSR, test environments)
   *
   * Additionally, if traditionalMcp is enabled, an HTTP/SSE transport
   * is created as a secondary transport.
   */
  static create(config: TransportConfig): Transport {
    // 1. Try native document.modelContext
    if (config.native) {
      const nativeTransport = TransportFactory.tryNative();
      if (nativeTransport) {
        return nativeTransport;
      }
    }

    // 2. Try polyfill (works in any browser environment)
    if (config.polyfill) {
      const polyfillTransport = TransportFactory.tryPolyfill();
      if (polyfillTransport) {
        return polyfillTransport;
      }
    }

    // 3. Fall back to in-memory transport
    return new MemoryTransport();
  }

  /**
   * Create an HTTP/SSE transport as a secondary transport
   */
  static createHTTPTransport(config: TransportConfig): HTTPTransport | null {
    if (!config.traditional || !config.transportConfig) {
      return null;
    }

    return new HTTPTransport(config.transportConfig);
  }

  /**
   * Check if native document.modelContext is available
   */
  static isNativeAvailable(): boolean {
    if (typeof document === 'undefined') return false;
    return 'modelContext' in document && document.modelContext !== undefined;
  }

  /**
   * Get the native modelContext if available
   */
  static getNativeModelContext(): NativeModelContext | null {
    if (typeof document === 'undefined') return null;
    if ('modelContext' in document && document.modelContext) {
      return document.modelContext as NativeModelContext;
    }
    return null;
  }

  /**
   * Detect the current browser environment
   */
  static detectEnvironment(): 'browser' | 'webworker' | 'node' | 'unknown' {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      return 'browser';
    }
    if (typeof self !== 'undefined' && typeof (self as unknown as Record<string, unknown>).importScripts === 'function') {
      return 'webworker';
    }
    if (typeof process !== 'undefined' && process.versions?.node) {
      return 'node';
    }
    return 'unknown';
  }

  private static tryNative(): Transport | null {
    const modelContext = TransportFactory.getNativeModelContext();
    if (!modelContext) return null;

    return new NativeTransport(modelContext);
  }

  private static tryPolyfill(): Transport | null {
    if (typeof window === 'undefined') return null;

    // Polyfill works in any browser environment
    return new PolyfillTransport();
  }
}
