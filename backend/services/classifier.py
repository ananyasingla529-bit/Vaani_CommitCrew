"""
services/classifier.py - Multilingual cyber-bullying classification service.
Supports Hindi (Romanized), Hinglish, Punjabi (Romanized), and English.
Includes:
- Task 1: Script detection (Latin, Devanagari, Gurmukhi, mixed),
  transliteration normalizer for repeated characters, leetspeak/symbols,
  spacing tricks, emoji insults, and spelling-variant clusters.
  Optional IndicXlit transliteration behind a try/except import.
- Task 2: Two-tier pipeline:
  Tier 1 = lexicon + existing rules; clearly safe messages return flagged=False with NO LLM call.
  Tier 2 = LLM judge (Gemini -> Groq -> rules engine fallback) for flagged/borderline messages.
"""

import re
import os
from typing import Dict, Any, Optional, List

# Optional IndicXlit transliteration behind a try/except import
try:
    import importlib
    _xlit_mod = importlib.import_module("ai4bharat.transliteration")
    _xlit_engine = _xlit_mod.XlitEngine(["hi", "pa"], beam_width=4, rescore=False)
except Exception:
    _xlit_engine = None


# Unicode Ranges
DEVANAGARI_RANGE = (0x0900, 0x097F)
GURMUKHI_RANGE = (0x0A00, 0x0A7F)
LATIN_RANGE = (0x0041, 0x007A)  # A-Z, a-z

# Phonetic character mapping for Devanagari fallback transliteration
DEVANAGARI_MAP = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
    'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'an', 'अः': 'ah',
    'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
    'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ँ': 'n', 'ः': 'h', '्': '',
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'ड़': 'd', 'ढ़': 'dh', 'फ़': 'f', 'ज़': 'z', 'क़': 'q', 'ख़': 'kh', 'ग़': 'g'
}

# Phonetic character mapping for Gurmukhi fallback transliteration
GURMUKHI_MAP = {
    'ੳ': 'u', 'ਅ': 'a', 'ਆ': 'aa', 'ਇ': 'i', 'ਈ': 'ee', 'ਉ': 'u', 'ਊ': 'oo',
    'ਏ': 'e', 'ਐ': 'ai', 'ਓ': 'o', 'ਔ': 'au', 'ੲ': 'i', 'ਸ': 's', 'ਹ': 'h',
    'ਕ': 'k', 'ਖ': 'kh', 'ਗ': 'g', 'ਘ': 'gh', 'ਙ': 'ng',
    'ਚ': 'ch', 'ਛ': 'chh', 'ਜ': 'j', 'ਝ': 'jh', 'ਞ': 'ny',
    'ਟ': 't', 'ਠ': 'th', 'ਡ': 'd', 'ਢ': 'dh', 'ਣ': 'n',
    'ਤ': 't', 'ਥ': 'th', 'ਦ': 'd', 'ਧ': 'dh', 'ਨ': 'n',
    'ਪ': 'p', 'ਫ': 'ph', 'ਬ': 'b', 'ਭ': 'bh', 'ਮ': 'm',
    'ਯ': 'y', 'ਰ': 'r', 'ਲ': 'l', 'ਵ': 'v', 'ੜ': 'r',
    'ਸ਼': 'sh', 'ਜ਼': 'z', 'ਫ਼': 'f', 'ਖ਼': 'kh', 'ਗ਼': 'g',
    'ਾ': 'aa', 'ਿ': 'i', 'ੀ': 'ee', 'ੁ': 'u', 'ੂ': 'oo',
    'ੇ': 'e', 'ੈ': 'ai', 'ੋ': 'o', 'ੌ': 'au', 'ੰ': 'n', 'ਂ': 'n', '੍': ''
}

# Emoji insults dictionary
EMOJI_INSULTS = {
    "🤡": " clown idiot ",
    "💩": " poop tatti ",
    "🖕": " fuck off gaali ",
    "🐷": " suar pig ",
    "🐽": " suar pig ",
    "🐕": " kutta dog ",
    "🐶": " kutta dog ",
    "👞": " chittar joota ",
    "🥿": " chittar joota ",
    "🐍": " saanp snake ",
    "🤫": " chup silence ",
    "🤮": " vomit disgusting ",
    "🐀": " chooha rat ",
    "🐒": " bandar monkey "
}


