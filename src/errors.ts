import { WATCH_URL } from './settings';
import { ProxyConfig } from './proxies';

// Forward declaration to avoid circular dependency
interface TranscriptList {
    toString(): string;
}

export class YouTubeTranscriptApiException extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'YouTubeTranscriptApiException';
        Object.setPrototypeOf(this, YouTubeTranscriptApiException.prototype);
    }

    // Add a fallback implementation for the _buildErrorMessage method
    protected _buildErrorMessage(): string {
        return this.message;
    }
}

export class CookieError extends YouTubeTranscriptApiException {
    constructor(message: string) {
        super(message);
        this.name = 'CookieError';
        Object.setPrototypeOf(this, CookieError.prototype);
    }
}

export class CookiePathInvalid extends CookieError {
    constructor(cookiePath: string) {
        super(`Can't load the provided cookie file: ${cookiePath}`);
        this.name = 'CookiePathInvalid';
        Object.setPrototypeOf(this, CookiePathInvalid.prototype);
    }
}

export class CookieInvalid extends CookieError {
    constructor(cookiePath: string) {
        super(`The cookies provided are not valid (may have expired): ${cookiePath}`);
        this.name = 'CookieInvalid';
        Object.setPrototypeOf(this, CookieInvalid.prototype);
    }
}

export class CouldNotRetrieveTranscript extends YouTubeTranscriptApiException {
    protected videoId: string;
    protected static ERROR_MESSAGE = "\nCould not retrieve a transcript for the video {video_url}!";
    protected static CAUSE_MESSAGE_INTRO = " This is most likely caused by:\n\n{cause}";
    protected static CAUSE_MESSAGE = "";
    protected static GITHUB_REFERRAL = "\n\nIf you are sure that the described cause is not responsible for this error " +
        "and that a transcript should be retrievable, please create an issue at " +
        "https://github.com/SourceShift/youtube-transcriber/issues. " +
        "Please add which version of youtube_transcript_api you are using " +
        "and provide the information needed to replicate the error. " +
        "Also make sure that there are no open issues which already describe your problem!";

    constructor(videoId: string) {
        super("");
        this.videoId = videoId;
        this.message = this._buildErrorMessage();
        this.name = 'CouldNotRetrieveTranscript';
        Object.setPrototypeOf(this, CouldNotRetrieveTranscript.prototype);
    }

    protected _buildErrorMessage(): string {
        const watchUrl = WATCH_URL.replace("{video_id}", this.videoId);
        let errorMessage = (this.constructor as typeof CouldNotRetrieveTranscript).ERROR_MESSAGE.replace("{video_url}", watchUrl);

        const cause = this.cause;
        if (cause) {
            errorMessage += (this.constructor as typeof CouldNotRetrieveTranscript).CAUSE_MESSAGE_INTRO.replace("{cause}", cause) +
                (this.constructor as typeof CouldNotRetrieveTranscript).GITHUB_REFERRAL;
        }

        return errorMessage;
    }

    get cause(): string {
        return (this.constructor as typeof CouldNotRetrieveTranscript).CAUSE_MESSAGE;
    }
}

export class YouTubeDataUnparsable extends CouldNotRetrieveTranscript {
    static CAUSE_MESSAGE = "The data required to fetch the transcript is not parsable. This should " +
        "not happen, please open an issue (make sure to include the video ID)!";

    constructor(videoId: string) {
        super(videoId);
        this.name = 'YouTubeDataUnparsable';
        Object.setPrototypeOf(this, YouTubeDataUnparsable.prototype);
    }
}

export class YouTubeRequestFailed extends CouldNotRetrieveTranscript {
    static CAUSE_MESSAGE = "Request to YouTube failed: {reason}";
    private reason: string;

    constructor(videoId: string, error: Error) {
        super(videoId);
        this.reason = error.message;
        this.name = 'YouTubeRequestFailed';
        Object.setPrototypeOf(this, YouTubeRequestFailed.prototype);
    }

    get cause(): string {
        return (this.constructor as typeof YouTubeRequestFailed).CAUSE_MESSAGE.replace("{reason}", this.reason);
    }
}

export class VideoUnplayable extends CouldNotRetrieveTranscript {
    static CAUSE_MESSAGE = "The video is unplayable for the following reason: {reason}";
    static SUBREASON_MESSAGE = "\n\nAdditional Details:\n{sub_reasons}";
    private reason: string | null;
    private subReasons: string[];

