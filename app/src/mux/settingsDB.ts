import { fetchPost } from "../util/fetch";

/**
 * Interface for the database query request
 */
interface SQLRequest {
    stmt: string;
    args?: any[];
}

/**
 * Interface for the database query response
 */
interface SQLResponse {
    code: number;
    msg: string;
    data: any[];
}

export interface Setting {
    label: string;
    description?: string;
    type: string;
    value: unknown;
    section: string;
    display: 'toggle' | 'input' | 'textarea';
}

/**
 * Settings service for persisting settings to the database
 */
export class SettingsDB {
    private static TABLE_NAME = "mux_settings";
    private static initialized = false;

    /**
     * Initialize the settings table if it doesn't exist
     */
    public static async init(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            // Create the settings table if it doesn't exist
            await this.executeSQL({
                stmt: `CREATE TABLE IF NOT EXISTS ${this.TABLE_NAME} (
                    key TEXT PRIMARY KEY,
                    label TEXT NOT NULL,
                    description TEXT NOT NULL,
                    type TEXT NOT NULL,
                    value TEXT NOT NULL,
                    section TEXT NOT NULL,
                    display TEXT NOT NULL
                )`
            });

            this.initialized = true;
            console.log("Settings database initialized");
        } catch (error) {
            console.error("Failed to initialize settings database:", error);
        }
    }
    /**
     * Save a setting to the database
     * @param setting The setting object (partial or complete)
     * @returns Whether the operation was successful
     */
    public static async saveSetting(key: string, value: any): Promise<boolean> {
        await this.init();
        // First check if the setting exists
        const existingResult = await this.executeSQL({
            stmt: `SELECT * FROM ${this.TABLE_NAME} WHERE key = ?`,
            args: [key]
        });

        const exists = existingResult.length > 0;

        if (exists) {
            if (typeof value === 'object') {
                value = JSON.stringify(value);
            }
            await this.executeSQL({
                stmt: `UPDATE ${this.TABLE_NAME} SET value = ? WHERE key = ?`,
                args: [value, key]
            });
            return true;
        }
    }

    public static async createSetting(setting: Setting & { key: string }) {
        await this.init();

        await this.executeSQL({
            stmt: `INSERT OR REPLACE INTO ${this.TABLE_NAME} (key, label, description, type, value, section, display) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [setting.key, setting.label, setting.description ? setting.description : "", setting.type, JSON.stringify(setting.value), setting.section, setting.display]
        });
    }

    /**
     * Load a setting from the database
     * @param key The setting key
     * @param defaultValue The default value if the setting doesn't exist
     */
    public static async loadSetting<T>(key: string, defaultValue: T): Promise<T> {
        await this.init();

        try {
            const result = await this.executeSQL({
                stmt: `SELECT value FROM ${this.TABLE_NAME} WHERE key = ?`,
                args: [key]
            });

            if (result.length > 0) {
                return JSON.parse(result[0].value) as T;
            }

            return defaultValue;
        } catch (error) {
            console.error(`Failed to load setting '${key}':`, error);
            return defaultValue;
        }
    }

    /**
     * Delete a setting from the database
     * @param key The setting key
     */
    public static async deleteSetting(key: string): Promise<boolean> {
        await this.init();

        try {
            await this.executeSQL({
                stmt: `DELETE FROM ${this.TABLE_NAME} WHERE key = ?`,
                args: [key]
            });

            return true;
        } catch (error) {
            console.error(`Failed to delete setting '${key}':`, error);
            return false;
        }
    }

    /**
     * List all settings in the database
     * @returns An object with all settings
     */
    public static async listAllSettings(): Promise<Record<string, unknown>> {
        await this.init();

        const result = await this.executeSQL({
            stmt: `SELECT * FROM ${this.TABLE_NAME}`
        });

        const settings: Record<string, unknown> = {};

        for (const row of result) {
            settings[row.key] = row.value;
        }

        return settings;
    }

    /**
     * Execute a SQL query
     * @param request The SQL request
     * @returns The query result
     */
    private static executeSQL(request: SQLRequest): Promise<any[]> {
        return new Promise((resolve, reject) => {
            fetchPost("/api/db/query", request, (response: SQLResponse) => {
                if (response.code === 0) {
                    resolve(response.data || []);
                } else {
                    reject(new Error(response.msg || "Unknown error"));
                }
            });
        });
    }
} 