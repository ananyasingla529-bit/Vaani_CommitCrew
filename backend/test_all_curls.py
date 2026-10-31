"""
test_all_curls.py - Starts the Vaani FastAPI backend and executes curl commands
for Tasks 1 through 8 in strict sequence, displaying command and output.
"""

import subprocess
import time
import sys
import os
import json
import urllib.request
import urllib.error

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# Ensure working directory is backend
os.chdir(os.path.dirname(os.path.abspath(__file__)))


def run_curl(cmd: str, desc: str):
    print("=" * 80)
    print(f"TEST: {desc}")
    print(f"COMMAND: {cmd}")
    print("-" * 80)
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8")
    stdout = result.stdout.strip()
    stderr = result.stderr.strip()
    if stdout:
        try:
            parsed = json.loads(stdout)
            print("OUTPUT (JSON):\n" + json.dumps(parsed, indent=2, ensure_ascii=False))
        except Exception:
            print("OUTPUT:\n" + stdout)
    if stderr and result.returncode != 0:
        print("ERROR:\n" + stderr)
    print("=" * 80 + "\n")


def main():
    # Start uvicorn server as background process
    print("[TestRunner] Starting Vaani FastAPI server on http://127.0.0.1:8000 ...")
    server_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    # Poll until server is ready
    ready = False
    for _ in range(30):
        time.sleep(0.5)
        try:
            req = urllib.request.urlopen("http://127.0.0.1:8000/", timeout=1)
            if req.status == 200:
                ready = True
                break
        except Exception:
            pass

    if not ready:
        print("[TestRunner] Error: Server failed to start within timeout.")
        server_proc.kill()
        sys.exit(1)

    print("[TestRunner] Server is online. Executing Task 1 - 8 curl tests...\n")

    try:
        # TASK 1: Normalization & Script Detection
        # 1a. Repeated characters & Leetspeak
        run_curl(
            'curl -s -X POST http://127.0.0.1:8000/classify -H "Content-Type: application/json" -d "{\\"text\\": \\"kaminaaaa tu ek b@stard hai bh0sdi ke\\"}"',
            "Task 1.1: Normalization (Repeated characters & Leetspeak/symbols: kaminaaaa, b@stard, bh0sdi)"
        )

        # 1b. Spacing tricks & spelling clusters
        run_curl(
            'curl -s -X POST http://127.0.0.1:8000/classify -H "Content-Type: application/json" -d "{\\"text\\": \\"c h u t i y a b k l nikal yaha se\\"}"',
            "Task 1.2: Normalization (Spacing tricks: 'c h u t i y a' & 'b k l' spelling cluster)"
        )

        # 1c. Emoji insults
        run_curl(
            'curl -s -X POST http://127.0.0.1:8000/classify -H "Content-Type: application/json" -d "{\\"text\\": \\"tu ek suar aur clown hai\\"}"',
            "Task 1.3: Normalization (Emoji insult equivalents: suar, clown)"
        )

        # 1d. Devanagari script detection & transliteration
        run_curl(
            'curl -s -X POST http://127.0.0.1:8000/classify -H "Content-Type: application/json" -d "{\\"text\\": \\"तू कुत्ता और कमीना है\\"}"',
            "Task 1.4: Script Detection & Transliteration (Devanagari script -> Hindi (Romanized))"
        )

        # 1e. Gurmukhi script detection & transliteration
        run_curl(
            'curl -s -X POST http://127.0.0.1:8000/classify -H "Content-Type: application/json" -d "{\\"text\\": \\"ਕੈਂਪਸ ਬਾਹਰ ਮਿਲ, ਤੇਰੀਆਂ ਲੱਤਾਂ ਭੰਨ ਦਿਆਂਗਾ\\"}"',
            "Task 1.5: Script Detection & Transliteration (Gurmukhi script -> Punjabi (Romanized))"
        )

        # TASK 2: Two-tier pipeline
        # 2a. Clearly safe message (Tier 1 returns flagged=False with NO LLM call)
        run_curl(
            'curl -s -X POST http://127.0.0.1:8000/classify -H "Content-Type: application/json" -d "{\\"text\\": \\"Good morning everyone, reminder about the sync meeting at 10 AM\\"}"',
            "Task 2.1: Two-Tier Pipeline (Tier 1 clearly safe: flagged=False, NO LLM call)"
        )

        # 2b. Borderline / flagged message (Tier 2 evaluation)
        run_curl(
            'curl -s -X POST http://127.0.0.1:8000/classify -H "Content-Type: application/json" -d "{\\"text\\": \\"@rahul_cs tujhse na ho payega, rehne de\\", \\"target_user\\": \\"@rahul_cs\\"}"',
            "Task 2.2: Two-Tier Pipeline (Tier 2 borderline/polite bullying detection)"
        )

        # TASK 3: LLM Providers & Indic Slang / Banter Nuance
        # 3a. Friendly Banter False Positive
        run_curl(
            'curl -s -X POST http://127.0.0.1:8000/classify -H "Content-Type: application/json" -d "{\\"text\\": \\"bhai kal ke match me tune aag laga di bilkul!\\", \\"context\\": [\\"Team won the tournament\\", \\"Great bowling performance\\"]}"',
            "Task 3.1: LLM Providers - Metaphorical Banter False Positive ('aag laga di' -> flagged=False)"
        )

        # 3b. Tech Metaphor False Positive
        run_curl(
            'curl -s -X POST http://127.0.0.1:8000/classify -H "Content-Type: application/json" -d "{\\"text\\": \\"The background queue is stuck, just pkill -9 the zombie workers\\", \\"context\\": [\\"Server load 99%\\"]}"',
            "Task 3.2: LLM Providers - Tech Terminology False Positive ('pkill -9' -> flagged=False)"
        )

        # 3c. Direct Threat & Self-Harm Hint (High Severity)
        run_curl(
            r'curl -s -X POST http://127.0.0.1:8000/classify -H "Content-Type: application/json" -d "{\"text\": \"Sab khatam ho gaya hai, I do not want to live anymore, tonight is my last night goodbye everyone.\"}"',
            "Task 3.3: LLM Providers - Self-harm crisis hint -> Threat (severity=high, flagged=True)"
        )

        # TASK 4: Cache & Budget
        run_curl(
            'curl -s -X POST http://127.0.0.1:8000/classify -H "Content-Type: application/json" -d "{\\"text\\": \\"tera sir phod dunga agar kal dikha to\\"}"',
            "Task 4: Cache & Budget - First call (caches normalized text + context hash)"
        )

        # TASK 5: Redaction
        run_curl(
            'curl -s -X POST http://127.0.0.1:8000/classify -H "Content-Type: application/json" -d "{\\"text\\": \\"Spam her phone +91 9876543210 and leak her private pics on https://t.me/du_leaks\\"}"',
            "Task 5: Redaction - Redacts phone (+91 9876543210) & URL (https://t.me/du_leaks) before LLM"
        )

        # TASK 6: Stats computed from Database
        run_curl(
            'curl -s -X GET http://127.0.0.1:8000/stats',
            "Task 6: Stats Endpoint (GET /stats computed live from database: scanned, avg_review_time, flags_over_time)"
        )

        # TASK 7: Repeat Targets with Pile-On Detection
        run_curl(
            'curl -s -X GET http://127.0.0.1:8000/repeat-targets',
            "Task 7: Repeat Targets Endpoint (GET /repeat-targets: pile_on_detected with 2+ platforms or 3+ senders/24h)"
        )

        # TASK 8: Evaluation Benchmark Summary
        run_curl(
            'curl -s -X GET http://127.0.0.1:8000/eval/summary',
            "Task 8: Evaluation Endpoint (GET /eval/summary: 89 labeled cases, accuracy, precision, recall, F1)"
        )

    finally:
        print("[TestRunner] Stopping Vaani FastAPI server...")
        server_proc.terminate()
        try:
            server_proc.wait(timeout=3)
        except Exception:
            server_proc.kill()
        print("[TestRunner] Server stopped cleanly.")


if __name__ == "__main__":
    main()
