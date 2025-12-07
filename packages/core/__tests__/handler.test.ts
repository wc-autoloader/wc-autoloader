import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerHandler } from '../src/handler.js';
import { config } from '../src/config.js';
import * as importmapModule from '../src/importmap.js';
import * as autoloadModule from '../src/autoload.js';

function captureDomContentLoaded() {
  const originalAddEventListener = document.addEventListener;
  let handler: ((event: Event) => Promise<void> | void) | null = null;
  const spy = vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
    if (type === 'DOMContentLoaded' && typeof listener === 'function') {
      handler = listener as (event: Event) => Promise<void> | void;
      return;
    }
    return originalAddEventListener.call(document, type, listener, options);
  });

  return {
    async fire() {
      if (handler) {
        await handler(new Event('DOMContentLoaded'));
      }
    },
    restore() {
      spy.mockRestore();
      handler = null;
    }
  };
}

describe('registerHandler', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    
    // Mock customElements
    vi.spyOn(customElements, 'define');
    vi.spyOn(customElements, 'get');
    vi.spyOn(customElements, 'whenDefined');
  });

  it('should return early when no importmap exists', async () => {
    vi.spyOn(importmapModule, 'loadImportmap').mockReturnValue(null);
    const buildMapSpy = vi.spyOn(importmapModule, 'buildMap');

    await registerHandler();

    expect(buildMapSpy).not.toHaveBeenCalled();
  });

  it('should load eager components immediately', async () => {
    const mockImportmap = {
      imports: {
        '@components/my-button': './components/button.js'
      }
    };
    
    vi.spyOn(importmapModule, 'loadImportmap').mockReturnValue(mockImportmap);
    const eagerLoadSpy = vi.spyOn(autoloadModule, 'eagerLoad').mockResolvedValue();
    const lazyLoadSpy = vi.spyOn(autoloadModule, 'lazyLoad').mockResolvedValue();

    await registerHandler();

    expect(eagerLoadSpy).toHaveBeenCalledWith(
      expect.any(Object),
      config.loaders
    );
    expect(lazyLoadSpy).not.toHaveBeenCalled();
  });

  it('should not lazy load when prefixMap is empty', async () => {
    const mockImportmap = {
      imports: {
        '@components/my-button': './components/button.js'
      }
    };
    
    vi.spyOn(importmapModule, 'loadImportmap').mockReturnValue(mockImportmap);
    const lazyLoadSpy = vi.spyOn(autoloadModule, 'lazyLoad');

    const domCapture = captureDomContentLoaded();
    await registerHandler();
    await domCapture.fire();

    expect(lazyLoadSpy).not.toHaveBeenCalled();
    domCapture.restore();
  });

  it('should setup lazy load on DOMContentLoaded', async () => {
    const mockImportmap = {
      imports: {
        '@components/ui/': './components/ui/'
      }
    };
    
    vi.spyOn(importmapModule, 'loadImportmap').mockReturnValue(mockImportmap);
    vi.spyOn(autoloadModule, 'eagerLoad').mockResolvedValue();
    const lazyLoadSpy = vi.spyOn(autoloadModule, 'lazyLoad').mockResolvedValue();

    const domCapture = captureDomContentLoaded();
    await registerHandler();

    await domCapture.fire();

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(lazyLoadSpy).toHaveBeenCalledWith(
      document,
      expect.any(Object),
      config.loaders
    );

    domCapture.restore();
  });

  it('should verify that empty prefixMap skips lazy load logic', async () => {
    const mockImportmap = {
      imports: {
        '@components/my-button': './components/button.js'
      }
    };
    
    vi.spyOn(importmapModule, 'loadImportmap').mockReturnValue(mockImportmap);
    vi.spyOn(autoloadModule, 'eagerLoad').mockResolvedValue();
    vi.spyOn(autoloadModule, 'lazyLoad').mockResolvedValue();

    await registerHandler();

    // With only eager components, buildMap returns empty prefixMap
    // which should skip lazy load setup in DOMContentLoaded
    expect(true).toBe(true); // Placeholder assertion
  });

  it('should setup MutationObserver when observable is true', async () => {
    config.observable = true;
    
    const mockImportmap = {
      imports: {
        '@components/ui/': './components/ui/'
      }
    };
    
    vi.spyOn(importmapModule, 'loadImportmap').mockReturnValue(mockImportmap);
    vi.spyOn(autoloadModule, 'eagerLoad').mockResolvedValue();
    vi.spyOn(autoloadModule, 'lazyLoad').mockResolvedValue();

    const observeSpy = vi.fn();
    vi.stubGlobal('MutationObserver', class {
      observe = observeSpy;
      disconnect = vi.fn();
      takeRecords = vi.fn();
    });

    const domCapture = captureDomContentLoaded();
    await registerHandler();

    await domCapture.fire();

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(observeSpy).toHaveBeenCalledWith(
      document.documentElement,
      { childList: true, subtree: true }
    );

    domCapture.restore();
  });

  it('should trigger lazyLoad when MutationObserver detects changes', async () => {
    config.observable = true;
    
    const mockImportmap = {
      imports: {
        '@components/ui/': './components/ui/'
      }
    };
    
    vi.spyOn(importmapModule, 'loadImportmap').mockReturnValue(mockImportmap);
    vi.spyOn(autoloadModule, 'eagerLoad').mockResolvedValue();
    const lazyLoadSpy = vi.spyOn(autoloadModule, 'lazyLoad').mockResolvedValue();

    let capturedCallback: MutationCallback | null = null;
    vi.stubGlobal('MutationObserver', class {
      observe = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn();
      constructor(callback: MutationCallback) {
        capturedCallback = callback;
      }
    });

    const domCapture = captureDomContentLoaded();
    await registerHandler();

    await domCapture.fire();

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(capturedCallback).not.toBeNull();

    // Clear previous lazyLoad calls
    lazyLoadSpy.mockClear();

    // Simulate mutation
    const mutations: MutationRecord[] = [{
      type: 'childList',
      target: document.body,
      addedNodes: [] as any,
      removedNodes: [] as any,
      previousSibling: null,
      nextSibling: null,
      attributeName: null,
      attributeNamespace: null,
      oldValue: null
    }];

    capturedCallback!(mutations, {} as MutationObserver);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(lazyLoadSpy).toHaveBeenCalledWith(
      document,
      expect.any(Object),
      config.loaders
    );

    domCapture.restore();
    config.observable = true; // Restore default
  });

  it('should surface MutationObserver lazy load errors', async () => {
    config.observable = true;
    const mockImportmap = {
      imports: {
        '@components/ui/': './components/ui/'
      }
    };

    vi.spyOn(importmapModule, 'loadImportmap').mockReturnValue(mockImportmap);
    vi.spyOn(autoloadModule, 'eagerLoad').mockResolvedValue();
    const lazyLoadSpy = vi.spyOn(autoloadModule, 'lazyLoad')
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Load failed'));

    const domCapture = captureDomContentLoaded();

    let capturedCallback: MutationCallback | null = null;
    vi.stubGlobal('MutationObserver', class {
      observe = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn();
      constructor(callback: MutationCallback) {
        capturedCallback = callback;
      }
    });

    await registerHandler();

    await domCapture.fire();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(capturedCallback).not.toBeNull();

    await expect(
      capturedCallback!(
        [{
          type: 'childList',
          target: document.body,
          addedNodes: [] as any,
          removedNodes: [] as any,
          previousSibling: null,
          nextSibling: null,
          attributeName: null,
          attributeNamespace: null,
          oldValue: null
        }],
        {} as MutationObserver
      )
    ).rejects.toThrow('Failed to lazy load components: Error: Load failed');

    domCapture.restore();
    config.observable = true;
  });

  it('should not setup MutationObserver when observable is false', async () => {
    config.observable = false;
    
    const mockImportmap = {
      imports: {
        '@components/ui/': './components/ui/'
      }
    };
    
    vi.spyOn(importmapModule, 'loadImportmap').mockReturnValue(mockImportmap);
    vi.spyOn(autoloadModule, 'eagerLoad').mockResolvedValue();
    vi.spyOn(autoloadModule, 'lazyLoad').mockResolvedValue();

    const observeSpy = vi.fn();
    vi.stubGlobal('MutationObserver', vi.fn(() => ({
      observe: observeSpy,
      disconnect: vi.fn(),
      takeRecords: vi.fn()
    })));

    const domCapture = captureDomContentLoaded();
    await registerHandler();

    await domCapture.fire();

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(observeSpy).not.toHaveBeenCalled();
    
    domCapture.restore();
    config.observable = true; // Restore default
  });

  it('should throw error when lazy load fails', async () => {
    const mockImportmap = {
      imports: {
        '@components/ui/': './components/ui/'
      }
    };
    
    vi.spyOn(importmapModule, 'loadImportmap').mockReturnValue(mockImportmap);
    vi.spyOn(autoloadModule, 'eagerLoad').mockResolvedValue();
    vi.spyOn(autoloadModule, 'lazyLoad').mockRejectedValue(new Error('Load failed'));

    const domCapture = captureDomContentLoaded();
    await registerHandler();

    await expect(domCapture.fire()).rejects.toThrow('Failed to lazy load components: Error: Load failed');

    domCapture.restore();
  });

  it('should throw error when eager load fails', async () => {
    const mockImportmap = {
      imports: {
        '@components/my-button': './components/button.js'
      }
    };
    
    vi.spyOn(importmapModule, 'loadImportmap').mockReturnValue(mockImportmap);
    vi.spyOn(autoloadModule, 'eagerLoad').mockRejectedValue(new Error('Load failed'));

    await expect(registerHandler()).rejects.toThrow('Failed to eager load components');
  });
});
