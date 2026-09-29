#!/usr/bin/env node
/*
 * sse-stress.mjs — load test for a Server-Sent Events (SSE) endpoint.
 *
 * ONLY run this against a server you own or are explicitly authorized to test
 * (your own live server, a staging copy, or localhost). Pointing it at someone
 * else's server without permission is abuse.
 *
 * No dependencies — uses Node's built-in http/https. Node 18+.
 *
 * Usage:
 *   node sse-stress.mjs --url http://localhost:8091/events [options]
 *
 * Options:
 *   --url <url>        SSE endpoint (required)
 *   --clients <n>      Total concurrent connections to reach (default 500)
 *   --ramp <sec>       Seconds to spread the opening of all clients (default 20)
 *   --duration <sec>   How long to hold connections after ramp (default 60)
 *   --storm            After the hold, drop ALL clients and reconnect them at
 *                      once (simulates a venue Wi-Fi blip). Off by default.
 *   --latency-field <k> JSON field in each event carrying the send timestamp in
 *                      ms (e.g. "ts"). If present, per-event latency is reported.
 *   --report <sec>     Stats print interval (default 2)
 *
 * Example (ramp 1000 phones over 30s, hold 2 min, then a reconnect storm):
 *   node sse-stress.mjs --url http://localhost:8091/events \
 *     --clients 1000 --ramp 30 --duration 120 --storm
 */

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

// ---- args -----------------------------------------------------------------
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith("--")) return true; // flag
  return next;
}

const URL_ARG = arg("url");
if (!URL_ARG || URL_ARG === true) {
  console.error("Error: --url is required, e.g. --url http://localhost:8091/events");
  process.exit(1);
}
const CLIENTS = Number(arg("clients", 500));
const RAMP_SEC = Number(arg("ramp", 20));
const DURATION_SEC = Number(arg("duration", 60));
const STORM = arg("storm", false) === true || arg("storm", false) === "true";
const LATENCY_FIELD = arg("latency-field", null);
const REPORT_SEC = Number(arg("report", 2));

const target = new URL(URL_ARG);
const agentMod = target.protocol === "https:" ? https : http;
// Allow many sockets per host.
const agent = new agentMod.Agent({ keepAlive: true, maxSockets: Infinity });

// ---- metrics --------------------------------------------------------------
const m = {
  opening: 0,
  open: 0,
  closed: 0,
  errors: 0,
  events: 0,
  bytes: 0,
  latencies: [], // ms, only when LATENCY_FIELD is set
  connectMs: [], // time from request start to first byte
};
const conns = new Map(); // id -> req

function pct(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

function openOne(id) {
  m.opening++;
  const startedAt = Date.now();
  let gotFirstByte = false;
  let buf = "";

  const opts = {
    method: "GET",
    agent,
    headers: { Accept: "text/event-stream", "Cache-Control": "no-cache" },
  };
  const url = new URL(target);
  // give the server a distinct id per client, like a real phone would
  url.searchParams.set("id", `stress-${id}`);

  const req = agentMod.request(url, opts, (res) => {
    m.opening--;
    if (res.statusCode !== 200) {
      m.errors++;
      res.resume();
      req.destroy();
      return;
    }
    m.open++;
    conns.set(id, req);
    res.setEncoding("utf8");

    res.on("data", (chunk) => {
      if (!gotFirstByte) {
        gotFirstByte = true;
        m.connectMs.push(Date.now() - startedAt);
      }
      m.bytes += chunk.length;
      buf += chunk;
      // SSE events are separated by a blank line
      let sep;
      while ((sep = buf.indexOf("\n\n")) !== -1) {
        const raw = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        handleEvent(raw);
      }
    });
    res.on("end", () => close(id));
    res.on("close", () => close(id));
  });

  req.on("error", () => {
    m.errors++;
    close(id);
  });
  req.end();
}

function handleEvent(raw) {
  // ignore comment/heartbeat lines beginning with ':'
  const dataLines = raw
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim());
  if (!dataLines.length) return;
  m.events++;
  if (!LATENCY_FIELD) return;
  try {
    const obj = JSON.parse(dataLines.join("\n"));
    const sent = obj?.[LATENCY_FIELD];
    if (typeof sent === "number") m.latencies.push(Date.now() - sent);
  } catch {
    /* not JSON, skip */
  }
}

function close(id) {
  if (conns.has(id)) {
    m.open--;
    m.closed++;
    conns.delete(id);
  }
}

function closeAll() {
  for (const [id, req] of conns) {
    req.destroy();
    close(id);
  }
}

// ---- reporting ------------------------------------------------------------
const t0 = Date.now();
let lastEvents = 0;
const reporter = setInterval(() => {
  const dt = REPORT_SEC;
  const rate = ((m.events - lastEvents) / dt).toFixed(1);
  lastEvents = m.events;
  const line = {
    t: `${((Date.now() - t0) / 1000).toFixed(0)}s`,
    open: m.open,
    opening: m.opening,
    closed: m.closed,
    errors: m.errors,
    "events/s": rate,
    "connect p95ms": pct(m.connectMs, 95),
    rssMB: (process.memoryUsage().rss / 1e6).toFixed(0),
  };
  if (LATENCY_FIELD) {
    line["lat p50/p95/p99ms"] = [
      pct(m.latencies, 50),
      pct(m.latencies, 95),
      pct(m.latencies, 99),
    ].join("/");
  }
  console.log(JSON.stringify(line));
}, REPORT_SEC * 1000);

// ---- run ------------------------------------------------------------------
async function ramp(label) {
  console.log(`[${label}] opening ${CLIENTS} clients over ${RAMP_SEC}s → ${URL_ARG}`);
  const gap = (RAMP_SEC * 1000) / CLIENTS;
  for (let i = 0; i < CLIENTS; i++) {
    openOne(`${label}-${i}`);
    if (gap > 0) await new Promise((r) => setTimeout(r, gap));
  }
}

function wait(sec) {
  return new Promise((r) => setTimeout(r, sec * 1000));
}

async function main() {
  await ramp("wave1");
  console.log(`[hold] holding for ${DURATION_SEC}s…`);
  await wait(DURATION_SEC);

  if (STORM) {
    console.log("[storm] dropping ALL connections at once…");
    closeAll();
    await wait(2);
    console.log("[storm] reconnecting all at once…");
    // reconnect with no ramp: the realistic thundering-herd case
    for (let i = 0; i < CLIENTS; i++) openOne(`wave2-${i}`);
    await wait(DURATION_SEC);
  }

  console.log("[done] closing.");
  closeAll();
  clearInterval(reporter);
  await wait(1);
  summary();
  process.exit(0);
}

function summary() {
  console.log("\n===== summary =====");
  console.log(`events received : ${m.events}`);
  console.log(`bytes received  : ${(m.bytes / 1e6).toFixed(1)} MB`);
  console.log(`errors          : ${m.errors}`);
  console.log(
    `connect ms      : p50 ${pct(m.connectMs, 50)} / p95 ${pct(m.connectMs, 95)} / max ${pct(m.connectMs, 100)}`,
  );
  if (LATENCY_FIELD && m.latencies.length) {
    console.log(
      `broadcast lat ms: p50 ${pct(m.latencies, 50)} / p95 ${pct(m.latencies, 95)} / p99 ${pct(m.latencies, 99)} / max ${pct(m.latencies, 100)}`,
    );
  }
}

process.on("SIGINT", () => {
  console.log("\n[interrupted]");
  closeAll();
  clearInterval(reporter);
  summary();
  process.exit(0);
});

main();
