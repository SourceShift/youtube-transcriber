import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

import { ProxyConfig } from './proxies';
import { TranscriptListFetcher, FetchedTranscript, TranscriptList } from './transcripts';
import { CookiePathInvalid, CookieInvalid } from './errors';

function loadCookieJar(cookiePath: string): CookieJar {
    try {
        const cookieStr = fs.readFileSync(cookiePath, 'utf-8');

        // Parse Netscape/Mozilla cookie file
        const cookieJar = new CookieJar();
        const lines = cookieStr.split('\n').filter(line =>
            line.trim() !== '' && !line.startsWith('#') && !line.startsWith('//'));

        for (const line of lines) {
            const parts = line.trim().split('\t');
            if (parts.length >= 7) {
                const [domain, path, secure, expiration, name, value] = parts;
                cookieJar.setCookieSync(
                    `${name}=${value}; Domain=${domain}; Path=${path}; ${secure === 'TRUE' ? 'Secure' : ''}; Expires=${new Date(parseInt(expiration) * 1000).toUTCString()}`,
                    `http${secure === 'TRUE' ? 's' : ''}://${domain}`
                );
            }
        }

        if (cookieJar.getSetCookieStringsSync('https://www.youtube.com').length === 0) {
            throw new CookieInvalid(cookiePath);
        }

        return cookieJar;
    } catch (error) {
        if (error instanceof CookieInvalid) {
            throw error;
        }
        throw new CookiePathInvalid(cookiePath);
    }
}

/**
 * Main class for interacting with the YouTube Transcript API
 */
export class YouTubeTranscriptApi {
    private fetcher: TranscriptListFetcher;

    /**
     * Creates a new instance of the YouTube Transcript API.
     * 
     * Note on thread-safety: As this class will initialize an axios instance,
     * you should create separate instances for separate threads.
     * 
     * @param cookiePath Path to a text file containing YouTube authorization cookies
     * @param proxyConfig Optional proxy configuration
     * @param httpClient Optional custom HTTP client
     */
    constructor(
        cookiePath?: string,
        proxyConfig?: ProxyConfig,
        httpClient?: AxiosInstance
    ) {
        // Initialize HTTP client
        let axiosClient: AxiosInstance;
        if (httpClient) {
            axiosClient = httpClient;
        } else {
            axiosClient = axios.create({
                headers: {
                    'Accept-Language': 'en-US'
                }
            });
        }

        // Set up cookies if provided
        if (cookiePath !== undefined && cookiePath.trim() !== '') {
            const cookieJar = loadCookieJar(cookiePath);
            // Use the wrapper function correctly
            axiosClient = wrapper(axiosClient);
            // Add the jar property to defaults with proper typing
            (axiosClient.defaults as { jar?: CookieJar }).jar = cookieJar;
        }

        // Set up proxies if provided
        if (proxyConfig) {
            const proxyDict = proxyConfig.toRequestsDict();
            // Axios expects proxy config as { protocol, host, port, auth }
            // We'll only set proxy if http or https is provided
            const httpProxy = proxyDict.http;
            const httpsProxy = proxyDict.https;

            if ((httpProxy && httpProxy !== '') || (httpsProxy && httpsProxy !== '')) {
                // Parse the proxy URL to extract host, port, and auth
                const proxyUrl = httpsProxy ? httpsProxy : httpProxy;
                try {
                    const url = new URL(proxyUrl);
                    axiosClient.defaults.proxy = {
                        protocol: url.protocol.replace(':', ''),
                        host: url.hostname,
                        port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
                        auth: url.username ? { username: url.username, password: url.password } : undefined
                    };
                } catch {
                    axiosClient.defaults.proxy = false;
                }
            } else {
                axiosClient.defaults.proxy = false;
            }

            if (proxyConfig.preventKeepingConnectionsAlive) {
                axiosClient.defaults.headers.Connection = 'close';
            }
        }

        this.fetcher = new TranscriptListFetcher(axiosClient, proxyConfig);
    }

