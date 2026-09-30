import { Telegraf, Scenes, session, Markup } from 'telegraf';
import { env } from "process";
import cron from 'node-cron';
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:10808');

export class TgBot {
    static bot = new Telegraf(env.TG_BOT_TOKEN, {
        telegram: {
            agent: proxyAgent
        }
    });
    static stage;
    static groupSearchScene = new Scenes.BaseScene('GROUP_SEARCH_SCENE');

    static async init() {
        this.initGroupSearchScene();

        let methods = Object.getOwnPropertyNames(this);
        let messages = new Map();
        let commands = new Map();
        let buttons = new Map();

        methods.forEach(method => {
            if (method.startsWith('on') && typeof this[method] == 'function') messages.set(method.slice(2).toLowerCase(), this[method]);
            else if (method.startsWith('command') && typeof this[method] == 'function') commands.set(`/${method.slice(7).toLowerCase()}`, this[method]);
            else if (method.startsWith('button') && typeof this[method] == 'function') buttons.set(`${method.slice(6).toLowerCase()}`, this[method]);
        });

        this.stage = new Scenes.Stage([this.groupSearchScene]);
        this.bot.use(session());
        this.bot.use(this.stage.middleware());

        this.bot.use((ctx, next) => {
            if (ctx.callbackQuery && ctx.callbackQuery.data.startsWith('select_group:')) {
                return next();
            }
            return next();
        });

        this.bot.on('text', (ctx) => {
            if (ctx.scene && ctx.scene.current) {
                return;
            }

            let text = ctx.message.text.toLowerCase().trim();
            if (messages.has(text)) messages.get(text).call(this, ctx);
            else if (commands.has(text.split(' ')[0])) {
                commands.get(text.split(' ')[0]).call(this, ctx);
            }
            else {
                ctx.reply('Я тебя не понимаю')
            }
        });

        this.bot.on('callback_query', (ctx) => {
            if (ctx.scene && ctx.scene.current) return;

            let data = ctx.callbackQuery.data;

            if (buttons.has(data.toLowerCase())) {
                buttons.get(data.toLowerCase()).call(this, ctx);
                ctx.answerCbQuery().catch(() => { });
                return;
            }

            let [prefix, ...rest] = data.split(':');
            let key = prefix.toLowerCase();
            if (buttons.has(key)) {
                ctx.match = [data, rest.join(':')];
                buttons.get(key).call(this, ctx);
                ctx.answerCbQuery().catch(() => { });
            }
        });

        cron.schedule('0 6 * * 1-5', async () => {
            try {
                await TgBot.ScheduleDistribution();
            } catch (error) {
                console.error(error.stack);
            }
        }, {
            timezone: 'Europe/Moscow'
        });

        try {
            await this.bot.telegram.getMe();
            console.log('Tg bot have started https://t.me/SMKSheduleBot');
            await this.bot.launch();
        } catch (e) {
            console.error('Tg bot have not started');
            throw new Error(e.message);
        }
    }

    static initGroupSearchScene() {
        this.groupSearchScene.enter((ctx) => {
            return ctx.reply('Введите название группы для поиска:');
        });

        this.groupSearchScene.on('text', async (ctx) => {
            let response = await TgBot.App.modules.API.getGroup(ctx.message.text);
            let groups = response ? response.results : [];

            if (!groups || !groups.length) return ctx.reply('Такой группы нет. Попробуйте снова');

            let inlineButtons = groups.map(group =>
                Markup.button.callback(String(group.text), `select_group:${group.id}`)
            );

            await ctx.reply(
                'Вот что я нашел. Выберите нужную группу или введите другое название для повторного поиска:',
                Markup.inlineKeyboard(inlineButtons, { columns: 3 })
            );
        });

        this.groupSearchScene.action(/^select_group:(.+)$/, async (ctx) => {
            const groupName = ctx.match[1];

            let group = await TgBot.App.modules.DB.findGroup(groupName);
            if (!group) {
                await TgBot.App.modules.DB.insertGroup(groupName);
                group = await TgBot.App.modules.DB.findGroup(groupName);
            }

            await TgBot.App.modules.DB.insertUsersGroup(ctx.from.id, groupName);

            try {
                await TgBot.App.modules.Schedule.downloadScheduleForGroup(
                    group,
                    TgBot.App.modules.Schedule.getMondayMidnight()
                );
                await TgBot.App.modules.Schedule.downloadScheduleForGroup(
                    group,
                    TgBot.App.modules.Schedule.getMondayMidnight() + 604800
                );
            } catch (e) {
                console.error('Ошибка загрузки расписания для группы', groupName, e.stack);
            }

            await ctx.answerCbQuery().catch(() => { });
            await ctx.reply(`Отлично! Вы выбрали группу ${groupName}.`);

            await TgBot.sendTodayScheduleForGroup(ctx.from.id, group.id, group.name, ctx);

            return ctx.scene.leave();
        });
    }


    static typeLabels = {
        'Пр': 'Практика',
        'Лк': 'Лекция',
        'Лаб': 'Лаб. работа'
    };

    static escapeM2(text) {
        if (!text) return '';
        return String(text).replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
    }