def detect_script(text: str) -> str:
    """
    Detects script using Unicode ranges:
    - Devanagari: U+0900 to U+097F
    - Gurmukhi: U+0A00 to U+0A7F
    - Latin: ASCII A-Z, a-z
    Returns: 'Latin', 'Devanagari', 'Gurmukhi', or 'mixed'
    """
    dev_count = 0
    gur_count = 0
    lat_count = 0

    for ch in text:
        cp = ord(ch)
        if DEVANAGARI_RANGE[0] <= cp <= DEVANAGARI_RANGE[1]:
            dev_count += 1
        elif GURMUKHI_RANGE[0] <= cp <= GURMUKHI_RANGE[1]:
            gur_count += 1
        elif (0x0041 <= cp <= 0x005A) or (0x0061 <= cp <= 0x007A):
            lat_count += 1

    scripts_present = []
    if dev_count > 0:
        scripts_present.append(("Devanagari", dev_count))
    if gur_count > 0:
        scripts_present.append(("Gurmukhi", gur_count))
    if lat_count > 0:
        scripts_present.append(("Latin", lat_count))

    if not scripts_present:
        return "Latin"
    if len(scripts_present) == 1:
        return scripts_present[0][0]

    # Check if mixed with significant proportion
    counts = [c for _, c in scripts_present]
    total = sum(counts)
    significant = [s for s, c in scripts_present if c >= 2 and (c / total) > 0.15]
    if len(significant) > 1:
        return "mixed"

    scripts_present.sort(key=lambda x: x[1], reverse=True)
    return scripts_present[0][0]


def transliterate_indic_chars(text: str) -> str:
    """Phonetically transliterates Devanagari and Gurmukhi characters to Romanized text."""
    if _xlit_engine is not None:
        try:
            return _xlit_engine.translit_sentence(text, lang_code="hi")
        except Exception:
            pass

    chars = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        # Handle Gurmukhi adhak ੱ (doubles next consonant)
        if ch == 'ੱ' and i + 1 < n:
            next_ch = text[i + 1]
            mapped = GURMUKHI_MAP.get(next_ch, next_ch)
            chars.append(mapped)
            chars.append(mapped)
            i += 2
            continue

        if ch in DEVANAGARI_MAP:
            chars.append(DEVANAGARI_MAP[ch])
        elif ch in GURMUKHI_MAP:
            chars.append(GURMUKHI_MAP[ch])
        else:
            chars.append(ch)
        i += 1

    res = "".join(chars)
    # Fix common transliteration phonetic tokens
    res = re.sub(r'\bkhtm\b', 'khatam', res)
    res = re.sub(r'\brhne\b', 'rehne', res)
    res = re.sub(r'\bsb\b', 'sab', res)
    res = re.sub(r'\bkutaa\b', 'kutta', res)
    res = re.sub(r'\bkmeenaa\b', 'kameena', res)
    res = re.sub(r'\blt+aan\b', 'lattan', res)
    res = re.sub(r'\bbhnn\b', 'bhan', res)
    res = re.sub(r'\bdiya[an]\b', 'diya', res)
    return res


def despace_spacing_tricks(text: str) -> str:
    """
    Collapses single-character spacing tricks (e.g., 'c h u t i y a' -> 'chutiya',
    'k u t t a' -> 'kutta', 'b c' -> 'bc', 'm c' -> 'mc', 'b k l' -> 'bkl').
    """
    known_slang_and_tricks = {
        "chutiya", "kutta", "bc", "mc", "bkl", "saale", "bhosdi", "bsdk",
        "kameena", "kamina", "bastard", "randi", "gandu", "laude", "lode",
        "harami", "madarchod", "bhenchod", "chapri", "kanjar", "chirkut",
        "kuttey", "kutti", "chootiya", "lawda", "suar", "chomu"
    }

    def unspace_match(m):
        raw = m.group(0)
        parts = raw.split()
        joined = "".join(parts).lower()
        if joined in known_slang_and_tricks:
            return joined
        # Check if joined consists of two known slang words joined together
        for trick in sorted(known_slang_and_tricks, key=len, reverse=True):
            if joined.startswith(trick) and len(joined) > len(trick):
                rem = joined[len(trick):]
                if rem in known_slang_and_tricks:
                    return f"{trick} {rem}"
        if len(parts) >= 4:
            return joined
        return raw

    pattern = r'\b[A-Za-z](?:\s+[A-Za-z])+\b'
    return re.sub(pattern, unspace_match, text)


