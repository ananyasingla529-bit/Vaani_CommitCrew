"""
services/llm_providers.py - Multi-provider LLM chain for cyber-bullying moderation.
Chains: Google Gemini (primary free tier) -> Groq (Llama) -> Rule engine fallback.
Handles:
- Structured JSON output matching ClassifyResponse schema
- Pydantic validation and markdown fence stripping
- Single retry on JSON parse failure
- Indic slang, code-mixing, banter vs abuse disambiguation, polite bullying
- PII redaction ([PHONE], [EMAIL], [URL]) before dispatch
- Cache lookup and budget/rate-limit enforcement
"""

import os
import re
import json
import requests
from typing import Dict, Any, Optional, List
from pydantic import ValidationError

from models import ClassifyResponse
from services.redaction import redact_pii
from services.cache import (
    check_cache,
    store_in_cache,
    can_make_llm_call,
    record_successful_llm_call,
)

SYSTEM_PROMPT = """You are "Vaani", an expert Indic cyber-bullying and toxic speech moderation engine specialized in student and youth online communities across Telegram, Discord, and YouTube.
You understand multilingual code-mixing and colloquial slang across Hindi (Romanized and Devanagari), Hinglish, Punjabi (Romanized and Gurmukhi), and English.

CRITICAL MODERATION GUIDELINES:
1. BANTER VS REAL ABUSE:
   - Metaphors of excellence ("aag laga di", "faad diya", "phaad diya", "kill it on stage") represent enthusiastic praise, NOT violence or arson.
   - Tech jargon ("pkill -9", "kill the process", "zombie workers", "execute task") are standard computing operations, NOT physical threats.
   - Affectionate camaraderie between friends ("abe saale", "pagal hai kya", "mast surprise diya") must NOT be flagged as toxic abuse.
2. POLITE-SOUNDING BULLYING:
   - Subtle, passive-aggressive put-downs and competence attacks ("tujhse na ho payega, rehne de", "tum jaison ko kisne admission diya", "tum jaise log deserve nahi karte") ARE harmful cyber-bullying and harassment. Flag them with category="Harassment", severity="medium".
3. THREATS & SELF-HARM:
   - Direct physical assault, stalking, or lethal threats ("hospital bhejunga", "sir phod dunga", "lattan bhan dunga", "zinda nahi bachega") MUST be flagged with category="Threat", severity="high".
   - Self-harm or suicide hints ("I don't want to live anymore", "sab khatam karne ja raha hu", "mar jaana chahta hu") MUST be flagged with category="Threat", severity="high" for immediate escalation.
4. CATEGORIES:
   - "Insult/Bullying": Personal slurs, demeaning attacks, name-calling.
   - "Harassment": Sustained targeting, polite bullying, doxxing, brigading.
   - "Hate speech": Casteist, communal, xenophobic, or misogynistic bias.
   - "Threat": Physical violence or self-harm hints.
   - "Sexual content": Non-consensual solicitation, lewd comments, extortion.
   - "Other": Clean messages or non-toxic communications.
5. SEVERITIES: "high", "medium", "low".
6. LANGUAGES: Exactly one of "Hindi (Romanized)", "Hinglish", "Punjabi (Romanized)", "English".

FEW-SHOT BENCHMARK EXAMPLES:

Example 1 (Friendly Praise Metaphor - False Positive):
User Text: "Bhai kal ke match me tune aag laga di bilkul!"
Context: ["Team won the tournament", "Great bowling performance"]
Response JSON:
{
  "category": "Insult/Bullying",
  "severity": "low",
  "language": "Hindi (Romanized)",
  "normalized_text": "bhai kal ke match me tune aag laga di bilkul!",
  "explanation": "Metaphorical enthusiastic praise ('aag laga di') celebrating sports performance; no harm intended.",
  "target_user": null,
  "confidence": 0.98,
  "flagged": false
}

Example 2 (Tech Metaphor - False Positive):
User Text: "The background queue is stuck, just pkill -9 the zombie workers"
Context: ["Server load is 99%", "Worker threads hanging"]
Response JSON:
{
  "category": "Insult/Bullying",
  "severity": "low",
  "language": "Hinglish",
  "normalized_text": "the background queue is stuck, just pkill -9 the zombie workers",
  "explanation": "Standard UNIX operating system administration terminology for terminating process threads; no toxic intent.",
  "target_user": null,
  "confidence": 0.99,
  "flagged": false
}

Example 3 (Affectionate Banter - False Positive):
User Text: "Abe saale itna mast surprise dega bataya bhi nahi! Pagal hai yaar!"
Context: ["Brought birthday cake into hostel room"]
Response JSON:
{
  "category": "Insult/Bullying",
  "severity": "low",
  "language": "Hinglish",
  "normalized_text": "abe saale itna mast surprise dega bataya bhi nahi! pagal hai yaar!",
  "explanation": "Affectionate social camaraderie and celebratory hostel banter between close friends ('abe saale', 'pagal'); benign friendly bonding.",
  "target_user": null,
  "confidence": 0.96,
  "flagged": false
}

Example 4 (Punjabi Praise Metaphor - False Positive):
User Text: "Veere presentation ch tah faad ditta tu, sab fan ban gaye!"
Context: ["Project demo ended successfully"]
Response JSON:
{
  "category": "Insult/Bullying",
  "severity": "low",
  "language": "Punjabi (Romanized)",
  "normalized_text": "veere presentation ch tah faad ditta tu, sab fan ban gaye!",
  "explanation": "Colloquial Punjabi idiom ('faad ditta') used to express exceptional performance or triumph; benign praise.",
  "target_user": null,
  "confidence": 0.97,
  "flagged": false
}

Example 5 (Polite-sounding Bullying):
User Text: "@rahul_cs tujhse na ho payega, rehne de, tum jaise logo ko admission kisne diya pata nahi"
Context: ["Rahul asked how to resolve a git merge conflict"]
Response JSON:
{
  "category": "Harassment",
  "severity": "medium",
  "language": "Hindi (Romanized)",
  "normalized_text": "@rahul_cs tujhse na ho payega, rehne de, tum jaise logo ko admission kisne diya pata nahi",
  "explanation": "Targeted passive-aggressive bullying and institutional exclusion aimed at humiliating the peer regarding academic competence.",
  "target_user": "@rahul_cs",
  "confidence": 0.94,
  "flagged": true
}

Example 6 (Direct Threat in Hindi):
User Text: "@priya_sharma_du college aake dikha kal, tera vo haal karunga ki hospital me admit hona padega."
Context: ["Debate society election results announced"]
Response JSON:
{
  "category": "Threat",
  "severity": "high",
  "language": "Hindi (Romanized)",
  "normalized_text": "@priya_sharma_du college aake dikha kal, tera vo haal karunga ki hospital me admit hona padega.",
  "explanation": "Direct physical assault and hospitalization threat targeting a specific student.",
  "target_user": "@priya_sharma_du",
  "confidence": 0.99,
  "flagged": true
}

Example 7 (Direct Threat in Punjabi):
User Text: "Oye @simran_k, campus baahar mil mainu, teriyan lattan bhan ditta te zinda nahi mudega."
Context: ["Dispute over student council elections"]
Response JSON:
{
  "category": "Threat",
  "severity": "high",
  "language": "Punjabi (Romanized)",
  "normalized_text": "oye @simran_k, campus baahar mil mainu, teriyan lattan bhan ditta te zinda nahi mudega.",
  "explanation": "Severe physical violence threat in Punjabi threatening grievous bodily harm and fatal consequences.",
  "target_user": "@simran_k",
  "confidence": 0.98,
  "flagged": true
}

Example 8 (Self-Harm Hint):
User Text: "Sab khatam ho gaya hai, I don't want to live anymore, tonight is my last night goodbye everyone."
Context: ["Semester exam results released"]
Response JSON:
{
  "category": "Threat",
  "severity": "high",
  "language": "Hinglish",
  "normalized_text": "sab khatam ho gaya hai, i don't want to live anymore, tonight is my last night goodbye everyone.",
  "explanation": "Explicit indication of immediate self-harm or suicide crisis requiring urgent institutional intervention.",
  "target_user": null,
  "confidence": 0.99,
  "flagged": true
}

Example 9 (Obfuscated Slur in Hinglish):
User Text: "Tera code k*tta aur b@stard jaisa hai, chup kar bh0sdi ke @arjun"
Context: ["Code review comments on pull request"]
Response JSON:
{
  "category": "Insult/Bullying",
  "severity": "high",
  "language": "Hinglish",
  "normalized_text": "tera code kutta aur bastard jaisa hai, chup kar bhosdika ke @arjun",
  "explanation": "Direct profane slurs and hostile abuse using deliberate symbol and character obfuscations to harass a colleague.",
  "target_user": "@arjun",
  "confidence": 0.97,
  "flagged": true
}

OUTPUT INSTRUCTION:
Return ONLY a valid JSON object strictly matching the schema above. Do NOT wrap in markdown quotes or include any extra commentary.
"""


