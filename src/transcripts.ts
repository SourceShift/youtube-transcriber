import { AxiosInstance } from 'axios';
import { JSDOM } from 'jsdom';

import { WATCH_URL } from './settings';
import { ProxyConfig } from './proxies';

import {
    VideoUnavailable,
    NoTranscriptFound,
    TranscriptsDisabled,
    NotTranslatable,
    TranslationLanguageNotAvailable,
    FailedToCreateConsentCookie,
    InvalidVideoId,
    IpBlocked,
    RequestBlocked,
    AgeRestricted,
    VideoUnplayable,
    YouTubeDataUnparsable
} from './errors';

export interface FetchedTranscriptSnippetData {
    text: string;
    start: number;
    duration: number;
}

export class FetchedTranscriptSnippet {
    text: string;
    start: number;
    duration: number;

    constructor(text: string, start: number, duration: number) {
        this.text = text;
        this.start = start;
        this.duration = duration;
    }
}

export class FetchedTranscript {
    snippets: FetchedTranscriptSnippet[];
    videoId: string;
    language: string;
    languageCode: string;
    isGenerated: boolean;

    constructor(
        snippets: FetchedTranscriptSnippet[],
        videoId: string,
        language: string,
        languageCode: string,
        isGenerated: boolean
    ) {
        this.snippets = snippets;
        this.videoId = videoId;
        this.language = language;
        this.languageCode = languageCode;
        this.isGenerated = isGenerated;
    }

    [Symbol.iterator]() {
        return this.snippets[Symbol.iterator]();
    }

    toRawData(): FetchedTranscriptSnippetData[] {
        return this.snippets.map(snippet => ({
            text: snippet.text,
            start: snippet.start,
            duration: snippet.duration
        }));
    }
}

interface TranslationLanguage {
    language: string;
    languageCode: string;
}

enum PlayabilityStatus {
    OK = "OK",
    ERROR = "ERROR",
    LOGIN_REQUIRED = "LOGIN_REQUIRED"
}

enum PlayabilityFailedReason {
    BOT_DETECTED = "Sign in to confirm you're not a bot",
    AGE_RESTRICTED = "Sign in to confirm your age",
    VIDEO_UNAVAILABLE = "Video unavailable"
}

export class Transcript {
    private httpClient: AxiosInstance;
    videoId: string;
    private url: string;
    language: string;
    languageCode: string;
    isGenerated: boolean;
    translationLanguages: TranslationLanguage[];
    private translationLanguagesDict: Record<string, string>;

    constructor(
        httpClient: AxiosInstance,
        videoId: string,
        url: string,
        language: string,
        languageCode: string,
        isGenerated: boolean,
        translationLanguages: TranslationLanguage[]
    ) {
        this.httpClient = httpClient;
        this.videoId = videoId;
        this.url = url;
        this.language = language;
        this.languageCode = languageCode;
        this.isGenerated = isGenerated;
        this.translationLanguages = translationLanguages;
        this.translationLanguagesDict = Object.fromEntries(
            translationLanguages.map(tl => [tl.languageCode, tl.language])
        );
    }

    async fetch(preserveFormatting = false): Promise<FetchedTranscript> {
        const response = await this.httpClient.get(this.url);
        const parser = new TranscriptParser(preserveFormatting);
        const snippets = parser.parse(response.data);

        return new FetchedTranscript(
            snippets,
            this.videoId,
            this.language,
            this.languageCode,
            this.isGenerated
        );
    }

    toString(): string {
        return `${this.languageCode} ("${this.language}")${this.isTranslatable ? "[TRANSLATABLE]" : ""}`;
    }

    get isTranslatable(): boolean {
        return this.translationLanguages.length > 0;
    }

    translate(languageCode: string): Transcript {
        if (!this.isTranslatable) {
            throw new NotTranslatable(this.videoId);
        }

        if (!(languageCode in this.translationLanguagesDict)) {
            throw new TranslationLanguageNotAvailable(this.videoId);
        }

        return new Transcript(
            this.httpClient,
            this.videoId,
            `${this.url}&tlang=${languageCode}`,
            this.translationLanguagesDict[languageCode],
            languageCode,
            true,
            []
        );
    }
}

export class TranscriptList {
    videoId: string;
    private manuallyCreatedTranscripts: Record<string, Transcript>;
    private generatedTranscripts: Record<string, Transcript>;
    private translationLanguages: TranslationLanguage[];

    constructor(
        videoId: string,
        manuallyCreatedTranscripts: Record<string, Transcript>,
        generatedTranscripts: Record<string, Transcript>,
        translationLanguages: TranslationLanguage[]
    ) {
        this.videoId = videoId;
        this.manuallyCreatedTranscripts = manuallyCreatedTranscripts;
        this.generatedTranscripts = generatedTranscripts;
        this.translationLanguages = translationLanguages;
    }

