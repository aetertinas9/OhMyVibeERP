import { Readable } from "node:stream";

export async function request(handler, {
  method = "GET",
  path = "/",
  headers = {},
  body = "",
  address = "127.0.0.1",
} = {}) {
  const incoming = Readable.from(body ? [Buffer.from(body)] : []);
  incoming.method = method;
  incoming.url = path;
  incoming.headers = headers;
  incoming.socket = { remoteAddress: address };

  const response = {
    body: Buffer.alloc(0),
    headers: {},
    headersSent: false,
    statusCode: null,
    writeHead(statusCode, responseHeaders) {
      this.statusCode = statusCode;
      this.headers = responseHeaders;
      this.headersSent = true;
    },
    end(chunk = "") {
      this.body = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    },
  };

  await handler(incoming, response);
  return {
    body: response.body.toString("utf8"),
    headers: response.headers,
    statusCode: response.statusCode,
  };
}

export function getCookie(setCookie, name) {
  const values = Array.isArray(setCookie) ? setCookie : [setCookie];
  const cookie = values.find((value) => value?.startsWith(`${name}=`));
  return cookie?.split(";", 1)[0] ?? "";
}

export function csrfFromHtml(html) {
  return html.match(/name="csrfToken" value="([^"]+)"/)?.[1] ?? "";
}

export function form(values) {
  return new URLSearchParams(values).toString();
}
