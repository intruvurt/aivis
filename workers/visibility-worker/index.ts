import Redis from "ioredis";
import axios from "axios";

const redis = new Redis("redis://redis:6379");

async function probe(query: string) {
  const res = await axios.post("https://api.openai.com/v1/responses", {
    model: "gpt-4o-mini",
    input: query
  }, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    }
  });

  return res.data.output[0].content[0].text;
}

function detect(text: string) {
  const t = text.toLowerCase();
  return t.includes("aivis") || t.includes("aivis.biz");
}

async function run() {
  while (true) {
    const data = await redis.xread("BLOCK", 0, "STREAMS", "aivis_stream", "$");
    if (!data) continue;

    const event = JSON.parse(data[0][1][0][1][1]);

    if (event.type !== "PUBLISHED") continue;

    const entity = event.payload.url;

    const queries = [
      `What is ${entity}?`,
      `How does ${entity} work?`
    ];

    let hits = 0;

    for (const q of queries) {
      const response = await probe(q);
      if (detect(response)) hits++;
    }

    const score = hits / queries.length;

    await redis.xadd("aivis_stream", "*", "data", JSON.stringify({
      type: "FEEDBACK_TRIGGERED",
      job_id: event.job_id,
      payload: { entity, score },
      ts: Date.now()
    }));
  }
}

run();
