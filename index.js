'use strict';

/**
 * index.js — Discord Music Bot entry point.
 *
 * Moderation commands : !kick, !ban, !mute
 * Music commands      : !play, !skip, !stop, !queue, !leave
 *
 * Copy .env.example to .env and fill in BOT_TOKEN before starting.
 */

require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const { getPlayer } = require('./music/player');

// ---------------------------------------------------------------------------
// Client setup
// ---------------------------------------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

const PREFIX = process.env.PREFIX || '!';

// ---------------------------------------------------------------------------
// Load moderation commands
// ---------------------------------------------------------------------------
const commands = new Map();
for (const name of ['kick', 'ban', 'mute']) {
  const cmd = require(`./commands/${name}`);
  commands.set(cmd.name, cmd);
}

// ---------------------------------------------------------------------------
// Ready event
// ---------------------------------------------------------------------------
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`   Prefix : "${PREFIX}"`);
  console.log('   Commands: kick, ban, mute, play, skip, stop, queue, leave');
});

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();

  // Moderation commands.
  if (commands.has(commandName)) {
    try {
      await commands.get(commandName).execute(message, args);
    } catch (err) {
      console.error(`[command:${commandName}]`, err);
      message.reply(`❌ An error occurred: ${err.message}`).catch(() => {});
    }
    return;
  }

  // Music commands.
  await handleMusicCommand(commandName, args, message);
});

// ---------------------------------------------------------------------------
// Music command handler
// ---------------------------------------------------------------------------
async function handleMusicCommand(commandName, args, message) {
  if (!message.guild) return; // Music only works in guilds.

  const player = getPlayer(message.guild.id);

  switch (commandName) {
    case 'play': {
      if (!args.length) {
        return message.reply('❌ Usage: `!play <YouTube URL or search query>`');
      }

      const voiceChannel = message.member?.voice?.channel;
      if (!voiceChannel) {
        return message.reply('❌ You must be in a voice channel to play music.');
      }

      // Join the voice channel if not already connected.
      if (!player.connection) {
        try {
          await player.join(voiceChannel);
        } catch (err) {
          console.error('[play] Failed to join voice channel:', err);
          return message.reply(`❌ Could not join your voice channel: ${err.message}`);
        }
      }

      const query = args.join(' ');
      try {
        const title = await player.enqueue(query, message.channel);
        // Only send "Added to queue" when there is already something playing.
        if (player.currentSong) {
          message.channel.send(`📋 Added to queue: **${title}**`).catch(() => {});
        }
      } catch (err) {
        console.error('[play] Enqueue error:', err);
        message.reply(`❌ ${err.message}`).catch(() => {});
      }
      break;
    }

    case 'skip': {
      if (!player.connection) {
        return message.reply('❌ I am not playing anything right now.');
      }
      player.skip();
      message.channel.send('⏭️ Skipped!').catch(() => {});
      break;
    }

    case 'stop': {
      if (!player.connection) {
        return message.reply('❌ I am not playing anything right now.');
      }
      player.stop();
      message.channel.send('⏹️ Playback stopped and queue cleared.').catch(() => {});
      break;
    }

    case 'queue': {
      const queue = player.getQueue();
      if (!player.currentSong && !queue.length) {
        return message.reply('📋 The queue is empty.');
      }
      const lines = [];
      if (player.currentSong) {
        lines.push(`**Now playing:** ${player.currentSong.title}`);
      }
      queue.forEach((song, i) => {
        lines.push(`${i + 1}. ${song.title}`);
      });
      message.channel.send(lines.join('\n')).catch(() => {});
      break;
    }

    case 'leave': {
      if (!player.connection) {
        return message.reply('❌ I am not in a voice channel.');
      }
      player.leave();
      message.channel.send('👋 Left the voice channel.').catch(() => {});
      break;
    }

    default:
      // Unknown command — silently ignore.
      break;
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is not set. Copy .env.example to .env and fill in your token.');
  process.exit(1);
}

client.login(process.env.BOT_TOKEN);
