"""Text extraction, cleaning, chunking and lightweight NLP helpers (no AI needed)."""
from __future__ import annotations

import io
import math
import re
from collections import Counter
from dataclasses import dataclass

from config import settings

STOP_WORDS = set(
    """a about above after again against all also am an and any are aren't as at be because been
    before being below between both but by can can't cannot could couldn't did didn't do does doesn't
    doing don't down during each few for from further had hadn't has hasn't have haven't having he
    her here hers herself him himself his how i if in into is isn't it it's its itself just let's
    like me more most mustn't my myself no nor not now of off on once only or other ought our ours
    ourselves out over own same she should shouldn't so some such than that that's the their theirs
    them themselves then there there's these they this those through to too under until up upon us
    very was wasn't we were weren't what when where which while who whom why will with won't would
    wouldn't you your yours yourself yourselves one two three also may might must shall within without
    page pages using used use make made many much well even still get got however therefore thus
    since every another among though although whether either neither etc via per new first second
    able across along already always around back based become came come could each eg ie include
    including makes need needs often part rather really said says see seen several show shown take
    things thing think time times way ways want went work works year years""".split()
)

SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(\[])")


@dataclass
class Chunk:
    text: str
    index: int
    page: int | None


class ExtractionError(ValueError):
    pass


# ---------------------------------------------------------------- extraction
def clean_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"-\n(\w)", r"\1", text)          # join hyphenated line breaks
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_pdf(data: bytes) -> list[str]:
    """Return a list of cleaned page texts using pypdf (PyMuPDF used as fallback if installed)."""
    if not data.startswith(b"%PDF"):
        raise ExtractionError("File is not a valid PDF")
    pages: list[str] = []
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception as exc:  # noqa: BLE001
                raise ExtractionError("PDF is password protected") from exc
        for page in reader.pages:
            try:
                pages.append(clean_text(page.extract_text() or ""))
            except Exception:  # noqa: BLE001 - one bad page shouldn't kill the doc
                pages.append("")
    except ExtractionError:
        raise
    except Exception as exc:  # noqa: BLE001
        pages = _extract_pdf_pymupdf(data)
        if pages is None:
            raise ExtractionError(f"Could not read PDF: {exc}") from exc

    if not any(p.strip() for p in pages):
        fallback = _extract_pdf_pymupdf(data)
        if fallback and any(p.strip() for p in fallback):
            pages = fallback
        else:
            raise ExtractionError(
                "No extractable text found. The PDF may be scanned images (OCR is not supported yet)."
            )
    return pages


def _extract_pdf_pymupdf(data: bytes) -> list[str] | None:
    try:
        import fitz  # PyMuPDF (optional)
    except ImportError:
        return None
    try:
        with fitz.open(stream=data, filetype="pdf") as doc:
            return [clean_text(p.get_text()) for p in doc]
    except Exception:  # noqa: BLE001
        return None


def decode_text_file(data: bytes) -> str:
    if b"\x00" in data[:4096]:
        raise ExtractionError("File looks binary, not text")
    for enc in ("utf-8-sig", "utf-16", "latin-1"):
        try:
            text = data.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:  # pragma: no cover
        raise ExtractionError("Could not decode text file")
    text = clean_text(text)
    if not text:
        raise ExtractionError("File is empty")
    return text


# ---------------------------------------------------------------- chunking
def _split_long(sentence: str, size: int) -> list[str]:
    words = sentence.split()
    return [" ".join(words[i : i + size]) for i in range(0, len(words), size)]


def chunk_pages(
    pages: list[str],
    chunk_size: int | None = None,
    overlap: int | None = None,
    paged: bool = True,
) -> list[Chunk]:
    """Sentence-aware chunking with word overlap. Chunks never cross page boundaries
    for PDFs, so every chunk can be cited with a page number."""
    chunk_size = chunk_size or settings.CHUNK_SIZE_WORDS
    overlap = min(overlap if overlap is not None else settings.CHUNK_OVERLAP_WORDS, chunk_size // 2)
    chunks: list[Chunk] = []

    for page_no, page_text in enumerate(pages, start=1):
        text = page_text.strip()
        if not text:
            continue
        sentences: list[str] = []
        for para in re.split(r"\n\s*\n", text):
            para = re.sub(r"\s+", " ", para).strip()
            if not para:
                continue
            for s in SENTENCE_SPLIT.split(para):
                s = s.strip()
                if not s:
                    continue
                if len(s.split()) > chunk_size:
                    sentences.extend(_split_long(s, chunk_size))
                else:
                    sentences.append(s)

        page_ref = page_no if paged else None
        current: list[str] = []
        current_len = 0
        fresh = False  # does `current` contain sentences not yet emitted?
        for s in sentences:
            n = len(s.split())
            if current and fresh and current_len + n > chunk_size:
                chunks.append(Chunk(" ".join(current), len(chunks), page_ref))
                # carry overlap: trailing sentences totalling <= overlap words
                carry: list[str] = []
                carry_len = 0
                for prev in reversed(current):
                    pl = len(prev.split())
                    if carry_len + pl > overlap:
                        break
                    carry.insert(0, prev)
                    carry_len += pl
                current, current_len = carry, carry_len
            current.append(s)
            current_len += n
            fresh = True
        if current and fresh:
            chunks.append(Chunk(" ".join(current), len(chunks), page_ref))
    return chunks


# ---------------------------------------------------------------- NLP helpers
def tokenize(text: str) -> list[str]:
    return [
        w
        for w in re.findall(r"[a-zA-Z][a-zA-Z\-]{2,}", text.lower())
        if w not in STOP_WORDS and not w.endswith("-")
    ]


def word_count(text: str) -> int:
    return len(text.split())


def tfidf_keywords(docs: dict[int, str], top_n: int = 8) -> dict[int, list[tuple[str, float]]]:
    """Top keywords per document using TF-IDF over the user's own corpus."""
    tokens = {doc_id: tokenize(text) for doc_id, text in docs.items()}
    df: Counter = Counter()
    for toks in tokens.values():
        df.update(set(toks))
    n_docs = max(len(docs), 1)
    result: dict[int, list[tuple[str, float]]] = {}
    for doc_id, toks in tokens.items():
        if not toks:
            result[doc_id] = []
            continue
        tf = Counter(toks)
        total = len(toks)
        scores = {
            w: (c / total) * (math.log((1 + n_docs) / (1 + df[w])) + 1)
            for w, c in tf.items()
            if c >= 2 or total < 150
        }
        result[doc_id] = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_n]
    return result


def extractive_summary(text: str, max_sentences: int = 3) -> str:
    """Frequency-based extractive summary — used when no LLM is configured."""
    sentences = list(dict.fromkeys(  # de-duplicate while keeping order
        s.strip() for s in SENTENCE_SPLIT.split(re.sub(r"\s+", " ", text)) if len(s.split()) >= 6
    ))
    if not sentences:
        return text[:400]
    freq = Counter(tokenize(text))
    if not freq:
        return " ".join(sentences[:max_sentences])
    top = freq.most_common(1)[0][1]
    scored = []
    for i, s in enumerate(sentences[:400]):
        toks = tokenize(s)
        if not toks:
            continue
        score = sum(freq[t] / top for t in toks) / math.sqrt(len(toks))
        scored.append((score, i, s))
    best = sorted(sorted(scored, reverse=True)[:max_sentences], key=lambda x: x[1])
    return " ".join(s for _, _, s in best)
