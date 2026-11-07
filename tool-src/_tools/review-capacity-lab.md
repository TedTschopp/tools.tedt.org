---
title: "Review Capacity Lab"
summary: "Compare AI-generated review demand with protected human capacity. Explore backlog growth, re-review, staffing, and intake limits with a transparent browser model."
subtitle: "Human approval has a speed limit"
status: active
tool_type: webapp
date: 2026-11-06
last_modified: 2026-11-06
featured: false
tags: [ai, learning, simulation, review, capacity, productivity, planning]
tech: [JavaScript, HTML, CSS]
links:
  live: "/tools/review-capacity-lab.html"
  repo: null
features:
  - "Five hand-checkable examples, including long work activities"
  - "Request rates per intake hour, workday, workweek, or average work month"
  - "Review effort in minutes, hours, workdays, or workweeks with an explicit work calendar"
  - "Daily review demand, protected capacity, and demand-to-capacity ratio"
  - "Backlog chart and accessible daily table over 1–365 workdays"
  - "Intake and staffing calculations at a chosen capacity target"
  - "One additional review pass, starting backlog, and zero-capacity cases"
  - "JSON scenario import and export plus a CSV workload timeline"
---

## What it does

Review Capacity Lab helps you estimate whether a defined review queue can absorb
the work arriving from an AI-assisted process. Enter requests per intake hour,
workday, workweek, or average work month. Choose review effort in minutes,
hours, workdays, or workweeks, then enter the share needing human review and
protected reviewer hours. Changing a unit keeps the entered number.

The tool separates growing queues, exact capacity with no slack, and arithmetic
headroom. It also shows staffing and intake at a capacity target you choose.

## How to use it

1. Open an example or enter your own workload.
2. Set the calendar conversions, then count hours protected for this kind of review.
3. Add one additional review pass if returned work commonly needs another look.
4. Inspect the backlog chart and daily table.
5. Export the assumptions and results for a team discussion.

## Model and limits

This is a deterministic planning model. Rates and active effort are normalized
using explicit calendar assumptions. An effort workday is separate from each
reviewer's protected hours. Monthly rates use an assumed average work month.
Daily totals are averaged and reviewer hours are pooled. The results do not
schedule indivisible long cases or predict actual completion dates, waiting
times, decision quality, or whether an action may be delegated. Reviewers must
be qualified for the same work class. The chosen capacity target is a planning
assumption.

Calculations and scenario files are processed in your browser. The site uses its
standard masked visitor analytics. No account or API key is needed.
