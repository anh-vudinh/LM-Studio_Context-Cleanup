import { PluginContext } from "@lmstudio/sdk";
import { configSchematics } from "./config";
import { promptPreprocessor } from "./promptPreprocessor";

export async function main(context: PluginContext) {

  context.withConfigSchematics(configSchematics);
  context.withPromptPreprocessor(promptPreprocessor);

  // Use console.log instead of context.log
  console.log("Context Cleanup Plugin initialized");
}
