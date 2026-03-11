'use strict';

/**
 * commands/mute.js
 *
 * Times-out (server mutes) a mentioned member using Discord's built-in
 * timeout feature.  The member cannot send messages or join voice channels
 * for the specified duration.
 *
 * Usage: !mute @user [minutes] [reason]
 *   Default duration: 10 minutes.
 *   Maximum duration: 40320 minutes (28 days — Discord API limit).
 *
 * Requires the bot to have the MODERATE_MEMBERS permission.
 */

const { PermissionsBitField } = require('discord.js');

const DEFAULT_DURATION_MINUTES = 10;
const MAX_DURATION_MINUTES = 40320; // 28 days

module.exports = {
  name: 'mute',
  description: 'Times out a member for a specified number of minutes.',
  usage: '!mute @user [minutes] [reason]',

  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   */
  async execute(message, args) {
    // Permission check — caller must have Moderate Members.
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)
    ) {
      return message.reply('❌ You do not have permission to mute members.');
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply(
        '❌ Please mention a member to mute. Usage: `!mute @user [minutes] [reason]`'
      );
    }

    if (!target.moderatable) {
      return message.reply(
        '❌ I cannot mute that member (they may have a higher role than me).'
      );
    }

    // Parse optional duration argument (second arg, after the mention).
    const durationArg = args[1];
    let durationMinutes = DEFAULT_DURATION_MINUTES;
    let reasonStartIndex = 1;

    if (durationArg !== undefined) {
      const parsed = parseInt(durationArg, 10);
      if (isNaN(parsed) || parsed <= 0) {
        return message.reply('❌ Duration must be a positive number of minutes.');
      }
      durationMinutes = Math.min(parsed, MAX_DURATION_MINUTES);
      reasonStartIndex = 2;
    }

    const reason = args.slice(reasonStartIndex).join(' ') || 'No reason provided';
    const durationMs = durationMinutes * 60 * 1000;

    await target.timeout(durationMs, reason);
    message.channel.send(
      `✅ **${target.user.tag}** has been muted for **${durationMinutes} minute(s)**. Reason: *${reason}*`
    );
  },
};
