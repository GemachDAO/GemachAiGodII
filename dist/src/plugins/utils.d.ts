import { IAgentRuntime, State } from "@elizaos/core";
export declare const composeActionContext: (actionName: string, actionDescription: string, state: State) => string;
export declare const composeResponseContext: (result: unknown, state: State) => string;
export declare const composeErrorResponseContext: (errorMessage: string, state: State) => string;
export declare function generateResponse(runtime: IAgentRuntime, context: string): Promise<string>;
