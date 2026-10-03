"""Generates the pomodoro alarm: two rounds of a soft ascending bell chime (C6-E6-G6).

Standard library only:
    python scripts/generate_alarm.py
"""

import math
import struct
import wave
from pathlib import Path

RATE = 44_100
OUT = Path(__file__).resolve().parents[1] / "assets" / "sounds" / "pomodoro_alarm.wav"

NOTES = [1046.50, 1318.51, 1567.98]  # C6, E6, G6
NOTE_GAP = 0.16  # seconds between note onsets
NOTE_LEN = 0.9  # each bell rings this long
ROUND_GAP = 1.1  # seconds between the two rounds
ROUNDS = 2


def bell(t: float, freq: float) -> float:
    """A sine with a quieter inharmonic partial and exponential decay, like a small bell."""
    envelope = math.exp(-5.0 * t) * min(1.0, t / 0.004)
    return envelope * (math.sin(2 * math.pi * freq * t) + 0.35 * math.sin(2 * math.pi * freq * 2.76 * t))


def main() -> None:
    total = (ROUNDS - 1) * ROUND_GAP + (len(NOTES) - 1) * NOTE_GAP + NOTE_LEN
    samples = [0.0] * int(total * RATE)
    for r in range(ROUNDS):
        for n, freq in enumerate(NOTES):
            onset = r * ROUND_GAP + n * NOTE_GAP
            start = int(onset * RATE)
            for i in range(int(NOTE_LEN * RATE)):
                if start + i < len(samples):
                    samples[start + i] += bell(i / RATE, freq)

    peak = max(abs(s) for s in samples) or 1.0
    frames = b"".join(struct.pack("<h", int(s / peak * 0.85 * 32767)) for s in samples)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(frames)
    print(f"wrote {OUT} ({total:.2f}s)")


if __name__ == "__main__":
    main()
