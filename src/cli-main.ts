#!/usr/bin/env node

import { YouTubeTranscriptCli } from './cli';

async function main(): Promise<void> {
    try {
        const cli = new YouTubeTranscriptCli(process.argv);
        const output = await cli.run();
        console.log(output);
    } catch (error: unknown) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}

main().catch((error: unknown) => {
    console.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});