    static build(
        httpClient: AxiosInstance,
        videoId: string,
        captionsJson: any
    ): TranscriptList {
        const translationLanguages: TranslationLanguage[] = (captionsJson.translationLanguages || []).map(
            (tl: any) => ({
                language: tl.languageName.simpleText,
                languageCode: tl.languageCode
            })
        );

        const manuallyCreatedTranscripts: Record<string, Transcript> = {};
        const generatedTranscripts: Record<string, Transcript> = {};

        for (const caption of captionsJson.captionTracks || []) {
            const transcriptDict = caption.kind === "asr" ? generatedTranscripts : manuallyCreatedTranscripts;

            transcriptDict[caption.languageCode] = new Transcript(
                httpClient,
                videoId,
                caption.baseUrl,
                caption.name.simpleText,
                caption.languageCode,
                caption.kind === "asr",
                caption.isTranslatable ? translationLanguages : []
            );
        }

        return new TranscriptList(
            videoId,
            manuallyCreatedTranscripts,
            generatedTranscripts,
            translationLanguages
        );
    }

    [Symbol.iterator]() {
        return [
            ...Object.values(this.manuallyCreatedTranscripts),
            ...Object.values(this.generatedTranscripts)
        ][Symbol.iterator]();
    }

    findTranscript(languageCodes: string[]): Transcript {
        return this.findTranscriptInternal(
            languageCodes,
            [this.manuallyCreatedTranscripts, this.generatedTranscripts]
        );
    }

    findGeneratedTranscript(languageCodes: string[]): Transcript {
        return this.findTranscriptInternal(
            languageCodes,
            [this.generatedTranscripts]
        );
    }

    findManuallyCreatedTranscript(languageCodes: string[]): Transcript {
        return this.findTranscriptInternal(
            languageCodes,
            [this.manuallyCreatedTranscripts]
        );
    }

    private findTranscriptInternal(
        languageCodes: string[],
        transcriptDicts: Record<string, Transcript>[]
    ): Transcript {
        for (const languageCode of languageCodes) {
            for (const transcriptDict of transcriptDicts) {
                if (languageCode in transcriptDict) {
                    return transcriptDict[languageCode];
                }
            }
        }

        throw new NoTranscriptFound(this.videoId, languageCodes, this);
    }

    toString(): string {
        return `For this video (${this.videoId}) transcripts are available in the following languages:

(MANUALLY CREATED)
${this.getLanguageDescription(Object.values(this.manuallyCreatedTranscripts).map(t => t.toString()))}

(GENERATED)
${this.getLanguageDescription(Object.values(this.generatedTranscripts).map(t => t.toString()))}

(TRANSLATION LANGUAGES)
${this.getLanguageDescription(this.translationLanguages.map(tl => `${tl.languageCode} ("${tl.language}")`))}`;
    }

    private getLanguageDescription(transcriptStrings: string[]): string {
        const description = transcriptStrings.map(t => ` - ${t}`).join("\n");
        return description || "None";
    }
}

export class TranscriptListFetcher {
    private httpClient: AxiosInstance;
    private proxyConfig: ProxyConfig | null;

    constructor(httpClient: AxiosInstance, proxyConfig: ProxyConfig | null = null) {
        this.httpClient = httpClient;
        this.proxyConfig = proxyConfig;
    }

    async fetch(videoId: string): Promise<TranscriptList> {
        return TranscriptList.build(
            this.httpClient,
            videoId,
            await this.fetchCaptionsJson(videoId)
        );
    }

    private async fetchCaptionsJson(videoId: string, tryNumber = 0): Promise<any> {
        try {
            const html = await this.fetchVideoHtml(videoId);
            return this.extractCaptionsJson(html, videoId);
        } catch (error) {
            if (error instanceof RequestBlocked) {
                const retries = this.proxyConfig?.retriesWhenBlocked || 0;
                if (tryNumber + 1 < retries) {
                    return this.fetchCaptionsJson(videoId, tryNumber + 1);
                }
                if (error instanceof Error &&
                    typeof (error as any).withProxyConfig === 'function') {
                    throw (error as any).withProxyConfig(this.proxyConfig);
                } else {
                    throw error;
                }
            }
            throw error;
        }
    }

    private extractCaptionsJson(html: string, videoId: string): any {
        const varParser = new JsVarParser("ytInitialPlayerResponse");
        let videoData;

        try {
            videoData = varParser.parse(html, videoId);
        } catch (error) {
            if (html.includes('class="g-recaptcha"')) {
                throw new IpBlocked(videoId);
            }
            throw error; // This should never happen!
        }

        this.assertPlayability(videoData.playabilityStatus, videoId);

        const captionsJson = videoData.captions?.playerCaptionsTracklistRenderer;
        if (!captionsJson?.captionTracks) {
            throw new TranscriptsDisabled(videoId);
        }

        return captionsJson;
    }

