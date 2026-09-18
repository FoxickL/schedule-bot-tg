import pg from 'pg';
const { Pool } = pg;
import { env } from "process";

export class DB {
    static pool;

    static async init() {
        try {
            DB.pool = new Pool({
                user: env.DATABASE_USER,
                host: env.DATABASE_HOST,
                database: env.DATABASE_NAME,
                password: env.DATABASE_PASSWORD,
                port: env.DATABASE_PORT
            })
            console.log(`Database connected. ${(await DB.pool.query('SELECT NOW()')).rows[0].now}`);
        }
        catch (e) {
            console.error(e.stack);
        }
    }

    static async _query(sql, params = []) {
        try {
            return await DB.pool.query(sql, params);
        }
        catch (e) {
            console.error(e.stack);
            return null;
        }

    }

    static async getGroups(){
        return (await DB._query('SELECT * FROM groups')).rows;
    }
}