def normalize_leetspeak(text: str) -> str:
    """Converts leetspeak substitutions and obscured spellings."""
    replacements = [
        (r'b@stard|b\*stard|ba\$tard', 'bastard'),
        (r'bh0sdi|bh0sdika|bhos\*|bsdk|bhosd[i*]+', 'bhosdika'),
        (r'k\*tta|k\*tte|k\*tti|k\*tteya', 'kutta'),
        (r'k\*meeni|k\*meena|kam33na', 'kameena'),
        (r'm@r\s*daloonga|mar\s*dalunga|maar\s*daloonga|m@r\s*dunga|m@r\s*ja', 'maar daloonga'),
        (r'ch\*tiya|chut!ya|ch00tiya', 'chutiya'),
        (r'r\*ndi|r@ndi|r\*\*di', 'randi'),
        (r'g@ndu|g\*ndu|g4ndu', 'gandu'),
        (r'l@wde|l0de|l@de|l\*de', 'laude'),
        (r'auk@t|auk\*t', 'aukat'),
        (r'kanj\*r|k\*njar', 'kanjar'),
        (r'thappad\s*maro?onga|chaped\s*maaran', 'thappad marunga'),
        (r'lattan\s*bhan\s*dunga|lattan\s*bhan\s*doonga', 'lattan bhan doonga'),
    ]
    for pat, rep in replacements:
        text = re.sub(pat, rep, text, flags=re.IGNORECASE)

    # General character leetspeak inside words (avoiding emails)
    text = re.sub(r'(?<=[a-zA-Z0-9])@(?![\w.-]+\.[a-zA-Z]{2,})', 'a', text)
    text = re.sub(r'(?<=[a-zA-Z])0(?=[a-zA-Z])', 'o', text)
    text = re.sub(r'(?<=[a-zA-Z])1(?=[a-zA-Z])', 'i', text)
    text = re.sub(r'(?<=[a-zA-Z])\$(?=[a-zA-Z])', 's', text)
    text = re.sub(r'(?<=[a-zA-Z])3(?=[a-zA-Z])', 'e', text)
    text = re.sub(r'(?<=[a-zA-Z])!(?=[a-zA-Z])', 'i', text)
    return text


def normalize_repeated_chars(text: str) -> str:
    """Collapses 3+ identical consecutive letters to 1."""
    return re.sub(r'([a-zA-Z])\1{2,}', r'\1', text)


def normalize_spelling_clusters(text: str) -> str:
    """Standardizes spelling-variant clusters to canonical terms."""
    clusters = [
        (r'\b(kamina|kamine|kameena|kameeni|kameeney|kamini|kameene|kamin[aeio]+)\b', 'kameena'),
        (r'\b(bkl|bhen\s*ke?\s*lode|behen\s*ke?\s*lode|bhen\s*k\s*lode)\b', 'bhen ke lode'),
        (r'\b(bhenchod|behenchod|bhen\s*chod|behen\s*chod|b\.c\b|b\/c\b|\bbc\b)\b', 'bhenchod'),
        (r'\b(madarchod|madar\s*chod|maderchod|m\.c\b|m\/c\b|\bmc\b|mkc)\b', 'madarchod'),
        (r'\b(kutta|kuttey|kutte|kutti|kuttiya|kutteya)\b', 'kutta'),
        (r'\b(bhosdi|bhosdika|bhosdike|bsdk|bhosda|bhosadike)\b', 'bhosdika'),
        (r'\b(chutiya|chootiya|chutye|chutiye|chutiyapa)\b', 'chutiya'),
        (r'\b(lauda|laude|lode|loda|lawda|lawde)\b', 'laude'),
        (r'\b(harami|haraami|haramkhor|haraamkhor)\b', 'harami'),
        (r'\b(gandu|gaandu)\b', 'gandu'),
        (r'\b(randi|rundee|rand)\b', 'randi'),
    ]
    for pat, rep in clusters:
        text = re.sub(pat, rep, text, flags=re.IGNORECASE)
    return text


