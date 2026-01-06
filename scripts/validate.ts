/**
 * Validate all JSON files against their schemas
 */

import * as fs from "fs/promises";
import * as path from "path";

const ROOT_DIR = path.join(import.meta.dirname, "..");
const PROVIDERS_DIR = path.join(ROOT_DIR, "providers");
const ALIASES_DIR = path.join(ROOT_DIR, "aliases");

interface ValidationResult {
  file: string;
  valid: boolean;
  errors: string[];
}

async function validateProviders(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    const files = await fs.readdir(PROVIDERS_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    for (const file of jsonFiles) {
      const filePath = path.join(PROVIDERS_DIR, file);
      const result: ValidationResult = {
        file: `providers/${file}`,
        valid: true,
        errors: [],
      };

      try {
        const content = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(content);

        // Basic validation
        if (!data.provider?.id) {
          result.errors.push("Missing provider.id");
        }
        if (!data.provider?.name) {
          result.errors.push("Missing provider.name");
        }
        if (!Array.isArray(data.models)) {
          result.errors.push("models must be an array");
        } else {
          for (let i = 0; i < data.models.length; i++) {
            const model = data.models[i];
            if (!model.id) {
              result.errors.push(`models[${i}]: missing id`);
            }
            if (!model.name) {
              result.errors.push(`models[${i}]: missing name`);
            }
            if (model.tier && !["mini", "pro", "max"].includes(model.tier)) {
              result.errors.push(
                `models[${i}]: invalid tier "${model.tier}"`
              );
            }
          }
        }
        if (!data.updated_at) {
          result.errors.push("Missing updated_at");
        }

        result.valid = result.errors.length === 0;
      } catch (e) {
        result.valid = false;
        result.errors.push(`Parse error: ${e}`);
      }

      results.push(result);
    }
  } catch (e) {
    // Directory might not exist yet
    console.log("⚠️  providers/ directory not found");
  }

  return results;
}

async function validateAliases(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    const files = await fs.readdir(ALIASES_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    for (const file of jsonFiles) {
      const filePath = path.join(ALIASES_DIR, file);
      const result: ValidationResult = {
        file: `aliases/${file}`,
        valid: true,
        errors: [],
      };

      try {
        const content = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(content);

        // Basic validation
        if (!data.provider) {
          result.errors.push("Missing provider");
        }
        if (!data.aliases || typeof data.aliases !== "object") {
          result.errors.push("aliases must be an object");
        } else {
          for (const [alias, mapping] of Object.entries(data.aliases)) {
            if (typeof mapping !== "object" || mapping === null) {
              result.errors.push(`aliases.${alias}: must be an object`);
              continue;
            }
            const m = mapping as Record<string, unknown>;
            if (!m.actual) {
              result.errors.push(`aliases.${alias}: missing actual`);
            }
          }
        }

        result.valid = result.errors.length === 0;
      } catch (e) {
        result.valid = false;
        result.errors.push(`Parse error: ${e}`);
      }

      results.push(result);
    }
  } catch (e) {
    // Directory might not exist yet
    console.log("⚠️  aliases/ directory not found");
  }

  return results;
}

async function validateIndex(): Promise<ValidationResult> {
  const indexPath = path.join(ROOT_DIR, "index.json");
  const result: ValidationResult = {
    file: "index.json",
    valid: true,
    errors: [],
  };

  try {
    const content = await fs.readFile(indexPath, "utf-8");
    const data = JSON.parse(content);

    if (!data.version) {
      result.errors.push("Missing version");
    }
    if (!data.updated_at) {
      result.errors.push("Missing updated_at");
    }
    if (!Array.isArray(data.providers)) {
      result.errors.push("providers must be an array");
    }

    result.valid = result.errors.length === 0;
  } catch (e) {
    result.valid = false;
    result.errors.push(`Parse error: ${e}`);
  }

  return result;
}

async function main() {
  console.log("🔍 Validating model data...\n");

  const providerResults = await validateProviders();
  const aliasResults = await validateAliases();
  const indexResult = await validateIndex();

  const allResults = [...providerResults, ...aliasResults, indexResult];

  let hasErrors = false;

  for (const result of allResults) {
    if (result.valid) {
      console.log(`✅ ${result.file}`);
    } else {
      hasErrors = true;
      console.log(`❌ ${result.file}`);
      for (const error of result.errors) {
        console.log(`   - ${error}`);
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total files: ${allResults.length}`);
  console.log(`   Valid: ${allResults.filter((r) => r.valid).length}`);
  console.log(`   Invalid: ${allResults.filter((r) => !r.valid).length}`);

  if (hasErrors) {
    process.exit(1);
  }
}

main().catch(console.error);
