const TOP_LEVEL_SECTION_PATTERN = /^##\s+(.+?)\s*$/;

export interface ParsedBodySection {
  heading: string;
  content: string;
}

export interface ParsedBodyStructure {
  preamble: string;
  sections: ParsedBodySection[];
}

export function parseBodyStructure(body: string): ParsedBodyStructure {
  const lines = body.split(/\r?\n/);
  const sections: ParsedBodySection[] = [];
  const preambleLines: string[] = [];
  let currentSectionHeading: string | undefined;
  let currentSectionLines: string[] = [];

  for (const line of lines) {
    const headingMatch = TOP_LEVEL_SECTION_PATTERN.exec(line);

    if (headingMatch) {
      if (currentSectionHeading) {
        sections.push({
          heading: currentSectionHeading,
          content: currentSectionLines.join('\n').trim(),
        });
      }

      currentSectionHeading = headingMatch[1]!;
      currentSectionLines = [];
      continue;
    }

    if (currentSectionHeading) {
      currentSectionLines.push(line);
    } else {
      preambleLines.push(line);
    }
  }

  if (currentSectionHeading) {
    sections.push({
      heading: currentSectionHeading,
      content: currentSectionLines.join('\n').trim(),
    });
  }

  return {
    preamble: preambleLines.join('\n').trim(),
    sections,
  };
}
