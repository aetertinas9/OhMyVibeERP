import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { loginPage } from "./html.js";

const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));

const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function send(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, { ...securityHeaders, ...headers });
  response.end(body);
}

async function sendAsset(response, fileName, contentType) {
  try {
    const body = await readFile(`${publicDirectory}${fileName}`);
    send(response, 200, body, {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": contentType,
    });
  } catch {
    send(response, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  }
}

export function createRequestHandler() {
  return async (request, response) => {
    const url = new URL(request.url, "http://localhost");

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/login")) {
      send(response, 200, loginPage(), {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/styles.css") {
      await sendAsset(response, "styles.css", "text/css; charset=utf-8");
      return;
    }

    if (request.method === "GET" && url.pathname === "/favicon.svg") {
      await sendAsset(response, "favicon.svg", "image/svg+xml");
      return;
    }

    if (request.method === "POST" && url.pathname === "/login") {
      send(response, 501, loginPage({ error: "로그인 기능을 준비하고 있습니다." }), {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      });
      return;
    }

    send(response, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  };
}
