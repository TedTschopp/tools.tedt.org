import tools from './catalog.json';

export type CatalogTool = (typeof tools)[number];

const standaloneSlugs = new Set([
  'algorithmic-art-kintsugi-currents',
  'name-generator-research',
  'onboard',
  'onboard-pro',
  'start-page',
  'vector-trace',
]);
const prototypes = tools.filter(tool => tool.status === 'prototype');

export const workInProgressSections = [
  {
    id: 'standalone-entries',
    title: 'Other standalone entries',
    tools: prototypes.filter(tool => standaloneSlugs.has(tool.slug)),
  },
  {
    id: 'mastodon-demos',
    title: 'Mastodon demos',
    tools: prototypes.filter(tool => tool.sourcePath.startsWith('tool-src/tools/mastodon/')),
  },
  {
    id: 'wizardawn-tools',
    title: 'Wizardawn tools',
    tools: prototypes.filter(tool => tool.sourcePath.startsWith('tool-src/tools/osr-tools/')),
  },
];

export const workInProgressTools = workInProgressSections.flatMap(section => section.tools);
export const workInProgressSectionBySlug = new Map(
  workInProgressSections.flatMap(section => section.tools.map(tool => [tool.slug, section.id] as const)),
);
export const homepageTools = tools.filter(tool => !workInProgressSectionBySlug.has(tool.slug));
