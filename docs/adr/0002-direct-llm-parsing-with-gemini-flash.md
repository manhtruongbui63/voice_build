# 2. Direct LLM (Gemini 2.0 Flash) Structured Invoice Parsing with Native Speech-To-Text

* **Status**: Accepted
* **Deciders**: Shop Owner, Agent
* **Date**: 2026-07-29

## Context and Problem Statement

Vietnamese spoken commands in retail include regional accents, shorthand product names ("ST" for "Gạo ST25"), Vietnamese unit words ("cân", "ký", "lạng", "nửa cân"), and mid-sentence corrections ("à không, lấy..."). Simple regex string matching cannot reliably handle conversational Vietnamese speech.

## Considered Options

1. **Option 1: Device Native Speech-To-Text + Direct Gemini 2.0 Flash API (JSON Mode)**
2. **Option 2: Local Rule-Based / Regex Pattern Matcher**

## Decision Outcome

Chosen **Option 1: Device Native Speech-To-Text + Direct Gemini 2.0 Flash API (JSON Mode)**.

### Positives
* **High Natural Language Understanding**: Gracefully handles Vietnamese quantity expressions ("2 cân rưỡi", "nửa ký") and conversational corrections ("à không, sửa thành...").
* **Product Alias Context Matching**: Passing product catalog + aliases in System Instruction enables accurate matching of short spoken names.
* **Confidence Scoring**: Returns confidence metrics to highlight misheard homophones in yellow on draft invoices.

### Negatives
* Requires an active internet connection for the LLM API call. (Mitigated by allowing manual line item addition if offline).
