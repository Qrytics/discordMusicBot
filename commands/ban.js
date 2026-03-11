'use strict';

/**
 * commands/ban.js
 *
 * Bans a mentioned member from the guild.
 * Usage: !ban @user [reason]
 *
 * Requires the bot to have the BAN_MEMBERS permission.
 */

const { PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'ban',
  description: 'Bans a member from the server.',
  usage: '!ban @user [reason]',

  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   */
  async execute(message, args) {
    // Permission check — caller must have Ban Members.
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply('❌ You do not have permission to ban members.');
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply('❌ Please mention a member to ban. Usage: `!ban @user [reason]`');
    }

    if (!target.bannable) {
      return message.reply('❌ I cannot ban that member (they may have a higher role than me).');
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    await target.ban({ reason });
    message.channel.send(`✅ **${target.user.tag}** has been banned. Reason: *${reason}*`);
  },
};