def normalize_transliteration(text: str) -> str:
    """Full normalization pipeline for Task 1."""
    normalized = text

    # Step 1: Indic Script Transliteration
    normalized = transliterate_indic_chars(normalized)

    # Step 2: Emoji insults
    for emoji_char, replacement in EMOJI_INSULTS.items():
        if emoji_char in normalized:
            normalized = normalized.replace(emoji_char, replacement)

    # Step 3: Spacing tricks
    normalized = despace_spacing_tricks(normalized)

    # Step 4: Leetspeak / symbols
    normalized = normalize_leetspeak(normalized)

    # Step 5: Repeated characters
    normalized = normalize_repeated_chars(normalized)

    # Step 6: Spelling clusters
    normalized = normalize_spelling_clusters(normalized)

    # Collapse excess spaces
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    return normalized


def detect_language(text: str) -> str:
    """Maintains exact 4 labels."""
    lower = text.lower()
    script = detect_script(text)

    if script == "Gurmukhi":
        return "Punjabi (Romanized)"
    if script == "Devanagari":
        return "Hindi (Romanized)"

    punjabi_markers = [
        "oye", "mainu", "tainu", "tuhanu", "kitta", "kiven", "pind",
        "lattan", "chittar", "saanu", "chaped", "wargi", "ehna", "ne", "ae",
        "kudi", "munda", "sohni", "veere", "paaji", "si", "ga", "ge",
        "karanga", "hunda", "hunde", "changa", "maada", "gallan"
    ]
    if any(re.search(rf"\b{word}\b", lower) for word in punjabi_markers):
        return "Punjabi (Romanized)"

    hindi_markers = [
        "tu", "tera", "teri", "tere", "hai", "hain", "mai", "main", "kya",
        "kyun", "yahan", "wahan", "karenge", "marunga", "saale", "chup",
        "aurat", "aadmi", "ladki", "ladka", "sharam", "tujhse", "kar", "karna",
        "raha", "rahi", "de", "do", "khatam", "bhai", "yaar", "aukat", "aukaat",
        "sir", "phod", "jaan", "bhejo", "nikal"
    ]
    has_hindi = any(re.search(rf"\b{word}\b", lower) for word in hindi_markers)

    english_markers = [
        "meeting", "server", "channel", "code", "repo", "office", "report",
        "discord", "video", "interview", "mentor", "hackathon", "project",
        "team", "presentation", "review", "slide", "bug", "pr", "algorithm"
    ]
    has_english = any(re.search(rf"\b{word}\b", lower) for word in english_markers)

    if has_hindi and has_english:
        return "Hinglish"
    if has_hindi:
        return "Hindi (Romanized)"
    return "English"


# ============================================================================
# TIER 1: Lexicon & Rules Engine
# ============================================================================

def is_clearly_safe_tier1(text: str, normalized: str) -> bool:
    """
    Tier 1 gate: checks if a message is unmistakably clean and safe.
    Clearly safe messages return flagged=False with NO LLM call.
    """
    combined = (text + " " + normalized).lower()

    toxic_markers = [
        # Threats & Physical Violence
        "mar", "maar", "hospital", "sir phod", "lattan", "chaku", "stab",
        "kill", "murder", "goud", "chaped", "thappad", "suicide", "end my life",
        "khatam", "zinda", "pitwa", "uthwa", "break your legs", "dekh lunga",
        "chittar", "live anymore", "last night goodbye",
        # Slurs & Demeaning terms
        "kutta", "kameena", "bastard", "bhosdika", "bsdk", "bhenchod", "madarchod",
        "bkl", "chutiya", "harami", "gandu", "randi", "laude", "chapri", "kanjar",
        "chirkut", "chomu", "bhikari", "suar", "pig", "dog", "clown", "poop",
        "idiot", "loser", "scumbag", "pathetic", "joota", "joota marna",
        # Polite Bullying / Exclusion
        "tujhse na ho", "rehne de", "rahne de", "deserve nahi", "kisne admission",
        "aukaat", "aukat", "sharam", "tere bas ki", "nobody likes you",
        "leave the community",
        # Sexual / Hate speech
        "sex", "nude", "boobs", "leak", "pics", "quota", "desh se bahar", "caste",
        "dox", "mass report", "career khatam", "fired", "spam", "feminist",
        "ek raat ka", "figure hai", "corrupt committee",
        # Banter / False Positives needing inspection
        "aag laga di", "aag laa", "faad diya", "phaad diya", "faad ditta",
        "pkill", "dead laughing", "abe saale", "pagal hai yaar", "kill it"
    ]

    for marker in toxic_markers:
        if marker in combined:
            return False

    for emoji_char in EMOJI_INSULTS:
        if emoji_char in text:
            return False

    return True


