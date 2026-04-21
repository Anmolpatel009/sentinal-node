# Sentinel-Node

Kernel-Level Edge Networking for Deterministic Latency

Sentinel-Node is a kernel-first edge networking system built to reduce tail latency, jitter, and queue-induced slowdowns by splitting the work between a very small fast path in the kernel and a richer policy/telemetry layer in user space.

It is designed for environments where **P99 and P999 latency** matter more than raw throughput: real-time telemetry, AI synchronization, fintech traffic, control systems, and other latency-sensitive workloads at the edge.

---

## Project Type

Programmable edge dataplane using **eBPF/XDP**, with **user-space telemetry and policy control**.

---

## Executive Summary

Modern edge networks are usually optimized for throughput and stability under load. That works well for bulk traffic, but it does not guarantee deterministic latency for critical flows. Sentinel-Node addresses this gap by making conservative, bounded decisions as early as possible in the packet path, then using user space to observe, classify, and adapt policy over time.

The core idea is simple:

- **Kernel space** handles the fastest possible packet classification and action.
- **User space** handles telemetry, analytics, policy updates, and learning.
- **Runtime maps** connect the two without recompiling the dataplane.

This makes the system realistic, measurable, and safer to evolve than a monolithic in-kernel policy engine.

---

## What This README Is Trying to Achieve

This repository is intended to:

1. Define Sentinel-Node at a level that a systems engineer, infrastructure engineer, or reviewer can evaluate.
2. Keep the architecture realistic: fast path in XDP/eBPF, policy in user space, and strict safety boundaries.
3. Provide a clear path from prototype to measurable production value.

---

## Key Design Principles

Sentinel-Node follows a few non-negotiable principles:

- Optimize for **tail latency**, not just average throughput.
- Keep the kernel datapath **small, bounded, and verifiable**.
- Put complex policy and adaptation in **user space**, not in the verifier-constrained datapath.
- Use **runtime maps** and control loops for live updates.
- Measure first, optimize second.

These principles are what make the system credible. The goal is not to promise magic routing behavior; it is to make a small set of important traffic classes more predictable on real infrastructure.

---

## Problem Statement

Most edge networks are tuned for throughput and stability under load, not for deterministic latency. At the edge, large ISP buffers, mobile backhaul contention, and bursty background traffic can cause critical packets to wait behind non-critical flows.

That becomes a serious issue for:

- real-time telemetry,
- synchronization between distributed systems,
- low-latency financial services,
- industrial and operational control,
- AI pipelines that depend on timing consistency.

A single tail-latency spike can be more damaging than a small reduction in average speed.

Sentinel-Node targets three common failure modes:

- **Bufferbloat and queue buildup** under mixed traffic.
- **Kernel/user-space overhead** for packet handling that happens too late in the stack.
- **Lack of feedback-driven control** over local edge conditions.

---

## System Overview

The cleanest mental model is a **two-plane architecture**:

- **Fast dataplane**: makes conservative packet-level decisions at ingress.
- **Control plane**: learns from telemetry, classifies traffic, and updates policy.

### Architecture at a Glance

| Layer | Responsibility | Examples |
|---|---|---|
| User space | Telemetry, policy, analytics, rule updates | Flow scoring, route selection, configuration sync |
| Kernel space | Fast packet classification and bounded action | `XDP_PASS`, `XDP_DROP`, redirect, mark |
| Network edge | Physical enforcement and transport behavior | NIC ingress, ISP backhaul, local path choice |

---

## Packet Lifecycle

A packet enters at ingress, where **XDP** runs before skb allocation. That is what makes it suitable for the smallest possible decision surface:

1. Identify the flow.
2. Consult a map.
3. Apply a bounded action.
4. Return immediately.

Anything that requires rich state, correlation, historical analysis, or learning belongs in user space.

### Simplified Packet Path

```text
NIC ingress
   ↓
XDP / eBPF fast path
   ↓
Map lookup / flow classification
   ↓
Bounded action:
- pass
- drop
- redirect
- mark
   ↓
Optional TC fallback or shaping
   ↓
User-space telemetry and policy updates
```

---

## Core Building Blocks

### 1. XDP
XDP is the earliest practical packet hook for fast decisions. It is used here to keep the critical path as short as possible.

### 2. eBPF Maps
Maps store runtime policy, counters, flow state, priority hints, and other fast-access data needed by the datapath.

### 3. Control Plane
The control plane is responsible for:

- telemetry collection,
- policy compilation,
- observability,
- rule updates,
- adaptive decisions based on live metrics.

### 4. Optional TC Layer
Where XDP is too restrictive, a TC layer can provide shaping, pacing, or fallback behavior.

---

## Control Loop

Sentinel-Node is designed as a closed-loop system:

1. Observe traffic and queue behavior.
2. Classify or score flows.
3. Update maps or rules.
4. Apply a bounded action in the datapath.
5. Re-measure the result.

This loop is what allows the system to adapt to changing edge conditions without making the kernel logic complex.

---

