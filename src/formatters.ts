// Forward declaration to avoid circular dependency
interface FetchedTranscript {
    snippets: FetchedTranscriptSnippet[];
    toRawData(): TranscriptData[];
}

interface FetchedTranscriptSnippet {
    text: string;
    start: number;
    duration: number;
}

// Define a type for transcript data
export interface TranscriptData {
    text: string;
    start: number;
    duration: number;
}

export abstract class Formatter {
    /**
     * Format a transcript into a string.
     * @param transcript The transcript to format.
     */
    abstract formatTranscript(transcript: FetchedTranscript): string;

    /**
     * Format multiple transcripts into a string.
     * @param transcripts The transcripts to format.
     */
    abstract formatTranscripts(transcripts: FetchedTranscript[]): string;
}

export class PrettyPrintFormatter extends Formatter {
    formatTranscript(transcript: FetchedTranscript): string {
        return JSON.stringify(transcript.toRawData(), null, 2);
    }

    formatTranscripts(transcripts: FetchedTranscript[]): string {
        return JSON.stringify(transcripts.map(t => t.toRawData()), null, 2);
    }
}

export class JSONFormatter extends Formatter {
    formatTranscript(transcript: FetchedTranscript): string {
        return JSON.stringify(transcript.toRawData());
    }

    formatTranscripts(transcripts: FetchedTranscript[]): string {
        return JSON.stringify(transcripts.map(t => t.toRawData()));
    }
}

export class TextFormatter extends Formatter {
    formatTranscript(transcript: FetchedTranscript): string {
        return transcript.snippets.map(line => line.text).join("\n");
    }

    formatTranscripts(transcripts: FetchedTranscript[]): string {
        return transcripts.map(transcript => this.formatTranscript(transcript)).join("\n\n\n");
    }
}

export abstract class TextBasedFormatter extends TextFormatter {
    protected abstract formatTimestamp(hours: number, mins: number, secs: number, ms: number): string;
    protected abstract formatTranscriptHeader(lines: string[]): string;
    protected abstract formatTranscriptHelper(_i: number, timeText: string, snippet: FetchedTranscriptSnippet): string;

    protected secondsToTimestamp(time: number): string {
        time = parseFloat(time.toString());
        const hoursFloat = Math.floor(time / 3600);
        const remainder = time % 3600;
        const minsFloat = Math.floor(remainder / 60);
        const secsFloat = Math.floor(remainder % 60);
        const hours = Math.floor(hoursFloat);
        const mins = Math.floor(minsFloat);
        const secs = Math.floor(secsFloat);
        const ms = Math.round((time - Math.floor(time)) * 1000);
        return this.formatTimestamp(hours, mins, secs, ms);
    }

    formatTranscript(transcript: FetchedTranscript): string {
        const lines: string[] = [];
        for (let i = 0; i < transcript.snippets.length; i++) {
            const line = transcript.snippets[i];
            const end = line.start + line.duration;
            const nextStart = (i < transcript.snippets.length - 1 && transcript.snippets[i + 1].start < end)
                ? transcript.snippets[i + 1].start
                : end;
            const timeText = `${this.secondsToTimestamp(line.start)} --> ${this.secondsToTimestamp(nextStart)}`;
            lines.push(this.formatTranscriptHelper(i, timeText, line));
        }
        return this.formatTranscriptHeader(lines);
    }
}

export class SRTFormatter extends TextBasedFormatter {
    protected formatTimestamp(hours: number, mins: number, secs: number, ms: number): string {
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    }

    protected formatTranscriptHeader(lines: string[]): string {
        return `${lines.join("\n\n")}\n`;
    }

    protected formatTranscriptHelper(_i: number, timeText: string, snippet: FetchedTranscriptSnippet): string {
        return `${String(_i + 1)}\n${timeText}\n${snippet.text}`;
    }
}

export class WebVTTFormatter extends TextBasedFormatter {
    protected formatTimestamp(hours: number, mins: number, secs: number, ms: number): string {
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }

    protected formatTranscriptHeader(lines: string[]): string {
        return `WEBVTT\n\n${lines.join("\n\n")}\n`;
    }

    protected formatTranscriptHelper(_i: number, timeText: string, snippet: FetchedTranscriptSnippet): string {
        return `${timeText}\n${snippet.text}`;
    }
}

export class FormatterLoader {
    static readonly TYPES: Record<string, new () => Formatter> = {
        "json": JSONFormatter,
        "pretty": PrettyPrintFormatter,
        "text": TextFormatter,
        "webvtt": WebVTTFormatter,
        "srt": SRTFormatter
    };

    static readonly UnknownFormatterType = class extends Error {
        constructor(formatterType: string) {
            super(`The format '${formatterType}' is not supported. Choose one of the following formats: ${Object.keys(FormatterLoader.TYPES).join(", ")}`);
            this.name = 'UnknownFormatterType';
        }
    };

    load(formatterType = "pretty"): Formatter {
        if (!(formatterType in FormatterLoader.TYPES)) {
            throw new FormatterLoader.UnknownFormatterType(formatterType);
        }
        const FormatterClass = FormatterLoader.TYPES[formatterType];
        return new FormatterClass();
    }
}