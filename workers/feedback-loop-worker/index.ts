if (event.type === "PUBLISHED") {
  await redis.xadd("aivis_stream", "*", "data", JSON.stringify({
    id: crypto.randomUUID(),
    job_id: event.job_id,
    type: "FEEDBACK_TRIGGERED",
    payload: { url: event.payload.url },
    ts: Date.now()
  }));
}
