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

    static async getGroup(q) {
        let url = new URL('https://api.stavmk.ru/filter/groups/active-lib-scheule-group-name');
        url.searchParams.set('q', q)
        let request = new Request(url, {
            method: 'GET',
        });

        return await API._send(request)
    }

    // нужена каждая полночь понедельника
    //+-604800
    
    
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