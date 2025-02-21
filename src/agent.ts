import { AgentBuilder, ModelProviderName } from "@iqai/agent";
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
// import { coingeckoPlugin } from "./plugins/plugin-coingecko/src";
import { tokenTrendingPlugin } from "./plugins/trending-token";
import { createATPPlugin } from "@iqai/plugin-atp";

async function main() {
  // Setup database
  const databaseAdapter = new SqliteDatabaseAdapter(
    new Database("./data/db.sqlite")
  );

  const sequencerPlugin = await createSequencerPlugin();
  const atpPlugin = await createATPPlugin({
    walletPrivateKey: process.env.WALLET_PRIVATE_KEY,
  });

  const agent = new AgentBuilder()
    .withDatabase(databaseAdapter)
    .withClient("direct", DirectClientInterface).withClient("telegram", TelegramClientInterface)
    // .withClient("twitter", TwitterClientInterface)
    .withModelProvider(ModelProviderName.OPENAI, process.env.OPENAI_API_KEY)
    // .withPlugin(coingeckoPlugin)
    .withPlugin(googleSearchPlugin)
    .withPlugin(tokenTrendingPlugin)
    .withPlugin(createNodePlugin())
    .withPlugin(bootstrapPlugin)
    .withPlugin(sequencerPlugin)
    .withPlugin(atpPlugin)
    .withCharacter({
      ...ari,
      username: "ari",
    })
    .build();

  await agent.start();
}

main().catch(console.error);