from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class TextIn(BaseModel):
    text: str

@app.post("/entities")
def entities(req: TextIn):
    # lightweight deterministic NLP (replace with spaCy later)
    words = req.text.split()

    entities = [
        {"name": w, "type": "concept", "confidence": 0.7}
        for w in words[:5]
    ]

    return {
        "entities": entities,
        "relationships": []
    }

@app.post("/gap-score")
def gap_score(req: dict):
    return {
        "gap_score": 0.73,
        "missing": ["definition", "mechanism"]
    }
