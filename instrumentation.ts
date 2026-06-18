export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import the worker to start listening to jobs on the queue
    await import('./lib/queue/reportWorker');
    console.log('[instrumentation] BullMQ analysis worker registered successfully.');
  }
}
