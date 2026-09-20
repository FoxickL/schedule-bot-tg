import { Telegraf, Scenes, session, Markup } from 'telegraf';
import { env } from "process";
import cron from 'node-cron';

export class TgBot {
    static bot = new Telegraf(env.TG_BOT_TOKEN);
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
            let groupId = ctx.match[1];

            let group = await TgBot.App.modules.DB.findGroup(groupId);
            if (!group) await TgBot.App.modules.DB.insertGroup(groupId);

            await TgBot.App.modules.DB.insertUsersGroup(ctx.from.id, groupId);

            await ctx.answerCbQuery().catch(() => { });
            await ctx.reply(`Отлично! Вы выбрали группу ${groupId}. Поиск завершен.`);
            return ctx.scene.leave();
        });
    }

    static commandStart(ctx) {
        ctx.reply('Салам бро\nПомочь? ( /help )');
        TgBot.App.modules.DB.insertTgUser(ctx.from.id);
    }

    static commandHelp(ctx) {
        ctx.reply('/add_group - добавить группу в отслеживаемые\n/my_groups - посмотреть все выбранные группы\n/delete_group - отписаться от расписания этой группы')
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

    static async buttonDelete_group(ctx) {
        let groupId = ctx.match[1];
        await TgBot.App.modules.DB.deleteUsersGroup(ctx.from.id, groupId);
        await TgBot.App.modules.DB.deleteInactiveGroups();
        await ctx.answerCbQuery('Удалено').catch(() => { });
        await ctx.editMessageText('Группа удалена.');
    }

    static async ScheduleDistribution() {
        let cashe = new Map();
        let tgIds = await TgBot.App.modules.DB.getAllTgIds();

        const typeLabels = {
            'Пр': 'Практика',
            'Лк': 'Лекция',
            'Лаб': 'Лаб. работа'
        };

        const escapeM2 = (text) => {
            if (!text) return '';
            return String(text).replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
        };

        for (let tgId of tgIds) {
            let groups = await TgBot.App.modules.DB.getUsersGroupsByTgId(tgId.tg_id);
            if (!groups || groups.length == 0) continue;

            let schedules = {};
            for (let group of groups) {
                if (cashe.has(group.id)) {
                    schedules[group.name] = cashe.get(group.id);
                } else {
                    schedules[group.name] = await TgBot.App.modules.DB.getTodaysScheduleOnGroupe(group.id);
                    cashe.set(group.id, schedules[group.name]);
                }
            }

            let message = "📋 *Расписание на сегодня*\n";

            groups.forEach(group => {
                let groupName = group.name;
                let groupSchedule = schedules[groupName] || [];

                message += `\n👥 *Группа: ${escapeM2(groupName)}*\n`;
                message += `───────────────────\n`;

                if (groupSchedule.length === 0) {
                    message += "🎉 Пар нет, можно отдыхать\\!\n";
                    return;
                }

                let sortedPairs = [...groupSchedule].sort((a, b) => a.number - b.number);

                sortedPairs.forEach(pair => {
                    let start = pair.time_start ? pair.time_start.slice(0, 5) : '00:00';
                    let end = pair.time_end ? pair.time_end.slice(0, 5) : '00:00';

                    let pairType = typeLabels[pair.type] || pair.type || '';
                    let subgroupInfo = pair.subgroup && pair.subgroup !== '0'
                        ? ` \\[${escapeM2(pair.subgroup)} подгруппа\\]`
                        : "";

                    let formattedTime = `${escapeM2(start)} \\- ${escapeM2(end)}`;

                    message += `*${pair.number} пара* 🕒 \`${formattedTime}\`\n`;
                    message += `📚 *${escapeM2(pair.discipline)}* \\(${escapeM2(pairType)}\\)${subgroupInfo}\n`;
                    message += `📍 ${escapeM2(pair.corpus)}, ауд\\. \`${escapeM2(pair.auditorium)}\`\n`;
                    message += `👨‍🏫 _${escapeM2(pair.teacher)}_\n\n`;
                });
            });

            try {
                await TgBot.bot.telegram.sendMessage(tgId.tg_id, message.trim(), { parse_mode: 'MarkdownV2' });
            } catch (err) {
                console.error(`Ошибка отправки пользователю ${tgId.tg_id}:`, err.stack);
            }
        }
    }


}
