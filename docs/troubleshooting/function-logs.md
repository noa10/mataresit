[
  {
    "event_message": "shutdown",
    "event_type": "Shutdown",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "d9ac559b-9a5f-43ae-8964-49827bbf6223",
    "level": "log",
    "timestamp": 1750694184716150
  },
  {
    "event_message": "[COMPLETE] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Receipt processing completed successfully\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "f42fb509-a391-4548-9b67-af3700146636",
    "level": "log",
    "timestamp": 1750693994671301
  },
  {
    "event_message": "[EMBEDDING] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Receipt marked as having embeddings\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "9984c52b-48ba-401e-98c6-383ce239bdc8",
    "level": "log",
    "timestamp": 1750693994671146
  },
  {
    "event_message": "[EMBEDDING] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Also generated embeddings for 2 line items\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "0485126f-7b5f-4cc3-9a1a-720099b50351",
    "level": "log",
    "timestamp": 1750693994670932
  },
  {
    "event_message": "[EMBEDDING] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Successfully generated 0 embeddings\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "f357eab1-5d8c-4ade-84a4-9137f30a5e51",
    "level": "log",
    "timestamp": 1750693994670670
  },
  {
    "event_message": "Calling generate-embeddings function...\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "61756d31-1424-4459-8db6-425665be0e6f",
    "level": "log",
    "timestamp": 1750693994668568
  },
  {
    "event_message": "[EMBEDDING] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Triggering embedding generation\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "ae1cba94-0d1e-4265-be89-3d242bf54c2b",
    "level": "log",
    "timestamp": 1750693994668353
  },
  {
    "event_message": "[SAVE] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Processing results saved successfully\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "db7f8542-f97b-411c-8a71-59eea81761b7",
    "level": "log",
    "timestamp": 1750693994667946
  },
  {
    "event_message": "[DEBUG] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Verification: Found 1 line items in database after insert\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "23b1b600-bffe-4011-8fde-de668e243d8c",
    "level": "log",
    "timestamp": 1750693994667797
  },
  {
    "event_message": "Stored 2 line items for receipt 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "520ffe57-aefe-4c84-a9eb-290756aa27a5",
    "level": "log",
    "timestamp": 1750693994667565
  },
  {
    "event_message": "[SAVE] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Successfully saved 2 line items to database\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "9a8b62ec-01a6-4ad4-9011-2cd8accf9a51",
    "level": "log",
    "timestamp": 1750693994667317
  },
  {
    "event_message": "DEBUG: Valid line items after filtering: [\n  {\n    description: \"IKAN (FP)\",\n    amount: 5,\n    receipt_id: \"4ac838dc-bb4a-4401-8f0b-bb1d9a674eac\"\n  },\n  {\n    description: \"SAYUR (FP)\",\n    amount: 14,\n    receipt_id: \"4ac838dc-bb4a-4401-8f0b-bb1d9a674eac\"\n  }\n]\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "a882e9fa-efc6-4819-94a0-6e76c6679255",
    "level": "log",
    "timestamp": 1750693994667134
  },
  {
    "event_message": "DEBUG: Formatted line items: [\n  {\n    description: \"IKAN (FP)\",\n    amount: 5,\n    receipt_id: \"4ac838dc-bb4a-4401-8f0b-bb1d9a674eac\"\n  },\n  {\n    description: \"SAYUR (FP)\",\n    amount: 14,\n    receipt_id: \"4ac838dc-bb4a-4401-8f0b-bb1d9a674eac\"\n  }\n]\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "bb33d540-e787-4ac1-8c14-e0c04e19ab4b",
    "level": "log",
    "timestamp": 1750693994666991
  },
  {
    "event_message": "DEBUG: Raw line items: [\n  { description: \"IKAN (FP)\", amount: 5 },\n  { description: \"SAYUR (FP)\", amount: 14 }\n]\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "893e1b11-c81d-4470-ad4c-7826e4578302",
    "level": "log",
    "timestamp": 1750693994666803
  },
  {
    "event_message": "[SAVE] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Storing 2 line items in database\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "d193cef2-978c-40d3-ac90-61ce5e88a76a",
    "level": "log",
    "timestamp": 1750693994666550
  },
  {
    "event_message": "[DEBUG] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) DEBUG: Line items check - exists: true, length: 2\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "c9c6b941-e9fe-4d8b-8f36-5df604a15b50",
    "level": "log",
    "timestamp": 1750693994666255
  },
  {
    "event_message": "DEBUG: Checking line items - extractedData.line_items exists: true, length: 2\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "ab888e25-f76d-46df-9b33-78803fdce92c",
    "level": "log",
    "timestamp": 1750693994665970
  },
  {
    "event_message": "Date is already in correct format: 2025-06-16\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "41617a0a-58e4-4ed5-b4d5-6306d66899a6",
    "level": "log",
    "timestamp": 1750693994665533
  },
  {
    "event_message": "Date before validation: 2025-06-16\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "81bd2f1d-e4ad-4629-850f-f914400a61ca",
    "level": "log",
    "timestamp": 1750693994665320
  },
  {
    "event_message": "[SAVE] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Saving processing results to database\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "8df481f7-f622-4121-b065-04c3eb417849",
    "level": "log",
    "timestamp": 1750693994665102
  },
  {
    "event_message": "[AI] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Data extraction completed successfully\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "8a3e788b-7c7b-4e19-adfd-0b8e0fa37f32",
    "level": "log",
    "timestamp": 1750693994664829
  },
  {
    "event_message": "Data extraction complete\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "44f09980-1ace-42d6-a205-8705e7068461",
    "level": "log",
    "timestamp": 1750693994664538
  },
  {
    "event_message": "[COMPLETE] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Processing complete in 7.42 seconds\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "7024269c-a0c5-4a6d-b4f2-f2462d2a000a",
    "level": "log",
    "timestamp": 1750693994664320
  },
  {
    "event_message": "[AI] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) AI Vision processing complete\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "eeca388c-831d-4a07-baac-5997bf58bba4",
    "level": "log",
    "timestamp": 1750693994664104
  },
  {
    "event_message": "🔍 AI Vision response: {\n  success: true,\n  model_used: \"gemini-2.0-flash-lite\",\n  result_merchant: \"SUPER SEVEN CASH & CARRY SDN BHD\",\n  result_total: 19,\n  result_line_items_count: 2,\n  result_line_items: [\n    { description: \"IKAN (FP)\", amount: 5 },\n    { description: \"SAYUR (FP)\", amount: 14 }\n  ]\n}\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "f23e233f-8769-483b-8a54-5475d0986cd1",
    "level": "log",
    "timestamp": 1750693994663862
  },
  {
    "event_message": "🔍 AI Vision request completed in 7.30 seconds\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "5dc2f37f-e544-4daa-a717-5ad6c2fc0826",
    "level": "log",
    "timestamp": 1750693994663611
  },
  {
    "event_message": "Received data from AI Vision: {\n  success: true,\n  result: {\n    merchant: \"SUPER SEVEN CASH & CARRY SDN BHD\",\n    date: \"2025-06-16\",\n    total: 19,\n    tax: 0,\n    currency: \"MYR\",\n    payment_method: \"ATM CARD\",\n    predicted_category: \"Groceries\",\n    malaysian_tax_info: {\n      tax_type: \"ZERO_RATED\",\n      tax_rate: null,\n      tax_amount: 0,\n      is_tax_inclusive: true,\n      business_category: \"Grocery chains\"\n    },\n    line_items: [\n      { description: \"IKAN (FP)\", amount: 5 },\n      { description: \"SAYUR (FP)\", amount: 14 }\n    ],\n    confidence: {\n      merchant: \"95\",\n      date: \"98\",\n      total: \"100\",\n      tax: \"100\",\n      currency: \"100\",\n      payment_method: \"100\",\n      predicted_category: \"90\",\n      malaysian_tax_info: \"95\",\n      line_items: \"95\"\n    },\n    detected_tax_type: \"EXEMPT\",\n    detected_tax_rate: 0,\n    tax_breakdown: {\n      subtotal: 19,\n      tax_amount: 0,\n      tax_rate: 0,\n      total: 19,\n      is_inclusive: true,\n      calculation_method: \"exempt\"\n    },\n    is_tax_inclusive: true,\n    malaysian_business_category: \"Unknown\"\n  },\n  model_used: \"gemini-2.0-flash-lite\"\n}\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "48f28932-8664-4654-95c8-aab8a6f45c64",
    "level": "log",
    "timestamp": 1750693994663412
  },
  {
    "event_message": "🔍 Calling enhance-receipt-data with payload: {\n  receiptId: \"4ac838dc-bb4a-4401-8f0b-bb1d9a674eac\",\n  modelId: \"gemini-2.0-flash-lite\",\n  imageDataSize: 211780,\n  mimeType: \"image/jpeg\",\n  isBase64: true\n}\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "e1d0b8cd-af0f-4049-9033-98a83330e011",
    "level": "log",
    "timestamp": 1750693989669170
  },
  {
    "event_message": "🔍 imageData.isBase64: true\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "ce85dc98-9efc-4098-8967-9f2e9ee33f9b",
    "level": "log",
    "timestamp": 1750693989668823
  },
  {
    "event_message": "🔍 imageData.mimeType: image/jpeg\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "ce0dd762-0971-4a48-9747-00102489af60",
    "level": "log",
    "timestamp": 1750693989668549
  },
  {
    "event_message": "🔍 imageData.data: present (type: string, length: 211780)\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "c5e34311-e361-4b42-ab43-62f49d7aadcb",
    "level": "log",
    "timestamp": 1750693989668372
  },
  {
    "event_message": "🔍 modelId: gemini-2.0-flash-lite (type: string)\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "fef5a995-5ab4-4b13-9091-666dd25d67d9",
    "level": "log",
    "timestamp": 1750693989668138
  },
  {
    "event_message": "🔍 receiptId: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac (type: string)\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "fdbfc1eb-0fd7-45e1-9f07-f3a075d9ed10",
    "level": "log",
    "timestamp": 1750693989667962
  },
  {
    "event_message": "🔍 PROCESS-RECEIPT PAYLOAD VALIDATION:\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "84665658-2e59-49f1-b2d5-25a31f7dcbde",
    "level": "log",
    "timestamp": 1750693989667748
  },
  {
    "event_message": "[DEBUG] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Encoded image size for AI Vision: 211780 bytes\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "661dc1ef-e1b9-4c58-bd1a-56c013ce12b8",
    "level": "log",
    "timestamp": 1750693989667493
  },
  {
    "event_message": "🔍 Encoded image size: 211780 characters\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "9bc7bfa3-c343-4118-a48d-9a2b291e0fd5",
    "level": "log",
    "timestamp": 1750693989667232
  },
  {
    "event_message": "🔍 Encoding image bytes: 158835 bytes\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "6bc395db-d2c1-40db-ad1d-dfe4bc577176",
    "level": "log",
    "timestamp": 1750693989666953
  },
  {
    "event_message": "🔍 Model ID: gemini-2.0-flash-lite\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "2c3cede4-586d-46e7-b8ea-10fced082a40",
    "level": "log",
    "timestamp": 1750693989666690
  },
  {
    "event_message": "🔍 Receipt ID: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "142d2863-adc6-40a0-87b0-4cb1005b9598",
    "level": "log",
    "timestamp": 1750693989666449
  },
  {
    "event_message": "🔍 EDGE FUNCTION DEBUG - Starting AI Vision processing at 2025-06-23T15:53:04.758Z\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "afa08ccc-787a-436b-9199-7bb49b6197ae",
    "level": "log",
    "timestamp": 1750693989666312
  },
  {
    "event_message": "[DEBUG] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Calling enhance-receipt-data at: https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/enhance-receipt-data\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "4bd5519c-1ab6-4695-8c23-6cb5c0c17b29",
    "level": "log",
    "timestamp": 1750693989665609
  },
  {
    "event_message": "Attempting to call enhance-receipt-data at: https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/enhance-receipt-data\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "f7e8a414-b886-4146-83e8-5283cd08d308",
    "level": "log",
    "timestamp": 1750693989665472
  },
  {
    "event_message": "Calling AI Vision for direct image processing...\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "0de91621-9d2b-44c0-80cb-bcaef513edc2",
    "level": "log",
    "timestamp": 1750693989665321
  },
  {
    "event_message": "[METHOD] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Using AI Vision for processing\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "e476883e-27eb-409d-8e01-69e35572edf3",
    "level": "log",
    "timestamp": 1750693989664433
  },
  {
    "event_message": "[AI] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Starting data processing with optimized image\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "2293ff37-02e5-4a59-86d1-9cbf594e3df8",
    "level": "log",
    "timestamp": 1750693989664275
  },
  {
    "event_message": "[THUMBNAIL] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Thumbnail uploaded: https://mpmkbtsufihzdelrlszs.supabase.co/storage/v1/object/public/receipt_images/thumbnails/4ac838dc-bb4a-4401-8f0b-bb1d9a674eac_thumb.jpg\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "ac37826e-9935-4d98-ad75-85ffde80ac31",
    "level": "log",
    "timestamp": 1750693989664061
  },
  {
    "event_message": "Thumbnail uploaded successfully: https://mpmkbtsufihzdelrlszs.supabase.co/storage/v1/object/public/receipt_images/thumbnails/4ac838dc-bb4a-4401-8f0b-bb1d9a674eac_thumb.jpg\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "1cf9ea20-dfe6-4cd8-908b-373f1a6fb316",
    "level": "log",
    "timestamp": 1750693989663806
  },
  {
    "event_message": "Uploading thumbnail to storage path: thumbnails/4ac838dc-bb4a-4401-8f0b-bb1d9a674eac_thumb.jpg\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "b80cd794-5e48-47bf-929f-0735b1875b8e",
    "level": "log",
    "timestamp": 1750693984671859
  },
  {
    "event_message": "[THUMBNAIL] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Uploading thumbnail to thumbnails/4ac838dc-bb4a-4401-8f0b-bb1d9a674eac_thumb.jpg\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "6f3c6948-d64b-460e-8b34-61f85476b2ca",
    "level": "log",
    "timestamp": 1750693984671572
  },
  {
    "event_message": "Thumbnail encoded as JPEG, size: 25525 bytes\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "4810e288-20ec-4a53-860d-febfc350e8f2",
    "level": "log",
    "timestamp": 1750693984671391
  },
  {
    "event_message": "Resized dimensions: 300x424\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "10e139e9-b882-4fcc-94e3-6b8bd5c91be4",
    "level": "log",
    "timestamp": 1750693984671131
  },
  {
    "event_message": "Original dimensions: 815x1152\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "f6521802-eab1-48a6-9da7-74946475c27a",
    "level": "log",
    "timestamp": 1750693984670879
  },
  {
    "event_message": "Decoding image for thumbnail...\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "f735845d-3912-42f6-a48a-1dbe9205fcf5",
    "level": "log",
    "timestamp": 1750693984670711
  },
  {
    "event_message": "[THUMBNAIL] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Starting thumbnail generation\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "f73301a2-3747-48d9-b363-1beac890b2d5",
    "level": "log",
    "timestamp": 1750693984670539
  },
  {
    "event_message": "[OPTIMIZE] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Optimized image size: 158835 bytes (-6% reduction)\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "042131e2-662f-460b-81ea-d06c41085a95",
    "level": "log",
    "timestamp": 1750693984670375
  },
  {
    "event_message": "[OPTIMIZE] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Slightly reduced dimensions to 815x1152 for optimization\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "8ad99a6d-5497-4f88-9562-d52f7ce98248",
    "level": "log",
    "timestamp": 1750693984670120
  },
  {
    "event_message": "[OPTIMIZE] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Original dimensions: 905x1280\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "0455678a-7837-4fa5-84af-2621ccc443a1",
    "level": "log",
    "timestamp": 1750693984669884
  },
  {
    "event_message": "[OPTIMIZE] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Optimizing image despite being within size limits (forced optimization)\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "81c0bb47-b29a-46ee-8ea5-36cb2f94ee57",
    "level": "log",
    "timestamp": 1750693984669558
  },
  {
    "event_message": "[OPTIMIZE] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Original image size: 149966 bytes\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "0b9bdd2b-6997-43e6-999e-810550846322",
    "level": "log",
    "timestamp": 1750693984669287
  },
  {
    "event_message": "[OPTIMIZE] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Starting image optimization for AI processing\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "77cdb6c2-8251-42bc-a21a-361d3a2e044c",
    "level": "log",
    "timestamp": 1750693984669059
  },
  {
    "event_message": "[FETCH] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Image fetched successfully, size: 149966 bytes\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "e6d95964-d34b-4372-942a-6a3a100f6c60",
    "level": "log",
    "timestamp": 1750693984668799
  },
  {
    "event_message": "Fetching image from URL: https://mpmkbtsufihzdelrlszs.supabase.co/storage/v1/object/public/receipt_images/feecc208-3282-49d2-8e15-0c64b0ee4abb/1750693981419_ruw43igfnn9.jpeg\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "c5c75018-15ff-4b3f-ac3f-787541e12061",
    "level": "log",
    "timestamp": 1750693984667328
  },
  {
    "event_message": "[FETCH] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Fetching receipt image\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "482f9b19-1816-4648-a755-3c821d7ea0fa",
    "level": "log",
    "timestamp": 1750693984667153
  },
  {
    "event_message": "[START] (Receipt: 4ac838dc-bb4a-4401-8f0b-bb1d9a674eac) Starting receipt processing\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "42b3e497-78c3-4845-9fe6-a8dc26405e34",
    "level": "log",
    "timestamp": 1750693984665653
  },
  {
    "event_message": "Request data received: {\"receiptId\":\"4ac838dc-bb4a-4401-8f0b-bb1d9a674eac\",\"imageUrl\":\"https://mpmkbtsufihzdelrlszs.supabase.co/storage/v1/object/public/receipt_images/feecc208-3282-49d2-8e15-0c64b0ee4abb/1750693981419_ruw4...\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "1e74b7e3-0d13-4264-b7d4-6c9053fb614d",
    "level": "log",
    "timestamp": 1750693984665325
  },
  {
    "event_message": "API key header present: true\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "859f3ca9-fdba-47ca-813c-e7ead67a63ba",
    "level": "log",
    "timestamp": 1750693984664990
  },
  {
    "event_message": "Authorization header present: true\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "672ab21e-4227-4dda-a4f5-2b6d720aefd8",
    "level": "log",
    "timestamp": 1750693984664725
  },
  {
    "event_message": "Received request to process receipt\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "af23d0c1-1641-4be3-abc4-e57743907e94",
    "level": "log",
    "timestamp": 1750693984664468
  },
  {
    "event_message": "Listening on http://localhost:9999/\n",
    "event_type": "Log",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "61b1a0eb-a155-4c2d-8d0c-b21b2759a037",
    "level": "log",
    "timestamp": 1750693984664161
  },
  {
    "event_message": "booted (time: 40ms)",
    "event_type": "Boot",
    "function_id": "bd9a324b-67a1-42b9-b47f-ddbb7df4b433",
    "id": "eb4505e8-c2d3-4fab-a396-aabbf7f4541c",
    "level": "log",
    "timestamp": 1750693984662745
  }
]