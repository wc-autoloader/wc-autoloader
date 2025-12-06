import { describe, it, expect } from 'vitest';
import { addLoader } from '../src/addLoader.js';
import { config } from '../src/config.js';

describe('addLoader', () => {
  it('should add a new loader to config', () => {
    const newLoader = {
      postfix: '.test.js',
      loader: async () => null
    };
    
    addLoader('test', newLoader);
    
    expect(config.loaders.test).toBe(newLoader);
  });
});
