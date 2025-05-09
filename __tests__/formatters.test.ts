import { TextFormatter, JSONFormatter, SRTFormatter } from '../src/formatters';
import { FetchedTranscript, FetchedTranscriptSnippet } from '../src/transcripts';

describe('Formatters', () => {
    let transcript: FetchedTranscript;

    beforeEach(() => {
        const snippets = [
            new FetchedTranscriptSnippet('First line', 0, 2),
            new FetchedTranscriptSnippet('Second line', 3, 2),
            new FetchedTranscriptSnippet('Third line', 6, 2)
        ];

        transcript = new FetchedTranscript(
            snippets,
            'test-video-id',
            'English',
            'en',
            false
        );
    });

    describe('TextFormatter', () => {
        test('should format transcript as text', () => {
            const formatter = new TextFormatter();
            const result = formatter.formatTranscript(transcript);

            expect(result).toContain('First line');
            expect(result).toContain('Second line');
            expect(result).toContain('Third line');
        });
    });

    describe('JSONFormatter', () => {
        test('should format transcript as JSON', () => {
            const formatter = new JSONFormatter();
            const result = formatter.formatTranscript(transcript);
            const parsed = JSON.parse(result);

            expect(parsed).toHaveLength(3);
            expect(parsed[0]).toEqual({
                text: 'First line',
                start: 0,
                duration: 2
            });
        });
    });

    describe('SRTFormatter', () => {
        test('should format transcript as SRT', () => {
            const formatter = new SRTFormatter();
            const result = formatter.formatTranscript(transcript);

            expect(result).toContain('1');
            expect(result).toContain('00:00:00,000 --> 00:00:02,000');
            expect(result).toContain('First line');

            expect(result).toContain('2');
            expect(result).toContain('00:00:03,000 --> 00:00:05,000');
            expect(result).toContain('Second line');

            expect(result).toContain('3');
            expect(result).toContain('00:00:06,000 --> 00:00:08,000');
            expect(result).toContain('Third line');
        });
    });
}); 