import express, { response } from 'express';
import path from 'path';

const publicFolder = (p) => {return path.resolve(`${import.meta.dirname}/../public`, p)};

export class ExpressServer{
    static port = 3333
    
    static init(){
        const server = express();
        server.use(express.static(publicFolder('')));

        // server.get('/', (req, res)=> {
        //     res.sendFile(publicFolder(`index.html`))
        // })

        // server.get('/random', (req, res)=> {
        //     res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        //     if (req.headers['x-requested-with'] == 'FetchAPI' ) res.send({res: 111222})
        //     else return res.status(403).sendFile(publicFolder('error403.html'));
        // })

        // server.get('/500', (req, res) => {
        //     throw new Error('1') // для 500 ошибки
        // })

        // server.use((req, res) => {
        //     res.status(404).sendFile(publicFolder('error404.html'));
        // });

        // server.use((err, req, res, next) => {
        //     console.error('Critical Express Server Error:', err.stack);
        //     res.status(500).sendFile(publicFolder('error500.html'));
        // });

        server.listen(this.port, ()=>{ console.log(`Express server has started: http://localhost:${this.port}`)});

    }
}