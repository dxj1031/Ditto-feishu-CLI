import { readdir, readFile, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const [, , sourceDirArg, zipPathArg] = process.argv;

if (!sourceDirArg || !zipPathArg) {
  console.error("Usage: node scripts/create-zip-with-modes.mjs <source-dir> <zip-path>");
  process.exit(2);
}

const sourceDir = path.resolve(sourceDirArg);
const zipPath = path.resolve(zipPathArg);
const rootName = path.basename(sourceDir);
const entries = [];

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function uint16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value & 0xffff, 0);
  return buffer;
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

async function walk(dir, prefix = rootName) {
  const info = await stat(dir);
  entries.push({ absPath: dir, zipName: `${prefix}/`, isDirectory: true, mode: 0o40755, mtime: info.mtime });

  const children = await readdir(dir, { withFileTypes: true });
  children.sort((a, b) => a.name.localeCompare(b.name));

  for (const child of children) {
    const absPath = path.join(dir, child.name);
    const zipName = `${prefix}/${child.name}`;
    if (child.isDirectory()) {
      await walk(absPath, zipName);
    } else if (child.isFile()) {
      const mode = child.name.endsWith(".command") || child.name.endsWith(".sh") ? 0o100755 : 0o100644;
      const childInfo = await stat(absPath);
      entries.push({ absPath, zipName, isDirectory: false, mode, mtime: childInfo.mtime });
    }
  }
}

await walk(sourceDir);

const output = createWriteStream(zipPath);
const centralDirectory = [];
let offset = 0;

function write(buffer) {
  output.write(buffer);
  offset += buffer.length;
}

for (const entry of entries) {
  const name = Buffer.from(entry.zipName.replaceAll("\\", "/"), "utf8");
  const { dosDate, dosTime } = dosDateTime(entry.mtime);
  const data = entry.isDirectory ? Buffer.alloc(0) : await readFile(entry.absPath);
  const compressed = entry.isDirectory ? Buffer.alloc(0) : zlib.deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const method = entry.isDirectory ? 0 : 8;
  const localOffset = offset;

  const localHeader = Buffer.concat([
    uint32(0x04034b50),
    uint16(20),
    uint16(0x0800),
    uint16(method),
    uint16(dosTime),
    uint16(dosDate),
    uint32(crc),
    uint32(compressed.length),
    uint32(data.length),
    uint16(name.length),
    uint16(0),
    name
  ]);
  write(localHeader);
  write(compressed);

  const externalAttributes = ((entry.mode & 0xffff) << 16) | (entry.isDirectory ? 0x10 : 0);
  centralDirectory.push(
    Buffer.concat([
      uint32(0x02014b50),
      uint16((3 << 8) | 20),
      uint16(20),
      uint16(0x0800),
      uint16(method),
      uint16(dosTime),
      uint16(dosDate),
      uint32(crc),
      uint32(compressed.length),
      uint32(data.length),
      uint16(name.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(externalAttributes),
      uint32(localOffset),
      name
    ])
  );
}

const centralStart = offset;
for (const header of centralDirectory) {
  write(header);
}
const centralSize = offset - centralStart;

write(
  Buffer.concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entries.length),
    uint16(entries.length),
    uint32(centralSize),
    uint32(centralStart),
    uint16(0)
  ])
);

await new Promise((resolve, reject) => {
  output.end(resolve);
  output.on("error", reject);
});

console.log(`Created ${zipPath}`);
