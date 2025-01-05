import { SqliteDatabaseAdapter } from "@elizaos/adapter-sqlite";
import {
  CacheStore,
  Client,
  parseBooleanFromText,
  defaultCharacter,
  AgentRuntime,
  CacheManager,
  Character,
  Clients,
  DbCacheAdapter,
  elizaLogger,
  FsCacheAdapter,
  IAgentRuntime,
  ICacheManager,
  IDatabaseAdapter,
  IDatabaseCacheAdapter,
  ModelProviderName,
  settings,
  stringToUuid,
  validateCharacterConfig, UUID
} from "@elizaos/core";
import { DirectClientInterface, DirectClient } from "@elizaos/client-direct";
import { DiscordClientInterface } from "@elizaos/client-discord";
import { AutoClientInterface } from "@elizaos/client-auto";
import { TelegramClientInterface } from "@elizaos/client-telegram";
import { TwitterClientInterface } from "@elizaos/client-twitter";
import { ari } from "./characters/ari";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import yargs from "yargs";
import net from "net";
import { fileURLToPath } from "url";
import { bootstrapPlugin } from "@elizaos/plugin-bootstrap";
import { tokenTrendingPlugin } from "./plugins/trending-token";
import { googleSearchPlugin } from "./plugins/web-search";
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory
import { createNodePlugin } from "@elizaos/plugin-node";
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

function isAllStrings(arr: unknown[]): boolean {
  return Array.isArray(arr) && arr.every((item) => typeof item === "string");
}

async function loadCharacters(charactersArg: string) {

  let characterPaths = charactersArg
    ?.split(",")
    .map((filePath) => filePath.trim());
  const loadedCharacters: Character[] = [];

  if (characterPaths?.length > 0) {
    for (const characterPath of characterPaths) {
      let content: string | null = null;
      let resolvedPath = "";

      // Try different path resolutions in order
      const pathsToTry = [
        characterPath, // exact path as specified
        path.resolve(process.cwd(), characterPath), // relative to cwd
        path.resolve(process.cwd(), "agent", characterPath), // Add this
        path.resolve(__dirname, characterPath), // relative to current script
        path.resolve(
          __dirname,
          "characters",
          path.basename(characterPath)
        ), // relative to agent/characters
        path.resolve(
          __dirname,
          "../characters",
          path.basename(characterPath)
        ), // relative to characters dir from agent
        path.resolve(
          __dirname,
          "../../characters",
          path.basename(characterPath)
        ), // relative to project root characters dir
      ];

      elizaLogger.info(
        "Trying paths:",
        pathsToTry.map((p) => ({
          path: p,
          exists: fs.existsSync(p),
        }))
      );

      for (const tryPath of pathsToTry) {
        content = tryLoadFile(tryPath);
        if (content !== null) {
          resolvedPath = tryPath;
          break;
        }
      }

      if (content === null) {
        elizaLogger.error(
          `Error loading character from ${characterPath}: File not found in any of the expected locations`
        );
        elizaLogger.error("Tried the following paths:");
        pathsToTry.forEach((p) => elizaLogger.error(` - ${p}`));
        process.exit(1);
      }

      try {
        const character = JSON.parse(content);
        validateCharacterConfig(character);

        // .id isn't really valid
        const characterId = character.id || character.name;
        const characterPrefix = `CHARACTER.${characterId.toUpperCase().replace(/ /g, "_")}.`;

        const characterSettings = Object.entries(process.env)
          .filter(([key]) => key.startsWith(characterPrefix))
          .reduce((settings, [key, value]) => {
            const settingKey = key.slice(characterPrefix.length);
            return { ...settings, [settingKey]: value };
          }, {});

        if (Object.keys(characterSettings).length > 0) {
          character.settings = character.settings || {};
          character.settings.secrets = {
            ...characterSettings,
            ...character.settings.secrets,
          };
        }

        // Handle plugins
        if (isAllStrings(character.plugins)) {
          elizaLogger.info("Plugins are: ", character.plugins);
          const importedPlugins = await Promise.all(
            character.plugins.map(async (plugin) => {
              const importedPlugin = await import(plugin);
              return importedPlugin.default;
            })
          );
          character.plugins = importedPlugins;
        }

        loadedCharacters.push(character);
        elizaLogger.info(
          `Successfully loaded character from: ${resolvedPath}`
        );
      } catch (e) {
        elizaLogger.error(
          `Error parsing character from ${resolvedPath}: ${e}`
        );
        process.exit(1);
      }
    }
  }

  return loadedCharacters;
}

