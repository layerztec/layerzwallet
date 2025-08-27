import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from '../../class/swr-cache-serializer';

describe('serialize', () => {
  it('should serialize error', () => {
    const error = new Error('test');
    const serialized = serialize({ error });
    expect(serialized).toBe('{"error":{"message":"test"}}');
    const deserialized = deserialize(serialized);
    expect(deserialized.error.message).toBe(error.message);
  });
});
