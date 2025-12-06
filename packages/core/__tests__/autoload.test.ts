import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lazyLoad, eagerLoad } from '../src/autoload.js';
import { DEFAULT_KEY } from '../src/config.js';

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve: resolve!,
    reject: reject!
  };
}

describe('autoload', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('customElements', {
      define: vi.fn(),
      get: vi.fn(),
      whenDefined: vi.fn()
    });
  });

  describe('lazyLoad with ShadowRoot', () => {
    it('should load component in shadow root', async () => {
      const mockLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
      const prefixMap = {
        'ui': {
          key: '@components/ui/',
          prefix: 'ui',
          loaderKey: null,
          isNameSpaced: true
        }
      };
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: mockLoader
        }
      };

      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<ui-button></ui-button>';

      await lazyLoad(shadow, prefixMap, loaders);

      expect(mockLoader).toHaveBeenCalledWith('@components/ui/button.js');
      expect(customElements.define).toHaveBeenCalled();
    });

    it('should load customized built-in element with is attribute', async () => {
      const mockLoader = vi.fn().mockResolvedValue(class extends HTMLButtonElement {});
      const prefixMap = {
        'ui': {
          key: '@components/ui/',
          prefix: 'ui',
          loaderKey: null,
          isNameSpaced: true
        }
      };
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: mockLoader
        }
      };

      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<button is="ui-button"></button>';

      await lazyLoad(shadow, prefixMap, loaders);

      expect(mockLoader).toHaveBeenCalledWith('@components/ui/button.js');
      expect(customElements.define).toHaveBeenCalledWith(
        'ui-button',
        expect.any(Function),
        { extends: 'button' }
      );
    });

    it('should throw error for element without dash or is attribute', async () => {
      const prefixMap = {};
      const loaders = { [DEFAULT_KEY]: { postfix: '.js', loader: vi.fn() } };

      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<div></div>';

      await expect(lazyLoad(shadow, prefixMap, loaders)).rejects.toThrow(
        "Custom element without a dash or 'is' attribute found"
      );
    });

    it('should throw error for is attribute without dash', async () => {
      const prefixMap = {};
      const loaders = { [DEFAULT_KEY]: { postfix: '.js', loader: vi.fn() } };

      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<button is="nodash"></button>';

      await expect(lazyLoad(shadow, prefixMap, loaders)).rejects.toThrow(
        "Custom element 'is' attribute without a dash found"
      );
    });

    it('should skip duplicate tags', async () => {
      const mockLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
      const prefixMap = {
        'ui': {
          key: '@components/ui/',
          prefix: 'ui',
          loaderKey: null,
          isNameSpaced: true
        }
      };
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: mockLoader
        }
      };

      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<ui-button></ui-button><ui-button></ui-button>';

      await lazyLoad(shadow, prefixMap, loaders);

      expect(mockLoader).toHaveBeenCalledTimes(1);
    });

    it('should handle loader returning null', async () => {
      const mockLoader = vi.fn().mockResolvedValue(null);
      const prefixMap = {
        'ui': {
          key: '@components/ui/',
          prefix: 'ui',
          loaderKey: null,
          isNameSpaced: true
        }
      };
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: mockLoader
        }
      };

      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<ui-button></ui-button>';

      await lazyLoad(shadow, prefixMap, loaders);

      expect(mockLoader).toHaveBeenCalled();
      expect(customElements.define).not.toHaveBeenCalled();
    });

    it('should handle loading error and log it', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockLoader = vi.fn().mockRejectedValue(new Error('Load failed'));
      const prefixMap = {
        'ui': {
          key: '@components/ui/',
          prefix: 'ui',
          loaderKey: null,
          isNameSpaced: true
        }
      };
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: mockLoader
        }
      };

      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<ui-button></ui-button>';

      await lazyLoad(shadow, prefixMap, loaders);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to lazy load component 'ui-button'"),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should skip components already marked as failed', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingLoader = vi.fn().mockRejectedValue(new Error('Load failed'));
      const prefixMap = {
        'ux': {
          key: '@components/ux/',
          prefix: 'ux',
          loaderKey: null,
          isNameSpaced: true
        }
      };
      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<ux-card></ux-card>';

      await lazyLoad(shadow, prefixMap, {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: failingLoader
        }
      });

      expect(failingLoader).toHaveBeenCalledTimes(1);

      const retryLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
      consoleErrorSpy.mockClear();

      await lazyLoad(shadow, prefixMap, {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: retryLoader
        }
      });

      expect(retryLoader).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should skip components that are already loading', async () => {
      const deferred = createDeferred<typeof HTMLElement>();
      const blockingLoader = vi.fn().mockImplementation(() => deferred.promise);
      const prefixMap = {
        'ux': {
          key: '@components/ux/',
          prefix: 'ux',
          loaderKey: null,
          isNameSpaced: true
        }
      };
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: blockingLoader
        }
      };

      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<ux-spinner></ux-spinner>';

      const firstLoad = lazyLoad(shadow, prefixMap, loaders);
      await Promise.resolve();

      const secondLoad = lazyLoad(shadow, prefixMap, loaders);
      await secondLoad;

      expect(blockingLoader).toHaveBeenCalledTimes(1);

      deferred.resolve(class extends HTMLElement {});
      await firstLoad;
    });

    it('should throw error when no matching namespace found', async () => {
      const prefixMap = {};
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: vi.fn()
        }
      };

      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<unknown-component></unknown-component>';

      await expect(lazyLoad(shadow, prefixMap, loaders)).rejects.toThrow(
        'No matching namespace found for lazy loaded component'
      );
    });

    it('should throw error for invalid component name (empty after prefix)', async () => {
      const prefixMap = {
        'ui': {
          key: '@components/ui/',
          prefix: 'ui',
          loaderKey: null,
          isNameSpaced: true
        }
      };
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: vi.fn()
        }
      };

      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<ui-></ui->';

      await expect(lazyLoad(shadow, prefixMap, loaders)).rejects.toThrow(
        'Invalid component name for lazy loaded component'
      );
    });

    it('should use custom loader key for namespace', async () => {
      const customLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
      const prefixMap = {
        'ux': {
          key: '@components/ux/',
          prefix: 'ux',
          loaderKey: 'custom',
          isNameSpaced: true
        }
      };
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: vi.fn()
        },
        custom: {
          postfix: '.custom.js',
          loader: customLoader
        }
      };

      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<ux-panel></ux-panel>';

      await lazyLoad(shadow, prefixMap, loaders);

      expect(customLoader).toHaveBeenCalledWith('@components/ux/panel.custom.js');
    });

    it('should follow loader string redirection for default namespace loader', async () => {
      const redirectedLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
      const prefixMap = {
        'ux': {
          key: '@components/ux/',
          prefix: 'ux',
          loaderKey: DEFAULT_KEY,
          isNameSpaced: true
        }
      };
      const loaders = {
        [DEFAULT_KEY]: 'alt',
        alt: {
          postfix: '.js',
          loader: redirectedLoader
        }
      };

      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<ux-link></ux-link>';

      await lazyLoad(shadow, prefixMap, loaders);

      expect(redirectedLoader).toHaveBeenCalledWith('@components/ux/link.js');
    });

    it('should throw when loader string cannot be resolved for namespace', async () => {
      const prefixMap = {
        'ux': {
          key: '@components/ux/',
          prefix: 'ux',
          loaderKey: 'broken',
          isNameSpaced: true
        }
      };
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: vi.fn()
        },
        broken: 'loop'
      };

      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<ux-bad></ux-bad>';

      await expect(lazyLoad(shadow, prefixMap, loaders)).rejects.toThrow(
        'Loader redirection is not supported for eager loaded components: UX-BAD'
      );
    });
  });

  describe('eagerLoad', () => {
    it('should load component with default loader', async () => {
      const mockLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
      const loadMap = {
        'my-button': {
          key: './components/button.js',
          tagName: 'my-button',
          loaderKey: null,
          extends: null,
          isNameSpaced: false
        }
      };
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: mockLoader
        }
      };

      await eagerLoad(loadMap, loaders);

      expect(mockLoader).toHaveBeenCalledWith('./components/button.js');
      expect(customElements.define).toHaveBeenCalledWith(
        'my-button',
        expect.any(Function)
      );
    });

    it('should load customized built-in element', async () => {
      const mockLoader = vi.fn().mockResolvedValue(class extends HTMLButtonElement {});
      const loadMap = {
        'my-button': {
          key: './components/button.js',
          tagName: 'my-button',
          loaderKey: null,
          extends: 'button',
          isNameSpaced: false
        }
      };
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: mockLoader
        }
      };

      await eagerLoad(loadMap, loaders);

      expect(mockLoader).toHaveBeenCalledWith('./components/button.js');
      expect(customElements.define).toHaveBeenCalledWith(
        'my-button',
        expect.any(Function),
        { extends: 'button' }
      );
    });

    it('should use custom loader key', async () => {
      const mockLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
      const loadMap = {
        'my-button': {
          key: './components/button.js',
          tagName: 'my-button',
          loaderKey: 'custom',
          extends: null,
          isNameSpaced: false
        }
      };
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.default.js',
          loader: vi.fn()
        },
        custom: {
          postfix: '.js',
          loader: mockLoader
        }
      };

      await eagerLoad(loadMap, loaders);

      expect(mockLoader).toHaveBeenCalledWith('./components/button.js');
    });

    it('should handle loader string redirection', async () => {
      const mockLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
      const loadMap = {
        'my-button': {
          key: './components/button.js',
          tagName: 'my-button',
          loaderKey: '',
          extends: null,
          isNameSpaced: false
        }
      };
      const loaders = {
        [DEFAULT_KEY]: 'custom',
        custom: {
          postfix: '.js',
          loader: mockLoader
        }
      };

      await eagerLoad(loadMap, loaders);

      expect(mockLoader).toHaveBeenCalled();
    });

    it('should throw error when loader is invalid string', async () => {
      const loadMap = {
        'my-button': {
          key: './components/button.js',
          tagName: 'my-button',
          loaderKey: 'invalid',
          extends: null,
          isNameSpaced: false
        }
      };
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: vi.fn()
        },
        invalid: 'broken'
      };

      await expect(eagerLoad(loadMap, loaders)).rejects.toThrow(
        'Loader redirection is not supported for eager loaded components'
      );
    });

    it('should handle loader returning null', async () => {
      const mockLoader = vi.fn().mockResolvedValue(null);
      const loadMap = {
        'my-button': {
          key: './components/button.js',
          tagName: 'my-button',
          loaderKey: null,
          extends: null,
          isNameSpaced: false
        }
      };
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: mockLoader
        }
      };

      await eagerLoad(loadMap, loaders);

      expect(mockLoader).toHaveBeenCalled();
      expect(customElements.define).not.toHaveBeenCalled();
    });

    it('should handle loading error and log it', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockLoader = vi.fn().mockRejectedValue(new Error('Load failed'));
      const loadMap = {
        'my-button': {
          key: './components/button.js',
          tagName: 'my-button',
          loaderKey: null,
          extends: null,
          isNameSpaced: false
        }
      };
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: mockLoader
        }
      };

      await eagerLoad(loadMap, loaders);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to eager load component 'my-button'"),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should load multiple components', async () => {
      const mockLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
      const loadMap = {
        'my-button': {
          key: './components/button.js',
          tagName: 'my-button',
          loaderKey: null,
          extends: null,
          isNameSpaced: false
        },
        'my-card': {
          key: './components/card.js',
          tagName: 'my-card',
          loaderKey: null,
          extends: null,
          isNameSpaced: false
        }
      };
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: mockLoader
        }
      };

      await eagerLoad(loadMap, loaders);

      expect(mockLoader).toHaveBeenCalledTimes(2);
      expect(customElements.define).toHaveBeenCalledTimes(2);
    });
  });
});
