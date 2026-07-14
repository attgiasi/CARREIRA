import test from "node:test";
import assert from "node:assert/strict";
import { gmailProtectedRetryAfter, gmailRetryAfterFromError, isGmailRateLimitError } from "../src/modules/gmail/gmailClient.js";
import { gmailJobAlertsDue } from "../src/modules/gmail/careerGmailSync.js";
import { incrementalGmailStartDate } from "../src/modules/gmail/recruiterReplyReader.js";

test("mantém Gmail conectado quando o Google aplica limite temporário", () => {
  const error = new Error(
    "Gmail retornou 429; tentar novamente após 2026-07-14T14:40:14.503Z: User-rate limit exceeded"
  );

  assert.equal(isGmailRateLimitError(error), true);
  assert.equal(gmailRetryAfterFromError(error), "2026-07-14T14:40:14.503Z");
});

test("aplica margem segura depois de um limite do Gmail", () => {
  const error = new Error("Gmail retornou 429; tentar novamente após 2026-07-14T15:02:30.450Z");

  assert.equal(
    gmailProtectedRetryAfter(error, "2026-07-14 14:47:31", 30),
    "2026-07-14T15:17:31.000Z"
  );
});

test("sincronização recorrente usa janela incremental", () => {
  const start = incrementalGmailStartDate(
    ["2026-01-10T12:00:00.000Z", "2026-06-10T12:00:00.000Z"],
    "2026-07-14 14:24:05",
    2
  );

  assert.equal(start, "2026/07/12");
});

test("primeira sincronização preserva o histórico das candidaturas", () => {
  const start = incrementalGmailStartDate(["2026-06-10T12:00:00.000Z"]);

  assert.equal(start, "2026/06/09");
});

test("newsletters são verificadas em lotes espaçados", () => {
  const now = Date.parse("2026-07-14T18:00:00.000Z");

  assert.equal(gmailJobAlertsDue("2026-07-14 14:30:00", now, 6), false);
  assert.equal(gmailJobAlertsDue("2026-07-14 10:00:00", now, 6), true);
});
