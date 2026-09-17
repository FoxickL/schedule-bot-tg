export class API {

    static retries = 3;
    static delay = 5000;

    static async _send(request) {
        for (let i = 0; i <= API.retries; i++) {
            try {
                let response = await fetch(request);
                if (response.ok) { return Object.assign({ "ok": true, "status": response.status }, await response.json()); }
                else {
                    throw new Error(response.status);
                }
            }
            catch (error) {
                let httpCode = error.message
                if (i == API.retries || (httpCode >= 400 && httpCode <= 499)) {
                    if (error instanceof TypeError || error.message.toLowerCase().includes('fetch')) {
                        error.message = "bad connection to the API";
                    }
                    return { 'ok': false, "status": error.message };
                }
                await new Promise(resolve => setTimeout(resolve, API.delay));
            }
        }
    }

    static async getGroup(group) {
        let url = new URL('https://api.stavmk.ru/filter/groups/active-lib-scheule-group-name');
        url.searchParams.set('q', group)
        let request = new Request(url, {
            method: 'GET',
        });

        return await API._send(request)
    }

    // нужена каждая полночь понедельника
    //+-604800
    // const now = new Date();
    // const day = now.getDay(); // 0 - воскресенье, 1 - понедельник...
    
    // // Находим разницу в днях до понедельника
    // const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
    // const monday = new Date(now.setDate(diff));
    
    // // Устанавливаем московскую полночь (21:00 предыдущего дня по UTC)
    // // Для этого сдвигаем дату на день назад и ставим 21:00
    // monday.setUTCHours(21, 0, 0, 0);
    // if (day === 0) {
    //     // если сегодня воскресенье, то код выше уже нашел нужную полночь
    // } else {
    //     monday.setUTCDate(monday.getUTCDate() - 1);
    // }
    
    // return Math.floor(monday.getTime() / 1000);
    
    
    static async getSchedule(group, timestamp){
        let url = new URL('https://api.stavmk.ru/widget/schedule/get');
        url.searchParams.set('group', group);
        url.searchParams.set('start_date', timestamp);
        let request = new Request(url, {
            method: 'GET',
        });

        return await API._send(request)
    }
}