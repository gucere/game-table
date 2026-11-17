import { describe, expect, it } from 'vitest';
import * as S from './sim';
import { SKINS, skinById } from './skins';

/** A canvas context that accepts every call, recording how many were made */
function fakeCtx() {
  let calls = 0;
  const gradient = { addColorStop: () => {} };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, key) {
      if (key in target) return target[key as string];
      if (key === 'calls') return calls;
      return (..._args: unknown[]) => {
        calls++;
        return key === 'createLinearGradient' ? gradient : undefined;
      };
    },
    set(target, key, value) {
      target[key as string] = value;
      return true;
    },
  });
  return ctx as unknown as CanvasRenderingContext2D & { calls: number };
}

describe('Yılan looks', () => {
  const states = (): S.Snake[] => {
    const plain = S.newSnake(false, () => 0.3);
    const walls = { ...S.newSnake(true, () => 0.6), bonus: { at: { x: 2, y: 2 }, ticks: 11 } };
    // Wrapped around the right edge, long, and crashed
    const wrapped: S.Snake = {
      ...S.newSnake(false, () => 0.1),
      body: [
        { x: 0, y: 5 },
        { x: 19, y: 5 },
        { x: 18, y: 5 },
        { x: 18, y: 6 },
        { x: 18, y: 7 },
      ],
      dir: 'right',
      dead: true,
    };
    return [plain, walls, wrapped];
  };

  it('every look draws every kind of moment without errors', () => {
    for (const skin of SKINS)
      for (const s of states()) {
        const ctx = fakeCtx();
        expect(() => skin.draw(ctx, s)).not.toThrow();
        expect(ctx.calls).toBeGreaterThan(10);
      }
  });

  it('has the classic look first and falls back to it', () => {
    expect(SKINS.map((k) => k.id)).toEqual(['classic', 'phone', 'gulls', 'train', 'neon']);
    expect(skinById(undefined).id).toBe('classic');
    expect(skinById('nope').id).toBe('classic');
  });
});
