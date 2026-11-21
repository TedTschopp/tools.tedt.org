---
title: "Prompt Journey"
summary: "Follow fictional travel and factory-report requests to the model and back. Compare AI setups and explore what an unexpected tracking-link visit can reveal."
subtitle: "Where your AI request goes"
status: active
tool_type: webapp
date: 2026-11-21
last_modified: 2026-11-21
featured: false
tags: [ai, learning, privacy, architecture, simulation]
tech: [JavaScript, HTML, CSS]
links:
  live: "/tools/prompt-journey.html"
  repo: null
features:
  - "Step through the request and the answer's return journey"
  - "Play the journey automatically while the diagram follows the current step"
  - "Explore a factory report and a simulated tracking-link visit three days later"
  - "Compare company application, direct provider and local model examples"
  - "Add or remove company documents, external tools and model routing"
  - "Inspect each participant and distinguish processing from possible saved copies"
  - "Read the complete journey as an ordered text list"
  - "Download the selected example and its journey as JSON"
---

## What it does

Prompt Journey explains how an AI request can pass through several systems before
an answer reaches your screen. Follow a fictional example through a company
application, a direct connection to an AI provider, or a model running locally.
Select a participant in the diagram to learn its role.

Choose the travel-policy example or a factory maintenance report containing a
display-only tracking link. The factory story continues three simulated days
after the answer, when an unidentified requester visits that link. Explore what
the alert shows and why it does not identify who shared the link or prove that
the whole report was kept.

The company example lets you add document retrieval, external tools and routing
between model providers. Show possible saved copies to see why the route a request
takes and the records it leaves behind are separate questions.

## How to use it

1. Choose a sample story and setup, then use **Next** to follow each step.
2. Use **Play** for automatic playback. The diagram follows the current step.
3. Select a participant to inspect its role, or change the company options to compare routes.
4. Follow the answer back to the user. In the factory story, continue to the later alert.
5. Open the ordered journey list or download the example as JSON.

## Model and limits

This is an illustrative simulation with bundled fictional requests. It does not
send a request to a model, perform real inference, inspect your device, or trace
an actual network connection. The examples explain possible arrangements; they do
not establish how a particular provider handles, retains or trains on your data.
Showing a possible saved copy does not mean that every service makes that copy.
The factory tracking link is never fetched, and its later visit is simulated.
The diagram does not connect that unidentified requester to any model host or store.

The interaction and JSON export run in your browser. No account, model download
or API key is needed. The site uses its standard masked visitor analytics.
