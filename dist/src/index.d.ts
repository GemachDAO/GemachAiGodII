import { AgentRuntime, Character, IAgentRuntime, ICacheManager, IDatabaseAdapter, ModelProviderName } from "@elizaos/core";
export declare function getTokenForProvider(provider: ModelProviderName, character: Character): string;
export declare function initializeClients(character: Character, runtime: IAgentRuntime): Promise<Record<string, any>>;
export declare function createAgent(character: Character, db: IDatabaseAdapter, cache: ICacheManager, token: string): AgentRuntime;
