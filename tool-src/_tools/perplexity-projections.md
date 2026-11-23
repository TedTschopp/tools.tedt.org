---
title: "Perplexity Projections"
summary: "Explore three paths for OpenAI’s code-benchmark log-perplexity. Adjust the chart and the illustrative IQ bands to see when each scenario crosses them."
subtitle: "Next-token prediction through 2056"
status: active
tool_type: webapp
date: 2026-11-23
last_modified: 2026-11-23
featured: false
tags: [ai, learning, modeling, statistics, projections]
tech: [JavaScript, HTML, CSS, Canvas]
links:
  live: "/tools/perplexity-projections.html"
features:
  - "Compare OpenAI’s 14 measurements with optimistic, historical-fit, and pessimistic scenarios"
  - "Adjust the future horizon, time-scale base, and log-perplexity bounds"
  - "Toggle annual, quarterly, and monthly calendar lines independently"
  - "Edit the IQ anchors and read the first crossing month within the chosen horizon"
  - "Inspect the IQ bell curve and the separate human and GPT-2 study on OpenWebText"
  - "Copy a link to the current chart with a matching social preview"
  - "Download the measurements and monthly projections as CSV"
---

## What It Does

I built this to explore what different rates of progress would imply for the
log-perplexity measurements OpenAI shared in November 2026. Change the time
scale, zoom into the reference bands, or move the far edge of the chart.
[OpenAI’s source chart](https://openai.com/index/perplexity-and-intelligence/#base-model-log-perplexity)

## How to Use It

1. Move **Future years** to change the time window. Set **Time-scale base** to 1 for linear time.
2. Choose **Zoom to IQ Bands** or enter your own vertical bounds. Clear the minimum to use the optimistic endpoint, floored at zero. The upper ceiling is 1.00.
3. Toggle **Annual**, **Quarterly**, or **Monthly** calendar marks, or hide chart series.
4. Change the two **IQ anchors** to update the mapped bands and crossing dates.
5. Inspect any month on the chart or use the keyboard-accessible month slider. Download the display’s data as CSV.
6. Choose **Share View** to copy the current chart settings into a link. The link opens the same view and includes a chart image for link previews.

## What the Numbers Mean

The projections start at the latest released observation and close a constant
fraction of their gap to an assumed floor each year. The historical fit uses all
13 released measurements and a zero floor. The other scenarios use different
fit periods and editable floors.

The IQ bell curve uses a mean of 100 and a standard deviation of 15. Its
mapping onto log-perplexity is illustrative. OpenAI’s fixed internal-code
benchmark has no published IQ calibration. The separate OpenWebText chart
shows the published human and GPT-2 comparison with sampling uncertainty.
[APA Dictionary of Psychology](https://dictionary.apa.org/deviation-iq) ·
[Shlegeris et al., Figure 4](https://arxiv.org/html/2212.11281v2#S4.F4)
