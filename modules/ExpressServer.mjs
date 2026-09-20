import express, { response } from 'express';
import path from 'path';
import { message } from 'telegraf/filters';

const publicFolder = (p) => { return path.resolve(`${import.meta.dirname}/../public`, p) };

export class ExpressServer {
    static port = 3333

    static init() {
        const server = express();
        server.use(express.static(publicFolder('')));

        server.get('/', (req, res) => {
            res.sendFile(publicFolder(`index.html`))
        })

        let methods = Object.getOwnPropertyNames(this);

        methods.forEach(method => {
            if (typeof this[method] !== 'function') return;

            let isGet = method.startsWith('get');
            let isPost = method.startsWith('post');

            if (!isGet && !isPost) return;

            let routePath = '/' + method.slice(isGet ? 3 : 4)
                .replace(/(?!^)([A-Z])/g, '/$1')
                .toLowerCase()
                .replace(/\/p\//g, '/:')
                .replace(/\/\//g, '/');
            console.log(`[Auto-Router Log] Method: ${method} ---> Route: ${routePath}`);
            if (isGet) {
                server.get(routePath, (req, res, next) => {
                    Promise.resolve(this[method](req, res, next)).catch(next);
                });
            } else if (isPost) {
                server.post(routePath, (req, res, next) => {
                    Promise.resolve(this[method](req, res, next)).catch(next);
                });
            }
        })

        server.use((req, res) => {
            res.status(404).sendFile(publicFolder('error404.html'));
        });

        server.use((err, req, res, next) => {
            console.error('Critical Express Server Error:', err.stack);
            res.status(500).sendFile(publicFolder('error500.html'));
        });

        server.listen(this.port, () => { console.log(`Express server has started: http://localhost:${this.port}`) });

    }

    // api
    static async getApiSchedulePGroup(req, res) { // api/schedule/:group?timestamp
        res.send(await ExpressServer.App.modules.API.getSchedule(req.params.group, req.query.timestamp));
    }

    static async getApiGroups(req, res) { // api/groups?q
        res.send(await ExpressServer.App.modules.API.getGroup(req.query.q));
    }

    static async getApiAuditoriums(req, res) { // /api/auditoriums?q
        res.send(await ExpressServer.App.modules.DB.findAuditoriums(req.query.q));
    }

    static async getApiAuditoriumPName(req, res) { // /api/auditoriums/:name
        res.send(await ExpressServer.App.modules.DB.findClassesInAuditorium(req.params.name));
    }

    static async getApiTeachers(req, res) { // /api/teachers?q
        res.send(await ExpressServer.App.modules.DB.findTeacher(req.query.q));
    }

    static async getApiTeacherPName(req, res) { // /api/teacher/:name
        res.send(await ExpressServer.App.modules.DB.findClassesWithTeacher(req.params.name));
    }

    //not api
}

//чтение по расписанию по группе
//все группы
//расписание по кабинету
//расписание по преподу