/**
 * Strips the page furniture that article capture picks up (share buttons, dates, bylines, photo
 * credits, image file names, "follow us" prompts) so the reader panel and the AI only see the story.
 * Deterministic (AGENTS.md rule 9). Paragraphs come back separated by a blank line.
 */

const JUNK_LINE = [
  /^[•·|\-–—*>]+$/, // lone bullets and separators
  /^(published|updated|posted|last updated|modified)\b.{0,60}$/i,
  /\.(png|jpe?g|gif|webp|svg|avif)$/i, // image file names
  /^(photo|image|picture|file photo|graphics?|illustration|video)\s*:/i,
  /^(photo|image)\s*(credit|courtesy)/i,
  /\b(tap|click) here to\b/i,
  /google-preferred-source|trusted source/i,
  /^(share|share this|share on \w+|tweet|print|email|copy link|comments?|\d+\s*comments?)$/i,
  /^(follow us|subscribe|sign up|read more|read also|also read|related|see also|advertisement|sponsored|recommended)\b/i,
  /^(home|news|world|business|sports?|opinion|bangladesh|politics|top news|latest)$/i,
  /^\d{1,2}\s*(min|minute)s?\s*read$/i
];

const words = (line: string) => line.split(/\s+/).filter(Boolean).length;
const isSentence = (line: string) => /[.!?"”’)]$/.test(line);

/** Short, unpunctuated lines are bylines, kickers or labels when they sit above the story. */
const looksLikeHeaderLine = (line: string) => words(line) < 6 && !isSentence(line);

export function cleanArticleText(text: string, title = ''): string {
  const titleKey = title.trim().toLowerCase();
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const out: string[] = [];
  let storyStarted = false;
  for (const line of lines) {
    if (JUNK_LINE.some((re) => re.test(line))) continue;
    if (titleKey && line.toLowerCase() === titleKey) continue;
    if (!storyStarted) {
      // The story starts at the first full sentence of real length; a long unpunctuated line is a standfirst
      if (words(line) >= 12 && isSentence(line)) storyStarted = true;
      else if (looksLikeHeaderLine(line)) continue;
    }
    if (out[out.length - 1] === line) continue;
    out.push(line);
  }
  return out.join('\n\n');
}

/** Paragraphs with the offset where each starts in `text` (for highlighting evidence). */
export function paragraphsWithOffsets(text: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  const re = /[^\n]+(?:\n(?!\s*\n)[^\n]+)*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[0].trim()) out.push({ text: m[0], start: m.index });
  }
  return out;
}
