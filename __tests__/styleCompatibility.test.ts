import fs from 'fs';
import path from 'path';

const SRC_DIR = path.join(__dirname, '..', 'src');
const UNSUPPORTED_BORDER_STYLE = /borderStyle:\s*['"](dashed|dotted)['"]/g;

const collectSourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });

describe('React Native style compatibility', () => {
  it('does not use dashed or dotted borderStyle values', () => {
    const offenders = collectSourceFiles(SRC_DIR).flatMap((filePath) => {
      const contents = fs.readFileSync(filePath, 'utf8');
      const matches = [...contents.matchAll(UNSUPPORTED_BORDER_STYLE)];
      return matches.map((match) => `${path.relative(SRC_DIR, filePath)} uses ${match[0]}`);
    });

    expect(offenders).toEqual([]);
  });
});
