# 1. Local-First SQLite Storage and Expo React Native Architecture

* **Status**: Accepted
* **Deciders**: Shop Owner, Agent
* **Date**: 2026-07-29

## Context and Problem Statement

VoiceBill is a mobile application for retail shop owners to quickly generate sales bills using voice commands. The app requires fast response times, zero cloud server maintenance costs, maximum privacy, and offline capabilities for viewing past invoices and products.

## Considered Options

1. **Option 1: Local-First SQLite Database (`expo-sqlite`) with React Native (Expo)**
2. **Option 2: Cloud Backend Service (Firebase / Supabase)**

## Decision Outcome

Chosen **Option 1: Local-First SQLite Database (`expo-sqlite`) with React Native (Expo)**.

### Positives
* **Fast Performance**: Instant read/write operations without network latency.
* **Privacy & Control**: 100% data ownership stored locally on the owner's smartphone.
* **Low Maintenance & Cost**: Zero monthly server cost; works immediately after installation without login.
* **Ease of Export**: Direct local Excel `.xlsx` generation and sharing.

### Negatives
* Data is local to the device (multi-device synchronization is deferred to future versions if requested).
