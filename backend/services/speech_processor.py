"""
Speech Processor — Audio transcription and speech feature extraction.
Uses OpenAI Whisper for transcription and signal processing for metrics.
"""

import asyncio
import io
import re
import subprocess
import tempfile
import os
from typing import Optional

import numpy as np
import whisper


# Module-level model cache — loaded once, reused across requests.
_whisper_model: Optional[whisper.Whisper] = None

def _get_model() -> whisper.Whisper:
    global _whisper_model
    if _whisper_model is None:
        # "base" is a good balance: ~74M params, fast on CPU, accurate enough for demos.
        # Swap to "small" or "medium" if you have a GPU and want higher accuracy.
        _whisper_model = whisper.load_model("base")
    return _whisper_model


class SpeechProcessor:
    """
    Speech Processing Service

    Capabilities:
    - Transcribe audio using Whisper (locally)
    - Convert browser MediaRecorder webm/opus → wav via ffmpeg subprocess
    - Extract speaking pace (WPM), pause patterns
    - Prepare speech_data dict for agent pipeline

    In production:
    - Swap "base" model for "small"/"medium" on a GPU instance
    - Azure Speech Services for real-time streaming
    - MediaPipe Face Mesh for eye contact analysis
    """

    async def process(
        self,
        audio_data: Optional[bytes],
        transcript: Optional[str] = None,
    ) -> dict:
        """
        Process audio input into structured speech_data.

        If transcript is provided (from frontend WebSpeech API), use directly.
        If audio_data provided, convert to wav and transcribe with Whisper.
        """
        if not transcript and not audio_data:
            return self._empty_result()

        if not transcript and audio_data:
            transcript = await self._whisper_transcribe(audio_data)

        metrics = self._extract_metrics(transcript)

        return {
            "transcript": transcript,
            "metrics": metrics,
            "processing_method": "whisper" if audio_data else "direct_transcript",
        }

    # ──────────────────────────────────────────────────────────────────────────
    # Transcription
    # ──────────────────────────────────────────────────────────────────────────

    async def _whisper_transcribe(self, audio_data: bytes) -> str:
        """
        Transcribe raw audio bytes (any format ffmpeg understands, incl. webm/opus
        produced by the browser MediaRecorder API) using OpenAI Whisper.

        Flow:
          1. Write raw bytes to a NamedTemporaryFile so ffmpeg can read them.
          2. Use ffmpeg to decode → 16 kHz mono PCM wav (Whisper's expected format).
          3. Load the wav into a numpy float32 array (whisper.load_audio equivalent).
          4. Run whisper.transcribe() on the array.

        Runs in a thread pool so it doesn't block the async event loop.
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._transcribe_sync, audio_data)

    def _transcribe_sync(self, audio_data: bytes) -> str:
        """Synchronous transcription — called from a thread pool executor."""
        # Write input to a temp file (ffmpeg needs a seekable source for webm)
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as src_file:
            src_file.write(audio_data)
            src_path = src_file.name

        try:
            # Decode to 16 kHz mono s16le PCM using ffmpeg.
            # whisper.load_audio() does the same thing internally for file paths,
            # but we need it in-memory because we started from bytes, not a path.
            cmd = [
                "ffmpeg",
                "-loglevel", "error",
                "-i", src_path,
                "-ar", "16000",   # 16 kHz sample rate (Whisper requirement)
                "-ac", "1",       # mono
                "-f", "s16le",    # signed 16-bit little-endian raw PCM
                "pipe:1",         # output to stdout
            ]
            result = subprocess.run(cmd, capture_output=True, check=True)
            pcm_bytes = result.stdout

        except subprocess.CalledProcessError as e:
            # ffmpeg stderr contains the actual error message
            raise RuntimeError(
                f"ffmpeg conversion failed: {e.stderr.decode(errors='replace')}"
            ) from e
        finally:
            os.unlink(src_path)

        # Convert raw PCM bytes → float32 numpy array in [-1, 1]
        audio_np = (
            np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        )

        if audio_np.size == 0:
            return ""

        model = _get_model()
        transcription = model.transcribe(
            audio_np,
            fp16=False,         # fp16=True requires CUDA; safe default is False
            language=None,      # auto-detect language
            verbose=False,
        )
        return transcription["text"].strip()

    # ──────────────────────────────────────────────────────────────────────────
    # Metrics
    # ──────────────────────────────────────────────────────────────────────────

    def _extract_metrics(self, transcript: str) -> dict:
        """Extract quantitative speech metrics from transcript."""
        if not transcript:
            return {
                "words_per_minute": 0,
                "word_count": 0,
                "sentence_count": 0,
                "avg_sentence_length": 0,
                "estimated_duration_seconds": 0,
            }

        words = transcript.split()
        sentences = [s.strip() for s in re.split(r"[.!?]+", transcript) if s.strip()]

        word_count = len(words)
        sentence_count = len(sentences)
        avg_sentence_length = word_count / max(sentence_count, 1)

        # Filler-word ratio influences perceived pace
        fillers = {"um", "uh", "like", "you know", "so", "basically", "literally"}
        filler_count = sum(1 for w in words if w.lower().strip(",'\"") in fillers)
        filler_ratio = filler_count / max(word_count, 1)

        # Adjust WPM estimate: heavy filler usage correlates with slower delivery
        base_wpm = 130
        wpm = max(80, round(base_wpm * (1 - filler_ratio * 0.5)))

        estimated_duration = word_count / wpm * 60

        return {
            "words_per_minute": wpm,
            "word_count": word_count,
            "sentence_count": sentence_count,
            "avg_sentence_length": round(avg_sentence_length, 1),
            "estimated_duration_seconds": round(estimated_duration, 1),
            "filler_word_count": filler_count,
            "filler_ratio": round(filler_ratio, 3),
        }

    def _empty_result(self) -> dict:
        return {
            "transcript": "",
            "metrics": {
                "words_per_minute": 0,
                "word_count": 0,
                "sentence_count": 0,
                "avg_sentence_length": 0,
                "estimated_duration_seconds": 0,
                "filler_word_count": 0,
                "filler_ratio": 0.0,
            },
            "processing_method": "none",
        }