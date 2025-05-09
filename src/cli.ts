import { Command } from 'commander';

import { GenericProxyConfig, WebshareProxyConfig, ProxyConfig } from './proxies';
import { FormatterLoader } from './formatters';
import { YouTubeTranscriptApi, FetchedTranscript, TranscriptList } from './index';

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
                printSections.push(
                    ...transcripts.map(t => {
                        if (typeof t.toString === 'function') {
                            return t.toString();
                        }
                        return String(t);
                    })
                );
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
        let transcript;

        if (parsedArgs.excludeManuallyCreated === true) {
            transcript = transcriptList.findGeneratedTranscript(parsedArgs.languages);
        } else if (parsedArgs.excludeGenerated === true) {
            transcript = transcriptList.findManuallyCreatedTranscript(parsedArgs.languages);
        } else {
            transcript = transcriptList.findTranscript(parsedArgs.languages);
        }

        if (parsedArgs.translate !== undefined && parsedArgs.translate !== '') {
            transcript = transcript.translate(parsedArgs.translate);
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
                program.videoIds = videoIds;
            });

        program.parse(this.args);

        const options = program.opts();
        const videoIds = this.sanitizeVideoIds(program.videoIds ?? []);

        return {
            ...options,
            videoIds
        } as ParsedArgs;
    }

    private sanitizeVideoIds(videoIds: string[]): string[] {
        return videoIds.map(videoId => videoId.replace(/\\/g, ""));
    }
}