"use client";

import { useState, useMemo, useEffect } from "react";
import { useRealtime } from "inngest/react";
import { myChannel } from "@/inngest/channels";
import { getRealtimeToken, startRun, publishFromClient } from "./actions";

export default function Home() {
  const [runId, setRunId] = useState<string | null>(null);
  const [extraMsg, setExtraMsg] = useState("");
  const [lastBatchSize, setLastBatchSize] = useState(0);

  const channel = useMemo(
    () => (runId ? myChannel({ runId }) : undefined),
    [runId]
  );

  const token = useMemo(
    () => (runId ? () => getRealtimeToken(runId) : undefined),
    [runId]
  );

  const {
    connectionStatus,
    runStatus,
    isPaused,
    pauseReason,
    messages,
    result,
    error,
    reset,
  } = useRealtime({
    channel,
    topics: ["status", "result"] as const,
    enabled: !!runId,
    token,
    bufferInterval: 500,
    historyLimit: 10,
  });

  useEffect(() => {
    if (messages.delta.length > 0) {
      setLastBatchSize(messages.delta.length);
    }
  }, [messages.delta]);

  async function handleStart() {
    reset();
    setLastBatchSize(0);
    const { runId: id } = await startRun();
    setRunId(id);
  }

  async function handleExtraPublish() {
    if (!runId || !extraMsg) return;
    await publishFromClient(runId, extraMsg);
    setExtraMsg("");
  }

  return (
    <div className="p-8 max-w-2xl mx-auto font-[family-name:var(--font-geist-mono)] space-y-6">
      <h1 className="text-xl font-bold">Inngest Realtime Demo</h1>

      <p className="text-sm text-foreground/60">
        Click &quot;Start Run&quot; to trigger an Inngest function. It publishes
        status updates in real time as each step completes. You should see
        messages appear below over ~16 seconds.
      </p>

      <button
        onClick={handleStart}
        className="px-4 py-2 bg-foreground text-background rounded"
      >
        Start Run
      </button>

      {/* Connection & run status */}
      <div className="text-sm space-y-1">
        <p>
          Connection: {connectionStatus}
          {isPaused && pauseReason && (
            <span className="text-yellow-500 ml-2">
              (paused: {pauseReason})
            </span>
          )}
        </p>
        <p>Run: {runStatus}</p>
        <p>Run ID: {runId ?? "none"}</p>
        {error && <p className="text-red-500">Error: {error.message}</p>}
      </div>

      {/* Per-topic latest + cross-cutting fields */}
      <div className="text-sm space-y-1">
        <p>
          Latest status:{" "}
          {messages.byTopic.status?.data.message ?? "—"}
        </p>
        <p>
          Latest result:{" "}
          {messages.byTopic.result?.data.value ?? "—"}
        </p>
        <p>
          Last message:{" "}
          {messages.last
            ? `${JSON.stringify(messages.last.kind !== "run" ? messages.last.data : null)} (${messages.last.kind !== "run" ? messages.last.topic : messages.last.kind})`
            : "—"}
        </p>
        <p>
          Function result:{" "}
          <span
            className={
              result === undefined ? "text-foreground/40" : "text-green-500"
            }
          >
            {result === undefined ? "—" : JSON.stringify(result)}
          </span>
        </p>
        <p className="text-foreground/50">
          Last batch: {lastBatchSize} message
          {lastBatchSize !== 1 ? "s" : ""} (buffered at 500ms)
        </p>
      </div>

      {/* Test inngest.realtime.publish() from outside a function */}
      {runId && (
        <div className="space-y-1">
          <p className="text-xs text-foreground/50">
            Publish to the channel from using
            inngest.realtime.publish outside a function:
          </p>
          <div className="flex gap-2">
            <input
              value={extraMsg}
              onChange={(e) => setExtraMsg(e.target.value)}
              placeholder="Type a message..."
              className="px-2 py-1 border rounded bg-transparent flex-1 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleExtraPublish()}
            />
            <button
              onClick={handleExtraPublish}
              className="px-3 py-1 border rounded text-sm"
            >
              Publish
            </button>
          </div>
        </div>
      )}

      {/* All messages log */}
      <div className="text-xs space-y-1 max-h-80 overflow-y-auto">
        <p className="font-bold">
          All messages ({messages.all.length} of 10 max):
        </p>
        {messages.all.map((msg, i) => (
          <pre key={i} className="text-foreground/70">
            {JSON.stringify(
              {
                kind: msg.kind,
                topic: msg.kind !== "run" ? msg.topic : undefined,
                data: msg.kind !== "run" ? msg.data : undefined,
              },
              null,
              2
            )}
          </pre>
        ))}
      </div>
    </div>
  );
}