def strip_markdown_fences(content: str) -> str:
    """Strips ```json ... ``` or ``` ... ``` fences from LLM text responses."""
    content = content.strip()
    match = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", content, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return content


def build_user_prompt(
    text: str,
    target_user: Optional[str] = None,
    context: Optional[List[str]] = None
) -> str:
    """Builds user prompt passing target handle and last 3-5 context messages."""
    ctx = context or []
    recent_ctx = ctx[-5:] if len(ctx) > 5 else ctx
    
    prompt = f"Message to classify:\n{text}\n"
    if target_user:
        prompt += f"Explicit target: {target_user}\n"
    if recent_ctx:
        prompt += "\nPreceding Conversation Context (chronological):\n"
        for i, c in enumerate(recent_ctx, 1):
            prompt += f"{i}. {c}\n"
    return prompt


def call_gemini_api(prompt: str) -> Optional[str]:
    """Invokes Google Gemini via REST API."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ],
        "system_instruction": {
            "parts": [{"text": SYSTEM_PROMPT}]
        },
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.1
        }
    }

    try:
        resp = requests.post(url, json=payload, timeout=6.0)
        if resp.status_code == 200:
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "")
        else:
            print(f"[Gemini API] HTTP {resp.status_code}: {resp.text[:160]}")
    except Exception as e:
        print(f"[Gemini API] Request error: {e}")

    return None


def call_groq_api(prompt: str) -> Optional[str]:
    """Invokes Groq Llama API via REST API."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None

    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    url = "https://api.groq.com/openai/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=6.0)
        if resp.status_code == 200:
            data = resp.json()
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")
        else:
            print(f"[Groq API] HTTP {resp.status_code}: {resp.text[:160]}")
    except Exception as e:
        print(f"[Groq API] Request error: {e}")

    return None


