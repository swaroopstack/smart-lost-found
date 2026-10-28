"""
Perceptual hashing for photo comparison.

A 64-bit pHash is computed with a plain DCT-II implemented in numpy, so the
project does not need ``scipy`` or ``imagehash``. Two photos of the same object
produce hashes that differ in only a few bits, which is enough to catch
"the same photo re-uploaded" and "same distinctive item" cases.

This is *not* semantic matching: a photo of the front and the back of the same
bottle will not match. See ``README.md`` -> Roadmap for the CLIP upgrade path.
"""

from __future__ import annotations

import io

import numpy as np
from PIL import Image, UnidentifiedImageError

HASH_SIZE = 8
HIGH_FREQ_FACTOR = 4
_SIDE = HASH_SIZE * HIGH_FREQ_FACTOR


def _dct_matrix(n: int) -> np.ndarray:
    """Orthonormal DCT-II matrix of shape (n, n)."""
    k = np.arange(n)
    matrix = np.cos(np.pi * (2 * k[:, None] + 1) * k[None, :] / (2 * n)) * np.sqrt(2.0 / n)
    matrix[0, :] = np.sqrt(1.0 / n)
    return matrix


_DCT = _dct_matrix(_SIDE)


def compute_phash(data: bytes | str) -> str | None:
    """Compute a 16-character hex pHash for an image given as bytes or a path.

    Returns ``None`` when the payload is not a readable image.
    """
    try:
        source = io.BytesIO(data) if isinstance(data, bytes) else data
        with Image.open(source) as img:
            grey = img.convert("L").resize((_SIDE, _SIDE), Image.Resampling.LANCZOS)
            pixels = np.asarray(grey, dtype=np.float64)
    except (UnidentifiedImageError, OSError, ValueError):
        return None

    coefficients = _DCT @ pixels @ _DCT.T
    low_freq = coefficients[:HASH_SIZE, :HASH_SIZE]

    # Median of the low-frequency block, excluding the DC term (top-left),
    # which only encodes overall brightness.
    median = np.median(low_freq.flatten()[1:])
    bits = (low_freq > median).flatten()

    value = 0
    for bit in bits:
        value = (value << 1) | int(bit)
    return f"{value:016x}"


def hamming_distance(hash_a: str, hash_b: str) -> int:
    """Number of differing bits between two hex-encoded hashes."""
    return bin(int(hash_a, 16) ^ int(hash_b, 16)).count("1")


def image_similarity(hash_a: str | None, hash_b: str | None) -> float | None:
    """Map the hamming distance to a 0.0-1.0 similarity score."""
    if not hash_a or not hash_b:
        return None
    try:
        distance = hamming_distance(hash_a, hash_b)
    except ValueError:
        return None
    return round(1.0 - distance / 64.0, 4)
