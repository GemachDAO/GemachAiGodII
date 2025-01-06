import { Plugin } from "@elizaos/core";
import { 
    findTrendingTokens,
    checkTokenSecurity,
    getExchanges,
    getGlobalData,
    getSimplePrice,getTrendingTokensOnChain
} from "./actions/getTrendingTokens";

export const tokenTrendingPlugin: Plugin = {
    name: "token-trending",
    description:
        "Plugin for finding trending tokens and pools across different chains",
    actions: [
        findTrendingTokens,
        checkTokenSecurity,
        getExchanges,
        getGlobalData,
        getSimplePrice,
        getTrendingTokensOnChain
    ],
    evaluators: [],
    providers: [],
};

export default tokenTrendingPlugin;
