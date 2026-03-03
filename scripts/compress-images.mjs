import { promises as fs } from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const options = {
    rootDir: 'src',
    quality: 82,
    minBytes: 300_000,
    maxWidth: 1080,
    includeSmall: false,
  };

  for (const arg of argv) {
    if (arg.startsWith('--quality=')) {
      options.quality = Number(arg.slice('--quality='.length));
    } else if (arg.startsWith('--min-bytes=')) {
      options.minBytes = Number(arg.slice('--min-bytes='.length));
    } else if (arg.startsWith('--max-width=')) {
      options.maxWidth = Number(arg.slice('--max-width='.length));
    } else if (arg === '--include-small') {
      options.includeSmall = true;
    } else if (!arg.startsWith('--')) {
      options.rootDir = arg;
    }
  }

  return options;
}

async function listPngFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listPngFiles(fullPath);
      return entry.isFile() && entry.name.toLowerCase().endsWith('.png') ? [fullPath] : [];
    })
  );
  return files.flat();
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('Missing dependency: sharp');
    console.error('Run: npm install -D sharp');
    process.exit(1);
  }

  const rootDir = path.resolve(options.rootDir);
  const pngFiles = await listPngFiles(rootDir);
  if (pngFiles.length === 0) {
    console.log(`No PNG files found under ${rootDir}`);
    return;
  }

  let convertedCount = 0;
  let totalPngBytes = 0;
  let totalWebpBytes = 0;

  for (const pngPath of pngFiles) {
    const stat = await fs.stat(pngPath);
    if (!options.includeSmall && stat.size < options.minBytes) continue;

    const image = sharp(pngPath);
    const metadata = await image.metadata();
    const processed =
      typeof metadata.width === 'number' && metadata.width > options.maxWidth
        ? image.resize({ width: options.maxWidth, withoutEnlargement: true })
        : image;

    const webpBuffer = await processed.webp({ quality: options.quality }).toBuffer();
    const webpPath = pngPath.replace(/\.png$/i, '.webp');
    await fs.writeFile(webpPath, webpBuffer);

    convertedCount += 1;
    totalPngBytes += stat.size;
    totalWebpBytes += webpBuffer.byteLength;
    const savings = stat.size - webpBuffer.byteLength;
    console.log(
      `${path.relative(process.cwd(), pngPath)} -> ${path.relative(process.cwd(), webpPath)} (${formatBytes(
        stat.size
      )} -> ${formatBytes(webpBuffer.byteLength)}, saved ${formatBytes(savings)})`
    );
  }

  if (convertedCount === 0) {
    console.log(
      `No PNG files matched the threshold under ${rootDir} (min-bytes=${options.minBytes}).`
    );
    return;
  }

  const totalSavings = totalPngBytes - totalWebpBytes;
  console.log('');
  console.log(`Converted ${convertedCount} PNG files.`);
  console.log(
    `Total size: ${formatBytes(totalPngBytes)} -> ${formatBytes(totalWebpBytes)} (saved ${formatBytes(totalSavings)}).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
