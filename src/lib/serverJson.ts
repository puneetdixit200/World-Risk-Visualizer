import { get } from "node:https";
import { URL } from "node:url";

const MAX_RESPONSE_BYTES = 2_000_000;

export function fetchJsonWithNodeHttps<T>(url: string, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const request = get(
      new URL(url),
      {
        headers: {
          accept: "application/json",
          "user-agent": "world-risk-visualizer/1.0",
        },
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        let body = "";

        response.setEncoding("utf8");

        response.on("data", (chunk: string) => {
          body += chunk;

          if (body.length > MAX_RESPONSE_BYTES && !settled) {
            settled = true;
            request.destroy(new Error("Upstream JSON response exceeded the size limit."));
            reject(new Error("Upstream JSON response exceeded the size limit."));
          }
        });

        response.on("end", () => {
          if (settled) {
            return;
          }

          settled = true;

          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`Upstream JSON request returned ${statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(body) as T);
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.setTimeout(timeoutMs, () => {
      if (!settled) {
        settled = true;
        request.destroy(new Error(`Upstream JSON request timed out after ${timeoutMs}ms.`));
        reject(new Error(`Upstream JSON request timed out after ${timeoutMs}ms.`));
      }
    });

    request.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}
