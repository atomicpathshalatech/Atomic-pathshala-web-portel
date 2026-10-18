/**
 * A small S3-compatible server for tests (path-style: /<bucket>/<key>).
 * PUT, GET, HEAD, DELETE and copy (x-amz-copy-source). Buckets listed in
 * `privateBuckets` refuse a request that carries no signature — like an R2
 * bucket without public access — so tests can tell a signed link from a bare one.
 * Signatures are not verified; expiry is (X-Amz-Date + X-Amz-Expires).
 *
 *   npx tsx scripts/lib/fake-s3.ts 9555 priv     # standalone, for a dev server
 */
import http from "node:http";

export type FakeS3 = { port: number; objects: Map<string, { body: Buffer; type: string }>; log: string[]; close: () => Promise<void> };

function expired(u: URL): boolean {
  const date = u.searchParams.get("X-Amz-Date");
  const ttl = Number(u.searchParams.get("X-Amz-Expires") || 0);
  if (!date || !ttl) return false;
  const m = date.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return true;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return Date.now() > t + ttl * 1000;
}

export function startFakeS3(port: number, privateBuckets: string[] = []): Promise<FakeS3> {
  const objects = new Map<string, { body: Buffer; type: string }>();
  const log: string[] = [];
  const server = http.createServer((req, res) => {
    const u = new URL(req.url || "/", "http://x");
    const [bucket, ...rest] = u.pathname.replace(/^\/+/, "").split("/");
    const key = rest.map(decodeURIComponent).join("/");
    const id = `${bucket}/${key}`;
    const signed = !!u.searchParams.get("X-Amz-Signature") || !!req.headers.authorization;
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges, ETag");
      res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
    }
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    log.push(`${req.method} ${id} ${signed ? "signed" : "anonymous"}`);
    if (privateBuckets.includes(bucket) && !signed) return res.writeHead(403, { "Content-Type": "application/xml" }).end("<Error><Code>AccessDenied</Code></Error>");
    if (signed && u.searchParams.get("X-Amz-Signature") && expired(u)) return res.writeHead(403).end("<Error><Code>AccessDenied</Code><Message>Request has expired</Message></Error>");

    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (req.method === "PUT") {
        const src = req.headers["x-amz-copy-source"];
        if (typeof src === "string") {
          const from = decodeURIComponent(src.replace(/^\/+/, ""));
          const o = objects.get(from);
          if (!o) return res.writeHead(404).end("<Error><Code>NoSuchKey</Code></Error>");
          objects.set(id, { ...o });
          return res.writeHead(200, { "Content-Type": "application/xml" }).end("<CopyObjectResult><ETag>\"x\"</ETag></CopyObjectResult>");
        }
        objects.set(id, { body: Buffer.concat(chunks), type: String(req.headers["content-type"] || "application/octet-stream") });
        return res.writeHead(200, { ETag: '"x"' }).end();
      }
      if (req.method === "DELETE") {
        objects.delete(id);
        return res.writeHead(204).end();
      }
      const o = objects.get(id);
      if (!o) return res.writeHead(404, { "Content-Type": "application/xml" }).end("<Error><Code>NoSuchKey</Code><Message>missing</Message></Error>");
      const headers: Record<string, string> = {
        "Content-Type": u.searchParams.get("response-content-type") || o.type,
        "Content-Length": String(o.body.length),
        "Accept-Ranges": "bytes",
        ETag: '"x"',
      };
      const cd = u.searchParams.get("response-content-disposition");
      if (cd) headers["Content-Disposition"] = cd;
      const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      if (range && req.method === "GET") {
        const start = +range[1];
        const end = range[2] ? Math.min(+range[2], o.body.length - 1) : o.body.length - 1;
        headers["Content-Range"] = `bytes ${start}-${end}/${o.body.length}`;
        headers["Content-Length"] = String(end - start + 1);
        return res.writeHead(206, headers).end(o.body.subarray(start, end + 1));
      }
      res.writeHead(200, headers);
      res.end(req.method === "HEAD" ? undefined : o.body);
    });
  });
  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () =>
      resolve({ port, objects, log, close: () => new Promise((r) => server.close(() => r())) })
    )
  );
}

if (require.main === module) {
  const port = Number(process.argv[2] || 9555);
  startFakeS3(port, process.argv.slice(3)).then(() => console.log(`fake S3 on http://127.0.0.1:${port} (private: ${process.argv.slice(3).join(", ") || "none"})`));
}
