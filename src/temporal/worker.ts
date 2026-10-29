import { Worker } from '@temporalio/worker';
import { createActivities } from './activities/index.js';
import { config } from '../config.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runWorker() {
  const activities = createActivities();

  const worker = await Worker.create({
    workflowsPath: path.resolve(__dirname, 'workflows'),
    activities,
    taskQueue: config.TEMPORAL_TASK_QUEUE,
  });

  console.log(`[Temporal Worker] Started listening on task queue: ${config.TEMPORAL_TASK_QUEUE}`);
  await worker.run();
}

if (process.argv[1] && process.argv[1].endsWith('worker.ts')) {
  runWorker().catch((err) => {
    console.error('Fatal worker error:', err);
    process.exit(1);
  });
}

