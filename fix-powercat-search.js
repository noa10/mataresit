[
  {
    "event_message": "🎯 Generated 7 receipt cards for intent: document_retrieval\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "77bc4e48-4a79-484b-86fd-d846cbac1318",
    "level": "log",
    "timestamp": 1751875743955000
  },
  {
    "event_message": "🔍 Enhanced search response structure: {\n  success: true,\n  resultsLength: 7,\n  totalResults: 7,\n  hasEnhancedResponse: true\n}\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "e652009b-5413-40df-a281-a46d171528c3",
    "level": "log",
    "timestamp": 1751875743955000
  },
  {
    "event_message": "📤 Stage 6: Response Generation with UI Components\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "6bd0cbc3-f9e2-4430-b231-0a0194dadf5e",
    "level": "log",
    "timestamp": 1751875738757000
  },
  {
    "event_message": "✅ Stage 6 completed in 0ms - Generated response with 7 results and UI components\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "be3f22ba-70b1-48ac-93c8-33da840f84d7",
    "level": "log",
    "timestamp": 1751875738757000
  },
  {
    "event_message": "✅ Generated 7 UI components\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "be96eaa4-ae47-4829-a164-82d0a35d1aeb",
    "level": "log",
    "timestamp": 1751875738757000
  },
  {
    "event_message": "🎨 Generating UI components for results...\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "e99828ad-86b3-47d1-9de1-b123fa96288c",
    "level": "log",
    "timestamp": 1751875738757000
  },
  {
    "event_message": "🔍 DEBUG: RAG Pipeline execution completed: { success: true, resultsLength: 7, error: undefined }\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "6235ced8-6c1a-4fc0-8f7b-6b84b71791b6",
    "level": "log",
    "timestamp": 1751875738757000
  },
  {
    "event_message": "📋 Stage 5: Context Compilation\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "b87245d4-0491-49c4-b54d-b03a4fd02c41",
    "level": "log",
    "timestamp": 1751875738756000
  },
  {
    "event_message": "✅ Stage 5 completed in 0ms - Compiled 7 results\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "f8c1dbb8-c56c-4580-adef-1bc5f5ed54ff",
    "level": "log",
    "timestamp": 1751875738756000
  },
  {
    "event_message": "🤖 Raw Gemini response for re-ranking: ```json\n{\n  \"rankedOrder\": [1, 2, 3, 4, 5, 6, 7],\n  \"confidence\": 0.95,\n  \"reasoning\": \"All results are highly relevant as they all contain 'POWERCAT' in the receipt.  The ranking prioritizes receipts in descending order of total amount, providing the user with potentially more valuable information first.  This assumes the user is interested in finding receipts related to larger purchases of POWERCAT.  The lack of description does not affect the ranking since the query is simple and all results directly match.  Date is not considered a primary ranking factor in this case.\"\n}\n```\n\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "0f00b5e7-ff96-4cfe-855b-2805e8e71c26",
    "level": "log",
    "timestamp": 1751875738756000
  },
  {
    "event_message": "✅ Stage 4 completed in 1180ms - Re-ranked 7 results\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "8eb5eb14-0b83-48ff-8263-8fe20750cb4a",
    "level": "log",
    "timestamp": 1751875738756000
  },
  {
    "event_message": "🔑 DEBUG: GEMINI_API_KEY present: true\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "7b63277f-cc2b-4a8d-b3b1-302bf6c35bbd",
    "level": "log",
    "timestamp": 1751875737577000
  },
  {
    "event_message": "🤖 Sending re-ranking request to Gemini with 7 candidates\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "b03ed1fb-2486-436d-b1ba-ad506373db3d",
    "level": "log",
    "timestamp": 1751875737577000
  },
  {
    "event_message": "🔑 DEBUG: API key length: 39\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "c8fa8eff-c8cc-4d7a-a91b-8923d73b6de5",
    "level": "log",
    "timestamp": 1751875737577000
  },
  {
    "event_message": "📝 DEBUG: Prompt preview: \nYou are an expert search result ranker for a receipt management system. Re-rank these search results based on contextual relevance to the user's query.\n\nOriginal Query: \"powercat\"\n\nSearch Results to ...\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "3afd0e72-469a-4f34-872c-9136a0721b6a",
    "level": "log",
    "timestamp": 1751875737577000
  },
  {
    "event_message": "🔑 DEBUG: API key prefix: AIzaSyAqp9...\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "a0f806fb-0d9b-4ae9-be2e-5bcc4a6e1f9e",
    "level": "log",
    "timestamp": 1751875737577000
  },
  {
    "event_message": "📝 DEBUG: Prompt length: 3047\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "deb3238a-701e-45ad-9179-8db93516fb06",
    "level": "log",
    "timestamp": 1751875737577000
  },
  {
    "event_message": "🎯 Hybrid search complete: 7 total results (7 exact, 0 semantic)\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "a85a219a-defe-49be-a5f3-bbe530188d82",
    "level": "log",
    "timestamp": 1751875737576000
  },
  {
    "event_message": "✅ Exact search found 7 matches\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "b0bf23a9-4d9e-43bf-8df9-8052e56a05f4",
    "level": "log",
    "timestamp": 1751875737576000
  },
  {
    "event_message": "🎯 Skipping semantic search for specific product query: \"powercat\" to ensure 100% precision\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "446814e1-ef9a-42ce-890b-bd29158abd0f",
    "level": "log",
    "timestamp": 1751875737576000
  },
  {
    "event_message": "🎯 Stage 4: Result Re-ranking\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "24d398c8-b401-484e-ac73-05c9c7856306",
    "level": "log",
    "timestamp": 1751875737576000
  },
  {
    "event_message": "✅ Enhanced line item search found 7 results\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "7f11666c-1d71-48e7-9c47-b527063ef4ac",
    "level": "log",
    "timestamp": 1751875737576000
  },
  {
    "event_message": "🔧 Line item deduplication: 7 raw results → 7 unique receipts\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "aa8bc485-337e-4c84-b78e-0ae87d88978a",
    "level": "log",
    "timestamp": 1751875737576000
  },
  {
    "event_message": "✅ Found 7 exact matches\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "934d883e-030b-41d4-9204-c01753c99f59",
    "level": "log",
    "timestamp": 1751875737576000
  },
  {
    "event_message": "🎯 Performing exact line item search for: powercat\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "2e44bdcb-95fc-4cb4-b6bd-2ebee1cfe9b7",
    "level": "log",
    "timestamp": 1751875736765000
  },
  {
    "event_message": "🔍 Enhanced line item search parameters: {\n  limit: 10,\n  offset: 0,\n  startDate: undefined,\n  endDate: undefined,\n  minAmount: undefined,\n  maxAmount: undefined,\n  useHybridSearch: true,\n  queryEmbeddingLength: 1536,\n  originalThreshold: undefined,\n  adaptiveThreshold: 0.85,\n  query: \"powercat\"\n}\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "2997a032-4327-4f3c-8744-3257246c6a29",
    "level": "log",
    "timestamp": 1751875736764000
  },
  {
    "event_message": "🔧 Calling enhanced line item search on unified_embeddings...\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "0c880bb6-76e4-41bb-9166-5de29d6e4645",
    "level": "log",
    "timestamp": 1751875736764000
  },
  {
    "event_message": "🔍 Extracting food item from query: powercat\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "3a9f0dea-3fdc-414d-bb26-8f7987558762",
    "level": "log",
    "timestamp": 1751875736764000
  },
  {
    "event_message": "🔍 Line item search parameters: {\n  limit: 10,\n  offset: 0,\n  startDate: undefined,\n  endDate: undefined,\n  minAmount: undefined,\n  maxAmount: undefined,\n  query: \"powercat\",\n  useHybridSearch: true\n}\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "f620b2ca-cbd7-41f7-ac49-21d1ddd1471e",
    "level": "log",
    "timestamp": 1751875736764000
  },
  {
    "event_message": "🍜 Extracted food item: powercat\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "7bdae21b-4c38-459f-a76c-7d1f76fa4b49",
    "level": "log",
    "timestamp": 1751875736764000
  },
  {
    "event_message": "🔀 Starting hybrid line item search...\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "6611af58-115c-45ae-8da1-8080dfa87cb7",
    "level": "log",
    "timestamp": 1751875736764000
  },
  {
    "event_message": "🎯 Using high precision threshold for exact food item: powercat\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "8f15dfee-821a-494f-a043-964137572044",
    "level": "log",
    "timestamp": 1751875736764000
  },
  {
    "event_message": "🍜 Executing Enhanced Line Item Search\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "7f39fd8f-06b4-4927-80db-45f799e32859",
    "level": "log",
    "timestamp": 1751875736763000
  },
  {
    "event_message": "🔍 DEBUG: Checking line item query for: powercat\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "a2175ff5-d4a4-4f86-ad48-74f3736627f2",
    "level": "log",
    "timestamp": 1751875736763000
  },
  {
    "event_message": "🔍 DEBUG: isLineItemQuery - result: true (known indicator)\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "2115df07-6400-4b41-8159-882480ce28a4",
    "level": "log",
    "timestamp": 1751875736763000
  },
  {
    "event_message": "🔍 DEBUG: Line item detection result: true\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "d43520ab-71e8-42fd-a248-f91d1c1912b7",
    "level": "log",
    "timestamp": 1751875736763000
  },
  {
    "event_message": "🍜 Detected line item query - routing to enhanced line item search\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "f74d7849-ad90-4ac6-94d8-939c7ea01eac",
    "level": "log",
    "timestamp": 1751875736763000
  },
  {
    "event_message": "🔍 Stage 3: Enhanced Hybrid Search Execution with Temporal Routing\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "9c4d1017-5dcb-4cd3-96fb-01830298aa3c",
    "level": "log",
    "timestamp": 1751875736763000
  },
  {
    "event_message": "🔍 DEBUG: isLineItemQuery - checking query: powercat\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "48ba1b55-d706-4649-a953-21c392f9e8e2",
    "level": "log",
    "timestamp": 1751875736763000
  },
  {
    "event_message": "🔍 DEBUG: isLineItemQuery - FOUND KNOWN INDICATOR: powercat\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "e058cfef-e4e1-49ea-b71f-240f7b154883",
    "level": "log",
    "timestamp": 1751875736763000
  },
  {
    "event_message": "✅ Stage 2 completed in 228ms\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "55a46599-ff22-443e-8d35-54abb2b60759",
    "level": "log",
    "timestamp": 1751875736762000
  },
  {
    "event_message": "Converting embedding dimensions from 768 to 1536\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "343a576f-1dda-4eaf-9ded-bb77b6b43032",
    "level": "log",
    "timestamp": 1751875736762000
  },
  {
    "event_message": "🔢 Stage 2: Embedding Generation\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "5109d7cf-0270-4450-b434-eb31caf3fd0b",
    "level": "log",
    "timestamp": 1751875736534000
  },
  {
    "event_message": "🔍 DEBUG: Stage 1 completed successfully\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "c0ff20c3-dbd1-4d7e-b0ed-27915cbfa736",
    "level": "log",
    "timestamp": 1751875736533000
  },
  {
    "event_message": "✅ Stage 1 completed in 1111ms {\n  intent: \"document_retrieval\",\n  confidence: 0.6,\n  expandedQuery: \"powercat, Powercat Sdn Bhd, Powercat (M) Sdn Bhd, Powercat Enterprise, Powercat company, Powercat receipts, resit Powercat, invois Powercat\",\n  cached: false\n}\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "735d95a4-10da-4738-b54b-649f995558d2",
    "level": "log",
    "timestamp": 1751875736533000
  },
  {
    "event_message": "🔄 Cache MISS for LLM preprocessing - fetching fresh data\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "77407fa3-a5da-4302-a82d-aa1d6781b48e",
    "level": "log",
    "timestamp": 1751875735422000
  },
  {
    "event_message": "🔍 DEBUG: RAG Pipeline created, about to execute...\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "69bcb761-ea60-43e3-973d-c66b50377d52",
    "level": "log",
    "timestamp": 1751875735422000
  },
  {
    "event_message": "🔧 RAG Pipeline constructor completed\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "60d41d45-e964-49fd-b15a-42924de2a7e1",
    "level": "log",
    "timestamp": 1751875735422000
  },
  {
    "event_message": "🔍 DEBUG: RAG Pipeline context check: {\n  hasContext: true,\n  originalQuery: \"powercat\",\n  hasUser: true,\n  hasParams: true,\n  hasStartTime: false,\n  hasMetadata: true\n}\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "557fdfe3-fead-4610-b5d4-4fe8b0030cf4",
    "level": "log",
    "timestamp": 1751875735422000
  },
  {
    "event_message": "🔍 DEBUG: Execute function called - checking context...\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "90d3a201-762f-4e00-9ee8-f831729e7d25",
    "level": "log",
    "timestamp": 1751875735422000
  },
  {
    "event_message": "🚀 Starting RAG Pipeline execution\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "39795fe1-308a-4498-babb-8f6527ed727e",
    "level": "log",
    "timestamp": 1751875735422000
  },
  {
    "event_message": "🔍 DEBUG: Constructor context check: {\n  hasContext: true,\n  originalQuery: \"powercat\",\n  hasUser: true,\n  hasParams: true,\n  hasStartTime: false,\n  hasMetadata: true\n}\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "b6cd0b08-a7ea-4169-ab12-0d423dc30aa2",
    "level": "log",
    "timestamp": 1751875735422000
  },
  {
    "event_message": "📝 Stage 1: Query Preprocessing with Caching\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "0e2366ed-3bf0-4686-9663-d7de36b8c9cf",
    "level": "log",
    "timestamp": 1751875735422000
  },
  {
    "event_message": "🔍 DEBUG: Creating RAG Pipeline with context: {\n  hasOriginalQuery: true,\n  hasParams: true,\n  hasUser: true,\n  hasSupabase: true\n}\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "9a59f0ff-c4bc-48e2-80e3-b28c81d20ab5",
    "level": "log",
    "timestamp": 1751875735422000
  },
  {
    "event_message": "🔧 RAG Pipeline constructor called\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "f602f2b6-db22-423b-937a-0172fb3f0d49",
    "level": "log",
    "timestamp": 1751875735422000
  },
  {
    "event_message": "🔍 DEBUG: About to start Stage 1 - Query Preprocessing\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "c52380f5-a0fb-4741-93cb-de963d5a0337",
    "level": "log",
    "timestamp": 1751875735422000
  },
  {
    "event_message": "🔍 DEBUG: About to enter try block...\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "607c3db3-1209-4825-be5e-a0f7ce200e2b",
    "level": "log",
    "timestamp": 1751875735422000
  },
  {
    "event_message": "🔧 DEBUG: Enhanced preprocessing JSON extraction: {\n  originalLength: 1203,\n  cleanedLength: 1190,\n  hasMarkdown: true,\n  preview: \"{\\n\" +\n    '  \"expandedQuery\": \"Powercat, Power Cat, Power Cat Cafe,  receipt analysis for Power Cat related t...'\n}\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "6d681c96-aa7b-4ccb-9094-47517e10eda8",
    "level": "log",
    "timestamp": 1751875735421000
  },
  {
    "event_message": "Enhanced search: User authenticated successfully: feecc208-3282-49d2-8e15-0c64b0ee4abb\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "5dbce942-8a51-404c-8cce-d2e6fdd9f96a",
    "level": "log",
    "timestamp": 1751875733082000
  },
  {
    "event_message": "🚀 Using Enhanced Pipeline System {\n  useEnhancedPrompting: false,\n  isLineItemQuery: true,\n  shouldUseEnhancedPipeline: true\n}\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "262434d0-1275-4901-a890-d946301057a6",
    "level": "log",
    "timestamp": 1751875733082000
  },
  {
    "event_message": "🔍 DEBUG: isLineItemQuery - FOUND KNOWN INDICATOR: powercat\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "f6fd8ebb-4d4d-4122-91c1-39ecdc3fbe98",
    "level": "log",
    "timestamp": 1751875732286000
  },
  {
    "event_message": "🔍 DEBUG: isLineItemQuery - result: true (known indicator)\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "040b093c-1490-48a7-aa23-3760a5d189cf",
    "level": "log",
    "timestamp": 1751875732286000
  },
  {
    "event_message": "🔍 DEBUG: isLineItemQuery - checking query: powercat\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "8134d14a-591e-4430-a408-7e1ffdca4745",
    "level": "log",
    "timestamp": 1751875732286000
  },
  {
    "event_message": "🔍 DEBUG: Request routing decision: {\n  useEnhancedPrompting: undefined,\n  useEnhancedPromptingResolved: false,\n  isLineItemQuery: true,\n  forceEnhanced: true,\n  bodyKeys: [\n    \"query\",\n    \"sources\",\n    \"limit\",\n    \"offset\",\n    \"filters\",\n    \"similarityThreshold\",\n    \"includeMetadata\",\n    \"aggregationMode\"\n  ],\n  query: \"powercat\"\n}\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "e6627cea-041f-4788-be56-c149a5e594c3",
    "level": "log",
    "timestamp": 1751875732285000
  },
  {
    "event_message": "🚀 ROUTING: Taking enhanced search path (forced for line item query)\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "b763c8f7-daa0-4b78-911d-9a18f7d4e9a0",
    "level": "log",
    "timestamp": 1751875732285000
  },
  {
    "event_message": "🔍 DEBUG: isLineItemQuery - checking query: powercat\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "4dda2a6b-3eea-4f4d-a6ef-02a2e4725017",
    "level": "log",
    "timestamp": 1751875732283000
  },
  {
    "event_message": "🔍 DEBUG: isLineItemQuery - result: true (known indicator)\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "c36bdff2-41ba-4662-b92a-ba306fa462a4",
    "level": "log",
    "timestamp": 1751875732283000
  },
  {
    "event_message": "🔍 DEBUG: isLineItemQuery - FOUND KNOWN INDICATOR: powercat\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "735590fc-062b-4677-b56d-cbf6986d2cd1",
    "level": "log",
    "timestamp": 1751875732283000
  },
  {
    "event_message": "Listening on http://localhost:9999/\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "7a9268a0-7685-4a23-b810-cbf0671e27af",
    "level": "log",
    "timestamp": 1751875732238000
  },
  {
    "event_message": "booted (time: 42ms)",
    "event_type": "Boot",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "cfedb8f7-263d-488d-8e7e-3da362041c7a",
    "level": "log",
    "timestamp": 1751875732237000
  },
  {
    "event_message": "Listening on http://localhost:9999/\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "25d740cd-370d-4d0d-802d-f8b989a52dc1",
    "level": "log",
    "timestamp": 1751875731672000
  },
  {
    "event_message": "booted (time: 59ms)",
    "event_type": "Boot",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "7ea368c0-93ff-4e02-9982-1d724afd88fb",
    "level": "log",
    "timestamp": 1751875731668000
  },
  {
    "event_message": "shutdown",
    "event_type": "Shutdown",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "30e6cb04-c43d-404f-bdbb-52bc73e7e572",
    "level": "log",
    "timestamp": 1751875370419000
  },
  {
    "event_message": "shutdown",
    "event_type": "Shutdown",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "51d1b30f-0f9a-4746-95a2-e051ff53ab65",
    "level": "log",
    "timestamp": 1751875370024000
  },
  {
    "event_message": "shutdown",
    "event_type": "Shutdown",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "f4315d33-9947-4c0d-ae2e-4575738f9d49",
    "level": "log",
    "timestamp": 1751875196221000
  },
  {
    "event_message": "shutdown",
    "event_type": "Shutdown",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "9644391c-e4df-483f-aa14-eafe2a372d46",
    "level": "log",
    "timestamp": 1751875193476000
  },
  {
    "event_message": "🎯 Generated 7 receipt cards for intent: document_retrieval\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "e271c02a-4ddd-4e43-83e7-39987147ec53",
    "level": "log",
    "timestamp": 1751875183359000
  },
  {
    "event_message": "🔍 Enhanced search response structure: {\n  success: true,\n  resultsLength: 7,\n  totalResults: 7,\n  hasEnhancedResponse: true\n}\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "477500c7-56b5-4c84-a10f-35fe5bdc1758",
    "level": "log",
    "timestamp": 1751875183359000
  },
  {
    "event_message": "✅ Stage 6 completed in 0ms - Generated response with 7 results and UI components\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "2a790f46-a3b1-4add-bcdf-d3a6cd6ea206",
    "level": "log",
    "timestamp": 1751875177622000
  },
  {
    "event_message": "🔍 DEBUG: RAG Pipeline execution completed: { success: true, resultsLength: 7, error: undefined }\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "c3c5449d-d14d-44f7-99b7-9ab9321f2446",
    "level": "log",
    "timestamp": 1751875177622000
  },
  {
    "event_message": "📤 Stage 6: Response Generation with UI Components\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "b36bb8e4-3c76-4a9e-9c8e-79660c7f16a9",
    "level": "log",
    "timestamp": 1751875177622000
  },
  {
    "event_message": "🎨 Generating UI components for results...\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "f1886f47-4734-4a7a-93aa-7944266bde13",
    "level": "log",
    "timestamp": 1751875177622000
  },
  {
    "event_message": "✅ Generated 7 UI components\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "2f86e598-cae9-4226-977e-03ee1da161cb",
    "level": "log",
    "timestamp": 1751875177622000
  },
  {
    "event_message": "✅ Stage 5 completed in 1ms - Compiled 7 results\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "2fc3fcf3-5805-41e2-b839-6bbfa7bd0393",
    "level": "log",
    "timestamp": 1751875177622000
  },
  {
    "event_message": "✅ Stage 4 completed in 1315ms - Re-ranked 7 results\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "1a83eff5-1709-444f-ad3a-11fe14288f1c",
    "level": "log",
    "timestamp": 1751875177621000
  },
  {
    "event_message": "🤖 Raw Gemini response for re-ranking: ```json\n{\n  \"rankedOrder\": [1, 2, 3, 4, 5, 6, 7],\n  \"confidence\": 0.95,\n  \"reasoning\": \"All results are highly relevant as they all contain 'POWERCAT' in the receipt.  The ranking prioritizes receipts in descending order of total amount, providing the user with potentially more valuable information first.  This assumes the user is interested in finding receipts related to larger purchases of POWERCAT.  There is no other information to differentiate the results, so the date is not used as a ranking factor.\"\n}\n```\n\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "fe3c24f4-2608-4e10-86af-beeabe11803c",
    "level": "log",
    "timestamp": 1751875177621000
  },
  {
    "event_message": "📋 Stage 5: Context Compilation\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "5b4f4946-43b7-4ea1-b5a6-69dd679d4b73",
    "level": "log",
    "timestamp": 1751875177621000
  },
  {
    "event_message": "📝 DEBUG: Prompt preview: \nYou are an expert search result ranker for a receipt management system. Re-rank these search results based on contextual relevance to the user's query.\n\nOriginal Query: \"powercat\"\n\nSearch Results to ...\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "419cc40d-d629-4620-ae2e-58a7333918e0",
    "level": "log",
    "timestamp": 1751875176307000
  },
  {
    "event_message": "🎯 Hybrid search complete: 7 total results (7 exact, 0 semantic)\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "f6c99cc8-24a8-4189-9a41-78c1710d4864",
    "level": "log",
    "timestamp": 1751875176306000
  },
  {
    "event_message": "🔑 DEBUG: API key length: 39\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "a79c9cc4-ba6b-4c3c-bc55-87c6da5b2bb4",
    "level": "log",
    "timestamp": 1751875176306000
  },
  {
    "event_message": "✅ Enhanced line item search found 7 results\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "b001563f-f25f-4965-a51f-9c5c577d0b1e",
    "level": "log",
    "timestamp": 1751875176306000
  },
  {
    "event_message": "🎯 Stage 4: Result Re-ranking\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "8565784a-c0d4-445f-99f5-550b01917163",
    "level": "log",
    "timestamp": 1751875176306000
  },
  {
    "event_message": "📝 DEBUG: Prompt length: 3047\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "bb14bea4-7334-4b0a-94e6-f0f9b676de9d",
    "level": "log",
    "timestamp": 1751875176306000
  },
  {
    "event_message": "🔑 DEBUG: API key prefix: AIzaSyAqp9...\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "6bea373b-0c9b-4cfa-9dea-c132002dd20b",
    "level": "log",
    "timestamp": 1751875176306000
  },
  {
    "event_message": "🔧 Line item deduplication: 7 raw results → 7 unique receipts\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "ab818ac9-1f56-4bf7-b750-f806fbd9e496",
    "level": "log",
    "timestamp": 1751875176306000
  },
  {
    "event_message": "🔑 DEBUG: GEMINI_API_KEY present: true\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "c31542dd-677d-4fc4-990a-ae7269f71699",
    "level": "log",
    "timestamp": 1751875176306000
  },
  {
    "event_message": "🤖 Sending re-ranking request to Gemini with 7 candidates\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "26f2fc18-a677-4182-b1e7-65b877b33051",
    "level": "log",
    "timestamp": 1751875176306000
  },
  {
    "event_message": "✅ Exact search found 7 matches\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "edc93f62-6ac1-488c-9378-dca373bb8674",
    "level": "log",
    "timestamp": 1751875176305000
  },
  {
    "event_message": "🎯 Skipping semantic search for specific product query: \"powercat\" to ensure 100% precision\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "2dcc8bc6-d4fd-45a4-9238-55e20fd051f6",
    "level": "log",
    "timestamp": 1751875176305000
  },
  {
    "event_message": "✅ Found 7 exact matches\n",
    "event_type": "Log",
    "function_id": "1f7a4a65-d7ed-4507-a115-bd6ca4cd29c8",
    "id": "cef634a4-eae6-4b99-867d-f692763db65f",
    "level": "log",
    "timestamp": 1751875176305000
  }
]