def classify_rule_based(
    text: str,
    target_user: Optional[str] = None,
    normalized: Optional[str] = None,
    language: Optional[str] = None
) -> Dict[str, Any]:
    """Rule-based classification fallback used when MOCK_MODE=True or LLM calls fail."""
    if normalized is None:
        normalized = normalize_transliteration(text)
    if language is None:
        language = detect_language(text)

    lower = (text.lower() + " " + normalized.lower())

    if not target_user:
        mention = re.search(r'(?:^|\s)@([a-zA-Z0-9_]+)', text)
        if mention:
            target_user = f"@{mention.group(1)}"

    # 1. False Positives (Friendly Banter & Tech Metaphors)
    false_positive_patterns = [
        (r"aag laga di|aag lagadi|aag laa ditti", "Metaphorical phrase ('aag laga di' / 'aag laa ditti') used as enthusiastic praise for performance, not arson or threat."),
        (r"faad diya|phaad diya|faad ditta", "Colloquial Indic idiom expressing outstanding performance or success, not violence."),
        (r"dead laughing|dying of laughter", "Hyperbolic internet idiom 'dead laughing' indicates amusement, with no threatening intent."),
        (r"pkill|kill the process|kill -9|zombie workers", "Standard UNIX operating system administration terminology referring to terminating a computing task."),
        (r"pagal hai yaar|pagal hai kya", "'Pagal' (crazy) used affectionately in celebratory social banter regarding a surprise, gift, or fun."),
        (r"kill it (in|on) the (interview|presentation|stage|match)|algorithm is killer", "Idiomatic encouragement wishing success in performance or interview."),
        (r"abe saale", "Affectionate informal camaraderie and peer greeting between close friends with no abusive intent."),
    ]

    for pat, expl in false_positive_patterns:
        if re.search(pat, lower):
            return {
                "category": "Insult/Bullying",
                "severity": "low",
                "language": language,
                "normalized_text": normalized,
                "explanation": f"FALSE POSITIVE: {expl}",
                "target_user": target_user,
                "confidence": 0.94,
                "flagged": False,
                "provider": "rules",
            }

    # 2. Threats & Self-Harm Hints (High Severity)
    threat_patterns = [
        r"m@r daloonga|mar dunga|maar daloonga|hospital|sir phod|lattan bhan|zinda nahi|chaku|chaped|thappad|stab|goud dunga|gher lenge",
        r"kill you|murder|break your legs|break your neck|shoot you|dox your address|jaan se maar|dekh lunga|ghar se uthwa|chittar pehnge|chittar",
        r"suicide|end my life|sab khatam|jeene ka man nahi|mar jaana chahta|goodbye everyone forever|don't want to live|last night goodbye|live anymore"
    ]
    if any(re.search(pat, lower) for pat in threat_patterns):
        return {
            "category": "Threat",
            "severity": "high",
            "language": language,
            "normalized_text": normalized,
            "explanation": "Explicit physical assault, lethal violence, stalking threat, or self-harm hint detected.",
            "target_user": target_user,
            "confidence": 0.96,
            "flagged": True,
            "provider": "rules",
        }

    # 3. Sexual Content & Extortion
    sexual_patterns = [
        r"sex chat|private pics|leak your phone|figure hai|babe|nude|boobs|undress|ek raat ka|call girl"
    ]
    if any(re.search(pat, lower) for pat in sexual_patterns):
        return {
            "category": "Sexual content",
            "severity": "high",
            "language": language,
            "normalized_text": normalized,
            "explanation": "Unsolicited sexual solicitation, extortion, or objectification directed at community participant.",
            "target_user": target_user,
            "confidence": 0.95,
            "flagged": True,
            "provider": "rules",
        }

    # 4. Hate Speech
    hate_patterns = [
        r"desh se bahar|north east|quota wale|feminists are cancer|feminist|community ke log|caste|bhagao yaha se|chamar|bhangi|katue|mulle|khalistani"
    ]
    if any(re.search(pat, lower) for pat in hate_patterns):
        return {
            "category": "Hate speech",
            "severity": "high",
            "language": language,
            "normalized_text": normalized,
            "explanation": "Discriminatory rhetoric, xenophobic bias, or collective dehumanizing hate speech targeting protected groups.",
            "target_user": target_user,
            "confidence": 0.93,
            "flagged": True,
            "provider": "rules",
        }

    # 5. Targeted Harassment / Polite Bullying / Brigading
    polite_bullying_patterns = [
        r"tujhse na ho|rehne de|rahne de|tere bas ki|tum jaise log|tum jaison ko kisne admission|deserve nahi",
        r"nobody likes you|leave the community|spam|dox|get you fired|career khatam|mass report|withdraw her nomination|corrupt committee"
    ]
    if any(re.search(pat, lower) for pat in polite_bullying_patterns):
        return {
            "category": "Harassment",
            "severity": "high" if "dox" in lower or "fired" in lower or "career khatam" in lower else "medium",
            "language": language,
            "normalized_text": normalized,
            "explanation": "Passive-aggressive undermining, social exclusion, coordinated brigading, or targeted harassment detected.",
            "target_user": target_user,
            "confidence": 0.92,
            "flagged": True,
            "provider": "rules",
        }

    # 6. Insults & Cyber-Bullying
    insult_patterns = [
        r"kutta|kameena|bastard|bhosdika|bhen ke lode|bhenchod|madarchod|chutiya|laude|harami|gandu|randi|chirkut|chapri|idiot|loser|scumbag|chomu|bhikari|kanjar|aukaat|aukat|joota|suar|clown|poop"
    ]
    if any(re.search(pat, lower) for pat in insult_patterns):
        is_high = any(k in lower for k in ["bhosdika", "bhenchod", "madarchod", "randi", "gandu", "laude", "bhen ke lode"])
        return {
            "category": "Insult/Bullying",
            "severity": "high" if is_high else "medium",
            "language": language,
            "normalized_text": normalized,
            "explanation": "Hostile personal insults, profane slurs, or demeaning abuse detected in community text.",
            "target_user": target_user,
            "confidence": 0.90,
            "flagged": True,
            "provider": "rules",
        }

    # 7. Clean / Safe Default
    return {
        "category": "Other",
        "severity": "low",
        "language": language,
        "normalized_text": normalized,
        "explanation": "No toxic markers, slurs, or threats detected. Passes community safety threshold.",
        "target_user": target_user,
        "confidence": 0.88,
        "flagged": False,
        "provider": "rules",
    }