    static buildGroupScheduleBlock(groupName, groupSchedule) {
        const escapeM2 = TgBot.escapeM2;
        const typeLabels = TgBot.typeLabels;

        let block = `\n👥 *Группа: ${escapeM2(groupName)}*\n`;
        block += `───────────────────\n`;

        if (!groupSchedule || groupSchedule.length === 0) {
            block += "🎉 Пар нет, можно отдыхать\\!\n";
            return block;
        }

        const sortedPairs = [...groupSchedule].sort((a, b) => a.number - b.number);

        sortedPairs.forEach(pair => {
            const start = pair.time_start ? pair.time_start.slice(0, 5) : '00:00';
            const end = pair.time_end ? pair.time_end.slice(0, 5) : '00:00';
            const pairType = typeLabels[pair.type] || pair.type || '';
            const subgroupInfo = pair.subgroup && pair.subgroup !== '0'
                ? ` \\[${escapeM2(pair.subgroup)} подгруппа\\]`
                : "";
            const formattedTime = `${escapeM2(start)} \\- ${escapeM2(end)}`;

            block += `*${pair.number} пара* 🕒 \`${formattedTime}\`\n`;
            block += `📚 *${escapeM2(pair.discipline)}* \\(${escapeM2(pairType)}\\)${subgroupInfo}\n`;
            block += `📍 ${escapeM2(pair.corpus)}, ауд\\. \`${escapeM2(pair.auditorium)}\`\n`;
            block += `👨‍🏫 _${escapeM2(pair.teacher)}_\n\n`;
        });

        return block;
    }

    static scheduleKeyboard(tgId) {
        return {
            inline_keyboard: [[{ text: 'Я приду', callback_data: `i_will_come:${tgId}` }]]
        };
    }


    static async sendTodaySchedule(tgId, ctx = null) {
        const groups = await TgBot.App.modules.DB.getUsersGroupsByTgId(tgId);

        if (!groups || groups.length === 0) {
            const text = 'У вас нет отслеживаемых групп\\. Добавьте через /add\\_group';
            if (ctx) await ctx.reply(text, { parse_mode: 'MarkdownV2' });
            return;
        }

        let message = "📋 *Расписание на сегодня*\n";

        for (const group of groups) {
            const groupSchedule = await TgBot.App.modules.DB.getTodaysScheduleOnGroupe(group.id) || [];
            message += TgBot.buildGroupScheduleBlock(group.name, groupSchedule);
        }

        const text = message.trim();
        const keyboard = TgBot.scheduleKeyboard(tgId);

        if (ctx) {
            await ctx.reply(text, { parse_mode: 'MarkdownV2', reply_markup: keyboard });
        } else {
            try {
                await TgBot.bot.telegram.sendMessage(tgId, text, {
                    parse_mode: 'MarkdownV2',
                    reply_markup: keyboard
                });
            } catch (err) {
                console.error(`Ошибка отправки пользователю ${tgId}:`, err.stack);
            }
        }
    }

    static async sendTodayScheduleForGroup(tgId, groupId, groupName, ctx = null) {
        const groupSchedule = await TgBot.App.modules.DB.getTodaysScheduleOnGroupe(groupId) || [];

        let message = "📋 *Расписание на сегодня*\n";
        message += TgBot.buildGroupScheduleBlock(groupName, groupSchedule);

        const text = message.trim();
        const keyboard = TgBot.scheduleKeyboard(tgId);

        if (ctx) {
            await ctx.reply(text, { parse_mode: 'MarkdownV2', reply_markup: keyboard });
        } else {
            try {
                await TgBot.bot.telegram.sendMessage(tgId, text, {
                    parse_mode: 'MarkdownV2',
                    reply_markup: keyboard
                });
            } catch (err) {
                console.error(`Ошибка отправки пользователю ${tgId}:`, err.stack);
            }
        }
    }


    static async commandStart(ctx) {
        ctx.reply('Салам бро\nПомочь? ( /help )');
        await TgBot.App.modules.DB.insertTgUser(ctx.from.id);
    }

    static commandHelp(ctx) {
        ctx.reply(
            '/add_group - добавить группу в отслеживаемые\n' +
            '/my_groups - посмотреть все выбранные группы\n' +
            '/delete_group - отписаться от расписания этой группы\n' +
            '/schedule - расписание на сегодня'
        );
    }

    static async commandAdd_group(ctx) {
        await ctx.scene.enter('GROUP_SEARCH_SCENE');
    }

    static async commandMy_groups(ctx) {
        let groups = (await TgBot.App.modules.DB.getUsersGroupsByTgId(ctx.from.id)).map(group => { return group.name })
        ctx.reply(`Выши избранные группы:\n${groups.join(',\n')}`)
    }

    static async commandDelete_group(ctx) {
        let groups = (await TgBot.App.modules.DB.getUsersGroupsByTgId(ctx.from.id))
        let inlineButtons = groups.map(group =>
            Markup.button.callback(String(group.name), `delete_group:${group.id}`)
        );
        await ctx.reply(
            'Выберите группу из списка:',
            Markup.inlineKeyboard(inlineButtons, { columns: 3 })
        );
    }

    static async commandSchedule(ctx) {
        await TgBot.sendTodaySchedule(ctx.from.id, ctx);
    }


    static async buttonDelete_group(ctx) {
        let groupId = ctx.match[1];
        await TgBot.App.modules.DB.deleteUsersGroup(ctx.from.id, groupId);
        await TgBot.App.modules.DB.deleteInactiveGroups();
        await ctx.answerCbQuery('Удалено').catch(() => { });
        await ctx.editMessageText('Группа удалена.');
    }

    static async buttonI_will_come(ctx) {
        await TgBot.App.modules.DB.updateUsersLastSeen(ctx.from.id);
        await ctx.answerCbQuery('Отлично! Ждём тебя 👍').catch(() => { });
    }


    static async ScheduleDistribution() {
        let tgIds = await TgBot.App.modules.DB.getAllTgIds();
        for (let tgId of tgIds) {
            await TgBot.sendTodaySchedule(tgId.tg_id);
        }
    }
}