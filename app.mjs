import moduleConfig from './module-config.json' with {type: 'json'};
import { env } from "process";

class App {
    static modules = {};

    static async init() {
        for (let module of Object.keys(moduleConfig.modules)) {
            try {
                console.log(`Importing ${module}`);
                let moduleObject = await import(`${moduleConfig.folder}${moduleConfig.modules[module].path}${module}.mjs`);

                let ImportedClass = moduleObject.default || moduleObject[module];

                if (ImportedClass && typeof ImportedClass === 'function') {
                    ImportedClass.App = this;

                    App.modules[module] = ImportedClass;

                    if (moduleConfig.modules[module].needInit && typeof ImportedClass.init === 'function') {
                        await ImportedClass.init();
                    }
                } else {
                    throw new Error(`Класс не найден в модуле ${module}`);
                }

                console.log(`Successfully imported module ${module}`);
            } catch (e) {
                console.error(`Failed to import module ${module}`)
                console.error(e);
            }
        }
    }
}

await App.init();
console.log(App.modules.Schedule.getMondayMidnight() + 604800); //гы)

//надо сделать обработку запросов с фронта
