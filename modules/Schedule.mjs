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

    static async downloadScheduleForGroup(group, timestamp) {
        let schedule;
        try {
            schedule = await Schedule.App.modules.API.getSchedule(group.name, timestamp);
        } catch (error) {
            return false;
        }
        if (schedule.status >= 500 && schedule.status < 600) return false;
        delete schedule.status;
        delete schedule.ok;
        for (let day in schedule) {
            for (let lesson of schedule[day].list) {
                let classObj = Object.assign(lesson, {
                    date: schedule[day].date,
                    group_id: group.id
                });
                await Schedule.App.modules.DB.insertClass(classObj);
            }
        }
        return true
    }

    static async downloadSchedule() {
        let baseTimestamp = Schedule.getMondayMidnight();

        await Schedule.App.modules.DB.deleteInactiveGroups();
        let groups = await Schedule.App.modules.DB.getGroups();

        for (let group of groups) {
            for (let weekOffset of [0, 604800]) {
                let timestamp = baseTimestamp + weekOffset;

                if (!await Schedule.downloadScheduleForGroup(group, timestamp)) {
                    Schedule.crons.downloadSchedule.stop();
                    Schedule.crons.fallbackDownloadSchedule.start();
                    return null;
                }
            }
        }
    }

    static async fallbackDownloadSchedule() {
        let baseTimestamp = Schedule.getMondayMidnight();

        await Schedule.App.modules.DB.deleteInactiveGroups();
        let groups = await Schedule.App.modules.DB.getGroups();

        for (let group of groups) {
            for (let weekOffset of [0, 604800]) {
                let timestamp = baseTimestamp + weekOffset;

                if (!await Schedule.downloadScheduleForGroup(group, timestamp)) {
                    return null;
                }
            }
        }
        Schedule.crons.fallbackDownloadSchedule.stop();
        Schedule.crons.downloadSchedule.start();
    }

    static async test() {
        let baseTimestamp = Schedule.getMondayMidnight();
        await Schedule.App.modules.DB.deleteInactiveGroups();
        let groups = await Schedule.App.modules.DB.getGroups();
        for (let group of groups) {
            for (let weekOffset of [0, 604800]) {
                let timestamp = baseTimestamp + weekOffset;

                if (!await Schedule.downloadScheduleForGroup(group, timestamp)) {
                    Schedule.crons.downloadSchedule.stop();
                    Schedule.crons.fallbackDownloadSchedule.start();
                    return null;
                }
            }
        }
        return null;
    }

}