import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createHash } from "node:crypto";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const EXTENSION_ID = "ophjlpahpchlmihnnnihgmmeilfjmjjc";
const CRX_URL =
  "https://clients2.google.com/service/update2/crx" +
  "?response=redirect" +
  "&prodversion=125.0" +
  "&acceptformat=crx2,crx3" +
  `&x=id%3D${EXTENSION_ID}%26installsource%3Dondemand%26uc`;

const VENDOR_DIR = path.join(ROOT, "vendor");
const CRX_PATH = path.join(VENDOR_DIR, "line.crx");
const DIST_DIR = path.join(ROOT, "dist", "line-darkfy");
const DARK_CSS_SOURCE = path.join(ROOT, "src", "darkfy.css");

const args = new Set(process.argv.slice(2));

function readVarint(buffer, offset) {
  let value = 0;
  let shift = 0;
  let position = offset;

  while (position < buffer.length) {
    const byte = buffer[position++];
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return [value, position];
    }
    shift += 7;
  }

  throw new Error("Unexpected end of protobuf varint");
}

function parseProtoFields(buffer) {
  const fields = [];
  let offset = 0;

  while (offset < buffer.length) {
    const [tag, tagEnd] = readVarint(buffer, offset);
    offset = tagEnd;

    const field = tag >> 3;
    const wireType = tag & 7;

    if (wireType === 2) {
      const [length, lengthEnd] = readVarint(buffer, offset);
      offset = lengthEnd;
      fields.push({
        field,
        value: buffer.subarray(offset, offset + length)
      });
      offset += length;
      continue;
    }

    if (wireType === 0) {
      const [value, valueEnd] = readVarint(buffer, offset);
      offset = valueEnd;
      fields.push({ field, value });
      continue;
    }

    throw new Error(`Unsupported protobuf wire type ${wireType}`);
  }

  return fields;
}

function publicKeyToExtensionId(publicKey) {
  const hash = createHash("sha256").update(publicKey).digest().subarray(0, 16);
  const hex = [...hash].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return hex.replace(/[0-9a-f]/g, (char) =>
    String.fromCharCode("a".charCodeAt(0) + Number.parseInt(char, 16))
  );
}

async function getManifestKeyForExtensionId() {
  const crx = await readFile(CRX_PATH);
  if (crx.subarray(0, 4).toString("ascii") !== "Cr24") {
    throw new Error("Downloaded file does not look like a CRX file");
  }

  const version = crx.readUInt32LE(4);
  if (version !== 3) {
    throw new Error(`Unsupported CRX version ${version}`);
  }

  const headerSize = crx.readUInt32LE(8);
  const header = crx.subarray(12, 12 + headerSize);
  const proofFields = parseProtoFields(header).filter(({ field }) => field === 2 || field === 3);

  for (const proofField of proofFields) {
    const publicKey = parseProtoFields(proofField.value).find(({ field }) => field === 1)?.value;
    if (!Buffer.isBuffer(publicKey)) {
      continue;
    }

    if (publicKeyToExtensionId(publicKey) === EXTENSION_ID) {
      return publicKey.toString("base64");
    }
  }

  throw new Error(`Could not find a public key for extension ID ${EXTENSION_ID}`);
}

async function downloadCrx() {
  await mkdir(VENDOR_DIR, { recursive: true });

  if (existsSync(CRX_PATH) && !args.has("--force-download")) {
    console.log(`Using existing ${path.relative(ROOT, CRX_PATH)}`);
    return;
  }

  console.log("Downloading LINE CRX from the Chrome update service...");
  const response = await fetch(CRX_URL, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/125 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`CRX download failed: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024 * 1024) {
    throw new Error(`Downloaded file is unexpectedly small (${buffer.length} bytes)`);
  }

  await writeFile(CRX_PATH, buffer);
  console.log(`Saved ${path.relative(ROOT, CRX_PATH)} (${buffer.length} bytes)`);
}

function extractCrx() {
  console.log(`Extracting to ${path.relative(ROOT, DIST_DIR)}...`);
  const result = spawnSync("7z", ["x", "-y", CRX_PATH, `-o${DIST_DIR}`], {
    cwd: ROOT,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`7z exited with status ${result.status}`);
  }
}

async function patchManifest() {
  const manifestPath = path.join(DIST_DIR, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  delete manifest.update_url;
  manifest.name = "LINE Darkfy";
  manifest.short_name = "LINE Darkfy";
  manifest.version_name = `${manifest.version} + darkfy`;
  manifest.key = await getManifestKeyForExtensionId();
  manifest.action = {
    ...manifest.action,
    default_title: "LINE Darkfy"
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function patchHtml(fileName) {
  const htmlPath = path.join(DIST_DIR, fileName);
  let html = await readFile(htmlPath, "utf8");

  html = html.replace(/<html\b(?![^>]*\bdata-line-darkfy=)/, '<html data-line-darkfy="dark"');

  if (!html.includes('name="color-scheme"')) {
    html = html.replace("</head>", '<meta name="color-scheme" content="dark"/></head>');
  }

  const link = '<link href="/darkfy.css" rel="stylesheet">';
  if (!html.includes(link)) {
    html = html.replace("</head>", `${link}</head>`);
  }

  await writeFile(htmlPath, html);
}

async function patchAssetManifest() {
  const assetManifestPath = path.join(DIST_DIR, "asset-manifest.json");
  const assetManifest = JSON.parse(await readFile(assetManifestPath, "utf8"));
  assetManifest.files = {
    ...assetManifest.files,
    "darkfy.css": "/darkfy.css"
  };
  await writeFile(assetManifestPath, `${JSON.stringify(assetManifest, null, 2)}\n`);
}

async function main() {
  await downloadCrx();
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });
  extractCrx();

  await rm(path.join(DIST_DIR, "_metadata"), { recursive: true, force: true });
  await writeFile(path.join(DIST_DIR, "darkfy.css"), await readFile(DARK_CSS_SOURCE, "utf8"));
  await patchManifest();
  await patchAssetManifest();
  await patchHtml("index.html");
  await patchHtml("popup.html");

  console.log("");
  console.log("Done.");
  console.log(`Load unpacked: ${DIST_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
