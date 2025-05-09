import { Command } from 'commander';

import { GenericProxyConfig, WebshareProxyConfig, ProxyConfig } from './proxies';
import { FormatterLoader } from './formatters';
import { YouTubeTranscriptApi, FetchedTranscript, TranscriptList, Transcript } from './index';

// Extended Command interface to include videoIds property
interface ExtendedCommand extends Command {
    videoIds?: string[];
}

// Interface for parsed command line arguments
interface ParsedArgs {
    videoIds: string[];
    listTranscripts?: boolean;
    excludeManuallyCreated?: boolean;
    excludeGenerated?: boolean;
    httpProxy?: string;
    httpsProxy?: string;
    webshareProxyUsername?: string;
    webshareProxyPassword?: string;
    cookies?: string;
    languages: string[];
    format: string;
    translate?: string;
}

// Type guard for program.videoIds
function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
}

export class YouTubeTranscriptCli {
    private args: string[];

    constructor(args: string[]) {
        this.args = args;
    }

    async run(): Promise<string> {
        const parsedArgs = this.parseArgs();

        if (parsedArgs.excludeManuallyCreated === true && parsedArgs.excludeGenerated === true) {
            return "";
        }

        let proxyConfig: ProxyConfig | undefined = undefined;
        if (parsedArgs.httpProxy !== undefined || parsedArgs.httpsProxy !== undefined) {
            proxyConfig = new GenericProxyConfig(
                parsedArgs.httpProxy ?? null,
                parsedArgs.httpsProxy ?? null
            );
        }

        if (parsedArgs.webshareProxyUsername !== undefined || parsedArgs.webshareProxyPassword !== undefined) {
            proxyConfig = new WebshareProxyConfig(
                parsedArgs.webshareProxyUsername ?? '',
                parsedArgs.webshareProxyPassword ?? ''
            );
        }

        const cookiePath = parsedArgs.cookies;

        // Explicitly declare with only the types that have toString() implementations
        const transcripts: (FetchedTranscript | TranscriptList)[] = [];
        const exceptions: Error[] = [];

        const api = new YouTubeTranscriptApi(
            cookiePath,
            proxyConfig
        );

        for (const videoId of parsedArgs.videoIds) {
            try {
                const transcriptList = await api.list(videoId);
                if (parsedArgs.listTranscripts === true) {
                    transcripts.push(transcriptList);
                } else {
                    transcripts.push(
                        await this.fetchTranscript(
                            parsedArgs,
                            transcriptList
                        )
                    );
                }
            } catch (error) {
                exceptions.push(error as Error);
            }
        }

        const printSections: string[] = exceptions.map(exception => exception.toString());

        if (transcripts.length > 0) {
            if (parsedArgs.listTranscripts === true) {
                // Use explicit for loop to handle typed objects
                for (const transcript of transcripts) {
                    // Each element in the array is guaranteed to be either TranscriptList or FetchedTranscript
                    // Use explicit type assertion to resolve the eslint error
                    printSections.push((transcript as { toString(): string }).toString());
                }
            } else {
                const transcriptsAsTextArray = transcripts.map(t => {
                    if (t instanceof FetchedTranscript) {
                        return t;
                    }
                    return null;
                }).filter((t): t is FetchedTranscript => t !== null);

                printSections.push(
                    new FormatterLoader()
                        .load(parsedArgs.format)
                        .formatTranscripts(transcriptsAsTextArray)
                );
            }
        }

        return printSections.join("\n\n");
    }

    private async fetchTranscript(
        parsedArgs: ParsedArgs,
        transcriptList: TranscriptList
    ): Promise<FetchedTranscript> {
        let transcript: Transcript;

        if (parsedArgs.excludeManuallyCreated === true) {
            transcript = transcriptList.findGeneratedTranscript(parsedArgs.languages);
        } else if (parsedArgs.excludeGenerated === true) {
            transcript = transcriptList.findManuallyCreatedTranscript(parsedArgs.languages);
        } else {
            transcript = transcriptList.findTranscript(parsedArgs.languages);
        }

        if (parsedArgs.translate !== undefined && parsedArgs.translate !== '') {
            // Explicit assignment to ensure proper typing
            const translatedTranscript = transcript.translate(parsedArgs.translate);
            transcript = translatedTranscript;
        }

        return transcript.fetch();
    }

