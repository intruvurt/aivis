# Redis Consumer Groups — Correct Pattern for Workers

## THE PROBLEM (❌ WRONG)

```typescript
// ❌ CRITICAL BUG: Using "$" as starting position
const data = await redis.xread("BLOCK", 0, "STREAMS", "aivis_stream", "$");
```

### What "$" means:
- **"$" = current position** — only receive messages added AFTER this point
- **On worker restart**: All messages sent while worker was down are LOST
- **On new worker added**: It misses all historical backlog
- **Result**: System becomes inconsistent, visibility gaps occur, citations get skipped

### Example of the disaster:
```
Time 1:  API sends: {type: "SCAN_START", url: "example.com"}
Time 2:  API sends: {type: "SCAN_DONE", entities: [...]}
Time 3:  Worker crashes 💥
Time 4:  Worker restarts with "$" → both messages are ignored
Time 5:  System thinks example.com was never scanned → visibility gap
```

---

## THE SOLUTION (✅ CORRECT)

### Use Consumer Groups

Consumer groups are Redis' built-in mechanism for:
- **Tracking which messages each worker has processed**
- **Re-delivering unacknowledged messages** to other workers
- **Scaling workers independently** without losing messages
- **Preventing duplicate processing** in distributed systems

### Correct Pattern

```typescript
// ✅ Step 1: Create consumer group (one-time initialization)
await redis.xgroup(
  "CREATE",
  "aivis_stream",        // stream name
  "workers",             // group name
  "$",                   // START FROM THIS POINT FORWARD (not historical)
  "MKSTREAM"             // auto-create stream if missing
);

// ✅ Step 2: Each worker reads from the group
const data = await redis.xreadgroup(
  "GROUP",
  "workers",             // group name
  "scan-worker-1",       // consumer ID (unique per worker instance)
  "BLOCK",
  0,                     // block indefinitely until message arrives
  "STREAMS",
  "aivis_stream",
  ">"                    // ">" = give me new messages I haven't processed
);

// ✅ Step 3: Process the message
const event = JSON.parse(data[0][1][0][1][1]);
const result = await process(event);

// ✅ Step 4: ONLY acknowledge after successful processing
await redis.xack("aivis_stream", "workers", messageId);
```

---

## Key Concepts

### Consumer Group = Persistent State Machine

| Operation | Effect |
|-----------|--------|
| `XGROUP CREATE` | Initialize group with starting position |
| `XREADGROUP ... ">"` | Read NEW messages (not yet assigned to any consumer) |
| `XACK` | Mark message as processed (removes from pending queue) |
| `XPENDING` | See messages waiting for ACK (per consumer or group-wide) |

### Why the ">" matters

- **">" = unprocessed messages** — includes:
  - New messages never seen by any consumer
  - Messages pending for THIS consumer (not ACKed yet)
- **Not "$"** — "$" is only for initialization, not reading

### Message Lifecycle

```
NEW MESSAGE ARRIVES
         ↓
    [Stream]
         ↓
XREADGROUP ... ">" assigns it to this consumer
         ↓
    [Consumer's pending queue]
         ↓
   Process & ACK ✓
         ↓
 [Message REMOVED from stream]
         ↓
    (Next consumer won't see it)

BUT if we crash before ACK:
    [Consumer's pending queue]
         ↓
   Worker restarts
         ↓
XREADGROUP sees pending messages for THIS consumer
         ↓
   Re-delivers the same message (no loss!)
```

---

## Complete Worker Implementation

### 1. Initialize (once per worker type)

```typescript
async function initializeWorker() {
  const consumer = new StreamConsumerGroup({
    streamKey: "aivis_stream",
    groupName: "scan-workers",
    consumerId: `${hostname}-${pid}`,
    blockTimeMs: 5000,
    maxBatchSize: 10,
  });

  await consumer.initialize();
  return consumer;
}
```

### 2. Read & Process (main loop)

```typescript
async function workerLoop(consumer: StreamConsumerGroup) {
  while (true) {
    // Read next batch (blocks until messages arrive or timeout)
    const messages = await consumer.readNextBatch();

    if (!messages.length) continue;

    for (const msg of messages) {
      try {
        // ✅ Parse & validate
        const event = parseAndValidate(msg.data);

        // ✅ Execute business logic
        const result = await scanTargetUrl(event.url);

        // ✅ ACK only after success
        await consumer.acknowledgeMessage(msg.id);

        console.log(`✓ Processed ${msg.id}`);
      } catch (err) {
        // ❌ Don't ACK on error
        // Message stays in pending queue
        // Next worker will retry it

        // Optional: move to DLQ after N retries
        await consumer.sendToDLQ(msg.id, err);

        console.error(`✗ Failed ${msg.id}: ${err.message}`);
      }
    }
  }
}
```

### 3. Scaling

```bash
# Start multiple workers (each gets unique consumer ID)
docker-compose up --scale scan-worker=3
docker-compose up --scale entity-worker=2
docker-compose up --scale gap-worker=1

# Redis automatically distributes new messages among consumers
# Failed/pending messages are redistributed to available consumers
```

