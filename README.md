# YouTube Transcript API - TypeScript Port

This is a TypeScript port of the [YouTube Transcript API](https://github.com/jdepoix/youtube-transcript-api) originally written in Python. It allows you to get the transcripts/subtitles for a given YouTube video. It also works for automatically generated subtitles and it does not require a headless browser.

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### As a Library

```typescript
import { YouTubeTranscriptApi } from 'youtube-transcriber';

// Simple usage - get a transcript for a single video
async function getTranscript() {
  const api = new YouTubeTranscriptApi();
  
  try {
    // Get transcript in English (default) for a specific video ID
    const transcript = await api.fetch('video_id_here');
    
    // Log each transcript entry
    transcript.snippets.forEach(snippet => {
      console.log(`[${snippet.start}-${snippet.start + snippet.duration}]: ${snippet.text}`);
    });
    
    // Get raw data for export
    const rawData = transcript.toRawData();
    console.log(JSON.stringify(rawData));
  } catch (error) {
    console.error('Error fetching transcript:', error);
  }
}

// Get available transcripts
async function listAvailableTranscripts() {
  const api = new YouTubeTranscriptApi();
  
  try {
    const transcriptList = await api.list('video_id_here');
    
    // Print available languages
    console.log(transcriptList.toString());
    
    // Find transcript in specific languages (in order of preference)
    const transcript = transcriptList.findTranscript(['de', 'en']);
    
    // Or just find manually created ones
    const manualTranscript = transcriptList.findManuallyCreatedTranscript(['en']);
    
    // Or just automatically generated ones
    const generatedTranscript = transcriptList.findGeneratedTranscript(['en']);
    
    // Fetch the transcript data
    const fetchedTranscript = await transcript.fetch();
    
    // If the transcript is translatable, you can translate it
    if (transcript.isTranslatable) {
      const translatedTranscript = transcript.translate('fr');
      const fetchedTranslation = await translatedTranscript.fetch();
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Advanced Usage with Proxies and Cookies

```typescript
import { YouTubeTranscriptApi, GenericProxyConfig, WebshareProxyConfig } from 'youtube-transcriber';

// With proxy configuration
const genericProxy = new GenericProxyConfig('http://your-proxy-url', 'https://your-proxy-url');

// Or with Webshare proxies
const webshareProxy = new WebshareProxyConfig('your-username', 'your-password');

// With cookie authentication for age-restricted videos
const api = new YouTubeTranscriptApi(
  '/path/to/cookies.txt',  // Path to cookie file
  webshareProxy            // Optional proxy configuration
);

// Get transcript
const transcript = await api.fetch('video_id_here', ['en', 'fr']);
```

### Command Line Usage

```bash
# List available languages for a video
npx youtube-transcript --list-transcripts VIDEO_ID

# Get transcript for a video
npx youtube-transcript VIDEO_ID

# Get transcript in specific languages (in order of preference)
npx youtube-transcript VIDEO_ID --languages de en

# Format output as JSON
npx youtube-transcript VIDEO_ID --format json

# Format output as SRT
npx youtube-transcript VIDEO_ID --format srt

# Get transcript for multiple videos
npx youtube-transcript VIDEO_ID1 VIDEO_ID2 VIDEO_ID3

# Translate transcript to French
npx youtube-transcript VIDEO_ID --translate fr

# Using proxies
npx youtube-transcript VIDEO_ID --http-proxy http://your-proxy-url --https-proxy https://your-proxy-url

# Using Webshare proxies
npx youtube-transcript VIDEO_ID --webshare-proxy-username your-username --webshare-proxy-password your-password

# Using cookies for authentication (age-restricted videos)
npx youtube-transcript VIDEO_ID --cookies /path/to/cookies.txt
```

## Using Makefile

The project includes a Makefile for convenient usage:

```bash
# Install dependencies
make install

# Build the project
make build

# Clean build artifacts
make clean

# Run the CLI
make start

# Get transcript for a video
make transcript ARGS="VIDEO_ID --languages en fr"
```

## Credits

This is a TypeScript port of the original [YouTube Transcript API](https://github.com/jdepoix/youtube-transcript-api) by [jdepoix](https://github.com/jdepoix).