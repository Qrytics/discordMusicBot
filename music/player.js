'use strict';

/**
 * player.js
 *
 * Per-guild music player.  Each guild gets its own MusicPlayer instance
 * that manages the voice connection, audio player, and song queue.
 *
 * Usage:
 *   const { getPlayer } = require('./player');
 *   const player = getPlayer(guildId);
 *   await player.join(voiceChannel);
 *   await player.enqueue('https://www.youtube.com/watch?v=...', textChannel);
 */

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const ytsr = require('@distube/ytsr');
const ytdl = require('@distube/ytdl-core');
const { convertToMp3 } = require('./convertToMp3');

class MusicPlayer {
  constructor() {
    /** @type {Array<{url: string, title: string, channel: import('discord.js').TextBasedChannel}>} */
    this.queue = [];
    /** @type {import('@discordjs/voice').VoiceConnection | null} */
    this.connection = null;
    /** @type {import('@discordjs/voice').AudioPlayer | null} */
    this.audioPlayer = null;
    this.currentSong = null;
  }

  /**
   * Joins a voice channel and sets up the audio player.
   * @param {import('discord.js').VoiceChannel} voiceChannel
   */
  async join(voiceChannel) {
    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    this.audioPlayer = createAudioPlayer();
    this.connection.subscribe(this.audioPlayer);

    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this._playNext();
    });

    this.audioPlayer.on('error', (err) => {
      console.error('[MusicPlayer] Audio player error:', err.message);
      this._playNext();
    });

    await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
  }

  /**
   * Resolves a YouTube URL or plain-text search query to a URL, then adds
   * it to the queue.  Starts playback immediately if the player is idle.
   *
   * @param {string} urlOrQuery - YouTube URL or search terms.
   * @param {import('discord.js').TextBasedChannel} textChannel - Channel for status messages.
   * @returns {Promise<string>} The resolved song title or URL.
   */
  async enqueue(urlOrQuery, textChannel) {
    let url = urlOrQuery;
    let title = urlOrQuery;

    if (!urlOrQuery.startsWith('http')) {
      const results = await ytsr(urlOrQuery, { limit: 1 });
      if (!results || !results.items.length) {
        throw new Error(`No YouTube results found for: "${urlOrQuery}"`);
      }
      const top = results.items[0];
      url = top.url;
      title = top.name;
    } else {
      // Fetch video metadata from the URL for a nicer display title.
      try {
        const info = await ytdl.getBasicInfo(url);
        title = info.videoDetails.title;
      } catch {
        // Ignore — title will fall back to the URL string.
      }
    }

    this.queue.push({ url, title, channel: textChannel });

    if (
      !this.audioPlayer ||
      this.audioPlayer.state.status === AudioPlayerStatus.Idle
    ) {
      await this._playNext();
    }

    return title;
  }

  /** Plays the next song in the queue. */
  async _playNext() {
    if (!this.queue.length) {
      this.currentSong = null;
      return;
    }

    const song = this.queue.shift();
    this.currentSong = song;

    try {
      const mp3Path = await convertToMp3(song.url);
      const resource = createAudioResource(mp3Path);
      this.audioPlayer.play(resource);
      song.channel.send(`🎵 Now playing: **${song.title}**`).catch(() => {});
    } catch (err) {
      console.error('[MusicPlayer] Playback error:', err.message);
      song.channel
        .send(`❌ Could not play **${song.title}**: ${err.message}`)
        .catch(() => {});
      await this._playNext();
    }
  }

  /** Skips the current song. */
  skip() {
    this.audioPlayer?.stop();
  }

  /** Stops playback and clears the queue. */
  stop() {
    this.queue = [];
    this.audioPlayer?.stop(true);
    this.currentSong = null;
  }

  /** Leaves the voice channel and cleans up. */
  leave() {
    this.stop();
    this.connection?.destroy();
    this.connection = null;
    this.audioPlayer = null;
  }

  /** Returns a copy of the current queue. */
  getQueue() {
    return [...this.queue];
  }
}

// ---------------------------------------------------------------------------
// Guild-level player registry.
// ---------------------------------------------------------------------------
/** @type {Map<string, MusicPlayer>} */
const players = new Map();

/**
 * Returns (or lazily creates) the MusicPlayer for a given guild.
 * @param {string} guildId
 * @returns {MusicPlayer}
 */
function getPlayer(guildId) {
  if (!players.has(guildId)) {
    players.set(guildId, new MusicPlayer());
  }
  return players.get(guildId);
}

module.exports = { MusicPlayer, getPlayer };