## Recommended Scope

The best way to build this project is to start narrow and prove value step by step.

### Start With
- observability,
- packet counters,
- flow stats,
- latency baselines,
- small, explicit prioritization rules.

### Avoid At First
- broad routing replacement,
- universal application-aware classification,
- uncontrolled policy complexity,
- assumptions about infrastructure you do not control.

### Good Deployment Framing
Treat cross-city or multi-ISP routing as an overlay feature, not an assumption.

---

## What Sentinel-Node Should Not Promise Yet

This project should not be positioned as:

- universal application-aware classification for all encrypted traffic,
- perfect neutrality between all flows while still guaranteeing VIP latency,
- arbitrary control over upstream ISP queueing or tower scheduling.

That framing keeps the project technically honest and easier to evaluate.

---

## Technical Choices

| Choice | Why it matters |
|---|---|
| eBPF + XDP | Keeps decisions close to the NIC and minimizes overhead. |
| User-space policy engine | Allows complex heuristics without verifier constraints. |
| Runtime maps | Supports live updates without recompiling the dataplane. |
| Telemetry-first design | Makes optimization measurable instead of aspirational. |
| SRv6 / overlay routing | Useful only where the deployment environment actually supports it. |

---

## Suggested Repository Layout

```text
sentinel-node/
├─ README.md
├─ docs/
│  ├─ architecture/
│  ├─ diagrams/
│  └─ runbooks/
├─ kernel/
│  ├─ xdp/
│  ├─ tc/
│  └─ common/
├─ control-plane/
│  ├─ collector/
│  ├─ policy-engine/
│  └─ api/
├─ proto/
├─ tests/
├─ scripts/
└─ deploy/
```

### Directory Purpose

- `docs/` — architecture notes, diagrams, and operational runbooks.
- `kernel/` — XDP and TC datapath code.
- `control-plane/` — telemetry ingestion, policy logic, and APIs.
- `proto/` — shared schemas and message definitions.
- `tests/` — unit, integration, and traffic-replay tests.
- `scripts/` — deployment and helper scripts.
- `deploy/` — manifests, service definitions, and rollout assets.

---

## Getting Started

These instructions assume a Linux development host with:

- kernel headers,
- Clang/LLVM,
- `bpftool`,
- sufficient privileges for packet-processing experiments.

### Build

```bash
make build
```

### Run the Control Plane

```bash
./control-plane/bin/collector
./control-plane/bin/policy-engine
```

### Load the XDP Program

```bash
sudo ./scripts/load_xdp.sh eth0
```

### Inspect State

```bash
sudo bpftool map show
sudo bpftool prog show
```

---

## Expected Runtime Behavior

A basic deployment should be able to:

- classify a small set of known flows,
- apply conservative fast-path decisions,
- expose live counters and policy state,
- react to changing edge conditions through map updates.

The first version should be intentionally boring in the best sense: stable, measurable, and easy to reason about.

---

## Validation Metrics

Success should be measured with data, not intuition.

### Primary Metrics
- Median latency.
- P99 and P999 latency under mixed traffic.
- Queue depth trends during burst events.
- Packet drops, redirects, and fallback rate to the OS stack.
- CPU cost per packet on the fast path.
- Stability of the control loop over time.

### Interpretation
A change is only an improvement if it reduces tail latency or improves predictability without introducing unacceptable instability.

---

## Risks and Engineering Constraints

Sentinel-Node has real constraints, and the design should respect them.

### Main Risks
- Classification quality is difficult; IP-only rules are often too coarse.
- XDP/eBPF logic must stay small and verifier-friendly.
- Artificial delay policies can make latency worse if not bounded carefully.
- Cross-network routing depends on infrastructure outside your control.

### Practical Constraint
If a feature cannot be measured clearly, it should not be treated as a core capability.

---

## Roadmap

### Phase 1 — Observability
Build packet counters, flow stats, and latency baselines. Make the problem visible before trying to fix it.

### Phase 2 — Selective Fast-Pathing
Add low-risk prioritization for a small, explicit set of flows.

### Phase 3 — Adaptive Policy
Use live telemetry to update runtime maps and pacing behavior.

### Phase 4 — Overlay Routing
Add SRv6 or tunnel-based path selection only where deployment control exists.

### Phase 5 — Multi-Node Fabric
Coordinate several nodes as a managed edge mesh with clear operational boundaries.

---

## Final Positioning

The strongest version of Sentinel-Node is not a universal internet optimizer.

It is a disciplined, measurable edge system that makes a small set of critical traffic classes more predictable on real infrastructure.

That framing is both more credible and more useful.

---

## Contributing

Contributions are welcome, especially if they include:

- measurable goals,
- test methodology,
- performance evidence,
- a clear note about whether the change affects the dataplane, control plane, or both.

When contributing, please keep the architecture principles intact:
small kernel logic, user-space intelligence, measurable improvement.

---


## Notes

This README is intentionally written to be detailed, architecture-focused, and suitable for a systems or infrastructure project review.