"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import {
  countryToFlag,
  deviceShort,
  duration,
  hms,
  hmsDate,
  sourceLabel,
  type TrafficSession,
  type TrafficSessionDetail,
  type TrafficSessionList,
} from "./traffic-shared";

// Admin-only traffic browser, opened from the account modal. Two stacked
// modals: the visit list, and one visit's full event timeline on top of it.
// Same data and the same reading order as iq-rest's Traffic screens, squeezed
// into this app's single modal shell.
//
// Loaded through next/dynamic (see AccountControls) so none of this ships to
// ordinary visitors.

const WINDOW_DAYS = 30;

const chip = "shrink-0 rounded bg-card px-1.5 py-0.5 text-[10px] text-hint";
const rowBtn =
  "flex w-full items-start gap-2 border-b border-border px-5 py-3 text-left transition hover:bg-card";

export default function AdminTraffic({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<TrafficSessionList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        from: new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString(),
        to: new Date().toISOString(),
      });
      const res = await fetch(`/api/admin/sessions?${qs.toString()}`);
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setData((await res.json()) as TrafficSessionList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sessions = data?.sessions ?? [];

  return (
    <>
      <Modal
        title={`Traffic · ${WINDOW_DAYS}d`}
        onClose={onClose}
        maxWidth="max-w-3xl"
        footer={
          <>
            <span className="mr-auto text-xs text-hint">
              {loading ? "Loading…" : `${sessions.length} visits${data?.truncated ? " (capped)" : ""}`}
            </span>
            <button
              onClick={() => void load()}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold transition-all hover:bg-bg active:scale-[0.99]"
            >
              Refresh
            </button>
          </>
        }
      >
        {error && <p className="px-5 py-4 text-sm text-red-500">{error}</p>}
        {!error && loading && sessions.length === 0 && (
          <div className="flex justify-center py-10 text-hint">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}
        {!error && !loading && sessions.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-hint">No visits in this window.</p>
        )}
        {sessions.map((s) => (
          <SessionRow key={s.id} session={s} onOpen={() => setOpenId(s.id)} />
        ))}
      </Modal>

      {openId && (
        <SessionDetail
          id={openId}
          onClose={() => setOpenId(null)}
          onDeleted={() => {
            setOpenId(null);
            void load();
          }}
        />
      )}
    </>
  );
}

function SessionRow({ session, onOpen }: { session: TrafficSession; onOpen: () => void }) {
  const source = sourceLabel(session);
  return (
    <button type="button" onClick={onOpen} className={rowBtn}>
      <span className="pt-0.5 text-base leading-none">{countryToFlag(session.country)}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">
            {session.email ?? session.firstPage ?? "Anonymous"}
          </span>
          {session.hasRegister && <span className={chip}>register</span>}
          {session.hasTranslate && <span className={chip}>translate</span>}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-hint">
          <span>{hmsDate(session.lastAt)}</span>
          <span>· {duration(session.firstAt, session.lastAt)}</span>
          <span>· {session.eventCount} ev / {session.pageCount} pg</span>
          <span>· {deviceShort(session.device, session.os)}</span>
          {session.city && <span>· {session.city}</span>}
          {source && <span className={chip}>{source}</span>}
          {session.locales.map((l) => (
            <span key={l} className={chip}>
              {l}
            </span>
          ))}
          {session.userVisits > 1 && <span className={chip}>{session.userVisits} visits</span>}
        </span>
      </span>
    </button>
  );
}

function SessionDetail({
  id,
  onClose,
  onDeleted,
}: {
  id: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [data, setData] = useState<TrafficSessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/sessions/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(res.status === 404 ? "Visit not found" : `Failed to load (${res.status})`);
        const json = (await res.json()) as TrafficSessionDetail;
        if (alive) setData(json);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  async function remove() {
    if (!window.confirm("Delete this visit and all its events?")) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/sessions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      // Keep the dialog open on failure — silently doing nothing reads as a
      // delete that worked until the row reappears on the next refresh.
      if (!res.ok) {
        setError(`Delete failed (${res.status})`);
        return;
      }
      onDeleted();
    } catch {
      setError("Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const s = data?.session;

  return (
    <Modal
      title="Visit"
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <button
          onClick={remove}
          disabled={deleting}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-border px-4 text-sm font-semibold text-red-500 transition-all hover:bg-bg active:scale-[0.99]"
        >
          {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          Delete visit
        </button>
      }
    >
      {error && <p className="px-5 py-4 text-sm text-red-500">{error}</p>}
      {!error && !s && (
        <div className="flex justify-center py-10 text-hint">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}
      {s && (
        <div className="flex flex-col gap-4 px-5 py-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <Field label="Account" value={s.email ?? "anonymous"} />
            <Field label="Visits" value={String(s.userVisits)} />
            <Field label="Started" value={hmsDate(s.firstAt)} />
            <Field label="Length" value={duration(s.firstAt, s.lastAt)} />
            <Field
              label="Where"
              value={`${countryToFlag(s.country)} ${[s.city, s.region, s.country].filter(Boolean).join(", ")}`}
            />
            <Field label="Device" value={`${deviceShort(s.device, s.os)}${s.theme ? ` · ${s.theme}` : ""}`} />
            <Field label="Browser lang" value={s.lang ?? "—"} />
            <Field label="Source" value={sourceLabel(s) ?? "direct"} />
            <Field label="Topics" value={s.topics.map((t) => t.title || t.id).join(", ") || "—"} />
            <Field label="Hash" value={`${s.hash}… · merged ${s.mergeCount}`} />
          </dl>

          <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {data!.events.map((e) => (
              <div key={e.id} className="flex items-baseline gap-2 px-3 py-2 text-sm">
                <span className="shrink-0 font-mono text-xs text-hint">{hms(e.at)}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-hint">{e.page} · </span>
                  <span className="font-medium">{e.action}</span>
                  <span> {e.name}</span>
                </span>
                {e.locale && <span className={chip}>{e.locale}</span>}
                {e.topicTitle && <span className={`${chip} max-w-[8rem] truncate`}>{e.topicTitle}</span>}
              </div>
            ))}
          </div>

          {data!.otherVisits.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-hint">Other visits</p>
              {data!.otherVisits.map((v) => (
                <p key={v.id} className="text-sm text-hint">
                  {hmsDate(v.firstAt)} · {countryToFlag(v.country)} {v.city} · {v.device ?? "—"}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-hint">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value}</dd>
    </>
  );
}
