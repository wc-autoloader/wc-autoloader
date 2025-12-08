import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eagerLoad, resetState } from '../src/autoload.js';
import { DEFAULT_KEY } from '../src/config.js';

describe('autoload advanced features', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetState();
    vi.clearAllMocks();
    vi.spyOn(customElements, 'define');
  });

  describe('postfix resolution', () => {
    it('should resolve loader based on file extension when loaderKey is not provided', async () => {
      const mockJsLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
      const mockCssLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
      
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: mockJsLoader
        },
        'css-loader': {
          postfix: '.css',
          loader: mockCssLoader
        }
      };

      const loadMap = {
        'my-style': {
          key: 'src/components/my-style.css',
          tagName: 'my-style',
          loaderKey: null,
          extends: null
        },
        'my-script': {
          key: 'src/components/my-script.js',
          tagName: 'my-script',
          loaderKey: null,
          extends: null
        }
      };

      await eagerLoad(loadMap, loaders);

      expect(mockCssLoader).toHaveBeenCalledWith('src/components/my-style.css');
      expect(mockJsLoader).toHaveBeenCalledWith('src/components/my-script.js');
    });

    it('should fallback to default loader if postfix does not match', async () => {
      const mockDefaultLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
      const mockCssLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
      
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: mockDefaultLoader
        },
        'css-loader': {
          postfix: '.css',
          loader: mockCssLoader
        }
      };

      const loadMap = {
        'my-unknown': {
          key: 'src/components/my-unknown.txt',
          tagName: 'my-unknown',
          loaderKey: null,
          extends: null
        }
      };

      await eagerLoad(loadMap, loaders);

      expect(mockDefaultLoader).toHaveBeenCalledWith('src/components/my-unknown.txt');
      expect(mockCssLoader).not.toHaveBeenCalled();
    });
  });

  describe('auto-extends resolution', () => {
    it('should automatically detect extends for built-in elements', async () => {
      const mockLoader = vi.fn().mockResolvedValue(class extends HTMLButtonElement {});
      
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: mockLoader
        }
      };

      const loadMap = {
        'my-button': {
          key: 'src/components/my-button.js',
          tagName: 'my-button',
          loaderKey: null,
          extends: null // Should be auto-detected
        }
      };

      await eagerLoad(loadMap, loaders);

      expect(customElements.define).toHaveBeenCalledWith(
        'my-button',
        expect.any(Function),
        { extends: 'button' }
      );
    });

    it('should not use extends option for autonomous custom elements', async () => {
      const mockLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
      
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: mockLoader
        }
      };

      const loadMap = {
        'my-element': {
          key: 'src/components/my-element.js',
          tagName: 'my-element',
          loaderKey: null,
          extends: null
        }
      };

      await eagerLoad(loadMap, loaders);

      expect(customElements.define).toHaveBeenCalledWith(
        'my-element',
        expect.any(Function)
      );
      // Verify the third argument was NOT passed (or is undefined/empty object if implementation differs, but here we expect 2 args)
      // Actually, my implementation calls define(tagName, constructor) if extends is null.
      // So we check that it was called with 2 arguments.
      expect(customElements.define).toHaveBeenCalledTimes(1);
      const args = vi.mocked(customElements.define).mock.calls[0];
      expect(args.length).toBe(2);
    });

    it('should respect explicit extends over auto-detected one', async () => {
      // This is an edge case, but if user provides extends, it should be used.
      // Even if the class extends HTMLButtonElement, if user says extends: 'div', we should trust the user (or maybe not? but current impl does)
      const mockLoader = vi.fn().mockResolvedValue(class extends HTMLButtonElement {});
      
      const loaders = {
        [DEFAULT_KEY]: {
          postfix: '.js',
          loader: mockLoader
        }
      };

      const loadMap = {
        'my-weird-button': {
          key: 'src/components/my-button.js',
          tagName: 'my-weird-button',
          loaderKey: null,
          extends: 'div'
        }
      };

      await eagerLoad(loadMap, loaders);

      expect(customElements.define).toHaveBeenCalledWith(
        'my-weird-button',
        expect.any(Function),
        { extends: 'div' }
      );
    });
  });
});
