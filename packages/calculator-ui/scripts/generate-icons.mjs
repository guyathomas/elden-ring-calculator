import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

function generateIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background - dark Elden Ring themed
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, '#2a2a4e');
  gradient.addColorStop(1, '#0f0f1a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Elden Ring style - golden ring
  const centerX = size / 2;
  const centerY = size / 2;
  const ringRadius = size * 0.35;
  const ringWidth = size * 0.06;

  // Outer glow
  ctx.shadowColor = '#d4af37';
  ctx.shadowBlur = size * 0.08;

  // Draw the ring
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = ringWidth;
  ctx.beginPath();
  ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Draw runes/marks around the ring
  ctx.shadowBlur = 0;
  const runeCount = 8;
  const runeRadius = ringRadius + ringWidth;
  ctx.fillStyle = '#d4af37';
  ctx.font = `bold ${size * 0.08}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < runeCount; i++) {
    const angle = (i / runeCount) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * runeRadius;
    const y = centerY + Math.sin(angle) * runeRadius;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.015, 0, Math.PI * 2);
    ctx.fill();
  }

  // Center sword icon
  const swordLength = size * 0.3;
  const swordWidth = size * 0.04;

  ctx.fillStyle = '#c0c0c0';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = size * 0.02;

  // Blade
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - swordLength * 0.6);
  ctx.lineTo(centerX + swordWidth / 2, centerY + swordLength * 0.2);
  ctx.lineTo(centerX - swordWidth / 2, centerY + swordLength * 0.2);
  ctx.closePath();
  ctx.fill();

  // Guard
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(
    centerX - swordWidth * 1.5,
    centerY + swordLength * 0.15,
    swordWidth * 3,
    swordWidth * 0.6
  );

  // Handle
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(
    centerX - swordWidth * 0.3,
    centerY + swordLength * 0.2,
    swordWidth * 0.6,
    swordLength * 0.25
  );

  // Pommel
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.arc(centerX, centerY + swordLength * 0.48, swordWidth * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Save the image
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(publicDir, filename), buffer);
  console.log(`Generated ${filename}`);
}

// Generate icons
generateIcon(192, 'pwa-192x192.png');
generateIcon(512, 'pwa-512x512.png');
generateIcon(180, 'apple-touch-icon.png');

// Generate favicon (smaller version)
function generateFavicon() {
  const size = 32;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, size, size);

  // Simple golden ring
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.35, 0, Math.PI * 2);
  ctx.stroke();

  // Simple sword
  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.moveTo(size / 2, 6);
  ctx.lineTo(size / 2 + 3, 20);
  ctx.lineTo(size / 2 - 3, 20);
  ctx.closePath();
  ctx.fill();

  // Guard
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(size / 2 - 5, 19, 10, 2);

  // Handle
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(size / 2 - 1.5, 21, 3, 6);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), buffer);
  console.log('Generated favicon.ico');
}

generateFavicon();

console.log('All icons generated successfully!');
