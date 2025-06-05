## 📌 **Master Receipt Processing Implementation Plan**

### **1. Data Validation & Preprocessing**
- **Audit and Cleanse `receipts_data.json`**:
  - Validate required fields: `merchant`, `date`, `total`, `currency`, `payment_method`.
  - Normalize date format to `YYYY-MM-DD`; reject future dates > 1 year.
  - Ensure numeric fields (`total`, `tax`) are valid.
  - Normalize currencies to uppercase (`MYR`, `USD`).
  - Assign defaults:
    - `payment_method`: `"Unknown"` if missing.
    - `currency`: `"MYR"` unless prefixed with `$`.

- **Standardize Key Fields**:
  - **Merchant Name Normalization**: Remove line breaks, unify casing, trim extra spaces. Map known aliases.
  - **Payment Method Normalization**: Map variations (e.g., `MASTERCARD`, `MASTER`, `ATM CARD`) to standardized terms.

---

### **2. Code Enhancements in `index.ts`**

- **Local Preprocessing**:
  ```ts
  function normalizeMerchant(name: string): string {
    return name.replace(/\s+/g, ' ').replace(/\n/g, ' ').trim().toUpperCase();
  }

  function normalizePaymentMethod(method: string | null): string {
    const map = {
      master: 'Mastercard',
      mastercard: 'Mastercard',
      visa: 'Visa',
      'debit card': 'Debit Card',
      'atm card': 'Debit Card',
      cash: 'Cash'
    };
    if (!method) return 'Unknown';
    const key = method.toLowerCase();
    return map[key] || 'Unknown';
  }
  ```

- **Date Validation**:
  Reject invalid formats and reset future dates to today.

- **Currency Conversion (USD to MYR)**:
  ```ts
  if (result.currency === 'USD') {
    result.total *= 4.75; // Use live API in prod
    result.currency = 'MYR';
  }
  ```

---

### **3. Prompt Engineering for AI Enhancement**

- Add few-shot examples from real receipts to your prompt.
- Update instructions:
  - Normalize merchant names and payment methods.
  - Predict categories from keywords (e.g., `'PETRONAS' → Transportation`).
  - Flag currency inconsistencies.
  - Validate total and date formats.

---

### **4. Database Integration**

- **Supabase Table Enhancements**:
  ```sql
  ALTER TABLE receipts
  ADD COLUMN normalized_merchant TEXT,
  ADD COLUMN currency_converted BOOLEAN DEFAULT FALSE,
  ADD COLUMN predicted_category TEXT;
  ```

- **Confidence Score Table**:
  Save AI field confidence values for auditing.

- **Create Reporting Views**:
  ```sql
  CREATE VIEW monthly_expenses AS
  SELECT normalized_merchant, SUM(total) AS total_spent, currency
  FROM receipts
  GROUP BY normalized_merchant, currency;
  ```

---

### **5. Batch & Parallel Processing**

- Implement batch support in `processReceiptImage()`:
  ```ts
  const results = await Promise.all(receipts.map(processSingleReceipt));
  ```

- Cache static mappings (e.g., merchant aliases) to improve speed.

---

### **6. Validation, Discrepancy Detection & Error Handling**

- **Discrepancy Detection**:
  - Compare AI-enhanced vs. Textract results for total and merchant.
  - Flag near-identical records as potential duplicates:
    ```ts
    if (Math.abs(a.total - b.total) < 0.1 && a.merchant === b.merchant && a.date === b.date) {
      discrepancies.push("Potential duplicate");
    }
    ```

- **Robust Error Logging**:
  Use `ProcessingLogger` for structured logs including timestamps and error codes.

---

### **7. Testing & Monitoring**

- **Automated Tests**:
  - Merchant normalization.
  - Currency conversion.
  - Edge cases (e.g., missing payment method, date in 2099).

- **Staging Deployment**:
  - Run against historical `receipts_data.json`.
  - Use query:
    ```sql
    SELECT COUNT(*) FROM receipts WHERE normalized_merchant IS NOT NULL;
    ```

- **Production Rollout**:
  - Blue/green deploy.
  - Run parallel comparison mode (`compareWithAlternative: true`) for 24 hrs.

---

### **8. Post-Deployment & Future Enhancements**

- **Currency Sync Job**:
  Weekly update via Supabase Edge Function for exchange rates.

- **AI Expansion**:
  - Predict missing fields (e.g., payment method) using trained models.
  - Add line item extraction and categorization using vision + NLP.

- **Visual Reporting Dashboard**:
  - Build simple dashboard showing monthly expenses, merchant trends, confidence scores.

---

Let me know if you want this exported into a Markdown or project-ready task list format!