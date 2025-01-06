import { State, composeContext } from "@elizaos/core"

export const composeActionContext = (actionName: string,
    actionDescription: string,
    state: State) => {
    const actionTemplate = ` 
        # Knowledge
        {{knowledge}}
        
        About {{agentName}}:
        {{bio}}
        {{lore}}
        
        {{providers}}
        
        {{attachments}}
        
        
        # Action: ${actionName}
        ${actionDescription}
        
        {{recentMessages}}
        
        Based on the action chosen and the previous messages, execute the action and respond to the user using the tools you were given.
        `;
    return composeContext({ state, template: actionTemplate });
}

export const composeResponseContext = (result: unknown, state: State) => {
    const responseTemplate = `
        # Action Examples
        {{actionExamples}}
        (Action examples are for reference only. Do not use the information from them in your response.)

        # Knowledge
        {{knowledge}}

        # Task: Generate dialog and actions for the character {{agentName}}.
        About {{agentName}}:
        {{bio}}
        {{lore}}

        {{providers}}

        {{attachments}}

        # Capabilities
        Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

        Here is the result:
        ${JSON.stringify(result)}

        {{actions}}

        Respond to the message knowing that the action was successful and these were the previous messages:
        {{recentMessages}}
    `;
    return composeContext({ state, template: responseTemplate });
};

export const composeErrorResponseContext = (errorMessage: string, state: State) => {
    const errorResponseTemplate = `
        # Knowledge
        {{knowledge}}

        # Task: Generate dialog and actions for the character {{agentName}}.
        About {{agentName}}:
        {{bio}}
        {{lore}}

        {{providers}}

        {{attachments}}

        # Capabilities
        Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

        {{actions}}

        Respond to the message knowing that the action failed.
        The error was:
        ${errorMessage}

        These were the previous messages:
        {{recentMessages}}
    `;
    return composeContext({ state, template: errorResponseTemplate });
};