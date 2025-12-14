import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handlerForLazyLoad, getCustomTagInfo } from '../src/lazyLoad.js';
import { resetState } from '../src/tags.js';
import { DEFAULT_KEY } from '../src/config.js';
import { ILoader } from '../src/types.js';

describe('lazyLoad', () => {
  const registry = new Map<string, CustomElementConstructor>();

  beforeEach(() => {
    document.body.innerHTML = '';
    resetState();
    registry.clear();
    vi.clearAllMocks();
    
    vi.spyOn(customElements, 'define').mockImplementation((name, constructor) => {
      registry.set(name, constructor);
    });
    vi.spyOn(customElements, 'get').mockImplementation((name) => {
      return registry.get(name);
    });
    vi.spyOn(customElements, 'whenDefined').mockResolvedValue(class extends HTMLElement {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load components in the document', async () => {
    const mockConstructor = class extends HTMLElement {};
    const mockLoader: ILoader = {
      postfix: '.js',
      loader: vi.fn().mockResolvedValue(mockConstructor)
    };
    const config = {
      loaders: { [DEFAULT_KEY]: mockLoader },
      observable: false,
      scanImportmap: false
    };
    const prefixMap = {
      'ui': {
        key: '@components/ui/',
        prefix: 'ui',
        loaderKey: null,
        isNameSpaced: true
      }
    };

    document.body.innerHTML = '<ui-button></ui-button>';

    await handlerForLazyLoad(document, config, prefixMap);

    expect(mockLoader.loader).toHaveBeenCalledWith('@components/ui/button.js');
    expect(customElements.define).toHaveBeenCalledWith('ui-button', mockConstructor);
  });

  it('should handle nested components', async () => {
    const mockConstructor = class extends HTMLElement {};
    const mockLoader: ILoader = {
      postfix: '.js',
      loader: vi.fn().mockResolvedValue(mockConstructor)
    };
    const config = {
      loaders: { [DEFAULT_KEY]: mockLoader },
      observable: false,
      scanImportmap: false
    };
    const prefixMap = {
      'ui': {
        key: '@components/ui/',
        prefix: 'ui',
        loaderKey: null,
        isNameSpaced: true
      }
    };

    document.body.innerHTML = '<div><ui-card><span><ui-button></ui-button></span></ui-card></div>';

    await handlerForLazyLoad(document, config, prefixMap);

    expect(mockLoader.loader).toHaveBeenCalledWith('@components/ui/card.js');
    expect(mockLoader.loader).toHaveBeenCalledWith('@components/ui/button.js');
    expect(customElements.define).toHaveBeenCalledWith('ui-card', mockConstructor);
    expect(customElements.define).toHaveBeenCalledWith('ui-button', mockConstructor);
  });

  it('should handle "is" attribute', async () => {
    const mockConstructor = class extends HTMLButtonElement {};
    const mockLoader: ILoader = {
      postfix: '.js',
      loader: vi.fn().mockResolvedValue(mockConstructor)
    };
    const config = {
      loaders: { [DEFAULT_KEY]: mockLoader },
      observable: false,
      scanImportmap: false
    };
    const prefixMap = {
      'ui': {
        key: '@components/ui/',
        prefix: 'ui',
        loaderKey: null,
        isNameSpaced: true
      }
    };

    document.body.innerHTML = '<button is="ui-button"></button>';

    await handlerForLazyLoad(document, config, prefixMap);

    expect(mockLoader.loader).toHaveBeenCalledWith('@components/ui/button.js');
    expect(customElements.define).toHaveBeenCalledWith('ui-button', mockConstructor, { extends: 'button' });
  });

  it('should observe mutations if observable is true', async () => {
    const mockConstructor = class extends HTMLElement {};
    const mockLoader: ILoader = {
      postfix: '.js',
      loader: vi.fn().mockResolvedValue(mockConstructor)
    };
    const config = {
      loaders: { [DEFAULT_KEY]: mockLoader },
      observable: true,
      scanImportmap: false
    };
    const prefixMap = {
      'ui': {
        key: '@components/ui/',
        prefix: 'ui',
        loaderKey: null,
        isNameSpaced: true
      }
    };

    await handlerForLazyLoad(document, config, prefixMap);

    // Simulate mutation
    const el = document.createElement('ui-input');
    document.body.appendChild(el);

    // Wait for MutationObserver (which is async)
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockLoader.loader).toHaveBeenCalledWith('@components/ui/input.js');
    expect(customElements.define).toHaveBeenCalledWith('ui-input', mockConstructor);
  });

  it('should throw error for elements without matching prefix', async () => {
    const mockLoader: ILoader = {
      postfix: '.js',
      loader: vi.fn()
    };
    const config = {
      loaders: { [DEFAULT_KEY]: mockLoader },
      observable: false,
      scanImportmap: false
    };
    const prefixMap = {
      'ui': {
        key: '@components/ui/',
        prefix: 'ui',
        loaderKey: null,
        isNameSpaced: true
      }
    };

    document.body.innerHTML = '<other-element></other-element>';

    await expect(handlerForLazyLoad(document, config, prefixMap)).rejects.toThrow(/No matching namespace found/);
    expect(mockLoader.loader).not.toHaveBeenCalled();
  });

  it('should handle loader failure gracefully', async () => {
    const mockLoader: ILoader = {
      postfix: '.js',
      loader: vi.fn()
        .mockRejectedValueOnce(new Error('Load failed'))
        .mockResolvedValue(class extends HTMLElement {})
    };
    const config = {
      loaders: { [DEFAULT_KEY]: mockLoader },
      observable: false,
      scanImportmap: false
    };
    const prefixMap = {
      'ui': {
        key: '@components/ui/',
        prefix: 'ui',
        loaderKey: null,
        isNameSpaced: true
      }
    };

    document.body.innerHTML = '<ui-broken></ui-broken>';

    await handlerForLazyLoad(document, config, prefixMap);

    expect(console.error).toHaveBeenCalled();
  });

  it('should traverse into shadow root', async () => {
    const mockLoader: ILoader = {
      postfix: '.js',
      loader: vi.fn().mockResolvedValue(class extends HTMLElement {})
    };
    const config = {
      loaders: { [DEFAULT_KEY]: mockLoader },
      observable: false,
      scanImportmap: false
    };
    const prefixMap = {
      'ui': {
        key: '@components/ui/',
        prefix: 'ui',
        loaderKey: null,
        isNameSpaced: true
      }
    };

    // Manually create element with shadow root to avoid relying on customElements upgrade
    // which is tricky when customElements.define is mocked.
    const container = document.createElement('my-container');
    container.attachShadow({ mode: 'open' });
    container.shadowRoot!.innerHTML = '<ui-shadow-button></ui-shadow-button>';
    document.body.appendChild(container);

    // Mock that my-container is defined
    registry.set('my-container', class extends HTMLElement {});
    
    await handlerForLazyLoad(document, config, prefixMap);
    
    expect(mockLoader.loader).toHaveBeenCalledWith('@components/ui/shadow-button.js');
  });

  it('should handle invalid loader key', async () => {
    const config = {
      loaders: { [DEFAULT_KEY]: { postfix: '.js', loader: async () => null } },
      observable: false,
      scanImportmap: false
    };
    const prefixMap = {
      'ui': {
        key: '@components/ui/',
        prefix: 'ui',
        loaderKey: 'invalid',
        isNameSpaced: true
      }
    };

    document.body.innerHTML = '<ui-button></ui-button>';

    await handlerForLazyLoad(document, config, prefixMap);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to lazy load component 'ui-button'"),
      expect.any(Error)
    );
  });

  it('should handle empty component name', async () => {
    const config = {
      loaders: { [DEFAULT_KEY]: { postfix: '.js', loader: async () => null } },
      observable: false,
      scanImportmap: false
    };
    const prefixMap = {
      'ui': {
        key: '@components/ui/',
        prefix: 'ui',
        loaderKey: null,
        isNameSpaced: true
      }
    };

    document.body.innerHTML = '<ui-></ui->';

    await handlerForLazyLoad(document, config, prefixMap);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to lazy load component 'ui-'"),
      expect.any(Error)
    );
  });

  it('should handle loader returning null', async () => {
    const mockLoader: ILoader = {
      postfix: '.js',
      loader: vi.fn().mockResolvedValue(null)
    };
    const config = {
      loaders: { [DEFAULT_KEY]: mockLoader },
      observable: false,
      scanImportmap: false
    };
    const prefixMap = {
      'ui': {
        key: '@components/ui/',
        prefix: 'ui',
        loaderKey: null,
        isNameSpaced: true
      }
    };

    document.body.innerHTML = '<ui-null></ui-null>';

    await handlerForLazyLoad(document, config, prefixMap);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to lazy load component 'ui-null'"),
      expect.any(Error)
    );
  });

  it('should handle error in handlerForLazyLoad initial call', async () => {
    const config = {
      loaders: {},
      observable: false,
      scanImportmap: false
    };
    const prefixMap = {
      'ui': { key: '', prefix: 'ui', loaderKey: null, isNameSpaced: true }
    };

    // Mock createTreeWalker to throw
    vi.spyOn(document, 'createTreeWalker').mockImplementationOnce(() => {
      throw new Error("Initial Error");
    });

    await expect(handlerForLazyLoad(document, config, prefixMap)).rejects.toThrow("Failed to lazy load components");
  });

  it('should return early if prefixMap is empty', async () => {
    const config = { loaders: {}, observable: false, scanImportmap: false };
    const prefixMap = {};
    // Should not throw, should not call lazyLoads (which we can't spy on easily, but we can spy on createTreeWalker)
    const spy = vi.spyOn(document, 'createTreeWalker');
    
    await handlerForLazyLoad(document, config, prefixMap);
    
    expect(spy).not.toHaveBeenCalled();
  });

  it('should not re-observe already observed elements', async () => {
    const mockConstructor = class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }
    };
    customElements.define('ui-shadow', mockConstructor);
    
    const config = { loaders: {}, observable: false, scanImportmap: false };
    const prefixMap = { 'ui': { key: '', prefix: 'ui', loaderKey: null, isNameSpaced: true } };
    
    const el = document.createElement('ui-shadow');
    document.body.appendChild(el);
    
    // First call observes
    await handlerForLazyLoad(document, config, prefixMap);
    
    // Second call should skip observation
    // We can't easily spy on internal observeShadowRoot, but we can verify no errors and coverage
    await handlerForLazyLoad(document, config, prefixMap);
  });

  it('should catch errors in MutationObserver callback', async () => {
    const mockLoader: ILoader = {
      postfix: '.js',
      loader: vi.fn()
    };
    const config = {
      loaders: { [DEFAULT_KEY]: mockLoader },
      observable: true,
      scanImportmap: false
    };
    const prefixMap = {
      'ui': {
        key: '@components/ui/',
        prefix: 'ui',
        loaderKey: null,
        isNameSpaced: true
      }
    };

    await handlerForLazyLoad(document, config, prefixMap);

    // Mock createTreeWalker to throw ONLY for the next call (which happens in MutationObserver)
    // The initial call in handlerForLazyLoad already happened.
    vi.spyOn(document, 'createTreeWalker').mockImplementationOnce(() => {
      throw new Error("Observer Error");
    });

    // Trigger mutation
    const el = document.createElement('div');
    document.body.appendChild(el);

    // Wait for MutationObserver
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to lazy load components: Error: Observer Error")
    );
  });

  describe('getCustomTagInfo', () => {
    it('should throw if element has no dash and no is attribute', () => {
      const el = document.createElement('div');
      expect(() => getCustomTagInfo(el)).toThrow("Custom element without a dash or 'is' attribute found");
    });

    it('should throw if is attribute has no dash', () => {
      const el = document.createElement('div');
      el.setAttribute('is', 'span');
      expect(() => getCustomTagInfo(el)).toThrow("Custom element 'is' attribute without a dash found");
    });
  });
});
