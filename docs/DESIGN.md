# System Design Document

## Design Principles
1. **Privacy-Centric**: Scrub personally identifiable information (PII) before persistent storage.
2. **Explainability**: Every rule firing includes an explicit human-readable justification.
3. **Fault-Tolerant Parsing**: Fall back cleanly when non-standard or truncated SMS text is encountered.
