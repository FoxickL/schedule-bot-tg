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
                        ImportedClass.init();
                    }
                } else {
                    throw new Error(`Класс не найден в модуле ${module}`);
                }

                console.log(`Successfully imported module ${module}`);
            } catch (e) {
                console.error(e);
            }
        }
    }
}

await App.init();
// console.log((await App.modules.API.getSchedule('КИС-2419 (hub)', 1789333200))['0']); //гы)

//надо сделать обработку запросов с фронта
