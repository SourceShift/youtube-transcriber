<h1 align="center">
  ✨ YouTube Transcript Downloader ✨
</h1>

<p align="center">
  <a href="https://github.com/SourceShift/youtube-transcriber/actions/workflows/ci.yml">
    <img src="https://github.com/SourceShift/youtube-transcriber/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI Status">
  </a>
  <!--
  <a href="https://coveralls.io/github/SourceShift/youtube-transcriber?branch=main">
    <img src="https://coveralls.io/repos/github/SourceShift/youtube-transcriber/badge.svg?branch=main" alt="Coverage Status">
  </a>
  -->
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT">
  </a>
  <a href="https://www.npmjs.com/package/youtube-transcriber">
    <img src="https://img.shields.io/npm/v/youtube-transcriber.svg" alt="npm version">
  </a>
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/badge/node-%3E%3D16-blue.svg" alt="Node.js versions">
  </a>
  <a href="https://www.npmjs.com/package/youtube-transcriber">
    <img src="https://img.shields.io/npm/dm/youtube-transcriber.svg" alt="npm downloads">
  </a>
</p>

<p align="center">
  <b>This is a TypeScript/Node.js command-line tool and library to download YouTube video transcripts and subtitles. It supports multiple languages, translation, and various output formats without requiring a headless browser.</b>
</p>

<!--
<p align="center">
 Maintenance of this project is made possible by all the <a href="https://github.com/SourceShift/youtube-transcriber/graphs/contributors">contributors</a> and <a href="https://github.com/sponsors/SourceShift">sponsors</a>. If you'd like to sponsor this project and have your avatar or company logo appear below <a href="https://github.com/sponsors/SourceShift">click here</a>. 💖
</p>

<p align="center">
  Sponsor logos here e.g.:
  <a href="https://www.searchapi.io">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://www.searchapi.io/press/v1/svg/searchapi_logo_white_h.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://www.searchapi.io/press/v1/svg/searchapi_logo_black_h.svg">
      <img alt="SearchAPI" src="https://www.searchapi.io/press/v1/svg/searchapi_logo_black_h.svg" height="40px" style="vertical-align: middle;">
    </picture>
  </a>
</p>
-->

## Features

*   Fetches transcripts for any YouTube video.
*   Supports manually created and automatically generated subtitles.
*   Allows translation to any language supported by YouTube.
*   No headless browser required (unlike Selenium-based solutions).
*   Usable as a CLI tool and a Node.js library.
*   Multiple output formats (e.g., plain text, JSON, SRT, VTT - via formatters).
*   Proxy support (Generic HTTP/HTTPS and Webshare).
*   Cookie authentication for age-restricted videos.

## Install

Install globally to use the CLI:
```bash
npm install -g youtube-transcriber
```

Or add to your project as a dependency:
```bash
npm install youtube-transcriber
# or
yarn add youtube-transcriber
```

## CLI Usage

Get transcript for a video (defaults to English):
```bash
youtube-transcriber <video_id>
```

Specify languages (descending priority):
```bash
youtube-transcriber <video_id> --languages es en
```

Translate to a specific language (e.g., German):
```bash
youtube-transcriber <video_id> --languages en --translate de
```

List available transcripts for a video:
```bash
youtube-transcriber <video_id> --list-transcripts
```

Output in JSON format:
```bash
youtube-transcriber <video_id> --format json > transcript.json
```

Exclude auto-generated transcripts:
```bash
youtube-transcriber <video_id> --exclude-generated
```

Exclude manually-created transcripts:
```bash
youtube-transcriber <video_id> --exclude-manually-created
```

Using proxies:
```bash
# Generic HTTP/HTTPS proxy
youtube-transcriber <video_id> --http-proxy http://user:pass@host:port --https-proxy https://user:pass@host:port

# Webshare rotating residential proxies
youtube-transcriber <video_id> --webshare-proxy-username <your_username> --webshare-proxy-password <your_password>
```

Using cookies for authentication (e.g., for age-restricted videos):
```bash
youtube-transcriber <video_id> --cookies /path/to/your/cookies.txt
```

## API Usage

```typescript
import { YouTubeTranscriptApi, GenericProxyConfig, WebshareProxyConfig } from 'youtube-transcriber';

async function getTranscript(videoId: string) {
  try {
    // Simple fetch (defaults to English)
    const transcript = await YouTubeTranscriptApi.fetch(videoId);
    console.log(JSON.stringify(transcript, null, 2));

    // Fetch with specific languages
    const transcriptInSpanish = await YouTubeTranscriptApi.fetch(videoId, { languages: ['es', 'en'] });
    console.log(transcriptInSpanish);

    // List available transcripts
    const api = new YouTubeTranscriptApi(); // Instantiate for list or advanced proxy/cookie use
    const transcriptList = await api.list(videoId);

    // Find a specific transcript from the list and fetch it
    const specificTranscript = transcriptList.findTranscript(['de', 'en']);
    if (specificTranscript) {
      const fetched = await specificTranscript.fetch();
      console.log(fetched);

      // Translate it
      const translated = await specificTranscript.translate('fr').fetch();
      console.log(translated);
    }
  } catch (error) {
    console.error(error);
  }
}

// Example with Webshare proxy
async function getTranscriptWithWebshareProxy(videoId: string) {
  const proxyConfig = new WebshareProxyConfig('YOUR_WEBSHARE_USERNAME', 'YOUR_WEBSHARE_PASSWORD');
  const api = new YouTubeTranscriptApi(undefined, proxyConfig);
  try {
    const transcript = await api.list(videoId).then(list => list.findTranscript(['en'])?.fetch());
    console.log(transcript);
  } catch (error) {
    console.error(error);
  }
}

// getTranscript('dQw4w9WgXcQ');
```

## Formatters

This library supports different output formatters for the transcript data. 
(Details on how to use formatters can be added here once implemented, similar to the Python version).

Available formatters (planned/included):
*   PlainTextFormatter
*   JSONFormatter
*   SRTFormatter
*   WebVTTFormatter

Example (conceptual):
```typescript
// import { YouTubeTranscriptApi, JSONFormatter } from 'youtube-transcriber';

// const transcriptData = await YouTubeTranscriptApi.fetch(videoId);
// const formatter = new JSONFormatter();
// const formattedOutput = formatter.formatTranscript(transcriptData, { indent: 2 });
// console.log(formattedOutput);
```

## Contributing

Contributions are welcome! Please follow these steps:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Ensure tests pass (`npm test`).
5.  Ensure code is formatted and linted (`npm run format` and `npm run lint`).
6.  Commit your changes (`git commit -am 'feat: Add some feature'`).
7.  Push to the branch (`git push origin feature/your-feature-name`).
8.  Open a Pull Request.

To setup the project locally:
```bash
npm install
```

Useful commands:
*   `npm run build`: Compile TypeScript to JavaScript.
*   `npm run lint`: Lint the codebase.
*   `npm run format`: Format the codebase with Prettier.
*   `npm test`: Run tests with Jest.
*   `npm run coverage`: Generate a coverage report.
*   `npm run precommit`: Runs lint, format, test, and build (useful before committing).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.