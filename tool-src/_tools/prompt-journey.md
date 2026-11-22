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
  - "Explore groups, the detailed route and example flows inside individual stops"
  - "Read the complete journey as an ordered text list"
  - "Download the selected example and its journey as JSON"
---

## What it does

Prompt Journey explains how an AI request can pass through several systems before
an answer reaches your screen. Follow a fictional example through a company
application, a direct connection to an AI provider, or a model running locally.
Select a participant in the diagram to see its ArchiMate 4 element type and role.

Choose the travel-policy example or a factory maintenance report containing a
display-only tracking link. The factory story continues three simulated days
after the answer, when an unidentified requester visits that link. Explore what
the alert shows and why it does not identify who shared the link or prove that
the whole report was kept.

The company example lets you add document retrieval, external tools and routing
between model providers. Dotted lines in the route diagram show which stops
might keep records.

## How to use it

1. Use **Next step** to follow the sample. The guide shows who receives data and what they receive.
2. Use **Play** to advance automatically, or jump to **Model**, **Answer** or **Day 3** in the factory story.
3. Use **Overview** to see the groups and **Route** to see their stops. Select a stop to inspect it or open **See inside** for its example flow.
4. Clear **Possible saved copies** in the diagram legend to hide the dotted branches. Select it again to show them.
5. Open **Change setup** to switch stories or compare routes.
6. Open **All steps** to read the route in order, or download the journey as JSON.
7. Use the **ArchiMate 4 key** at the bottom of the page to identify element icons and relationship symbols.

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