export function getTokenForProvider(
  provider: ModelProviderName,
  character: Character
) {
  switch (provider) {
    case ModelProviderName.OPENAI:
      return (
        character.settings?.secrets?.OPENAI_API_KEY || settings.OPENAI_API_KEY
      );
    case ModelProviderName.LLAMACLOUD:
      return (
        character.settings?.secrets?.LLAMACLOUD_API_KEY ||
        settings.LLAMACLOUD_API_KEY ||
        character.settings?.secrets?.TOGETHER_API_KEY ||
        settings.TOGETHER_API_KEY ||
        character.settings?.secrets?.XAI_API_KEY ||
        settings.XAI_API_KEY ||
        character.settings?.secrets?.OPENAI_API_KEY ||
        settings.OPENAI_API_KEY
      );
    case ModelProviderName.ANTHROPIC:
      return (
        character.settings?.secrets?.ANTHROPIC_API_KEY ||
        character.settings?.secrets?.CLAUDE_API_KEY ||
        settings.ANTHROPIC_API_KEY ||
        settings.CLAUDE_API_KEY
      );
    case ModelProviderName.REDPILL:
      return (
        character.settings?.secrets?.REDPILL_API_KEY || settings.REDPILL_API_KEY
      );
    case ModelProviderName.OPENROUTER:
      return (
        character.settings?.secrets?.OPENROUTER || settings.OPENROUTER_API_KEY
      );
    case ModelProviderName.GROK:
      return character.settings?.secrets?.GROK_API_KEY || settings.GROK_API_KEY;
    case ModelProviderName.HEURIST:
      return (
        character.settings?.secrets?.HEURIST_API_KEY || settings.HEURIST_API_KEY
      );
    case ModelProviderName.GROQ:
      return character.settings?.secrets?.GROQ_API_KEY || settings.GROQ_API_KEY;

  }
}

function initializeDatabase(dataDir: string) {
  const filePath =
    process.env.SQLITE_FILE ?? path.resolve(dataDir, "db.sqlite");
  // ":memory:";
  const db = new SqliteDatabaseAdapter(new Database(filePath));
  return db;
}

function intializeDbCache(character: Character, db: IDatabaseCacheAdapter) {
  const cache = new CacheManager(new DbCacheAdapter(db, character.id as UUID));
  return cache;
}