    /**
     * Retrieves the transcript for a single video. This is a shortcut for:
     * `YouTubeTranscriptApi().list(videoId).findTranscript(languages).fetch()`
     * 
     * @param videoId The ID of the video to retrieve the transcript for
     * @param languages List of language codes in descending priority
     * @param preserveFormatting Whether to keep select HTML text formatting
     * @returns Promise resolving to the fetched transcript
     */
    async fetch(
        videoId: string,
        languages: string[] = ['en'],
        preserveFormatting = false
    ): Promise<FetchedTranscript> {
        const transcriptList = await this.list(videoId);
        const transcript = transcriptList.findTranscript(languages);
        return transcript.fetch(preserveFormatting);
    }

    /**
     * Retrieves the list of transcripts available for a given video
     * 
     * @param videoId The ID of the video to retrieve transcripts for
     * @returns Promise resolving to a TranscriptList
     */
    async list(videoId: string): Promise<TranscriptList> {
        return this.fetcher.fetch(videoId);
    }

    /**
     * DEPRECATED: Use fetch() method instead.
     * Retrieves the transcript for a single video.
     */
    static async getTranscript(
        videoId: string,
        languages: string[] = ['en'],
        proxies?: Record<string, string>,
        cookies?: string,
        preserveFormatting = false
    ): Promise<unknown[]> {
        console.warn(
            "`getTranscript` is deprecated and will be removed in a future version. " +
            "Use the `fetch` method instead!"
        );

        const api = new YouTubeTranscriptApi(
            cookies,
            proxies ? {
                toRequestsDict: () => ({
                    http: proxies.http || '',
                    https: proxies.https || ''
                }),
                preventKeepingConnectionsAlive: false,
                retriesWhenBlocked: 0,
                isGeneric: true,
                isWebshare: false
            } : undefined
        );

        const transcript = await api.fetch(videoId, languages, preserveFormatting);
        return transcript.toRawData();
    }

    /**
     * DEPRECATED: Use list() method instead.
     * Retrieves the list of transcripts which are available for a given video.
     */
    static async listTranscripts(
        videoId: string,
        proxies?: Record<string, string> | ProxyConfig,
        cookies?: string
    ): Promise<TranscriptList> {
        console.warn(
            "`listTranscripts` is deprecated and will be removed in a future version. " +
            "Use the `list` method instead!"
        );

        let proxyConfig: ProxyConfig | undefined = undefined;

        if (proxies) {
            if ('toRequestsDict' in proxies) {
                proxyConfig = proxies as ProxyConfig;
            } else {
                proxyConfig = {
                    toRequestsDict: () => ({
                        http: proxies.http || '',
                        https: proxies.https || ''
                    }),
                    preventKeepingConnectionsAlive: false,
                    retriesWhenBlocked: 0,
                    isGeneric: true,
                    isWebshare: false
                } as ProxyConfig;
            }
        }

        const api = new YouTubeTranscriptApi(
            cookies,
            proxyConfig
        );

        return api.list(videoId);
    }

    /**
     * DEPRECATED: Use fetch() method instead.
     * Retrieves the transcripts for a list of videos.
     */
    static async getTranscripts(
        videoIds: string[],
        languages: string[] = ['en'],
        continueAfterError = false,
        proxies?: Record<string, string>,
        cookies?: string,
        preserveFormatting = false
    ): Promise<[Record<string, unknown[]>, string[]]> {
        console.warn(
            "`getTranscripts` is deprecated and will be removed in a future version. " +
            "Use the `fetch` method instead!"
        );

        if (!Array.isArray(videoIds)) {
            throw new Error('`videoIds` must be an array of strings');
        }

        const data: Record<string, unknown[]> = {};
        const unretrievableVideos: string[] = [];

        const api = new YouTubeTranscriptApi(
            cookies,
            proxies ? {
                toRequestsDict: () => ({
                    http: proxies.http || '',
                    https: proxies.https || ''
                }),
                preventKeepingConnectionsAlive: false,
                retriesWhenBlocked: 0,
                isGeneric: true,
                isWebshare: false
            } : undefined
        );

        for (const videoId of videoIds) {
            try {
                const transcript = await api.fetch(videoId, languages, preserveFormatting);
                data[videoId] = transcript.toRawData();
            } catch (error) {
                if (!continueAfterError) {
                    throw error;
                }
                unretrievableVideos.push(videoId);
            }
        }

        return [data, unretrievableVideos];
    }
}