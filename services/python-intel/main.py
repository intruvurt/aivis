from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class EntityRequest(BaseModel):
    text: str

@app.post("/extract-entities")
def extract_entities(req: EntityRequest):
    # placeholder NLP logic
    entities = [
        {"name": "AI Visibility", "type": "concept", "confidence": 0.92}
    ]

    return {
        "entities": entities,
        "relationships": []
    }
