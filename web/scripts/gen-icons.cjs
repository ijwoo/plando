const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png");

function buildIco(pngBuffers) {
    // pngBuffers: [{size, buf}]
    const count = pngBuffers.length;
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // type: icon
    header.writeUInt16LE(count, 4);

    const entries = [];
    let offset = 6 + count * 16;
    for (const { size, buf } of pngBuffers) {
        const e = Buffer.alloc(16);
        e.writeUInt8(size >= 256 ? 0 : size, 0); // width
        e.writeUInt8(size >= 256 ? 0 : size, 1); // height
        e.writeUInt8(0, 2); // color count
        e.writeUInt8(0, 3); // reserved
        e.writeUInt16LE(1, 4); // planes
        e.writeUInt16LE(32, 6); // bit count
        e.writeUInt32LE(buf.length, 8); // bytes in res
        e.writeUInt32LE(offset, 12); // image offset
        offset += buf.length;
        entries.push(e);
    }
    return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.buf)]);
}

async function main() {
    const icoSizes = [16, 32, 48, 64, 128, 256];
    const pngBuffers = [];
    for (const size of icoSizes) {
        const buf = await sharp(SRC).resize(size, size).png().toBuffer();
        pngBuffers.push({ size, buf });
    }
    const ico = buildIco(pngBuffers);
    fs.writeFileSync(path.join(ROOT, "public/icon.ico"), ico);
    fs.writeFileSync(path.join(ROOT, "assets/icon.ico"), ico);

    // PNG variants
    await sharp(SRC).resize(512, 512).png().toFile(path.join(ROOT, "public/icon.png"));
    await sharp(SRC).resize(512, 512).png().toFile(path.join(ROOT, "assets/icon.png"));
    await sharp(SRC).resize(192, 192).png().toFile(path.join(ROOT, "public/icon-192.png"));
    await sharp(SRC).resize(180, 180).png().toFile(path.join(ROOT, "public/apple-touch-icon.png"));

    console.log("Icons regenerated from", path.relative(ROOT, SRC));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
