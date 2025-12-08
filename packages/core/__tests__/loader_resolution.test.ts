import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eagerLoad, resetState } from '../src/autoload.js';
import { DEFAULT_KEY } from '../src/config.js';

describe('loader resolution priority', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetState();
    vi.clearAllMocks();
    vi.spyOn(customElements, 'define');
  });

  it('should prioritize longer postfix match', async () => {
    const mockJsLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
    const mockLitLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
    
    const loaders = {
      [DEFAULT_KEY]: {
        postfix: '.ts',
        loader: vi.fn()
      },
      'simple-loader': {
        postfix: '.js',
        loader: mockJsLoader
      },
      'lit-loader': {
        postfix: '.lit.js',
        loader: mockLitLoader
      }
    };

    const loadMap = {
      'my-component': {
        key: 'src/components/my-component.lit.js',
        tagName: 'my-component',
        loaderKey: null,
        extends: null
      }
    };

    await eagerLoad(loadMap, loaders);

    expect(mockLitLoader).toHaveBeenCalledWith('src/components/my-component.lit.js');
    expect(mockJsLoader).not.toHaveBeenCalled();
  });

  it('should handle chained aliases in loader config', async () => {
    const mockRealLoader = vi.fn().mockResolvedValue(class extends HTMLElement {});
    
    const loaders = {
      [DEFAULT_KEY]: {
        postfix: '.js',
        loader: vi.fn()
      },
      'alias1': 'alias2',
      'alias2': 'realLoader',
      'realLoader': {
        postfix: '.real',
        loader: mockRealLoader
      }
    };

    const loadMap = {
      'my-component': {
        key: 'src/components/my-component.real',
        tagName: 'my-component',
        loaderKey: null,
        extends: null
      }
    };

    await eagerLoad(loadMap, loaders);

    expect(mockRealLoader).toHaveBeenCalledWith('src/components/my-component.real');
  });
});
