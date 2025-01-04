import {
    Action,
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    composeContext,
    ModelClass,
    generateObjectDeprecated,
    Content,
    Plugin,
    generateText,
} from "@elizaos/core";
import axios from "axios";
import { load } from "cheerio";

interface GoogleSearchResult {
    title: string;
    link: string;
    snippet: string;
    formattedUrl: string;
}

async function getGoogleSearchResults(args: {
    query: string;
}): Promise<GoogleSearchResult[] | { message: string }> {
    try {
        const formattedQuery = args.query.split(" ").join("+");
        const request = await axios.get(
            `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.SEARCH_ENGINE_ID}&q=${formattedQuery}`
        );
        const results = request.data.items as {
            kind: string;
            title: string;
            htmlTitle: string;
            link: string;
            displayLink: string;
            snippet: string;
            htmlSnippet: string;
            cacheId: string;
            formattedUrl: string;
            htmlFormattedUrl: string;
            pagemap: {};
        }[];

        const data = results.map(({ title, link, snippet, formattedUrl }) => ({
            title,
            link,
            snippet,
            formattedUrl,
        }));
        return data;
    } catch (error) {
        console.error("Error making Google search:", error);
        return { message: "error making google search" };
    }
}

async function getURLContent(args: {
    url: string;
    runtime: IAgentRuntime;
}): Promise<{ content: string; summary: string } | { message: string }> {
    try {
        const request = await axios.get(args.url);
        const $ = load(request.data, {}, true);

        const unwanted = [
            "script",
            "meta",
            "style",
            "svg",
            "button",
            "img",
            "link",
            "a",
            "figure",
            "form",
            "picture",
            "noscript",
        ];

        unwanted.forEach((tag) => {
            $(tag).remove();
        });

        let lines = $("body").text().split("\n");
        let nonBlankLines = lines.filter((line) => line.trim() !== "");
        let outputString = nonBlankLines.join("\n");

        // Generate summary using the content
        const summaryContext = `Please provide a concise summary of the following webpage content in 2-5 sentences:

${outputString.slice(0, 3000)}`;

        const summary = await generateText({
            runtime: args.runtime,
            context: summaryContext,
            modelClass: ModelClass.SMALL,
        });

        return { content: outputString, summary };
    } catch (error) {
        console.error("Error fetching page content:", error);
        return { message: "error fetching page content" };
    }
}

function formatSearchResults(results: GoogleSearchResult[]): Content {
    if (!results.length) {
        return { text: "No results found." } as Content;
    }

    return {
        text:
            "🔍 Search Results:\n\n" +
            results
                .map(
                    (result, index) =>
                        `${index + 1}. ${result.title}\n` +
                        `   ${result.snippet}\n` +
                        `   Link: ${result.formattedUrl}`
                )
                .join("\n\n"),
    } as Content;
}

function formatPageContent(content: string, summary: string): Content {
    return {
        text: `📄 Summary:\n${summary}\n\n📄 Full Content:\n${content.slice(0, 2000)}${content.length > 2000 ? "..." : ""}`,
    } as Content;
}

export const searchGoogle: Action = {
    name: "SEARCH_GOOGLE",
    description:
        "Search Google for specific information using custom search API",
    similes: [
        "GOOGLE_SEARCH",
        "WEB_SEARCH",
        "SEARCH_WEB",
        "FIND_ONLINE",
        "GOOGLE_QUERY",
    ],
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State | undefined,
        options?: Record<string, unknown>,
        callback?: HandlerCallback
    ) => {
        if (callback) {
            await callback({ text: "🔍 Searching Google..." } as Content);
        }

        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: `Extract search query from the message:
Example response:
\`\`\`json
{
    "query": "cryptocurrency market trends 2024"
}
\`\`\`
{{recentMessages}}
Extract:
- Search query (as specific as possible)
`,
        });

        const params = await generateObjectDeprecated({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
        });

        try {
            const results = await getGoogleSearchResults({
                query: params.query,
            });

            if ("message" in results) {
                if (callback) {
                    await callback({
                        text: `Error: ${results.message}`,
                    } as Content);
                }
                return false;
            }

            const formattedResults = formatSearchResults(
                results as GoogleSearchResult[]
            );
            if (callback) {
                await callback(formattedResults);
            }

            return true;
        } catch (error: any) {
            if (callback) {
                await callback({
                    text: `Error performing search: ${error.message}`,
                } as Content);
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Search for latest crypto market trends",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Here are the search results...",
                    action: "SEARCH_GOOGLE",
                },
            },
        ],
    ],
};

export const getPageContent: Action = {
    name: "GET_PAGE_CONTENT",
    description: "Extract readable content from a webpage URL",
    similes: [
        "READ_WEBPAGE",
        "FETCH_PAGE",
        "EXTRACT_CONTENT",
        "SCRAPE_PAGE",
        "URL_CONTENT",
    ],
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State | undefined,
        options?: Record<string, unknown>,
        callback?: HandlerCallback
    ) => {
        if (callback) {
            await callback({ text: "📄 Fetching page content..." } as Content);
        }

        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        const context = composeContext({
            state,
            template: `Extract URL from the message:
Example response:
\`\`\`json
{
    "url": "https://example.com/article"
}
\`\`\`
{{recentMessages}}
Extract:
- Complete URL (must start with http:// or https://)
`,
        });

        const params = await generateObjectDeprecated({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
        });

        try {
            const content = await getURLContent({
                url: params.url,
                runtime,
            });

            if ("message" in content) {
                if (callback) {
                    await callback({
                        text: `Error: ${content.message}`,
                    } as Content);
                }
                return false;
            }

            const formattedContent = formatPageContent(
                content.content,
                content.summary
            );
            if (callback) {
                await callback(formattedContent);
            }

            return true;
        } catch (error: any) {
            if (callback) {
                await callback({
                    text: `Error fetching page content: ${error.message}`,
                } as Content);
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Get content from https://example.com/crypto-news",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Here's the page content...",
                    action: "GET_PAGE_CONTENT",
                },
            },
        ],
    ],
};

export const googleSearchPlugin: Plugin = {
    name: "google-search",
    description: "Plugin for searching Google and extracting webpage content",
    actions: [searchGoogle, getPageContent],
    evaluators: [],
    providers: [],
};

export default googleSearchPlugin;
