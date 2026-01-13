import fs from 'fs';
import path from 'path';
import { ChangelogRelease, SectionType } from './types';

const SECTION_NAMES: Record<string, SectionType> = {
  'added': 'added',
  'changed': 'changed',
  'fixed': 'fixed',
  'removed': 'removed',
  'deprecated': 'deprecated',
  'security': 'security',
  // Russian section names
  'добавлено': 'added',
  'изменено': 'changed',
  'исправлено': 'fixed',
  'удалено': 'removed',
  'устарело': 'deprecated',
  'безопасность': 'security',
};

export function parseChangelog(locale: string): ChangelogRelease[] {
  const filePath = path.join(process.cwd(), `CHANGELOG-${locale}.md`);

  // Fallback to English if locale file doesn't exist
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    const fallbackPath = path.join(process.cwd(), 'CHANGELOG-en.md');
    try {
      content = fs.readFileSync(fallbackPath, 'utf-8');
    } catch {
      return [];
    }
  }

  const releases: ChangelogRelease[] = [];

  // Split content by release headers (with optional title after date)
  const releaseRegex = /## \[(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)\] - (\d{4}-\d{2}-\d{2})(?:\s*[—–-]\s*(.+))?/g;
  const matches = [...content.matchAll(releaseRegex)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const version = match[1];
    const date = match[2];
    const title = match[3]?.trim();
    const startIndex = match.index! + match[0].length;
    const endIndex = matches[i + 1]?.index ?? content.length;

    const releaseContent = content.slice(startIndex, endIndex);
    const sections = parseSections(releaseContent);

    releases.push({ version, date, title, sections });
  }

  return releases;
}

function parseSections(content: string): ChangelogRelease['sections'] {
  const sections: ChangelogRelease['sections'] = {};

  // Match section headers (### Added, ### Fixed, etc.)
  const sectionRegex = /### ([^\n]+)\n([\s\S]*?)(?=###|$)/gi;
  const matches = [...content.matchAll(sectionRegex)];

  for (const match of matches) {
    const sectionName = match[1].trim().toLowerCase();
    const sectionType = SECTION_NAMES[sectionName];

    if (sectionType) {
      const items = parseItems(match[2]);
      if (items.length > 0) {
        sections[sectionType] = items;
      }
    }
  }

  return sections;
}

function parseItems(content: string): string[] {
  const items: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Match list items (- item or * item)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      items.push(trimmed.slice(2).trim());
    }
  }

  return items;
}
