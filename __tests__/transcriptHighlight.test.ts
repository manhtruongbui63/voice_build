import { buildTranscriptSegments } from '../src/utils/transcriptHighlight';

const keywordText = (transcript: string, keywords?: string[]) =>
  buildTranscriptSegments(transcript, keywords)
    .filter((segment) => segment.keyword)
    .map((segment) => segment.text.trim())
    .filter(Boolean);

describe('buildTranscriptSegments', () => {
  it('returns an empty list for an empty transcript', () => {
    expect(buildTranscriptSegments('')).toEqual([]);
  });

  it('highlights digit quantities and units without any product context', () => {
    const highlighted = keywordText('bán 2 kg và 3 túi');

    expect(highlighted).toEqual(['2', 'kg', '3', 'túi']);
  });

  it('highlights Vietnamese number words regardless of tones', () => {
    const highlighted = keywordText('lấy hai bao và một túi');

    expect(highlighted).toEqual(['hai', 'bao', 'một', 'túi']);
  });

  it('highlights product name and alias words from context (tone-insensitive)', () => {
    const highlighted = keywordText('cho 2 kg gạo thơm', ['Gạo thơm ST25', 'gao-thom']);

    // "gạo" và "thơm" thuộc tên sản phẩm -> tô; "cho" không phải keyword.
    expect(highlighted).toEqual(['2', 'kg', 'gạo', 'thơm']);
  });

  it('reconstructs the original transcript when concatenating all segments', () => {
    const transcript = 'bán 2 kg gạo ST25';
    const rebuilt = buildTranscriptSegments(transcript, ['Gạo ST25'])
      .map((segment) => segment.text)
      .join('');

    expect(rebuilt).toBe(transcript);
  });

  it('does not highlight ordinary filler words', () => {
    const segments = buildTranscriptSegments('cho tôi xin', []);

    expect(segments.every((segment) => !segment.keyword)).toBe(true);
  });
});