---

## Comparison Table

| Aspect | ❌ WRONG: xread "$" | ✅ CORRECT: Consumer Group |
|--------|-----|----------|
| **Lost events on restart** | YES — all missed events are gone | NO — pending messages redeliver |
| **Scaling** | Each worker gets duplicates | Each worker gets unique subset |
| **Failure handling** | Manual retry logic needed | Automatic via pending queue |
| **Monitoring** | No way to see pending | `XPENDING` shows stuck messages |
| **Dead-letter queue** | Must implement manually | Built-in via DLQ pattern |
| **Code complexity** | Simple but fragile | More setup, rock solid |

---

## Real-World Scenarios

### Scenario 1: Worker Crash During Processing
```
Message 1: {type: "SCAN_START", url: "example.com"}
Worker receives Message 1
Worker starts processing...
CRASH 💥 (before ACK)

Worker restarts
Worker gets Message 1 again (still pending!)
Re-processes successfully
ACK → Message removed
```

### Scenario 2: Scaling Up
```
Day 1: 1 worker handling 1000 messages/hour
Day 2: Add 2 more workers (now 3 total)
Redis automatically rebalances:
  - New messages distributed to 3 workers
  - Each worker gets ~1/3 of load
  - Throughput goes up 3x
  - No message loss during transition
```

### Scenario 3: Circuit Breaker Pattern
```
External API goes down
Worker tries to call API → fails
Message not ACKed → stays pending
Worker tries again (retry loop)
API recovers
Worker succeeds
Message ACKed
→ No duplicate processing, no infinite loops
```

---

## Monitoring & Operations

### Check pending messages (stuck jobs)

```typescript
const pending = await redis.xpending("aivis_stream", "workers");
// [numPending, earliest_id, latest_id, [[consumer, count], ...]]

// Example: 50 messages pending for scan-worker-1
console.log(pending);
// [50, "...-0", "...-49", [["scan-worker-1", 50]]]
```

### Manual retry (stuck message)

```typescript
// Re-assign pending message to another consumer
await redis.xclaim(
  "aivis_stream",
  "workers",
  "scan-worker-2",
  0,              // timeout: immediately claim
  messageId
);
```

### Delete consumer group (reset)

```typescript
await redis.xgroup("DESTROY", "aivis_stream", "workers");
// Group deleted, all pending messages lost
// Next XGROUP CREATE starts fresh
```

---

## Integration with AiVIS

### Using StreamConsumerGroup Helper

```typescript
import { createStreamConsumer } from './infra/streams/consumerGroupHelper.js';
import { getProgressTracker } from './services/workerProgressSSE.js';

async function startScanWorker() {
  const consumer = await createStreamConsumer({
    streamKey: 'aivis_stream',
    groupName: 'scan-workers',
    consumerId: `scan-worker-${process.pid}`,
    blockTimeMs: 5000,
    maxBatchSize: 10,
  });

  const tracker = getProgressTracker();
  tracker.registerWorker('scan-worker-1', 'aivis_stream', 'scan-workers');

  while (true) {
    const messages = await consumer.readNextBatch();
    for (const msg of messages) {
      try {
        await processScan(msg);
        await consumer.acknowledgeMessage(msg.id);
        tracker.incrementProcessed('scan-worker-1');
      } catch (err) {
        await consumer.sendToDLQ(msg.id, err);
        tracker.incrementFailed('scan-worker-1');
      }
    }
  }
}
```

### UI Real-Time Progress (SSE)

```typescript
// Client-side
const es = new EventSource('/api/workers/scan-worker-1/progress');
es.onmessage = (e) => {
  const metrics = JSON.parse(e.data);
  updateProgressBar(metrics.messagesProcessed, metrics.pendingMessages);
};
```

---

## Checklist for New Workers

- [ ] Use `StreamConsumerGroup` helper
- [ ] Call `initialize()` once at startup
- [ ] Read with `readNextBatch()` (uses `">"`)
- [ ] Parse incoming message with error handling
- [ ] ACK only after successful processing
- [ ] Send failures to DLQ with context
- [ ] Register with `WorkerProgressTracker`
- [ ] Emit progress updates for UI
- [ ] Implement graceful shutdown
- [ ] Test with forced crashes (pull Docker container)
- [ ] Verify no message loss after restart
- [ ] Load test with multiple workers
- [ ] Monitor DLQ for systematic failures

---

## Reference

| Component | File | Purpose |
|-----------|------|---------|
| **Helper** | `infra/streams/consumerGroupHelper.ts` | Consumer group abstraction |
| **Template** | `workers/exampleStreamWorker.template.ts` | Copy and adapt this |
| **SSE Service** | `services/workerProgressSSE.ts` | Real-time progress tracking |
| **Routes** | `routes/workerProgressRoutes.ts` | Progress API endpoints |
