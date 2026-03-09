import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createRetiredApiAliasHandler } from '../../supabase/functions/_shared/retired-api-alias.ts';

const retiredAliases = ['api-external', 'mataresit-api'] as const;
const configToml = readFileSync(new URL('../../supabase/functions/config.toml', import.meta.url), 'utf8');

describe('retired API aliases', () => {
  for (const aliasName of retiredAliases) {
    it(`returns a deprecation response without treating ${aliasName} as an authenticated API`, async () => {
      const handler = createRetiredApiAliasHandler(aliasName);
      const response = handler(new Request(`https://example.com/functions/v1/${aliasName}/api/v1/health`));
      const payload = await response.json();

      assert.equal(response.status, 410);
      assert.match(response.headers.get('Content-Type') ?? '', /application\/json/);
      assert.equal(response.headers.get('Deprecation'), 'true');
      assert.deepEqual(payload, {
        success: false,
        error: {
          code: 'ENDPOINT_DEPRECATED',
          message: `The ${aliasName} alias has been retired. Use external-api instead.`,
          status: 410,
        },
        replacement: {
          function: 'external-api',
          path: '/functions/v1/external-api/api/v1',
        },
      });
    });

    it(`ignores fake credentials for ${aliasName} and does not echo them back`, async () => {
      const handler = createRetiredApiAliasHandler(aliasName);
      const fakeApiKey = 'mk_test_fake_credential';
      const fakeToken = 'Bearer fake-token';
      const response = handler(new Request(`https://example.com/functions/v1/${aliasName}/api/v1/receipts`, {
        headers: {
          Authorization: fakeToken,
          'X-API-Key': fakeApiKey,
        },
      }));
      const bodyText = await response.text();

      assert.equal(response.status, 410);
      assert.equal(bodyText.includes(fakeApiKey), false);
      assert.equal(bodyText.includes(fakeToken), false);
      assert.equal(bodyText.includes('test-user-id'), false);
      assert.equal(bodyText.includes('scopes'), false);
    });

    it(`keeps preflight responses minimal for ${aliasName}`, () => {
      const handler = createRetiredApiAliasHandler(aliasName);
      const response = handler(new Request(`https://example.com/functions/v1/${aliasName}`, {
        method: 'OPTIONS',
      }));

      assert.equal(response.status, 204);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
      assert.equal(response.headers.get('Content-Type'), null);
    });

    it(`documents ${aliasName} as a retired alias in config`, () => {
      const sectionPattern = new RegExp(`\\[${aliasName}\\]\\s*\\nverify_jwt = false`);
      assert.match(configToml, sectionPattern);
      assert.equal(
        configToml.includes('Retired alias that only returns a 410 deprecation response; use external-api instead'),
        true,
      );
    });
  }
});