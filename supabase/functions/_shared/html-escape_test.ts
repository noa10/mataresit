import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { escapeHtml } from './html-escape.ts';

Deno.test('escapeHtml neutralises markup a profile name could carry', () => {
  assertEquals(
    escapeHtml('</h2><a href="https://evil.example/renew">Renew now</a>'),
    '&lt;/h2&gt;&lt;a href=&quot;https://evil.example/renew&quot;&gt;Renew now&lt;/a&gt;',
  );
});

Deno.test('escapeHtml escapes ampersands before the entities it introduces', () => {
  assertEquals(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
  assertEquals(escapeHtml('&lt;'), '&amp;lt;');
});

Deno.test('escapeHtml escapes single quotes so attribute values cannot break out', () => {
  assertEquals(escapeHtml("O'Brien"), 'O&#39;Brien');
});

Deno.test('escapeHtml leaves ordinary names untouched', () => {
  assertEquals(escapeHtml('Aisyah Rahman'), 'Aisyah Rahman');
  assertEquals(escapeHtml('Nurul Aini binti Zulkifli'), 'Nurul Aini binti Zulkifli');
});

Deno.test('escapeHtml renders null and undefined as an empty string', () => {
  assertEquals(escapeHtml(null), '');
  assertEquals(escapeHtml(undefined), '');
  assertEquals(escapeHtml(''), '');
});
