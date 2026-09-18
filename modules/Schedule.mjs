import cron from 'node-cron';

export class Schedule {

    static schedules = {
        downloadSchedule: '0 0 * * 1',
        fallbackDownloadSchedule: '0 */3 * * *',
        test: '*/5 * * * * *'
    }

    static options = {
        scheduled: false,
        timezone: "Europe/Moscow"
    }

    static crons = {};

    static init() {
        Schedule.crons = {
            downloadSchedule: cron.schedule(Schedule.schedules.downloadSchedule, Schedule.downloadSchedule, Schedule.options),
            fallbackDownloadSchedule: cron.schedule(Schedule.schedules.fallbackDownloadSchedule, Schedule.fallbackDownloadSchedule, Schedule.options),
            test: cron.schedule(Schedule.schedules.test, Schedule.test, Schedule.options),
        }
        Schedule.crons.test.start();
    }

    static getMondayMidnight() {
        let formatter = new Intl.DateTimeFormat('ru-RU', {
            timeZone: 'Europe/Moscow',
            year: 'numeric', month: 'numeric', day: 'numeric'
        });

        let parts = formatter.formatToParts(new Date());
        let mskYear = parseInt(parts.find(p => p.type === 'year').value);
        let mskMonth = parseInt(parts.find(p => p.type === 'month').value) - 1
        let mskDay = parseInt(parts.find(p => p.type === 'day').value);
        let mskDate = new Date(Date.UTC(mskYear, mskMonth, mskDay, 12, 0, 0));
        let dayOfWeek = mskDate.getUTCDay();
        let daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        let mondayMidnight = new Date(Date.UTC(mskYear, mskMonth, mskDay - daysSinceMonday, 0, 0, 0));
        mondayMidnight.setUTCHours(mondayMidnight.getUTCHours() - 3);

        return Math.floor(mondayMidnight.getTime() / 1000);
    }

    static downloadSchedule() {
        // скачивание расписания
        // let timestamp = Schedule.getMondayMidnight();

        // groups = Schedule.App.modules.DB.getGroups

        // Schedule.App.modules.API.getSchedule()
    }

    static fallbackDownloadSchedule() {
        //резервное скачивание если при первой поптыке не срослось
    }

    static async test(){
        console.log(await Schedule.App.modules.DB.getGroups())
    }

}