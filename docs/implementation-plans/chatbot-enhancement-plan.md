# Mataresit Chatbot Enhancement Plan

This document outlines a comprehensive plan to enhance the Mataresit chatbot, focusing on five key areas: response generation, content structure, personalization, error handling, and follow-up suggestions. The recommendations are designed to be actionable and build upon the existing RAG pipeline, caching system, and UI components.

## 1. Response Generation Quality

To improve the helpfulness, accuracy, and contextual relevance of the AI's responses, we will implement a multi-faceted approach that enhances our RAG pipeline.

### Recommendations:

*   **Hybrid Search Strategy:**
    *   **Problem:** Vector search excels at semantic understanding but can sometimes miss exact keyword matches for specific terms like SKUs, product codes, or unique merchant names.
    *   **Solution:** Augment the existing vector search with a traditional keyword-based search. We can use PostgreSQL's trigram extension (`pg_trgm`) for fuzzy string matching.
    *   **Implementation:**
        1.  Modify the Supabase edge function responsible for document retrieval (`search-documents` or similar).
        2.  Perform both a vector similarity search and a `pg_trgm` search in parallel.
        3.  Combine the results, remove duplicates, and use a re-ranking model to score the combined set for relevance before passing it to the LLM.

*   **Re-ranking Layer:**
    *   **Problem:** The initial retrieval might return documents that are broadly relevant but not the best fit for the specific user query.
    *   **Solution:** Introduce a lightweight cross-encoder model to re-rank the top N documents from the retrieval step.
    *   **Implementation:**
        1.  In the RAG pipeline, after the retrieval step, pass the query and the retrieved document chunks to a new edge function that hosts a small cross-encoder model.
        2.  This function will return a re-ordered list of documents based on a much more accurate relevance score.
        3.  Pass the top K re-ranked documents to the LLM for generation.

*   **Advanced Prompt Engineering:**
    *   **Problem:** Generic prompts lead to generic answers.
    *   **Solution:** Create dynamic, context-rich prompts.
    *   **Implementation:**
        1.  **Dynamic Prompt Templates:** Create different prompt templates for different query intents (e.g., `summarization`, `data_retrieval`, `comparison`). Use a simple classification model or keyword matching to select the appropriate template.
        2.  **Few-Shot Examples:** Include 2-3 high-quality examples of user questions and ideal AI responses directly in the prompt to guide the LLM's output style and structure.
        3.  **Persona Definition:** Refine the system prompt to clearly define the chatbot's persona: "You are a helpful and efficient financial assistant. Your tone is professional yet friendly. You provide concise, data-driven answers."

*   **Feedback Loop for Fine-Tuning:**
    *   **Problem:** The model doesn't learn from its mistakes or successes.
    *   **Solution:** Use the feedback collected via the `FeedbackButtons` component to periodically fine-tune a smaller, instruction-following LLM.
    *   **Implementation:**
        1.  Create a script to process the feedback data from the `message_feedback` table in Supabase.
        2.  Format the data into a dataset of (prompt, chosen_response, rejected_response).
        3.  Use this dataset to perform Direct Preference Optimization (DPO) fine-tuning on a model like `Mistral-7B-Instruct` or a similar open-source model.
        4.  Deploy the fine-tuned model as a new edge function and A/B test it against the current model.

*   **Query Transformation (Rewrite & Expand):**
    *   **Problem:** Users often ask ambiguous or conversational questions that are not optimized for a vector search engine.
    *   **Solution:** Introduce a query transformation step where an LLM rewrites the user's query into several more precise, targeted sub-queries.
    *   **Implementation:**
        1.  In the RAG pipeline, before the retrieval step, pass the user's query to a dedicated LLM prompt.
        2.  The prompt will instruct the model to generate 3-5 alternative queries that capture different facets of the original question (e.g., a more keyword-focused version, a version with synonyms, a hypothetical question the user might be asking).
        3.  Execute the search using all transformed queries in parallel and merge the results.

*   **Contextual Snippet Extraction:**
    *   **Problem:** Passing entire documents into the LLM's context window can be noisy and inefficient, leading to less relevant answers.
    *   **Solution:** Instead of full documents, extract and pass only the most relevant sentences or small chunks that directly relate to the query.
    *   **Implementation:**
        1.  After the re-ranking step, for each of the top K documents, perform a smaller semantic search *within* the document text to find the most relevant sentences.
        2.  Concatenate these high-relevance snippets to form a compact, focused context for the final response generation.

*   **Self-Correction via "Critic" Model:**
    *   **Problem:** LLMs can sometimes "hallucinate" or generate facts that are not supported by the provided source documents.
    *   **Solution:** Implement a two-step generation process. First, a "generator" model drafts an answer. Second, a "critic" model reviews the draft against the source documents to check for factual consistency.
    *   **Implementation:**
        1.  After the generator LLM produces a draft answer, create a new prompt for a "critic" LLM.
        2.  This prompt will include the original query, the source snippets, and the draft answer. It will ask the critic to identify any statements in the draft that are not supported by the sources.
        3.  If inconsistencies are found, the draft is sent back to the generator with the critic's feedback for revision.