def classify_text(
    text: str,
    target_user: Optional[str] = None,
    context: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Main classification entry point.
    Signature:
    classify_text(text: str, target_user: Optional[str] = None, context: Optional[List[str]] = None) -> dict
    """
    normalized = normalize_transliteration(text)
    language = detect_language(text)

    if not target_user:
        mention = re.search(r'(?:^|\s)@([a-zA-Z0-9_]+)', text)
        if mention:
            target_user = f"@{mention.group(1)}"

    # Tier 1 Gate: Check if clearly safe
    if is_clearly_safe_tier1(text, normalized):
        return {
            "category": "Other",
            "severity": "low",
            "language": language,
            "normalized_text": normalized,
            "explanation": "No toxic markers or threats detected. Message is clearly safe.",
            "target_user": target_user,
            "confidence": 0.95,
            "flagged": False,
            "provider": "rules"
        }

    # Tier 2: Flagged or borderline message -> LLM Judge
    mock_mode = os.getenv("MOCK_MODE", "True").lower() == "true"
    has_keys = bool(os.getenv("GEMINI_API_KEY") or os.getenv("GROQ_API_KEY"))

    if not mock_mode and has_keys:
        try:
            from services.llm_providers import classify_with_llm_chain
            llm_result = classify_with_llm_chain(
                text=text,
                target_user=target_user,
                context=context,
                normalized_text=normalized,
                language=language
            )
            if llm_result:
                return llm_result
        except Exception as e:
            print(f"[Classifier] Tier 2 LLM exception, falling back to rules: {e}")

    # Fallback to rule engine
    return classify_rule_based(
        text=text,
        target_user=target_user,
        normalized=normalized,
        language=language
    )