    constructor(videoId: string, reason: string | null, subReasons: string[]) {
        super(videoId);
        this.reason = reason;
        this.subReasons = subReasons;
        this.name = 'VideoUnplayable';
        Object.setPrototypeOf(this, VideoUnplayable.prototype);
    }

    get cause(): string {
        const reason = this.reason ?? "No reason specified!";
        let result = (this.constructor as typeof VideoUnplayable).CAUSE_MESSAGE.replace("{reason}", reason);

        if (this.subReasons.length > 0) {
            const subReasonsStr = this.subReasons.map(sr => ` - ${sr}`).join("\n");
            result += (this.constructor as typeof VideoUnplayable).SUBREASON_MESSAGE.replace("{sub_reasons}", subReasonsStr);
        }

        return result;
    }
}

export class VideoUnavailable extends CouldNotRetrieveTranscript {
    static CAUSE_MESSAGE = "The video is no longer available";

    constructor(videoId: string) {
        super(videoId);
        this.name = 'VideoUnavailable';
        Object.setPrototypeOf(this, VideoUnavailable.prototype);
    }
}

export class InvalidVideoId extends CouldNotRetrieveTranscript {
    static CAUSE_MESSAGE = "You provided an invalid video id. Make sure you are using the video id and NOT the url!\n\n" +
        'Do NOT run: `YouTubeTranscriptApi.get_transcript("https://www.youtube.com/watch?v=1234")`\n' +
        'Instead run: `YouTubeTranscriptApi.get_transcript("1234")`';

    constructor(videoId: string) {
        super(videoId);
        this.name = 'InvalidVideoId';
        Object.setPrototypeOf(this, InvalidVideoId.prototype);
    }
}

export class RequestBlocked extends CouldNotRetrieveTranscript {
    static BASE_CAUSE_MESSAGE = "YouTube is blocking requests from your IP. This usually is due to one of the " +
        "following reasons:\n" +
        "- You have done too many requests and your IP has been blocked by YouTube\n" +
        "- You are doing requests from an IP belonging to a cloud provider (like AWS, " +
        "Google Cloud Platform, Azure, etc.). Unfortunately, most IPs from cloud " +
        "providers are blocked by YouTube.\n\n";

    static CAUSE_MESSAGE = `${RequestBlocked.BASE_CAUSE_MESSAGE
        }There are two things you can do to work around this:\n` +
        `1. Use proxies to hide your IP address, as explained in the "Working around ` +
        `IP bans" section of the README ` +
        `(https://github.com/SourceShift/youtube-transcriber` +
        `?tab=readme-ov-file` +
        `#working-around-ip-bans-requestblocked-or-ipblocked-exception).\n` +
        `2. (NOT RECOMMENDED) If you authenticate your requests using cookies, you ` +
        `will be able to continue doing requests for a while. However, YouTube will ` +
        `eventually permanently ban the account that you have used to authenticate ` +
        `with! So only do this if you don't mind your account being banned!`;

    static WITH_GENERIC_PROXY_CAUSE_MESSAGE = "YouTube is blocking your requests, despite you using proxies. Keep in mind " +
        "a proxy is just a way to hide your real IP behind the IP of that proxy, but " +
        "there is no guarantee that the IP of that proxy won't be blocked as well.\n\n" +
        "The only truly reliable way to prevent IP blocks is rotating through a large " +
        "pool of residential IPs, by using a provider like Webshare " +
        "(https://www.webshare.io/?referral_code=w0xno53eb50g), which provides you " +
        "with a pool of >30M residential IPs (make sure to purchase " +
        '"Residential" proxies, NOT "Proxy Server" or "Static Residential"!).\n\n' +
        "You will find more information on how to easily integrate Webshare here: " +
        "https://github.com/SourceShift/youtube-transcriber" +
        "?tab=readme-ov-file#using-webshare";

    static WITH_WEBSHARE_PROXY_CAUSE_MESSAGE = "YouTube is blocking your requests, despite you using Webshare proxies. " +
        'Please make sure that you have purchased "Residential" proxies and ' +
        'NOT "Proxy Server" or "Static Residential", as those won\'t work as ' +
        'reliably! The free tier also uses "Proxy Server" and will NOT work!\n\n' +
        'The only reliable option is using "Residential" proxies (not "Static ' +
        'Residential"), as this allows you to rotate through a pool of over 30M IPs, ' +
        "which means you will always find an IP that hasn't been blocked by YouTube " +
        "yet!\n\n" +
        "You can support the development of this open source project by making your " +
        "Webshare purchases through this affiliate link: " +
        "https://www.webshare.io/?referral_code=w0xno53eb50g \n\n" +
        "Thank you for your support! <3";

