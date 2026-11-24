import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(CURRENT_DIR, '../data');
const STORE_PATH = path.join(DATA_DIR, 'source-order.json');

let store = null;
let writeQueue = Promise.resolve();

function createEmptyStore() {
  return {
    version: 1,
    keys: [],
  };
}

function validateKeys(keys) {
  if (!Array.isArray(keys)) {
    throw new Error('数据源优先级必须是数组');
  }

  const result = [];
  const seen = new Set();

  for (const value of keys) {
    if (typeof value !== 'string') {
      throw new Error('数据源 key 必须是字符串');
    }

    const key = value.trim();

    if (!key || key.length > 256) {
      throw new Error('数据源 key 不能为空且不能超过 256 个字符');
    }

    if (seen.has(key)) {
      throw new Error(`数据源优先级包含重复 key：${key}`);
    }

    seen.add(key);
    result.push(key);
  }

  return result;
}

async function writeStore(nextStore) {
  const temporaryPath = `${STORE_PATH}.${process.pid}.${randomUUID()}.tmp`;
  const content = `${JSON.stringify(nextStore, null, 2)}\n`;

  try {
    await writeFile(temporaryPath, content, 'utf8');
    await rename(temporaryPath, STORE_PATH);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

function enqueueWrite(operation) {
  const task = writeQueue.then(operation);
  writeQueue = task.catch(() => {});
  return task;
}

export async function initSourceOrderStore() {
  await mkdir(DATA_DIR, { recursive: true });

  let content;

  try {
    content = await readFile(STORE_PATH, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }

    store = createEmptyStore();
    await writeStore(store);

    return {
      count: 0,
      file: STORE_PATH,
    };
  }

  const parsed = JSON.parse(content);

  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.keys)) {
    throw new Error('数据源优先级文件格式不正确，拒绝覆盖');
  }

  store = {
    version: 1,
    keys: validateKeys(parsed.keys),
  };

  return {
    count: store.keys.length,
    file: STORE_PATH,
  };
}

export function getSourceOrder() {
  if (!store) {
    throw new Error('数据源优先级存储尚未初始化');
  }

  return [...store.keys];
}

export async function saveSourceOrder(keys) {
  const validatedKeys = validateKeys(keys);

  return enqueueWrite(async () => {
    if (!store) {
      throw new Error('数据源优先级存储尚未初始化');
    }

    const nextStore = {
      version: 1,
      keys: validatedKeys,
    };

    await writeStore(nextStore);
    store = nextStore;

    return getSourceOrder();
  });
}

export async function ensureSourceOrderKeys(keys) {
  const incomingKeys = [...new Set(
    keys.map(value => {
      if (typeof value !== 'string') {
        throw new Error('数据源 key 必须是字符串');
      }

      const key = value.trim();

      if (!key || key.length > 256) {
        throw new Error('数据源 key 不能为空且不能超过 256 个字符');
      }

      return key;
    }),
  )];

  return enqueueWrite(async () => {
    if (!store) {
      throw new Error('数据源优先级存储尚未初始化');
    }

    const knownKeys = new Set(store.keys);
    const newKeys = incomingKeys.filter(key => !knownKeys.has(key));

    if (newKeys.length === 0) {
      return getSourceOrder();
    }

    const nextStore = {
      version: 1,
      keys: [...store.keys, ...newKeys],
    };

    await writeStore(nextStore);
    store = nextStore;

    return getSourceOrder();
  });
}

export function orderSourcesByPriority(sources) {
  if (!store) {
    throw new Error('数据源优先级存储尚未初始化');
  }

  const priorityMap = new Map(
    store.keys.map((key, index) => [key, index]),
  );

  return sources
    .map((source, index) => ({
      source,
      index,
      priority: priorityMap.get(String(source.key ?? '')) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(item => item.source);
}