export async function initializeClients(
  character: Character,
  runtime: IAgentRuntime
) {
  // each client can only register once
  // and if we want two we can explicitly support it
  const clients: Record<string, any> = {};
  const clientTypes: string[] =
    character.clients?.map((str) => str.toLowerCase()) || [];
  elizaLogger.log("initializeClients", clientTypes, "for", character.name);

  if (clientTypes.includes(Clients.DIRECT)) {
    const autoClient = await AutoClientInterface.start(runtime);
    if (autoClient) clients.auto = autoClient;
  }

  if (clientTypes.includes(Clients.DISCORD)) {
    const discordClient = await DiscordClientInterface.start(runtime);
    if (discordClient) clients.discord = discordClient;
  }

  if (clientTypes.includes(Clients.TELEGRAM)) {
    const telegramClient = await TelegramClientInterface.start(runtime);
    if (telegramClient) clients.telegram = telegramClient;
  }

  if (clientTypes.includes(Clients.TWITTER)) {
    const twitterClient = await TwitterClientInterface.start(runtime);
    if (twitterClient) {
      clients.twitter = twitterClient;
    }
  }

  // if (clientTypes.includes(Clients.FARCASTER)) {
  //     // why is this one different :(
  //     const farcasterClient = new FarcasterAgentClient(runtime);
  //     if (farcasterClient) {
  //         farcasterClient.start();
  //         clients.farcaster = farcasterClient;
  //     }
  // }
  // if (clientTypes.includes("lens")) {
  //     const lensClient = new LensAgentClient(runtime);
  //     lensClient.start();
  //     clients.lens = lensClient;
  // }

  elizaLogger.log("client keys", Object.keys(clients));

  // TODO: Add Slack client to the list
  // Initialize clients as an object

  // if (clientTypes.includes("slack")) {
  //     const slackClient = await SlackClientInterface.start(runtime);
  //     if (slackClient) clients.slack = slackClient; // Use object property instead of push
  // }

  function determineClientType(client: Client): string {
    // Check if client has a direct type identifier
    if ("type" in client) {
      return (client as any).type;
    }

    // Check constructor name
    const constructorName = client.constructor?.name;
    if (constructorName && !constructorName.includes("Object")) {
      return constructorName.toLowerCase().replace("client", "");
    }

    // Fallback: Generate a unique identifier
    return `client_${Date.now()}`;
  }

  if (character.plugins?.length > 0) {
    for (const plugin of character.plugins) {
      if (plugin.clients) {
        for (const client of plugin.clients) {
          const startedClient = await client.start(runtime);
          const clientType = determineClientType(client);
          elizaLogger.debug(
            `Initializing client of type: ${clientType}`
          );
          clients[clientType] = startedClient;
        }
      }
    }
  }

  return clients;
}
let nodePlugin: any | undefined;
export function createAgent(
  character: Character,
  db: IDatabaseAdapter,
  cache: ICacheManager,
  token: string
) {
  elizaLogger.success(
    elizaLogger.successesTitle,
    "Creating runtime for character",
    character.name
  );

  nodePlugin ??= createNodePlugin();


  return new AgentRuntime({

    databaseAdapter: db,
    token,
    modelProvider: character.modelProvider,
    evaluators: [],
    character,
    plugins: [
      bootstrapPlugin,
      tokenTrendingPlugin,
      googleSearchPlugin,
      nodePlugin,
      // character.settings.secrets?.WALLET_PUBLIC_KEY ? solanaPlugin : null,
    ].filter(Boolean),
    providers: [],
    actions: [],
    services: [],
    managers: [],
    cacheManager: cache,
  });
}


async function startAgent(character: Character, directClient: DirectClient) {
  try {
    character.id ??= stringToUuid(character.name);
    character.username ??= character.name;

    const token = getTokenForProvider(character.modelProvider, character) as string;
    const dataDir = path.join(__dirname, "../data");

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const db = initializeDatabase(dataDir);

    await db.init();

    const cache = intializeDbCache(character, db);
    const runtime = createAgent(character, db, cache, token);

    await runtime.initialize();

    const clients = await initializeClients(character, runtime);

    directClient.registerAgent(runtime);

    return clients;
  } catch (error) {
    elizaLogger.error(
      `Error starting agent for character ${character.name}:`,
      error
    );
    console.error(error);
    throw error;
  }
}

const checkPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
};

const startAgents = async () => {
  const directClient = new DirectClient();
  let serverPort = parseInt(settings.SERVER_PORT || "3000");
  const args = parseArguments();
  let charactersArg = args.characters || args.character;
  let characters = [ari];
  // let characters = [{
  //     ...defaultCharacter, clients: [
  //         // Clients.TWITTER,
  //         Clients.TELEGRAM,
  //     ],   modelProvider: ModelProviderName.OPENAI,
  // }];

  if (charactersArg) {
    characters = await loadCharacters(charactersArg);
  }

  try {
    for (const character of characters) {
      await startAgent(character, directClient);
    }
  } catch (error) {
    elizaLogger.error("Error starting agents:", error);
  }

  // Find available port
  while (!(await checkPortAvailable(serverPort))) {
    elizaLogger.warn(
      `Port ${serverPort} is in use, trying ${serverPort + 1}`
    );
    serverPort++;
  }

  // upload some agent functionality into directClient
  directClient.startAgent = async (character: Character) => {
    // wrap it so we don't have to inject directClient later
    return startAgent(character, directClient);
  };

  directClient.start(serverPort);

  if (serverPort !== parseInt(settings.SERVER_PORT || "3000")) {
    elizaLogger.log(`Server started on alternate port ${serverPort}`);
  }

  elizaLogger.log(
    "Run `pnpm start:client` to start the client and visit the outputted URL (http://localhost:5173) to chat with your agents. When running multiple agents, use client with different port `SERVER_PORT=3001 pnpm start:client`"
  );
};

startAgents().catch((error) => {
  elizaLogger.error("Unhandled error in startAgents:", error);
  process.exit(1);
});