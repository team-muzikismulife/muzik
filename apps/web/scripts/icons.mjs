import fs from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AudioLines } from 'lucide-react';
import sharp from 'sharp';
const symbol = renderToStaticMarkup(React.createElement(AudioLines, { width: 256, height: 256, color: '#9c8fff', strokeWidth: 2.2 }));
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#121212"/><g transform="translate(128 128)">${symbol}</g></svg>`);
await fs.mkdir('public/icons', { recursive: true });
for (const [file, size] of [['icon-192',192],['icon-512',512],['maskable-512',512],['apple-touch-icon',180]]) await sharp(svg).resize(size,size).png().toFile(`public/icons/${file}.png`);
