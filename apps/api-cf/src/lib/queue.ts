/**
 * Cloudflare Queues integration for scan jobs
 *
 * Replaces BullMQ/Redis with Cloudflare Queues.
 * Queue messages are sent to the queue consumer worker.
 */

/**
 * Queue message format for scan jobs
 */
export interface ScanJobMessage {
  jobId: string;
  url: string;
  userId: string;
}

/**
 * Send a scan job to the Cloudflare Queue
 * @param queue - Cloudflare Queue binding
 * @param message - Scan job message
 */
export async function sendScanJobToQueue(
  queue: Queue<ScanJobMessage>,
  message: ScanJobMessage,
): Promise<void> {
  await queue.send(message);
}

/**
 * Batch send multiple scan jobs to the queue
 * @param queue - Cloudflare Queue binding
 * @param messages - Array of scan job messages
 */
export async function sendScanJobsToQueue(
  queue: Queue<ScanJobMessage>,
  messages: ScanJobMessage[],
): Promise<void> {
  const batch = messages.map((body) => ({
    body,
    contentType: "json" as const,
  }));

  await queue.sendBatch(batch);
}
