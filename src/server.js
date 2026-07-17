import { createServer } from "node:http";

import { createRequestHandler } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "127.0.0.1";

const server = createServer(createRequestHandler());

server.listen(port, host, () => {
  console.log(`다온 ERP가 http://${host}:${port} 에서 실행 중입니다.`);
});
