---
title: "Prompt Journey"
summary: "Follow a fictional AI request to the model and back to your screen. Compare company, direct and local setups, including tools and possible saved copies."
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

The company example lets you add document retrieval, external tools and routing
between model providers. Show possible saved copies to see why the route a request
takes and the records it leaves behind are separate questions.

## How to use it

1. Choose a setup and use **Next** to follow the request one step at a time.
2. Select a participant in the diagram for an explanation of its role.
3. In the company example, change the optional connections and compare the route.
4. Follow the answer back to the user, or jump to the return journey.
5. Open the ordered journey list or download the example as JSON.

## Model and limits

This is an illustrative simulation with a bundled fictional request. It does not
send that request to a model, perform real inference, inspect your device, or trace
an actual network connection. The examples explain possible arrangements; they do
not establish how a particular provider handles, retains or trains on your data.
Showing a possible saved copy does not mean that every service makes that copy.

The interaction and JSON export run in your browser. No account, model download
or API key is needed. The site uses its standard masked visitor analytics.
