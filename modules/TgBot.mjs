import { Telegraf } from 'telegraf';
import { env } from "process";

export class TgBot {
    static bot = new Telegraf(env.TG_BOT_TOKEN)
    static init() {
        let methods = Object.getOwnPropertyNames(this);
        let messages = new Map();
        let commands = new Map();
        let buttons = new Map();

        methods.forEach(method => {
            if (method.startsWith('on') && typeof this[method] == 'function') messages.set(method.slice(2).toLowerCase(), this[method]);
            else if (method.startsWith('command') && typeof this[method] == 'function') commands.set(`/${method.slice(7).toLowerCase()}`, this[method]);
            else if (method.startsWith('button') && typeof this[method] == 'function') buttons.set(`${method.slice(6).toLowerCase()}`, this[method]);
        })

        this.bot.on('text', (ctx) => {
            let text = ctx.message.text.toLowerCase().trim();
            if (messages.has(text)) messages.get(text).call(this, ctx);
            else if (commands.has(text.split(' ')[0])) {
                commands.get(text.split(' ')[0]).call(this, ctx);
            }
            else {
                ctx.reply('Я тебя не понимаю')
            }
        })

        this.bot.on('callback_query', (ctx) => {
            if (buttons.has(ctx.callbackQuery.data.toLowerCase())) {
                buttons.get(ctx.callbackQuery.data.toLowerCase()).call(this, ctx);

                ctx.answerCbQuery().catch(() => { });
            }
        })

        this.bot.launch()
        console.log('Tg bot have started https://t.me/SMKSheduleBot')
    }

    static commandStart(ctx) {
        ctx.reply('Салам бро\nПомочь? ( /help )')
    }

    // tests from ai. I'm not vibecoder, i'm just lazy😵‍💫
    // // 1. ТЕСТ ОБЫЧНОГО СООБЩЕНИЯ (Префикс on)
    // // Сработает, если пользователь напишет: привет / Привет / ПРИВЕТ
    // static onПривет(ctx) {
    //     ctx.reply('Привет-привет! Текстовый триггер сработал идеально. 👋');
    // }

    // // 2. ТЕСТ ПРОСТОЙ КОМАНДЫ (Префикс command)
    // // Сработает на /help
    // static commandHelp(ctx) {
    //     ctx.reply('Вот список доступных тестов:\n• Напиши "привет"\n• Введи /help\n• Введи /calc 10 20\n• Введи /menu');
    // }

    // // 3. ТЕСТ КОМАНДЫ С АРГУМЕНТАМИ (Префикс command)
    // // Сработает на /calc 5 10 или /calc 100 200
    // static commandCalc(ctx) {
    //     const fullText = ctx.message.text; // Например: "/calc 10 20"

    //     // Разрезаем строку по пробелам
    //     const args = fullText.split(' '); // Получим ['/calc', '10', '20']

    //     // Берем аргументы после самой команды
    //     const num1 = parseFloat(args[1]);
    //     const num2 = parseFloat(args[2]);

    //     if (isNaN(num1) || isNaN(num2)) {
    //         return ctx.reply('⚠️ Ошибка! Используйте команду так: /calc [число1] [число2]\nПример: /calc 5 10');
    //     }

    //     const sum = num1 + num2;
    //     ctx.reply(`🧮 Результат сложения ${num1} + ${num2} = ${sum}`);
    // }

    // // 4. ТЕСТ ИНЛАЙН КНОПКИ (Префикс command для вызова меню + button для обработки клика)
    // // Сработает на /menu и отправит кнопку
    // static commandMenu(ctx) {
    //     ctx.reply('Выберите одну из кнопок ниже:', {
    //         reply_markup: {
    //             inline_keyboard: [
    //                 [
    //                     // callback_data — это то, что ваша карта buttons поймает в нижнем регистре
    //                     { text: '👍 Класс', callback_data: 'like' },
    //                     { text: '👎 Плохо', callback_data: 'dislike' }
    //                 ]
    //             ]
    //         }
    //     });
    // }

    // // Сработает автоматически, если нажать на первую кнопку (callback_data: 'like')
    // static buttonLike(ctx) {
    //     ctx.reply('Рад, что тебе понравилось! ❤️');
    // }

    // // Сработает автоматически, если нажать на вторую кнопку (callback_data: 'dislike')
    // static buttonDislike(ctx) {
    //     ctx.reply('Жаль, я буду стараться лучше. 😢');
    // }
}