    private parseArgs(): ParsedArgs {
        const program = new Command() as ExtendedCommand;

        program
            .description(
                "This is a TypeScript API which allows you to get the transcripts/subtitles for a given YouTube video. " +
                "It also works for automatically generated subtitles and it does not require a headless browser."
            )
            .option(
                "--list-transcripts",
                "This will list the languages in which the given videos are available in."
            )
            .option(
                "--languages <languages...>",
                "A list of language codes in a descending priority.",
                ["en"]
            )
            .option(
                "--exclude-generated",
                "If this flag is set transcripts which have been generated by YouTube will not be retrieved."
            )
            .option(
                "--exclude-manually-created",
                "If this flag is set transcripts which have been manually created will not be retrieved."
            )
            .option(
                "--format <format>",
                "Output format",
                "pretty"
            )
            .option(
                "--translate <language>",
                "The language code for the language you want this transcript to be translated to.",
                ""
            )
            .option(
                "--webshare-proxy-username <username>",
                "Specify your Webshare Proxy Username found at https://dashboard.webshare.io/proxy/settings"
            )
            .option(
                "--webshare-proxy-password <password>",
                "Specify your Webshare Proxy Password found at https://dashboard.webshare.io/proxy/settings"
            )
            .option(
                "--http-proxy <url>",
                "Use the specified HTTP proxy.",
                ""
            )
            .option(
                "--https-proxy <url>",
                "Use the specified HTTPS proxy.",
                ""
            )
            .option(
                "--cookies <path>",
                "The cookie file that will be used for authorization with youtube."
            )
            .arguments("<video_ids...>")
            .action((videoIds) => {
                program.videoIds = videoIds as string[];
            });

        program.parse(this.args);

        // Safely handle potentially unknown options data
        const safeVideoIds = isStringArray(program.videoIds) ? program.videoIds : [];
        const videoIds = this.sanitizeVideoIds(safeVideoIds);

        // Use eslint disable for this block since we're extracting potentially unsafe data
        // But we validate each property before using it


        const cmdOptions = program.opts();



        // Extract and validate each option with explicit type checking
        let languages: string[] = ['en'];
        if (Array.isArray(cmdOptions.languages)) {
            languages = cmdOptions.languages.filter((l): l is string => typeof l === 'string');
            if (languages.length === 0) {
                languages = ['en'];
            }
        }

        // Rest of the options - explicit type checking ensures type safety
        const format = typeof cmdOptions.format === 'string' ? cmdOptions.format : 'pretty';
        const listTranscripts = cmdOptions.listTranscripts === true;
        const excludeManuallyCreated = cmdOptions.excludeManuallyCreated === true;
        const excludeGenerated = cmdOptions.excludeGenerated === true;
        const httpProxy = typeof cmdOptions.httpProxy === 'string' && cmdOptions.httpProxy !== '' ? cmdOptions.httpProxy : undefined;
        const httpsProxy = typeof cmdOptions.httpsProxy === 'string' && cmdOptions.httpsProxy !== '' ? cmdOptions.httpsProxy : undefined;
        const webshareProxyUsername = typeof cmdOptions.webshareProxyUsername === 'string' && cmdOptions.webshareProxyUsername !== '' ? cmdOptions.webshareProxyUsername : undefined;
        const webshareProxyPassword = typeof cmdOptions.webshareProxyPassword === 'string' && cmdOptions.webshareProxyPassword !== '' ? cmdOptions.webshareProxyPassword : undefined;
        const cookies = typeof cmdOptions.cookies === 'string' ? cmdOptions.cookies : undefined;
        const translate = typeof cmdOptions.translate === 'string' && cmdOptions.translate !== '' ? cmdOptions.translate : undefined;

        // Create parsedArgs with validated values
        const parsedArgs: ParsedArgs = {
            videoIds,
            languages,
            format,
            listTranscripts,
            excludeManuallyCreated,
            excludeGenerated,
            httpProxy,
            httpsProxy,
            webshareProxyUsername,
            webshareProxyPassword,
            cookies,
            translate
        };

        return parsedArgs;
    }

    private sanitizeVideoIds(videoIds: string[]): string[] {
        return videoIds.map(videoId => videoId.replace(/\\/g, ""));
    }
}