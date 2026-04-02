"""Content fingerprinting using SimHash for near-duplicate detection.

SimHash produces a fixed-size fingerprint that preserves locality —
similar content produces similar hashes, enabling efficient
similarity comparison across audits.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any


class ContentFingerprinter:
    """SimHash-based content fingerprinting."""

    HASH_BITS = 128

    def generate(self, text: str, url: str = "") -> dict[str, Any]:
        """Generate a SimHash fingerprint for content."""
        tokens = self._tokenize(text)

        if not tokens:
            return {
                "url": url,
                "fingerprint": "0" * (self.HASH_BITS // 4),
                "token_count": 0,
                "method": "simhash",
                "bits": self.HASH_BITS,
            }

        simhash = self._simhash(tokens)

        return {
            "url": url,
            "fingerprint": f"{simhash:0{self.HASH_BITS // 4}x}",
            "token_count": len(tokens),
            "unique_tokens": len(set(tokens)),
            "method": "simhash",
            "bits": self.HASH_BITS,
        }

    def compare(
        self, fingerprint_a: str, fingerprint_b: str
    ) -> dict[str, Any]:
        """Compare two SimHash fingerprints.

        Returns Hamming distance and similarity percentage.
        """
        int_a = int(fingerprint_a, 16)
        int_b = int(fingerprint_b, 16)

        # Hamming distance = number of differing bits
        xor = int_a ^ int_b
        hamming = bin(xor).count("1")

        similarity = round(1 - (hamming / self.HASH_BITS), 4)

        return {
            "hamming_distance": hamming,
            "max_distance": self.HASH_BITS,
            "similarity": similarity,
            "similarity_percent": round(similarity * 100, 1),
            "is_near_duplicate": similarity > 0.9,
            "is_similar": similarity > 0.7,
        }

    def _tokenize(self, text: str) -> list[str]:
        """Tokenize text into shingles (3-grams of words)."""
        words = re.findall(r"\b[a-z]+\b", text.lower())

        # Skip very short content
        if len(words) < 3:
            return words

        # Generate 3-word shingles
        shingles = []
        for i in range(len(words) - 2):
            shingle = f"{words[i]}_{words[i+1]}_{words[i+2]}"
            shingles.append(shingle)

        return shingles

    def _simhash(self, tokens: list[str]) -> int:
        """Compute SimHash of tokens.

        1. Hash each token to HASH_BITS bits
        2. For each bit position, sum +1 (if bit=1) or -1 (if bit=0)
        3. Final hash: bit is 1 if sum > 0, else 0
        """
        vector = [0] * self.HASH_BITS

        for token in tokens:
            token_hash = int(
                hashlib.md5(token.encode("utf-8")).hexdigest(),  # noqa: S324
                16,
            )

            for i in range(self.HASH_BITS):
                bit = (token_hash >> i) & 1
                if bit:
                    vector[i] += 1
                else:
                    vector[i] -= 1

        # Convert vector to hash
        result = 0
        for i in range(self.HASH_BITS):
            if vector[i] > 0:
                result |= 1 << i

        return result
