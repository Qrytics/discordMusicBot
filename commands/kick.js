'use strict';

/**
 * commands/kick.js
 *
 * Kicks a mentioned member from the guild.
 * Usage: !kick @user [reason]
 *
 * Requires the bot to have the KICK_MEMBERS permission.
 */

const { PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'kick',
  description: 'Kicks a member from the server.',
  usage: '!kick @user [reason]',

  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   */
  async execute(message, args) {
    // Permission check — caller must have Kick Members.
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.reply('❌ You do not have permission to kick members.');
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply('❌ Please mention a member to kick. Usage: `!kick @user [reason]`');
    }

    if (!target.kickable) {
      return message.reply('❌ I cannot kick that member (they may have a higher role than me).');
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    await target.kick(reason);
    message.channel.send(`✅ **${target.user.tag}** has been kicked. Reason: *${reason}*`);
  },
};
