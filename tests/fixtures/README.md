# Fixture convention

Use synthetic data and example.invalid URLs only in the scaffold. No official movement rows,
real trip details, credentials, medical facts, or private documents. Source-specific corpora
require a separate source-processing approval and bounded task. Keep each later task's
fixtures in its owned subdirectory. Test factories currently live in test_contracts.py.
