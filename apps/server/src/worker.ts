import { parentPort } from 'node:worker_threads';
import { simulateShot, type ShotInput } from '../../../packages/physics/src/index';
parentPort!.on('message', ({ id, input }: { id: number; input: ShotInput }) => {
  const start = performance.now();
  try { const result = simulateShot(input); parentPort!.postMessage({ id, result, calculationMs: performance.now() - start }); }
  catch (e) { parentPort!.postMessage({ id, error: (e as Error).message }); }
});
