/// <reference lib="webworker" />
// Kociemba's two-phase solver (cubejs) in a worker: building its tables takes a few seconds.
import Cube from './vendor-cubejs.js';

let ready = false;

self.onmessage = (e: MessageEvent<{ id: number; facelets: string }>) => {
  const { id, facelets } = e.data;
  try {
    if (!ready) {
      Cube.initSolver();
      ready = true;
    }
    const solution = Cube.fromString(facelets).solve();
    self.postMessage({ id, moves: solution.split(' ').filter(Boolean) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
