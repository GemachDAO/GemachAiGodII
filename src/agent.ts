import { AgentBuilder, ModelProviderName, } from "@iqai/agent";

import { SqliteDatabaseAdapter } from "@elizaos/adapter-sqlite";
import DirectClientInterface from "@elizaos/client-direct";
import Database from "better-sqlite3";
import { TelegramClientInterface } from "@elizaos/client-telegram";
import { TwitterClientInterface } from "@elizaos/client-twitter";
import { ari } from "./characters/ari";
import { googleSearchPlugin } from "./plugins/web-search";
import { createNodePlugin } from "@elizaos/plugin-node";
import { bootstrapPlugin } from "@elizaos/plugin-bootstrap";
import createSequencerPlugin from "@iqai/plugin-sequencer";
import { Character, elizaLogger } from "@elizaos/core";
// import { coingeckoPlugin } from "./plugins/plugin-coingecko/src";
import { tokenTrendingPlugin } from "./plugins/trending-token";
import { createATPPlugin } from "@iqai/plugin-atp";
import path from "path";
import fs from "fs";
import yargs from "yargs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function tryLoadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    return null;
  }
}

const parseArguments = (): {
  character?: string;
  characters?: string;
} => {
  try {
    return yargs(process.argv.slice(2))
      .option("character", {
        type: "string",
        description: "Path to the character JSON file",
      })
      .option("characters", {
        type: "string",
        description: "Comma separated list of paths to character JSON files",
      })
      .parseSync();
  } catch (error) {
    console.error("Error parsing arguments:", error);
    return {};
  }
}

async function loadCharacters(charactersArg: string): Promise<Character[]> {
  let characterPaths = charactersArg
    ?.split(",")
    .map((filePath) => filePath.trim());
  const loadedCharacters: Character[] = [];

  if (characterPaths?.length > 0) {
    for (const characterPath of characterPaths) {
      let content: string | null = null;
      let resolvedPath = "";

      const pathsToTry = [
        characterPath,
        path.resolve(process.cwd(), characterPath),
        path.resolve(process.cwd(), "agent", characterPath),
        path.resolve(__dirname, characterPath),
        path.resolve(__dirname, "characters", path.basename(characterPath)),
        path.resolve(__dirname, "../characters", path.basename(characterPath)),
        path.resolve(__dirname, "../../characters", path.basename(characterPath)),
      ];

      for (const tryPath of pathsToTry) {
        content = tryLoadFile(tryPath);
        if (content !== null) {
          resolvedPath = tryPath;
          break;
        }
      }

      if (content === null) {
        elizaLogger.error(`Error loading character from ${characterPath}: File not found`);
        process.exit(1);
      }

      try {
        const character = JSON.parse(content);
        loadedCharacters.push(character);
        elizaLogger.info(`Successfully loaded character from: ${resolvedPath}`);
      } catch (e) {
        elizaLogger.error(`Error parsing character from ${resolvedPath}: ${e}`);
        process.exit(1);
      }
    }
  }

  return loadedCharacters;
}

async function main() {
  const args = parseArguments();
  let charactersArg = args.characters || args.character;
  let characters = [ari];

  if (charactersArg) {
    characters = await loadCharacters(charactersArg);
  }

  // Setup database
  const databaseAdapter = new SqliteDatabaseAdapter(
    new Database("./data/db.sqlite")
  );

  const sequencerPlugin = await createSequencerPlugin();
  const nodePlugin = createNodePlugin();
  console.log("API key ", process.env.OPENAI_API_KEY)
  // Create agent builder with common configuration
  const builder = new AgentBuilder()
    .withDatabase(databaseAdapter)
    .withClient("direct", DirectClientInterface)
    .withClient("telegram", TelegramClientInterface)
    .withModelProvider(ModelProviderName.OPENAI, process.env.OPENAI_API_KEY)
    .withPlugin(googleSearchPlugin)
    .withPlugin(tokenTrendingPlugin)
    .withPlugin(nodePlugin)
    .withPlugin(bootstrapPlugin)
    .withPlugin(sequencerPlugin);

  // Conditionally add ATP plugin if wallet key exists
  if (process.env.WALLET_PRIVATE_KEY) {
    const atpPlugin = await createATPPlugin({
      walletPrivateKey: process.env.WALLET_PRIVATE_KEY,
    });
    builder.withPlugin(atpPlugin);
  }

  // Create an agent for each character
  for (const character of characters) {
    const agent = builder
      .withCharacter({
        ...character,
        username: character.username || character.name,
      })
      .build();

    await agent.start();
    elizaLogger.info(`Started agent for character: ${character.name}`);
  }
}

main().catch(console.error);