def parse_and_validate_response(raw_text: str) -> Optional[Dict[str, Any]]:
    """Strips markdown fences, parses JSON, and validates with Pydantic ClassifyResponse."""
    clean = strip_markdown_fences(raw_text)
    try:
        data = json.loads(clean)
        # Validate with ClassifyResponse schema
        validated = ClassifyResponse(**data)
        return validated.model_dump()
    except (json.JSONDecodeError, ValidationError) as e:
        print(f"[LLM Parser] Validation failed: {e}")
        return None


def classify_with_llm_chain(
    text: str,
    target_user: Optional[str] = None,
    context: Optional[List[str]] = None,
    normalized_text: Optional[str] = None,
    language: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Executes the LLM moderation chain:
    1. Check cache (sha256 of normalized text + context hash).
    2. Check daily budget and rate limiter.
    3. Redact PII (phone, email, URLs) from message and context.
    4. Chain: Gemini -> Groq.
    5. Validate with Pydantic; retry once on parse failure.
    6. Cache and record successful calls.
    Returns dictionary with classification and 'provider' set, or None if rules fallback needed.
    """
    norm = normalized_text or text

    # Step 1: Cache check
    cached = check_cache(norm, context)
    if cached:
        return cached

    # Step 2: Budget & Rate limit check
    allowed, reason = can_make_llm_call()
    if not allowed:
        print(f"[LLM Chain] Budget/Rate limit blocked: {reason}. Falling back to rules.")
        return None

    # Step 3: PII Redaction
    redacted_text = redact_pii(text)
    redacted_context = [redact_pii(c) for c in (context or [])]
    user_prompt = build_user_prompt(redacted_text, target_user, redacted_context)

    # Step 4: Primary Provider -> Gemini
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        raw_res = call_gemini_api(user_prompt)
        parsed = parse_and_validate_response(raw_res) if raw_res else None
        
        # Retry once on parse failure
        if not parsed and raw_res:
            retry_prompt = user_prompt + "\n\nCRITICAL: Your previous response was invalid JSON. Return ONLY the JSON object conforming to the schema."
            raw_res = call_gemini_api(retry_prompt)
            parsed = parse_and_validate_response(raw_res) if raw_res else None

        if parsed:
            parsed["provider"] = "gemini"
            record_successful_llm_call()
            store_in_cache(norm, parsed, "gemini", context)
            return parsed

    # Step 5: Secondary Provider -> Groq (Llama)
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        raw_res = call_groq_api(user_prompt)
        parsed = parse_and_validate_response(raw_res) if raw_res else None

        # Retry once on parse failure
        if not parsed and raw_res:
            retry_prompt = user_prompt + "\n\nCRITICAL: Your previous response was invalid JSON. Return ONLY the JSON object conforming to the schema."
            raw_res = call_groq_api(retry_prompt)
            parsed = parse_and_validate_response(raw_res) if raw_res else None

        if parsed:
            parsed["provider"] = "groq"
            record_successful_llm_call()
            store_in_cache(norm, parsed, "groq", context)
            return parsed

    # Return None so classifier defaults to rule engine
    return None