*   **Dynamic Tool Use (Function Calling):**
    *   **Problem:** Some queries are better answered by running a precise database query or calculation rather than a semantic search over documents.
    *   **Solution:** Empower the LLM to decide when to use a "tool" (a predefined function) instead of searching.
    *   **Implementation:**
        1.  Define a set of available tools (e.g., `get_total_spending(start_date, end_date, category)`, `find_receipt_by_merchant(merchant_name)`).
        2.  In the main RAG pipeline, use an LLM that supports function calling (like Gemini).
        3.  Provide the list of tools and their schemas in the prompt. The LLM will then decide whether to call a function or proceed with standard document retrieval.
        4.  If the LLM decides to use a tool, parse its output, execute the corresponding function, and return the result to the LLM to generate a final answer.

## 2. Content Structure

To make the responses more readable and scannable, we will leverage and extend the existing UI component system.

### Recommendations:

*   **Structured Output with UI Components:**
    *   **Problem:** The LLM currently returns long strings of text, which are hard to parse.
    *   **Solution:** Prompt the LLM to return JSON objects that map to specific React components.
    *   **Implementation:**
        1.  **New UI Components:** Create a library of data visualization components in `src/components/chat/ui-components/`, such as `DataTable`, `BarChart`, `PieChart`, and `SummaryCard`.
        2.  **Update `UIComponentParser`:** Extend the `parseUIComponents` function in `src/lib/ui-component-parser.ts` to recognize and parse these new component types from the LLM's JSON output.
        3.  **Update `UIComponentRenderer`:** Add rendering logic for the new components in `UIComponentRenderer.tsx`.
        4.  **Prompt for JSON:** Modify the system prompt to instruct the LLM to respond with a JSON structure, e.g., `{"components": [{"type": "summary-card", "data": {...}}, {"type": "bar-chart", "data": {...}}]}`.

*   **Progressive Disclosure:**
    *   **Problem:** Complex answers can overwhelm the user.
    *   **Solution:** Show a high-level summary first, with the option to drill down into details.
    *   **Implementation:**
        1.  In `ChatMessage.tsx`, when a message contains both a summary component and a detailed component (like a table), initially render only the summary.
        2.  Add a "Show Details" button. On click, render the detailed component. This can be managed with local component state.

## 3. Personalization

To make the chatbot feel more like a personal assistant, we will tailor its responses to individual users.

### Recommendations:

*   **User Profile Injection:**
    *   **Problem:** The chatbot treats all users the same.
    *   **Solution:** Inject user-specific information into the prompt.
    *   **Implementation:**
        1.  Extend the user settings in the database to include preferences like `preferred_currency`, `date_format`, and `common_merchants`.
        2.  In the main chat logic, fetch this user profile data.
        3.  Dynamically add a "User Profile" section to the system prompt: `--- User Profile --- \n Currency: MYR \n Date Format: DD/MM/YYYY \n ---`.

*   **Conversational Memory:**
    *   **Problem:** The chatbot doesn't remember the context of the current conversation.
    *   **Solution:** Summarize the recent conversation history and include it in the prompt.
    *   **Implementation:**
        1.  Before sending a new user query to the backend, take the last 2-4 turns of the conversation.
        2.  Call a separate, fast LLM endpoint to summarize this history into a concise paragraph.
        3.  Include this summary in the prompt: `--- Conversation Summary --- \n The user previously asked about their grocery spending in May and is now asking for a breakdown by store. ---`.

## 4. Error Handling

To build user trust, the chatbot must handle ambiguity and errors gracefully.

### Recommendations:

*   **Graceful Fallbacks:**
    *   **Problem:** The chatbot says "I don't know" when it can't find an answer.
    *   **Solution:** Provide helpful, actionable responses during retrieval failure.
    *   **Implementation:**
        1.  In the RAG pipeline, if the retrieval step returns no documents, instead of calling the LLM, return a predefined response object.
        2.  This response could include suggestions for rephrasing the query, e.g., "I couldn't find any receipts matching that description. Could you try searching for the merchant name or a specific item?"

*   **Asking Clarification Questions:**
    *   **Problem:** The chatbot guesses when a query is ambiguous.
    *   **Solution:** If the user's query is too broad, ask for more information.
    *   **Implementation:**
        1.  Add a "confidence score" to the query intent classification step.
        2.  If the confidence score for the intent is low, prompt the LLM to generate a clarifying question.
        3.  Render the clarification question and a set of quick-reply buttons to the user.

## 5. Follow-up Suggestions

To guide the user and make the chatbot more proactive, we will provide contextual next-step recommendations.

### Recommendations:

*   **Dynamic "Next Step" Suggestions:**
    *   **Problem:** The user has to think of what to ask next.
    *   **Solution:** Have the LLM suggest relevant follow-up actions.
    *   **Implementation:**
        1.  Modify the prompt to ask the LLM to generate a `follow_up_suggestions` array in its JSON output, containing 2-3 relevant questions.
        2.  In `ChatMessage.tsx`, render these suggestions as interactive buttons below the main response. When a user clicks a button, it triggers a new message.

*   **Goal-Oriented Conversation Flows:**
    *   **Problem:** Multi-step tasks are difficult for the user to manage.
    *   **Solution:** Design guided conversation flows for common, complex tasks.
    *   **Implementation:**
        1.  Identify key user goals (e.g., "expense reporting", "budget analysis").
        2.  For each goal, define a state machine that outlines the steps and the information needed at each step.
        3.  When a user's query triggers one of these flows, the backend will manage the state and prompt the user for the next piece of information until the goal is complete.
