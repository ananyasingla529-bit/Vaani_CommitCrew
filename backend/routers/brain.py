"""
routers/brain.py - API router for Brain endpoints: evaluation summary, cache, and model health.
"""

from fastapi import APIRouter
from typing import Dict, Any
import os
import json

router = APIRouter(prefix="", tags=["brain"])


@router.get("/eval/summary")
def get_eval_summary() -> Dict[str, Any]:
    """
    Returns latest offline/online evaluation metric summary (precision, recall, F1, per-language).
    """
    summary_path = os.path.join(os.path.dirname(__file__), "..", "eval", "latest_summary.json")
    if os.path.exists(summary_path):
        try:
            with open(summary_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            return {"status": "error", "message": f"Failed reading eval summary: {e}"}
    
    return {
        "status": "pending",
        "message": "Evaluation has not been run yet. Run backend/eval/run_eval.py to generate summary."
    }

