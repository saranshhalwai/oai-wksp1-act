import { it, expect } from 'vitest';
import { WorkerPool } from '../../apps/server/src/pool';
import { generateTerrain, settle } from '../../packages/terrain/src/index';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
it('worker pool rejects unavailable admission without accumulating jobs', async () => { const pool=new WorkerPool(0,0); const mask=generateTerrain(1); const tanks=[settle(mask,{x:140,y:250,slot:0}),settle(mask,{x:884,y:250,slot:1})]; await expect(pool.run({mask,tanks,shooter:0,aim:{angle:45,power:60,weapon:'standard'},wind:0,version:0})).rejects.toThrow('queue'); await pool.close(); expect(pool.queued).toBe(0); });
it('terminates over-deadline workers and clears pending jobs on shutdown', async()=>{const pool=new WorkerPool(1,2,1,pathToFileURL(resolve('dist/server/worker.js')));const mask=generateTerrain(1);const input={mask,tanks:[settle(mask,{x:140,y:250,slot:0}),settle(mask,{x:884,y:250,slot:1})],shooter:0,aim:{angle:90,power:100,weapon:'cluster' as const},wind:0,version:0};await expect(pool.run(input)).rejects.toThrow('deadline');expect(pool.metrics.errors).toBe(1);await pool.close();await expect(pool.run(input)).rejects.toThrow('unavailable');});
