import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createRetiredDebugEndpointHandler } from '../../supabase/functions/_shared/retired-debug-endpoint.ts';

const retiredEndpoints = ['public-api-test', 'test-simple'] as const;
const configToml = readFileSync(new URL('../../supabase/functions/config.toml', import.meta.url), 'utf8');

describe('retired debug endpoints', () => {
  for (const endpointName of retiredEndpoints) {
    it(`returns a safe retired response without auth for ${endpointName}`, async () => {
      const handler = createRetiredDebugEndpointHandler(endpointName);
      const response = handler(new Request(`https://example.com/functions/v1/${endpointName}`));
      const payload = await response.json();

      assert.equal(response.status, 410);
      assert.match(response.headers.get('Content-Type') ?? '', /application\/json/);
      assert.equal(response.headers.get('X-Function-Auth'), null);
      assert.equal(response.headers.get('X-JWT-Verify'), null);
      assert.deepEqual(payload, {
        success: false,
        error: {
          code: 'ENDPOINT_RETIRED',
          message: 'This debug endpoint has been retired and is no longer available.',
          status: 410,
        },
      });
    });

    it(`ignores fake credentials for ${endpointName} and does not leak them`, async () => {
      const handler = createRetiredDebugEndpointHandler(endpointName);
      const fakeApiKey = 'mk_test_fake_credential';
      const fakeToken = 'Bearer fake-token';
      const response = handler(new Request(`https://example.com/functions/v1/${endpointName}/api/v1/health`, {
        headers: {
          Authorization: fakeToken,
          'X-API-Key': fakeApiKey,
        },
      }));
      const bodyText = await response.text();

      assert.equal(response.status, 410);
      assert.equal(bodyText.includes(fakeApiKey), false);
      assert.equal(bodyText.includes(fakeToken), false);
      assert.equal(bodyText.includes('bypass'), false);
      assert.equal(bodyText.includes('headers'), false);
    });

    it(`keeps preflight responses minimal for ${endpointName}`, () => {
      const handler = createRetiredDebugEndpointHandler(endpointName);
      const response = handler(new Request(`https://example.com/functions/v1/${endpointName}`, {
        method: 'OPTIONS',
      }));

      assert.equal(response.status, 204);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
      assert.equal(response.headers.get('X-Function-Auth'), null);
      assert.equal(response.headers.get('X-Supabase-Auth'), null);
    });

    it(`keeps verify_jwt enabled in config for ${endpointName}`, () => {
      const sectionPattern = new RegExp(`\\[${endpointName}\\]\\s*\\nverify_jwt = true`);
      assert.match(configToml, sectionPattern);
    });
  }
});