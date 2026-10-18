import { createConnection } from "node:net";

export function parseClamAvResponse(value) {
  // zINSTREAM returns a NUL-terminated reply; accept only its final delimiter.
  const response = String(value || "")
    .trim()
    .replace(/\0$/, "");
  if (/^stream: OK$/i.test(response)) return { clean: true, signature: null };
  const found = response.match(/^stream: ([^\r\n\0]+) FOUND$/);
  if (found) return { clean: false, signature: found[1].slice(0, 160) };
  throw Object.assign(new Error("MALWARE_SCAN_UNCLEAR"), { code: "MALWARE_SCAN_UNCLEAR" });
}

export async function scanBuffer(content, options = {}) {
  const host = String(options.host || process.env.CLAMAV_HOST || "").trim();
  const port = Number(options.port || process.env.CLAMAV_PORT || 3310);
  const timeoutMs = Number(options.timeoutMs || process.env.CLAMAV_TIMEOUT_MS || 30_000);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65_535)
    throw Object.assign(new Error("CLAMAV_NOT_CONFIGURED"), { code: "CLAMAV_NOT_CONFIGURED" });
  if (!Buffer.isBuffer(content) || !content.length || content.length > 10 * 1024 * 1024)
    throw Object.assign(new Error("MALWARE_SCAN_INVALID_FILE"), {
      code: "MALWARE_SCAN_INVALID_FILE",
    });

  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    const responses = [];
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(result);
    };
    socket.setTimeout(Math.min(120_000, Math.max(1_000, timeoutMs)), () =>
      finish(Object.assign(new Error("MALWARE_SCAN_TIMEOUT"), { code: "MALWARE_SCAN_TIMEOUT" })),
    );
    socket.on("error", () =>
      finish(
        Object.assign(new Error("MALWARE_SCANNER_UNAVAILABLE"), {
          code: "MALWARE_SCANNER_UNAVAILABLE",
        }),
      ),
    );
    socket.on("data", (chunk) => responses.push(chunk));
    socket.on("end", () => {
      try {
        const result = parseClamAvResponse(Buffer.concat(responses).toString("utf8"));
        if (!result.clean)
          finish(
            Object.assign(new Error("MALWARE_DETECTED"), {
              code: "MALWARE_DETECTED",
              signature: result.signature,
            }),
          );
        else finish(null, result);
      } catch (error) {
        finish(error);
      }
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < content.length; offset += 64 * 1024) {
        const chunk = content.subarray(offset, Math.min(content.length, offset + 64 * 1024));
        const length = Buffer.allocUnsafe(4);
        length.writeUInt32BE(chunk.length);
        socket.write(length);
        socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
  });
}
