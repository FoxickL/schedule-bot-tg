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

    //SELECT
    static async getGroups() {
        return (await DB._query('SELECT * FROM groups')).rows;
    }

    static async findGroup(name) {
        return (await DB._query('SELECT * FROM groups WHERE name = $1', [name])).rows[0];
    }

    static async findTeachers(name) {
        return (await DB._query('SELECT DISTINCT teacher FROM schedule WHERE teacher ILIKE $1 LIMIT 10', [`%${name}%`])).rows;
    }

    static async findClassesWithTeacher(name){
        return (await DB._query('SELECT * FROM schedule WHERE teacher = $1', [name])).rows;
    }

    static async findAuditoriums(name) {
        return (await DB._query('SELECT DISTINCT auditorium , corpus FROM schedule WHERE auditorium ILIKE $1 LIMIT 10', [`%${name}%`])).rows;
    }

    static async findClassesInAuditorium(name, corpus){
        return (await DB._query('SELECT * FROM schedule WHERE auditorium = $1 AND corpus = $2', [name, corpus])).rows;
    }

    //INSERT
    static async insertClass(classObj) {
        return await DB._query(`
            INSERT INTO schedule (date , discipline , type , time_start, time_end, number , auditorium , corpus , teacher, subgroup, group_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
            ON CONFLICT (group_id, date, number, subgroup) DO NOTHING`,
            [classObj.date, classObj.disciplines, classObj.types, classObj.timeStart, classObj.timeEnd, classObj.number, classObj.auditorium, classObj.corpus, classObj.teachers, classObj.subgroup, classObj.group_id]
        );
    }

    static async insertGroup(name) {
        return await DB._query('INSERT INTO groups (name) VALUES ( $1 )', [name]);
    }

    static async insertTgUser(tgId, group) {
        return await DB._query('INSERT INTO users (tg_id) VALUES ( $1)', [tgId]);
    }

    //UPDATE
    static async makeInactiveUserByTg_id(tgId) {
        return await DB._query('UPDATE users SET is_active = false WHERE tg_id = $1', [tgId])
    }

    static async updateUsersLastSeen(tgId) {
        return await DB._query(
            "UPDATE users SET last_seen = timezone('Europe/Moscow', NOW())::date WHERE tg_id = $1",
            [tgId]
        );

    }

    //DELETE

    static async deleteInactiveGroups() {
        await DB._query(`
            DELETE FROM user_groups 
            USING users 
            WHERE user_groups.user_id = users.id 
            AND users.is_active = false
        `);
        return await DB._query(`
            DELETE FROM groups 
            WHERE NOT EXISTS (
                SELECT 1 
                FROM user_groups 
                WHERE user_groups.group_id = groups.id
            )
        `);
    }

    static async deleteInactiveUsers() {
        await DB._query(`
            DELETE FROM users 
            WHERE is_active = false
        `);
    }

}