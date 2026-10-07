import { Worker } from 'node:worker_threads';
import type { ShotInput, ShotResult } from '../../../packages/physics/src/index';
interface Job { id: number; input: ShotInput; queued: number; resolve: (r: ShotResult) => void; reject: (e: Error) => void; timer?: NodeJS.Timeout }
interface Slot { worker: Worker; job?: Job }
export class WorkerPool {
  private slots: Slot[] = []; private queue: Job[] = []; private id = 0; private closed = false;
  metrics = { calculation: [] as number[], queueWait: [] as number[], errors: 0, completed: 0 };
  constructor(count = 1, private limit = 32, private timeoutMs = 2000, private workerUrl = new URL('./worker.js', import.meta.url)) { for (let i = 0; i < count; i++) this.slots.push(this.spawn()); }
  get queued() { return this.queue.length; } get busy() { return this.slots.filter(s => s.job).length; }
  private spawn(): Slot {
    const slot: Slot = { worker: new Worker(this.workerUrl) };
    slot.worker.on('message', msg => { const job = slot.job; if (!job || job.id !== msg.id) return; clearTimeout(job.timer); slot.job = undefined;
      if (msg.error) { this.metrics.errors++; job.reject(Error(msg.error)); } else { this.metrics.completed++; this.metrics.calculation.push(msg.calculationMs); this.metrics.calculation = this.metrics.calculation.slice(-1000); job.resolve(msg.result); } this.dispatch(); });
    slot.worker.on('error', e => this.fail(slot, e));
    slot.worker.on('exit', code => { if (!this.closed && this.slots.includes(slot) && code !== 0) this.fail(slot, Error(`Worker exited ${code}`)); }); return slot;
  }
  private fail(slot: Slot, e: Error) { if (!this.slots.includes(slot)) return; this.metrics.errors++; if (slot.job) { clearTimeout(slot.job.timer); slot.job.reject(e); slot.job = undefined; } const i = this.slots.indexOf(slot); this.slots.splice(i, 1); void slot.worker.terminate(); if (!this.closed) this.slots.push(this.spawn()); this.dispatch(); }
  run(input: ShotInput): Promise<ShotResult> { if (this.closed || this.queue.length >= this.limit) return Promise.reject(Error('Simulation queue unavailable'));
    return new Promise((resolve, reject) => { this.queue.push({ id: ++this.id, input, resolve, reject, queued: performance.now() }); this.dispatch(); }); }
  private dispatch() { if (this.closed) return; for (const slot of this.slots) { if (slot.job) continue; let job = this.queue.shift(); while (job && performance.now() - job.queued > 5000) { job.reject(Error('Queue deadline exceeded')); this.metrics.errors++; job = this.queue.shift(); } if (!job) continue;
    slot.job = job; this.metrics.queueWait.push(performance.now() - job.queued); this.metrics.queueWait = this.metrics.queueWait.slice(-1000); job.timer = setTimeout(() => this.fail(slot, Error('Worker deadline exceeded')), this.timeoutMs); slot.worker.postMessage({ id: job.id, input: job.input }); } }
  async close() { this.closed = true; for (const j of this.queue.splice(0)) j.reject(Error('Server stopping')); for (const s of this.slots) if (s.job) { clearTimeout(s.job.timer); s.job.reject(Error('Server stopping')); } await Promise.all(this.slots.map(s => s.worker.terminate())); }
}
