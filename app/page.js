"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./page.module.css";

const initialForm = { student_name: "", message: "" };

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function Home() {
  const [form, setForm] = useState(initialForm);
  const [requests, setRequests] = useState([]);
  const [source, setSource] = useState(null);
  const [views, setViews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError("");

    const [requestsResult, viewsResult] = await Promise.allSettled([
      fetch("/api/requests", { cache: "no-store" }),
      fetch("/api/views", { cache: "no-store" }),
    ]);

    if (requestsResult.status === "fulfilled") {
      try {
        const data = await requestsResult.value.json();

        if (!requestsResult.value.ok) {
          throw new Error(data.error || "Unable to load requests");
        }

        setRequests(Array.isArray(data.requests) ? data.requests : []);
        setSource(data.source || null);
      } catch (requestError) {
        setError(requestError.message);
      }
    } else {
      setError("Unable to connect to the help desk board");
    }

    if (viewsResult.status === "fulfilled") {
      const data = await viewsResult.value.json();
      setViews(typeof data.views === "number" ? data.views : null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadBoard, 0);

    return () => window.clearTimeout(timer);
  }, [loadBoard]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const studentName = form.student_name.trim();
    const message = form.message.trim();

    if (!studentName || !message) {
      setError("Please enter your name and help request.");
      return;
    }

    if (studentName.length > 50 || message.length > 200) {
      setError("Name must be 50 characters or fewer and the request must be 200 characters or fewer.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: studentName,
          message,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to post request");
      }

      setForm(initialForm);
      setSuccess("Your request was posted successfully.");
      await loadBoard();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.brandMark} aria-hidden="true">CH</div>
          <div>
            <p className={styles.eyebrow}>Student community board</p>
            <h1>Campus Help Desk</h1>
            <p className={styles.subtitle}>
              Ask questions, share what you know, and help campus life run a little smoother.
            </p>
          </div>
        </header>

        <section className={styles.dashboard}>
          <div className={styles.formCard}>
            <div className={styles.cardHeading}>
              <div>
                <p className={styles.sectionLabel}>Need a hand?</p>
                <h2>Post a request</h2>
              </div>
              <span className={styles.pencilIcon} aria-hidden="true">+</span>
            </div>
            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.fieldLabel} htmlFor="student_name">Student name</label>
              <input
                className={styles.fieldInput}
                id="student_name"
                name="student_name"
                value={form.student_name}
                onChange={handleChange}
                maxLength={50}
                placeholder="e.g. Maya Rao"
                disabled={submitting}
              />
              <div className={styles.fieldMeta}>{form.student_name.length}/50 characters</div>

              <label className={styles.fieldLabel} htmlFor="message">How can the campus help?</label>
              <textarea
                className={styles.fieldTextarea}
                id="message"
                name="message"
                value={form.message}
                onChange={handleChange}
                maxLength={200}
                placeholder="Describe your question or request..."
                rows={5}
                disabled={submitting}
              />
              <div className={styles.fieldMeta}>{form.message.length}/200 characters</div>

              <button className={styles.submitButton} type="submit" disabled={submitting}>
                {submitting ? "Posting..." : "Post request"}
                {!submitting && <span aria-hidden="true">→</span>}
              </button>
            </form>
            {success && <p className={styles.success} role="status">{success}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
          </div>

          <div className={styles.listCard}>
            <div className={styles.listHeader}>
              <div>
                <p className={styles.sectionLabel}>Community pulse</p>
                <h2>Latest requests</h2>
              </div>
              <button className={styles.refreshButton} onClick={loadBoard} disabled={loading}>
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            <div className={styles.boardMeta}>
              <span className={styles.viewCount}>
                <span className={styles.eyeIcon} aria-hidden="true">◉</span>
                {views === null ? "Views unavailable" : `${views} board views`}
              </span>
              {source && (
                <span className={styles.source}>
                  <span className={styles.sourceDot} />
                  Source: {source}
                </span>
              )}
            </div>

            {loading ? (
              <div className={styles.loadingState}><span className={styles.spinner} />Loading requests...</div>
            ) : requests.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon} aria-hidden="true">?</span>
                <h3>No requests yet</h3>
                <p>Be the first student to ask the campus community for help.</p>
              </div>
            ) : (
              <div className={styles.requestList}>
                {requests.map((request) => (
                  <article className={styles.request} key={request.id}>
                    <div className={styles.avatar}>{request.student_name.charAt(0).toUpperCase()}</div>
                    <div className={styles.requestBody}>
                      <div className={styles.requestTopline}>
                        <h3>{request.student_name}</h3>
                        <time dateTime={request.created_at}>{formatDate(request.created_at)}</time>
                      </div>
                      <p>{request.message}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
        <footer className={styles.footer}>Built for a more helpful campus community.</footer>
      </div>
    </main>
  );
}
