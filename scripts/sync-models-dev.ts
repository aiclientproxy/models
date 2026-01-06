/**
 * Sync models from models.dev API
 *
 * This script fetches model data from https://models.dev/api.json
 * and converts it to our JSON format, saving to providers/*.json
 */

import * as fs from "fs/promises";
import * as path from "path";

const MODELS_DEV_API = "https://models.dev/api.json";
const PROVIDERS_DIR = path.join(import.meta.dirname, "..", "providers");
const INDEX_FILE = path.join(import.meta.dirname, "..", "index.json");

// Types for models.dev API response
interface ModelsDevCost {
  input?: number;
  output?: number;
  cache_read?: number;
  cache_write?: number;
}

interface ModelsDevLimit {
  context?: number;
  output?: number;
}

interface ModelsDevModalities {
  input?: string[];
  output?: string[];
}

interface ModelsDevModel {
  id: string;
  name: string;
  family?: string;
  release_date?: string;
  attachment?: boolean;
  reasoning?: boolean;
  temperature?: boolean;
  tool_call?: boolean;
  cost?: ModelsDevCost;
  limit?: ModelsDevLimit;
  modalities?: ModelsDevModalities;
  experimental?: boolean;
  status?: string;
}

interface ModelsDevProvider {
  id: string;
  name: string;
  api?: string;
  npm?: string;
  models: Record<string, ModelsDevModel>;
}

// Our internal types
interface Model {
  id: string;
  name: string;
  family?: string;
  tier: "mini" | "pro" | "max";
  capabilities: {
    vision: boolean;
    tools: boolean;
    streaming: boolean;
    json_mode: boolean;
    function_calling: boolean;
    reasoning: boolean;
  };
  pricing?: {
    input?: number;
    output?: number;
    cache_read?: number;
    cache_write?: number;
    currency: string;
  };
  limits?: {
    context?: number;
    max_output?: number;
  };
  status: string;
  release_date?: string;
  is_latest: boolean;
  description?: string;
  description_zh?: string;
}

interface ProviderData {
  $schema: string;
  provider: {
    id: string;
    name: string;
    website?: string;
    api_docs?: string;
  };
  models: Model[];
  updated_at: string;
  source: string;
}

interface IndexData {
  version: string;
  updated_at: string;
  providers: string[];
  total_models: number;
  sources: {
    models_dev: string;
    manual: string[];
  };
}

// Infer model tier from ID and name
function inferTier(modelId: string, modelName: string): "mini" | "pro" | "max" {
  const id = modelId.toLowerCase();
  const name = modelName.toLowerCase();

  // Max tier patterns
  const maxPatterns = [
    "opus",
    "gpt-4o",
    "gpt-4-turbo",
    "gemini-2.5-pro",
    "gemini-ultra",
    "claude-3-opus",
    "qwen-max",
    "glm-4-plus",
    "deepseek-v3",
    "o1-pro",
    "o1-preview",
    "o3",
  ];
  for (const pattern of maxPatterns) {
    if (id.includes(pattern) || name.includes(pattern)) {
      return "max";
    }
  }

  // Mini tier patterns
  const miniPatterns = [
    "mini",
    "nano",
    "lite",
    "flash",
    "haiku",
    "gpt-4o-mini",
    "gemini-flash",
    "qwen-turbo",
    "glm-4-flash",
  ];
  for (const pattern of miniPatterns) {
    if (id.includes(pattern) || name.includes(pattern)) {
      return "mini";
    }
  }

  return "pro";
}

