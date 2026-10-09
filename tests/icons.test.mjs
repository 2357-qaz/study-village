import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadLucide, referencedIcons, buildSource} from '../tools/build-icons.mjs';

const lucide = loadLucide();
const subset = readFileSync(new URL('../dist/vendor/lucide-icons.js', import.meta.url), 'utf8');

test('所有引用的图标都存在于 Lucide 中', () => {
  const pascal = n => n.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
  assert.deepEqual(
    referencedIcons().filter(n => !lucide.icons[pascal(n)]),
    []
  );
});

test('图标子集与源码同步（否则运行 node tools/build-icons.mjs）', () => {
  assert.equal(subset, buildSource(lucide));
});

test('子集包含每个引用的图标', () => {
  const icons = JSON.parse(subset.match(/const ICONS = (\{.*\});/)[1]);
  assert.deepEqual(
    referencedIcons().filter(n => !icons[n]),
    []
  );
});
