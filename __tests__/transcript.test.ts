import { FetchedTranscript, FetchedTranscriptSnippet } from '../src/transcripts';

describe('FetchedTranscript', () => {
    let transcript: FetchedTranscript;
    const mockSnippets: FetchedTranscriptSnippet[] = [
        new FetchedTranscriptSnippet('First snippet', 0, 5),
        new FetchedTranscriptSnippet('Second snippet', 5, 5),
        new FetchedTranscriptSnippet('Third snippet', 10, 5),
    ];

    beforeEach(() => {
        transcript = new FetchedTranscript(
            mockSnippets,
            'test-video-id',
            'English',
            'en',
            false
        );
    });

    test('should be initialized correctly', () => {
        expect(transcript.videoId).toBe('test-video-id');
        expect(transcript.language).toBe('English');
        expect(transcript.languageCode).toBe('en');
        expect(transcript.isGenerated).toBe(false);
        expect(transcript.snippets).toEqual(mockSnippets);
    });

    test('should convert to raw data correctly', () => {
        const rawData = transcript.toRawData();
        expect(rawData).toEqual([
            { text: 'First snippet', start: 0, duration: 5 },
            { text: 'Second snippet', start: 5, duration: 5 },
            { text: 'Third snippet', start: 10, duration: 5 }
        ]);
    });

    test('should be iterable', () => {
        const snippets = [...transcript];
        expect(snippets).toEqual(mockSnippets);
    });
}); 