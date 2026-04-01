import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
const pngNames = ["favicon-16x16.png", "favicon-32x32.png", "favicon-48x48.png"];

function readPng(filePath) {
  const buffer = fs.readFileSync(filePath);
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error(`Not a PNG: ${filePath}`);
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  return { buffer, width, height };
}

const images = pngNames.map((name) => readPng(path.join(publicDir, name)));
const count = images.length;
const headerSize = 6;
const dirEntrySize = 16;
const dirTableSize = count * dirEntrySize;
let offset = headerSize + dirTableSize;

const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(count, 4);

const entries = [];
const payloads = [];

for (const image of images) {
  const entry = Buffer.alloc(dirEntrySize);
  entry.writeUInt8(image.width >= 256 ? 0 : image.width, 0);
  entry.writeUInt8(image.height >= 256 ? 0 : image.height, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(image.buffer.length, 8);
  entry.writeUInt32LE(offset, 12);

  entries.push(entry);
  payloads.push(image.buffer);
  offset += image.buffer.length;
}

const icoBuffer = Buffer.concat([header, ...entries, ...payloads]);
const outPath = path.join(publicDir, "favicon.ico");
fs.writeFileSync(outPath, icoBuffer);
console.log(`Generated ${outPath}`);