    private assertPlayability(playabilityStatusData: any, videoId: string): void {
        const playabilityStatus = playabilityStatusData?.status;
        if (playabilityStatus && playabilityStatus !== PlayabilityStatus.OK) {
            const reason = playabilityStatusData.reason;
            if (playabilityStatus === PlayabilityStatus.LOGIN_REQUIRED) {
                if (reason === PlayabilityFailedReason.BOT_DETECTED) {
                    throw new RequestBlocked(videoId);
                }
                if (reason === PlayabilityFailedReason.AGE_RESTRICTED) {
                    throw new AgeRestricted(videoId);
                }
            }
            if (
                playabilityStatus === PlayabilityStatus.ERROR &&
                reason === PlayabilityFailedReason.VIDEO_UNAVAILABLE
            ) {
                if (videoId.startsWith("http://") || videoId.startsWith("https://")) {
                    throw new InvalidVideoId(videoId);
                }
                throw new VideoUnavailable(videoId);
            }
            const subreasons = playabilityStatusData?.errorScreen?.playerErrorMessageRenderer?.subreason?.runs || [];
            throw new VideoUnplayable(
                videoId,
                reason,
                subreasons.map((run: any) => run.text || "")
            );
        }
    }

    private async createConsentCookie(html: string, videoId: string): Promise<void> {
        const match = /name="v" value="(.*?)"/.exec(html);
        if (!match) {
            throw new FailedToCreateConsentCookie(videoId);
        }

        // Set cookie on axios instance
        this.httpClient.defaults.headers.common.Cookie = `CONSENT=YES+${match[1]}`;
    }

    private async fetchVideoHtml(videoId: string): Promise<string> {
        let html = await this.fetchHtml(videoId);
        if (html.includes('action="https://consent.youtube.com/s"')) {
            await this.createConsentCookie(html, videoId);
            html = await this.fetchHtml(videoId);
            if (html.includes('action="https://consent.youtube.com/s"')) {
                throw new FailedToCreateConsentCookie(videoId);
            }
        }
        return html;
    }

    private async fetchHtml(videoId: string): Promise<string> {
        const url = WATCH_URL.replace("{video_id}", videoId);
        const response = await this.httpClient.get(url);
        return this.unescapeHtml(response.data);
    }

    private unescapeHtml(html: string): string {
        const entities: Record<string, string> = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&#x2F;': '/',
            '&#x60;': '`',
            '&#x3D;': '='
        };
        return html.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&#x2F;|&#x60;|&#x3D;/g, match => entities[match]);
    }
}

class TranscriptParser {
    private static FORMATTING_TAGS = [
        "strong", "em", "b", "i", "mark", "small", "del", "ins", "sub", "sup"
    ];

    private htmlRegex: RegExp;

    constructor(preserveFormatting = false) {
        this.htmlRegex = this.getHtmlRegex(preserveFormatting);
    }

    private getHtmlRegex(preserveFormatting: boolean): RegExp {
        if (preserveFormatting) {
            const formatsRegex = TranscriptParser.FORMATTING_TAGS.join("|");
            return new RegExp(`<\\/?(?!\\/?(?:${formatsRegex})\\b).*?\\b>`, "i");
        } else {
            return new RegExp("<[^>]*>", "i");
        }
    }

    parse(rawData: string): FetchedTranscriptSnippet[] {
        const dom = new JSDOM(rawData);
        const doc = dom.window.document;
        const elements = Array.from(doc.getElementsByTagName("text"));

        return elements
            .filter(element => element.textContent !== null)
            .map(element => {
                const text = element.textContent || "";
                const cleanedText = text.replace(this.htmlRegex, "");
                const start = parseFloat(element.getAttribute("start") || "0");
                const duration = parseFloat(element.getAttribute("dur") || "0.0");

                return new FetchedTranscriptSnippet(cleanedText, start, duration);
            });
    }
}

class JsVarParser {
    private varName: string;

    constructor(varName: string) {
        this.varName = varName;
    }

    parse(rawHtml: string, videoId: string): any {
        const splittedHtml = rawHtml.split(`var ${this.varName}`);
        if (splittedHtml.length <= 1) {
            throw new YouTubeDataUnparsable(videoId);
        }

        const jsonStart = splittedHtml[1].indexOf('{');
        if (jsonStart === -1) {
            throw new YouTubeDataUnparsable(videoId);
        }

        // Extract the JSON object
        const jsonStr = splittedHtml[1].substring(jsonStart);
        let openBraces = 1;
        let closeBraces = 0;
        let inQuotes = false;
        let escaped = false;
        let endIndex = 0;

        for (let i = 1; i < jsonStr.length; i++) {
            const char = jsonStr[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === '\\') {
                escaped = true;
                continue;
            }

            if (char === '"') {
                inQuotes = !inQuotes;
                continue;
            }

            if (!inQuotes) {
                if (char === '{') {
                    openBraces++;
                } else if (char === '}') {
                    closeBraces++;
                }
            }

            if (openBraces === closeBraces) {
                endIndex = i + 1;
                break;
            }
        }

        if (endIndex === 0) {
            throw new YouTubeDataUnparsable(videoId);
        }

        const jsonData = jsonStr.substring(0, endIndex);
        try {
            return JSON.parse(jsonData);
        } catch (e) {
            throw new YouTubeDataUnparsable(videoId);
        }
    }
}