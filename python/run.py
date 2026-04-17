"""Run the AiVIS.biz Deep Analysis Engine.

Usage:
    python -m python.run            # From workspace root
    cd python && uvicorn app:app    # Alternative
"""

import os
import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("PYTHON_PORT", "3002"))
    host = os.getenv("PYTHON_HOST", "127.0.0.1")
    reload = os.getenv("PYTHON_ENV") != "production"

    uvicorn.run(
        "python.app:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info",
    )