    private proxyConfig: ProxyConfig | null = null;

    constructor(videoId: string) {
        super(videoId);
        this.name = 'RequestBlocked';
        Object.setPrototypeOf(this, RequestBlocked.prototype);
    }

    withProxyConfig(proxyConfig: ProxyConfig | null): this {
        this.proxyConfig = proxyConfig;
        return this;
    }

    get cause(): string {
        if (this.proxyConfig?.isWebshare === true) {
            return (this.constructor as typeof RequestBlocked).WITH_WEBSHARE_PROXY_CAUSE_MESSAGE;
        } else if (this.proxyConfig?.isGeneric === true) {
            return (this.constructor as typeof RequestBlocked).WITH_GENERIC_PROXY_CAUSE_MESSAGE;
        }
        return super.cause;
    }
}

export class IpBlocked extends RequestBlocked {
    static CAUSE_MESSAGE = `${RequestBlocked.BASE_CAUSE_MESSAGE
        }Ways to work around this are explained in the "Working around IP ` +
        `bans" section of the README (https://github.com/SourceShift/youtube-transcriber` +
        `?tab=readme-ov-file` +
        `#working-around-ip-bans-requestblocked-or-ipblocked-exception).\n`;

    constructor(videoId: string) {
        super(videoId);
        this.name = 'IpBlocked';
        Object.setPrototypeOf(this, IpBlocked.prototype);
    }
}

export class TranscriptsDisabled extends CouldNotRetrieveTranscript {
    static CAUSE_MESSAGE = "Subtitles are disabled for this video";

    constructor(videoId: string) {
        super(videoId);
        this.name = 'TranscriptsDisabled';
        Object.setPrototypeOf(this, TranscriptsDisabled.prototype);
    }
}

export class AgeRestricted extends CouldNotRetrieveTranscript {
    static CAUSE_MESSAGE = "This video is age-restricted. Therefore, you will have to authenticate to be " +
        "able to retrieve transcripts for it. You will have to provide a cookie to " +
        'authenticate yourself, as explained in the "Cookie Authentication" section of ' +
        "the README (https://github.com/SourceShift/youtube-transcriber" +
        "?tab=readme-ov-file#cookie-authentication)";

    constructor(videoId: string) {
        super(videoId);
        this.name = 'AgeRestricted';
        Object.setPrototypeOf(this, AgeRestricted.prototype);
    }
}

export class NotTranslatable extends CouldNotRetrieveTranscript {
    static CAUSE_MESSAGE = "The requested language is not translatable";

    constructor(videoId: string) {
        super(videoId);
        this.name = 'NotTranslatable';
        Object.setPrototypeOf(this, NotTranslatable.prototype);
    }
}

export class TranslationLanguageNotAvailable extends CouldNotRetrieveTranscript {
    static CAUSE_MESSAGE = "The requested translation language is not available";

    constructor(videoId: string) {
        super(videoId);
        this.name = 'TranslationLanguageNotAvailable';
        Object.setPrototypeOf(this, TranslationLanguageNotAvailable.prototype);
    }
}

export class FailedToCreateConsentCookie extends CouldNotRetrieveTranscript {
    static CAUSE_MESSAGE = "Failed to automatically give consent to saving cookies";

    constructor(videoId: string) {
        super(videoId);
        this.name = 'FailedToCreateConsentCookie';
        Object.setPrototypeOf(this, FailedToCreateConsentCookie.prototype);
    }
}

export class NoTranscriptFound extends CouldNotRetrieveTranscript {
    static CAUSE_MESSAGE = "No transcripts were found for any of the requested language codes: {requested_language_codes}\n\n" +
        "{transcript_data}";

    private requestedLanguageCodes: string[];
    private transcriptData: TranscriptList;

    constructor(videoId: string, requestedLanguageCodes: string[], transcriptData: TranscriptList) {
        super(videoId);
        this.requestedLanguageCodes = requestedLanguageCodes;
        this.transcriptData = transcriptData;
        this.name = 'NoTranscriptFound';
        Object.setPrototypeOf(this, NoTranscriptFound.prototype);
    }

    get cause(): string {
        return (this.constructor as typeof NoTranscriptFound).CAUSE_MESSAGE
            .replace("{requested_language_codes}", this.requestedLanguageCodes.toString())
            .replace("{transcript_data}", this.transcriptData.toString());
    }
}