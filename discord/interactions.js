/**
 * discord/interactions.js
 *
 * The actual HTTP endpoint Discord calls for every slash command and button
 * click - this is the "webhook" side of our HTTP Interactions setup (see
 * discord/commands.js for the architectural reasoning). verifyKeyMiddleware
 * handles Ed25519 signature verification AND automatically answers
 * Discord's PING health-check with PONG - we only need to handle the two
 * interaction types that represent actual user actions.
 */
import { verifyKeyMiddleware, InteractionType } from 'discord-interactions';
import { handleCommand, handleComponent } from './commands.js';
import { logger } from '../utils/logger.js';

/** Returns the verification middleware, to be mounted BEFORE express.json() - same raw-body constraint as the Telegram webhook. */
export function discordSignatureMiddleware() {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    logger.warn('DISCORD_PUBLIC_KEY is not set - Discord interactions will fail signature verification');
  }
  return verifyKeyMiddleware(publicKey || 'unset-discord-public-key');
}

/** The actual interaction handler, mounted after the signature middleware above. */
export async function handleDiscordInteraction(req, res) {
  const interaction = req.body;

  try {
    let response;
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      response = await handleCommand(interaction);
    } else if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
      response = await handleComponent(interaction);
    } else {
      response = { type: 4, data: { content: "Sorry, I don't understand that." } };
    }
    res.json(response);
  } catch (err) {
    logger.error('Unhandled error in Discord interaction', { error: err.message });
    res.json({ type: 4, data: { content: 'Something went wrong on my end - please try again.' } });
  }
}
