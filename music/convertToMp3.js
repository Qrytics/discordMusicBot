'use strict';

/**
 * convertToMp3.js
 *
 * Local utility that accepts a YouTube URL, downloads the audio stream,
 * converts it to MP3 via fluent-ffmpeg, and saves the result to the
 * local `cache/` directory.  Subsequent requests for the same video ID
 * are served straight from the cache without re-downloading.
 */

const path = require('path');
const fs = require('fs');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

const CACHE_DIR = path.join(__dirname, '..', 'cache');

// Ensure the cache directory exists at module load time.
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// In-memory cache: videoId → absolute MP3 file path.
const memoryCache = new Map();

/**
 * Extracts the 11-character YouTube video ID from a URL.
 * @param {string} url
 * @returns {string}
 */
function extractVideoId(url) {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];
  // Fall back to a safe base64 slug derived from the URL itself.
  return Buffer.from(url).toString('base64url').substring(0, 16);
}

/**
 * Downloads the audio track of a YouTube video and converts it to MP3.
 * Results are cached on disk (and in memory) so identical requests are
 * served instantly without re-downloading.
 *
 * @param {string} url - A valid YouTube video URL.
 * @returns {Promise<string>} Resolves with the absolute path to the MP3 file.
 */
async function convertToMp3(url) {
  const videoId = extractVideoId(url);
  const outputPath = path.join(CACHE_DIR, `${videoId}.mp3`);

  // 1. In-memory cache hit.
  if (memoryCache.has(videoId)) {
    return memoryCache.get(videoId);
  }

  // 2. On-disk cache hit (e.g. after a restart).
  if (fs.existsSync(outputPath)) {
    memoryCache.set(videoId, outputPath);
    return outputPath;
  }

  // 3. Download + convert.
  let audioStream;
  try {
    audioStream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' });
  } catch (err) {
    throw new Error(`Failed to start download for "${url}": ${err.message}`);
  }

  await new Promise((resolve, reject) => {
    ffmpeg(audioStream)
      .audioCodec('libmp3lame')
      .audioBitrate(192)
      .format('mp3')
      .on('end', resolve)
      .on('error', (err) => {
        // Clean up a partial file if conversion failed.
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        reject(err);
      })
      .save(outputPath);
  });

  memoryCache.set(videoId, outputPath);
  return outputPath;
}

module.exports = { convertToMp3, extractVideoId };
