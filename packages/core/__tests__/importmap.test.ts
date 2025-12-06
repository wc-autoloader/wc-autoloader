import { describe, it, expect, beforeEach } from 'vitest';
import { buildMap, loadImportmap } from '../src/importmap';

describe('importmap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('loadImportmap', () => {
    it('should return null when no importmap exists', () => {
      const result = loadImportmap();
      expect(result).toBeNull();
    });

    it('should parse importmap from script tag', () => {
      document.body.innerHTML = `
        <script type="importmap">
          {
            "imports": {
              "@components/button/": "./components/button/"
            }
          }
        </script>
      `;
      
      const result = loadImportmap();
      expect(result).toEqual({
        imports: {
          "@components/button/": "./components/button/"
        }
      });
    });

    it('should merge multiple importmap scripts', () => {
      document.body.innerHTML = `
        <script type="importmap">
          {
            "imports": {
              "@components/button/": "./components/button/"
            }
          }
        </script>
        <script type="importmap">
          {
            "imports": {
              "@components/card/": "./components/card/"
            }
          }
        </script>
      `;
      
      const result = loadImportmap();
      expect(result?.imports).toEqual({
        "@components/button/": "./components/button/",
        "@components/card/": "./components/card/"
      });
    });

    it('should throw error when importmap has invalid JSON', () => {
      document.body.innerHTML = `
        <script type="importmap">
          { invalid json }
        </script>
      `;
      
      expect(() => loadImportmap()).toThrow();
    });

    it('should handle empty importmap script', () => {
      document.body.innerHTML = `
        <script type="importmap">
        </script>
      `;
      
      expect(() => loadImportmap()).toThrow();
    });

    it('should handle malformed JSON in importmap', () => {
      document.body.innerHTML = `
        <script type="importmap">
          {"imports": {"test": }}
        </script>
      `;
      
      expect(() => loadImportmap()).toThrow();
    });
  });

  describe('buildMap', () => {
    it('should build prefix map for namespaced components', () => {
      const importmap = {
        imports: {
          "@components/ui/": "./components/ui/"
        }
      };
      
      const { prefixMap, loadMap } = buildMap(importmap);
      
      expect(prefixMap).toHaveProperty('ui');
      expect(prefixMap.ui).toEqual({
        key: "@components/ui/",
        prefix: "ui",
        loaderKey: null,
        isNameSpaced: true
      });
      expect(loadMap).toEqual({});
    });

    it('should build load map for specific components', () => {
      const importmap = {
        imports: {
          "@components/my-button": "./components/button.js"
        }
      };
      
      const { prefixMap, loadMap } = buildMap(importmap);
      
      expect(prefixMap).toEqual({});
      expect(loadMap).toHaveProperty('my-button');
      expect(loadMap['my-button']).toEqual({
        key: "@components/my-button",
        tagName: "my-button",
        loaderKey: null,
        extends: null,
        isNameSpaced: false
      });
    });

    it('should handle loader key in namespaced components', () => {
      const importmap = {
        imports: {
          "@components/ui|custom/": "./components/ui/"
        }
      };
      
      const { prefixMap } = buildMap(importmap);
      
      expect(prefixMap.ui).toEqual({
        key: "@components/ui|custom/",
        prefix: "ui",
        loaderKey: "custom",
        isNameSpaced: true
      });
    });

    it('should ignore non-component imports', () => {
      const importmap = {
        imports: {
          "lodash": "./node_modules/lodash/index.js",
          "@components/ui/": "./components/ui/"
        }
      };
      
      const { prefixMap, loadMap } = buildMap(importmap);
      
      expect(Object.keys(prefixMap)).toHaveLength(1);
      expect(prefixMap).toHaveProperty('ui');
    });

    it('should throw when namespace key is missing prefix', () => {
      const importmap = {
        imports: {
          "@components/|custom/": "./components/ui/"
        }
      };

      expect(() => buildMap(importmap)).toThrow('Invalid importmap key: @components/|custom/');
    });

    it('should throw when component key is missing tag name', () => {
      const importmap = {
        imports: {
          "@components/|custom": "./components/button.js"
        }
      };

      expect(() => buildMap(importmap)).toThrow('Invalid importmap key: @components/|custom');
    });

    it('should default loaderKey to null when loader info is absent', () => {
      const importmap = {
        imports: {
          "@components/native-element": "./components/native-element.js"
        }
      };

      const { loadMap } = buildMap(importmap);
      expect(loadMap['native-element']).toMatchObject({
        loaderKey: null,
        extends: null
      });
    });
  });
});