// Convert models.dev model to our format
function convertModel(model: ModelsDevModel): Model {
  const supportsVision =
    model.modalities?.input?.some((m) => m === "image" || m === "video") ||
    model.attachment ||
    false;

  return {
    id: model.id,
    name: model.name,
    family: model.family,
    tier: inferTier(model.id, model.name),
    capabilities: {
      vision: supportsVision,
      tools: model.tool_call || false,
      streaming: true,
      json_mode: true,
      function_calling: model.tool_call || false,
      reasoning: model.reasoning || false,
    },
    pricing: model.cost
      ? {
          input: model.cost.input,
          output: model.cost.output,
          cache_read: model.cost.cache_read,
          cache_write: model.cost.cache_write,
          currency: "USD",
        }
      : undefined,
    limits:
      model.limit?.context || model.limit?.output
        ? {
            context: model.limit.context,
            max_output: model.limit.output,
          }
        : undefined,
    status: model.status || "active",
    release_date: model.release_date,
    is_latest: model.id.includes("latest"),
  };
}

// Load existing provider data to preserve manual fields
async function loadExistingProvider(
  providerId: string
): Promise<ProviderData | null> {
  const filePath = path.join(PROVIDERS_DIR, `${providerId}.json`);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Merge new data with existing, preserving manual fields
function mergeModels(newModels: Model[], existingModels: Model[]): Model[] {
  const existingMap = new Map(existingModels.map((m) => [m.id, m]));

  return newModels.map((newModel) => {
    const existing = existingMap.get(newModel.id);
    if (existing) {
      // Preserve manual fields like description_zh
      return {
        ...newModel,
        description: existing.description || newModel.description,
        description_zh: existing.description_zh,
      };
    }
    return newModel;
  });
}

async function main() {
  console.log("🔄 Fetching models from models.dev...");

  const response = await fetch(MODELS_DEV_API);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }

  const data: Record<string, ModelsDevProvider> = await response.json();
  console.log(`📦 Found ${Object.keys(data).length} providers`);

  // Ensure providers directory exists
  await fs.mkdir(PROVIDERS_DIR, { recursive: true });

  const providerIds: string[] = [];
  let totalModels = 0;

  for (const [providerId, provider] of Object.entries(data)) {
    const models = Object.values(provider.models).map(convertModel);

    if (models.length === 0) {
      console.log(`⏭️  Skipping ${providerId} (no models)`);
      continue;
    }

    // Load existing data to preserve manual fields
    const existing = await loadExistingProvider(providerId);
    const mergedModels = existing
      ? mergeModels(models, existing.models)
      : models;

    // Sort models by release date (newest first), then by name
    mergedModels.sort((a, b) => {
      if (a.release_date && b.release_date) {
        return b.release_date.localeCompare(a.release_date);
      }
      if (a.release_date) return -1;
      if (b.release_date) return 1;
      return a.name.localeCompare(b.name);
    });

    const providerData: ProviderData = {
      $schema: "../schema/model.schema.json",
      provider: {
        id: providerId,
        name: provider.name,
      },
      models: mergedModels,
      updated_at: new Date().toISOString(),
      source: "models.dev",
    };

    const filePath = path.join(PROVIDERS_DIR, `${providerId}.json`);
    await fs.writeFile(filePath, JSON.stringify(providerData, null, 2) + "\n");

    providerIds.push(providerId);
    totalModels += models.length;
    console.log(`✅ ${providerId}: ${models.length} models`);
  }

  // Update index.json
  const existingIndex = await loadExistingIndex();
  const indexData: IndexData = {
    version: "1.0.0",
    updated_at: new Date().toISOString(),
    providers: providerIds.sort(),
    total_models: totalModels,
    sources: {
      models_dev: MODELS_DEV_API,
      manual: existingIndex?.sources?.manual || [],
    },
  };

  await fs.writeFile(INDEX_FILE, JSON.stringify(indexData, null, 2) + "\n");

  console.log(`\n📊 Summary:`);
  console.log(`   Providers: ${providerIds.length}`);
  console.log(`   Total models: ${totalModels}`);
  console.log(`   Index updated: ${INDEX_FILE}`);
}

async function loadExistingIndex(): Promise<IndexData | null> {
  try {
    const content = await fs.readFile(INDEX_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

main().catch(console.error);
