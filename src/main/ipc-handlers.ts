import { ipcMain, dialog, app, OpenDialogOptions } from "electron";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import util from "util";
import yaml from "js-yaml";

const execPromise = util.promisify(exec);

/**
 * Registers all IPC handlers for the Electron main process.
 * Call this once from main.ts after app is ready.
 */
export function setupIpcHandlers(): void {
  /**
   * Get chart details: values.yaml content, optional schema, chart name
   */
  ipcMain.handle(
    "chart:getDetails",
    async (_event, { path: chartPath }: { path: string }) => {
      try {
        // Read values.yaml content
        const valuesPath = path.join(chartPath, "values.yaml");
        const valuesContent = await fs.readFile(valuesPath, "utf-8");

        // Try reading optional schema JSON
        let schema = {};
        try {
          const schemaPath = path.join(chartPath, "values.schema.json");
          const schemaContent = await fs.readFile(schemaPath, "utf-8");
          schema = JSON.parse(schemaContent);
        } catch {
          console.log("No valid schema file found; continuing without schema.");
        }

        // Read Chart.yaml for chart metadata
        const chartYamlPath = path.join(chartPath, "Chart.yaml");
        const chartYaml = yaml.load(
          await fs.readFile(chartYamlPath, "utf-8")
        ) as { name: string };

        return {
          name: chartYaml.name,
          namespace: "default", // Could come from app settings/config
          values: valuesContent,
          schema,
        };
      } catch (error: any) {
        console.error("Failed to get chart details:", error);
        throw new Error(`Failed to get chart details: ${error.message}`);
      }
    }
  );

  /**
   * Save updated values.yaml file for a chart
   */
  ipcMain.handle(
    "chart:saveValues",
    async (
      _event,
      { chartPath, values }: { chartPath: string; values: string }
    ) => {
      try {
        const valuesPath = path.join(chartPath, "values.yaml");
        await fs.writeFile(valuesPath, values, "utf-8");
        return { success: true };
      } catch (error: any) {
        console.error("Failed to save values.yaml:", error);
        throw new Error(`Failed to save values.yaml: ${error.message}`);
      }
    }
  );

  /**
   * Generate Helm templates from provided chart and values
   */
  ipcMain.handle(
    "helm:template",
    async (
      _event,
      {
        releaseName,
        namespace,
        valuesYaml,
        chartPath,
      }: {
        releaseName: string;
        namespace: string;
        valuesYaml: string;
        chartPath: string;
      }
    ) => {
      try {
        // Prepare temp directory for values.yaml
        const tempDir = path.join(app.getPath("temp"), "helm-ui");
        await fs.mkdir(tempDir, { recursive: true });
        const tempValuesPath = path.join(tempDir, "values.yaml");
        await fs.writeFile(tempValuesPath, valuesYaml, "utf-8");

        // Execute helm template command
        const { stdout } = await execPromise(
          `helm template ${releaseName} ${chartPath} --namespace ${namespace} -f ${tempValuesPath}`
        );

        // Parse output into separate templates keyed by filename
        const templates: Record<string, string> = {};
        let currentFile: string | null = null;
        let currentContent = "";

        for (const line of stdout.split("\n")) {
          if (line.startsWith("# Source:")) {
            if (currentFile) {
              templates[currentFile] = currentContent.trim();
            }
            currentFile = line.replace("# Source:", "").trim();
            currentContent = line + "\n";
          } else if (currentFile) {
            currentContent += line + "\n";
          }
        }

        // Add last collected template if any
        if (currentFile) {
          templates[currentFile] = currentContent.trim();
        }

        return { templates };
      } catch (error: any) {
        console.error("Failed to generate Helm templates:", error);
        throw new Error(`Failed to generate Helm templates: ${error.message}`);
      }
    }
  );

  /**
   * Show select directory dialog and return chosen path or null if canceled
   */
  ipcMain.handle(
    "dialog:selectDirectory",
    async (_event, options?: OpenDialogOptions) => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ["openDirectory"],
          ...(options ?? {}),
        });
        return result.canceled ? null : result.filePaths[0];
      } catch (error: any) {
        console.error("Failed to show select directory dialog:", error);
        throw new Error(`Failed to open directory dialog: ${error.message}`);
      }
    }
  );
}
