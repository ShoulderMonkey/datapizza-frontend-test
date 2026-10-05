// Next's standalone output does not include .next/static and public/.
// Copy them next to .next/standalone/server.js so `npm run start` can serve them.
// Cross-platform (fs.cpSync), no extra dependencies.
import {cpSync, existsSync} from 'node:fs';

const targets = [
  ['.next/static', '.next/standalone/.next/static'],
  ['public', '.next/standalone/public'],
];

for (const [from, to] of targets) {
  if (existsSync(from)) cpSync(from, to, {recursive: true});
}
