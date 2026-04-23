if (event.type === "PAGE_GENERATED") {
  for (const page of event.payload) {
    console.log("PUBLISH:", page.title);

    await redis.xadd("aivis_stream", "*", "data", JSON.stringify({
      id: crypto.randomUUID(),
      job_id: event.job_id,
      type: "PUBLISHED",
      payload: { url: `/pages/${page.entity}` },
      ts: Date.now()
    }));
  }
}
