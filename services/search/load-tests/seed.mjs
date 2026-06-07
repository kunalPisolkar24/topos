import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ES_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const INDEX = process.env.ELASTICSEARCH_INDEX || 'posts';
const COUNT = parseInt(process.env.SEED_POST_COUNT || '5000', 10);
const OUTPUT_DIR = process.env.SEED_OUTPUT_DIR || '/load-tests/seed_data';

const TOPICS = [
  { topic: 'JavaScript Programming', words: ['javascript', 'js', 'ecmascript', 'node', 'deno', 'bun', 'typescript', 'async', 'promise', 'callback', 'closure', 'prototype', 'event', 'loop', 'module'] },
  { topic: 'Web Development', words: ['react', 'vue', 'angular', 'svelte', 'nextjs', 'nuxt', 'remix', 'css', 'html', 'dom', 'frontend', 'backend', 'fullstack', 'api', 'rest'] },
  { topic: 'DevOps & Cloud', words: ['docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins', 'github', 'actions', 'ci', 'cd', 'deploy', 'cloud', 'aws', 'azure', 'gcp'] },
  { topic: 'Databases', words: ['postgresql', 'postgres', 'mongodb', 'redis', 'elasticsearch', 'sql', 'nosql', 'query', 'index', 'schema', 'migration', 'orm', 'acid', 'shard'] },
  { topic: 'System Design', words: ['microservice', 'monolith', 'event', 'stream', 'queue', 'kafka', 'rabbitmq', 'cache', 'cdn', 'load', 'balancer', 'proxy', 'gateway', 'mesh'] },
  { topic: 'Machine Learning', words: ['machine', 'learning', 'deep', 'neural', 'network', 'tensorflow', 'pytorch', 'model', 'train', 'inference', 'nlp', 'vision', 'gpu', 'llm'] },
  { topic: 'Security', words: ['auth', 'oauth', 'jwt', 'token', 'cors', 'csrf', 'xss', 'sql', 'injection', 'encrypt', 'hash', 'certificate', 'ssl', 'tls', 'zero', 'trust'] },
  { topic: 'Testing', words: ['unit', 'integration', 'e2e', 'test', 'mock', 'stub', 'fixture', 'coverage', 'jest', 'vitest', 'mocha', 'cypress', 'playwright', 'assert'] },
  { topic: 'Performance', words: ['optimize', 'perform', 'latency', 'throughput', 'benchmark', 'profile', 'monitor', 'metrics', 'trace', 'span', 'otel', 'prometheus', 'grafana'] },
  { topic: 'Architecture', words: ['clean', 'hexagonal', 'onion', 'layered', 'solid', 'domain', 'driven', 'cqrs', 'event', 'sourcing', 'repository', 'factory', 'di', 'ioc'] },
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function* wordGen(topic) {
  const pool = topic.words;
  const count = randomInt(1, 4);
  const used = new Set();
  for (let i = 0; i < count; i++) {
    let w = pickRandom(pool);
    if (used.has(w)) { w = w + '_' + randomInt(1, 99); }
    used.add(w);
    yield w;
  }
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function generatePost(id, topic) {
  const words = [...wordGen(topic)];
  const titleWords = words.slice(0, Math.min(words.length, 3));
  const title = titleWords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' ' + pickRandom(['Guide', 'Deep Dive', 'Overview', 'Primer', 'Handbook', 'Crash Course', 'Best Practices', 'Tips', 'Tutorial', 'Fundamentals']);
  const bodyWords = [];
  const wc = randomInt(30, 80);
  for (let i = 0; i < wc; i++) {
    bodyWords.push(pickRandom(topic.words.concat(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'for', 'with', 'about', 'between', 'through', 'during', 'before', 'after', 'above', 'below', 'from', 'this', 'that', 'these', 'those', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same', 'very', 'just', 'also', 'well', 'here', 'there', 'now', 'then'])));
  }
  const body = bodyWords.join(' ') + '.';
  const createdAt = new Date(Date.now() - randomInt(0, 365 * 2) * 86400000).toISOString();
  const slug = slugify(title) + '-' + id;
  const summary = body.slice(0, randomInt(80, 200)) + '...';

  return {
    postId: `post_${id}`,
    title,
    body,
    imageUrl: Math.random() > 0.3 ? `https://images.example.com/${id}.jpg` : null,
    createdAt,
    slug,
    summary,
  };
}

async function ensureIndex() {
  const existsResp = await fetch(`${ES_URL}/${INDEX}`);
  if (existsResp.ok) return;

  const resp = await fetch(`${ES_URL}/${INDEX}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: {
        properties: {
          postId: { type: 'keyword' },
          title: { type: 'text' },
          body: { type: 'text' },
          imageUrl: { type: 'keyword' },
          createdAt: { type: 'date' },
          slug: { type: 'keyword' },
          summary: { type: 'text' },
        },
      },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to create index: ${resp.status} ${text}`);
  }
  console.log(`Created index "${INDEX}"`);
}

function buildNdc(ndjson) {
  return ndjson.map(l => JSON.stringify(l)).join('\n') + '\n';
}

async function bulkIndex(posts) {
  const ndjson = [];
  for (const post of posts) {
    ndjson.push({ index: { _index: INDEX, _id: post.postId } });
    ndjson.push(post);
  }
  const body = buildNdc(ndjson);

  const resp = await fetch(`${ES_URL}/_bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-ndjson' },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Bulk index failed: ${resp.status} ${text}`);
  }

  const result = await resp.json();
  if (result.errors) {
    const errors = result.items.filter(i => i.index?.error).map(i => ({ id: i.index._id, reason: i.index.error.reason }));
    console.error('Bulk partial errors:', errors.slice(0, 10));
    throw new Error(`Bulk index had ${errors.length} errors`);
  }

  console.log(`Indexed ${posts.length} posts (took ${result.took}ms)`);
}

function generateQueries(posts) {
  const queries = [];
  const groups = { short: [], phrase: [], title: [], partial: [], no_match: [] };

  const seen = new Set();

  for (const post of posts) {
    if (seen.size < posts.length * 0.3) {
      const titleWords = post.title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      for (const w of titleWords) {
        if (seen.has(w) || w.length < 3) continue;
        seen.add(w);
        groups.short.push({ query: w, kind: 'short', matchCount: -1 });
        queries.push({ query: w, kind: 'short' });
        break;
      }
    }
  }

  for (const post of posts.slice(0, Math.floor(posts.length * 0.25))) {
    if (Math.random() > 0.5) continue;
    const words = post.title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length >= 2) {
      const phrase = words.slice(0, Math.min(words.length, 4)).join(' ');
      if (seen.has(phrase)) continue;
      seen.add(phrase);
      groups.phrase.push({ query: phrase, kind: 'phrase', matchCount: -1 });
      queries.push({ query: phrase, kind: 'phrase' });
    }
  }

  for (const post of posts.slice(0, Math.floor(posts.length * 0.2))) {
    const title = post.title.toLowerCase();
    if (seen.has(title)) continue;
    seen.add(title);
    groups.title.push({ query: title, kind: 'title', matchCount: -1 });
    queries.push({ query: title, kind: 'title' });
  }

  for (const post of posts.slice(0, Math.floor(posts.length * 0.15))) {
    const titleWords = post.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (titleWords.length < 2) continue;
    const partial = titleWords[0].slice(0, Math.max(3, titleWords[0].length - 2));
    if (seen.has(partial) || partial.length < 3) continue;
    seen.add(partial);
    groups.partial.push({ query: partial, kind: 'partial', matchCount: -1 });
    queries.push({ query: partial, kind: 'partial' });
  }

  const noMatchTerms = ['xyznonexistentterm', 'zzzrandomquery', 'qwertyuioplkmjnhbgvfcdxsza', 'nonexistentarticle', 'thisisnotavalidsearch'];
  for (const term of noMatchTerms) {
    if (seen.has(term)) continue;
    seen.add(term);
    groups.no_match.push({ query: term, kind: 'no_match', matchCount: 0 });
    queries.push({ query: term, kind: 'no_match' });
  }

  return { queries, groups };
}

async function main() {
  console.log(`Seeding ${COUNT} posts into ${INDEX} at ${ES_URL}`);

  await ensureIndex();

  const batchSize = 500;
  const posts = [];
  const queryCandidates = [];

  for (let i = 0; i < COUNT; i++) {
    const topic = TOPICS[i % TOPICS.length];
    const post = generatePost(i, topic);
    posts.push(post);
    queryCandidates.push(post);

    if (posts.length >= batchSize || i === COUNT - 1) {
      await bulkIndex(posts);
      posts.length = 0;
    }
  }

  const { queries, groups } = generateQueries(queryCandidates);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(resolve(OUTPUT_DIR, 'post_ids.json'), JSON.stringify(queryCandidates.map(p => p.postId)), 'utf8');
  writeFileSync(resolve(OUTPUT_DIR, 'queries.json'), JSON.stringify(queries), 'utf8');
  writeFileSync(resolve(OUTPUT_DIR, 'query_groups.json'), JSON.stringify(groups), 'utf8');

  console.log(`Seed data written to ${OUTPUT_DIR}`);
  console.log(`  post_ids.json: ${queryCandidates.length} ids`);
  console.log(`  queries.json: ${queries.length} queries`);
  console.log(`  query_groups.json: ${Object.values(groups).reduce((s, arr) => s + arr.length, 0)} grouped queries`);
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
