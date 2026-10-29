import { getTemporalClient } from './client.js';
import { ScheduleOverlapPolicy } from '@temporalio/client';
import { loadSourcesConfig } from '../sources/registry.js';
import { config } from '../config.js';

export async function createSchedules() {
  const client = await getTemporalClient();
  const sources = loadSourcesConfig();

  console.log(`Creating Temporal schedules for ${sources.length} sources...`);

  for (const src of sources) {
    const scheduleId = `schedule-watch-${src.id}`;
    try {
      await client.schedule.create({
        scheduleId,
        spec: {
          intervals: [{ every: `${src.pollMinutes}m` }],
        },
        action: {
          type: 'startWorkflow',
          workflowType: 'sourceWatchWorkflow',
          taskQueue: config.TEMPORAL_TASK_QUEUE,
          args: [{ sourceId: src.id }],
        },
        policies: {
          overlap: ScheduleOverlapPolicy.SKIP,
        },
      });
      console.log(`✓ Created schedule: ${scheduleId} (every ${src.pollMinutes}m)`);
    } catch (err: any) {
      if (err.name === 'ScheduleAlreadyRunning' || err.message?.includes('already exists')) {
        console.log(`~ Schedule ${scheduleId} already exists`);
      } else {
        console.error(`Failed to create schedule ${scheduleId}:`, err.message);
      }
    }
  }
}

export async function deleteSchedules() {
  const client = await getTemporalClient();
  const sources = loadSourcesConfig();

  console.log(`Deleting Temporal schedules for ${sources.length} sources...`);

  for (const src of sources) {
    const scheduleId = `schedule-watch-${src.id}`;
    try {
      const handle = client.schedule.getHandle(scheduleId);
      await handle.delete();
      console.log(`✓ Deleted schedule: ${scheduleId}`);
    } catch (err: any) {
      console.log(`~ Schedule ${scheduleId} not found or already deleted`);
    }
  }
}

if (process.argv[2] === 'create') {
  createSchedules().catch(console.error);
} else if (process.argv[2] === 'delete') {
  deleteSchedules().catch(console.error);
}
